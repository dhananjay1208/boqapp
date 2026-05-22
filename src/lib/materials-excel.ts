/**
 * Excel import/export helpers for the Material List page.
 *
 * Three exports:
 *   - parseMaterialsExcel(file, existing) – read .xlsx/.xls, validate, bucket each row into insert/update/skip.
 *   - exportMaterialsXlsx(materials, filename) – download a sheet of the current list.
 *   - downloadMaterialsTemplate() – download an empty-but-headered .xlsx with a couple of example rows.
 *
 * Header detection follows the pattern in src/lib/excel-parser.ts: scan the first 10 rows for a row containing
 * "Category", "Name" (or "Material Name"), and "Unit" so column order isn't fixed.
 */
import * as XLSX from 'xlsx'

export interface ExistingMaterial {
  id: string
  category: string
  name: string
  unit: string
  description: string | null
  is_active: boolean
}

export interface MaterialRowInput {
  category: string
  name: string
  unit: string
  description: string | null
}

export interface InsertRow extends MaterialRowInput {
  /** Spreadsheet row number (1-indexed, includes header), for the preview UI. */
  excelRow: number
}

export interface UpdateRow extends MaterialRowInput {
  id: string
  /** The DB material we matched against (so the UI can show "Update existing"). */
  matchedName: string
  /** True if the matched DB row was soft-deleted and we'll be reactivating it. */
  reactivate: boolean
  excelRow: number
}

export interface SkippedRow {
  excelRow: number
  data: Partial<MaterialRowInput>
  reason: string
}

export interface ParsedImport {
  toInsert: InsertRow[]
  toUpdate: UpdateRow[]
  skipped: SkippedRow[]
  totalRows: number
}

const HEADER_KEYWORDS = {
  category: ['category'],
  name: ['name', 'material name', 'material', 'item', 'description name'],
  unit: ['unit', 'uom', 'unit of measure'],
  description: ['description', 'notes', 'remarks', 'desc'],
}

function normaliseHeader(cell: unknown): string {
  return String(cell ?? '').trim().toLowerCase()
}

function pickColumnIndex(headerRow: unknown[], keywords: string[]): number {
  for (let i = 0; i < headerRow.length; i++) {
    const cell = normaliseHeader(headerRow[i])
    if (!cell) continue
    if (keywords.some((k) => cell === k || cell.includes(k))) return i
  }
  return -1
}

interface HeaderMap {
  rowIndex: number
  category: number
  name: number
  unit: number
  description: number
}

function findHeaderRow(rows: unknown[][]): HeaderMap | null {
  const limit = Math.min(rows.length, 10)
  for (let r = 0; r < limit; r++) {
    const row = rows[r] || []
    const cat = pickColumnIndex(row, HEADER_KEYWORDS.category)
    const name = pickColumnIndex(row, HEADER_KEYWORDS.name)
    const unit = pickColumnIndex(row, HEADER_KEYWORDS.unit)
    // Description is optional — its absence shouldn't disqualify a header row.
    if (cat >= 0 && name >= 0 && unit >= 0) {
      return {
        rowIndex: r,
        category: cat,
        name,
        unit,
        description: pickColumnIndex(row, HEADER_KEYWORDS.description),
      }
    }
  }
  return null
}

function cell(row: unknown[], idx: number): string {
  if (idx < 0) return ''
  const v = row[idx]
  if (v === null || v === undefined) return ''
  return String(v).trim()
}

function keyOf(category: string, name: string): string {
  return `${category.trim().toLowerCase()}::${name.trim().toLowerCase()}`
}

