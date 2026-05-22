'use client'

import { useEffect, useState } from 'react'
import { Header } from '@/components/layout/header'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Plus, Pencil, Trash2, Loader2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'
import { getSession, hashPassword, isSuperuser } from '@/lib/auth'
import { MODULES, MODULE_GROUPS, type ModuleKey } from '@/lib/modules'

type Role = 'user' | 'admin' | 'superuser'

interface TenantUser {
  id: string
  tenant_id: string
  username: string
  full_name: string | null
  role: Role
  allowed_modules: ModuleKey[]
  is_active: boolean
  created_at: string
}

interface TenantOption {
  id: string
  company_code: string
  company_name: string
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState<TenantUser[]>([])
  const [tenants, setTenants] = useState<TenantOption[]>([])
  const [selectedTenantId, setSelectedTenantId] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<TenantUser | null>(null)
  const [form, setForm] = useState<{
    username: string
    full_name: string
    role: Role
    password: string
    allowed_modules: ModuleKey[]
    is_active: boolean
  }>({
    username: '',
    full_name: '',
    role: 'user',
    password: '',
    allowed_modules: [],
    is_active: true,
  })
  const [saving, setSaving] = useState(false)

  const session = getSession()
  const cogneta = isSuperuser(session)

  useEffect(() => {
    init()
  }, [])

  useEffect(() => {
    if (selectedTenantId) fetchUsers()
  }, [selectedTenantId])

  async function init() {
    if (!session) return
    if (cogneta) {
      // Cogneta sees all tenants in a selector.
      const { data } = await supabase
        .from('tenants')
        .select('id, company_code, company_name')
        .eq('is_active', true)
        .order('company_code')
      setTenants(data || [])
      const initial = (data || []).find((t) => t.company_code !== 'Cogneta')?.id || (data || [])[0]?.id || ''
      setSelectedTenantId(initial)
    } else {
      setSelectedTenantId(session.tenant_id)
    }
  }

