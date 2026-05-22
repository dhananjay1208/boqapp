/**
 * Material-level compliance helpers for the Documents Compliance module
 * and the Material GRN two-way sync.
 *
 * Storage path convention: material-compliance/{material_id}/{doc_type}_{timestamp}.{ext}
 * Bucket: compliance-docs (shared with the existing GRN-side docs).
 */
import { supabase } from './supabase'
import { getSession } from './auth'

export type DocType = 'test_certificate' | 'tds'
export type DocStatus = 'pending' | 'uploaded' | 'not_applicable'
export type EffectiveDocStatus = 'uploaded' | 'na' | 'pending'

/**
 * Combine the per-GRN-line-item doc state with the material-level compliance library row.
 * Uploads always win over NA — if either side has a file, the slot is "uploaded".
 */
export function effectiveDocStatus(
  doc: { document_type: string; is_applicable: boolean; is_uploaded: boolean },
  libSlot: { status: DocStatus } | undefined
): EffectiveDocStatus {
  if ((doc.is_applicable && doc.is_uploaded) || libSlot?.status === 'uploaded') return 'uploaded'
  if (!doc.is_applicable || libSlot?.status === 'not_applicable') return 'na'
  return 'pending'
}

/** Map the effective status to the Y/N/NA strings used by the GRN + MIR exports. */
export function docStatusYN(status: EffectiveDocStatus): 'Y' | 'N' | 'NA' {
  return status === 'uploaded' ? 'Y' : status === 'na' ? 'NA' : 'N'
}

export const DOC_TYPES: DocType[] = ['test_certificate', 'tds']

export const DOC_TYPE_LABELS: Record<DocType, string> = {
  test_certificate: 'Test Certificate',
  tds: 'TDS',
}

export interface MaterialComplianceDoc {
  id: string
  material_id: string
  doc_type: DocType
  status: DocStatus
  file_path: string | null
  file_name: string | null
  uploaded_at: string | null
  uploaded_by: string | null
  updated_at: string
}

const BUCKET = 'compliance-docs'

function buildStoragePath(materialId: string, docType: DocType, file: File): string {
  const ext = file.name.includes('.') ? file.name.split('.').pop() : 'bin'
  return `material-compliance/${materialId}/${docType}_${Date.now()}.${ext}`
}

/**
 * Upload a file and upsert the (material_id, doc_type) row to status='uploaded'.
 * Returns the saved row.
 */
export async function uploadMaterialComplianceDoc(
  materialId: string,
  docType: DocType,
  file: File
): Promise<MaterialComplianceDoc> {
  const path = buildStoragePath(materialId, docType, file)
  const upload = await supabase.storage.from(BUCKET).upload(path, file, { upsert: false })
  if (upload.error) throw upload.error

  const username = getSession()?.username ?? null
  const now = new Date().toISOString()

  const { data, error } = await supabase
    .from('material_compliance_documents')
    .upsert(
      {
        material_id: materialId,
        doc_type: docType,
        status: 'uploaded',
        file_path: path,
        file_name: file.name,
        uploaded_at: now,
        uploaded_by: username,
      },
      { onConflict: 'material_id,doc_type' }
    )
    .select()
    .single()
  if (error) throw error
  return data as MaterialComplianceDoc
}

/** Flip status to 'pending' or 'not_applicable' without changing the file. */
export async function setMaterialComplianceStatus(
  materialId: string,
  docType: DocType,
  status: 'pending' | 'not_applicable'
): Promise<void> {
  const patch: Record<string, unknown> = { status }
  if (status === 'pending') {
    // Clear the file pointer when reverting to pending so the UI prompts to upload again.
    patch.file_path = null
    patch.file_name = null
    patch.uploaded_at = null
    patch.uploaded_by = null
  }
  const { error } = await supabase
    .from('material_compliance_documents')
    .upsert(
      { material_id: materialId, doc_type: docType, ...patch },
      { onConflict: 'material_id,doc_type' }
    )
  if (error) throw error
}