export async function parseMaterialsExcel(
  file: File,
  existing: ExistingMaterial[]
): Promise<ParsedImport> {
  const buf = await file.arrayBuffer()
  const wb = XLSX.read(buf, { type: 'array' })
  const sheetName = wb.SheetNames[0]
  if (!sheetName) throw new Error('Workbook has no sheets')
  const sheet = wb.Sheets[sheetName]
  const rows: unknown[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' })

  const header = findHeaderRow(rows)
  if (!header) {
    throw new Error("Couldn't find a header row with Category / Name / Unit columns")
  }

  // Index existing materials by (category::name) for O(1) match. Includes inactive rows so we can
  // reactivate them on import. If the same key exists active+inactive, prefer active.
  const existingByKey = new Map<string, ExistingMaterial>()
  for (const m of existing) {
    const k = keyOf(m.category, m.name)
    const prev = existingByKey.get(k)
    if (!prev || (!prev.is_active && m.is_active)) existingByKey.set(k, m)
  }

  const toInsert: InsertRow[] = []
  const toUpdate: UpdateRow[] = []
  const skipped: SkippedRow[] = []
  const seenInFile = new Map<string, number>() // key -> first excelRow

  let totalRows = 0
  for (let r = header.rowIndex + 1; r < rows.length; r++) {
    const row = rows[r] || []
    const category = cell(row, header.category)
    const name = cell(row, header.name)
    const unit = cell(row, header.unit)
    const description = cell(row, header.description)

    // Skip entirely blank rows silently — Excel trailing empties shouldn't pollute the preview.
    if (!category && !name && !unit && !description) continue
    totalRows++
    const excelRow = r + 1 // 1-indexed for humans

    if (!category) {
      skipped.push({ excelRow, data: { name, unit, description }, reason: 'Category missing' })
      continue
    }
    if (!name) {
      skipped.push({ excelRow, data: { category, unit, description }, reason: 'Material name missing' })
      continue
    }
    if (!unit) {
      skipped.push({ excelRow, data: { category, name, description }, reason: 'Unit missing' })
      continue
    }

    const k = keyOf(category, name)
    if (seenInFile.has(k)) {
      skipped.push({
        excelRow,
        data: { category, name, unit, description },
        reason: `Duplicate of row ${seenInFile.get(k)} within file`,
      })
      continue
    }
    seenInFile.set(k, excelRow)

    const matched = existingByKey.get(k)
    if (matched) {
      toUpdate.push({
        id: matched.id,
        category,
        name,
        unit,
        description: description || null,
        matchedName: matched.name,
        reactivate: !matched.is_active,
        excelRow,
      })
    } else {
      toInsert.push({
        category,
        name,
        unit,
        description: description || null,
        excelRow,
      })
    }
  }

  return { toInsert, toUpdate, skipped, totalRows }
}

const SHEET_NAME = 'Materials'
const HEADER = ['Category', 'Material Name', 'Unit', 'Description']

function downloadWorkbook(rows: (string | number)[][], filename: string) {
  const wb = XLSX.utils.book_new()
  const ws = XLSX.utils.aoa_to_sheet(rows)
  // Column widths.
  ws['!cols'] = [{ wch: 22 }, { wch: 40 }, { wch: 10 }, { wch: 40 }]
  XLSX.utils.book_append_sheet(wb, ws, SHEET_NAME)
  XLSX.writeFile(wb, filename)
}

export function exportMaterialsXlsx(
  materials: ExistingMaterial[],
  filename: string
): void {
  // Sort by category then name to match the page's display order.
  const sorted = [...materials].sort((a, b) => {
    const c = a.category.localeCompare(b.category)
    return c !== 0 ? c : a.name.localeCompare(b.name)
  })

  const rows: (string | number)[][] = [HEADER]
  for (const m of sorted) {
    rows.push([m.category, m.name, m.unit, m.description ?? ''])
  }
  downloadWorkbook(rows, filename)
}

export function downloadMaterialsTemplate(): void {
  const rows: (string | number)[][] = [
    HEADER,
    ['Cement', 'Ultra Tech PPC', 'bag', '53 grade portland'],
    ['Steel', 'TMT Bar 12mm', 'kg', 'Fe500'],
    ['Aggregates', '20mm Aggregate', 'cum', ''],
  ]
  downloadWorkbook(rows, 'materials_template.xlsx')
}
