/**
 * Shared queries, types and helpers for the per-BOQ-line-item workflow modules:
 *   /boq-item-compliance  (manage)
 *   /boq-item-overview    (read-only dashboard)
 *
 * Tables (migration 030): boqc_materials, boqc_documents, boqc_ra_entries.
 * GRN link (migration 031): grn_line_items.boq_line_item_id.
 *
 * Files live in the existing compliance-docs bucket (see openMaterialComplianceDoc).
 *
 * The keyword scorer (tokenize / scoreMaterial / buildCandidates / heuristicRecommend)
 * is intentionally pure (no supabase / window access) so the AI route handler can
 * import and reuse it for candidate-building and the heuristic fallback.
 */
import { supabase } from './supabase'
import { getSession, isSuperuser } from './auth'
import {
  effectiveDocStatus,
  openMaterialComplianceDoc,
  type DocStatus,
  type EffectiveDocStatus,
} from './material-compliance'

const BUCKET = 'compliance-docs'

// ===========================================================================
// Types
// ===========================================================================

export interface Site {
  id: string
  name: string
}

export interface PackageData {
  id: string
  name: string
  site_id: string
}

export interface BOQHeadline {
  id: string
  serial_number: number
  name: string
  package_id: string
}

export interface BOQLineItem {
  id: string
  item_number: string
  description: string
  location: string | null
  unit: string
  quantity: number
  headline_id: string
}

export type BoqcDocType = 'tds' | 'test_certificate'