/** Open a stored compliance doc in a new tab via signed URL. */
export async function openMaterialComplianceDoc(filePath: string): Promise<void> {
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(filePath, 3600)
  if (error || !data) throw error || new Error('Could not sign URL')
  window.open(data.signedUrl, '_blank')
}

/**
 * Enrol N materials by creating two rows each (one per doc_type) at status='pending'.
 * Idempotent: existing (material_id, doc_type) pairs are skipped via ON CONFLICT.
 */
export async function enrolMaterials(materialIds: string[]): Promise<void> {
  if (materialIds.length === 0) return
  const rows = materialIds.flatMap((id) =>
    DOC_TYPES.map((doc_type) => ({
      material_id: id,
      doc_type,
      status: 'pending' as const,
    }))
  )
  const { error } = await supabase
    .from('material_compliance_documents')
    .upsert(rows, { onConflict: 'material_id,doc_type', ignoreDuplicates: true })
  if (error) throw error
}

export type LibraryRow = {
  test_certificate?: MaterialComplianceDoc
  tds?: MaterialComplianceDoc
}

/**
 * For each materialId, return the library rows keyed by doc_type so the caller can render slot
 * state for both doc types in one render pass. Materials with no library rows are simply absent
 * from the map.
 */
export async function fetchMaterialComplianceMap(
  materialIds: string[]
): Promise<Map<string, LibraryRow>> {
  const map = new Map<string, LibraryRow>()
  if (materialIds.length === 0) return map
  const { data, error } = await supabase
    .from('material_compliance_documents')
    .select('id, material_id, doc_type, status, file_path, file_name, uploaded_at, uploaded_by, updated_at')
    .in('material_id', materialIds)
  if (error) throw error
  for (const row of (data || []) as MaterialComplianceDoc[]) {
    const existing = map.get(row.material_id) ?? {}
    existing[row.doc_type] = row
    map.set(row.material_id, existing)
  }
  return map
}

/** Fetch everything (used by the Documents Compliance page list). */
export async function fetchAllMaterialCompliance(): Promise<MaterialComplianceDoc[]> {
  const { data, error } = await supabase
    .from('material_compliance_documents')
    .select('id, material_id, doc_type, status, file_path, file_name, uploaded_at, uploaded_by, updated_at')
  if (error) throw error
  return (data || []) as MaterialComplianceDoc[]
}

/**
 * Called from the GRN page after a per-line-item upload succeeds. Seeds the material-level library
 * if (and only if) the existing library row is at status='pending' (or absent). Pre-existing
 * 'uploaded' or 'not_applicable' library rows are left untouched — the GRN upload is a per-invoice
 * override in that case.
 *
 * Note: we point the library row at the SAME file the GRN side uploaded (no duplicate copy in
 * storage). Deleting the GRN line item would CASCADE-delete the grn_line_item_documents row but
 * NOT the storage object; the library reference stays valid.
 */
export async function seedMaterialComplianceFromGrn(
  materialId: string,
  docType: DocType,
  filePath: string,
  fileName: string
): Promise<void> {
  const { data: existing, error: fetchErr } = await supabase
    .from('material_compliance_documents')
    .select('id, status')
    .eq('material_id', materialId)
    .eq('doc_type', docType)
    .maybeSingle()
  if (fetchErr) throw fetchErr

  // Skip if the library already has a real value the user set deliberately.
  if (existing && existing.status !== 'pending') return

  const username = getSession()?.username ?? null
  const now = new Date().toISOString()

  const { error } = await supabase
    .from('material_compliance_documents')
    .upsert(
      {
        material_id: materialId,
        doc_type: docType,
        status: 'uploaded',
        file_path: filePath,
        file_name: fileName,
        uploaded_at: now,
        uploaded_by: username,
      },
      { onConflict: 'material_id,doc_type' }
    )
  if (error) throw error
}
