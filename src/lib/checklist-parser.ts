import * as XLSX from 'xlsx'

export interface ParsedChecklistItem {
  section: string | null
  item_no: number
  description: string
}

export interface ParsedChecklist {
  name: string
  description: string | null
  signatories: string[]
  items: ParsedChecklistItem[]
}

const DEFAULT_SIGNATORIES = [
  'C&W Representative',
  'Electrical Representative',
  'HVAC Representative',
  'Siemens Representative',
  'IT Representative',
  'Ostraca Representative',
]

const ITEM_DESC_LABEL = /^item.*(description|to check|desc)\b/i
const SNO_LABEL = /^(s\.?\s*no|sr\.?\s*no)\b/i
const TITLE_HINT = /checklist/i

function asStr(v: unknown): string {
  return typeof v === 'string' ? v.trim() : v == null ? '' : String(v).trim()
}

function asNum(v: unknown): number | null {
  if (typeof v === 'number' && Number.isFinite(v)) return v
  if (typeof v === 'string') {
    const t = v.trim()
    if (/^\d+$/.test(t)) return parseInt(t, 10)
  }
  return null
}

/**
 * Parse a single checklist Excel sheet (4-column layout: S.No / Description / Status / Remarks).
 *
 * Tolerates the variations seen across the four sample templates:
 * - "S.No" or "Sr. No." in any column
 * - Column-label header above the first item ("Item description" / "Item to Check")
 * - Subsection banners on a row that has "S.No" + the section name in the
 *   description column, followed immediately by the column-label row
 * - Signatory rows containing the word "Representative" anywhere after the items
 */
export function parseChecklistWorkbook(wb: XLSX.WorkBook, fallbackName: string): ParsedChecklist {
  // Use the first sheet
  const sheet = wb.Sheets[wb.SheetNames[0]]
  const rows: unknown[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' })

  // Detect the description column from the first row that labels "Item description" / "Item to Check"
  let descCol = -1
  for (const row of rows) {
    for (let c = 0; c < row.length; c++) {
      if (ITEM_DESC_LABEL.test(asStr(row[c]))) {
        descCol = c
        break
      }
    }
    if (descCol >= 0) break
  }
  if (descCol < 0) {
    // Fallback: assume column B if no header found (matches the blank "Checklist Template.xlsx" layout)
    descCol = 1
  }
  const snoCol = Math.max(0, descCol - 1)

  // Detect title (first row near the top whose any cell contains "CHECKLIST")
  let title = ''
  for (let r = 0; r < Math.min(rows.length, 12); r++) {
    for (const v of rows[r]) {
      const s = asStr(v)
      if (s && TITLE_HINT.test(s) && s.length > title.length) title = s
    }
    if (title) break
  }
  if (!title) title = fallbackName

  // Walk all rows, collecting items and section banners.
  // A "Note:" row terminates the items section — anything after it (including
  // numbered signatory lines) is footer content, not checklist items.
  const items: ParsedChecklistItem[] = []
  let currentSection: string | null = null
  let inFooter = false

  for (let r = 0; r < rows.length; r++) {
    const row = rows[r]

    // Footer transition: a "Note:" *label* row (no trailing instructions),
    // and only after at least one item has been collected. This avoids
    // tripping on "Note: please tick where applicable..." instruction rows
    // that sit ABOVE the items table in some templates.
    if (!inFooter && items.length > 0) {
      for (const v of row) {
        if (/^note\s*[:\-]?$/i.test(asStr(v))) {
          inFooter = true
          break
        }
      }
    }
    if (inFooter) continue

    const snoCell = row[snoCol]
    const descCell = asStr(row[descCol])

    // Item row: first column has a number, description column has text
    const n = asNum(snoCell)
    if (n != null && descCell) {
      items.push({
        section: currentSection,
        item_no: n,
        description: descCell,
      })
      continue
    }

    // Possible section banner: S.No label in snoCol + non-label text in descCol
    const snoStr = asStr(snoCell)
    if (SNO_LABEL.test(snoStr)) {
      if (descCell && !ITEM_DESC_LABEL.test(descCell)) {
        currentSection = descCell
      }
      continue
    }
  }

  // Renumber item_no per section so that each section starts at 1 — keeps the
  // PDF clean even when source files duplicate numbers across sections
  const seenSections = new Map<string | null, number>()
  for (const item of items) {
    const next = (seenSections.get(item.section) || 0) + 1
    seenSections.set(item.section, next)
    item.item_no = next
  }

  // Detect signatories: cells containing "Representative" or common misspellings
  // ("representavtibve", "represtatative" appear in the source files)
  const sigPattern = /repr[a-z]*tat[a-z]*\b|repres[a-z]*tive\b/i
  const signatories: string[] = []
  const seenSig = new Set<string>()
  for (const row of rows) {
    for (const v of row) {
      const s = asStr(v)
      if (sigPattern.test(s) && s.length < 80 && !seenSig.has(s)) {
        seenSig.add(s)
        signatories.push(s)
      }
    }
  }

  return {
    name: title.replace(/^\s*checklist\s+for\s+/i, '').trim() || title,
    description: null,
    signatories: signatories.length > 0 ? signatories : DEFAULT_SIGNATORIES,
    items,
  }
}

/**
 * Convenience wrapper for File / Blob input from the browser Upload UI.
 */
export async function parseChecklistFile(file: File): Promise<ParsedChecklist> {
  const ab = await file.arrayBuffer()
  const wb = XLSX.read(ab, { type: 'array' })
  const fallback = file.name.replace(/\.xlsx?$/i, '')
  return parseChecklistWorkbook(wb, fallback)
}