export interface BoqcMaterial {
  id: string
  boq_line_item_id: string
  material_id: string | null
  material_name: string
  unit: string | null
  estimated_quantity: number | null
  source: 'ai' | 'manual' | 'ai_edited' | 'grn'
  is_approved: boolean
  shared_with_vendor_at: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

export interface BoqcDocument {
  id: string
  boqc_material_id: string
  doc_type: BoqcDocType
  status: DocStatus
  file_path: string | null
  file_name: string | null
  uploaded_at: string | null
  uploaded_by: string | null
}

export interface BoqcRaEntry {
  id: string
  boq_line_item_id: string
  ra_number: number
  new_quantity: number
  previous_quantity: number
  upto_date_quantity: number
  mb_sheet_file_path: string | null
  mb_sheet_file_name: string | null
  remarks: string | null
  entry_date: string | null
}

/** A test certificate captured at goods-receipt, linked back to a BOQ line item. */
export interface GrnTestCert {
  file_path: string
  file_name: string | null
}

export interface MasterMaterialLite {
  id: string
  name: string
  category: string
  unit: string
}

// ===========================================================================
// Cascade fetchers (Site -> Package -> Headline -> Line Item)
// ===========================================================================

/** Sites, tenant-scoped for non-superusers (sites carry tenant_id; master data does not). */
export async function fetchSites(): Promise<Site[]> {
  const session = getSession()
  let query = supabase.from('sites').select('id, name').order('name')
  if (session && !isSuperuser(session)) {
    query = query.eq('tenant_id', session.tenant_id)
  }
  const { data, error } = await query
  if (error) throw error
  return (data || []) as Site[]
}

export async function fetchPackagesForSite(siteId: string): Promise<PackageData[]> {
  const { data, error } = await supabase
    .from('packages')
    .select('id, name, site_id')
    .eq('site_id', siteId)
    .order('name')
  if (error) throw error
  return (data || []) as PackageData[]
}

export async function fetchHeadlinesForPackages(packageIds: string[]): Promise<BOQHeadline[]> {
  if (packageIds.length === 0) return []
  const { data, error } = await supabase
    .from('boq_headlines')
    .select('id, serial_number, name, package_id')
    .in('package_id', packageIds)
    .order('serial_number')
  if (error) throw error
  return (data || []) as BOQHeadline[]
}

export async function fetchLineItemsForHeadlines(headlineIds: string[]): Promise<BOQLineItem[]> {
  if (headlineIds.length === 0) return []
  const { data, error } = await supabase
    .from('boq_line_items')
    .select('id, item_number, description, location, unit, quantity, headline_id')
    .in('headline_id', headlineIds)
    .order('item_number')
  if (error) throw error
  return (data || []).map((r: Record<string, unknown>) => ({
    ...(r as unknown as BOQLineItem),
    quantity: Number(r.quantity) || 0,
  }))
}

// ===========================================================================
// Stage 1 — Materials per line item
// ===========================================================================

export async function fetchBoqcMaterials(lineItemId: string): Promise<BoqcMaterial[]> {
  const { data, error } = await supabase
    .from('boqc_materials')
    .select('*')
    .eq('boq_line_item_id', lineItemId)
    .order('created_at')
  if (error) throw error
  return (data || []).map(coerceBoqcMaterial)
}

export async function addBoqcMaterial(input: {
  boq_line_item_id: string
  material_id: string | null
  material_name: string
  unit: string | null
  estimated_quantity: number | null
  source: BoqcMaterial['source']
}): Promise<BoqcMaterial> {
  const { data, error } = await supabase
    .from('boqc_materials')
    .insert({
      boq_line_item_id: input.boq_line_item_id,
      material_id: input.material_id,
      material_name: input.material_name,
      unit: input.unit,
      estimated_quantity: input.estimated_quantity,
      source: input.source,
    })
    .select()
    .single()
  if (error) throw error
  return coerceBoqcMaterial(data)
}

/**
 * Best-effort, idempotent: ensure a boqc_materials row exists for a material received via
 * a GRN line item that's linked to a BOQ line item. Never throws — a compliance side-effect
 * must not break the GRN save — and never overwrites an existing row (ignoreDuplicates), so a
 * material the engineer already added/approved is left untouched.
 */
export async function ensureBoqcMaterialFromGrn(input: {
  boq_line_item_id: string
  material_id: string
  material_name: string
  unit: string | null
}): Promise<void> {
  try {
    const { error } = await supabase.from('boqc_materials').upsert(
      {
        boq_line_item_id: input.boq_line_item_id,
        material_id: input.material_id,
        material_name: input.material_name,
        unit: input.unit,
        source: 'grn',
      },
      { onConflict: 'boq_line_item_id,material_id', ignoreDuplicates: true }
    )
    if (error) throw error
  } catch (err) {
    console.error('ensureBoqcMaterialFromGrn failed (non-blocking):', err)
  }
}

export async function updateBoqcMaterial(
  id: string,
  patch: Partial<Pick<BoqcMaterial, 'material_name' | 'unit' | 'estimated_quantity' | 'is_approved' | 'source' | 'notes'>>
): Promise<void> {
  const { error } = await supabase.from('boqc_materials').update(patch).eq('id', id)
  if (error) throw error
}

export async function deleteBoqcMaterial(id: string): Promise<void> {
  const { error } = await supabase.from('boqc_materials').delete().eq('id', id)
  if (error) throw error
}

export async function setBoqcMaterialApproved(id: string, approved: boolean): Promise<void> {
  await updateBoqcMaterial(id, { is_approved: approved })
}

/** Stamp shared_with_vendor_at on all approved materials of a line item. */
export async function markSharedWithVendor(lineItemId: string): Promise<void> {
  const { error } = await supabase
    .from('boqc_materials')
    .update({ shared_with_vendor_at: new Date().toISOString() })
    .eq('boq_line_item_id', lineItemId)
    .eq('is_approved', true)
  if (error) throw error
}

function coerceBoqcMaterial(r: Record<string, unknown>): BoqcMaterial {
  return {
    ...(r as unknown as BoqcMaterial),
    estimated_quantity: r.estimated_quantity == null ? null : Number(r.estimated_quantity),
  }
}

// ===========================================================================
// Stages 2 & 3 — TDS + Test Certificate documents
// ===========================================================================

export type BoqcDocsByType = { tds?: BoqcDocument; test_certificate?: BoqcDocument }

/** Map boqc_material_id -> { tds, test_certificate } for a set of material rows. */
export async function fetchBoqcDocsMap(boqcMaterialIds: string[]): Promise<Map<string, BoqcDocsByType>> {
  const map = new Map<string, BoqcDocsByType>()
  if (boqcMaterialIds.length === 0) return map
  const { data, error } = await supabase
    .from('boqc_documents')
    .select('id, boqc_material_id, doc_type, status, file_path, file_name, uploaded_at, uploaded_by')
    .in('boqc_material_id', boqcMaterialIds)
  if (error) throw error
  for (const row of (data || []) as BoqcDocument[]) {
    const existing = map.get(row.boqc_material_id) ?? {}
    existing[row.doc_type] = row
    map.set(row.boqc_material_id, existing)
  }
  return map
}

function buildDocPath(boqcMaterialId: string, docType: BoqcDocType, file: File): string {
  const ext = file.name.includes('.') ? file.name.split('.').pop() : 'bin'
  return `boq-item-compliance/${boqcMaterialId}/${docType}_${Date.now()}.${ext}`
}

/** Upload a file and upsert the (boqc_material_id, doc_type) row to status='uploaded'. */
export async function uploadBoqcDoc(
  boqcMaterialId: string,
  docType: BoqcDocType,
  file: File
): Promise<void> {
  const path = buildDocPath(boqcMaterialId, docType, file)
  const upload = await supabase.storage.from(BUCKET).upload(path, file, { upsert: false })
  if (upload.error) throw upload.error

  const username = getSession()?.username ?? null
  const { error } = await supabase
    .from('boqc_documents')
    .upsert(
      {
        boqc_material_id: boqcMaterialId,
        doc_type: docType,
        status: 'uploaded',
        file_path: path,
        file_name: file.name,
        uploaded_at: new Date().toISOString(),
        uploaded_by: username,
      },
      { onConflict: 'boqc_material_id,doc_type' }
    )
  if (error) throw error
}

/** Flip a doc slot to 'pending' or 'not_applicable' (clears the file on revert to pending). */
export async function setBoqcDocStatus(
  boqcMaterialId: string,
  docType: BoqcDocType,
  status: 'pending' | 'not_applicable'
): Promise<void> {
  const patch: Record<string, unknown> = { status }
  if (status === 'pending') {
    patch.file_path = null
    patch.file_name = null
    patch.uploaded_at = null
    patch.uploaded_by = null
  }
  const { error } = await supabase
    .from('boqc_documents')
    .upsert(
      { boqc_material_id: boqcMaterialId, doc_type: docType, ...patch },
      { onConflict: 'boqc_material_id,doc_type' }
    )
  if (error) throw error
}

/** Open a stored doc (compliance-docs bucket) in a new tab via signed URL. */
export async function openBoqcDoc(filePath: string): Promise<void> {
  await openMaterialComplianceDoc(filePath)
}

// ===========================================================================
// Test certificate surfacing from a linked GRN line item
// ===========================================================================

/**
 * For a BOQ line item, return Map<material_id, GrnTestCert> of test certificates
 * uploaded against GRN line items linked to this BOQ line item. Used to surface a
 * GRN-sourced test cert as the effective status for a boqc_materials row.
 */
export async function fetchGrnTestCertMap(lineItemId: string): Promise<Map<string, GrnTestCert>> {
  const map = new Map<string, GrnTestCert>()
  const { data, error } = await supabase
    .from('grn_line_items')
    .select('material_id, grn_line_item_documents(file_path, file_name, is_uploaded, document_type)')
    .eq('boq_line_item_id', lineItemId)
  if (error) throw error
  for (const row of (data || []) as Array<Record<string, unknown>>) {
    const materialId = row.material_id as string | null
    if (!materialId) continue
    const docs = (row.grn_line_item_documents || []) as Array<{
      file_path: string | null
      file_name: string | null
      is_uploaded: boolean
      document_type: string
    }>
    const cert = docs.find((d) => d.document_type === 'test_certificate' && d.is_uploaded && d.file_path)
    if (cert && cert.file_path) {
      map.set(materialId, { file_path: cert.file_path, file_name: cert.file_name })
    }
  }
  return map
}

/**
 * Effective test-cert status for a material on a line item: a direct boqc_documents
 * upload OR a GRN-sourced cert both count as "uploaded" (uploads win).
 */
export function effectiveTestCertStatus(
  doc: BoqcDocument | undefined,
  grnCert: GrnTestCert | undefined
): EffectiveDocStatus {
  const docShape = {
    document_type: 'test_certificate',
    is_applicable: doc ? doc.status !== 'not_applicable' : true,
    is_uploaded: doc ? doc.status === 'uploaded' : false,
  }
  const libSlot = grnCert ? ({ status: 'uploaded' as DocStatus }) : undefined
  return effectiveDocStatus(docShape, libSlot)
}

// ===========================================================================
// Stage 5 — RA billing + MB sheet
// ===========================================================================

export async function fetchRaEntries(lineItemId: string): Promise<BoqcRaEntry[]> {
  const { data, error } = await supabase
    .from('boqc_ra_entries')
    .select('*')
    .eq('boq_line_item_id', lineItemId)
    .order('ra_number')
  if (error) throw error
  return (data || []).map(coerceRaEntry)
}

export async function addRaEntry(input: {
  boq_line_item_id: string
  ra_number: number
  new_quantity: number
  remarks: string | null
  entry_date: string | null
}): Promise<BoqcRaEntry> {
  const { data, error } = await supabase
    .from('boqc_ra_entries')
    .insert({
      boq_line_item_id: input.boq_line_item_id,
      ra_number: input.ra_number,
      new_quantity: input.new_quantity,
      remarks: input.remarks,
      entry_date: input.entry_date,
    })
    .select()
    .single()
  if (error) throw error
  await recomputeRaCumulatives(input.boq_line_item_id)
  return coerceRaEntry(data)
}

export async function updateRaEntry(
  id: string,
  lineItemId: string,
  patch: Partial<Pick<BoqcRaEntry, 'new_quantity' | 'remarks' | 'entry_date'>>
): Promise<void> {
  const { error } = await supabase.from('boqc_ra_entries').update(patch).eq('id', id)
  if (error) throw error
  await recomputeRaCumulatives(lineItemId)
}

export async function deleteRaEntry(id: string, lineItemId: string): Promise<void> {
  const { error } = await supabase.from('boqc_ra_entries').delete().eq('id', id)
  if (error) throw error
  await recomputeRaCumulatives(lineItemId)
}

/**
 * Re-derive previous_quantity / upto_date_quantity for ALL RA rows of a line item,
 * ordered by ra_number. new_quantity is the only user-entered value; this keeps the
 * cumulative columns authoritative (the Overview reads upto_date_quantity directly).
 */
export async function recomputeRaCumulatives(lineItemId: string): Promise<void> {
  const entries = await fetchRaEntries(lineItemId)
  let running = 0
  for (const e of entries) {
    const previous = running
    const upto = previous + e.new_quantity
    running = upto
    if (e.previous_quantity !== previous || e.upto_date_quantity !== upto) {
      const { error } = await supabase
        .from('boqc_ra_entries')
        .update({ previous_quantity: previous, upto_date_quantity: upto })
        .eq('id', e.id)
      if (error) throw error
    }
  }
}

/** Upload an MB-sheet Excel attachment for an RA entry. */
export async function uploadMbSheet(
  raEntryId: string,
  lineItemId: string,
  raNumber: number,
  file: File
): Promise<void> {
  const ext = file.name.includes('.') ? file.name.split('.').pop() : 'xlsx'
  const path = `boq-item-compliance/ra/${lineItemId}/RA${raNumber}_${Date.now()}.${ext}`
  const upload = await supabase.storage.from(BUCKET).upload(path, file, { upsert: false })
  if (upload.error) throw upload.error
  const { error } = await supabase
    .from('boqc_ra_entries')
    .update({ mb_sheet_file_path: path, mb_sheet_file_name: file.name })
    .eq('id', raEntryId)
  if (error) throw error
}

function coerceRaEntry(r: Record<string, unknown>): BoqcRaEntry {
  return {
    ...(r as unknown as BoqcRaEntry),
    new_quantity: Number(r.new_quantity) || 0,
    previous_quantity: Number(r.previous_quantity) || 0,
    upto_date_quantity: Number(r.upto_date_quantity) || 0,
  }
}

// ===========================================================================
// Overview aggregation
// ===========================================================================

export interface LineItemOverview {
  lineItemId: string
  materialsCount: number
  approvedCount: number
  tdsUploadedCount: number   // among approved materials
  testCertCount: number      // among approved materials (direct OR GRN-sourced)
  raCount: number
  uptoDate: number           // latest RA upto-date quantity
}

/**
 * Aggregate workflow status for a set of line items in a few round-trips.
 * Counts of TDS/Test-Cert are computed over APPROVED materials only (the ones
 * that drive compliance once shared with the vendor).
 */
export async function fetchOverviewForScope(lineItemIds: string[]): Promise<Map<string, LineItemOverview>> {
  const result = new Map<string, LineItemOverview>()
  for (const id of lineItemIds) {
    result.set(id, {
      lineItemId: id,
      materialsCount: 0,
      approvedCount: 0,
      tdsUploadedCount: 0,
      testCertCount: 0,
      raCount: 0,
      uptoDate: 0,
    })
  }
  if (lineItemIds.length === 0) return result

  // 1. Materials
  const { data: matData, error: matErr } = await supabase
    .from('boqc_materials')
    .select('id, boq_line_item_id, material_id, is_approved')
    .in('boq_line_item_id', lineItemIds)
  if (matErr) throw matErr
  const materials = (matData || []) as Array<{
    id: string
    boq_line_item_id: string
    material_id: string | null
    is_approved: boolean
  }>

  // boqc_material_id -> { lineItemId, materialId, approved }
  const matMeta = new Map<string, { lineItemId: string; materialId: string | null; approved: boolean }>()
  for (const m of materials) {
    matMeta.set(m.id, { lineItemId: m.boq_line_item_id, materialId: m.material_id, approved: m.is_approved })
    const ov = result.get(m.boq_line_item_id)!
    ov.materialsCount += 1
    if (m.is_approved) ov.approvedCount += 1
  }

  // 2. boqc_documents for those materials
  const boqcMaterialIds = materials.map((m) => m.id)
  const docsMap = await fetchBoqcDocsMap(boqcMaterialIds)

  // 3. GRN-sourced test certs per line item -> Map<lineItemId, Set<material_id>>
  const grnCertByLine = new Map<string, Set<string>>()
  const { data: grnData, error: grnErr } = await supabase
    .from('grn_line_items')
    .select('boq_line_item_id, material_id, grn_line_item_documents(is_uploaded, document_type)')
    .in('boq_line_item_id', lineItemIds)
  if (grnErr) throw grnErr
  for (const row of (grnData || []) as Array<Record<string, unknown>>) {
    const lineId = row.boq_line_item_id as string | null
    const materialId = row.material_id as string | null
    if (!lineId || !materialId) continue
    const docs = (row.grn_line_item_documents || []) as Array<{ is_uploaded: boolean; document_type: string }>
    if (docs.some((d) => d.document_type === 'test_certificate' && d.is_uploaded)) {
      const set = grnCertByLine.get(lineId) ?? new Set<string>()
      set.add(materialId)
      grnCertByLine.set(lineId, set)
    }
  }

  // Fold docs into per-line-item counts (approved materials only)
  for (const [boqcMaterialId, meta] of matMeta) {
    if (!meta.approved) continue
    const ov = result.get(meta.lineItemId)!
    const slots = docsMap.get(boqcMaterialId)
    if (slots?.tds?.status === 'uploaded') ov.tdsUploadedCount += 1
    const directCert = slots?.test_certificate?.status === 'uploaded'
    const grnCert = meta.materialId ? grnCertByLine.get(meta.lineItemId)?.has(meta.materialId) : false
    if (directCert || grnCert) ov.testCertCount += 1
  }

  // 4. RA entries -> count + latest upto-date
  const { data: raData, error: raErr } = await supabase
    .from('boqc_ra_entries')
    .select('boq_line_item_id, ra_number, upto_date_quantity')
    .in('boq_line_item_id', lineItemIds)
  if (raErr) throw raErr
  const latestRa = new Map<string, { raNumber: number; upto: number }>()
  for (const row of (raData || []) as Array<{ boq_line_item_id: string; ra_number: number; upto_date_quantity: unknown }>) {
    const ov = result.get(row.boq_line_item_id)
    if (!ov) continue
    ov.raCount += 1
    const upto = Number(row.upto_date_quantity) || 0
    const cur = latestRa.get(row.boq_line_item_id)
    if (!cur || row.ra_number > cur.raNumber) {
      latestRa.set(row.boq_line_item_id, { raNumber: row.ra_number, upto })
    }
  }
  for (const [lineId, latest] of latestRa) {
    result.get(lineId)!.uptoDate = latest.upto
  }

  return result
}

// ===========================================================================
// Keyword scorer (PURE — safe to import in the server route)
// ===========================================================================

const STOPWORDS = new Set([
  'the', 'and', 'for', 'with', 'of', 'to', 'in', 'as', 'per', 'etc', 'all', 'any',
  'work', 'works', 'providing', 'provide', 'laying', 'lay', 'including', 'include',
  'complete', 'completed', 'required', 'rate', 'nos', 'no', 'shall', 'be', 'approved',
  'specification', 'specifications', 'drawing', 'drawings', 'direction', 'directions',
  'engineer', 'engineers', 'making', 'made', 'fixing', 'fixed', 'item', 'items',
  'mm', 'cm', 'sqm', 'cum', 'rmt', 'kg', 'mtr', 'meter', 'metre', 'unit', 'units',
  'a', 'an', 'is', 'are', 'on', 'at', 'by', 'or', 'from', 'into', 'using', 'use',
])

export function tokenize(text: string): string[] {
  return (text || '')
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length >= 3 && !STOPWORDS.has(t))
}

