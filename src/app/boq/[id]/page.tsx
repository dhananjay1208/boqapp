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
  ChevronDown,
  ChevronRight,
  Calendar,
  Wrench,
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

interface WorkstationConsumption {
  id: string
  line_item_id: string
  material_name: string
  quantity: number
  unit: string
  entry_date: string
  workstation_name: string
  notes: string | null
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
  // Workstation Consumption (read-only from workstation module)
  const [workstationConsumptions, setWorkstationConsumptions] = useState<WorkstationConsumption[]>([])
  const [expandedConsumptions, setExpandedConsumptions] = useState<Set<string>>(new Set())

  // Progress State - Upto Date quantities from workstation progress entries
  const [progressByLineItem, setProgressByLineItem] = useState<Record<string, number>>({})

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

      // Fetch workstation consumptions for all line items in this headline
      if (lineItemsData && lineItemsData.length > 0) {
        const lineItemIds = lineItemsData.map(li => li.id)

        // Fetch from workstation_material_consumption with joins
        const { data: wsConsumptionsData, error: wsConsumptionsError } = await supabase
          .from('workstation_material_consumption')
          .select(`
            id,
            material_name,
            quantity,
            unit,
            notes,
            workstation_boq_progress!inner (
              boq_line_item_id,
              entry_date,
              site_workstation:site_workstations!inner (
                workstation:master_workstations (
                  name
                )
              )
            )
          `)

        if (wsConsumptionsError) {
          console.error('Error fetching workstation consumptions:', wsConsumptionsError)
        } else {
          // Transform the data and filter by line item IDs
          const transformedConsumptions: WorkstationConsumption[] = (wsConsumptionsData || [])
            .filter((wc: any) => lineItemIds.includes(wc.workstation_boq_progress?.boq_line_item_id))
            .map((wc: any) => ({
              id: wc.id,
              line_item_id: wc.workstation_boq_progress?.boq_line_item_id,
              material_name: wc.material_name,
              quantity: wc.quantity,
              unit: wc.unit,
              entry_date: wc.workstation_boq_progress?.entry_date,
              workstation_name: Array.isArray(wc.workstation_boq_progress?.site_workstation?.workstation)
                ? wc.workstation_boq_progress?.site_workstation?.workstation[0]?.name
                : wc.workstation_boq_progress?.site_workstation?.workstation?.name || 'Unknown',
              notes: wc.notes
            }))
            .sort((a: WorkstationConsumption, b: WorkstationConsumption) =>
              new Date(b.entry_date).getTime() - new Date(a.entry_date).getTime()
            )

          setWorkstationConsumptions(transformedConsumptions)
        }

        // Fetch workstation progress (for Upto Date quantity calculation)
        const { data: progressData, error: progressError } = await supabase
          .from('workstation_boq_progress')
          .select('boq_line_item_id, quantity')
          .in('boq_line_item_id', lineItemIds)

        if (progressError) {
          console.error('Error fetching progress data:', progressError)
        } else {
          // Aggregate quantities by line item (sum across all workstations)
          const progressMap: Record<string, number> = {}
          progressData?.forEach(entry => {
            const lineItemId = entry.boq_line_item_id
            progressMap[lineItemId] = (progressMap[lineItemId] || 0) + (entry.quantity || 0)
          })
          setProgressByLineItem(progressMap)
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

  // Workstation Consumption helper functions
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
    return workstationConsumptions.filter(c => c.line_item_id === lineItemId)
  }

  function getLineItemProgress(lineItemId: string, boqQty: number) {
    const uptodateQty = progressByLineItem[lineItemId] || 0
    const remaining = Math.max(0, boqQty - uptodateQty)
    const percentage = boqQty > 0 ? Math.min(100, (uptodateQty / boqQty) * 100) : 0
    const isOverExecuted = uptodateQty > boqQty
    return { uptodateQty, remaining, percentage, isOverExecuted }
  }

  function getProgressBarColor(percentage: number, isOverExecuted: boolean) {
    if (isOverExecuted) return 'bg-blue-500'
    if (percentage >= 75) return 'bg-green-500'
    if (percentage >= 25) return 'bg-amber-500'
    return 'bg-red-500'
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
                    const progress = getLineItemProgress(lineItem.id, lineItem.quantity)
                    return (
                    <div key={lineItem.id} className="border rounded-lg bg-slate-50">
                      <div className="p-4">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="font-mono font-medium text-blue-600">{lineItem.item_number}</span>
                              {lineItem.location && (
                                <span className="flex items-center gap-1 text-xs text-slate-500">
                                  <Building2 className="h-3 w-3" />
                                  {lineItem.location}
                                </span>
                              )}
                            </div>
                            <p className="text-sm text-slate-700 mb-3">
                              {lineItem.description}
                            </p>

                            {/* Progress Summary */}
                            <div className="bg-white border rounded-lg p-3 mb-3">
                              <div className="grid grid-cols-3 gap-4 text-center mb-2">
                                <div>
                                  <p className="text-xs text-slate-500 mb-1">BOQ Qty</p>
                                  <p className="font-semibold text-slate-900">
                                    {lineItem.quantity.toLocaleString('en-IN', { maximumFractionDigits: 3 })} <span className="text-xs font-normal text-slate-500">{lineItem.unit}</span>
                                  </p>
                                </div>
                                <div>
                                  <p className="text-xs text-slate-500 mb-1">Upto Date</p>
                                  <p className={`font-semibold ${progress.isOverExecuted ? 'text-blue-600' : 'text-green-600'}`}>
                                    {progress.uptodateQty.toLocaleString('en-IN', { maximumFractionDigits: 3 })} <span className="text-xs font-normal text-slate-500">{lineItem.unit}</span>
                                  </p>
                                </div>
                                <div>
                                  <p className="text-xs text-slate-500 mb-1">Remaining</p>
                                  <p className={`font-semibold ${progress.remaining > 0 ? 'text-amber-600' : 'text-slate-400'}`}>
                                    {progress.remaining.toLocaleString('en-IN', { maximumFractionDigits: 3 })} <span className="text-xs font-normal text-slate-500">{lineItem.unit}</span>
                                  </p>
                                </div>
                              </div>
                              {/* Progress Bar */}
                              <div className="flex items-center gap-2">
                                <div className="flex-1 bg-slate-200 rounded-full h-2 overflow-hidden">
                                  <div
                                    className={`h-2 rounded-full transition-all ${getProgressBarColor(progress.percentage, progress.isOverExecuted)}`}
                                    style={{ width: `${Math.min(100, progress.percentage)}%` }}
                                  />
                                </div>
                                <span className={`text-xs font-medium min-w-[40px] text-right ${
                                  progress.isOverExecuted ? 'text-blue-600' :
                                  progress.percentage >= 75 ? 'text-green-600' :
                                  progress.percentage >= 25 ? 'text-amber-600' : 'text-red-600'
                                }`}>
                                  {progress.percentage.toFixed(0)}%
                                </span>
                              </div>
                            </div>

                            <div className="flex flex-wrap items-center gap-3 text-sm text-slate-500">
                              {lineItemConsumptions.length > 0 && (
                                <Badge variant="secondary" className="text-xs">
                                  <Wrench className="h-3 w-3 mr-1" />
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
                                  className="p-3 bg-white border rounded-md"
                                >
                                  <div className="flex items-start justify-between">
                                    <div className="font-medium text-sm">{consumption.material_name}</div>
                                    <Badge variant="secondary" className="text-xs">
                                      {consumption.workstation_name}
                                    </Badge>
                                  </div>
                                  <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 mt-1">
                                    <span className="flex items-center gap-1">
                                      <Calendar className="h-3 w-3" />
                                      {new Date(consumption.entry_date).toLocaleDateString('en-IN')}
                                    </span>
                                    <span className="font-semibold text-orange-600">
                                      {consumption.quantity.toLocaleString('en-IN', { maximumFractionDigits: 3 })} {consumption.unit}
                                    </span>
                                  </div>
                                  {consumption.notes && (
                                    <p className="text-xs text-slate-500 mt-1 italic">"{consumption.notes}"</p>
                                  )}
                                </div>
                              ))}
                              <p className="text-xs text-slate-400 text-center pt-2">
                                Consumption is recorded from the Workstations module
                              </p>
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

    </div>
  )
}
