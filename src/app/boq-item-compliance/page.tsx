'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { Header } from '@/components/layout/header'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Building2,
  Package as PackageIcon,
  FileSpreadsheet,
  ListChecks,
  Sparkles,
  Plus,
  Trash2,
  ChevronsUpDown,
  FileUp,
  Eye,
  Share2,
  ShieldCheck,
  IndianRupee,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'
import {
  fetchSites,
  fetchPackagesForSite,
  fetchHeadlinesForPackages,
  fetchLineItemsForHeadlines,
  fetchBoqcMaterials,
  addBoqcMaterial,
  updateBoqcMaterial,
  deleteBoqcMaterial,
  setBoqcMaterialApproved,
  markSharedWithVendor,
  fetchBoqcDocsMap,
  uploadBoqcDoc,
  setBoqcDocStatus,
  openBoqcDoc,
  fetchGrnTestCertMap,
  effectiveTestCertStatus,
  fetchRaEntries,
  addRaEntry,
  deleteRaEntry,
  uploadMbSheet,
  buildCandidates,
  type Site,
  type PackageData,
  type BOQHeadline,
  type BOQLineItem,
  type BoqcMaterial,
  type BoqcDocsByType,
  type BoqcDocType,
  type BoqcRaEntry,
  type GrnTestCert,
  type MasterMaterialLite,
  type Recommendation,
} from '@/lib/boq-item-workflow'
import { docStatusYN, type EffectiveDocStatus } from '@/lib/material-compliance'

const CONFIDENCE_STYLE: Record<string, string> = {
  high: 'bg-green-100 text-green-700',
  medium: 'bg-amber-100 text-amber-700',
  low: 'bg-slate-100 text-slate-600',
}

const STATUS_STYLE: Record<EffectiveDocStatus, string> = {
  uploaded: 'bg-green-100 text-green-700',
  na: 'bg-amber-100 text-amber-700',
  pending: 'bg-slate-100 text-slate-600',
}

const STATUS_LABEL: Record<EffectiveDocStatus, string> = {
  uploaded: 'Uploaded',
  na: 'N/A',
  pending: 'Pending',
}

const DOC_ACCEPT = '.pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg'

interface AiReviewRow extends Recommendation {
  selected: boolean
}

