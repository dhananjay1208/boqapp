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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Plus, Loader2, Pencil } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'
import { hashPassword } from '@/lib/auth'
import { format } from 'date-fns'

interface Tenant {
  id: string
  company_code: string
  company_name: string
  is_active: boolean
  created_at: string
}

export default function AdminTenantsPage() {
  const [tenants, setTenants] = useState<Tenant[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [editing, setEditing] = useState<Tenant | null>(null)
  const [form, setForm] = useState({
    company_code: '',
    company_name: '',
    is_active: true,
    seed_admin: true,
    admin_password: '',
  })

  useEffect(() => {
    fetchTenants()
  }, [])

  async function fetchTenants() {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('tenants')
        .select('*')
        .order('created_at', { ascending: false })
      if (error) throw error
      setTenants((data as Tenant[]) || [])
    } catch (err) {
      console.error(err)
      toast.error('Failed to load tenants')
    } finally {
      setLoading(false)
    }
  }

  function openCreate() {
    setEditing(null)
    setForm({ company_code: '', company_name: '', is_active: true, seed_admin: true, admin_password: '' })
    setDialogOpen(true)
  }

  function openEdit(t: Tenant) {
    setEditing(t)
    setForm({
      company_code: t.company_code,
      company_name: t.company_name,
      is_active: t.is_active,
      seed_admin: false,
      admin_password: '',
    })
    setDialogOpen(true)
  }

  async function handleSave() {
    if (!form.company_code.trim()) {
      toast.error('Company code required')
      return
    }
    if (!form.company_name.trim()) {
      toast.error('Company name required')
      return
    }
    if (!editing && form.seed_admin && !form.admin_password) {
      toast.error('Admin password required for the seed admin')
      return
    }

    setSaving(true)
    try {
      if (editing) {
        const { error } = await supabase
          .from('tenants')
          .update({
            company_code: form.company_code.trim(),
            company_name: form.company_name.trim(),
            is_active: form.is_active,
          })
          .eq('id', editing.id)
        if (error) throw error
        toast.success('Tenant updated')
      } else {
        const { data: newTenant, error } = await supabase
          .from('tenants')
          .insert([
            {
              company_code: form.company_code.trim(),
              company_name: form.company_name.trim(),
              is_active: form.is_active,
            },
          ])
          .select()
          .single()
        if (error) throw error

        if (form.seed_admin && newTenant) {
          const password_hash = await hashPassword(form.admin_password)
          const { error: userErr } = await supabase.from('tenant_users').insert([
            {
              tenant_id: newTenant.id,
              username: 'admin',
              password_hash,
              full_name: `${form.company_name.trim()} Admin`,
              role: 'admin',
              allowed_modules: ['dashboard', 'sites', 'admin-users'],
            },
          ])
          if (userErr) throw userErr
        }
        toast.success(`Tenant "${form.company_code}" created`)
      }
      setDialogOpen(false)
      await fetchTenants()
    } catch (err: any) {
      console.error(err)
      toast.error(err?.message || 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex flex-col min-h-screen">
      <Header title="Tenants" />
      <div className="flex-1 p-4 md:p-6 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold">Customer Tenants</h2>
            <p className="text-sm text-slate-500">
              Add new customer companies and seed their first admin user.
            </p>
          </div>
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4 mr-2" />
            New Tenant
          </Button>
        </div>

        <Card>
          <CardContent className="p-0">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
              </div>
            ) : tenants.length === 0 ? (
              <div className="py-12 text-center text-slate-500">No tenants yet.</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Code</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead className="w-[60px]" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tenants.map((t) => (
                    <TableRow key={t.id}>
                      <TableCell className="font-medium">{t.company_code}</TableCell>
                      <TableCell>{t.company_name}</TableCell>
                      <TableCell>
                        {t.is_active ? (
                          <Badge className="bg-green-100 text-green-700" variant="secondary">
                            Active
                          </Badge>
                        ) : (
                          <Badge variant="secondary" className="bg-slate-100 text-slate-600">
                            Disabled
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-slate-500">
                        {format(new Date(t.created_at), 'MMM d, yyyy')}
                      </TableCell>
                      <TableCell>
                        <Button variant="ghost" size="icon" onClick={() => openEdit(t)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
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
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit Tenant' : 'New Tenant'}</DialogTitle>
            <DialogDescription>
              {editing
                ? 'Update the tenant company details.'
                : 'Create a new customer company. Optionally seed its first admin user.'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="code">Company Code</Label>
                <Input
                  id="code"
                  placeholder="e.g. EFC"
                  value={form.company_code}
                  onChange={(e) => setForm({ ...form, company_code: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="name">Company Name</Label>
                <Input
                  id="name"
                  placeholder="e.g. EFC Constructions Ltd."
                  value={form.company_name}
                  onChange={(e) => setForm({ ...form, company_name: e.target.value })}
                />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Checkbox
                id="active"
                checked={form.is_active}
                onCheckedChange={(c) => setForm({ ...form, is_active: !!c })}
              />
              <Label htmlFor="active" className="cursor-pointer">
                Active
              </Label>
            </div>

            {!editing && (
              <div className="space-y-3 rounded-lg border border-slate-200 p-4">
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="seed_admin"
                    checked={form.seed_admin}
                    onCheckedChange={(c) => setForm({ ...form, seed_admin: !!c })}
                  />
                  <Label htmlFor="seed_admin" className="cursor-pointer">
                    Create initial <span className="font-mono">admin</span> user
                  </Label>
                </div>
                {form.seed_admin && (
                  <div className="space-y-1.5">
                    <Label htmlFor="admin_password">Admin Password</Label>
                    <Input
                      id="admin_password"
                      type="password"
                      value={form.admin_password}
                      onChange={(e) => setForm({ ...form, admin_password: e.target.value })}
                      autoComplete="new-password"
                    />
                    <p className="text-xs text-slate-500">
                      They'll sign in with company code <span className="font-mono">{form.company_code || '...'}</span> and this password.
                    </p>
                  </div>
                )}
              </div>
            )}
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