  async function fetchUsers() {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('tenant_users')
        .select('id, tenant_id, username, full_name, role, allowed_modules, is_active, created_at')
        .eq('tenant_id', selectedTenantId)
        .order('username')
      if (error) throw error
      setUsers((data as TenantUser[]) || [])
    } catch (err) {
      console.error(err)
      toast.error('Failed to load users')
    } finally {
      setLoading(false)
    }
  }

  function openCreate() {
    setEditing(null)
    setForm({
      username: '',
      full_name: '',
      role: 'user',
      password: '',
      allowed_modules: [],
      is_active: true,
    })
    setDialogOpen(true)
  }

  function openEdit(u: TenantUser) {
    setEditing(u)
    setForm({
      username: u.username,
      full_name: u.full_name || '',
      role: u.role,
      password: '',
      allowed_modules: u.allowed_modules || [],
      is_active: u.is_active,
    })
    setDialogOpen(true)
  }

  function toggleModule(key: ModuleKey, checked: boolean) {
    setForm((f) => ({
      ...f,
      allowed_modules: checked
        ? Array.from(new Set([...f.allowed_modules, key]))
        : f.allowed_modules.filter((k) => k !== key),
    }))
  }

  async function handleSave() {
    if (!form.username.trim()) {
      toast.error('Username required')
      return
    }
    if (!editing && !form.password) {
      toast.error('Password required for new user')
      return
    }
    setSaving(true)
    try {
      if (editing) {
        const update: Record<string, unknown> = {
          username: form.username.trim(),
          full_name: form.full_name.trim() || null,
          role: form.role,
          allowed_modules: form.allowed_modules,
          is_active: form.is_active,
        }
        if (form.password) {
          update.password_hash = await hashPassword(form.password)
        }
        const { error } = await supabase.from('tenant_users').update(update).eq('id', editing.id)
        if (error) throw error
        toast.success('User updated')
      } else {
        const password_hash = await hashPassword(form.password)
        const { error } = await supabase.from('tenant_users').insert([
          {
            tenant_id: selectedTenantId,
            username: form.username.trim(),
            full_name: form.full_name.trim() || null,
            role: form.role,
            password_hash,
            allowed_modules: form.allowed_modules,
            is_active: form.is_active,
          },
        ])
        if (error) throw error
        toast.success('User created')
      }
      setDialogOpen(false)
      await fetchUsers()
    } catch (err: any) {
      console.error(err)
      toast.error(err?.message || 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(u: TenantUser) {
    if (!confirm(`Delete user "${u.username}"? They won't be able to sign in any more.`)) return
    try {
      const { error } = await supabase.from('tenant_users').delete().eq('id', u.id)
      if (error) throw error
      toast.success('User deleted')
      await fetchUsers()
    } catch (err) {
      console.error(err)
      toast.error('Delete failed')
    }
  }

  return (
    <div className="flex flex-col min-h-screen">
      <Header title="Manage Users" />
      <div className="flex-1 p-4 md:p-6 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold">Users</h2>
            <p className="text-sm text-slate-500">
              Create users and assign module access for {tenants.find((t) => t.id === selectedTenantId)?.company_name || 'your company'}.
            </p>
          </div>
          <div className="flex items-center gap-3">
            {cogneta && tenants.length > 0 && (
              <Select value={selectedTenantId} onValueChange={setSelectedTenantId}>
                <SelectTrigger className="w-[220px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {tenants.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.company_name} ({t.company_code})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <Button onClick={openCreate} disabled={!selectedTenantId}>
              <Plus className="h-4 w-4 mr-2" />
              New User
            </Button>
          </div>
        </div>

        <Card>
          <CardContent className="p-0">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
              </div>
            ) : users.length === 0 ? (
              <div className="py-12 text-center text-slate-500">
                No users yet. Click <span className="font-medium">New User</span> to add one.
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Username</TableHead>
                    <TableHead>Full Name</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Modules</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-[100px]" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map((u) => (
                    <TableRow key={u.id}>
                      <TableCell className="font-medium">{u.username}</TableCell>
                      <TableCell>{u.full_name || '-'}</TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="capitalize">
                          {u.role}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <span className="text-xs text-slate-600">{u.allowed_modules?.length || 0} modules</span>
                      </TableCell>
                      <TableCell>
                        {u.is_active ? (
                          <Badge className="bg-green-100 text-green-700" variant="secondary">
                            Active
                          </Badge>
                        ) : (
                          <Badge variant="secondary" className="bg-slate-100 text-slate-600">
                            Disabled
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Button variant="ghost" size="icon" onClick={() => openEdit(u)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => handleDelete(u)}>
                            <Trash2 className="h-4 w-4 text-red-600" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit User' : 'New User'}</DialogTitle>
            <DialogDescription>
              {editing
                ? 'Update user details, password, or module access.'
                : 'Create a user and choose which modules they can access.'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="username">Username</Label>
                <Input
                  id="username"
                  value={form.username}
                  onChange={(e) => setForm({ ...form, username: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="full_name">Full Name</Label>
                <Input
                  id="full_name"
                  value={form.full_name}
                  onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="role">Role</Label>
                <Select
                  value={form.role}
                  onValueChange={(v: Role) => setForm({ ...form, role: v })}
                >
                  <SelectTrigger id="role">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="user">User</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                    {cogneta && <SelectItem value="superuser">Superuser</SelectItem>}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="password">{editing ? 'New Password (leave blank to keep)' : 'Password'}</Label>
                <Input
                  id="password"
                  type="password"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  autoComplete="new-password"
                />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Checkbox
                id="is_active"
                checked={form.is_active}
                onCheckedChange={(c) => setForm({ ...form, is_active: !!c })}
              />
              <Label htmlFor="is_active" className="cursor-pointer">
                Active
              </Label>
            </div>

            <div className="space-y-3 rounded-lg border border-slate-200 p-4">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-semibold">Module Access</Label>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setForm({ ...form, allowed_modules: MODULES.map((m) => m.key) })}
                  >
                    Select all
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setForm({ ...form, allowed_modules: [] })}
                  >
                    Clear
                  </Button>
                </div>
              </div>
              <div className="space-y-3">
                {MODULE_GROUPS.map((g) => {
                  const groupMods = g.moduleKeys
                    .map((k) => MODULES.find((m) => m.key === k))
                    .filter((m): m is NonNullable<typeof m> => !!m)
                  if (groupMods.length === 0) return null
                  return (
                    <div key={g.name}>
                      <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                        {g.name}
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {groupMods.map((m) => (
                          <label
                            key={m.key}
                            className="flex items-center gap-2 rounded-md border border-slate-200 px-2.5 py-1.5 hover:bg-slate-50 cursor-pointer"
                          >
                            <Checkbox
                              checked={form.allowed_modules.includes(m.key)}
                              onCheckedChange={(c) => toggleModule(m.key, !!c)}
                            />
                            <span className="text-sm">{m.name}</span>
                            {m.requires === 'superuser' && (
                              <Badge variant="secondary" className="ml-auto text-[10px]">Cogneta</Badge>
                            )}
                            {m.requires === 'admin' && (
                              <Badge variant="secondary" className="ml-auto text-[10px]">Admin</Badge>
                            )}
                          </label>
                        ))}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
