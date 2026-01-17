'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Header } from '@/components/layout/header'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Checkbox } from '@/components/ui/checkbox'
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs'
import {
  ArrowLeft,
  FileSpreadsheet,
  Plus,
  MoreHorizontal,
  Pencil,
  Trash2,
  Package,
  Building2,
  PackageOpen,
  ChevronDown,
  ChevronRight,
  Truck,
  Eye,
  Calendar,
  ClipboardCheck,
  ClipboardList,
  CheckCircle2,
  Circle,
  Clock,
  FileText,
  Upload,
  Download,
  X,
  AlertCircle,
  FileCheck,
  Ban,
} from 'lucide-react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'
import BOQChecklistsTab from '@/components/boq/boq-checklists-tab'

interface BOQHeadline {
  id: string
  package_id: string
  serial_number: number
  name: string
  description: string | null
  status: string
  packages: {
    id: string
    name: string
    sites: {
      id: string
      name: string
    }
  }
}

interface BOQLineItem {
  id: string
  headline_id: string
  item_number: string
  description: string
  location: string | null
  unit: string
  quantity: number
  status: string
}

interface Material {
  id: string
  line_item_id: string
  name: string
  material_type: string | null
  unit: string
  required_quantity: number | null
  created_at: string
}

interface MaterialReceipt {
  id: string
  material_id: string
  invoice_number: string | null
  receipt_date: string
  quantity_received: number
  vendor_name: string | null
  notes: string | null
}

interface Checklist {
  id: string
  headline_id: string
  name: string
  created_at: string
}

interface ChecklistItem {
  id: string
  checklist_id: string
  activity_name: string
  sort_order: number | null
  status: string
  completed_at: string | null
  completed_by: string | null
  notes: string | null
}

interface ChecklistWithItems extends Checklist {
  items: ChecklistItem[]
}

interface ComplianceDocument {
  id: string
  material_id: string
  document_type: 'dc' | 'mir' | 'test_certificate' | 'tds'
  file_path: string | null
  file_name: string | null
  is_applicable: boolean
  is_uploaded: boolean
  uploaded_at: string | null
  notes: string | null
}

const COMPLIANCE_DOC_TYPES = [
  { value: 'dc', label: 'DC', fullName: 'Delivery Challan/Eway Bill/Invoice' },
  { value: 'mir', label: 'MIR', fullName: 'Material Inspection Report' },
  { value: 'test_certificate', label: 'Test Cert', fullName: 'Test Certificate' },
  { value: 'tds', label: 'TDS', fullName: 'Technical Data Sheet' },
] as const

interface MaterialWithReceipts extends Material {
  receipts: MaterialReceipt[]
  total_received: number
  compliance_docs: ComplianceDocument[]
}

interface LineItemWithMaterials extends BOQLineItem {
  materials: MaterialWithReceipts[]
}

const emptyLineItem = {
  item_number: '',
  description: '',
  location: '',
  unit: 'cum',
  quantity: 0,
}

const emptyMaterial = {
  name: '',
  material_type: 'direct',
  unit: 'bags',
  required_quantity: 0,
}

const emptyReceipt = {
  invoice_number: '',
  receipt_date: new Date().toISOString().split('T')[0],
  quantity_received: 0,
  vendor_name: '',
  notes: '',
}

const emptyChecklist = {
  name: '',
}

const emptyChecklistItem = {
  activity_name: '',
  notes: '',
}