export default function BOQItemCompliancePage() {
  // Cascade
  const [sites, setSites] = useState<Site[]>([])
  const [packages, setPackages] = useState<PackageData[]>([])
  const [headlines, setHeadlines] = useState<BOQHeadline[]>([])
  const [lineItems, setLineItems] = useState<BOQLineItem[]>([])
  const [selectedSite, setSelectedSite] = useState('')
  const [selectedPackage, setSelectedPackage] = useState('')
  const [selectedHeadline, setSelectedHeadline] = useState('')
  const [selectedLineItem, setSelectedLineItem] = useState('')

  // Workflow data for the selected line item
  const [materials, setMaterials] = useState<BoqcMaterial[]>([])
  const [docsMap, setDocsMap] = useState<Map<string, BoqcDocsByType>>(new Map())
  const [grnCertMap, setGrnCertMap] = useState<Map<string, GrnTestCert>>(new Map())
  const [raEntries, setRaEntries] = useState<BoqcRaEntry[]>([])
  const [masterMaterials, setMasterMaterials] = useState<MasterMaterialLite[]>([])
  const [loadingData, setLoadingData] = useState(false)

  // Manual-add combobox
  const [materialPickerOpen, setMaterialPickerOpen] = useState(false)
  const [materialSearch, setMaterialSearch] = useState('')
  const [customName, setCustomName] = useState('')
  const [customUnit, setCustomUnit] = useState('')

  // AI dialog
  const [aiOpen, setAiOpen] = useState(false)
  const [aiLoading, setAiLoading] = useState(false)
  const [aiRows, setAiRows] = useState<AiReviewRow[]>([])
  const [aiSource, setAiSource] = useState<'ai' | 'heuristic' | null>(null)

  // Share-with-vendor dialog
  const [shareOpen, setShareOpen] = useState(false)

  // RA dialog
  const [raOpen, setRaOpen] = useState(false)
  const [raNewQty, setRaNewQty] = useState('')
  const [raDate, setRaDate] = useState('')
  const [raRemarks, setRaRemarks] = useState('')
  const [raFile, setRaFile] = useState<File | null>(null)
  const [raSaving, setRaSaving] = useState(false)

  // File-upload plumbing (docs + MB sheets reuse one hidden input each)
  const docInputRef = useRef<HTMLInputElement>(null)
  const docTargetRef = useRef<{ boqcMaterialId: string; docType: BoqcDocType } | null>(null)
  const mbInputRef = useRef<HTMLInputElement>(null)
  const mbTargetRef = useRef<BoqcRaEntry | null>(null)

  const selectedLineItemData = lineItems.find((li) => li.id === selectedLineItem) || null

  // ---- Cascade effects ----
  useEffect(() => {
    fetchSites().then(setSites).catch(() => toast.error('Failed to load sites'))
    // Master materials (active) used for candidates + manual add.
    supabase
      .from('master_materials')
      .select('id, name, category, unit')
      .eq('is_active', true)
      .order('name')
      .then(({ data }) => setMasterMaterials((data || []) as MasterMaterialLite[]))
  }, [])

  useEffect(() => {
    setSelectedPackage('')
    setSelectedHeadline('')
    setSelectedLineItem('')
    setHeadlines([])
    setLineItems([])
    if (!selectedSite) {
      setPackages([])
      return
    }
    fetchPackagesForSite(selectedSite).then(setPackages).catch(() => toast.error('Failed to load packages'))
  }, [selectedSite])

  useEffect(() => {
    setSelectedHeadline('')
    setSelectedLineItem('')
    setLineItems([])
    if (!selectedPackage) {
      setHeadlines([])
      return
    }
    fetchHeadlinesForPackages([selectedPackage]).then(setHeadlines).catch(() => toast.error('Failed to load headlines'))
  }, [selectedPackage])

  useEffect(() => {
    setSelectedLineItem('')
    if (!selectedHeadline) {
      setLineItems([])
      return
    }
    fetchLineItemsForHeadlines([selectedHeadline]).then(setLineItems).catch(() => toast.error('Failed to load line items'))
  }, [selectedHeadline])

  const refreshWorkflow = useCallback(async (lineItemId: string) => {
    setLoadingData(true)
    try {
      const [mats, ra, grn] = await Promise.all([
        fetchBoqcMaterials(lineItemId),
        fetchRaEntries(lineItemId),
        fetchGrnTestCertMap(lineItemId),
      ])
      setMaterials(mats)
      setRaEntries(ra)
      setGrnCertMap(grn)
      setDocsMap(await fetchBoqcDocsMap(mats.map((m) => m.id)))
    } catch {
      toast.error('Failed to load workflow data')
    } finally {
      setLoadingData(false)
    }
  }, [])

  useEffect(() => {
    if (!selectedLineItem) {
      setMaterials([])
      setDocsMap(new Map())
      setGrnCertMap(new Map())
      setRaEntries([])
      return
    }
    refreshWorkflow(selectedLineItem)
  }, [selectedLineItem, refreshWorkflow])

  async function refreshMaterialsAndDocs() {
    if (!selectedLineItem) return
    const mats = await fetchBoqcMaterials(selectedLineItem)
    setMaterials(mats)
    setDocsMap(await fetchBoqcDocsMap(mats.map((m) => m.id)))
  }

  // ---- Stage 1: materials ----
  async function handleAiRecommend() {
    if (!selectedLineItemData) return
    setAiOpen(true)
    setAiLoading(true)
    setAiRows([])
    setAiSource(null)
    try {
      const candidates = buildCandidates(selectedLineItemData.description, masterMaterials)
      const res = await fetch('/api/boq-materials/recommend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          description: selectedLineItemData.description,
          unit: selectedLineItemData.unit,
          quantity: selectedLineItemData.quantity,
          candidates,
        }),
      })
      if (!res.ok) throw new Error('request failed')
      const data = (await res.json()) as { source: 'ai' | 'heuristic'; recommendations: Recommendation[] }
      setAiSource(data.source)
      setAiRows(data.recommendations.map((r) => ({ ...r, selected: true })))
      if (data.recommendations.length === 0) toast.message('No materials suggested for this description')
    } catch {
      toast.error('Could not get recommendations')
      setAiOpen(false)
    } finally {
      setAiLoading(false)
    }
  }

  async function addSelectedAiRows() {
    if (!selectedLineItem) return
    const chosen = aiRows.filter((r) => r.selected)
    if (chosen.length === 0) {
      setAiOpen(false)
      return
    }
    try {
      for (const r of chosen) {
        await addBoqcMaterial({
          boq_line_item_id: selectedLineItem,
          material_id: r.material_id,
          material_name: r.material_name,
          unit: r.unit,
          estimated_quantity: r.estimated_quantity,
          source: 'ai',
        })
      }
      toast.success(`Added ${chosen.length} material${chosen.length > 1 ? 's' : ''}`)
      setAiOpen(false)
      await refreshMaterialsAndDocs()
    } catch (e: unknown) {
      toast.error(e instanceof Error && e.message.includes('duplicate') ? 'Some materials are already added' : 'Failed to add materials')
    }
  }

  async function addMasterMaterial(m: MasterMaterialLite) {
    if (!selectedLineItem) return
    setMaterialPickerOpen(false)
    setMaterialSearch('')
    try {
      await addBoqcMaterial({
        boq_line_item_id: selectedLineItem,
        material_id: m.id,
        material_name: m.name,
        unit: m.unit,
        estimated_quantity: null,
        source: 'manual',
      })
      await refreshMaterialsAndDocs()
    } catch {
      toast.error('Already added or failed to add')
    }
  }

  async function addCustomMaterial() {
    if (!selectedLineItem || !customName.trim()) return
    try {
      await addBoqcMaterial({
        boq_line_item_id: selectedLineItem,
        material_id: null,
        material_name: customName.trim(),
        unit: customUnit.trim() || null,
        estimated_quantity: null,
        source: 'manual',
      })
      setCustomName('')
      setCustomUnit('')
      await refreshMaterialsAndDocs()
    } catch {
      toast.error('Failed to add material')
    }
  }

  async function toggleApproved(m: BoqcMaterial) {
    try {
      await setBoqcMaterialApproved(m.id, !m.is_approved)
      await refreshMaterialsAndDocs()
    } catch {
      toast.error('Failed to update')
    }
  }

  async function saveEstimatedQty(m: BoqcMaterial, value: string) {
    const qty = value.trim() === '' ? null : Number(value)
    if (qty !== null && !isFinite(qty)) return
    try {
      await updateBoqcMaterial(m.id, { estimated_quantity: qty })
      setMaterials((prev) => prev.map((x) => (x.id === m.id ? { ...x, estimated_quantity: qty } : x)))
    } catch {
      toast.error('Failed to save quantity')
    }
  }

  async function removeMaterial(m: BoqcMaterial) {
    try {
      await deleteBoqcMaterial(m.id)
      await refreshMaterialsAndDocs()
    } catch {
      toast.error('Failed to delete')
    }
  }

  async function handleShareWithVendor() {
    if (!selectedLineItem) return
    try {
      await markSharedWithVendor(selectedLineItem)
      await refreshMaterialsAndDocs()
      setShareOpen(true)
    } catch {
      toast.error('Failed to mark shared')
    }
  }

  // ---- Stage 2/3: documents ----
  function triggerDocUpload(boqcMaterialId: string, docType: BoqcDocType) {
    docTargetRef.current = { boqcMaterialId, docType }
    docInputRef.current?.click()
  }

  async function onDocFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    const target = docTargetRef.current
    docTargetRef.current = null
    if (!file || !target) return
    try {
      await uploadBoqcDoc(target.boqcMaterialId, target.docType, file)
      toast.success('Document uploaded')
      await refreshMaterialsAndDocs()
    } catch {
      toast.error('Upload failed')
    }
  }

  async function changeDocStatus(boqcMaterialId: string, docType: BoqcDocType, status: 'pending' | 'not_applicable') {
    try {
      await setBoqcDocStatus(boqcMaterialId, docType, status)
      await refreshMaterialsAndDocs()
    } catch {
      toast.error('Failed to update status')
    }
  }

  // ---- Stage 5: RA billing ----
  function openRaDialog() {
    setRaNewQty('')
    setRaDate('')
    setRaRemarks('')
    setRaFile(null)
    setRaOpen(true)
  }

  async function saveRa() {
    if (!selectedLineItem) return
    const qty = Number(raNewQty)
    if (!isFinite(qty) || qty < 0) {
      toast.error('Enter a valid new quantity')
      return
    }
    setRaSaving(true)
    try {
      const nextRa = (raEntries.reduce((mx, e) => Math.max(mx, e.ra_number), 0) || 0) + 1
      const entry = await addRaEntry({
        boq_line_item_id: selectedLineItem,
        ra_number: nextRa,
        new_quantity: qty,
        remarks: raRemarks.trim() || null,
        entry_date: raDate || null,
      })
      if (raFile) {
        await uploadMbSheet(entry.id, selectedLineItem, nextRa, raFile)
      }
      toast.success(`RA ${nextRa} added`)
      setRaOpen(false)
      setRaEntries(await fetchRaEntries(selectedLineItem))
    } catch {
      toast.error('Failed to add RA')
    } finally {
      setRaSaving(false)
    }
  }

  async function removeRa(entry: BoqcRaEntry) {
    if (!selectedLineItem) return
    try {
      await deleteRaEntry(entry.id, selectedLineItem)
      setRaEntries(await fetchRaEntries(selectedLineItem))
    } catch {
      toast.error('Failed to delete RA')
    }
  }

  function triggerMbUpload(entry: BoqcRaEntry) {
    mbTargetRef.current = entry
    mbInputRef.current?.click()
  }

  async function onMbFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    const entry = mbTargetRef.current
    mbTargetRef.current = null
    if (!file || !entry || !selectedLineItem) return
    try {
      await uploadMbSheet(entry.id, selectedLineItem, entry.ra_number, file)
      toast.success('MB sheet uploaded')
      setRaEntries(await fetchRaEntries(selectedLineItem))
    } catch {
      toast.error('Upload failed')
    }
  }

  // ---- Derived ----
  const approvedMaterials = materials.filter((m) => m.is_approved)
  const latestRa = raEntries.length ? raEntries.reduce((a, b) => (b.ra_number > a.ra_number ? b : a)) : null
  const boqQty = selectedLineItemData?.quantity ?? 0
  const uptoDate = latestRa?.upto_date_quantity ?? 0
  const remaining = boqQty - uptoDate
  const billedPct = boqQty > 0 ? Math.min(999, (uptoDate / boqQty) * 100) : 0

  const filteredMaterials = masterMaterials.filter((m) =>
    m.name.toLowerCase().includes(materialSearch.toLowerCase()) ||
    m.category.toLowerCase().includes(materialSearch.toLowerCase())
  )

  function testCertStatusFor(m: BoqcMaterial): { status: EffectiveDocStatus; grnCert?: GrnTestCert } {
    const doc = docsMap.get(m.id)?.test_certificate
    const grnCert = m.material_id ? grnCertMap.get(m.material_id) : undefined
    return { status: effectiveTestCertStatus(doc, grnCert), grnCert }
  }

  return (
    <div className="flex flex-col min-h-screen">
      <Header title="BOQ Item Compliance" />
      <input ref={docInputRef} type="file" accept={DOC_ACCEPT} className="hidden" onChange={onDocFileChange} />
      <input ref={mbInputRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={onMbFileChange} />

      <div className="flex-1 p-4 md:p-6 space-y-6">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-6 w-6 text-cyan-600" />
          <div>
            <h2 className="text-lg font-semibold">Per-Line-Item Workflow</h2>
            <p className="text-sm text-slate-500">Identify materials, track TDS &amp; test certificates, and manage MB sheets / RA billing for a BOQ line item.</p>
          </div>
        </div>

        {/* Cascade */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Select BOQ Line Item</CardTitle>
            <CardDescription>Choose site, package, headline and line item to begin</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="space-y-1.5">
                <label className="text-sm font-medium flex items-center gap-1.5"><Building2 className="h-4 w-4 text-slate-400" />Site</label>
                <Select value={selectedSite} onValueChange={setSelectedSite}>
                  <SelectTrigger><SelectValue placeholder="Select site" /></SelectTrigger>
                  <SelectContent>
                    {sites.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium flex items-center gap-1.5"><PackageIcon className="h-4 w-4 text-slate-400" />Package</label>
                <Select value={selectedPackage} onValueChange={setSelectedPackage} disabled={!selectedSite}>
                  <SelectTrigger><SelectValue placeholder={selectedSite ? 'Select package' : 'Select site first'} /></SelectTrigger>
                  <SelectContent>
                    {packages.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium flex items-center gap-1.5"><FileSpreadsheet className="h-4 w-4 text-slate-400" />Headline</label>
                <Select value={selectedHeadline} onValueChange={setSelectedHeadline} disabled={!selectedPackage}>
                  <SelectTrigger><SelectValue placeholder={selectedPackage ? 'Select headline' : 'Select package first'} /></SelectTrigger>
                  <SelectContent>
                    {headlines.map((h) => <SelectItem key={h.id} value={h.id}>{h.serial_number}. {h.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium flex items-center gap-1.5"><ListChecks className="h-4 w-4 text-slate-400" />Line Item</label>
                <Select value={selectedLineItem} onValueChange={setSelectedLineItem} disabled={!selectedHeadline}>
                  <SelectTrigger><SelectValue placeholder={selectedHeadline ? 'Select line item' : 'Select headline first'} /></SelectTrigger>
                  <SelectContent>
                    {lineItems.map((li) => (
                      <SelectItem key={li.id} value={li.id}>{li.item_number} — {li.description.slice(0, 60)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {!selectedLineItemData ? (
          <Card>
            <CardContent className="py-12 text-center">
              <ListChecks className="h-12 w-12 mx-auto text-slate-300 mb-4" />
              <h3 className="text-lg font-medium text-slate-900 mb-1">Select a Line Item</h3>
              <p className="text-slate-500">Pick a BOQ line item to manage its materials, compliance and billing.</p>
            </CardContent>
          </Card>
        ) : (
          <>
            {/* Context header */}
            <Card>
              <CardContent className="py-4">
                <div className="flex flex-wrap items-center gap-x-8 gap-y-2">
                  <div>
                    <span className="font-mono font-medium text-cyan-700">{selectedLineItemData.item_number}</span>
                    <span className="ml-2 text-sm text-slate-700">{selectedLineItemData.description}</span>
                  </div>
                  <div className="text-sm text-slate-500">
                    BOQ Qty: <span className="font-medium text-slate-800">{boqQty.toLocaleString('en-IN', { maximumFractionDigits: 3 })} {selectedLineItemData.unit}</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Tabs defaultValue="materials">
              <TabsList>
                <TabsTrigger value="materials">Materials</TabsTrigger>
                <TabsTrigger value="documents">TDS &amp; Test Certs</TabsTrigger>
                <TabsTrigger value="ra">MB Sheet &amp; RA Billing</TabsTrigger>
              </TabsList>

              {/* ---- Materials ---- */}
              <TabsContent value="materials" className="space-y-4">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0">
                    <div>
                      <CardTitle className="text-base">Required Materials</CardTitle>
                      <CardDescription>AI-recommended or manually added; approve before sharing with the vendor.</CardDescription>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button variant="outline" size="sm" onClick={handleAiRecommend}>
                        <Sparkles className="h-4 w-4 mr-1.5" /> AI Recommend
                      </Button>
                      <Button variant="outline" size="sm" onClick={handleShareWithVendor} disabled={approvedMaterials.length === 0}>
                        <Share2 className="h-4 w-4 mr-1.5" /> Share with Vendor
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* Add row */}
                    <div className="flex flex-col md:flex-row gap-2 md:items-end">
                      <div className="space-y-1">
                        <Label className="text-xs">Add from master list</Label>
                        <Popover open={materialPickerOpen} onOpenChange={setMaterialPickerOpen}>
                          <PopoverTrigger asChild>
                            <Button variant="outline" role="combobox" className="w-full md:w-[280px] justify-between">
                              Select material…
                              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-[calc(100vw-3rem)] sm:w-[320px] p-0">
                            <Command shouldFilter={false}>
                              <CommandInput placeholder="Search materials…" value={materialSearch} onValueChange={setMaterialSearch} />
                              <CommandList>
                                <CommandEmpty>No material found.</CommandEmpty>
                                <CommandGroup className="max-h-[220px] overflow-y-auto">
                                  {filteredMaterials.slice(0, 50).map((m) => (
                                    <CommandItem key={m.id} value={m.id} onSelect={() => addMasterMaterial(m)}>
                                      <div className="flex-1">
                                        <p className="text-sm">{m.name}</p>
                                        <p className="text-xs text-slate-500">{m.category} | {m.unit}</p>
                                      </div>
                                    </CommandItem>
                                  ))}
                                </CommandGroup>
                              </CommandList>
                            </Command>
                          </PopoverContent>
                        </Popover>
                      </div>
                      <div className="flex items-end gap-2">
                        <div className="space-y-1">
                          <Label className="text-xs">Or add custom</Label>
                          <Input value={customName} onChange={(e) => setCustomName(e.target.value)} placeholder="Material name" className="h-9 w-44" />
                        </div>
                        <Input value={customUnit} onChange={(e) => setCustomUnit(e.target.value)} placeholder="Unit" className="h-9 w-20" />
                        <Button variant="outline" size="sm" onClick={addCustomMaterial} disabled={!customName.trim()}>
                          <Plus className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>

                    {materials.length === 0 ? (
                      <p className="text-sm text-slate-400 py-4 text-center">No materials yet. Use AI Recommend or add manually.</p>
                    ) : (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Material</TableHead>
                            <TableHead className="w-[80px]">Unit</TableHead>
                            <TableHead className="w-[120px]">Est. Qty</TableHead>
                            <TableHead className="w-[90px]">Source</TableHead>
                            <TableHead className="w-[90px] text-center">Approved</TableHead>
                            <TableHead className="w-[60px]"></TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {materials.map((m) => (
                            <TableRow key={m.id}>
                              <TableCell className="font-medium">{m.material_name}{!m.material_id && <span className="ml-1.5 text-xs text-slate-400">(custom)</span>}</TableCell>
                              <TableCell className="text-slate-600">{m.unit || '—'}</TableCell>
                              <TableCell>
                                <Input
                                  type="number"
                                  step="0.001"
                                  defaultValue={m.estimated_quantity ?? ''}
                                  onBlur={(e) => saveEstimatedQty(m, e.target.value)}
                                  className="h-8"
                                />
                              </TableCell>
                              <TableCell>
                                <Badge variant="secondary" className="text-xs bg-slate-100 text-slate-600">{m.source === 'ai' ? 'AI' : m.source === 'ai_edited' ? 'AI•edited' : m.source === 'grn' ? 'GRN' : 'Manual'}</Badge>
                              </TableCell>
                              <TableCell className="text-center">
                                <Checkbox checked={m.is_approved} onCheckedChange={() => toggleApproved(m)} />
                              </TableCell>
                              <TableCell>
                                <Button variant="ghost" size="icon" className="h-7 w-7 text-red-600" onClick={() => removeMaterial(m)}>
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              {/* ---- Documents ---- */}
              <TabsContent value="documents" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">TDS &amp; Test Certificates</CardTitle>
                    <CardDescription>Upload per approved material. Test certificates linked via Material GRN appear automatically.</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {approvedMaterials.length === 0 ? (
                      <p className="text-sm text-slate-400 py-4 text-center">Approve materials in the Materials tab to track their documents here.</p>
                    ) : (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Material</TableHead>
                            <TableHead>TDS</TableHead>
                            <TableHead>Test Certificate</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {approvedMaterials.map((m) => {
                            const tds = docsMap.get(m.id)?.tds
                            const tdsStatus: EffectiveDocStatus = tds?.status === 'uploaded' ? 'uploaded' : tds?.status === 'not_applicable' ? 'na' : 'pending'
                            const cert = testCertStatusFor(m)
                            const directCert = docsMap.get(m.id)?.test_certificate
                            return (
                              <TableRow key={m.id}>
                                <TableCell className="font-medium align-top">{m.material_name}</TableCell>
                                {/* TDS slot */}
                                <TableCell className="align-top">
                                  <div className="space-y-1.5">
                                    <Badge variant="secondary" className={`text-xs ${STATUS_STYLE[tdsStatus]}`}>{STATUS_LABEL[tdsStatus]}</Badge>
                                    {tds?.file_name && <p className="text-xs text-slate-500 truncate max-w-[180px]">{tds.file_name}</p>}
                                    <div className="flex flex-wrap gap-1">
                                      {tds?.status === 'uploaded' && tds.file_path && (
                                        <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => openBoqcDoc(tds.file_path!)}><Eye className="h-3.5 w-3.5 mr-1" />View</Button>
                                      )}
                                      <Button variant="outline" size="sm" className="h-7 px-2 text-xs" onClick={() => triggerDocUpload(m.id, 'tds')}>
                                        <FileUp className="h-3.5 w-3.5 mr-1" />{tds?.status === 'uploaded' ? 'Replace' : 'Upload'}
                                      </Button>
                                      {tds?.status !== 'not_applicable' ? (
                                        <Button variant="ghost" size="sm" className="h-7 px-2 text-xs text-slate-500" onClick={() => changeDocStatus(m.id, 'tds', 'not_applicable')}>Mark N/A</Button>
                                      ) : (
                                        <Button variant="ghost" size="sm" className="h-7 px-2 text-xs text-slate-500" onClick={() => changeDocStatus(m.id, 'tds', 'pending')}>Mark pending</Button>
                                      )}
                                    </div>
                                  </div>
                                </TableCell>
                                {/* Test cert slot */}
                                <TableCell className="align-top">
                                  <div className="space-y-1.5">
                                    <Badge variant="secondary" className={`text-xs ${STATUS_STYLE[cert.status]}`}>{STATUS_LABEL[cert.status]} ({docStatusYN(cert.status)})</Badge>
                                    {directCert?.file_name && <p className="text-xs text-slate-500 truncate max-w-[180px]">{directCert.file_name}</p>}
                                    {!directCert?.file_name && cert.grnCert && (
                                      <p className="text-xs text-emerald-600 truncate max-w-[180px]">From GRN: {cert.grnCert.file_name || 'certificate'}</p>
                                    )}
                                    <div className="flex flex-wrap gap-1">
                                      {directCert?.status === 'uploaded' && directCert.file_path && (
                                        <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => openBoqcDoc(directCert.file_path!)}><Eye className="h-3.5 w-3.5 mr-1" />View</Button>
                                      )}
                                      {!directCert?.file_path && cert.grnCert && (
                                        <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => openBoqcDoc(cert.grnCert!.file_path)}><Eye className="h-3.5 w-3.5 mr-1" />View GRN</Button>
                                      )}
                                      <Button variant="outline" size="sm" className="h-7 px-2 text-xs" onClick={() => triggerDocUpload(m.id, 'test_certificate')}>
                                        <FileUp className="h-3.5 w-3.5 mr-1" />{directCert?.status === 'uploaded' ? 'Replace' : 'Upload'}
                                      </Button>
                                      {directCert?.status !== 'not_applicable' ? (
                                        <Button variant="ghost" size="sm" className="h-7 px-2 text-xs text-slate-500" onClick={() => changeDocStatus(m.id, 'test_certificate', 'not_applicable')}>Mark N/A</Button>
                                      ) : (
                                        <Button variant="ghost" size="sm" className="h-7 px-2 text-xs text-slate-500" onClick={() => changeDocStatus(m.id, 'test_certificate', 'pending')}>Mark pending</Button>
                                      )}
                                    </div>
                                  </div>
                                </TableCell>
                              </TableRow>
                            )
                          })}
                        </TableBody>
                      </Table>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              {/* ---- RA Billing ---- */}
              <TabsContent value="ra" className="space-y-4">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <Card><CardContent className="pt-4 text-center"><p className="text-2xl font-bold text-slate-900">{boqQty.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</p><p className="text-sm text-slate-500">BOQ Qty</p></CardContent></Card>
                  <Card><CardContent className="pt-4 text-center"><p className="text-2xl font-bold text-cyan-600">{uptoDate.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</p><p className="text-sm text-slate-500">Upto Date</p></CardContent></Card>
                  <Card><CardContent className="pt-4 text-center"><p className={`text-2xl font-bold ${remaining < 0 ? 'text-blue-600' : 'text-slate-900'}`}>{remaining.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</p><p className="text-sm text-slate-500">Remaining</p></CardContent></Card>
                  <Card><CardContent className="pt-4 text-center"><p className="text-2xl font-bold text-green-600">{billedPct.toFixed(0)}%</p><p className="text-sm text-slate-500">Billed</p></CardContent></Card>
                </div>
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0">
                    <div>
                      <CardTitle className="text-base flex items-center gap-2"><IndianRupee className="h-4 w-4" />Running Account Bills</CardTitle>
                      <CardDescription>Each RA captures the new measured quantity and its MB sheet.</CardDescription>
                    </div>
                    <Button variant="outline" size="sm" onClick={openRaDialog}><Plus className="h-4 w-4 mr-1.5" />Add RA</Button>
                  </CardHeader>
                  <CardContent>
                    {raEntries.length === 0 ? (
                      <p className="text-sm text-slate-400 py-4 text-center">No RA bills yet. Add RA 1 to begin measurement billing.</p>
                    ) : (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-[70px]">RA No</TableHead>
                            <TableHead>Date</TableHead>
                            <TableHead className="text-right">Previous</TableHead>
                            <TableHead className="text-right">New</TableHead>
                            <TableHead className="text-right">Upto Date</TableHead>
                            <TableHead>MB Sheet</TableHead>
                            <TableHead>Remarks</TableHead>
                            <TableHead className="w-[50px]"></TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {raEntries.map((e) => (
                            <TableRow key={e.id}>
                              <TableCell className="font-medium">RA {e.ra_number}</TableCell>
                              <TableCell className="text-slate-600">{e.entry_date || '—'}</TableCell>
                              <TableCell className="text-right">{e.previous_quantity.toLocaleString('en-IN', { maximumFractionDigits: 3 })}</TableCell>
                              <TableCell className="text-right font-medium">{e.new_quantity.toLocaleString('en-IN', { maximumFractionDigits: 3 })}</TableCell>
                              <TableCell className="text-right">{e.upto_date_quantity.toLocaleString('en-IN', { maximumFractionDigits: 3 })}</TableCell>
                              <TableCell>
                                <div className="flex gap-1">
                                  {e.mb_sheet_file_path && (
                                    <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => openBoqcDoc(e.mb_sheet_file_path!)}><Eye className="h-3.5 w-3.5 mr-1" />View</Button>
                                  )}
                                  <Button variant="outline" size="sm" className="h-7 px-2 text-xs" onClick={() => triggerMbUpload(e)}><FileUp className="h-3.5 w-3.5 mr-1" />{e.mb_sheet_file_path ? 'Replace' : 'Upload'}</Button>
                                </div>
                              </TableCell>
                              <TableCell className="text-slate-600 max-w-[160px] truncate">{e.remarks || '—'}</TableCell>
                              <TableCell>
                                <Button variant="ghost" size="icon" className="h-7 w-7 text-red-600" onClick={() => removeRa(e)}><Trash2 className="h-4 w-4" /></Button>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </>
        )}
        {loadingData && <p className="text-sm text-slate-400">Loading…</p>}
      </div>

      {/* AI review dialog */}
      <Dialog open={aiOpen} onOpenChange={setAiOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Sparkles className="h-5 w-5 text-cyan-600" />Recommended Materials</DialogTitle>
            <DialogDescription>
              {aiLoading ? 'Analysing the line-item description…' : aiSource === 'heuristic' ? 'AI unavailable — showing keyword matches. Review and edit before adding.' : 'Review, edit and select the materials to add.'}
            </DialogDescription>
          </DialogHeader>
          {aiLoading ? (
            <p className="text-sm text-slate-500 py-8 text-center">Working…</p>
          ) : aiRows.length === 0 ? (
            <p className="text-sm text-slate-500 py-8 text-center">No suggestions.</p>
          ) : (
            <div className="max-h-[50vh] overflow-y-auto space-y-2">
              {aiRows.map((r, i) => (
                <div key={i} className="flex items-start gap-2 border rounded-md p-2">
                  <Checkbox checked={r.selected} onCheckedChange={(v) => setAiRows((prev) => prev.map((x, j) => j === i ? { ...x, selected: !!v } : x))} className="mt-2" />
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center gap-2">
                      <Input value={r.material_name} onChange={(e) => setAiRows((prev) => prev.map((x, j) => j === i ? { ...x, material_name: e.target.value } : x))} className="h-8" />
                      <Input value={r.unit ?? ''} placeholder="unit" onChange={(e) => setAiRows((prev) => prev.map((x, j) => j === i ? { ...x, unit: e.target.value } : x))} className="h-8 w-20" />
                      <Input type="number" step="0.001" value={r.estimated_quantity ?? ''} placeholder="qty" onChange={(e) => setAiRows((prev) => prev.map((x, j) => j === i ? { ...x, estimated_quantity: e.target.value === '' ? null : Number(e.target.value) } : x))} className="h-8 w-24" />
                      <Badge variant="secondary" className={`text-xs ${CONFIDENCE_STYLE[r.confidence]}`}>{r.confidence}</Badge>
                    </div>
                    {r.rationale && <p className="text-xs text-slate-500">{r.rationale}{r.material_id ? '' : ' • not in master list'}</p>}
                  </div>
                </div>
              ))}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setAiOpen(false)}>Cancel</Button>
            <Button onClick={addSelectedAiRows} disabled={aiLoading || aiRows.every((r) => !r.selected)}>Add Selected</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Share-with-vendor summary */}
      <Dialog open={shareOpen} onOpenChange={setShareOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Vendor Material List</DialogTitle>
            <DialogDescription>Approved materials for {selectedLineItemData?.item_number} (BOQ Qty {boqQty} {selectedLineItemData?.unit}). Share this with your vendor.</DialogDescription>
          </DialogHeader>
          <div className="max-h-[50vh] overflow-y-auto">
            <Table>
              <TableHeader><TableRow><TableHead>Material</TableHead><TableHead>Unit</TableHead><TableHead className="text-right">Est. Qty</TableHead></TableRow></TableHeader>
              <TableBody>
                {approvedMaterials.map((m) => (
                  <TableRow key={m.id}><TableCell>{m.material_name}</TableCell><TableCell>{m.unit || '—'}</TableCell><TableCell className="text-right">{m.estimated_quantity ?? '—'}</TableCell></TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <DialogFooter><Button onClick={() => setShareOpen(false)}>Done</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add RA dialog */}
      <Dialog open={raOpen} onOpenChange={setRaOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add RA {(raEntries.reduce((mx, e) => Math.max(mx, e.ra_number), 0) || 0) + 1}</DialogTitle>
            <DialogDescription>Previous: {uptoDate.toLocaleString('en-IN', { maximumFractionDigits: 3 })} {selectedLineItemData?.unit}. Enter this RA&apos;s new measured quantity.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label className="text-xs">New Quantity *</Label>
              <Input type="number" step="0.001" value={raNewQty} onChange={(e) => setRaNewQty(e.target.value)} placeholder="0.000" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Measurement Date</Label>
              <Input type="date" value={raDate} onChange={(e) => setRaDate(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">MB Sheet (Excel)</Label>
              <Input type="file" accept=".xlsx,.xls" onChange={(e) => setRaFile(e.target.files?.[0] ?? null)} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Remarks</Label>
              <Textarea value={raRemarks} onChange={(e) => setRaRemarks(e.target.value)} rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRaOpen(false)}>Cancel</Button>
            <Button onClick={saveRa} disabled={raSaving}>{raSaving ? 'Saving…' : 'Add RA'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
