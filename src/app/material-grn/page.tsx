'use client'

import { useState, useEffect, useRef } from 'react'
import { Header } from '@/components/layout/header'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
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
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import {
  Package,
  Plus,
  Pencil,
  Trash2,
  Search,
  Filter,
  Loader2,
  FileText,
  Upload,
  Eye,
  ChevronDown,
  ChevronRight,
  Building2,
  Calendar,
  Receipt,
  FileCheck,
  Ban,
  AlertCircle,
  Check,
  ChevronsUpDown,
  Camera,
  Download,
} from 'lucide-react'
import * as XLSX from 'xlsx'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

interface Site {
  id: string
  name: string
}

interface MasterMaterial {
  id: string
  category: string
  name: string
  unit: string
}

interface GRNComplianceDoc {
  id: string
  grn_id: string
  document_type: 'dc' | 'mir' | 'test_certificate' | 'tds'
  is_applicable: boolean
  is_uploaded: boolean
  file_path: string | null
  file_name: string | null
  document_date: string | null
}

interface MaterialGRN {
  id: string
  site_id: string
  grn_date: string
  vendor_name: string
  invoice_number: string | null
  invoice_amount: number | null
  material_id: string
  material_name: string
  quantity: number
  unit: string
  notes: string | null
  created_at: string
  compliance_docs: GRNComplianceDoc[]
  sites?: { name: string }
}

const COMPLIANCE_DOC_TYPES = [
  { value: 'dc', label: 'DC', fullName: 'Delivery Challan' },
  { value: 'mir', label: 'MIR', fullName: 'Material Inspection Report' },
  { value: 'test_certificate', label: 'Test Cert', fullName: 'Test Certificate' },
  { value: 'tds', label: 'TDS', fullName: 'Technical Data Sheet' },
] as const

