// One-shot loader for the two starter checklist templates.
// Reads from ../Demo/Checklists, parses, inserts into Supabase
// (skips templates whose name already exists). Run from app/:
//   node seed-checklists.js

const XLSX = require('xlsx')
const { createClient } = require('@supabase/supabase-js')
const path = require('path')
const fs = require('fs')

// Load .env.local
const envContent = fs.readFileSync('.env.local', 'utf8')
const envVars = {}
envContent.split('\n').forEach((line) => {
  const m = line.match(/^([^=]+)=(.*)$/)
  if (m) envVars[m[1].trim()] = m[2].trim()
})
const supabase = createClient(envVars.NEXT_PUBLIC_SUPABASE_URL, envVars.NEXT_PUBLIC_SUPABASE_ANON_KEY)

const ITEM_DESC_LABEL = /^item.*(description|to check|desc)\b/i
const SNO_LABEL = /^(s\.?\s*no|sr\.?\s*no)\b/i
const TITLE_HINT = /checklist/i
const SIG_PATTERN = /repr[a-z]*tat[a-z]*\b|repres[a-z]*tive\b/i
const NOTE_LABEL = /^note\s*[:\-]?$/i
const DEFAULT_SIGNATORIES = [
  'C&W Representative',
  'Electrical Representative',
  'HVAC Representative',
  'Siemens Representative',
  'IT Representative',
  'Ostraca Representative',
]

const asStr = (v) => (typeof v === 'string' ? v.trim() : v == null ? '' : String(v).trim())
const asNum = (v) => {
  if (typeof v === 'number' && Number.isFinite(v)) return v
  if (typeof v === 'string' && /^\d+$/.test(v.trim())) return parseInt(v.trim(), 10)
  return null
}

function parseChecklist(filePath) {
  const wb = XLSX.read(fs.readFileSync(filePath), { type: 'buffer' })
  const sheet = wb.Sheets[wb.SheetNames[0]]
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' })
  const fallback = path.basename(filePath, path.extname(filePath))

  let descCol = -1
  for (const row of rows) {
    for (let c = 0; c < row.length; c++) {
      if (ITEM_DESC_LABEL.test(asStr(row[c]))) { descCol = c; break }
    }
    if (descCol >= 0) break
  }
  if (descCol < 0) descCol = 1
  const snoCol = Math.max(0, descCol - 1)

  let title = ''
  for (let r = 0; r < Math.min(rows.length, 12); r++) {
    for (const v of rows[r]) {
      const s = asStr(v)
      if (s && TITLE_HINT.test(s) && s.length > title.length) title = s
    }
    if (title) break
  }
  if (!title) title = fallback

  const items = []
  let currentSection = null
  let inFooter = false
  for (const row of rows) {
    if (!inFooter && items.length > 0) {
      for (const v of row) {
        if (NOTE_LABEL.test(asStr(v))) { inFooter = true; break }
      }
    }
    if (inFooter) continue
    const n = asNum(row[snoCol])
    const descCell = asStr(row[descCol])
    if (n != null && descCell) {
      items.push({ section: currentSection, item_no: n, description: descCell })
      continue
    }
    const snoStr = asStr(row[snoCol])
    if (SNO_LABEL.test(snoStr)) {
      if (descCell && !ITEM_DESC_LABEL.test(descCell)) currentSection = descCell
    }
  }

  // Renumber per section
  const seen = new Map()
  for (const it of items) {
    const next = (seen.get(it.section) || 0) + 1
    seen.set(it.section, next)
    it.item_no = next
  }

  // Signatories
  const signatories = []
  const seenSig = new Set()
  for (const row of rows) {
    for (const v of row) {
      const s = asStr(v)
      if (SIG_PATTERN.test(s) && s.length < 80 && !seenSig.has(s)) {
        seenSig.add(s)
        signatories.push(s)
      }
    }
  }

  return {
    name: title.replace(/^\s*checklist\s+for\s+/i, '').trim() || title,
    signatories: signatories.length ? signatories : DEFAULT_SIGNATORIES,
    items,
  }
}

const FILES = [
  '../../Demo/Checklists/Core cuttings.xlsx',
  '../../Demo/Checklists/DB Installation check list.xlsx',
]

async function main() {
  // Skip already-loaded names
  const { data: existing } = await supabase.from('checklist_templates').select('name')
  const existingLower = new Set((existing || []).map((t) => (t.name || '').toLowerCase()))

  for (const rel of FILES) {
    const full = path.resolve(rel)
    if (!fs.existsSync(full)) {
      console.log(`SKIP (not found): ${rel}`)
      continue
    }
    const parsed = parseChecklist(full)
    if (existingLower.has(parsed.name.toLowerCase())) {
      console.log(`SKIP (exists): ${parsed.name}`)
      continue
    }

    const { data: tmpl, error: tErr } = await supabase
      .from('checklist_templates')
      .insert({
        name: parsed.name,
        description: null,
        notes_template: null,
        signatories: parsed.signatories,
      })
      .select()
      .single()
    if (tErr) {
      console.error(`FAIL inserting template "${parsed.name}":`, tErr.message)
      continue
    }

    const itemRows = parsed.items.map((it, idx) => ({
      template_id: tmpl.id,
      item_no: it.item_no,
      description: it.description,
      section: it.section || null,
      sort_order: idx + 1,
    }))
    const { error: iErr } = await supabase.from('checklist_template_items').insert(itemRows)
    if (iErr) {
      console.error(`FAIL inserting items for "${parsed.name}":`, iErr.message)
      continue
    }

    console.log(
      `OK: ${parsed.name} (${parsed.items.length} items, ${parsed.signatories.length} signatories)`
    )
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
