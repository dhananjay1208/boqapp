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
  X,
} from 'lucide-react'
import * as XLSX from 'xlsx'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

interface Site {
  id: string
  name: string
}

interface Supplier {
  id: string
  supplier_name: string
  gstin: string | null
}

interface MasterMaterial {
  id: string
  category: string
  name: string
  unit: string
}

// New interfaces for invoice-based structure
interface GRNInvoiceDC {
  id: string
  grn_invoice_id: string
  is_applicable: boolean
  is_uploaded: boolean
  file_path: string | null
  file_name: string | null
  document_date: string | null
}

interface LineItemDocument {
  id: string
  grn_line_item_id: string
  document_type: 'mir' | 'test_certificate' | 'tds'
  is_applicable: boolean
  is_uploaded: boolean
  file_path: string | null
  file_name: string | null
  document_date: string | null
}

interface GRNLineItem {
  id: string
  grn_invoice_id: string
  material_id: string
  material_name: string
  quantity: number
  unit: string
  rate: number
  gst_rate: number
  amount_without_gst: number
  amount_with_gst: number
  notes: string | null
  documents: LineItemDocument[]
}

interface GRNInvoice {
  id: string
  site_id: string
  supplier_id: string
  invoice_number: string
  grn_date: string
  notes: string | null
  created_at: string
  supplier?: Supplier
  dc?: GRNInvoiceDC
  line_items: GRNLineItem[]
}

// Form state for line items
interface LineItemForm {
  tempId: string
  material_id: string
  material_name: string
  quantity: string
  unit: string
  rate: string
  gst_rate: string
  notes: string
}

// Legacy interfaces for old GRN data
interface LegacyGRNComplianceDoc {
  id: string
  grn_id: string
  document_type: 'dc' | 'mir' | 'test_certificate' | 'tds'
  is_applicable: boolean
  is_uploaded: boolean
  file_path: string | null
  file_name: string | null
  document_date: string | null
}

interface LegacyMaterialGRN {
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
  compliance_docs: LegacyGRNComplianceDoc[]
}

const GST_RATES = [
  { value: '5', label: '5%' },
  { value: '12', label: '12%' },
  { value: '18', label: '18%' },
]

const LINE_ITEM_DOC_TYPES = [
  { value: 'mir', label: 'MIR', fullName: 'Material Inspection Report' },
  { value: 'test_certificate', label: 'Test Cert', fullName: 'Test Certificate' },
  { value: 'tds', label: 'TDS', fullName: 'Technical Data Sheet' },
] as const

// Legacy compliance doc types for old data
const LEGACY_COMPLIANCE_DOC_TYPES = [
  { value: 'dc', label: 'DC', fullName: 'Delivery Challan' },
  { value: 'mir', label: 'MIR', fullName: 'Material Inspection Report' },
  { value: 'test_certificate', label: 'Test Cert', fullName: 'Test Certificate' },
  { value: 'tds', label: 'TDS', fullName: 'Technical Data Sheet' },
] as const