export default function MaterialGRNPage() {
  const [sites, setSites] = useState<Site[]>([])
  const [selectedSiteId, setSelectedSiteId] = useState<string>('')
  const [grnList, setGrnList] = useState<MaterialGRN[]>([])
  const [masterMaterials, setMasterMaterials] = useState<MasterMaterial[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedGRNs, setExpandedGRNs] = useState<Set<string>>(new Set())

  // Dialog states
  const [grnDialogOpen, setGrnDialogOpen] = useState(false)
  const [complianceDialogOpen, setComplianceDialogOpen] = useState(false)
  const [editingGRN, setEditingGRN] = useState<MaterialGRN | null>(null)
  const [selectedGRNForCompliance, setSelectedGRNForCompliance] = useState<MaterialGRN | null>(null)
  const [saving, setSaving] = useState(false)

  // Material search
  const [materialSearchOpen, setMaterialSearchOpen] = useState(false)
  const [materialSearchTerm, setMaterialSearchTerm] = useState('')

  // GRN Form state
  const [formData, setFormData] = useState({
    grn_date: new Date().toISOString().split('T')[0],
    vendor_name: '',
    invoice_number: '',
    invoice_amount: '',
    material_id: '',
    material_name: '',
    quantity: '',
    unit: '',
    notes: '',
  })

  // Compliance upload state
  const [uploadingDoc, setUploadingDoc] = useState<string | null>(null)
  const fileInputRefs = useRef<{ [key: string]: HTMLInputElement | null }>({})

  useEffect(() => {
    fetchInitialData()
  }, [])

  useEffect(() => {
    if (selectedSiteId) {
      fetchGRNList()
    }
  }, [selectedSiteId])

  async function fetchInitialData() {
    try {
      // Fetch sites
      const { data: sitesData, error: sitesError } = await supabase
        .from('sites')
        .select('id, name')
        .order('name')

      if (sitesError) throw sitesError
      setSites(sitesData || [])

      // Auto-select first site
      if (sitesData && sitesData.length > 0) {
        setSelectedSiteId(sitesData[0].id)
      }

      // Fetch master materials
      const { data: materialsData, error: materialsError } = await supabase
        .from('master_materials')
        .select('id, category, name, unit')
        .eq('is_active', true)
        .order('name')

      if (materialsError) throw materialsError
      setMasterMaterials(materialsData || [])
    } catch (error) {
      console.error('Error fetching initial data:', error)
      toast.error('Failed to load data')
    } finally {
      setLoading(false)
    }
  }

  async function fetchGRNList() {
    try {
      const { data, error } = await supabase
        .from('material_grn')
        .select(`
          *,
          sites (name)
        `)
        .eq('site_id', selectedSiteId)
        .order('grn_date', { ascending: false })

      if (error) throw error

      // Fetch compliance docs for all GRNs
      const grnIds = (data || []).map(g => g.id)
      let complianceDocs: GRNComplianceDoc[] = []

      if (grnIds.length > 0) {
        const { data: docsData, error: docsError } = await supabase
          .from('grn_compliance_documents')
          .select('*')
          .in('grn_id', grnIds)

        if (docsError) {
          console.error('Error fetching compliance docs:', docsError)
        } else {
          complianceDocs = docsData || []
        }
      }

      // Attach compliance docs to GRNs
      const grnsWithDocs = (data || []).map(grn => ({
        ...grn,
        compliance_docs: complianceDocs.filter(d => d.grn_id === grn.id)
      }))

      setGrnList(grnsWithDocs)
    } catch (error) {
      console.error('Error fetching GRN list:', error)
      toast.error('Failed to load GRN entries')
    }
  }

  function openCreateDialog() {
    setEditingGRN(null)
    setFormData({
      grn_date: new Date().toISOString().split('T')[0],
      vendor_name: '',
      invoice_number: '',
      invoice_amount: '',
      material_id: '',
      material_name: '',
      quantity: '',
      unit: '',
      notes: '',
    })
    setGrnDialogOpen(true)
  }

  function openEditDialog(grn: MaterialGRN) {
    setEditingGRN(grn)
    setFormData({
      grn_date: grn.grn_date,
      vendor_name: grn.vendor_name,
      invoice_number: grn.invoice_number || '',
      invoice_amount: grn.invoice_amount?.toString() || '',
      material_id: grn.material_id,
      material_name: grn.material_name,
      quantity: grn.quantity.toString(),
      unit: grn.unit,
      notes: grn.notes || '',
    })
    setGrnDialogOpen(true)
  }

  function selectMaterial(material: MasterMaterial) {
    setFormData({
      ...formData,
      material_id: material.id,
      material_name: material.name,
      unit: material.unit,
    })
    setMaterialSearchOpen(false)
  }

  async function handleSaveGRN() {
    if (!formData.grn_date) {
      toast.error('Please select a date')
      return
    }
    if (!formData.vendor_name.trim()) {
      toast.error('Please enter vendor name')
      return
    }
    if (!formData.material_id) {
      toast.error('Please select a material')
      return
    }
    if (!formData.quantity || parseFloat(formData.quantity) <= 0) {
      toast.error('Please enter a valid quantity')
      return
    }

    setSaving(true)
    try {
      if (editingGRN) {
        // Update
        const { error } = await supabase
          .from('material_grn')
          .update({
            grn_date: formData.grn_date,
            vendor_name: formData.vendor_name.trim(),
            invoice_number: formData.invoice_number.trim() || null,
            invoice_amount: formData.invoice_amount ? parseFloat(formData.invoice_amount) : null,
            material_id: formData.material_id,
            material_name: formData.material_name,
            quantity: parseFloat(formData.quantity),
            unit: formData.unit,
            notes: formData.notes.trim() || null,
          })
          .eq('id', editingGRN.id)

        if (error) throw error
        toast.success('GRN updated successfully')
      } else {
        // Create
        const { data: newGRN, error } = await supabase
          .from('material_grn')
          .insert({
            site_id: selectedSiteId,
            grn_date: formData.grn_date,
            vendor_name: formData.vendor_name.trim(),
            invoice_number: formData.invoice_number.trim() || null,
            invoice_amount: formData.invoice_amount ? parseFloat(formData.invoice_amount) : null,
            material_id: formData.material_id,
            material_name: formData.material_name,
            quantity: parseFloat(formData.quantity),
            unit: formData.unit,
            notes: formData.notes.trim() || null,
          })
          .select()
          .single()

        if (error) throw error

        // Create compliance document placeholders
        const complianceDocs = COMPLIANCE_DOC_TYPES.map(docType => ({
          grn_id: newGRN.id,
          document_type: docType.value,
          is_applicable: true,
          is_uploaded: false,
        }))

        const { error: docsError } = await supabase
          .from('grn_compliance_documents')
          .insert(complianceDocs)

        if (docsError) {
          console.error('Error creating compliance docs:', docsError)
        }

        toast.success('GRN created successfully')
      }

      setGrnDialogOpen(false)
      fetchGRNList()
    } catch (error: any) {
      console.error('Error saving GRN:', error)
      toast.error(error?.message || 'Failed to save GRN')
    } finally {
      setSaving(false)
    }
  }

  async function handleDeleteGRN(grn: MaterialGRN) {
    if (!confirm(`Delete GRN for "${grn.material_name}"? This will also delete all compliance documents.`)) return

    try {
      // Delete compliance doc files from storage
      for (const doc of grn.compliance_docs) {
        if (doc.file_path) {
          await supabase.storage.from('compliance-docs').remove([doc.file_path])
        }
      }

      const { error } = await supabase
        .from('material_grn')
        .delete()
        .eq('id', grn.id)

      if (error) throw error
      toast.success('GRN deleted')
      fetchGRNList()
    } catch (error) {
      console.error('Error deleting GRN:', error)
      toast.error('Failed to delete GRN')
    }
  }

  function openComplianceDialog(grn: MaterialGRN) {
    setSelectedGRNForCompliance(grn)
    setComplianceDialogOpen(true)
  }

  async function toggleDocApplicable(doc: GRNComplianceDoc) {
    try {
      const { error } = await supabase
        .from('grn_compliance_documents')
        .update({ is_applicable: !doc.is_applicable })
        .eq('id', doc.id)

      if (error) throw error

      // Update local state
      if (selectedGRNForCompliance) {
        const updatedDocs = selectedGRNForCompliance.compliance_docs.map(d =>
          d.id === doc.id ? { ...d, is_applicable: !d.is_applicable } : d
        )
        setSelectedGRNForCompliance({
          ...selectedGRNForCompliance,
          compliance_docs: updatedDocs
        })
      }

      fetchGRNList()
    } catch (error) {
      console.error('Error toggling applicability:', error)
      toast.error('Failed to update')
    }
  }

  async function handleFileUpload(doc: GRNComplianceDoc, file: File) {
    setUploadingDoc(doc.document_type)

    try {
      // Upload file
      const fileExt = file.name.split('.').pop()
      const fileName = `grn/${doc.grn_id}/${doc.document_type}_${Date.now()}.${fileExt}`

      const { error: uploadError } = await supabase.storage
        .from('compliance-docs')
        .upload(fileName, file, { upsert: true })

      if (uploadError) throw uploadError

      // Update document record
      const { error } = await supabase
        .from('grn_compliance_documents')
        .update({
          file_path: fileName,
          file_name: file.name,
          is_uploaded: true,
          uploaded_at: new Date().toISOString(),
        })
        .eq('id', doc.id)

      if (error) throw error

      toast.success('Document uploaded successfully')

      // Update local state
      if (selectedGRNForCompliance) {
        const updatedDocs = selectedGRNForCompliance.compliance_docs.map(d =>
          d.id === doc.id
            ? { ...d, file_path: fileName, file_name: file.name, is_uploaded: true }
            : d
        )
        setSelectedGRNForCompliance({
          ...selectedGRNForCompliance,
          compliance_docs: updatedDocs
        })
      }

      fetchGRNList()
    } catch (error: any) {
      console.error('Error uploading file:', error)
      toast.error(error?.message || 'Failed to upload document')
    } finally {
      setUploadingDoc(null)
    }
  }

  async function viewDocument(doc: GRNComplianceDoc) {
    if (!doc.file_path) return

    try {
      const { data, error } = await supabase.storage
        .from('compliance-docs')
        .createSignedUrl(doc.file_path, 3600)

      if (error) throw error
      window.open(data.signedUrl, '_blank')
    } catch (error) {
      console.error('Error viewing document:', error)
      toast.error('Failed to view document')
    }
  }

  async function deleteDocument(doc: GRNComplianceDoc) {
    if (!confirm('Delete this document?')) return

    try {
      if (doc.file_path) {
        await supabase.storage.from('compliance-docs').remove([doc.file_path])
      }

      const { error } = await supabase
        .from('grn_compliance_documents')
        .update({
          file_path: null,
          file_name: null,
          is_uploaded: false,
          uploaded_at: null,
        })
        .eq('id', doc.id)

      if (error) throw error
      toast.success('Document deleted')

      // Update local state
      if (selectedGRNForCompliance) {
        const updatedDocs = selectedGRNForCompliance.compliance_docs.map(d =>
          d.id === doc.id
            ? { ...d, file_path: null, file_name: null, is_uploaded: false }
            : d
        )
        setSelectedGRNForCompliance({
          ...selectedGRNForCompliance,
          compliance_docs: updatedDocs
        })
      }

      fetchGRNList()
    } catch (error) {
      console.error('Error deleting document:', error)
      toast.error('Failed to delete document')
    }
  }

  function getComplianceStatus(grn: MaterialGRN) {
    const docs = grn.compliance_docs
    if (docs.length === 0) return { total: 4, completed: 0, na: 0 }

    const applicable = docs.filter(d => d.is_applicable)
    const uploaded = docs.filter(d => d.is_applicable && d.is_uploaded)
    const na = docs.filter(d => !d.is_applicable)

    return {
      total: applicable.length,
      completed: uploaded.length,
      na: na.length
    }
  }

  function getDocStatus(docs: GRNComplianceDoc[], docType: string): string {
    const doc = docs.find(d => d.document_type === docType)
    if (!doc) return 'N'
    if (!doc.is_applicable) return 'NA'
    if (doc.is_uploaded) return 'Y'
    return 'N'
  }

  function exportToExcel() {
    if (grnList.length === 0) {
      toast.error('No data to export')
      return
    }

    const siteName = sites.find(s => s.id === selectedSiteId)?.name || 'Unknown Site'

    // Prepare data for export
    const exportData = grnList.map((grn, index) => ({
      'S.No': index + 1,
      'Date': new Date(grn.grn_date).toLocaleDateString('en-IN'),
      'Material': grn.material_name,
      'Vendor': grn.vendor_name,
      'Invoice No.': grn.invoice_number || '',
      'Invoice Amount (₹)': grn.invoice_amount || '',
      'Quantity': grn.quantity,
      'Unit': grn.unit,
      'DC': getDocStatus(grn.compliance_docs, 'dc'),
      'MIR': getDocStatus(grn.compliance_docs, 'mir'),
      'Test Certificate': getDocStatus(grn.compliance_docs, 'test_certificate'),
      'TDS': getDocStatus(grn.compliance_docs, 'tds'),
      'Notes': grn.notes || '',
    }))

    // Create workbook and worksheet
    const wb = XLSX.utils.book_new()
    const ws = XLSX.utils.json_to_sheet(exportData)

    // Set column widths
    ws['!cols'] = [
      { wch: 6 },   // S.No
      { wch: 12 },  // Date
      { wch: 30 },  // Material
      { wch: 20 },  // Vendor
      { wch: 15 },  // Invoice No
      { wch: 15 },  // Invoice Amount
      { wch: 10 },  // Quantity
      { wch: 8 },   // Unit
      { wch: 6 },   // DC
      { wch: 6 },   // MIR
      { wch: 15 }, // Test Certificate
      { wch: 6 },   // TDS
      { wch: 30 },  // Notes
    ]

    // Add worksheet to workbook
    XLSX.utils.book_append_sheet(wb, ws, 'MIR Report')

    // Generate filename with site name and date
    const dateStr = new Date().toISOString().split('T')[0]
    const filename = `MIR_Report_${siteName.replace(/[^a-zA-Z0-9]/g, '_')}_${dateStr}.xlsx`

    // Download file
    XLSX.writeFile(wb, filename)
    toast.success('MIR Report exported successfully')
  }

  // Filter materials for search
  const filteredMaterials = masterMaterials.filter(m =>
    m.name.toLowerCase().includes(materialSearchTerm.toLowerCase()) ||
    m.category.toLowerCase().includes(materialSearchTerm.toLowerCase())
  )

  if (loading) {
    return (
      <div className="flex flex-col min-h-screen">
        <Header title="Material GRN & Compliance" />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <Loader2 className="h-8 w-8 animate-spin text-blue-600 mx-auto mb-4" />
            <p className="text-slate-500">Loading...</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col min-h-screen">
      <Header title="Material GRN & Compliance" />

      <div className="flex-1 p-4 md:p-6 space-y-6">
        {/* Header Card */}
        <Card>
          <CardHeader>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Receipt className="h-5 w-5" />
                  Material GRN & Compliance
                </CardTitle>
                <CardDescription>
                  Record material deliveries and manage compliance documents
                </CardDescription>
              </div>
              <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
                <Select value={selectedSiteId} onValueChange={setSelectedSiteId}>
                  <SelectTrigger className="w-full sm:w-[200px]">
                    <Building2 className="h-4 w-4 mr-2" />
                    <SelectValue placeholder="Select site" />
                  </SelectTrigger>
                  <SelectContent>
                    {sites.map((site) => (
                      <SelectItem key={site.id} value={site.id}>
                        {site.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  variant="outline"
                  onClick={exportToExcel}
                  disabled={!selectedSiteId || grnList.length === 0}
                  className="w-full sm:w-auto"
                >
                  <Download className="h-4 w-4 mr-2" />
                  Export MIR Report
                </Button>
                <Button onClick={openCreateDialog} disabled={!selectedSiteId} className="w-full sm:w-auto">
                  <Plus className="h-4 w-4 mr-2" />
                  Add GRN
                </Button>
              </div>
            </div>
          </CardHeader>
        </Card>

        {/* GRN List */}
        {!selectedSiteId ? (
          <Card>
            <CardContent className="py-12">
              <div className="text-center">
                <Building2 className="h-12 w-12 mx-auto text-slate-300 mb-4" />
                <h3 className="text-lg font-medium text-slate-900 mb-2">Select a Site</h3>
                <p className="text-slate-500">Choose a site to view and manage GRN entries</p>
              </div>
            </CardContent>
          </Card>
        ) : grnList.length === 0 ? (
          <Card>
            <CardContent className="py-12">
              <div className="text-center">
                <Receipt className="h-12 w-12 mx-auto text-slate-300 mb-4" />
                <h3 className="text-lg font-medium text-slate-900 mb-2">No GRN Entries</h3>
                <p className="text-slate-500 mb-4">Start by adding your first material GRN</p>
                <Button onClick={openCreateDialog}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add GRN
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <>
            {/* Mobile Card View */}
            <div className="md:hidden space-y-3">
              {grnList.map((grn) => {
                const compliance = getComplianceStatus(grn)
                const isComplete = compliance.completed === compliance.total && compliance.total > 0

                return (
                  <Card key={grn.id}>
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-2 mb-3">
                        <div className="flex-1 min-w-0">
                          <h3 className="font-medium text-sm truncate">{grn.material_name}</h3>
                          <p className="text-xs text-slate-500">{grn.vendor_name}</p>
                        </div>
                        <Badge variant="secondary" className="text-xs shrink-0">
                          {grn.quantity} {grn.unit}
                        </Badge>
                      </div>

                      <div className="flex items-center gap-4 text-xs text-slate-600 mb-3">
                        <div className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {new Date(grn.grn_date).toLocaleDateString('en-IN')}
                        </div>
                        {grn.invoice_number && (
                          <div>
                            {grn.invoice_number}
                            {grn.invoice_amount && (
                              <span className="text-slate-400"> | ₹{grn.invoice_amount.toLocaleString('en-IN')}</span>
                            )}
                          </div>
                        )}
                      </div>

                      <div className="flex items-center justify-between gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openComplianceDialog(grn)}
                          className={cn(
                            'text-xs flex-1',
                            isComplete
                              ? 'border-green-200 bg-green-50 text-green-700'
                              : 'border-amber-200 bg-amber-50 text-amber-700'
                          )}
                        >
                          <FileText className="h-3 w-3 mr-1" />
                          Docs: {compliance.completed}/{compliance.total}
                          {compliance.na > 0 && ` (${compliance.na} NA)`}
                        </Button>
                        <div className="flex gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openEditDialog(grn)}
                            className="h-8 w-8 p-0"
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteGRN(grn)}
                            className="text-red-600 h-8 w-8 p-0"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
            </div>

            {/* Desktop Table View */}
            <Card className="hidden md:block">
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Material</TableHead>
                      <TableHead>Vendor</TableHead>
                      <TableHead>Invoice</TableHead>
                      <TableHead className="text-right">Qty</TableHead>
                      <TableHead>Compliance</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {grnList.map((grn) => {
                      const compliance = getComplianceStatus(grn)
                      const isComplete = compliance.completed === compliance.total && compliance.total > 0

                      return (
                        <TableRow key={grn.id}>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Calendar className="h-4 w-4 text-slate-400" />
                              {new Date(grn.grn_date).toLocaleDateString('en-IN')}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div>
                              <p className="font-medium">{grn.material_name}</p>
                            </div>
                          </TableCell>
                          <TableCell>{grn.vendor_name}</TableCell>
                          <TableCell>
                            {grn.invoice_number && (
                              <div>
                                <p className="text-sm">{grn.invoice_number}</p>
                                {grn.invoice_amount && (
                                  <p className="text-xs text-slate-500">
                                    ₹{grn.invoice_amount.toLocaleString('en-IN')}
                                  </p>
                                )}
                              </div>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            <Badge variant="secondary">
                              {grn.quantity} {grn.unit}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => openComplianceDialog(grn)}
                              className={cn(
                                'text-xs',
                                isComplete
                                  ? 'border-green-200 bg-green-50 text-green-700'
                                  : 'border-amber-200 bg-amber-50 text-amber-700'
                              )}
                            >
                              <FileText className="h-3 w-3 mr-1" />
                              {compliance.completed}/{compliance.total}
                              {compliance.na > 0 && ` (${compliance.na} NA)`}
                            </Button>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => openEditDialog(grn)}
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDeleteGRN(grn)}
                                className="text-red-600"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </>
        )}
      </div>

      {/* GRN Dialog */}
      <Dialog open={grnDialogOpen} onOpenChange={setGrnDialogOpen}>
        <DialogContent className="w-[calc(100vw-2rem)] max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingGRN ? 'Edit GRN' : 'Add New GRN'}</DialogTitle>
            <DialogDescription>
              {editingGRN ? 'Update the GRN details' : 'Record a new material delivery'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Date */}
            <div className="space-y-2">
              <Label htmlFor="grn_date">Date *</Label>
              <Input
                id="grn_date"
                type="date"
                value={formData.grn_date}
                onChange={(e) => setFormData({ ...formData, grn_date: e.target.value })}
              />
            </div>

            {/* Vendor Name */}
            <div className="space-y-2">
              <Label htmlFor="vendor_name">Vendor Name *</Label>
              <Input
                id="vendor_name"
                placeholder="Enter vendor name"
                value={formData.vendor_name}
                onChange={(e) => setFormData({ ...formData, vendor_name: e.target.value })}
              />
            </div>

            {/* Invoice */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="invoice_number">Invoice No.</Label>
                <Input
                  id="invoice_number"
                  placeholder="INV-001"
                  value={formData.invoice_number}
                  onChange={(e) => setFormData({ ...formData, invoice_number: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="invoice_amount">Amount (₹)</Label>
                <Input
                  id="invoice_amount"
                  type="number"
                  placeholder="0.00"
                  value={formData.invoice_amount}
                  onChange={(e) => setFormData({ ...formData, invoice_amount: e.target.value })}
                />
              </div>
            </div>

            {/* Material Selection */}
            <div className="space-y-2">
              <Label>Material *</Label>
              <Popover open={materialSearchOpen} onOpenChange={setMaterialSearchOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={materialSearchOpen}
                    className="w-full justify-between"
                  >
                    {formData.material_name || 'Select material...'}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[calc(100vw-2rem)] sm:w-[400px] p-0">
                  <Command>
                    <CommandInput
                      placeholder="Search materials..."
                      value={materialSearchTerm}
                      onValueChange={setMaterialSearchTerm}
                    />
                    <CommandList>
                      <CommandEmpty>No material found.</CommandEmpty>
                      <CommandGroup className="max-h-[300px] overflow-y-auto">
                        {filteredMaterials.map((material) => (
                          <CommandItem
                            key={material.id}
                            value={material.name}
                            onSelect={() => selectMaterial(material)}
                          >
                            <Check
                              className={cn(
                                'mr-2 h-4 w-4',
                                formData.material_id === material.id ? 'opacity-100' : 'opacity-0'
                              )}
                            />
                            <div className="flex-1">
                              <p>{material.name}</p>
                              <p className="text-xs text-slate-500">{material.category} | {material.unit}</p>
                            </div>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>

            {/* Quantity and Unit */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="quantity">Quantity *</Label>
                <Input
                  id="quantity"
                  type="number"
                  step="0.001"
                  placeholder="0"
                  value={formData.quantity}
                  onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="unit">Unit</Label>
                <Input
                  id="unit"
                  value={formData.unit}
                  onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                  placeholder="nos"
                />
              </div>
            </div>

            {/* Notes */}
            <div className="space-y-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                placeholder="Additional notes..."
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                rows={2}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setGrnDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveGRN} disabled={saving}>
              {saving ? 'Saving...' : editingGRN ? 'Update' : 'Add GRN'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Compliance Documents Dialog */}
      <Dialog open={complianceDialogOpen} onOpenChange={setComplianceDialogOpen}>
        <DialogContent className="w-[calc(100vw-2rem)] max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Compliance Documents
            </DialogTitle>
            <DialogDescription>
              {selectedGRNForCompliance && (
                <>
                  Manage documents for <strong>{selectedGRNForCompliance.material_name}</strong>
                  <br />
                  <span className="text-xs">
                    {selectedGRNForCompliance.vendor_name} | {new Date(selectedGRNForCompliance.grn_date).toLocaleDateString('en-IN')}
                  </span>
                </>
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-4">
            {COMPLIANCE_DOC_TYPES.map((docType) => {
              const doc = selectedGRNForCompliance?.compliance_docs.find(
                d => d.document_type === docType.value
              )
              const isNA = doc && !doc.is_applicable
              const isUploaded = doc && doc.is_applicable && doc.is_uploaded

              return (
                <div
                  key={docType.value}
                  className={cn(
                    'border rounded-lg p-3',
                    isNA ? 'bg-slate-50' : isUploaded ? 'bg-green-50' : 'bg-white'
                  )}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h4 className="font-medium text-sm">{docType.label}</h4>
                        <span className="text-xs text-slate-500 hidden sm:inline">({docType.fullName})</span>
                      </div>

                      {isNA && (
                        <p className="text-xs text-slate-500 flex items-center gap-1 mt-1">
                          <Ban className="h-3 w-3" />
                          Not Applicable
                        </p>
                      )}

                      {isUploaded && doc?.file_name && (
                        <div className="flex items-center gap-1 text-xs mt-1">
                          <FileCheck className="h-3 w-3 text-green-600 shrink-0" />
                          <button
                            onClick={() => viewDocument(doc)}
                            className="text-blue-600 hover:underline truncate max-w-[200px]"
                          >
                            {doc.file_name}
                          </button>
                        </div>
                      )}

                      {!isNA && !isUploaded && (
                        <p className="text-xs text-amber-600 flex items-center gap-1 mt-1">
                          <AlertCircle className="h-3 w-3" />
                          Pending
                        </p>
                      )}
                    </div>

                    <div className="flex items-center gap-1 flex-wrap justify-end">
                      {doc && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => toggleDocApplicable(doc)}
                          className={cn('text-xs h-8', isNA ? 'text-green-600' : 'text-slate-600')}
                        >
                          {isNA ? 'Required' : 'NA'}
                        </Button>
                      )}

                      {!isNA && doc && (
                        <>
                          {isUploaded ? (
                            <>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => viewDocument(doc)}
                                className="h-8"
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                              <label>
                                <input
                                  type="file"
                                  className="hidden"
                                  accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg"
                                  onChange={(e) => {
                                    const file = e.target.files?.[0]
                                    if (file) handleFileUpload(doc, file)
                                    e.target.value = ''
                                  }}
                                />
                                <Button variant="outline" size="sm" asChild className="h-8" title="Upload file">
                                  <span className="cursor-pointer">
                                    <Upload className="h-4 w-4" />
                                  </span>
                                </Button>
                              </label>
                              <label>
                                <input
                                  type="file"
                                  className="hidden"
                                  accept="image/*"
                                  capture="environment"
                                  onChange={(e) => {
                                    const file = e.target.files?.[0]
                                    if (file) handleFileUpload(doc, file)
                                    e.target.value = ''
                                  }}
                                />
                                <Button variant="outline" size="sm" asChild className="h-8" title="Take photo">
                                  <span className="cursor-pointer">
                                    <Camera className="h-4 w-4" />
                                  </span>
                                </Button>
                              </label>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => deleteDocument(doc)}
                                className="text-red-600 h-8"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </>
                          ) : (
                            <div className="flex gap-1">
                              <label>
                                <input
                                  type="file"
                                  className="hidden"
                                  accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg"
                                  onChange={(e) => {
                                    const file = e.target.files?.[0]
                                    if (file) handleFileUpload(doc, file)
                                    e.target.value = ''
                                  }}
                                  disabled={uploadingDoc === docType.value}
                                />
                                <Button
                                  variant="default"
                                  size="sm"
                                  asChild
                                  disabled={uploadingDoc === docType.value}
                                  className="h-8"
                                >
                                  <span className="cursor-pointer">
                                    {uploadingDoc === docType.value ? (
                                      'Uploading...'
                                    ) : (
                                      <>
                                        <Upload className="h-4 w-4 mr-1" />
                                        Upload
                                      </>
                                    )}
                                  </span>
                                </Button>
                              </label>
                              <label>
                                <input
                                  type="file"
                                  className="hidden"
                                  accept="image/*"
                                  capture="environment"
                                  onChange={(e) => {
                                    const file = e.target.files?.[0]
                                    if (file) handleFileUpload(doc, file)
                                    e.target.value = ''
                                  }}
                                  disabled={uploadingDoc === docType.value}
                                />
                                <Button
                                  variant="outline"
                                  size="sm"
                                  asChild
                                  disabled={uploadingDoc === docType.value}
                                  className="h-8"
                                  title="Take photo"
                                >
                                  <span className="cursor-pointer">
                                    <Camera className="h-4 w-4" />
                                  </span>
                                </Button>
                              </label>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}

            <p className="text-xs text-slate-400 mt-2">
              Formats: PDF, DOC, XLS, PNG, JPG | Use <Camera className="inline h-3 w-3" /> to capture with camera
            </p>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setComplianceDialogOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
