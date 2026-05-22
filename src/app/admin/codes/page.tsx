'use client'

import { useEffect, useState } from 'react'
import { Header } from '@/components/layout/header'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
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
import { Plus, Loader2, Copy, Check } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'
import { getSession } from '@/lib/auth'
import { format } from 'date-fns'

interface Tenant {
  id: string
  company_code: string
  company_name: string
}

interface ActivationCode {
  id: string
  code: string
  tenant_id: string
  tenant_code?: string
  issued_at: string
  issued_by: string | null
  used_at: string | null
  used_by_site_id: string | null
  used_by_site_name?: string | null
  notes: string | null
}

function generateCode(prefix: string) {
  // 8 alphanumeric chars in two 4-char groups, e.g. EFC-A8K2-9PXM
  const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // no 0/1/I/O for readability
  const random = new Uint8Array(8)
  crypto.getRandomValues(random)
  const part = (start: number) =>
    Array.from(random.slice(start, start + 4))
      .map((b) => ALPHABET[b % ALPHABET.length])
      .join('')
  return `${prefix}-${part(0)}-${part(4)}`
}

export default function AdminCodesPage() {
  const [tenants, setTenants] = useState<Tenant[]>([])
  const [codes, setCodes] = useState<ActivationCode[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [form, setForm] = useState({ tenant_id: '', count: 1, notes: '' })
  const [copied, setCopied] = useState<string | null>(null)

  const session = getSession()

  useEffect(() => {
    init()
  }, [])

  async function init() {
    setLoading(true)
    try {
      const [{ data: t }, codes] = await Promise.all([
        supabase
          .from('tenants')
          .select('id, company_code, company_name')
          .eq('is_active', true)
          .order('company_code'),
        fetchCodes(),
      ])
      setTenants(t || [])
      setCodes(codes)
      // Default the form to the first non-Cogneta tenant
      const first = (t || []).find((x) => x.company_code !== 'Cogneta')?.id || (t || [])[0]?.id || ''
      setForm((f) => ({ ...f, tenant_id: first }))
    } catch (err) {
      console.error(err)
      toast.error('Failed to load activation codes')
    } finally {
      setLoading(false)
    }
  }

  async function fetchCodes(): Promise<ActivationCode[]> {
    const { data, error } = await supabase
      .from('site_activation_codes')
      .select(`
        id, code, tenant_id, issued_at, issued_by, used_at, used_by_site_id, notes,
        tenant:tenants(company_code),
        site:sites(name)
      `)
      .order('issued_at', { ascending: false })
    if (error) throw error
    return (data || []).map((row: any) => ({
      id: row.id,
      code: row.code,
      tenant_id: row.tenant_id,
      tenant_code: Array.isArray(row.tenant) ? row.tenant[0]?.company_code : row.tenant?.company_code,
      issued_at: row.issued_at,
      issued_by: row.issued_by,
      used_at: row.used_at,
      used_by_site_id: row.used_by_site_id,
      used_by_site_name: Array.isArray(row.site) ? row.site[0]?.name : row.site?.name,
      notes: row.notes,
    }))
  }

  async function handleGenerate() {
    if (!form.tenant_id) {
      toast.error('Pick a tenant')
      return
    }
    setGenerating(true)
    try {
      const tenant = tenants.find((t) => t.id === form.tenant_id)
      if (!tenant) throw new Error('Tenant not found')
      const rows = Array.from({ length: form.count }, () => ({
        code: generateCode(tenant.company_code.toUpperCase()),
        tenant_id: tenant.id,
        issued_by: session?.username || null,
        notes: form.notes.trim() || null,
      }))
      const { error } = await supabase.from('site_activation_codes').insert(rows)
      if (error) throw error
      toast.success(`Issued ${rows.length} code${rows.length === 1 ? '' : 's'}`)
      setDialogOpen(false)
      setForm((f) => ({ ...f, count: 1, notes: '' }))
      setCodes(await fetchCodes())
    } catch (err: any) {
      console.error(err)
      toast.error(err?.message || 'Failed to generate codes')
    } finally {
      setGenerating(false)
    }
  }

  async function copyCode(code: string) {
    try {
      await navigator.clipboard.writeText(code)
      setCopied(code)
      setTimeout(() => setCopied(null), 1500)
    } catch {
      // ignore
    }
  }

  return (
    <div className="flex flex-col min-h-screen">
      <Header title="Activation Codes" />
      <div className="flex-1 p-4 md:p-6 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold">Site Activation Codes</h2>
            <p className="text-sm text-slate-500">
              Single-use codes issued to paying customers — consumed when they create a site.
            </p>
          </div>
          <Button onClick={() => setDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Issue Codes
          </Button>
        </div>

        <Card>
          <CardContent className="p-0">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
              </div>
            ) : codes.length === 0 ? (
              <div className="py-12 text-center text-slate-500">
                No activation codes issued yet.
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Code</TableHead>
                    <TableHead>Tenant</TableHead>
                    <TableHead>Issued</TableHead>
                    <TableHead>Used</TableHead>
                    <TableHead>Used by Site</TableHead>
                    <TableHead>Notes</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {codes.map((c) => (
                    <TableRow key={c.id}>
                      <TableCell>
                        <button
                          onClick={() => copyCode(c.code)}
                          className="font-mono text-sm hover:text-blue-600 inline-flex items-center gap-1.5"
                          title="Copy"
                        >
                          {c.code}
                          {copied === c.code ? (
                            <Check className="h-3.5 w-3.5 text-emerald-600" />
                          ) : (
                            <Copy className="h-3.5 w-3.5 text-slate-400" />
                          )}
                        </button>
                      </TableCell>
                      <TableCell>{c.tenant_code || '-'}</TableCell>
                      <TableCell className="text-slate-500 text-sm">
                        {format(new Date(c.issued_at), 'MMM d, yyyy')}
                      </TableCell>
                      <TableCell>
                        {c.used_at ? (
                          <Badge className="bg-slate-100 text-slate-700" variant="secondary">
                            {format(new Date(c.used_at), 'MMM d, yyyy')}
                          </Badge>
                        ) : (
                          <Badge className="bg-emerald-100 text-emerald-700" variant="secondary">
                            Available
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-sm">{c.used_by_site_name || '-'}</TableCell>
                      <TableCell className="text-sm text-slate-500">{c.notes || '-'}</TableCell>
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
            <DialogTitle>Issue Activation Codes</DialogTitle>
            <DialogDescription>
              Each code is single-use and unlocks one site for the chosen tenant.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="tenant">Tenant</Label>
              <Select value={form.tenant_id} onValueChange={(v) => setForm({ ...form, tenant_id: v })}>
                <SelectTrigger id="tenant">
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
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="count">How many codes</Label>
              <Input
                id="count"
                type="number"
                min={1}
                max={50}
                value={form.count}
                onChange={(e) => setForm({ ...form, count: Math.max(1, Math.min(50, parseInt(e.target.value) || 1)) })}
              />
              <p className="text-xs text-slate-500">Generate up to 50 codes at a time.</p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="notes">Notes (optional)</Label>
              <Input
                id="notes"
                placeholder="e.g., Invoice INV-2026-018 paid"
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={generating}>
              Cancel
            </Button>
            <Button onClick={handleGenerate} disabled={generating}>
              {generating ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
              Generate
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
