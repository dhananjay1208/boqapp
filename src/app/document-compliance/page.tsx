'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { Header } from '@/components/layout/header'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
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
import {
  ShieldCheck,
  Plus,
  Upload,
  Eye,
  Trash2,
  Loader2,
  FileDown,
  Filter,
  Search,
  CheckCircle2,
  Clock,
  Ban,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'
import {
  DOC_TYPES,
  DOC_TYPE_LABELS,
  enrolMaterials,
  fetchAllMaterialCompliance,
  openMaterialComplianceDoc,
  setMaterialComplianceStatus,
  uploadMaterialComplianceDoc,
  type DocStatus,
  type DocType,
  type MaterialComplianceDoc,
} from '@/lib/material-compliance'
import { exportComplianceMergedPdf } from '@/lib/material-compliance-pdf'

interface Material {
  id: string
  category: string
  name: string
  unit: string
}

const ACCEPT_TYPES = '.pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg'

const STATUS_STYLE: Record<DocStatus, { label: string; classes: string; Icon: typeof CheckCircle2 }> = {
  uploaded: { label: 'Uploaded', classes: 'bg-emerald-100 text-emerald-700', Icon: CheckCircle2 },
  pending: { label: 'Pending', classes: 'bg-slate-100 text-slate-700', Icon: Clock },
  not_applicable: { label: 'N/A', classes: 'bg-amber-100 text-amber-700', Icon: Ban },
}

interface RowState {
  material: Material
  test_certificate?: MaterialComplianceDoc
  tds?: MaterialComplianceDoc
}

export default function DocumentCompliancePage() {
  const [materials, setMaterials] = useState<Material[]>([])
  const [rows, setRows] = useState<RowState[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState<string | null>(null) // `${materialId}:${docType}`
  const [exporting, setExporting] = useState(false)

  // Filters
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | DocStatus>('all')

  // Add-materials dialog
  const [addOpen, setAddOpen] = useState(false)
  const [pickerSearch, setPickerSearch] = useState('')
  const [pickedIds, setPickedIds] = useState<Set<string>>(new Set())
  const [enroling, setEnroling] = useState(false)

  const fileInputRef = useRef<HTMLInputElement>(null)
  const pendingTargetRef = useRef<{ materialId: string; docType: DocType } | null>(null)

  useEffect(() => {
    void load()
  }, [])

  async function load() {
    setLoading(true)
    try {
      const [materialsRes, docs] = await Promise.all([
        supabase
          .from('master_materials')
          .select('id, category, name, unit')
          .eq('is_active', true)
          .order('category')
          .order('name'),
        fetchAllMaterialCompliance(),
      ])
      if (materialsRes.error) throw materialsRes.error
      const matList = (materialsRes.data || []) as Material[]
      setMaterials(matList)

      // Build enrolled rows: any material with at least one compliance row is in the table.
      const docsByMat = new Map<string, { test_certificate?: MaterialComplianceDoc; tds?: MaterialComplianceDoc }>()
      for (const d of docs) {
        const existing = docsByMat.get(d.material_id) ?? {}
        existing[d.doc_type] = d
        docsByMat.set(d.material_id, existing)
      }
      const built: RowState[] = []
      for (const m of matList) {
        const slots = docsByMat.get(m.id)
        if (!slots) continue
        built.push({ material: m, ...slots })
      }
      setRows(built)
    } catch (err) {
      console.error(err)
      toast.error('Failed to load compliance docs')
    } finally {
      setLoading(false)
    }
  }

  const filteredRows = useMemo(() => {
    const term = searchTerm.trim().toLowerCase()
    return rows.filter((r) => {
      if (term) {
        const hay = `${r.material.category} ${r.material.name}`.toLowerCase()
        if (!hay.includes(term)) return false
      }
      if (statusFilter !== 'all') {
        const statuses: DocStatus[] = [r.test_certificate?.status ?? 'pending', r.tds?.status ?? 'pending']
        if (!statuses.includes(statusFilter)) return false
      }
      return true
    })
  }, [rows, searchTerm, statusFilter])

  // Group by category for display (matches the materials master list pattern).
  const rowsByCategory = useMemo(() => {
    const m = new Map<string, RowState[]>()
    for (const r of filteredRows) {
      const arr = m.get(r.material.category) ?? []
      arr.push(r)
      m.set(r.material.category, arr)
    }
    return m
  }, [filteredRows])

  const stats = useMemo(() => {
    let uploaded = 0
    let pending = 0
    let na = 0
    for (const r of rows) {
      for (const dt of DOC_TYPES) {
        const s = r[dt]?.status ?? 'pending'
        if (s === 'uploaded') uploaded++
        else if (s === 'not_applicable') na++
        else pending++
      }
    }
    return { uploaded, pending, na, total: rows.length * 2 }
  }, [rows])

  // Materials available to enroll: not currently in `rows`.
  const enrolledIds = useMemo(() => new Set(rows.map((r) => r.material.id)), [rows])
  const pickable = useMemo(() => {
    const term = pickerSearch.trim().toLowerCase()
    return materials
      .filter((m) => !enrolledIds.has(m.id))
      .filter((m) => !term || `${m.category} ${m.name}`.toLowerCase().includes(term))
  }, [materials, enrolledIds, pickerSearch])

  function openAdd() {
    setPickedIds(new Set())
    setPickerSearch('')
    setAddOpen(true)
  }

  function togglePick(id: string, on: boolean) {
    setPickedIds((prev) => {
      const next = new Set(prev)
      if (on) next.add(id)
      else next.delete(id)
      return next
    })
  }

  async function handleAddConfirm() {
    if (pickedIds.size === 0) return
    setEnroling(true)
    try {
      await enrolMaterials(Array.from(pickedIds))
      toast.success(`Added ${pickedIds.size} material${pickedIds.size === 1 ? '' : 's'} to compliance`)
      setAddOpen(false)
      await load()
    } catch (err: any) {
      console.error(err)
      toast.error(err?.message || 'Failed to add materials')
    } finally {
      setEnroling(false)
    }
  }

  function triggerUpload(materialId: string, docType: DocType) {
    pendingTargetRef.current = { materialId, docType }
    fileInputRef.current?.click()
  }

  async function onFileChosen(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    const target = pendingTargetRef.current
    if (!target) return
    const key = `${target.materialId}:${target.docType}`
    setUploading(key)
    try {
      await uploadMaterialComplianceDoc(target.materialId, target.docType, file)
      toast.success(`${DOC_TYPE_LABELS[target.docType]} uploaded`)
      await load()
    } catch (err: any) {
      console.error(err)
      toast.error(err?.message || 'Upload failed')
    } finally {
      setUploading(null)
      pendingTargetRef.current = null
    }
  }

  async function handleMarkNA(materialId: string, docType: DocType) {
    try {
      await setMaterialComplianceStatus(materialId, docType, 'not_applicable')
      toast.success(`${DOC_TYPE_LABELS[docType]} marked N/A`)
      await load()
    } catch (err: any) {
      toast.error(err?.message || 'Failed')
    }
  }

  async function handleRevertToPending(materialId: string, docType: DocType) {
    try {
      await setMaterialComplianceStatus(materialId, docType, 'pending')
      await load()
    } catch (err: any) {
      toast.error(err?.message || 'Failed')
    }
  }

  async function handleExport() {
    setExporting(true)
    try {
      const uploadedRows = rows.flatMap((r) => {
        const items: { material: Material; docType: DocType; doc: MaterialComplianceDoc }[] = []
        for (const dt of DOC_TYPES) {
          const slot = r[dt]
          if (slot && slot.status === 'uploaded' && slot.file_path) {
            items.push({ material: r.material, docType: dt, doc: slot })
          }
        }
        return items
      })
      if (uploadedRows.length === 0) {
        toast.error('No uploaded documents to export')
        return
      }
      await exportComplianceMergedPdf(uploadedRows, stats)
    } catch (err: any) {
      console.error(err)
      toast.error(err?.message || 'PDF export failed')
    } finally {
      setExporting(false)
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col min-h-screen">
        <Header title="Documents Compliance" />
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col min-h-screen">
      <Header title="Documents Compliance" />
      <input
        ref={fileInputRef}
        type="file"
        accept={ACCEPT_TYPES}
        className="hidden"
        onChange={onFileChosen}
      />

      <div className="flex-1 p-4 md:p-6 space-y-6">
        {/* Header card with summary + buttons */}
        <Card>
          <CardHeader>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <ShieldCheck className="h-5 w-5" />
                  Documents Compliance
                </CardTitle>
                <CardDescription>
                  Manage Test Certificate and TDS documents per material. Uploads here are linked from
                  Material GRN automatically.
                </CardDescription>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button variant="outline" onClick={handleExport} disabled={exporting || rows.length === 0}>
                  {exporting ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <FileDown className="h-4 w-4 mr-2" />
                  )}
                  Export all as PDF
                </Button>
                <Button onClick={openAdd}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add materials
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <SummaryTile label="Materials" value={rows.length} />
              <SummaryTile label="Uploaded" value={stats.uploaded} tone="emerald" />
              <SummaryTile label="Pending" value={stats.pending} tone="slate" />
              <SummaryTile label="N/A" value={stats.na} tone="amber" />
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                  placeholder="Search material name or category"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
              <div className="sm:w-56">
                <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as typeof statusFilter)}>
                  <SelectTrigger>
                    <Filter className="h-4 w-4 mr-2" />
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All statuses</SelectItem>
                    <SelectItem value="uploaded">Has uploaded</SelectItem>
                    <SelectItem value="pending">Has pending</SelectItem>
                    <SelectItem value="not_applicable">Has N/A</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Compliance table */}
        {rows.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <ShieldCheck className="h-12 w-12 mx-auto text-slate-300 mb-4" />
              <h3 className="text-lg font-medium text-slate-900 mb-2">
                No materials under compliance yet
              </h3>
              <p className="text-slate-500 mb-4">
                Add materials to start tracking Test Certificate and TDS documents.
              </p>
              <Button onClick={openAdd}>
                <Plus className="h-4 w-4 mr-2" />
                Add materials
              </Button>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[200px]">Category</TableHead>
                    <TableHead>Material</TableHead>
                    <TableHead className="w-[320px]">Test Certificate</TableHead>
                    <TableHead className="w-[320px]">TDS</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {Array.from(rowsByCategory.entries()).map(([category, catRows]) =>
                    catRows.map((row, idx) => (
                      <TableRow key={row.material.id}>
                        <TableCell>
                          {idx === 0 && (
                            <Badge variant="outline" className="font-medium">
                              {category}
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="font-medium">{row.material.name}</TableCell>
                        <SlotCell
                          row={row}
                          docType="test_certificate"
                          uploading={uploading}
                          onUpload={triggerUpload}
                          onMarkNA={handleMarkNA}
                          onRevert={handleRevertToPending}
                        />
                        <SlotCell
                          row={row}
                          docType="tds"
                          uploading={uploading}
                          onUpload={triggerUpload}
                          onMarkNA={handleMarkNA}
                          onRevert={handleRevertToPending}
                        />
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Add Materials Dialog */}
      <Dialog open={addOpen} onOpenChange={(o) => !enroling && setAddOpen(o)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Add materials to compliance</DialogTitle>
            <DialogDescription>
              Pick the materials you want to track. Each gets one Test Certificate slot and one TDS slot,
              both starting at Pending.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Search materials"
                value={pickerSearch}
                onChange={(e) => setPickerSearch(e.target.value)}
                className="pl-10"
              />
            </div>
            <div className="max-h-[50vh] overflow-y-auto rounded-md border divide-y">
              {pickable.length === 0 ? (
                <div className="py-10 text-center text-sm text-slate-500">
                  {materials.length === enrolledIds.size
                    ? 'All materials are already enrolled.'
                    : 'No materials match your search.'}
                </div>
              ) : (
                pickable.map((m) => {
                  const checked = pickedIds.has(m.id)
                  return (
                    <label
                      key={m.id}
                      className="flex items-center gap-3 px-3 py-2 hover:bg-slate-50 cursor-pointer"
                    >
                      <Checkbox checked={checked} onCheckedChange={(c) => togglePick(m.id, !!c)} />
                      <span className="text-xs text-slate-500 w-[150px] truncate">{m.category}</span>
                      <span className="text-sm flex-1">{m.name}</span>
                      <span className="text-xs text-slate-500">{m.unit}</span>
                    </label>
                  )
                })
              )}
            </div>
          </div>
          <DialogFooter className="flex-row items-center justify-between sm:justify-between">
            <span className="text-xs text-slate-500">
              {pickedIds.size} selected
            </span>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setAddOpen(false)} disabled={enroling}>
                Cancel
              </Button>
              <Button onClick={handleAddConfirm} disabled={enroling || pickedIds.size === 0}>
                {enroling ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                Add {pickedIds.size > 0 ? `(${pickedIds.size})` : ''}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function SummaryTile({
  label,
  value,
  tone = 'blue',
}: {
  label: string
  value: number
  tone?: 'emerald' | 'slate' | 'amber' | 'blue'
}) {
  const toneClasses: Record<string, string> = {
    emerald: 'bg-emerald-50 text-emerald-700 border-emerald-100',
    slate: 'bg-slate-50 text-slate-700 border-slate-200',
    amber: 'bg-amber-50 text-amber-700 border-amber-100',
    blue: 'bg-blue-50 text-blue-700 border-blue-100',
  }
  return (
    <div className={`rounded-md border p-3 ${toneClasses[tone]}`}>
      <div className="text-xs font-medium">{label}</div>
      <div className="text-2xl font-bold">{value}</div>
    </div>
  )
}

function SlotCell({
  row,
  docType,
  uploading,
  onUpload,
  onMarkNA,
  onRevert,
}: {
  row: RowState
  docType: DocType
  uploading: string | null
  onUpload: (materialId: string, docType: DocType) => void
  onMarkNA: (materialId: string, docType: DocType) => void
  onRevert: (materialId: string, docType: DocType) => void
}) {
  const slot = row[docType]
  const status: DocStatus = slot?.status ?? 'pending'
  const meta = STATUS_STYLE[status]
  const Icon = meta.Icon
  const busy = uploading === `${row.material.id}:${docType}`

  return (
    <TableCell>
      <div className="flex items-center gap-3 flex-wrap">
        <Badge className={`${meta.classes} gap-1`} variant="secondary">
          <Icon className="h-3 w-3" />
          {meta.label}
        </Badge>
        {status === 'uploaded' && slot?.file_path && (
          <>
            <span className="text-xs text-slate-600 max-w-[140px] truncate" title={slot.file_name ?? ''}>
              {slot.file_name}
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => slot.file_path && openMaterialComplianceDoc(slot.file_path)}
              className="h-7 px-2"
            >
              <Eye className="h-3.5 w-3.5 mr-1" />
              View
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onUpload(row.material.id, docType)}
              className="h-7 px-2"
              disabled={busy}
            >
              {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5 mr-1" />}
              Replace
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onRevert(row.material.id, docType)}
              className="h-7 px-2 text-red-600 hover:bg-red-50 hover:text-red-700"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </>
        )}
        {status === 'pending' && (
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onUpload(row.material.id, docType)}
              className="h-7 px-2"
              disabled={busy}
            >
              {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5 mr-1" />}
              Upload
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onMarkNA(row.material.id, docType)}
              className="h-7 px-2 text-slate-600"
            >
              Mark N/A
            </Button>
          </>
        )}
        {status === 'not_applicable' && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onRevert(row.material.id, docType)}
            className="h-7 px-2 text-slate-600"
          >
            Mark pending
          </Button>
        )}
      </div>
    </TableCell>
  )
}
