// hash-seed-passwords.js
//
// Generates bcrypt hashes for the seed users in migration 028_multi_tenant.sql
// and prints ready-to-paste SQL.
//
// Usage:  node scripts/hash-seed-passwords.js
//
// Copy the printed INSERT INTO tenant_users statement and paste it into
// supabase/migrations/028_multi_tenant.sql at the marked spot before running
// the migration in Supabase SQL Editor.

const bcrypt = require('bcryptjs')

const ALL_MODULES = [
  'dashboard', 'sites', 'boq', 'boq-progress', 'ra-billing', 'workstations',
  'material-grn', 'inventory', 'expenses', 'expense-dashboard',
  'supplier-invoices', 'checklists', 'reports', 'master-data',
  'admin-users', 'admin-codes', 'admin-tenants',
]

const SEED_USERS = [
  {
    tenant_code: 'Cogneta',
    username: 'Cogneta',
    password: 'Cogneta',
    full_name: 'Cogneta Superuser',
    role: 'superuser',
    allowed_modules: ALL_MODULES,
  },
  {
    tenant_code: 'EFC',
    username: 'admin',
    password: 'admin',
    full_name: 'EFC Admin',
    role: 'admin',
    allowed_modules: ['dashboard', 'sites', 'admin-users'],
  },
]

function sqlArray(arr) {
  return `ARRAY[${arr.map((m) => `'${m}'`).join(',')}]::TEXT[]`
}

;(async () => {
  const rows = []
  for (const u of SEED_USERS) {
    const hash = await bcrypt.hash(u.password, 10)
    rows.push(
      `  ((SELECT id FROM tenants WHERE company_code = '${u.tenant_code}'),` +
      ` '${u.username}',` +
      ` '${hash}',` +
      ` '${u.full_name.replace(/'/g, "''")}',` +
      ` '${u.role}',` +
      ` ${sqlArray(u.allowed_modules)})`
    )
  }

  const sql =
`-- Paste this into migration 028_multi_tenant.sql at the marked spot.
INSERT INTO tenant_users (tenant_id, username, password_hash, full_name, role, allowed_modules) VALUES
${rows.join(',\n')}
ON CONFLICT (tenant_id, username) DO NOTHING;
`

  process.stdout.write(sql)
})()