/** Score a material against the description tokens. Higher = more relevant. */
export function scoreMaterial(descTokens: Set<string>, material: MasterMaterialLite): number {
  if (descTokens.size === 0) return 0
  let score = 0
  const nameLower = material.name.toLowerCase()
  // Whole-name substring appearing in the description is a strong signal.
  const descJoined = Array.from(descTokens).join(' ')
  for (const nameTok of tokenize(material.name)) {
    if (descTokens.has(nameTok)) score += 2
  }
  for (const catTok of tokenize(material.category)) {
    if (descTokens.has(catTok)) score += 1
  }
  // Bonus when a multi-word material name is largely contained in the description.
  if (nameLower.length >= 4 && descJoined.includes(nameLower)) score += 3
  return score
}

/**
 * Build a compact candidate set to send to the model (or to score heuristically):
 * top ~80 by score, topped up to ~150 with other active materials when few score > 0.
 */
export function buildCandidates(
  description: string,
  materials: MasterMaterialLite[],
  opts: { top?: number; topUpTo?: number; minScored?: number } = {}
): MasterMaterialLite[] {
  const top = opts.top ?? 80
  const topUpTo = opts.topUpTo ?? 150
  const minScored = opts.minScored ?? 30
  const descTokens = new Set(tokenize(description))

  const scored = materials
    .map((m) => ({ m, s: scoreMaterial(descTokens, m) }))
    .sort((a, b) => b.s - a.s)

  const positive = scored.filter((x) => x.s > 0)
  let chosen: MasterMaterialLite[]
  if (positive.length >= minScored) {
    chosen = positive.slice(0, top).map((x) => x.m)
  } else {
    // Few keyword hits — include the positives, then top up from the rest.
    const picked = scored.slice(0, Math.max(top, topUpTo)).map((x) => x.m)
    chosen = picked.slice(0, topUpTo)
  }
  return chosen
}

export interface Recommendation {
  material_id: string | null
  material_name: string
  unit: string | null
  estimated_quantity: number | null
  confidence: 'high' | 'medium' | 'low'
  rationale: string
}

/** Pure keyword-only fallback: top scored candidates as low-confidence recommendations. */
export function heuristicRecommend(
  description: string,
  candidates: MasterMaterialLite[],
  limit = 8
): Recommendation[] {
  const descTokens = new Set(tokenize(description))
  return candidates
    .map((m) => ({ m, s: scoreMaterial(descTokens, m) }))
    .filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s)
    .slice(0, limit)
    .map((x) => ({
      material_id: x.m.id,
      material_name: x.m.name,
      unit: x.m.unit,
      estimated_quantity: null,
      confidence: 'low' as const,
      rationale: 'Keyword match against master materials',
    }))
}
