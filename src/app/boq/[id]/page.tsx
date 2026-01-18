'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Header } from '@/components/layout/header'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
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
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import { Badge } from '@/components/ui/badge'
import {
  ArrowLeft,
  FileSpreadsheet,
  Plus,
  MoreHorizontal,
  Pencil,
  Trash2,
  Package,
  Building2,
  ClipboardCheck,
  FileText,
  Flame,
  ChevronDown,
  ChevronRight,
  Calendar,
} from 'lucide-react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'
import BOQChecklistsTab from '@/components/boq/boq-checklists-tab'
import BOQJMRTab from '@/components/boq/boq-jmr-tab'

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
  checklist_status: string
  jmr_status: string
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

interface Consumption {
  id: string
  line_item_id: string
  site_id: string
  material_id: string
  material_name: string
  consumption_date: string
  quantity: number
  unit: string
  notes: string | null
  created_at: string
}

interface AvailableInventoryItem {
  material_id: string
  material_name: string
  unit: string
  available_quantity: number
}


const emptyLineItem = {
  item_number: '',
  description: '',
  location: '',
  unit: 'cum',
  quantity: 0,
}


const emptyChecklist = {
  name: '',
}

const emptyChecklistItem = {
  activity_name: '',
  notes: '',
}

const emptyConsumption = {
  consumption_date: new Date().toISOString().split('T')[0],
  material_id: '',
  quantity: 0,
  notes: '',
}

// Checklist status options
const checklistStatusOptions = [
  { value: 'not_applicable', label: 'Not Applicable', color: 'bg-gray-100 text-gray-600' },
  { value: 'pending', label: 'Pending', color: 'bg-slate-100 text-slate-700' },
  { value: 'created', label: 'Created', color: 'bg-blue-100 text-blue-700' },
  { value: 'in_progress', label: 'In Progress', color: 'bg-amber-100 text-amber-700' },
  { value: 'completed', label: 'Completed', color: 'bg-green-100 text-green-700' },
  { value: 'approved', label: 'Approved', color: 'bg-emerald-100 text-emerald-700' },
  { value: 'uploaded', label: 'Uploaded', color: 'bg-purple-100 text-purple-700' },
]

// JMR status options
const jmrStatusOptions = [
  { value: 'not_applicable', label: 'Not Applicable', color: 'bg-gray-100 text-gray-600' },
  { value: 'pending', label: 'Pending', color: 'bg-slate-100 text-slate-700' },
  { value: 'in_progress', label: 'In Progress', color: 'bg-amber-100 text-amber-700' },
  { value: 'completed', label: 'Completed', color: 'bg-green-100 text-green-700' },
  { value: 'approved', label: 'Approved', color: 'bg-emerald-100 text-emerald-700' },
  { value: 'uploaded', label: 'Uploaded', color: 'bg-purple-100 text-purple-700' },
]