export default function MaterialGRNPage() {
  const [sites, setSites] = useState<Site[]>([])
  const [selectedSiteId, setSelectedSiteId] = useState<string>('')
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [selectedSupplierFilter, setSelectedSupplierFilter] = useState<string>('all')
  const [masterMaterials, setMasterMaterials] = useState<MasterMaterial[]>([])
  const [loading, setLoading] = useState(true)

  // New invoice data
  const [invoiceList, setInvoiceList] = useState<GRNInvoice[]>([])
  const [expandedInvoices, setExpandedInvoices] = useState<Set<string>>(new Set())

  // Legacy GRN data
  const [legacyGrnList, setLegacyGrnList] = useState<LegacyMaterialGRN[]>([])
  const [showLegacy, setShowLegacy] = useState(false)

  // Dialog states
  const [invoiceDialogOpen, setInvoiceDialogOpen] = useState(false)
  const [editingInvoice, setEditingInvoice] = useState<GRNInvoice | null>(null)
  const [saving, setSaving] = useState(false)

  // Compliance dialog states
  const [dcDialogOpen, setDcDialogOpen] = useState(false)
  const [selectedInvoiceForDC, setSelectedInvoiceForDC] = useState<GRNInvoice | null>(null)
  const [lineItemDocsDialogOpen, setLineItemDocsDialogOpen] = useState(false)
  const [selectedLineItem, setSelectedLineItem] = useState<GRNLineItem | null>(null)
  const [selectedLineItemInvoice, setSelectedLineItemInvoice] = useState<GRNInvoice | null>(null)

  // Legacy compliance dialog
  const [legacyComplianceDialogOpen, setLegacyComplianceDialogOpen] = useState(false)
  const [selectedLegacyGRN, setSelectedLegacyGRN] = useState<LegacyMaterialGRN | null>(null)

  // Upload states
  const [uploadingDoc, setUploadingDoc] = useState<string | null>(null)

  // Supplier search
  const [supplierSearchOpen, setSupplierSearchOpen] = useState(false)
  const [supplierSearchTerm, setSupplierSearchTerm] = useState('')

  // Invoice number search (for partial delivery - existing invoices)
  const [invoiceSearchOpen, setInvoiceSearchOpen] = useState(false)
  const [invoiceSearchTerm, setInvoiceSearchTerm] = useState('')
  const [existingInvoices, setExistingInvoices] = useState<{ invoice_number: string; supplier_id: string; supplier_name: string; grn_date: string }[]>([])

  // Material search for line items
  const [materialSearchOpen, setMaterialSearchOpen] = useState<number | null>(null)
  const [materialSearchTerm, setMaterialSearchTerm] = useState('')

  // Invoice form state
  const [invoiceForm, setInvoiceForm] = useState({
    supplier_id: '',
    supplier_name: '',
    invoice_number: '',
    grn_date: new Date().toISOString().split('T')[0],
    notes: '',
    dc_applicable: true,
  })

  // Line items form state
  const [lineItems, setLineItems] = useState<LineItemForm[]>([])

  useEffect(() => {
    fetchInitialData()
  }, [])

  useEffect(() => {
    if (selectedSiteId) {
      fetchInvoiceList()
      fetchLegacyGRNList()
      fetchExistingInvoiceNumbers()
    }
  }, [selectedSiteId])

  async function fetchInitialData() {
    try {
      // Fetch sites, suppliers, and materials in parallel
      const [sitesRes, suppliersRes, materialsRes] = await Promise.all([
        supabase.from('sites').select('id, name').order('name'),
        supabase.from('suppliers').select('id, supplier_name, gstin').order('supplier_name'),
        supabase.from('master_materials').select('id, category, name, unit').eq('is_active', true).order('name'),
      ])

      if (sitesRes.error) throw sitesRes.error
      if (suppliersRes.error) throw suppliersRes.error
      if (materialsRes.error) throw materialsRes.error

      setSites(sitesRes.data || [])
      setSuppliers(suppliersRes.data || [])
      setMasterMaterials(materialsRes.data || [])

      if (sitesRes.data && sitesRes.data.length > 0) {
        setSelectedSiteId(sitesRes.data[0].id)
      }
    } catch (error) {
      console.error('Error fetching initial data:', error)
      toast.error('Failed to load data')
    } finally {
      setLoading(false)
    }
  }

  async function fetchExistingInvoiceNumbers() {
    try {
      // Fetch unique invoice numbers for the selected site (for partial delivery selection)
      const { data, error } = await supabase
        .from('grn_invoices')
        .select(`
          invoice_number,
          supplier_id,
          grn_date,
          suppliers (supplier_name)
        `)
        .eq('site_id', selectedSiteId)
        .order('grn_date', { ascending: false })

      if (error) throw error

      // Get unique invoice numbers with their supplier info
      const uniqueInvoices = new Map<string, { invoice_number: string; supplier_id: string; supplier_name: string; grn_date: string }>()

      ;(data || []).forEach(inv => {
        if (!uniqueInvoices.has(inv.invoice_number)) {
          uniqueInvoices.set(inv.invoice_number, {
            invoice_number: inv.invoice_number,
            supplier_id: inv.supplier_id,
            supplier_name: (inv.suppliers as any)?.supplier_name || '',
            grn_date: inv.grn_date,
          })
        }
      })

      setExistingInvoices(Array.from(uniqueInvoices.values()))
    } catch (error) {
      console.error('Error fetching existing invoices:', error)
    }
  }

  async function fetchInvoiceList() {
    try {
      // Fetch invoices with suppliers
      const { data: invoicesData, error: invoicesError } = await supabase
        .from('grn_invoices')
        .select(`
          *,
          suppliers (id, supplier_name, gstin)
        `)
        .eq('site_id', selectedSiteId)
        .order('grn_date', { ascending: false })

      if (invoicesError) throw invoicesError

      if (!invoicesData || invoicesData.length === 0) {
        setInvoiceList([])
        return
      }

      const invoiceIds = invoicesData.map(inv => inv.id)

      // Fetch DC documents, line items, and line item documents in parallel
      const [dcRes, lineItemsRes] = await Promise.all([
        supabase.from('grn_invoice_dc').select('*').in('grn_invoice_id', invoiceIds),
        supabase.from('grn_line_items').select('*').in('grn_invoice_id', invoiceIds),
      ])

      if (dcRes.error) console.error('Error fetching DC docs:', dcRes.error)
      if (lineItemsRes.error) console.error('Error fetching line items:', lineItemsRes.error)

      const dcDocs = dcRes.data || []
      const lineItemsData = lineItemsRes.data || []

      // Fetch line item documents if there are line items
      let lineItemDocs: LineItemDocument[] = []
      if (lineItemsData.length > 0) {
        const lineItemIds = lineItemsData.map(li => li.id)
        const { data: docsData, error: docsError } = await supabase
          .from('grn_line_item_documents')
          .select('*')
          .in('grn_line_item_id', lineItemIds)

        if (docsError) console.error('Error fetching line item docs:', docsError)
        lineItemDocs = docsData || []
      }

      // Assemble invoices with all related data
      const invoices: GRNInvoice[] = invoicesData.map(inv => {
        const dc = dcDocs.find(d => d.grn_invoice_id === inv.id)
        const items = lineItemsData
          .filter(li => li.grn_invoice_id === inv.id)
          .map(li => ({
            ...li,
            documents: lineItemDocs.filter(d => d.grn_line_item_id === li.id)
          }))

        return {
          ...inv,
          supplier: inv.suppliers,
          dc,
          line_items: items,
        }
      })

      setInvoiceList(invoices)
    } catch (error) {
      console.error('Error fetching invoice list:', error)
      toast.error('Failed to load invoices')
    }
  }

  async function fetchLegacyGRNList() {
    try {
      const { data, error } = await supabase
        .from('material_grn')
        .select('*')
        .eq('site_id', selectedSiteId)
        .order('grn_date', { ascending: false })

      if (error) throw error

      // Fetch compliance docs for legacy GRNs
      const grnIds = (data || []).map(g => g.id)
      let complianceDocs: LegacyGRNComplianceDoc[] = []

      if (grnIds.length > 0) {
        const { data: docsData, error: docsError } = await supabase
          .from('grn_compliance_documents')
          .select('*')
          .in('grn_id', grnIds)

        if (docsError) console.error('Error fetching legacy compliance docs:', docsError)
        complianceDocs = docsData || []
      }

      const grnsWithDocs = (data || []).map(grn => ({
        ...grn,
        compliance_docs: complianceDocs.filter(d => d.grn_id === grn.id)
      }))

      setLegacyGrnList(grnsWithDocs)
    } catch (error) {
      console.error('Error fetching legacy GRN list:', error)
    }
  }

  function openCreateDialog() {
    setEditingInvoice(null)
    setInvoiceForm({
      supplier_id: '',
      supplier_name: '',
      invoice_number: '',
      grn_date: new Date().toISOString().split('T')[0],
      notes: '',
      dc_applicable: true,
    })
    setLineItems([createEmptyLineItem()])
    setInvoiceDialogOpen(true)
  }

  function openEditDialog(invoice: GRNInvoice) {
    setEditingInvoice(invoice)
    setInvoiceForm({
      supplier_id: invoice.supplier_id,
      supplier_name: invoice.supplier?.supplier_name || '',
      invoice_number: invoice.invoice_number,
      grn_date: invoice.grn_date,
      notes: invoice.notes || '',
      dc_applicable: invoice.dc?.is_applicable ?? true,
    })
    setLineItems(invoice.line_items.map(li => ({
      tempId: li.id,
      material_id: li.material_id,
      material_name: li.material_name,
      quantity: li.quantity.toString(),
      unit: li.unit,
      rate: li.rate.toString(),
      gst_rate: li.gst_rate.toString(),
      notes: li.notes || '',
    })))
    setInvoiceDialogOpen(true)
  }

  function createEmptyLineItem(): LineItemForm {
    return {
      tempId: `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      material_id: '',
      material_name: '',
      quantity: '',
      unit: '',
      rate: '',
      gst_rate: '18',
      notes: '',
    }
  }

  function addLineItem() {
    setLineItems([...lineItems, createEmptyLineItem()])
  }

  function removeLineItem(index: number) {
    if (lineItems.length === 1) {
      toast.error('At least one material is required')
      return
    }
    setLineItems(lineItems.filter((_, i) => i !== index))
  }

  function updateLineItem(index: number, field: keyof LineItemForm, value: string) {
    const updated = [...lineItems]
    updated[index] = { ...updated[index], [field]: value }
    setLineItems(updated)
  }

  function selectMaterialForLineItem(index: number, material: MasterMaterial) {
    const updated = [...lineItems]
    updated[index] = {
      ...updated[index],
      material_id: material.id,
      material_name: material.name,
      unit: material.unit,
    }
    setLineItems(updated)
    setMaterialSearchOpen(null)
    setMaterialSearchTerm('')
  }

  function selectSupplier(supplier: Supplier) {
    setInvoiceForm({
      ...invoiceForm,
      supplier_id: supplier.id,
      supplier_name: supplier.supplier_name,
    })
    setSupplierSearchOpen(false)
    setSupplierSearchTerm('')
  }

  function selectExistingInvoice(invoice: { invoice_number: string; supplier_id: string; supplier_name: string; grn_date: string }) {
    // Auto-fill supplier when selecting an existing invoice (for partial delivery)
    setInvoiceForm({
      ...invoiceForm,
      invoice_number: invoice.invoice_number,
      supplier_id: invoice.supplier_id,
      supplier_name: invoice.supplier_name,
    })
    setInvoiceSearchOpen(false)
    setInvoiceSearchTerm('')
  }

  function calculateLineItemTotal(item: LineItemForm): { withoutGst: number; withGst: number } {
    const qty = parseFloat(item.quantity) || 0
    const rate = parseFloat(item.rate) || 0
    const gstRate = parseFloat(item.gst_rate) || 0
    const withoutGst = qty * rate
    const withGst = withoutGst * (1 + gstRate / 100)
    return { withoutGst, withGst }
  }

  function calculateInvoiceTotal(): { withoutGst: number; withGst: number } {
    return lineItems.reduce(
      (acc, item) => {
        const { withoutGst, withGst } = calculateLineItemTotal(item)
        return {
          withoutGst: acc.withoutGst + withoutGst,
          withGst: acc.withGst + withGst,
        }
      },
      { withoutGst: 0, withGst: 0 }
    )
  }

  async function handleSaveInvoice() {
    // Validation
    if (!invoiceForm.supplier_id) {
      toast.error('Please select a supplier')
      return
    }
    if (!invoiceForm.invoice_number.trim()) {
      toast.error('Please enter an invoice number')
      return
    }
    if (!invoiceForm.grn_date) {
      toast.error('Please select a date')
      return
    }

    // Validate line items
    for (let i = 0; i < lineItems.length; i++) {
      const item = lineItems[i]
      if (!item.material_id) {
        toast.error(`Please select a material for line item ${i + 1}`)
        return
      }
      if (!item.quantity || parseFloat(item.quantity) <= 0) {
        toast.error(`Please enter a valid quantity for ${item.material_name}`)
        return
      }
      if (!item.rate || parseFloat(item.rate) <= 0) {
        toast.error(`Please enter a valid rate for ${item.material_name}`)
        return
      }
    }

    setSaving(true)
    try {
      // Check if this is a partial delivery (adding to existing invoice)
      const existingInvoice = existingInvoices.find(
        inv => inv.invoice_number === invoiceForm.invoice_number.trim()
      )
      const isPartialDelivery = !editingInvoice && existingInvoice

      if (editingInvoice) {
        // Update existing invoice (editing mode)
        const { error: updateError } = await supabase
          .from('grn_invoices')
          .update({
            supplier_id: invoiceForm.supplier_id,
            invoice_number: invoiceForm.invoice_number.trim(),
            grn_date: invoiceForm.grn_date,
            notes: invoiceForm.notes.trim() || null,
          })
          .eq('id', editingInvoice.id)

        if (updateError) throw updateError

        // Update DC applicability
        if (editingInvoice.dc) {
          await supabase
            .from('grn_invoice_dc')
            .update({ is_applicable: invoiceForm.dc_applicable })
            .eq('id', editingInvoice.dc.id)
        }

        // Delete existing line items and their documents
        await supabase
          .from('grn_line_items')
          .delete()
          .eq('grn_invoice_id', editingInvoice.id)

        // Insert new line items
        for (const item of lineItems) {
          const { data: newLineItem, error: lineError } = await supabase
            .from('grn_line_items')
            .insert({
              grn_invoice_id: editingInvoice.id,
              material_id: item.material_id,
              material_name: item.material_name,
              quantity: parseFloat(item.quantity),
              unit: item.unit,
              rate: parseFloat(item.rate),
              gst_rate: parseFloat(item.gst_rate),
              notes: item.notes.trim() || null,
            })
            .select()
            .single()

          if (lineError) throw lineError

          // Create compliance document placeholders for line item
          const docs = LINE_ITEM_DOC_TYPES.map(docType => ({
            grn_line_item_id: newLineItem.id,
            document_type: docType.value,
            is_applicable: true,
            is_uploaded: false,
          }))

          await supabase.from('grn_line_item_documents').insert(docs)
        }

        toast.success('Invoice updated successfully')
      } else {
        // Create new GRN entry (works for both new invoices and partial deliveries)
        // For partial delivery, invoice_number and supplier are pre-filled from existing
        // Create new invoice
        const { data: newInvoice, error: invoiceError } = await supabase
          .from('grn_invoices')
          .insert({
            site_id: selectedSiteId,
            supplier_id: invoiceForm.supplier_id,
            invoice_number: invoiceForm.invoice_number.trim(),
            grn_date: invoiceForm.grn_date,
            notes: invoiceForm.notes.trim() || null,
          })
          .select()
          .single()

        if (invoiceError) throw invoiceError

        // Create DC document placeholder
        await supabase.from('grn_invoice_dc').insert({
          grn_invoice_id: newInvoice.id,
          is_applicable: invoiceForm.dc_applicable,
          is_uploaded: false,
        })

        // Create line items
        for (const item of lineItems) {
          const { data: newLineItem, error: lineError } = await supabase
            .from('grn_line_items')
            .insert({
              grn_invoice_id: newInvoice.id,
              material_id: item.material_id,
              material_name: item.material_name,
              quantity: parseFloat(item.quantity),
              unit: item.unit,
              rate: parseFloat(item.rate),
              gst_rate: parseFloat(item.gst_rate),
              notes: item.notes.trim() || null,
            })
            .select()
            .single()

          if (lineError) throw lineError

          // Create compliance document placeholders for line item
          const docs = LINE_ITEM_DOC_TYPES.map(docType => ({
            grn_line_item_id: newLineItem.id,
            document_type: docType.value,
            is_applicable: true,
            is_uploaded: false,
          }))

          await supabase.from('grn_line_item_documents').insert(docs)
        }

        toast.success(isPartialDelivery ? 'GRN entry added (partial delivery)' : 'GRN entry created successfully')
      }

      setInvoiceDialogOpen(false)
      fetchInvoiceList()
      fetchExistingInvoiceNumbers()
    } catch (error: any) {
      console.error('Error saving invoice:', error)
      toast.error(error?.message || 'Failed to save invoice')
    } finally {
      setSaving(false)
    }
  }

  async function handleDeleteInvoice(invoice: GRNInvoice) {
    if (!confirm(`Delete invoice "${invoice.invoice_number}"? This will also delete all materials and compliance documents.`)) return

    try {
      // Delete DC file if exists
      if (invoice.dc?.file_path) {
        await supabase.storage.from('compliance-docs').remove([invoice.dc.file_path])
      }

      // Delete line item document files
      for (const lineItem of invoice.line_items) {
        for (const doc of lineItem.documents) {
          if (doc.file_path) {
            await supabase.storage.from('compliance-docs').remove([doc.file_path])
          }
        }
      }

      // Delete invoice (cascade will delete related records)
      const { error } = await supabase
        .from('grn_invoices')
        .delete()
        .eq('id', invoice.id)

      if (error) throw error
      toast.success('Invoice deleted')
      fetchInvoiceList()
    } catch (error) {
      console.error('Error deleting invoice:', error)
      toast.error('Failed to delete invoice')
    }
  }

  // DC Document functions
  function openDCDialog(invoice: GRNInvoice) {
    setSelectedInvoiceForDC(invoice)
    setDcDialogOpen(true)
  }

  async function toggleDCApplicable() {
    if (!selectedInvoiceForDC?.dc) return

    try {
      const { error } = await supabase
        .from('grn_invoice_dc')
        .update({ is_applicable: !selectedInvoiceForDC.dc.is_applicable })
        .eq('id', selectedInvoiceForDC.dc.id)

      if (error) throw error

      setSelectedInvoiceForDC({
        ...selectedInvoiceForDC,
        dc: {
          ...selectedInvoiceForDC.dc,
          is_applicable: !selectedInvoiceForDC.dc.is_applicable
        }
      })
      fetchInvoiceList()
    } catch (error) {
      console.error('Error toggling DC applicability:', error)
      toast.error('Failed to update')
    }
  }

  async function handleDCUpload(file: File) {
    if (!selectedInvoiceForDC?.dc) return

    setUploadingDoc('dc')
    try {
      const fileExt = file.name.split('.').pop()
      const fileName = `grn_invoice/${selectedInvoiceForDC.id}/dc_${Date.now()}.${fileExt}`

      const { error: uploadError } = await supabase.storage
        .from('compliance-docs')
        .upload(fileName, file, { upsert: true })

      if (uploadError) throw uploadError

      const { error } = await supabase
        .from('grn_invoice_dc')
        .update({
          file_path: fileName,
          file_name: file.name,
          is_uploaded: true,
          uploaded_at: new Date().toISOString(),
        })
        .eq('id', selectedInvoiceForDC.dc.id)

      if (error) throw error

      toast.success('DC uploaded successfully')
      setSelectedInvoiceForDC({
        ...selectedInvoiceForDC,
        dc: {
          ...selectedInvoiceForDC.dc,
          file_path: fileName,
          file_name: file.name,
          is_uploaded: true
        }
      })
      fetchInvoiceList()
    } catch (error: any) {
      console.error('Error uploading DC:', error)
      toast.error(error?.message || 'Failed to upload DC')
    } finally {
      setUploadingDoc(null)
    }
  }

  async function viewDocument(filePath: string) {
    try {
      const { data, error } = await supabase.storage
        .from('compliance-docs')
        .createSignedUrl(filePath, 3600)

      if (error) throw error
      window.open(data.signedUrl, '_blank')
    } catch (error) {
      console.error('Error viewing document:', error)
      toast.error('Failed to view document')
    }
  }

  async function deleteDCDocument() {
    if (!selectedInvoiceForDC?.dc) return
    if (!confirm('Delete this document?')) return

    try {
      if (selectedInvoiceForDC.dc.file_path) {
        await supabase.storage.from('compliance-docs').remove([selectedInvoiceForDC.dc.file_path])
      }

      const { error } = await supabase
        .from('grn_invoice_dc')
        .update({
          file_path: null,
          file_name: null,
          is_uploaded: false,
          uploaded_at: null,
        })
        .eq('id', selectedInvoiceForDC.dc.id)

      if (error) throw error
      toast.success('Document deleted')

      setSelectedInvoiceForDC({
        ...selectedInvoiceForDC,
        dc: {
          ...selectedInvoiceForDC.dc,
          file_path: null,
          file_name: null,
          is_uploaded: false
        }
      })
      fetchInvoiceList()
    } catch (error) {
      console.error('Error deleting document:', error)
      toast.error('Failed to delete document')
    }
  }

  // Line item document functions
  function openLineItemDocsDialog(invoice: GRNInvoice, lineItem: GRNLineItem) {
    setSelectedLineItemInvoice(invoice)
    setSelectedLineItem(lineItem)
    setLineItemDocsDialogOpen(true)
  }

  async function toggleLineItemDocApplicable(doc: LineItemDocument) {
    if (!selectedLineItem) return

    try {
      const { error } = await supabase
        .from('grn_line_item_documents')
        .update({ is_applicable: !doc.is_applicable })
        .eq('id', doc.id)

      if (error) throw error

      const updatedDocs = selectedLineItem.documents.map(d =>
        d.id === doc.id ? { ...d, is_applicable: !d.is_applicable } : d
      )
      setSelectedLineItem({ ...selectedLineItem, documents: updatedDocs })
      fetchInvoiceList()
    } catch (error) {
      console.error('Error toggling applicability:', error)
      toast.error('Failed to update')
    }
  }

  async function handleLineItemDocUpload(doc: LineItemDocument, file: File) {
    if (!selectedLineItem || !selectedLineItemInvoice) return

    setUploadingDoc(doc.document_type)
    try {
      const fileExt = file.name.split('.').pop()
      const fileName = `grn_line_item/${selectedLineItem.id}/${doc.document_type}_${Date.now()}.${fileExt}`

      const { error: uploadError } = await supabase.storage
        .from('compliance-docs')
        .upload(fileName, file, { upsert: true })

      if (uploadError) throw uploadError

      const { error } = await supabase
        .from('grn_line_item_documents')
        .update({
          file_path: fileName,
          file_name: file.name,
          is_uploaded: true,
          uploaded_at: new Date().toISOString(),
        })
        .eq('id', doc.id)

      if (error) throw error

      toast.success('Document uploaded successfully')

      const updatedDocs = selectedLineItem.documents.map(d =>
        d.id === doc.id ? { ...d, file_path: fileName, file_name: file.name, is_uploaded: true } : d
      )
      setSelectedLineItem({ ...selectedLineItem, documents: updatedDocs })
      fetchInvoiceList()
    } catch (error: any) {
      console.error('Error uploading document:', error)
      toast.error(error?.message || 'Failed to upload document')
    } finally {
      setUploadingDoc(null)
    }
  }

  async function deleteLineItemDocument(doc: LineItemDocument) {
    if (!selectedLineItem) return
    if (!confirm('Delete this document?')) return

    try {
      if (doc.file_path) {
        await supabase.storage.from('compliance-docs').remove([doc.file_path])
      }

      const { error } = await supabase
        .from('grn_line_item_documents')
        .update({
          file_path: null,
          file_name: null,
          is_uploaded: false,
          uploaded_at: null,
        })
        .eq('id', doc.id)

      if (error) throw error
      toast.success('Document deleted')

      const updatedDocs = selectedLineItem.documents.map(d =>
        d.id === doc.id ? { ...d, file_path: null, file_name: null, is_uploaded: false } : d
      )
      setSelectedLineItem({ ...selectedLineItem, documents: updatedDocs })
      fetchInvoiceList()
    } catch (error) {
      console.error('Error deleting document:', error)
      toast.error('Failed to delete document')
    }
  }

  // Legacy GRN compliance functions
  function openLegacyComplianceDialog(grn: LegacyMaterialGRN) {
    setSelectedLegacyGRN(grn)
    setLegacyComplianceDialogOpen(true)
  }

  async function toggleLegacyDocApplicable(doc: LegacyGRNComplianceDoc) {
    try {
      const { error } = await supabase
        .from('grn_compliance_documents')
        .update({ is_applicable: !doc.is_applicable })
        .eq('id', doc.id)

      if (error) throw error

      if (selectedLegacyGRN) {
        const updatedDocs = selectedLegacyGRN.compliance_docs.map(d =>
          d.id === doc.id ? { ...d, is_applicable: !d.is_applicable } : d
        )
        setSelectedLegacyGRN({ ...selectedLegacyGRN, compliance_docs: updatedDocs })
      }
      fetchLegacyGRNList()
    } catch (error) {
      console.error('Error toggling applicability:', error)
      toast.error('Failed to update')
    }
  }

  async function handleLegacyDocUpload(doc: LegacyGRNComplianceDoc, file: File) {
    setUploadingDoc(doc.document_type)

    try {
      const fileExt = file.name.split('.').pop()
      const fileName = `grn/${doc.grn_id}/${doc.document_type}_${Date.now()}.${fileExt}`

      const { error: uploadError } = await supabase.storage
        .from('compliance-docs')
        .upload(fileName, file, { upsert: true })

      if (uploadError) throw uploadError

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

      if (selectedLegacyGRN) {
        const updatedDocs = selectedLegacyGRN.compliance_docs.map(d =>
          d.id === doc.id ? { ...d, file_path: fileName, file_name: file.name, is_uploaded: true } : d
        )
        setSelectedLegacyGRN({ ...selectedLegacyGRN, compliance_docs: updatedDocs })
      }
      fetchLegacyGRNList()
    } catch (error: any) {
      console.error('Error uploading file:', error)
      toast.error(error?.message || 'Failed to upload document')
    } finally {
      setUploadingDoc(null)
    }
  }

  async function deleteLegacyDocument(doc: LegacyGRNComplianceDoc) {
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

      if (selectedLegacyGRN) {
        const updatedDocs = selectedLegacyGRN.compliance_docs.map(d =>
          d.id === doc.id ? { ...d, file_path: null, file_name: null, is_uploaded: false } : d
        )
        setSelectedLegacyGRN({ ...selectedLegacyGRN, compliance_docs: updatedDocs })
      }
      fetchLegacyGRNList()
    } catch (error) {
      console.error('Error deleting document:', error)
      toast.error('Failed to delete document')
    }
  }

  // Helper functions
  function getInvoiceComplianceStatus(invoice: GRNInvoice) {
    let total = 0
    let completed = 0
    let na = 0

    // DC document
    if (invoice.dc) {
      if (!invoice.dc.is_applicable) {
        na++
      } else {
        total++
        if (invoice.dc.is_uploaded) completed++
      }
    }

    // Line item documents
    invoice.line_items.forEach(li => {
      li.documents.forEach(doc => {
        if (!doc.is_applicable) {
          na++
        } else {
          total++
          if (doc.is_uploaded) completed++
        }
      })
    })

    return { total, completed, na }
  }

  function getLineItemComplianceStatus(lineItem: GRNLineItem) {
    const applicable = lineItem.documents.filter(d => d.is_applicable)
    const uploaded = lineItem.documents.filter(d => d.is_applicable && d.is_uploaded)
    const na = lineItem.documents.filter(d => !d.is_applicable)

    return {
      total: applicable.length,
      completed: uploaded.length,
      na: na.length
    }
  }

  function getLegacyComplianceStatus(grn: LegacyMaterialGRN) {
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

  function toggleInvoiceExpanded(invoiceId: string) {
    const newExpanded = new Set(expandedInvoices)
    if (newExpanded.has(invoiceId)) {
      newExpanded.delete(invoiceId)
    } else {
      newExpanded.add(invoiceId)
    }
    setExpandedInvoices(newExpanded)
  }

  // Group invoices by invoice_number for display (to show multiple GRN entries under same invoice)
  function getGroupedInvoices() {
    const groups: { [invoiceNumber: string]: GRNInvoice[] } = {}

    // Filter by selected supplier
    const filteredList = selectedSupplierFilter === 'all'
      ? invoiceList
      : invoiceList.filter(inv => inv.supplier_id === selectedSupplierFilter)

    filteredList.forEach(invoice => {
      if (!groups[invoice.invoice_number]) {
        groups[invoice.invoice_number] = []
      }
      groups[invoice.invoice_number].push(invoice)
    })

    // Sort GRN entries within each group by date (newest first)
    Object.keys(groups).forEach(key => {
      groups[key].sort((a, b) => new Date(b.grn_date).getTime() - new Date(a.grn_date).getTime())
    })

    return groups
  }

  // Get total compliance status for a group of invoices
  function getGroupComplianceStatus(invoices: GRNInvoice[]) {
    let total = 0
    let completed = 0
    let na = 0

    invoices.forEach(invoice => {
      const status = getInvoiceComplianceStatus(invoice)
      total += status.total
      completed += status.completed
      na += status.na
    })

    return { total, completed, na }
  }

  // Get total amount for a group of invoices
  function getGroupTotal(invoices: GRNInvoice[]) {
    return invoices.reduce((sum, invoice) => {
      return sum + invoice.line_items.reduce((lineSum, li) => lineSum + li.amount_with_gst, 0)
    }, 0)
  }

  // Get total item count for a group of invoices
  function getGroupItemCount(invoices: GRNInvoice[]) {
    return invoices.reduce((sum, invoice) => sum + invoice.line_items.length, 0)
  }

  // Export function
  function exportToExcel() {
    if (invoiceList.length === 0 && legacyGrnList.length === 0) {
      toast.error('No data to export')
      return
    }

    const siteName = sites.find(s => s.id === selectedSiteId)?.name || 'Unknown Site'

    // Prepare data for export - combining new and legacy
    const exportData: any[] = []
    let sno = 1

    // New invoice-based data
    invoiceList.forEach(invoice => {
      invoice.line_items.forEach(lineItem => {
        const dcStatus = invoice.dc
          ? (invoice.dc.is_applicable ? (invoice.dc.is_uploaded ? 'Y' : 'N') : 'NA')
          : 'N'

        const mirDoc = lineItem.documents.find(d => d.document_type === 'mir')
        const testDoc = lineItem.documents.find(d => d.document_type === 'test_certificate')
        const tdsDoc = lineItem.documents.find(d => d.document_type === 'tds')

        exportData.push({
          'S.No': sno++,
          'Date': new Date(invoice.grn_date).toLocaleDateString('en-IN'),
          'Supplier': invoice.supplier?.supplier_name || '',
          'Invoice No.': invoice.invoice_number,
          'Material': lineItem.material_name,
          'Quantity': lineItem.quantity,
          'Unit': lineItem.unit,
          'Rate': lineItem.rate,
          'GST %': lineItem.gst_rate,
          'Amount (Excl GST)': lineItem.amount_without_gst,
          'Amount (Incl GST)': lineItem.amount_with_gst,
          'DC': dcStatus,
          'MIR': mirDoc ? (mirDoc.is_applicable ? (mirDoc.is_uploaded ? 'Y' : 'N') : 'NA') : 'N',
          'Test Cert': testDoc ? (testDoc.is_applicable ? (testDoc.is_uploaded ? 'Y' : 'N') : 'NA') : 'N',
          'TDS': tdsDoc ? (tdsDoc.is_applicable ? (tdsDoc.is_uploaded ? 'Y' : 'N') : 'NA') : 'N',
          'Notes': lineItem.notes || '',
          'Type': 'New',
        })
      })
    })

    // Legacy data
    legacyGrnList.forEach(grn => {
      const getDocStatus = (docType: string) => {
        const doc = grn.compliance_docs.find(d => d.document_type === docType)
        if (!doc) return 'N'
        if (!doc.is_applicable) return 'NA'
        return doc.is_uploaded ? 'Y' : 'N'
      }

      exportData.push({
        'S.No': sno++,
        'Date': new Date(grn.grn_date).toLocaleDateString('en-IN'),
        'Supplier': grn.vendor_name,
        'Invoice No.': grn.invoice_number || '',
        'Material': grn.material_name,
        'Quantity': grn.quantity,
        'Unit': grn.unit,
        'Rate': '',
        'GST %': '',
        'Amount (Excl GST)': '',
        'Amount (Incl GST)': grn.invoice_amount || '',
        'DC': getDocStatus('dc'),
        'MIR': getDocStatus('mir'),
        'Test Cert': getDocStatus('test_certificate'),
        'TDS': getDocStatus('tds'),
        'Notes': grn.notes || '',
        'Type': 'Legacy',
      })
    })

    const wb = XLSX.utils.book_new()
    const ws = XLSX.utils.json_to_sheet(exportData)

    ws['!cols'] = [
      { wch: 6 },   // S.No
      { wch: 12 },  // Date
      { wch: 20 },  // Supplier
      { wch: 15 },  // Invoice No
      { wch: 30 },  // Material
      { wch: 10 },  // Quantity
      { wch: 8 },   // Unit
      { wch: 10 },  // Rate
      { wch: 8 },   // GST %
      { wch: 15 },  // Amount (Excl GST)
      { wch: 15 },  // Amount (Incl GST)
      { wch: 6 },   // DC
      { wch: 6 },   // MIR
      { wch: 10 }, // Test Cert
      { wch: 6 },   // TDS
      { wch: 30 },  // Notes
      { wch: 8 },   // Type
    ]

    XLSX.utils.book_append_sheet(wb, ws, 'GRN Report')

    const dateStr = new Date().toISOString().split('T')[0]
    const filename = `GRN_Report_${siteName.replace(/[^a-zA-Z0-9]/g, '_')}_${dateStr}.xlsx`

    XLSX.writeFile(wb, filename)
    toast.success('Report exported successfully')
  }

  // Filter materials for search
  const filteredMaterials = masterMaterials.filter(m =>
    m.name.toLowerCase().includes(materialSearchTerm.toLowerCase()) ||
    m.category.toLowerCase().includes(materialSearchTerm.toLowerCase())
  )

  // Filter suppliers for search
  const filteredSuppliers = suppliers.filter(s =>
    s.supplier_name.toLowerCase().includes(supplierSearchTerm.toLowerCase()) ||
    (s.gstin && s.gstin.toLowerCase().includes(supplierSearchTerm.toLowerCase()))
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
                  Record material deliveries by invoice with GST and compliance documents
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
                <Select value={selectedSupplierFilter} onValueChange={setSelectedSupplierFilter}>
                  <SelectTrigger className="w-full sm:w-[180px]">
                    <SelectValue placeholder="Filter by supplier" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Suppliers</SelectItem>
                    {suppliers.map((supplier) => (
                      <SelectItem key={supplier.id} value={supplier.id}>
                        {supplier.supplier_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  variant="outline"
                  onClick={exportToExcel}
                  disabled={!selectedSiteId || (invoiceList.length === 0 && legacyGrnList.length === 0)}
                  className="w-full sm:w-auto"
                >
                  <Download className="h-4 w-4 mr-2" />
                  Export Report
                </Button>
                <Button onClick={openCreateDialog} disabled={!selectedSiteId} className="w-full sm:w-auto">
                  <Plus className="h-4 w-4 mr-2" />
                  Add GRN
                </Button>
              </div>
            </div>
          </CardHeader>
        </Card>

        {/* Invoice List */}
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
        ) : invoiceList.length === 0 && legacyGrnList.length === 0 ? (
          <Card>
            <CardContent className="py-12">
              <div className="text-center">
                <Receipt className="h-12 w-12 mx-auto text-slate-300 mb-4" />
                <h3 className="text-lg font-medium text-slate-900 mb-2">No GRN Entries</h3>
                <p className="text-slate-500 mb-4">Start by adding your first GRN</p>
                <Button onClick={openCreateDialog}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add GRN
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : Object.keys(getGroupedInvoices()).length === 0 && selectedSupplierFilter !== 'all' ? (
          <Card>
            <CardContent className="py-12">
              <div className="text-center">
                <Receipt className="h-12 w-12 mx-auto text-slate-300 mb-4" />
                <h3 className="text-lg font-medium text-slate-900 mb-2">No GRN Entries for Selected Supplier</h3>
                <p className="text-slate-500 mb-4">
                  No entries found for {suppliers.find(s => s.id === selectedSupplierFilter)?.supplier_name || 'selected supplier'}
                </p>
                <Button variant="outline" onClick={() => setSelectedSupplierFilter('all')}>
                  Show All Suppliers
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {/* Invoice Groups - grouped by invoice number */}
            {invoiceList.length > 0 && (
              <div className="space-y-3">
                {Object.entries(getGroupedInvoices()).map(([invoiceNumber, invoices]) => {
                  const groupCompliance = getGroupComplianceStatus(invoices)
                  const isGroupComplete = groupCompliance.completed === groupCompliance.total && groupCompliance.total > 0
                  const groupTotal = getGroupTotal(invoices)
                  const groupItemCount = getGroupItemCount(invoices)
                  const supplier = invoices[0]?.supplier

                  return (
                    <Card key={invoiceNumber}>
                      <Collapsible
                        open={expandedInvoices.has(invoiceNumber)}
                        onOpenChange={() => toggleInvoiceExpanded(invoiceNumber)}
                      >
                        <CollapsibleTrigger asChild>
                          <CardHeader className="cursor-pointer hover:bg-slate-50 transition-colors py-3 px-4">
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex items-start gap-3 flex-1 min-w-0">
                                {expandedInvoices.has(invoiceNumber) ? (
                                  <ChevronDown className="h-4 w-4 text-slate-500 mt-1 shrink-0" />
                                ) : (
                                  <ChevronRight className="h-4 w-4 text-slate-500 mt-1 shrink-0" />
                                )}
                                <div className="flex-1 min-w-0">
                                  <div className="flex flex-wrap items-center gap-2 mb-1">
                                    <h3 className="font-medium text-sm">{invoiceNumber}</h3>
                                    <Badge variant="secondary" className="text-xs">
                                      {invoices.length} GRN{invoices.length !== 1 ? 's' : ''} • {groupItemCount} item{groupItemCount !== 1 ? 's' : ''}
                                    </Badge>
                                    <Badge
                                      variant="outline"
                                      className={cn(
                                        'text-xs',
                                        isGroupComplete
                                          ? 'border-green-200 bg-green-50 text-green-700'
                                          : 'border-amber-200 bg-amber-50 text-amber-700'
                                      )}
                                    >
                                      Docs: {groupCompliance.completed}/{groupCompliance.total}
                                    </Badge>
                                  </div>
                                  <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
                                    <span className="flex items-center gap-1">
                                      <Building2 className="h-3 w-3" />
                                      {supplier?.supplier_name}
                                    </span>
                                    <span className="font-medium text-slate-700">
                                      Total: ₹{groupTotal.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                                    </span>
                                  </div>
                                </div>
                              </div>
                              {/* DC Button at Invoice level */}
                              <div className="flex gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => openDCDialog(invoices[0])}
                                  className={cn(
                                    'h-8 text-xs',
                                    invoices[0]?.dc?.is_uploaded
                                      ? 'border-green-200 bg-green-50 text-green-700'
                                      : invoices[0]?.dc?.is_applicable === false
                                        ? 'border-slate-200 bg-slate-50 text-slate-500'
                                        : 'border-amber-200 bg-amber-50 text-amber-700'
                                  )}
                                  title="Delivery Challan"
                                >
                                  <FileText className="h-3.5 w-3.5 mr-1" />
                                  DC {invoices[0]?.dc?.is_uploaded ? '✓' : invoices[0]?.dc?.is_applicable === false ? 'NA' : ''}
                                </Button>
                              </div>
                            </div>
                          </CardHeader>
                        </CollapsibleTrigger>

                        <CollapsibleContent>
                          <CardContent className="pt-0 px-4 pb-4">
                            <div className="space-y-4">
                              {/* GRN Entries for this invoice */}
                              {invoices.map((invoice) => {
                                const compliance = getInvoiceComplianceStatus(invoice)
                                const isComplete = compliance.completed === compliance.total && compliance.total > 0
                                const invoiceTotal = invoice.line_items.reduce((sum, li) => sum + li.amount_with_gst, 0)

                                return (
                                  <div key={invoice.id} className="border rounded-lg overflow-hidden">
                                    {/* GRN Entry Header */}
                                    <div className="bg-slate-100 px-3 py-2 flex items-center justify-between">
                                      <div className="flex items-center gap-3">
                                        <span className="text-xs font-medium text-slate-600 flex items-center gap-1">
                                          <Calendar className="h-3 w-3" />
                                          GRN: {new Date(invoice.grn_date).toLocaleDateString('en-IN')}
                                        </span>
                                        <Badge variant="secondary" className="text-xs">
                                          {invoice.line_items.length} item{invoice.line_items.length !== 1 ? 's' : ''}
                                        </Badge>
                                        <Badge
                                          variant="outline"
                                          className={cn(
                                            'text-xs',
                                            isComplete
                                              ? 'border-green-200 bg-green-50 text-green-700'
                                              : 'border-amber-200 bg-amber-50 text-amber-700'
                                          )}
                                        >
                                          Docs: {compliance.completed}/{compliance.total}
                                        </Badge>
                                        <span className="text-xs font-medium text-slate-700">
                                          ₹{invoiceTotal.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                                        </span>
                                      </div>
                                      <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          onClick={() => openEditDialog(invoice)}
                                          className="h-7 w-7 p-0"
                                          title="Edit GRN"
                                        >
                                          <Pencil className="h-3.5 w-3.5" />
                                        </Button>
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          onClick={() => handleDeleteInvoice(invoice)}
                                          className="text-red-600 h-7 w-7 p-0"
                                          title="Delete GRN"
                                        >
                                          <Trash2 className="h-3.5 w-3.5" />
                                        </Button>
                                      </div>
                                    </div>

                                    {/* Materials for this GRN entry */}
                                    <div className="p-2 space-y-2">
                                      {invoice.line_items.map((lineItem) => {
                                        const liCompliance = getLineItemComplianceStatus(lineItem)
                                        const liComplete = liCompliance.completed === liCompliance.total && liCompliance.total > 0

                                        return (
                                          <div
                                            key={lineItem.id}
                                            className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-2 bg-slate-50 rounded"
                                          >
                                            <div className="flex-1 min-w-0">
                                              <h4 className="font-medium text-sm truncate">
                                                {lineItem.material_name}
                                              </h4>
                                              <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 mt-1">
                                                <span>{lineItem.quantity} {lineItem.unit}</span>
                                                <span>@ ₹{lineItem.rate.toLocaleString('en-IN')}</span>
                                                <span>GST: {lineItem.gst_rate}%</span>
                                                <span className="font-medium text-slate-700">
                                                  ₹{lineItem.amount_with_gst.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                                                </span>
                                              </div>
                                            </div>
                                            <Button
                                              variant="outline"
                                              size="sm"
                                              onClick={() => openLineItemDocsDialog(invoice, lineItem)}
                                              className={cn(
                                                'text-xs shrink-0',
                                                liComplete
                                                  ? 'border-green-200 bg-green-50 text-green-700'
                                                  : 'border-amber-200 bg-amber-50 text-amber-700'
                                              )}
                                            >
                                              <FileText className="h-3 w-3 mr-1" />
                                              {liCompliance.completed}/{liCompliance.total}
                                              {liCompliance.na > 0 && ` (${liCompliance.na} NA)`}
                                            </Button>
                                          </div>
                                        )
                                      })}
                                    </div>
                                  </div>
                                )
                              })}
                            </div>
                          </CardContent>
                        </CollapsibleContent>
                      </Collapsible>
                    </Card>
                  )
                })}
              </div>
            )}

            {/* Legacy GRN Entries - only show when All Suppliers is selected */}
            {legacyGrnList.length > 0 && selectedSupplierFilter === 'all' && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-medium text-slate-700">
                    Legacy Entries ({legacyGrnList.length})
                  </h3>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowLegacy(!showLegacy)}
                    className="text-xs"
                  >
                    {showLegacy ? 'Hide' : 'Show'} Legacy
                    {showLegacy ? <ChevronDown className="ml-1 h-3 w-3" /> : <ChevronRight className="ml-1 h-3 w-3" />}
                  </Button>
                </div>

                {showLegacy && (
                  <div className="space-y-2">
                    {legacyGrnList.map((grn) => {
                      const compliance = getLegacyComplianceStatus(grn)
                      const isComplete = compliance.completed === compliance.total && compliance.total > 0

                      return (
                        <Card key={grn.id} className="border-dashed">
                          <CardContent className="p-4">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                  <h3 className="font-medium text-sm truncate">{grn.material_name}</h3>
                                  <Badge variant="outline" className="text-xs">Legacy</Badge>
                                </div>
                                <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
                                  <span>{grn.vendor_name}</span>
                                  <span className="flex items-center gap-1">
                                    <Calendar className="h-3 w-3" />
                                    {new Date(grn.grn_date).toLocaleDateString('en-IN')}
                                  </span>
                                  <span>{grn.quantity} {grn.unit}</span>
                                  {grn.invoice_amount && (
                                    <span>₹{grn.invoice_amount.toLocaleString('en-IN')}</span>
                                  )}
                                </div>
                              </div>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => openLegacyComplianceDialog(grn)}
                                className={cn(
                                  'text-xs shrink-0',
                                  isComplete
                                    ? 'border-green-200 bg-green-50 text-green-700'
                                    : 'border-amber-200 bg-amber-50 text-amber-700'
                                )}
                              >
                                <FileText className="h-3 w-3 mr-1" />
                                {compliance.completed}/{compliance.total}
                                {compliance.na > 0 && ` (${compliance.na} NA)`}
                              </Button>
                            </div>
                          </CardContent>
                        </Card>
                      )
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Invoice Dialog */}
      <Dialog open={invoiceDialogOpen} onOpenChange={setInvoiceDialogOpen}>
        <DialogContent className="w-[calc(100vw-2rem)] max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingInvoice ? 'Edit Invoice' : 'Add New Invoice'}</DialogTitle>
            <DialogDescription>
              {editingInvoice ? 'Update the invoice details and materials' : 'Record a new material delivery with multiple items'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-4">
            {/* Invoice Header Section */}
            <div className="space-y-4">
              <h4 className="font-medium text-sm text-slate-700 border-b pb-2">Invoice Details</h4>

              {/* Supplier Selection */}
              <div className="space-y-2">
                <Label>Supplier *</Label>
                <Popover open={supplierSearchOpen} onOpenChange={setSupplierSearchOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      aria-expanded={supplierSearchOpen}
                      className="w-full justify-between"
                    >
                      {invoiceForm.supplier_name || 'Select supplier...'}
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[calc(100vw-4rem)] sm:w-[400px] p-0">
                    <Command>
                      <CommandInput
                        placeholder="Search suppliers..."
                        value={supplierSearchTerm}
                        onValueChange={setSupplierSearchTerm}
                      />
                      <CommandList>
                        <CommandEmpty>No supplier found.</CommandEmpty>
                        <CommandGroup className="max-h-[300px] overflow-y-auto">
                          {filteredSuppliers.map((supplier) => (
                            <CommandItem
                              key={supplier.id}
                              value={supplier.supplier_name}
                              onSelect={() => selectSupplier(supplier)}
                            >
                              <Check
                                className={cn(
                                  'mr-2 h-4 w-4',
                                  invoiceForm.supplier_id === supplier.id ? 'opacity-100' : 'opacity-0'
                                )}
                              />
                              <div className="flex-1">
                                <p>{supplier.supplier_name}</p>
                                {supplier.gstin && (
                                  <p className="text-xs text-slate-500">GSTIN: {supplier.gstin}</p>
                                )}
                              </div>
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>

              {/* Invoice Number and Date */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Invoice No. *</Label>
                  <Popover open={invoiceSearchOpen} onOpenChange={setInvoiceSearchOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        role="combobox"
                        aria-expanded={invoiceSearchOpen}
                        className="w-full justify-between font-normal"
                      >
                        {invoiceForm.invoice_number || 'Enter or select invoice...'}
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[calc(100vw-4rem)] sm:w-[300px] p-0">
                      <Command>
                        <CommandInput
                          placeholder="Type new or search existing..."
                          value={invoiceSearchTerm}
                          onValueChange={(value) => {
                            setInvoiceSearchTerm(value)
                            setInvoiceForm({ ...invoiceForm, invoice_number: value })
                          }}
                        />
                        <CommandList>
                          <CommandEmpty>
                            {invoiceSearchTerm ? (
                              <div className="p-2 text-sm">
                                <p className="text-slate-500">New invoice: <strong>{invoiceSearchTerm}</strong></p>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="mt-1 w-full justify-start"
                                  onClick={() => {
                                    setInvoiceForm({ ...invoiceForm, invoice_number: invoiceSearchTerm })
                                    setInvoiceSearchOpen(false)
                                  }}
                                >
                                  <Plus className="h-4 w-4 mr-2" />
                                  Use "{invoiceSearchTerm}"
                                </Button>
                              </div>
                            ) : (
                              <p className="text-slate-500">Type an invoice number</p>
                            )}
                          </CommandEmpty>
                          {existingInvoices.length > 0 && (
                            <CommandGroup heading="Existing Invoices (for partial delivery)">
                              {existingInvoices
                                .filter(inv =>
                                  inv.invoice_number.toLowerCase().includes(invoiceSearchTerm.toLowerCase()) ||
                                  inv.supplier_name.toLowerCase().includes(invoiceSearchTerm.toLowerCase())
                                )
                                .map((invoice) => (
                                  <CommandItem
                                    key={invoice.invoice_number}
                                    value={invoice.invoice_number}
                                    onSelect={() => selectExistingInvoice(invoice)}
                                  >
                                    <Check
                                      className={cn(
                                        'mr-2 h-4 w-4',
                                        invoiceForm.invoice_number === invoice.invoice_number ? 'opacity-100' : 'opacity-0'
                                      )}
                                    />
                                    <div className="flex-1">
                                      <p className="font-medium">{invoice.invoice_number}</p>
                                      <p className="text-xs text-slate-500">
                                        {invoice.supplier_name} | {new Date(invoice.grn_date).toLocaleDateString('en-IN')}
                                      </p>
                                    </div>
                                  </CommandItem>
                                ))}
                            </CommandGroup>
                          )}
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                  {invoiceForm.invoice_number && existingInvoices.some(inv => inv.invoice_number === invoiceForm.invoice_number) && (
                    <p className="text-xs text-blue-600">
                      Adding new GRN entry for existing invoice (partial delivery)
                    </p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="grn_date">GRN Date *</Label>
                  <Input
                    id="grn_date"
                    type="date"
                    value={invoiceForm.grn_date}
                    onChange={(e) => setInvoiceForm({ ...invoiceForm, grn_date: e.target.value })}
                  />
                </div>
              </div>

              {/* DC Applicable checkbox */}
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="dc_applicable"
                  checked={invoiceForm.dc_applicable}
                  onChange={(e) => setInvoiceForm({ ...invoiceForm, dc_applicable: e.target.checked })}
                  className="h-4 w-4 rounded border-gray-300"
                />
                <Label htmlFor="dc_applicable" className="text-sm">DC (Delivery Challan) Required</Label>
              </div>
            </div>

            {/* Line Items Section */}
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b pb-2">
                <h4 className="font-medium text-sm text-slate-700">Materials</h4>
                <Button type="button" variant="outline" size="sm" onClick={addLineItem}>
                  <Plus className="h-4 w-4 mr-1" />
                  Add Material
                </Button>
              </div>

              <div className="space-y-4">
                {lineItems.map((item, index) => {
                  const { withoutGst, withGst } = calculateLineItemTotal(item)

                  return (
                    <div key={item.tempId} className="border rounded-lg p-4 space-y-3 bg-slate-50">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-slate-500">Item #{index + 1}</span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => removeLineItem(index)}
                          className="h-6 w-6 p-0 text-red-600"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>

                      {/* Material Selection */}
                      <div className="space-y-2">
                        <Label>Material *</Label>
                        <Popover
                          open={materialSearchOpen === index}
                          onOpenChange={(open) => setMaterialSearchOpen(open ? index : null)}
                        >
                          <PopoverTrigger asChild>
                            <Button
                              variant="outline"
                              role="combobox"
                              className="w-full justify-between"
                            >
                              {item.material_name || 'Select material...'}
                              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-[calc(100vw-6rem)] sm:w-[350px] p-0">
                            <Command>
                              <CommandInput
                                placeholder="Search materials..."
                                value={materialSearchTerm}
                                onValueChange={setMaterialSearchTerm}
                              />
                              <CommandList>
                                <CommandEmpty>No material found.</CommandEmpty>
                                <CommandGroup className="max-h-[200px] overflow-y-auto">
                                  {filteredMaterials.map((material) => (
                                    <CommandItem
                                      key={material.id}
                                      value={material.name}
                                      onSelect={() => selectMaterialForLineItem(index, material)}
                                    >
                                      <Check
                                        className={cn(
                                          'mr-2 h-4 w-4',
                                          item.material_id === material.id ? 'opacity-100' : 'opacity-0'
                                        )}
                                      />
                                      <div className="flex-1">
                                        <p className="text-sm">{material.name}</p>
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

                      {/* Qty, Unit, Rate, GST */}
                      <div className="grid grid-cols-4 gap-2">
                        <div className="space-y-1">
                          <Label className="text-xs">Qty *</Label>
                          <Input
                            type="number"
                            step="0.001"
                            placeholder="0"
                            value={item.quantity}
                            onChange={(e) => updateLineItem(index, 'quantity', e.target.value)}
                            className="h-9"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Unit</Label>
                          <Input
                            value={item.unit}
                            onChange={(e) => updateLineItem(index, 'unit', e.target.value)}
                            placeholder="nos"
                            className="h-9"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Rate *</Label>
                          <Input
                            type="number"
                            step="0.01"
                            placeholder="0.00"
                            value={item.rate}
                            onChange={(e) => updateLineItem(index, 'rate', e.target.value)}
                            className="h-9"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">GST</Label>
                          <Select
                            value={item.gst_rate}
                            onValueChange={(value) => updateLineItem(index, 'gst_rate', value)}
                          >
                            <SelectTrigger className="h-9">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {GST_RATES.map((rate) => (
                                <SelectItem key={rate.value} value={rate.value}>
                                  {rate.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      {/* Calculated amounts */}
                      {item.quantity && item.rate && (
                        <div className="flex justify-end gap-4 text-xs text-slate-600">
                          <span>Excl GST: ₹{withoutGst.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</span>
                          <span className="font-medium text-slate-800">
                            Incl GST: ₹{withGst.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                          </span>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>

              {/* Invoice Total */}
              {lineItems.some(item => item.quantity && item.rate) && (
                <div className="flex justify-end pt-2 border-t">
                  <div className="text-right">
                    <div className="text-sm text-slate-600">
                      Invoice Total (Excl GST): ₹{calculateInvoiceTotal().withoutGst.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                    </div>
                    <div className="text-lg font-bold text-slate-900">
                      Invoice Total (Incl GST): ₹{calculateInvoiceTotal().withGst.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Notes */}
            <div className="space-y-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                placeholder="Additional notes..."
                value={invoiceForm.notes}
                onChange={(e) => setInvoiceForm({ ...invoiceForm, notes: e.target.value })}
                rows={2}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setInvoiceDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveInvoice} disabled={saving}>
              {saving ? 'Saving...' : editingInvoice ? 'Update' : 'Save Invoice'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* DC Document Dialog */}
      <Dialog open={dcDialogOpen} onOpenChange={setDcDialogOpen}>
        <DialogContent className="w-[calc(100vw-2rem)] max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Delivery Challan (DC)
            </DialogTitle>
            <DialogDescription>
              {selectedInvoiceForDC && (
                <>
                  Invoice: <strong>{selectedInvoiceForDC.invoice_number}</strong>
                  <br />
                  <span className="text-xs">
                    {selectedInvoiceForDC.supplier?.supplier_name} | {new Date(selectedInvoiceForDC.grn_date).toLocaleDateString('en-IN')}
                  </span>
                </>
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="py-4">
            {selectedInvoiceForDC?.dc && (
              <div
                className={cn(
                  'border rounded-lg p-4',
                  !selectedInvoiceForDC.dc.is_applicable
                    ? 'bg-slate-50'
                    : selectedInvoiceForDC.dc.is_uploaded
                      ? 'bg-green-50'
                      : 'bg-white'
                )}
              >
                <div className="flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-medium">Delivery Challan</h4>
                      {!selectedInvoiceForDC.dc.is_applicable ? (
                        <p className="text-xs text-slate-500 flex items-center gap-1 mt-1">
                          <Ban className="h-3 w-3" />
                          Not Applicable
                        </p>
                      ) : selectedInvoiceForDC.dc.is_uploaded ? (
                        <div className="flex items-center gap-1 text-xs mt-1">
                          <FileCheck className="h-3 w-3 text-green-600" />
                          <button
                            onClick={() => viewDocument(selectedInvoiceForDC.dc!.file_path!)}
                            className="text-blue-600 hover:underline truncate max-w-[200px]"
                          >
                            {selectedInvoiceForDC.dc.file_name}
                          </button>
                        </div>
                      ) : (
                        <p className="text-xs text-amber-600 flex items-center gap-1 mt-1">
                          <AlertCircle className="h-3 w-3" />
                          Pending Upload
                        </p>
                      )}
                    </div>

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={toggleDCApplicable}
                      className={cn(
                        'text-xs',
                        !selectedInvoiceForDC.dc.is_applicable ? 'text-green-600' : 'text-slate-600'
                      )}
                    >
                      {!selectedInvoiceForDC.dc.is_applicable ? 'Required' : 'NA'}
                    </Button>
                  </div>

                  {selectedInvoiceForDC.dc.is_applicable && (
                    <div className="flex gap-2 flex-wrap">
                      {selectedInvoiceForDC.dc.is_uploaded ? (
                        <>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => viewDocument(selectedInvoiceForDC.dc!.file_path!)}
                          >
                            <Eye className="h-4 w-4 mr-1" />
                            View
                          </Button>
                          <label>
                            <input
                              type="file"
                              className="hidden"
                              accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg"
                              onChange={(e) => {
                                const file = e.target.files?.[0]
                                if (file) handleDCUpload(file)
                                e.target.value = ''
                              }}
                            />
                            <Button variant="outline" size="sm" asChild>
                              <span className="cursor-pointer">
                                <Upload className="h-4 w-4 mr-1" />
                                Replace
                              </span>
                            </Button>
                          </label>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={deleteDCDocument}
                            className="text-red-600"
                          >
                            <Trash2 className="h-4 w-4 mr-1" />
                            Delete
                          </Button>
                        </>
                      ) : (
                        <>
                          <label className="flex-1">
                            <input
                              type="file"
                              className="hidden"
                              accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg"
                              onChange={(e) => {
                                const file = e.target.files?.[0]
                                if (file) handleDCUpload(file)
                                e.target.value = ''
                              }}
                              disabled={uploadingDoc === 'dc'}
                            />
                            <Button
                              variant="default"
                              size="sm"
                              asChild
                              className="w-full"
                              disabled={uploadingDoc === 'dc'}
                            >
                              <span className="cursor-pointer">
                                {uploadingDoc === 'dc' ? 'Uploading...' : (
                                  <>
                                    <Upload className="h-4 w-4 mr-1" />
                                    Upload DC
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
                                if (file) handleDCUpload(file)
                                e.target.value = ''
                              }}
                              disabled={uploadingDoc === 'dc'}
                            />
                            <Button variant="outline" size="sm" asChild disabled={uploadingDoc === 'dc'}>
                              <span className="cursor-pointer">
                                <Camera className="h-4 w-4" />
                              </span>
                            </Button>
                          </label>
                        </>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDcDialogOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Line Item Documents Dialog */}
      <Dialog open={lineItemDocsDialogOpen} onOpenChange={setLineItemDocsDialogOpen}>
        <DialogContent className="w-[calc(100vw-2rem)] max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Compliance Documents
            </DialogTitle>
            <DialogDescription>
              {selectedLineItem && (
                <>
                  Material: <strong>{selectedLineItem.material_name}</strong>
                  <br />
                  <span className="text-xs">
                    {selectedLineItemInvoice?.invoice_number} | {selectedLineItem.quantity} {selectedLineItem.unit}
                  </span>
                </>
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-4">
            {LINE_ITEM_DOC_TYPES.map((docType) => {
              const doc = selectedLineItem?.documents.find(d => d.document_type === docType.value)
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
                            onClick={() => viewDocument(doc.file_path!)}
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
                          onClick={() => toggleLineItemDocApplicable(doc)}
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
                                onClick={() => viewDocument(doc.file_path!)}
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
                                    if (file) handleLineItemDocUpload(doc, file)
                                    e.target.value = ''
                                  }}
                                />
                                <Button variant="outline" size="sm" asChild className="h-8">
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
                                    if (file) handleLineItemDocUpload(doc, file)
                                    e.target.value = ''
                                  }}
                                />
                                <Button variant="outline" size="sm" asChild className="h-8">
                                  <span className="cursor-pointer">
                                    <Camera className="h-4 w-4" />
                                  </span>
                                </Button>
                              </label>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => deleteLineItemDocument(doc)}
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
                                    if (file) handleLineItemDocUpload(doc, file)
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
                                    {uploadingDoc === docType.value ? 'Uploading...' : (
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
                                    if (file) handleLineItemDocUpload(doc, file)
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
            <Button variant="outline" onClick={() => setLineItemDocsDialogOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Legacy Compliance Documents Dialog */}
      <Dialog open={legacyComplianceDialogOpen} onOpenChange={setLegacyComplianceDialogOpen}>
        <DialogContent className="w-[calc(100vw-2rem)] max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Compliance Documents (Legacy)
            </DialogTitle>
            <DialogDescription>
              {selectedLegacyGRN && (
                <>
                  Material: <strong>{selectedLegacyGRN.material_name}</strong>
                  <br />
                  <span className="text-xs">
                    {selectedLegacyGRN.vendor_name} | {new Date(selectedLegacyGRN.grn_date).toLocaleDateString('en-IN')}
                  </span>
                </>
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-4">
            {LEGACY_COMPLIANCE_DOC_TYPES.map((docType) => {
              const doc = selectedLegacyGRN?.compliance_docs.find(d => d.document_type === docType.value)
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
                            onClick={() => viewDocument(doc.file_path!)}
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
                          onClick={() => toggleLegacyDocApplicable(doc)}
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
                                onClick={() => viewDocument(doc.file_path!)}
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
                                    if (file) handleLegacyDocUpload(doc, file)
                                    e.target.value = ''
                                  }}
                                />
                                <Button variant="outline" size="sm" asChild className="h-8">
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
                                    if (file) handleLegacyDocUpload(doc, file)
                                    e.target.value = ''
                                  }}
                                />
                                <Button variant="outline" size="sm" asChild className="h-8">
                                  <span className="cursor-pointer">
                                    <Camera className="h-4 w-4" />
                                  </span>
                                </Button>
                              </label>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => deleteLegacyDocument(doc)}
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
                                    if (file) handleLegacyDocUpload(doc, file)
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
                                    {uploadingDoc === docType.value ? 'Uploading...' : (
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
                                    if (file) handleLegacyDocUpload(doc, file)
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
            <Button variant="outline" onClick={() => setLegacyComplianceDialogOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
