import bcrypt from 'bcryptjs'
import { supabase } from './supabase'
import type { ModuleKey } from './modules'

const SESSION_KEY = 'boqm.session'
const SESSION_TTL_MS = 24 * 60 * 60 * 1000 // 24h

export type Role = 'user' | 'admin' | 'superuser'

export interface Session {
  tenant_id: string
  tenant_code: string
  tenant_name: string
  user_id: string
  username: string
  full_name: string | null
  role: Role
  allowed_modules: ModuleKey[]
  expires_at: number
}

export function getSession(): Session | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(SESSION_KEY)
    if (!raw) return null
    const s = JSON.parse(raw) as Session
    if (!s.expires_at || s.expires_at < Date.now()) {
      window.localStorage.removeItem(SESSION_KEY)
      return null
    }
    return s
  } catch {
    return null
  }
}

export function clearSession() {
  if (typeof window === 'undefined') return
  window.localStorage.removeItem(SESSION_KEY)
}

function saveSession(s: Session) {
  window.localStorage.setItem(SESSION_KEY, JSON.stringify(s))
}

export function isSuperuser(s: Session | null = getSession()) {
  return s?.role === 'superuser'
}

export function isAdmin(s: Session | null = getSession()) {
  return s?.role === 'admin' || s?.role === 'superuser'
}

export function hasModuleAccess(moduleKey: ModuleKey, s: Session | null = getSession()): boolean {
  if (!s) return false
  if (s.role === 'superuser') return true
  return s.allowed_modules.includes(moduleKey)
}

/**
 * Look up the company name for a given company code (used by the login form to
 * confirm "you're logging into EFC Constructions Ltd." as the user types).
 */
export async function lookupTenantName(companyCode: string): Promise<string | null> {
  const trimmed = companyCode.trim()
  if (!trimmed) return null
  const { data } = await supabase
    .from('tenants')
    .select('company_name')
    .ilike('company_code', trimmed)
    .eq('is_active', true)
    .maybeSingle()
  return data?.company_name ?? null
}

/**
 * Log in with (companyCode, username, password). The company code resolves the
 * tenant; the username picks the user within that tenant (case-insensitive,
 * unique per tenant); the password is then bcrypt-checked against that user.
 * Usernames are compared in JS rather than with `ilike`, because `_` and `%` are
 * LIKE wildcards and usernames may contain them.
 */
export async function login(companyCode: string, username: string, password: string): Promise<Session> {
  const code = companyCode.trim()
  const uname = username.trim()
  if (!code) throw new Error('Company code is required')
  if (!uname) throw new Error('Username is required')
  if (!password) throw new Error('Password is required')

  const { data: tenant, error: tenantErr } = await supabase
    .from('tenants')
    .select('id, company_code, company_name, is_active')
    .ilike('company_code', code)
    .maybeSingle()
  if (tenantErr) throw new Error('Could not reach server')
  if (!tenant || !tenant.is_active) throw new Error('Invalid company code')

  const { data: users, error: usersErr } = await supabase
    .from('tenant_users')
    .select('id, username, password_hash, full_name, role, allowed_modules, is_active')
    .eq('tenant_id', tenant.id)
    .eq('is_active', true)
  if (usersErr) throw new Error('Could not reach server')

  // The DB's UNIQUE (tenant_id, username) is case-sensitive, so in theory "Admin"
  // and "admin" could both exist; try an exact-case match first.
  const lower = uname.toLowerCase()
  const candidates = (users || [])
    .filter((u) => (u.username || '').toLowerCase() === lower)
    .sort((a, b) => Number(b.username === uname) - Number(a.username === uname))
  if (candidates.length === 0) throw new Error('Invalid username or password')

  for (const u of candidates) {
    if (!u.password_hash) continue
    const ok = await bcrypt.compare(password, u.password_hash)
    if (ok) {
      const session: Session = {
        tenant_id: tenant.id,
        tenant_code: tenant.company_code,
        tenant_name: tenant.company_name,
        user_id: u.id,
        username: u.username,
        full_name: u.full_name,
        role: (u.role as Role) || 'user',
        allowed_modules: (u.allowed_modules as ModuleKey[]) || [],
        expires_at: Date.now() + SESSION_TTL_MS,
      }
      saveSession(session)
      return session
    }
  }
  throw new Error('Invalid username or password')
}

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, 10)
}
