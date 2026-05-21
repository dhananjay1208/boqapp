// One-shot: fixes the Cogneta tenant's display name to "Cogneta Automation".
// Mirrors the UPDATE in migration 028 for installs where the migration was
// applied before the rename.
//
// Usage:  node scripts/update-cogneta-name.js

const fs = require('fs')
const path = require('path')
const { createClient } = require('@supabase/supabase-js')

// Hand-parse .env.local (Next.js parses these at build time; node won't unless we ask).
function loadEnv() {
  const file = path.join(__dirname, '..', '.env.local')
  const raw = fs.readFileSync(file, 'utf8')
  for (const line of raw.split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)\s*=\s*(.*)$/)
    if (m) process.env[m[1]] = m[2].replace(/^"|"$/g, '')
  }
}

loadEnv()

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
if (!url || !key) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY')
  process.exit(1)
}

const supabase = createClient(url, key)

;(async () => {
  const { data, error } = await supabase
    .from('tenants')
    .update({ company_name: 'Cogneta Automation' })
    .eq('company_code', 'Cogneta')
    .select('id, company_code, company_name')

  if (error) {
    console.error('Update failed:', error.message)
    process.exit(1)
  }
  if (!data || data.length === 0) {
    console.error('No tenant with company_code = "Cogneta" found. Has migration 028 been run?')
    process.exit(1)
  }
  console.log('Updated:', data)
})()