export default function BOQDetailPage() {
  const params = useParams()
  const router = useRouter()
  const headlineId = params.id as string

  const [headline, setHeadline] = useState<BOQHeadline | null>(null)
  const [lineItemsWithMaterials, setLineItemsWithMaterials] = useState<LineItemWithMaterials[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set())

  // Line Item Dialog
  const [lineItemDialogOpen, setLineItemDialogOpen] = useState(false)
  const [editingLineItem, setEditingLineItem] = useState<BOQLineItem | null>(null)
  const [lineItemFormData, setLineItemFormData] = useState(emptyLineItem)

  // Material Dialog
  const [materialDialogOpen, setMaterialDialogOpen] = useState(false)
  const [editingMaterial, setEditingMaterial] = useState<Material | null>(null)
  const [materialFormData, setMaterialFormData] = useState(emptyMaterial)
  const [selectedLineItemId, setSelectedLineItemId] = useState<string>('')

  // Receipt Dialog
  const [receiptDialogOpen, setReceiptDialogOpen] = useState(false)
  const [editingReceipt, setEditingReceipt] = useState<MaterialReceipt | null>(null)
  const [receiptFormData, setReceiptFormData] = useState(emptyReceipt)
  const [selectedMaterialId, setSelectedMaterialId] = useState<string>('')

  // Checklist State
  const [checklists, setChecklists] = useState<ChecklistWithItems[]>([])
  const [expandedChecklists, setExpandedChecklists] = useState<Set<string>>(new Set())

  // Checklist Dialog
  const [checklistDialogOpen, setChecklistDialogOpen] = useState(false)
  const [editingChecklist, setEditingChecklist] = useState<Checklist | null>(null)
  const [checklistFormData, setChecklistFormData] = useState(emptyChecklist)

  // Checklist Item Dialog
  const [checklistItemDialogOpen, setChecklistItemDialogOpen] = useState(false)
  const [editingChecklistItem, setEditingChecklistItem] = useState<ChecklistItem | null>(null)
  const [checklistItemFormData, setChecklistItemFormData] = useState(emptyChecklistItem)
  const [selectedChecklistId, setSelectedChecklistId] = useState<string>('')

  // Compliance Document State
  const [complianceDialogOpen, setComplianceDialogOpen] = useState(false)
  const [selectedMaterialForCompliance, setSelectedMaterialForCompliance] = useState<MaterialWithReceipts | null>(null)
  const [uploadingDoc, setUploadingDoc] = useState<string | null>(null) // document_type being uploaded

  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetchData()
  }, [headlineId])

  async function fetchData() {
    try {
      // Fetch headline
      const { data: headlineData, error: headlineError } = await supabase
        .from('boq_headlines')
        .select(`
          *,
          packages (
            id,
            name,
            sites (
              id,
              name
            )
          )
        `)
        .eq('id', headlineId)
        .single()

      if (headlineError) throw headlineError
      setHeadline(headlineData)

      // Fetch line items
      const { data: lineItemsData, error: lineItemsError } = await supabase
        .from('boq_line_items')
        .select('*')
        .eq('headline_id', headlineId)
        .order('item_number')

      if (lineItemsError) throw lineItemsError

      // Fetch materials for all line items
      const lineItemIds = lineItemsData?.map(li => li.id) || []

      if (lineItemIds.length > 0) {
        const { data: materialsData } = await supabase
          .from('materials')
          .select('*')
          .in('line_item_id', lineItemIds)

        const materialIds = materialsData?.map(m => m.id) || []

        // Fetch receipts for all materials
        let receiptsData: MaterialReceipt[] = []
        let complianceDocsData: ComplianceDocument[] = []
        if (materialIds.length > 0) {
          const [receiptsResult, complianceResult] = await Promise.all([
            supabase
              .from('material_receipts')
              .select('*')
              .in('material_id', materialIds)
              .order('receipt_date', { ascending: false }),
            supabase
              .from('compliance_documents')
              .select('*')
              .in('material_id', materialIds)
          ])

          receiptsData = receiptsResult.data || []
          complianceDocsData = complianceResult.data || []
        }

        // Group materials, receipts, and compliance docs by line item
        const lineItemsWithMats: LineItemWithMaterials[] = (lineItemsData || []).map(li => {
          const materials = (materialsData || [])
            .filter(m => m.line_item_id === li.id)
            .map(m => {
              const receipts = receiptsData.filter(r => r.material_id === m.id)
              const totalReceived = receipts.reduce((sum, r) => sum + (r.quantity_received || 0), 0)
              const compliance_docs = complianceDocsData.filter(c => c.material_id === m.id)
              return { ...m, receipts, total_received: totalReceived, compliance_docs }
            })

          return { ...li, materials }
        })

        setLineItemsWithMaterials(lineItemsWithMats)
      } else {
        setLineItemsWithMaterials([])
      }

      // Fetch checklists
      const { data: checklistsData } = await supabase
        .from('checklists')
        .select('*')
        .eq('headline_id', headlineId)
        .order('created_at')

      if (checklistsData && checklistsData.length > 0) {
        const checklistIds = checklistsData.map(c => c.id)
        const { data: itemsData } = await supabase
          .from('checklist_items')
          .select('*')
          .in('checklist_id', checklistIds)
          .order('sort_order')

        const checklistsWithItems: ChecklistWithItems[] = checklistsData.map(c => ({
          ...c,
          items: (itemsData || []).filter(i => i.checklist_id === c.id)
        }))
        setChecklists(checklistsWithItems)
      } else {
        setChecklists([])
      }
    } catch (error) {
      console.error('Error fetching data:', error)
      toast.error('Failed to load BOQ data')
      router.push('/boq')
    } finally {
      setLoading(false)
    }
  }

  // Toggle expand/collapse for line items
  function toggleExpand(id: string) {
    const newExpanded = new Set(expandedItems)
    if (newExpanded.has(id)) {
      newExpanded.delete(id)
    } else {
      newExpanded.add(id)
    }
    setExpandedItems(newExpanded)
  }

  // Line Item functions
  function openAddLineItemDialog() {
    setEditingLineItem(null)
    setLineItemFormData({ ...emptyLineItem })
    setLineItemDialogOpen(true)
  }

  function openEditLineItemDialog(item: BOQLineItem) {
    setEditingLineItem(item)
    setLineItemFormData({
      item_number: item.item_number,
      description: item.description,
      location: item.location || '',
      unit: item.unit,
      quantity: item.quantity,
    })
    setLineItemDialogOpen(true)
  }

  async function handleSaveLineItem(e: React.FormEvent) {
    e.preventDefault()

    if (!lineItemFormData.item_number.trim()) {
      toast.error('S.No is required')
      return
    }

    if (!lineItemFormData.description.trim()) {
      toast.error('Description is required')
      return
    }

    setSaving(true)

    try {
      if (editingLineItem) {
        const { error } = await supabase
          .from('boq_line_items')
          .update({
            item_number: lineItemFormData.item_number,
            description: lineItemFormData.description,
            location: lineItemFormData.location || null,
            unit: lineItemFormData.unit,
            quantity: lineItemFormData.quantity,
          })
          .eq('id', editingLineItem.id)

        if (error) throw error
        toast.success('Line item updated')
      } else {
        const { error } = await supabase
          .from('boq_line_items')
          .insert({
            headline_id: headlineId,
            item_number: lineItemFormData.item_number,
            description: lineItemFormData.description,
            location: lineItemFormData.location || null,
            unit: lineItemFormData.unit,
            quantity: lineItemFormData.quantity,
            status: 'pending',
          })

        if (error) throw error
        toast.success('Line item added')
      }

      setLineItemDialogOpen(false)
      fetchData()
    } catch (error) {
      console.error('Error saving line item:', error)
      toast.error('Failed to save line item')
    } finally {
      setSaving(false)
    }
  }

  async function deleteLineItem(id: string) {
    if (!confirm('Are you sure? This will delete all materials and receipts for this line item.')) {
      return
    }

    try {
      const { error } = await supabase
        .from('boq_line_items')
        .delete()
        .eq('id', id)

      if (error) throw error
      toast.success('Line item deleted')
      fetchData()
    } catch (error) {
      console.error('Error deleting line item:', error)
      toast.error('Failed to delete line item')
    }
  }

  // Material functions
  function openAddMaterialDialog(lineItemId: string) {
    setEditingMaterial(null)
    setMaterialFormData({ ...emptyMaterial })
    setSelectedLineItemId(lineItemId)
    setMaterialDialogOpen(true)
  }

  function openEditMaterialDialog(material: Material) {
    setEditingMaterial(material)
    setMaterialFormData({
      name: material.name,
      material_type: material.material_type || 'direct',
      unit: material.unit,
      required_quantity: material.required_quantity || 0,
    })
    setSelectedLineItemId(material.line_item_id)
    setMaterialDialogOpen(true)
  }

  async function handleSaveMaterial(e: React.FormEvent) {
    e.preventDefault()

    if (!materialFormData.name.trim()) {
      toast.error('Material name is required')
      return
    }

    setSaving(true)

    try {
      if (editingMaterial) {
        const { error } = await supabase
          .from('materials')
          .update({
            name: materialFormData.name,
            material_type: materialFormData.material_type,
            unit: materialFormData.unit,
            required_quantity: materialFormData.required_quantity || null,
          })
          .eq('id', editingMaterial.id)

        if (error) throw error
        toast.success('Material updated')
      } else {
        const { error } = await supabase
          .from('materials')
          .insert({
            line_item_id: selectedLineItemId,
            name: materialFormData.name,
            material_type: materialFormData.material_type,
            unit: materialFormData.unit,
            required_quantity: materialFormData.required_quantity || null,
          })

        if (error) throw error
        toast.success('Material added')
      }

      setMaterialDialogOpen(false)
      fetchData()
    } catch (error) {
      console.error('Error saving material:', error)
      toast.error('Failed to save material')
    } finally {
      setSaving(false)
    }
  }

  async function deleteMaterial(id: string) {
    if (!confirm('Delete this material and all its receipts?')) {
      return
    }

    try {
      const { error } = await supabase
        .from('materials')
        .delete()
        .eq('id', id)

      if (error) throw error
      toast.success('Material deleted')
      fetchData()
    } catch (error) {
      console.error('Error deleting material:', error)
      toast.error('Failed to delete material')
    }
  }

  // Receipt functions
  function openAddReceiptDialog(materialId: string) {
    setEditingReceipt(null)
    setReceiptFormData({ ...emptyReceipt })
    setSelectedMaterialId(materialId)
    setReceiptDialogOpen(true)
  }

  function openEditReceiptDialog(receipt: MaterialReceipt) {
    setEditingReceipt(receipt)
    setReceiptFormData({
      invoice_number: receipt.invoice_number || '',
      receipt_date: receipt.receipt_date,
      quantity_received: receipt.quantity_received,
      vendor_name: receipt.vendor_name || '',
      notes: receipt.notes || '',
    })
    setSelectedMaterialId(receipt.material_id)
    setReceiptDialogOpen(true)
  }

  async function handleSaveReceipt(e: React.FormEvent) {
    e.preventDefault()

    if (!receiptFormData.quantity_received || receiptFormData.quantity_received <= 0) {
      toast.error('Quantity is required')
      return
    }

    setSaving(true)

    try {
      if (editingReceipt) {
        const { error } = await supabase
          .from('material_receipts')
          .update({
            invoice_number: receiptFormData.invoice_number || null,
            receipt_date: receiptFormData.receipt_date,
            quantity_received: receiptFormData.quantity_received,
            vendor_name: receiptFormData.vendor_name || null,
            notes: receiptFormData.notes || null,
          })
          .eq('id', editingReceipt.id)

        if (error) throw error
        toast.success('Receipt updated')
      } else {
        const { error } = await supabase
          .from('material_receipts')
          .insert({
            material_id: selectedMaterialId,
            invoice_number: receiptFormData.invoice_number || null,
            receipt_date: receiptFormData.receipt_date,
            quantity_received: receiptFormData.quantity_received,
            vendor_name: receiptFormData.vendor_name || null,
            notes: receiptFormData.notes || null,
          })

        if (error) throw error
        toast.success('Receipt added')
      }

      setReceiptDialogOpen(false)
      fetchData()
    } catch (error) {
      console.error('Error saving receipt:', error)
      toast.error('Failed to save receipt')
    } finally {
      setSaving(false)
    }
  }

  async function deleteReceipt(id: string) {
    if (!confirm('Delete this receipt?')) {
      return
    }

    try {
      const { error } = await supabase
        .from('material_receipts')
        .delete()
        .eq('id', id)

      if (error) throw error
      toast.success('Receipt deleted')
      fetchData()
    } catch (error) {
      console.error('Error deleting receipt:', error)
      toast.error('Failed to delete receipt')
    }
  }

  // Checklist functions
  function toggleChecklistExpand(id: string) {
    const newExpanded = new Set(expandedChecklists)
    if (newExpanded.has(id)) {
      newExpanded.delete(id)
    } else {
      newExpanded.add(id)
    }
    setExpandedChecklists(newExpanded)
  }

  function openAddChecklistDialog() {
    setEditingChecklist(null)
    setChecklistFormData({ ...emptyChecklist })
    setChecklistDialogOpen(true)
  }

  function openEditChecklistDialog(checklist: Checklist) {
    setEditingChecklist(checklist)
    setChecklistFormData({ name: checklist.name })
    setChecklistDialogOpen(true)
  }

  async function handleSaveChecklist(e: React.FormEvent) {
    e.preventDefault()

    if (!checklistFormData.name.trim()) {
      toast.error('Checklist name is required')
      return
    }

    setSaving(true)

    try {
      if (editingChecklist) {
        const { error } = await supabase
          .from('checklists')
          .update({ name: checklistFormData.name })
          .eq('id', editingChecklist.id)

        if (error) throw error
        toast.success('Checklist updated')
      } else {
        const { error } = await supabase
          .from('checklists')
          .insert({
            headline_id: headlineId,
            name: checklistFormData.name,
          })

        if (error) throw error
        toast.success('Checklist created')
      }

      setChecklistDialogOpen(false)
      fetchData()
    } catch (error) {
      console.error('Error saving checklist:', error)
      toast.error('Failed to save checklist')
    } finally {
      setSaving(false)
    }
  }

  async function deleteChecklist(id: string) {
    if (!confirm('Delete this checklist and all its items?')) {
      return
    }

    try {
      const { error } = await supabase
        .from('checklists')
        .delete()
        .eq('id', id)

      if (error) throw error
      toast.success('Checklist deleted')
      fetchData()
    } catch (error) {
      console.error('Error deleting checklist:', error)
      toast.error('Failed to delete checklist')
    }
  }

  // Checklist Item functions
  function openAddChecklistItemDialog(checklistId: string) {
    setEditingChecklistItem(null)
    setChecklistItemFormData({ ...emptyChecklistItem })
    setSelectedChecklistId(checklistId)
    setChecklistItemDialogOpen(true)
  }

  function openEditChecklistItemDialog(item: ChecklistItem) {
    setEditingChecklistItem(item)
    setChecklistItemFormData({
      activity_name: item.activity_name,
      notes: item.notes || '',
    })
    setSelectedChecklistId(item.checklist_id)
    setChecklistItemDialogOpen(true)
  }

  async function handleSaveChecklistItem(e: React.FormEvent) {
    e.preventDefault()

    if (!checklistItemFormData.activity_name.trim()) {
      toast.error('Activity name is required')
      return
    }

    setSaving(true)

    try {
      if (editingChecklistItem) {
        const { error } = await supabase
          .from('checklist_items')
          .update({
            activity_name: checklistItemFormData.activity_name,
            notes: checklistItemFormData.notes || null,
          })
          .eq('id', editingChecklistItem.id)

        if (error) throw error
        toast.success('Item updated')
      } else {
        // Get next sort order
        const checklist = checklists.find(c => c.id === selectedChecklistId)
        const nextSortOrder = checklist ? checklist.items.length + 1 : 1

        const { error } = await supabase
          .from('checklist_items')
          .insert({
            checklist_id: selectedChecklistId,
            activity_name: checklistItemFormData.activity_name,
            notes: checklistItemFormData.notes || null,
            sort_order: nextSortOrder,
            status: 'pending',
          })

        if (error) throw error
        toast.success('Item added')
      }

      setChecklistItemDialogOpen(false)
      fetchData()
    } catch (error) {
      console.error('Error saving checklist item:', error)
      toast.error('Failed to save item')
    } finally {
      setSaving(false)
    }
  }

  async function deleteChecklistItem(id: string) {
    if (!confirm('Delete this item?')) {
      return
    }

    try {
      const { error } = await supabase
        .from('checklist_items')
        .delete()
        .eq('id', id)

      if (error) throw error
      toast.success('Item deleted')
      fetchData()
    } catch (error) {
      console.error('Error deleting item:', error)
      toast.error('Failed to delete item')
    }
  }

  async function toggleChecklistItemStatus(item: ChecklistItem) {
    const newStatus = item.status === 'completed' ? 'pending' : 'completed'
    const completedAt = newStatus === 'completed' ? new Date().toISOString() : null

    try {
      const { error } = await supabase
        .from('checklist_items')
        .update({
          status: newStatus,
          completed_at: completedAt,
        })
        .eq('id', item.id)

      if (error) throw error
      fetchData()
    } catch (error) {
      console.error('Error updating item status:', error)
      toast.error('Failed to update status')
    }
  }

  // Compliance Document functions
  async function openComplianceDialog(material: MaterialWithReceipts) {
    setSelectedMaterialForCompliance(material)
    setComplianceDialogOpen(true)

    // Initialize compliance docs if they don't exist
    if (material.compliance_docs.length < 4) {
      await initializeComplianceDocs(material.id)
    }
  }

  async function initializeComplianceDocs(materialId: string) {
    // Create default compliance document entries for a material if they don't exist
    const docTypes = ['dc', 'mir', 'test_certificate', 'tds']

    try {
      for (const docType of docTypes) {
        const { data: existing } = await supabase
          .from('compliance_documents')
          .select('id')
          .eq('material_id', materialId)
          .eq('document_type', docType)
          .single()

        if (!existing) {
          await supabase
            .from('compliance_documents')
            .insert({
              material_id: materialId,
              document_type: docType,
              is_applicable: true,
              is_uploaded: false,
            })
        }
      }
      fetchData()
    } catch (error) {
      console.error('Error initializing compliance docs:', error)
    }
  }

  async function toggleDocApplicable(doc: ComplianceDocument) {
    try {
      const { error } = await supabase
        .from('compliance_documents')
        .update({
          is_applicable: !doc.is_applicable,
          // If marking as NA, clear the file
          ...(doc.is_applicable && { file_path: null, file_name: null, is_uploaded: false, uploaded_at: null })
        })
        .eq('id', doc.id)

      if (error) throw error
      toast.success(doc.is_applicable ? 'Marked as Not Applicable' : 'Marked as Required')

      // Update the selected material's compliance docs in state immediately
      if (selectedMaterialForCompliance) {
        const updatedDocs = selectedMaterialForCompliance.compliance_docs.map(d =>
          d.id === doc.id
            ? {
                ...d,
                is_applicable: !doc.is_applicable,
                ...(doc.is_applicable && { file_path: null, file_name: null, is_uploaded: false, uploaded_at: null })
              }
            : d
        )
        setSelectedMaterialForCompliance({
          ...selectedMaterialForCompliance,
          compliance_docs: updatedDocs
        })
      }

      fetchData()
    } catch (error) {
      console.error('Error updating document:', error)
      toast.error('Failed to update')
    }
  }

  async function handleFileUpload(materialId: string, docType: string, file: File) {
    setUploadingDoc(docType)

    try {
      // Upload file to Supabase Storage
      const fileExt = file.name.split('.').pop()
      const fileName = `${materialId}/${docType}_${Date.now()}.${fileExt}`

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('compliance-docs')
        .upload(fileName, file, {
          cacheControl: '3600',
          upsert: true
        })

      if (uploadError) {
        console.error('Upload error details:', uploadError)
        // Show the actual error message for debugging
        if (uploadError.message.includes('bucket') || uploadError.message.includes('not found')) {
          toast.error('Storage bucket not configured. Please create "compliance-docs" bucket in Supabase.')
        } else if (uploadError.message.includes('policy') || uploadError.message.includes('permission') || uploadError.message.includes('security')) {
          toast.error('Storage policy error. Please enable public access or add RLS policies for the bucket.')
        } else {
          toast.error(`Upload failed: ${uploadError.message}`)
        }
        return
      }

      // Store just the file path - we'll generate signed URLs when viewing
      const filePath = fileName

      // Update or create compliance document record
      const { data: existingDoc } = await supabase
        .from('compliance_documents')
        .select('id')
        .eq('material_id', materialId)
        .eq('document_type', docType)
        .single()

      if (existingDoc) {
        const { error } = await supabase
          .from('compliance_documents')
          .update({
            file_path: filePath,
            file_name: file.name,
            is_uploaded: true,
            uploaded_at: new Date().toISOString(),
          })
          .eq('id', existingDoc.id)

        if (error) throw error
      } else {
        const { error } = await supabase
          .from('compliance_documents')
          .insert({
            material_id: materialId,
            document_type: docType,
            file_path: filePath,
            file_name: file.name,
            is_applicable: true,
            is_uploaded: true,
            uploaded_at: new Date().toISOString(),
          })

        if (error) throw error
      }

      toast.success('Document uploaded successfully')

      // Update the selected material's compliance docs in state immediately
      if (selectedMaterialForCompliance) {
        const updatedDocs = selectedMaterialForCompliance.compliance_docs.map(d =>
          d.document_type === docType
            ? {
                ...d,
                file_path: filePath,
                file_name: file.name,
                is_uploaded: true,
                uploaded_at: new Date().toISOString()
              }
            : d
        )
        setSelectedMaterialForCompliance({
          ...selectedMaterialForCompliance,
          compliance_docs: updatedDocs
        })
      }

      fetchData()
    } catch (error: any) {
      console.error('Error uploading file:', error)
      toast.error(error?.message || 'Failed to upload document')
    } finally {
      setUploadingDoc(null)
    }
  }

  async function deleteComplianceFile(doc: ComplianceDocument) {
    if (!confirm('Delete this document?')) return

    try {
      // Delete file from storage if it exists
      if (doc.file_path) {
        await supabase.storage.from('compliance-docs').remove([doc.file_path])
      }

      // Update the document record
      const { error } = await supabase
        .from('compliance_documents')
        .update({
          file_path: null,
          file_name: null,
          is_uploaded: false,
          uploaded_at: null,
        })
        .eq('id', doc.id)

      if (error) throw error
      toast.success('Document deleted')

      // Update the selected material's compliance docs in state immediately
      if (selectedMaterialForCompliance) {
        const updatedDocs = selectedMaterialForCompliance.compliance_docs.map(d =>
          d.id === doc.id
            ? { ...d, file_path: null, file_name: null, is_uploaded: false, uploaded_at: null }
            : d
        )
        setSelectedMaterialForCompliance({
          ...selectedMaterialForCompliance,
          compliance_docs: updatedDocs
        })
      }

      fetchData()
    } catch (error) {
      console.error('Error deleting document:', error)
      toast.error('Failed to delete document')
    }
  }

  function getComplianceStatus(material: MaterialWithReceipts) {
    const docs = material.compliance_docs
    if (docs.length === 0) return { total: 4, completed: 0, na: 0 }

    const applicable = docs.filter(d => d.is_applicable)
    const uploaded = docs.filter(d => d.is_applicable && d.is_uploaded)
    const na = docs.filter(d => !d.is_applicable)

    return {
      total: 4,
      completed: uploaded.length,
      na: na.length,
      pending: applicable.length - uploaded.length
    }
  }

  async function viewDocument(doc: ComplianceDocument) {
    if (!doc.file_path) {
      toast.error('No file available')
      return
    }

    try {
      // Generate a signed URL that expires in 1 hour
      const { data, error } = await supabase.storage
        .from('compliance-docs')
        .createSignedUrl(doc.file_path, 3600) // 1 hour expiry

      if (error) {
        console.error('Error generating signed URL:', error)
        toast.error('Failed to generate download link')
        return
      }

      // Open the signed URL in a new tab
      window.open(data.signedUrl, '_blank')
    } catch (error) {
      console.error('Error viewing document:', error)
      toast.error('Failed to open document')
    }
  }

  async function updateHeadlineStatus(status: string) {
    try {
      const { error } = await supabase
        .from('boq_headlines')
        .update({ status })
        .eq('id', headlineId)

      if (error) throw error
      setHeadline(prev => prev ? { ...prev, status } : null)
      toast.success('Status updated')
    } catch (error) {
      console.error('Error updating status:', error)
      toast.error('Failed to update status')
    }
  }

  const statusColors: Record<string, string> = {
    pending: 'bg-slate-100 text-slate-700',
    in_progress: 'bg-blue-100 text-blue-700',
    completed: 'bg-green-100 text-green-700',
    billed: 'bg-purple-100 text-purple-700',
  }

  const getMaterialProgress = (material: MaterialWithReceipts) => {
    const required = material.required_quantity || 0
    const received = material.total_received || 0
    if (required === 0) return null
    return Math.min((received / required) * 100, 100)
  }

  const getChecklistProgress = (checklist: ChecklistWithItems) => {
    if (checklist.items.length === 0) return 0
    const completed = checklist.items.filter(i => i.status === 'completed').length
    return Math.round((completed / checklist.items.length) * 100)
  }

  if (loading) {
    return (
      <div className="flex flex-col min-h-screen">
        <Header title="Loading..." />
        <div className="flex-1 flex items-center justify-center">
          <p className="text-slate-500">Loading BOQ data...</p>
        </div>
      </div>
    )
  }

  if (!headline) {
    return null
  }

  // Calculate totals
  const totalMaterials = lineItemsWithMaterials.reduce((sum, li) => sum + li.materials.length, 0)
  const totalReceipts = lineItemsWithMaterials.reduce(
    (sum, li) => sum + li.materials.reduce((s, m) => s + m.receipts.length, 0),
    0
  )
  const totalChecklistItems = checklists.reduce((sum, c) => sum + c.items.length, 0)
  const completedChecklistItems = checklists.reduce(
    (sum, c) => sum + c.items.filter(i => i.status === 'completed').length,
    0
  )

  return (
    <div className="flex flex-col min-h-screen">
      <Header title={headline.name} />

      <div className="flex-1 p-4 md:p-6 space-y-6">
        {/* Back Button */}
        <Link href="/boq" className="inline-flex items-center text-sm text-slate-600 hover:text-slate-900">
          <ArrowLeft className="h-4 w-4 mr-1" />
          Back to BOQ
        </Link>

        {/* Headline Info Card */}
        <Card>
          <CardHeader>
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <FileSpreadsheet className="h-5 w-5" />
                  {headline.serial_number}. {headline.name}
                </CardTitle>
                <CardDescription className="mt-2 space-y-1">
                  <span className="flex items-center gap-1">
                    <Building2 className="h-3 w-3" />
                    {headline.packages?.sites?.name}
                  </span>
                  <span className="flex items-center gap-1">
                    <Package className="h-3 w-3" />
                    {headline.packages?.name}
                  </span>
                </CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <Select value={headline.status} onValueChange={updateHeadlineStatus}>
                  <SelectTrigger className="w-[140px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="in_progress">In Progress</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
              <div className="bg-slate-50 rounded-lg p-3">
                <p className="text-2xl font-semibold">{lineItemsWithMaterials.length}</p>
                <p className="text-sm text-slate-500">Line Items</p>
              </div>
              <div className="bg-blue-50 rounded-lg p-3">
                <p className="text-2xl font-semibold text-blue-700">{totalMaterials}</p>
                <p className="text-sm text-blue-600">Materials</p>
              </div>
              <div className="bg-green-50 rounded-lg p-3">
                <p className="text-2xl font-semibold text-green-700">{totalReceipts}</p>
                <p className="text-sm text-green-600">Receipts</p>
              </div>
              <div className="bg-purple-50 rounded-lg p-3">
                <p className="text-2xl font-semibold text-purple-700">{completedChecklistItems}/{totalChecklistItems}</p>
                <p className="text-sm text-purple-600">Checklist</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Tabs for Line Items/Materials and Checklists */}
        <Tabs defaultValue="materials" className="space-y-4">
          <TabsList className="grid w-full grid-cols-2 max-w-md">
            <TabsTrigger value="materials" className="flex items-center gap-2">
              <Package className="h-4 w-4" />
              Line Items & Materials
            </TabsTrigger>
            <TabsTrigger value="checklists" className="flex items-center gap-2">
              <ClipboardCheck className="h-4 w-4" />
              Checklists
            </TabsTrigger>
          </TabsList>

          <TabsContent value="materials">
            <Card>
              <CardHeader>
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <div>
                    <CardTitle>BOQ Line Items & Materials</CardTitle>
                    <CardDescription>
                      Manage line items and track materials for each
                    </CardDescription>
                  </div>
                  <Button onClick={openAddLineItemDialog}>
                    <Plus className="h-4 w-4 mr-2" />
                    Add Line Item
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
            {lineItemsWithMaterials.length === 0 ? (
              <div className="text-center py-12">
                <FileSpreadsheet className="h-12 w-12 mx-auto text-slate-300 mb-4" />
                <h3 className="text-lg font-medium text-slate-900 mb-2">No line items yet</h3>
                <p className="text-slate-500 mb-4">Add line items to this BOQ headline.</p>
                <Button onClick={openAddLineItemDialog}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Line Item
                </Button>
              </div>
            ) : (
              lineItemsWithMaterials.map((lineItem) => (
                <Collapsible
                  key={lineItem.id}
                  open={expandedItems.has(lineItem.id)}
                  onOpenChange={() => toggleExpand(lineItem.id)}
                >
                  <div className="border rounded-lg">
                    {/* Line Item Header */}
                    <div className="flex items-center justify-between p-4 bg-slate-50">
                      <CollapsibleTrigger className="flex items-center gap-3 flex-1 text-left">
                        {expandedItems.has(lineItem.id) ? (
                          <ChevronDown className="h-5 w-5 text-slate-400" />
                        ) : (
                          <ChevronRight className="h-5 w-5 text-slate-400" />
                        )}
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-medium">{lineItem.item_number}</span>
                            <Badge variant="outline" className="text-xs">
                              {lineItem.materials.length} materials
                            </Badge>
                          </div>
                          <p className="text-sm text-slate-600 mt-1 line-clamp-1">
                            {lineItem.description}
                          </p>
                        </div>
                        <div className="text-right mr-4">
                          <p className="font-medium">{lineItem.quantity} {lineItem.unit}</p>
                          <p className="text-xs text-slate-500">{lineItem.location || 'No location'}</p>
                        </div>
                      </CollapsibleTrigger>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => openEditLineItemDialog(lineItem)}>
                            <Pencil className="h-4 w-4 mr-2" />
                            Edit Line Item
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => openAddMaterialDialog(lineItem.id)}>
                            <Plus className="h-4 w-4 mr-2" />
                            Add Material
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-red-600"
                            onClick={() => deleteLineItem(lineItem.id)}
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>

                    {/* Expanded Content - Materials */}
                    <CollapsibleContent>
                      <div className="p-4 border-t">
                        {lineItem.materials.length === 0 ? (
                          <div className="text-center py-6">
                            <PackageOpen className="h-8 w-8 mx-auto text-slate-300 mb-2" />
                            <p className="text-sm text-slate-500 mb-3">No materials added yet</p>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => openAddMaterialDialog(lineItem.id)}
                            >
                              <Plus className="h-4 w-4 mr-1" />
                              Add Material
                            </Button>
                          </div>
                        ) : (
                          <div className="space-y-3">
                            <div className="flex justify-between items-center mb-2">
                              <h4 className="font-medium text-sm">Materials</h4>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => openAddMaterialDialog(lineItem.id)}
                              >
                                <Plus className="h-4 w-4 mr-1" />
                                Add
                              </Button>
                            </div>

                            {lineItem.materials.map((material) => {
                              const progress = getMaterialProgress(material)
                              const complianceStatus = getComplianceStatus(material)
                              return (
                                <div key={material.id} className="border rounded-lg p-3 bg-white">
                                  <div className="flex items-start justify-between">
                                    <div className="flex-1">
                                      <div className="flex items-center gap-2">
                                        <PackageOpen className="h-4 w-4 text-blue-600" />
                                        <span className="font-medium">{material.name}</span>
                                        <Badge variant="outline" className="text-xs">
                                          {material.material_type || 'direct'}
                                        </Badge>
                                      </div>
                                      <div className="mt-2 flex items-center gap-4 text-sm text-slate-600">
                                        <span>Required: {material.required_quantity || '-'} {material.unit}</span>
                                        <span>Received: {material.total_received} {material.unit}</span>
                                      </div>
                                      {progress !== null && (
                                        <div className="mt-2">
                                          <Progress value={progress} className="h-2" />
                                          <p className="text-xs text-slate-500 mt-1">{progress.toFixed(0)}% received</p>
                                        </div>
                                      )}
                                    </div>
                                    <div className="flex items-center gap-1">
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => openAddReceiptDialog(material.id)}
                                        title="Add Receipt"
                                      >
                                        <Truck className="h-4 w-4" />
                                      </Button>
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => openComplianceDialog(material)}
                                        title="Compliance Documents"
                                        className={complianceStatus.completed === complianceStatus.total - complianceStatus.na ? 'text-green-600' : complianceStatus.completed > 0 ? 'text-amber-600' : ''}
                                      >
                                        <FileText className="h-4 w-4" />
                                      </Button>
                                      <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                          <Button variant="ghost" size="icon">
                                            <MoreHorizontal className="h-4 w-4" />
                                          </Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="end">
                                          <DropdownMenuItem onClick={() => openEditMaterialDialog(material)}>
                                            <Pencil className="h-4 w-4 mr-2" />
                                            Edit
                                          </DropdownMenuItem>
                                          <DropdownMenuItem onClick={() => openAddReceiptDialog(material.id)}>
                                            <Truck className="h-4 w-4 mr-2" />
                                            Add Receipt
                                          </DropdownMenuItem>
                                          <DropdownMenuItem onClick={() => openComplianceDialog(material)}>
                                            <FileText className="h-4 w-4 mr-2" />
                                            Compliance Docs
                                          </DropdownMenuItem>
                                          <DropdownMenuItem
                                            className="text-red-600"
                                            onClick={() => deleteMaterial(material.id)}
                                          >
                                            <Trash2 className="h-4 w-4 mr-2" />
                                            Delete
                                          </DropdownMenuItem>
                                        </DropdownMenuContent>
                                      </DropdownMenu>
                                    </div>
                                  </div>

                                  {/* Receipts */}
                                  {material.receipts.length > 0 && (
                                    <div className="mt-3 border-t pt-3">
                                      <p className="text-xs font-medium text-slate-500 mb-2">
                                        Recent Receipts ({material.receipts.length})
                                      </p>
                                      <div className="space-y-1">
                                        {material.receipts.slice(0, 3).map((receipt) => (
                                          <div
                                            key={receipt.id}
                                            className="flex items-center justify-between text-sm bg-slate-50 rounded px-2 py-1"
                                          >
                                            <div className="flex items-center gap-2">
                                              <Calendar className="h-3 w-3 text-slate-400" />
                                              <span>{new Date(receipt.receipt_date).toLocaleDateString('en-IN')}</span>
                                              <span className="text-slate-400">|</span>
                                              <span className="font-medium">{receipt.quantity_received} {material.unit}</span>
                                              {receipt.vendor_name && (
                                                <>
                                                  <span className="text-slate-400">|</span>
                                                  <span className="text-slate-600">{receipt.vendor_name}</span>
                                                </>
                                              )}
                                            </div>
                                            <DropdownMenu>
                                              <DropdownMenuTrigger asChild>
                                                <Button variant="ghost" size="icon" className="h-6 w-6">
                                                  <MoreHorizontal className="h-3 w-3" />
                                                </Button>
                                              </DropdownMenuTrigger>
                                              <DropdownMenuContent align="end">
                                                <DropdownMenuItem onClick={() => openEditReceiptDialog(receipt)}>
                                                  <Pencil className="h-4 w-4 mr-2" />
                                                  Edit
                                                </DropdownMenuItem>
                                                <DropdownMenuItem
                                                  className="text-red-600"
                                                  onClick={() => deleteReceipt(receipt.id)}
                                                >
                                                  <Trash2 className="h-4 w-4 mr-2" />
                                                  Delete
                                                </DropdownMenuItem>
                                              </DropdownMenuContent>
                                            </DropdownMenu>
                                          </div>
                                        ))}
                                        {material.receipts.length > 3 && (
                                          <p className="text-xs text-slate-500 pl-2">
                                            +{material.receipts.length - 3} more receipts
                                          </p>
                                        )}
                                      </div>
                                    </div>
                                  )}

                                  {/* Compliance Status */}
                                  <div className="mt-3 border-t pt-3">
                                    <div className="flex items-center justify-between">
                                      <p className="text-xs font-medium text-slate-500">Compliance Documents</p>
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-6 text-xs"
                                        onClick={() => openComplianceDialog(material)}
                                      >
                                        Manage
                                      </Button>
                                    </div>
                                    <div className="flex gap-2 mt-2">
                                      {COMPLIANCE_DOC_TYPES.map((docType) => {
                                        const doc = material.compliance_docs.find(d => d.document_type === docType.value)
                                        const isNA = doc && !doc.is_applicable
                                        const isUploaded = doc && doc.is_applicable && doc.is_uploaded
                                        return (
                                          <div
                                            key={docType.value}
                                            className={`flex items-center gap-1 px-2 py-1 rounded text-xs ${
                                              isNA
                                                ? 'bg-slate-100 text-slate-500'
                                                : isUploaded
                                                ? 'bg-green-100 text-green-700'
                                                : 'bg-amber-100 text-amber-700'
                                            }`}
                                            title={docType.fullName}
                                          >
                                            {isNA ? (
                                              <Ban className="h-3 w-3" />
                                            ) : isUploaded ? (
                                              <FileCheck className="h-3 w-3" />
                                            ) : (
                                              <AlertCircle className="h-3 w-3" />
                                            )}
                                            {docType.label}
                                          </div>
                                        )
                                      })}
                                    </div>
                                  </div>
                                </div>
                              )
                            })}
                          </div>
                        )}
                      </div>
                    </CollapsibleContent>
                  </div>
                </Collapsible>
              ))
            )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="checklists">
            <BOQChecklistsTab
              headlineId={headlineId}
              lineItems={lineItems.map(li => ({
                id: li.id,
                item_number: li.item_number,
                description: li.description,
                location: li.location,
                unit: li.unit,
                quantity: Number(li.quantity) || 0,
              }))}
            />
          </TabsContent>
        </Tabs>

        {/* Related Actions */}
        <Card>
          <CardHeader>
            <CardTitle>Related Actions</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-3">
            <Link href={`/jmr?headline=${headlineId}`}>
              <Button variant="outline">Create JMR</Button>
            </Link>
          </CardContent>
        </Card>
      </div>

      {/* Line Item Dialog */}
      <Dialog open={lineItemDialogOpen} onOpenChange={setLineItemDialogOpen}>
        <DialogContent className="max-w-lg">
          <form onSubmit={handleSaveLineItem}>
            <DialogHeader>
              <DialogTitle>{editingLineItem ? 'Edit Line Item' : 'Add Line Item'}</DialogTitle>
              <DialogDescription>
                {editingLineItem ? 'Update line item details' : 'Add a new line item'}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="item_number">S.No *</Label>
                <Input
                  id="item_number"
                  placeholder="e.g., 1.1, 1.2"
                  value={lineItemFormData.item_number}
                  onChange={(e) => setLineItemFormData({ ...lineItemFormData, item_number: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Description *</Label>
                <Textarea
                  id="description"
                  placeholder="Item description"
                  value={lineItemFormData.description}
                  onChange={(e) => setLineItemFormData({ ...lineItemFormData, description: e.target.value })}
                  rows={3}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="location">Location</Label>
                <Input
                  id="location"
                  placeholder="e.g., Water feature area"
                  value={lineItemFormData.location}
                  onChange={(e) => setLineItemFormData({ ...lineItemFormData, location: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Unit *</Label>
                  <Select
                    value={lineItemFormData.unit}
                    onValueChange={(value) => setLineItemFormData({ ...lineItemFormData, unit: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="nos">nos</SelectItem>
                      <SelectItem value="cum">cum</SelectItem>
                      <SelectItem value="Cu.m">Cu.m</SelectItem>
                      <SelectItem value="Sq.m">Sq.m</SelectItem>
                      <SelectItem value="ton">ton</SelectItem>
                      <SelectItem value="kg">kg</SelectItem>
                      <SelectItem value="Rmt">Rmt</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="quantity">Quantity *</Label>
                  <Input
                    id="quantity"
                    type="number"
                    step="0.001"
                    min="0"
                    value={lineItemFormData.quantity}
                    onChange={(e) => setLineItemFormData({ ...lineItemFormData, quantity: parseFloat(e.target.value) || 0 })}
                    required
                  />
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setLineItemDialogOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={saving}>{saving ? 'Saving...' : 'Save'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Material Dialog */}
      <Dialog open={materialDialogOpen} onOpenChange={setMaterialDialogOpen}>
        <DialogContent className="max-w-lg">
          <form onSubmit={handleSaveMaterial}>
            <DialogHeader>
              <DialogTitle>{editingMaterial ? 'Edit Material' : 'Add Material'}</DialogTitle>
              <DialogDescription>
                {editingMaterial ? 'Update material details' : 'Add a new material to track'}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="material_name">Material Name *</Label>
                <Input
                  id="material_name"
                  placeholder="e.g., Cement, Steel, Sand"
                  value={materialFormData.name}
                  onChange={(e) => setMaterialFormData({ ...materialFormData, name: e.target.value })}
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Type</Label>
                  <Select
                    value={materialFormData.material_type}
                    onValueChange={(value) => setMaterialFormData({ ...materialFormData, material_type: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="direct">Direct</SelectItem>
                      <SelectItem value="indirect">Indirect</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Unit *</Label>
                  <Select
                    value={materialFormData.unit}
                    onValueChange={(value) => setMaterialFormData({ ...materialFormData, unit: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="bags">bags</SelectItem>
                      <SelectItem value="kg">kg</SelectItem>
                      <SelectItem value="ton">ton</SelectItem>
                      <SelectItem value="cum">cum</SelectItem>
                      <SelectItem value="nos">nos</SelectItem>
                      <SelectItem value="liters">liters</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="required_quantity">Required Quantity</Label>
                <Input
                  id="required_quantity"
                  type="number"
                  step="0.001"
                  min="0"
                  placeholder="Total quantity required"
                  value={materialFormData.required_quantity || ''}
                  onChange={(e) => setMaterialFormData({
                    ...materialFormData,
                    required_quantity: parseFloat(e.target.value) || 0
                  })}
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setMaterialDialogOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={saving}>{saving ? 'Saving...' : 'Save'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Receipt Dialog */}
      <Dialog open={receiptDialogOpen} onOpenChange={setReceiptDialogOpen}>
        <DialogContent className="max-w-lg">
          <form onSubmit={handleSaveReceipt}>
            <DialogHeader>
              <DialogTitle>{editingReceipt ? 'Edit Receipt' : 'Add Receipt'}</DialogTitle>
              <DialogDescription>
                {editingReceipt ? 'Update receipt details' : 'Record a new material receipt'}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="receipt_date">Date *</Label>
                  <Input
                    id="receipt_date"
                    type="date"
                    value={receiptFormData.receipt_date}
                    onChange={(e) => setReceiptFormData({ ...receiptFormData, receipt_date: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="quantity_received">Quantity *</Label>
                  <Input
                    id="quantity_received"
                    type="number"
                    step="0.001"
                    min="0"
                    value={receiptFormData.quantity_received || ''}
                    onChange={(e) => setReceiptFormData({
                      ...receiptFormData,
                      quantity_received: parseFloat(e.target.value) || 0
                    })}
                    required
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="invoice_number">Invoice No.</Label>
                  <Input
                    id="invoice_number"
                    placeholder="INV-001"
                    value={receiptFormData.invoice_number}
                    onChange={(e) => setReceiptFormData({ ...receiptFormData, invoice_number: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="vendor_name">Vendor</Label>
                  <Input
                    id="vendor_name"
                    placeholder="Supplier name"
                    value={receiptFormData.vendor_name}
                    onChange={(e) => setReceiptFormData({ ...receiptFormData, vendor_name: e.target.value })}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="notes">Notes</Label>
                <Textarea
                  id="notes"
                  placeholder="Additional notes..."
                  value={receiptFormData.notes}
                  onChange={(e) => setReceiptFormData({ ...receiptFormData, notes: e.target.value })}
                  rows={2}
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setReceiptDialogOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={saving}>{saving ? 'Saving...' : 'Save'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Checklist Dialog */}
      <Dialog open={checklistDialogOpen} onOpenChange={setChecklistDialogOpen}>
        <DialogContent className="max-w-md">
          <form onSubmit={handleSaveChecklist}>
            <DialogHeader>
              <DialogTitle>{editingChecklist ? 'Edit Checklist' : 'Add Checklist'}</DialogTitle>
              <DialogDescription>
                {editingChecklist ? 'Update checklist name' : 'Create a new checklist to track activities'}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="checklist_name">Checklist Name *</Label>
                <Input
                  id="checklist_name"
                  placeholder="e.g., Pre-work checklist, Quality checks"
                  value={checklistFormData.name}
                  onChange={(e) => setChecklistFormData({ ...checklistFormData, name: e.target.value })}
                  required
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setChecklistDialogOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={saving}>{saving ? 'Saving...' : 'Save'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Checklist Item Dialog */}
      <Dialog open={checklistItemDialogOpen} onOpenChange={setChecklistItemDialogOpen}>
        <DialogContent className="max-w-md">
          <form onSubmit={handleSaveChecklistItem}>
            <DialogHeader>
              <DialogTitle>{editingChecklistItem ? 'Edit Item' : 'Add Item'}</DialogTitle>
              <DialogDescription>
                {editingChecklistItem ? 'Update item details' : 'Add a new item to the checklist'}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="activity_name">Activity Name *</Label>
                <Input
                  id="activity_name"
                  placeholder="e.g., Check material quality, Verify measurements"
                  value={checklistItemFormData.activity_name}
                  onChange={(e) => setChecklistItemFormData({ ...checklistItemFormData, activity_name: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="item_notes">Notes</Label>
                <Textarea
                  id="item_notes"
                  placeholder="Additional details or instructions..."
                  value={checklistItemFormData.notes}
                  onChange={(e) => setChecklistItemFormData({ ...checklistItemFormData, notes: e.target.value })}
                  rows={2}
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setChecklistItemDialogOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={saving}>{saving ? 'Saving...' : 'Save'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Compliance Documents Dialog */}
      <Dialog open={complianceDialogOpen} onOpenChange={setComplianceDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Compliance Documents
            </DialogTitle>
            <DialogDescription>
              {selectedMaterialForCompliance && (
                <>Manage compliance documents for <strong>{selectedMaterialForCompliance.name}</strong></>
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2 py-2 overflow-y-auto flex-1">
            {COMPLIANCE_DOC_TYPES.map((docType) => {
              const doc = selectedMaterialForCompliance?.compliance_docs.find(
                d => d.document_type === docType.value
              )
              const isNA = doc && !doc.is_applicable
              const isUploaded = doc && doc.is_applicable && doc.is_uploaded

              return (
                <div
                  key={docType.value}
                  className={`border rounded-lg p-3 ${
                    isNA ? 'bg-slate-50' : isUploaded ? 'bg-green-50' : 'bg-white'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h4 className="font-medium">{docType.label}</h4>
                        <span className="text-xs text-slate-500 hidden sm:inline">({docType.fullName})</span>
                      </div>

                      {isNA && (
                        <p className="text-xs text-slate-500 flex items-center gap-1">
                          <Ban className="h-3 w-3" />
                          Not Applicable
                        </p>
                      )}

                      {isUploaded && doc?.file_name && (
                        <div className="flex items-center gap-1 text-xs">
                          <FileCheck className="h-3 w-3 text-green-600 flex-shrink-0" />
                          <button
                            onClick={() => viewDocument(doc)}
                            className="text-blue-600 hover:underline truncate max-w-[150px]"
                            title={doc.file_name}
                          >
                            {doc.file_name}
                          </button>
                        </div>
                      )}

                      {!isNA && !isUploaded && (
                        <p className="text-xs text-amber-600 flex items-center gap-1">
                          <AlertCircle className="h-3 w-3" />
                          Pending
                        </p>
                      )}
                    </div>

                    <div className="flex items-center gap-1 flex-shrink-0">
                      {/* Toggle NA */}
                      {doc && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => toggleDocApplicable(doc)}
                          className={`text-xs h-8 ${isNA ? 'text-green-600' : 'text-slate-600'}`}
                        >
                          {isNA ? 'Mark Required' : 'NA'}
                        </Button>
                      )}

                      {/* View / Upload / Delete */}
                      {!isNA && (
                        <>
                          {isUploaded && doc ? (
                            <>
                              <Button
                                variant="outline"
                                size="sm"
                                className="text-blue-600 h-8"
                                onClick={() => viewDocument(doc)}
                                title="View document"
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
                                    if (file && selectedMaterialForCompliance) {
                                      handleFileUpload(selectedMaterialForCompliance.id, docType.value, file)
                                    }
                                    e.target.value = ''
                                  }}
                                  disabled={uploadingDoc === docType.value}
                                />
                                <Button variant="outline" size="sm" asChild className="h-8" title="Replace document">
                                  <span className="cursor-pointer">
                                    <Upload className="h-4 w-4" />
                                  </span>
                                </Button>
                              </label>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => deleteComplianceFile(doc)}
                                className="text-red-600 h-8"
                                title="Delete document"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </>
                          ) : (
                            <label>
                              <input
                                type="file"
                                className="hidden"
                                accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg"
                                onChange={(e) => {
                                  const file = e.target.files?.[0]
                                  if (file && selectedMaterialForCompliance) {
                                    handleFileUpload(selectedMaterialForCompliance.id, docType.value, file)
                                  }
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
                                    <>...</>
                                  ) : (
                                    <>
                                      <Upload className="h-4 w-4 mr-1" />
                                      Upload
                                    </>
                                  )}
                                </span>
                              </Button>
                            </label>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}

            <p className="text-xs text-slate-400 mt-2">
              Formats: PDF, DOC, XLS, PNG, JPG
            </p>
          </div>

          <DialogFooter className="pt-2">
            <Button variant="outline" size="sm" onClick={() => setComplianceDialogOpen(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