export default function BOQDetailPage() {
  const params = useParams()
  const router = useRouter()
  const headlineId = params.id as string

  const [headline, setHeadline] = useState<BOQHeadline | null>(null)
  const [lineItems, setLineItems] = useState<BOQLineItem[]>([])
  const [loading, setLoading] = useState(true)

  // Line Item Dialog
  const [lineItemDialogOpen, setLineItemDialogOpen] = useState(false)
  const [editingLineItem, setEditingLineItem] = useState<BOQLineItem | null>(null)
  const [lineItemFormData, setLineItemFormData] = useState(emptyLineItem)

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

  // Consumption State
  const [consumptionDialogOpen, setConsumptionDialogOpen] = useState(false)
  const [selectedLineItemForConsumption, setSelectedLineItemForConsumption] = useState<BOQLineItem | null>(null)
  const [consumptionFormData, setConsumptionFormData] = useState(emptyConsumption)
  const [availableInventory, setAvailableInventory] = useState<AvailableInventoryItem[]>([])
  const [consumptions, setConsumptions] = useState<Consumption[]>([])
  const [editingConsumption, setEditingConsumption] = useState<Consumption | null>(null)
  const [loadingInventory, setLoadingInventory] = useState(false)
  const [expandedConsumptions, setExpandedConsumptions] = useState<Set<string>>(new Set())

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
      setLineItems(lineItemsData || [])

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

      // Fetch consumptions for all line items in this headline
      if (lineItemsData && lineItemsData.length > 0) {
        const lineItemIds = lineItemsData.map(li => li.id)
        const { data: consumptionsData, error: consumptionsError } = await supabase
          .from('material_consumption')
          .select('*')
          .in('line_item_id', lineItemIds)
          .order('consumption_date', { ascending: false })

        if (consumptionsError) {
          console.error('Error fetching consumptions:', consumptionsError)
        } else {
          setConsumptions(consumptionsData || [])
        }
      }
    } catch (error) {
      console.error('Error fetching data:', error)
      toast.error('Failed to load BOQ data')
      router.push('/boq')
    } finally {
      setLoading(false)
    }
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

  // Consumption functions
  async function fetchAvailableInventory(siteId: string) {
    setLoadingInventory(true)
    try {
      // Fetch all GRN entries for the site
      const { data: grnData, error: grnError } = await supabase
        .from('material_grn')
        .select('material_id, material_name, quantity, unit')
        .eq('site_id', siteId)

      if (grnError) throw grnError

      // Fetch all consumption entries for the site
      const { data: consumptionData, error: consumptionError } = await supabase
        .from('material_consumption')
        .select('material_id, quantity')
        .eq('site_id', siteId)

      if (consumptionError) throw consumptionError

      // Aggregate GRN quantities
      const grnTotals: { [key: string]: { material_name: string; unit: string; quantity: number } } = {}
      ;(grnData || []).forEach(grn => {
        if (!grnTotals[grn.material_id]) {
          grnTotals[grn.material_id] = {
            material_name: grn.material_name,
            unit: grn.unit,
            quantity: 0
          }
        }
        grnTotals[grn.material_id].quantity += parseFloat(grn.quantity) || 0
      })

      // Aggregate consumption quantities
      const consumptionTotals: { [key: string]: number } = {}
      ;(consumptionData || []).forEach(c => {
        consumptionTotals[c.material_id] = (consumptionTotals[c.material_id] || 0) + (parseFloat(c.quantity) || 0)
      })

      // Calculate available inventory
      const available: AvailableInventoryItem[] = []
      Object.keys(grnTotals).forEach(materialId => {
        const received = grnTotals[materialId].quantity
        const consumed = consumptionTotals[materialId] || 0
        const availableQty = received - consumed

        if (availableQty > 0) {
          available.push({
            material_id: materialId,
            material_name: grnTotals[materialId].material_name,
            unit: grnTotals[materialId].unit,
            available_quantity: availableQty
          })
        }
      })

      // Sort by material name
      available.sort((a, b) => a.material_name.localeCompare(b.material_name))
      setAvailableInventory(available)
    } catch (error) {
      console.error('Error fetching inventory:', error)
      toast.error('Failed to load available inventory')
    } finally {
      setLoadingInventory(false)
    }
  }

  function openConsumptionDialog(lineItem: BOQLineItem) {
    setSelectedLineItemForConsumption(lineItem)
    setEditingConsumption(null)
    setConsumptionFormData({
      ...emptyConsumption,
      consumption_date: new Date().toISOString().split('T')[0]
    })
    setConsumptionDialogOpen(true)

    // Fetch available inventory for the site
    if (headline?.packages?.sites?.id) {
      fetchAvailableInventory(headline.packages.sites.id)
    }
  }

  function openEditConsumptionDialog(consumption: Consumption) {
    const lineItem = lineItems.find(li => li.id === consumption.line_item_id)
    if (lineItem) {
      setSelectedLineItemForConsumption(lineItem)
    }
    setEditingConsumption(consumption)
    setConsumptionFormData({
      consumption_date: consumption.consumption_date,
      material_id: consumption.material_id,
      quantity: consumption.quantity,
      notes: consumption.notes || ''
    })
    setConsumptionDialogOpen(true)

    // Fetch available inventory for the site
    if (headline?.packages?.sites?.id) {
      fetchAvailableInventory(headline.packages.sites.id)
    }
  }

  async function handleSaveConsumption(e: React.FormEvent) {
    e.preventDefault()

    if (!consumptionFormData.material_id) {
      toast.error('Please select a material')
      return
    }

    if (consumptionFormData.quantity <= 0) {
      toast.error('Quantity must be greater than 0')
      return
    }

    // Validate quantity against available inventory
    const selectedMaterial = availableInventory.find(i => i.material_id === consumptionFormData.material_id)
    if (selectedMaterial) {
      // For editing, we need to add back the original quantity to the available
      let availableForValidation = selectedMaterial.available_quantity
      if (editingConsumption && editingConsumption.material_id === consumptionFormData.material_id) {
        availableForValidation += editingConsumption.quantity
      }

      if (consumptionFormData.quantity > availableForValidation) {
        toast.error(`Cannot consume more than available (${availableForValidation.toLocaleString('en-IN', { maximumFractionDigits: 3 })} ${selectedMaterial.unit})`)
        return
      }
    }

    setSaving(true)

    try {
      const selectedMaterial = availableInventory.find(i => i.material_id === consumptionFormData.material_id)

      if (editingConsumption) {
        const { error } = await supabase
          .from('material_consumption')
          .update({
            consumption_date: consumptionFormData.consumption_date,
            material_id: consumptionFormData.material_id,
            material_name: selectedMaterial?.material_name || '',
            quantity: consumptionFormData.quantity,
            unit: selectedMaterial?.unit || '',
            notes: consumptionFormData.notes || null
          })
          .eq('id', editingConsumption.id)

        if (error) throw error
        toast.success('Consumption record updated')
      } else {
        const { error } = await supabase
          .from('material_consumption')
          .insert({
            line_item_id: selectedLineItemForConsumption?.id,
            site_id: headline?.packages?.sites?.id,
            material_id: consumptionFormData.material_id,
            material_name: selectedMaterial?.material_name || '',
            consumption_date: consumptionFormData.consumption_date,
            quantity: consumptionFormData.quantity,
            unit: selectedMaterial?.unit || '',
            notes: consumptionFormData.notes || null
          })

        if (error) throw error
        toast.success('Consumption recorded')
      }

      setConsumptionDialogOpen(false)
      fetchData()
    } catch (error) {
      console.error('Error saving consumption:', error)
      toast.error('Failed to save consumption')
    } finally {
      setSaving(false)
    }
  }

  async function deleteConsumption(id: string) {
    if (!confirm('Delete this consumption record?')) {
      return
    }

    try {
      const { error } = await supabase
        .from('material_consumption')
        .delete()
        .eq('id', id)

      if (error) throw error
      toast.success('Consumption deleted')
      fetchData()
    } catch (error) {
      console.error('Error deleting consumption:', error)
      toast.error('Failed to delete consumption')
    }
  }

  function toggleConsumptionExpand(lineItemId: string) {
    const newExpanded = new Set(expandedConsumptions)
    if (newExpanded.has(lineItemId)) {
      newExpanded.delete(lineItemId)
    } else {
      newExpanded.add(lineItemId)
    }
    setExpandedConsumptions(newExpanded)
  }

  function getConsumptionsForLineItem(lineItemId: string) {
    return consumptions.filter(c => c.line_item_id === lineItemId)
  }

  async function updateLineItemStatus(lineItemId: string, field: 'checklist_status' | 'jmr_status', value: string) {
    try {
      const { error } = await supabase
        .from('boq_line_items')
        .update({ [field]: value })
        .eq('id', lineItemId)

      if (error) throw error

      // Update local state
      setLineItems(items =>
        items.map(item =>
          item.id === lineItemId ? { ...item, [field]: value } : item
        )
      )
      toast.success('Status updated')
    } catch (error) {
      console.error('Error updating status:', error)
      toast.error('Failed to update status')
    }
  }

  function getStatusOption(options: typeof checklistStatusOptions, value: string) {
    return options.find(opt => opt.value === value) || options[1] // Default to 'pending'
  }

  const statusColors: Record<string, string> = {
    pending: 'bg-slate-100 text-slate-700',
    in_progress: 'bg-blue-100 text-blue-700',
    completed: 'bg-green-100 text-green-700',
    billed: 'bg-purple-100 text-purple-700',
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
            <div className="grid grid-cols-2 gap-4 text-center">
              <div className="bg-slate-50 rounded-lg p-3">
                <p className="text-2xl font-semibold">{lineItems.length}</p>
                <p className="text-sm text-slate-500">Line Items</p>
              </div>
              <div className="bg-purple-50 rounded-lg p-3">
                <p className="text-2xl font-semibold text-purple-700">{completedChecklistItems}/{totalChecklistItems}</p>
                <p className="text-sm text-purple-600">Checklist</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Tabs for Line Items, Checklists, and JMR */}
        <Tabs defaultValue="lineitems" className="space-y-4">
          <TabsList className="grid w-full grid-cols-3 max-w-xl">
            <TabsTrigger value="lineitems" className="flex items-center gap-2">
              <Package className="h-4 w-4" />
              Line Items
            </TabsTrigger>
            <TabsTrigger value="checklists" className="flex items-center gap-2">
              <ClipboardCheck className="h-4 w-4" />
              Checklists
            </TabsTrigger>
            <TabsTrigger value="jmr" className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              JMR
            </TabsTrigger>
          </TabsList>

          <TabsContent value="lineitems">
            <Card>
              <CardHeader>
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <div>
                    <CardTitle>BOQ Line Items</CardTitle>
                    <CardDescription>
                      Manage line items for this BOQ headline
                    </CardDescription>
                  </div>
                  <Button onClick={openAddLineItemDialog}>
                    <Plus className="h-4 w-4 mr-2" />
                    Add Line Item
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {lineItems.length === 0 ? (
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
                  lineItems.map((lineItem) => {
                    const lineItemConsumptions = getConsumptionsForLineItem(lineItem.id)
                    return (
                    <div key={lineItem.id} className="border rounded-lg bg-slate-50">
                      <div className="p-4">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="font-mono font-medium text-blue-600">{lineItem.item_number}</span>
                            </div>
                            <p className="text-sm text-slate-700 mb-2">
                              {lineItem.description}
                            </p>
                            <div className="flex flex-wrap items-center gap-3 text-sm text-slate-500">
                              <span className="font-medium">{lineItem.quantity} {lineItem.unit}</span>
                              {lineItem.location && (
                                <span className="flex items-center gap-1">
                                  <Building2 className="h-3 w-3" />
                                  {lineItem.location}
                                </span>
                              )}
                              {lineItemConsumptions.length > 0 && (
                                <Badge variant="secondary" className="text-xs">
                                  <Flame className="h-3 w-3 mr-1" />
                                  {lineItemConsumptions.length} consumption{lineItemConsumptions.length !== 1 ? 's' : ''}
                                </Badge>
                              )}
                            </div>
                            {/* Progress Status Row */}
                            <div className="flex flex-wrap items-center gap-4 mt-3 pt-3 border-t border-slate-200">
                              <div className="flex items-center gap-2">
                                <ClipboardCheck className="h-4 w-4 text-slate-400" />
                                <span className="text-xs text-slate-500 font-medium">Checklist:</span>
                                <Select
                                  value={lineItem.checklist_status || 'pending'}
                                  onValueChange={(value) => updateLineItemStatus(lineItem.id, 'checklist_status', value)}
                                >
                                  <SelectTrigger className="h-7 w-[130px] text-xs">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {checklistStatusOptions.map((option) => (
                                      <SelectItem key={option.value} value={option.value}>
                                        <span className={`px-1.5 py-0.5 rounded text-xs ${option.color}`}>
                                          {option.label}
                                        </span>
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                              <div className="flex items-center gap-2">
                                <FileText className="h-4 w-4 text-slate-400" />
                                <span className="text-xs text-slate-500 font-medium">JMR:</span>
                                <Select
                                  value={lineItem.jmr_status || 'pending'}
                                  onValueChange={(value) => updateLineItemStatus(lineItem.id, 'jmr_status', value)}
                                >
                                  <SelectTrigger className="h-7 w-[130px] text-xs">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {jmrStatusOptions.map((option) => (
                                      <SelectItem key={option.value} value={option.value}>
                                        <span className={`px-1.5 py-0.5 rounded text-xs ${option.color}`}>
                                          {option.label}
                                        </span>
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              className="text-orange-600 border-orange-200 hover:bg-orange-50 hover:text-orange-700"
                              onClick={() => openConsumptionDialog(lineItem)}
                            >
                              <Flame className="h-4 w-4 mr-1.5" />
                              Record Consumption
                            </Button>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon">
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => openEditLineItemDialog(lineItem)}>
                                  <Pencil className="h-4 w-4 mr-2" />
                                  Edit
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
                        </div>
                      </div>

                      {/* Consumption History */}
                      {lineItemConsumptions.length > 0 && (
                        <Collapsible
                          open={expandedConsumptions.has(lineItem.id)}
                          onOpenChange={() => toggleConsumptionExpand(lineItem.id)}
                        >
                          <CollapsibleTrigger asChild>
                            <div className="border-t px-4 py-2 cursor-pointer hover:bg-slate-100 transition-colors flex items-center justify-between">
                              <span className="text-sm font-medium text-slate-600 flex items-center gap-2">
                                {expandedConsumptions.has(lineItem.id) ? (
                                  <ChevronDown className="h-4 w-4" />
                                ) : (
                                  <ChevronRight className="h-4 w-4" />
                                )}
                                Consumption History
                              </span>
                              <Badge variant="outline" className="text-xs">
                                {lineItemConsumptions.length} record{lineItemConsumptions.length !== 1 ? 's' : ''}
                              </Badge>
                            </div>
                          </CollapsibleTrigger>
                          <CollapsibleContent>
                            <div className="px-4 pb-4 space-y-2">
                              {lineItemConsumptions.map((consumption) => (
                                <div
                                  key={consumption.id}
                                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 bg-white border rounded-md"
                                >
                                  <div className="flex-1 min-w-0">
                                    <div className="font-medium text-sm">{consumption.material_name}</div>
                                    <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 mt-1">
                                      <span className="flex items-center gap-1">
                                        <Calendar className="h-3 w-3" />
                                        {new Date(consumption.consumption_date).toLocaleDateString('en-IN')}
                                      </span>
                                      <span className="font-semibold text-orange-600">
                                        {consumption.quantity.toLocaleString('en-IN', { maximumFractionDigits: 3 })} {consumption.unit}
                                      </span>
                                    </div>
                                    {consumption.notes && (
                                      <p className="text-xs text-slate-500 mt-1">{consumption.notes}</p>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-1">
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-8 w-8"
                                      onClick={() => openEditConsumptionDialog(consumption)}
                                    >
                                      <Pencil className="h-3 w-3" />
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-8 w-8 text-red-600 hover:text-red-700"
                                      onClick={() => deleteConsumption(consumption.id)}
                                    >
                                      <Trash2 className="h-3 w-3" />
                                    </Button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </CollapsibleContent>
                        </Collapsible>
                      )}
                    </div>
                  )
                  })
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

          <TabsContent value="jmr">
            <BOQJMRTab
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

      {/* Consumption Dialog */}
      <Dialog open={consumptionDialogOpen} onOpenChange={setConsumptionDialogOpen}>
        <DialogContent className="max-w-md">
          <form onSubmit={handleSaveConsumption}>
            <DialogHeader>
              <DialogTitle>{editingConsumption ? 'Edit Consumption' : 'Record Consumption'}</DialogTitle>
              <DialogDescription>
                {selectedLineItemForConsumption && (
                  <span className="block mt-1">
                    For: <span className="font-medium">{selectedLineItemForConsumption.item_number}</span> - {selectedLineItemForConsumption.description.substring(0, 50)}...
                  </span>
                )}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="consumption_date">Date *</Label>
                <Input
                  id="consumption_date"
                  type="date"
                  value={consumptionFormData.consumption_date}
                  onChange={(e) => setConsumptionFormData({ ...consumptionFormData, consumption_date: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="material">Material *</Label>
                {loadingInventory ? (
                  <div className="text-sm text-slate-500 py-2">Loading available materials...</div>
                ) : availableInventory.length === 0 ? (
                  <div className="text-sm text-slate-500 py-2 bg-amber-50 border border-amber-200 rounded-md px-3">
                    No materials available in inventory for this site. Record materials via GRN first.
                  </div>
                ) : (
                  <Select
                    value={consumptionFormData.material_id}
                    onValueChange={(value) => setConsumptionFormData({ ...consumptionFormData, material_id: value, quantity: 0 })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select material" />
                    </SelectTrigger>
                    <SelectContent>
                      {availableInventory.map((item) => (
                        <SelectItem key={item.material_id} value={item.material_id}>
                          <div className="flex justify-between items-center w-full">
                            <span className="truncate">{item.material_name}</span>
                            <span className="text-xs text-slate-500 ml-2">
                              ({item.available_quantity.toLocaleString('en-IN', { maximumFractionDigits: 3 })} {item.unit})
                            </span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
              {consumptionFormData.material_id && (
                <div className="space-y-2">
                  <Label htmlFor="consumption_quantity">
                    Quantity *
                    {(() => {
                      const selected = availableInventory.find(i => i.material_id === consumptionFormData.material_id)
                      if (selected) {
                        let availableForDisplay = selected.available_quantity
                        if (editingConsumption && editingConsumption.material_id === consumptionFormData.material_id) {
                          availableForDisplay += editingConsumption.quantity
                        }
                        return (
                          <span className="text-xs text-slate-500 ml-2">
                            (Available: {availableForDisplay.toLocaleString('en-IN', { maximumFractionDigits: 3 })} {selected.unit})
                          </span>
                        )
                      }
                      return null
                    })()}
                  </Label>
                  <Input
                    id="consumption_quantity"
                    type="number"
                    step="0.001"
                    min="0.001"
                    value={consumptionFormData.quantity || ''}
                    onChange={(e) => setConsumptionFormData({ ...consumptionFormData, quantity: parseFloat(e.target.value) || 0 })}
                    placeholder="Enter quantity"
                    required
                  />
                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor="consumption_notes">Notes (Optional)</Label>
                <Textarea
                  id="consumption_notes"
                  placeholder="Any additional details..."
                  value={consumptionFormData.notes}
                  onChange={(e) => setConsumptionFormData({ ...consumptionFormData, notes: e.target.value })}
                  rows={2}
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setConsumptionDialogOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={saving || !consumptionFormData.material_id || consumptionFormData.quantity <= 0}>
                {saving ? 'Saving...' : 'Save'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

    </div>
  )
}
