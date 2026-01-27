'use client'

import { useState, useEffect, useMemo } from 'react'
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
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import {
  Wrench,
  Plus,
  ArrowLeft,
  Building2,
  Loader2,
  ChevronDown,
  ChevronRight,
  Pencil,
  Trash2,
  Package,
  X,
  Check,
  ChevronsUpDown,
  Search,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'

// Types
interface Site {
  id: string
  name: string
}

interface MasterWorkstation {
  id: string
  name: string
  description: string | null
}

interface SiteWorkstation {
  id: string
  site_id: string
  workstation_id: string
  workstation?: MasterWorkstation
  is_active: boolean
}

interface BOQHeadline {
  id: string
  serial_number: number
  name: string
  package_id: string
}

interface BOQLineItem {
  id: string
  headline_id: string
  item_number: string
  description: string
  unit: string
  quantity: number
}

interface WorkstationBOQProgress {
  id: string
  site_workstation_id: string
  boq_line_item_id: string
  boq_line_item?: BOQLineItem
  entry_date: string
  quantity: number
  notes: string | null
  material_consumption?: WorkstationMaterialConsumption[]
  created_at: string
}

interface WorkstationMaterialConsumption {
  id: string
  workstation_boq_progress_id: string
  material_id: string
  material_name: string
  quantity: number
  unit: string
  notes: string | null
}

interface MasterMaterial {
  id: string
  name: string
  unit: string
  category: string
}

interface PackageData {
  id: string
  name: string
  site_id: string
}

interface BOQItemProgress {
  boq_line_item_id: string
  item_number: string
  description: string
  unit: string
  boq_quantity: number
  previous_quantity: number
  new_quantity: number
  upto_date_quantity: number
}

interface MaterialConsumptionInput {
  material_id: string
  material_name: string
  quantity: string
  unit: string
  popoverOpen?: boolean
  searchTerm?: string
}

export default function WorkstationsPage() {
  // Main state
  const [sites, setSites] = useState<Site[]>([])
  const [selectedSiteId, setSelectedSiteId] = useState<string>('')
  const [masterWorkstations, setMasterWorkstations] = useState<MasterWorkstation[]>([])
  const [siteWorkstations, setSiteWorkstations] = useState<SiteWorkstation[]>([])
  const [packages, setPackages] = useState<PackageData[]>([])
  const [headlines, setHeadlines] = useState<BOQHeadline[]>([])
  const [lineItems, setLineItems] = useState<BOQLineItem[]>([])
  const [masterMaterials, setMasterMaterials] = useState<MasterMaterial[]>([])

  // View state
  const [selectedWorkstation, setSelectedWorkstation] = useState<SiteWorkstation | null>(null)
  const [progressEntries, setProgressEntries] = useState<WorkstationBOQProgress[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingProgress, setLoadingProgress] = useState(false)

  // Dialog states
  const [assignDialogOpen, setAssignDialogOpen] = useState(false)
  const [progressDialogOpen, setProgressDialogOpen] = useState(false)
  const [editingProgress, setEditingProgress] = useState<WorkstationBOQProgress | null>(null)
  const [saving, setSaving] = useState(false)

  // Assign workstation form
  const [selectedWorkstationId, setSelectedWorkstationId] = useState<string>('')

  // Progress form state
  const [progressFormData, setProgressFormData] = useState({
    entry_date: new Date().toISOString().split('T')[0],
    headline_id: '',
    boq_line_item_id: '',
    quantity: '',
    notes: '',
  })
  const [materialConsumptions, setMaterialConsumptions] = useState<MaterialConsumptionInput[]>([])

  // Collapsible date sections
  const [expandedDates, setExpandedDates] = useState<Set<string>>(new Set())

  useEffect(() => {
    fetchInitialData()
  }, [])

  useEffect(() => {
    if (selectedSiteId) {
      fetchSiteWorkstations()
      fetchSitePackagesAndHeadlines()
    } else {
      setSiteWorkstations([])
      setPackages([])
      setHeadlines([])
      setLineItems([])
    }
  }, [selectedSiteId])

  useEffect(() => {
    if (selectedWorkstation) {
      fetchProgressEntries()
    } else {
      setProgressEntries([])
    }
  }, [selectedWorkstation])

  async function fetchInitialData() {
    try {
      const [sitesRes, workstationsRes, materialsRes] = await Promise.all([
        supabase.from('sites').select('id, name').order('name'),
        supabase.from('master_workstations').select('id, name, description').eq('is_active', true).order('name'),
        supabase.from('master_materials').select('id, name, unit, category').eq('is_active', true).order('name'),
      ])

      setSites(sitesRes.data || [])
      setMasterWorkstations(workstationsRes.data || [])
      setMasterMaterials(materialsRes.data || [])
    } catch (error) {
      console.error('Error fetching initial data:', error)
      toast.error('Failed to load data')
    } finally {
      setLoading(false)
    }
  }

  async function fetchSiteWorkstations() {
    try {
      const { data, error } = await supabase
        .from('site_workstations')
        .select(`
          id,
          site_id,
          workstation_id,
          is_active,
          workstation:master_workstations(id, name, description)
        `)
        .eq('site_id', selectedSiteId)
        .eq('is_active', true)

      if (error) throw error
      // Transform workstation from array to single object (Supabase returns array for joins)
      const transformedData = (data || []).map((sw: any) => ({
        ...sw,
        workstation: Array.isArray(sw.workstation) ? sw.workstation[0] : sw.workstation
      }))
      setSiteWorkstations(transformedData)
    } catch (error) {
      console.error('Error fetching site workstations:', error)
      toast.error('Failed to load workstations')
    }
  }

  async function fetchSitePackagesAndHeadlines() {
    try {
      // Fetch packages for site
      const { data: packagesData, error: packagesError } = await supabase
        .from('packages')
        .select('id, name, site_id')
        .eq('site_id', selectedSiteId)

      if (packagesError) throw packagesError
      setPackages(packagesData || [])

      if (packagesData && packagesData.length > 0) {
        const packageIds = packagesData.map(p => p.id)

        // Fetch headlines
        const { data: headlinesData, error: headlinesError } = await supabase
          .from('boq_headlines')
          .select('id, serial_number, name, package_id')
          .in('package_id', packageIds)
          .order('serial_number')

        if (headlinesError) throw headlinesError
        setHeadlines(headlinesData || [])

        if (headlinesData && headlinesData.length > 0) {
          const headlineIds = headlinesData.map(h => h.id)

          // Fetch line items
          const { data: lineItemsData, error: lineItemsError } = await supabase
            .from('boq_line_items')
            .select('id, headline_id, item_number, description, unit, quantity')
            .in('headline_id', headlineIds)
            .order('item_number')

          if (lineItemsError) throw lineItemsError
          setLineItems(lineItemsData || [])
        }
      } else {
        setHeadlines([])
        setLineItems([])
      }
    } catch (error) {
      console.error('Error fetching packages and headlines:', error)
    }
  }

  async function fetchProgressEntries() {
    if (!selectedWorkstation) return

    setLoadingProgress(true)
    try {
      const { data, error } = await supabase
        .from('workstation_boq_progress')
        .select(`
          id,
          site_workstation_id,
          boq_line_item_id,
          entry_date,
          quantity,
          notes,
          created_at,
          boq_line_item:boq_line_items(id, item_number, description, unit, quantity),
          material_consumption:workstation_material_consumption(
            id,
            material_id,
            material_name,
            quantity,
            unit,
            notes
          )
        `)
        .eq('site_workstation_id', selectedWorkstation.id)
        .order('entry_date', { ascending: false })
        .order('created_at', { ascending: false })

      if (error) throw error
      // Transform boq_line_item from array to single object (Supabase returns array for joins)
      const transformedData = (data || []).map((entry: any) => ({
        ...entry,
        boq_line_item: Array.isArray(entry.boq_line_item) ? entry.boq_line_item[0] : entry.boq_line_item
      }))
      setProgressEntries(transformedData)

      // Auto-expand the first date
      if (transformedData && transformedData.length > 0) {
        setExpandedDates(new Set([transformedData[0].entry_date]))
      }
    } catch (error) {
      console.error('Error fetching progress entries:', error)
      toast.error('Failed to load progress entries')
    } finally {
      setLoadingProgress(false)
    }
  }

  async function handleAssignWorkstation() {
    if (!selectedWorkstationId || !selectedSiteId) {
      toast.error('Please select a workstation')
      return
    }

    setSaving(true)
    try {
      const { error } = await supabase
        .from('site_workstations')
        .insert({
          site_id: selectedSiteId,
          workstation_id: selectedWorkstationId,
        })

      if (error) {
        if (error.code === '23505') {
          toast.error('This workstation is already assigned to this site')
        } else {
          throw error
        }
        return
      }

      toast.success('Workstation assigned successfully')
      setAssignDialogOpen(false)
      setSelectedWorkstationId('')
      fetchSiteWorkstations()
    } catch (error: any) {
      console.error('Error assigning workstation:', error)
      toast.error(error?.message || 'Failed to assign workstation')
    } finally {
      setSaving(false)
    }
  }

  async function handleRemoveWorkstation(siteWorkstation: SiteWorkstation) {
    if (!confirm(`Remove "${siteWorkstation.workstation?.name}" from this site?`)) return

    try {
      const { error } = await supabase
        .from('site_workstations')
        .update({ is_active: false })
        .eq('id', siteWorkstation.id)

      if (error) throw error
      toast.success('Workstation removed')
      fetchSiteWorkstations()
    } catch (error) {
      console.error('Error removing workstation:', error)
      toast.error('Failed to remove workstation')
    }
  }

  function openAddProgressDialog() {
    setEditingProgress(null)
    setProgressFormData({
      entry_date: new Date().toISOString().split('T')[0],
      headline_id: '',
      boq_line_item_id: '',
      quantity: '',
      notes: '',
    })
    setMaterialConsumptions([])
    setProgressDialogOpen(true)
  }

  function openEditProgressDialog(progress: WorkstationBOQProgress) {
    setEditingProgress(progress)

    // Find headline for the line item
    const lineItem = lineItems.find(li => li.id === progress.boq_line_item_id)
    const headlineId = lineItem?.headline_id || ''

    setProgressFormData({
      entry_date: progress.entry_date,
      headline_id: headlineId,
      boq_line_item_id: progress.boq_line_item_id,
      quantity: progress.quantity.toString(),
      notes: progress.notes || '',
    })

    // Load existing material consumptions
    setMaterialConsumptions(
      (progress.material_consumption || []).map(mc => ({
        material_id: mc.material_id,
        material_name: mc.material_name,
        quantity: mc.quantity.toString(),
        unit: mc.unit,
      }))
    )
    setProgressDialogOpen(true)
  }

  async function handleSaveProgress() {
    if (!selectedWorkstation) return

    if (!progressFormData.boq_line_item_id) {
      toast.error('Please select a BOQ line item')
      return
    }

    // Quantity is optional - allow 0 or empty for material-only entries
    const quantity = progressFormData.quantity ? parseFloat(progressFormData.quantity) : 0

    setSaving(true)
    try {
      if (editingProgress) {
        // Update progress entry
        const { error: progressError } = await supabase
          .from('workstation_boq_progress')
          .update({
            boq_line_item_id: progressFormData.boq_line_item_id,
            entry_date: progressFormData.entry_date,
            quantity: quantity,
            notes: progressFormData.notes.trim() || null,
          })
          .eq('id', editingProgress.id)

        if (progressError) throw progressError

        // Delete existing material consumptions
        await supabase
          .from('workstation_material_consumption')
          .delete()
          .eq('workstation_boq_progress_id', editingProgress.id)

        // Insert new material consumptions
        if (materialConsumptions.length > 0) {
          const validConsumptions = materialConsumptions.filter(mc => mc.material_id && parseFloat(mc.quantity) > 0)
          if (validConsumptions.length > 0) {
            const { error: consumptionError } = await supabase
              .from('workstation_material_consumption')
              .insert(
                validConsumptions.map(mc => ({
                  workstation_boq_progress_id: editingProgress.id,
                  material_id: mc.material_id,
                  material_name: mc.material_name,
                  quantity: parseFloat(mc.quantity),
                  unit: mc.unit,
                }))
              )

            if (consumptionError) throw consumptionError
          }
        }

        toast.success('Progress updated successfully')
      } else {
        // Create new progress entry
        const { data: progressData, error: progressError } = await supabase
          .from('workstation_boq_progress')
          .insert({
            site_workstation_id: selectedWorkstation.id,
            boq_line_item_id: progressFormData.boq_line_item_id,
            entry_date: progressFormData.entry_date,
            quantity: quantity,
            notes: progressFormData.notes.trim() || null,
          })
          .select()
          .single()

        if (progressError) throw progressError

        // Insert material consumptions
        if (materialConsumptions.length > 0) {
          const validConsumptions = materialConsumptions.filter(mc => mc.material_id && parseFloat(mc.quantity) > 0)
          if (validConsumptions.length > 0) {
            const { error: consumptionError } = await supabase
              .from('workstation_material_consumption')
              .insert(
                validConsumptions.map(mc => ({
                  workstation_boq_progress_id: progressData.id,
                  material_id: mc.material_id,
                  material_name: mc.material_name,
                  quantity: parseFloat(mc.quantity),
                  unit: mc.unit,
                }))
              )

            if (consumptionError) throw consumptionError
          }
        }

        toast.success('Progress entry added successfully')
      }

      setProgressDialogOpen(false)
      fetchProgressEntries()
    } catch (error: any) {
      console.error('Error saving progress:', error)
      toast.error(error?.message || 'Failed to save progress')
    } finally {
      setSaving(false)
    }
  }

  async function handleDeleteProgress(progress: WorkstationBOQProgress) {
    if (!confirm('Delete this progress entry? This action cannot be undone.')) return

    try {
      const { error } = await supabase
        .from('workstation_boq_progress')
        .delete()
        .eq('id', progress.id)

      if (error) throw error
      toast.success('Progress entry deleted')
      fetchProgressEntries()
    } catch (error) {
      console.error('Error deleting progress:', error)
      toast.error('Failed to delete progress entry')
    }
  }

  function addMaterialConsumption() {
    setMaterialConsumptions([...materialConsumptions, { material_id: '', material_name: '', quantity: '', unit: '', popoverOpen: false, searchTerm: '' }])
  }

  function setMaterialPopoverOpen(index: number, open: boolean) {
    const updated = [...materialConsumptions]
    updated[index] = { ...updated[index], popoverOpen: open, searchTerm: open ? '' : updated[index].searchTerm }
    setMaterialConsumptions(updated)
  }

  function setMaterialSearchTerm(index: number, term: string) {
    const updated = [...materialConsumptions]
    updated[index] = { ...updated[index], searchTerm: term }
    setMaterialConsumptions(updated)
  }

  function selectMaterial(index: number, material: MasterMaterial) {
    const updated = [...materialConsumptions]
    updated[index] = {
      ...updated[index],
      material_id: material.id,
      material_name: material.name,
      unit: material.unit,
      popoverOpen: false,
      searchTerm: ''
    }
    setMaterialConsumptions(updated)
  }

  function getFilteredMaterials(searchTerm: string) {
    if (!searchTerm) return masterMaterials
    const term = searchTerm.toLowerCase()
    return masterMaterials.filter(m =>
      m.name.toLowerCase().includes(term) ||
      m.category?.toLowerCase().includes(term)
    )
  }

  function updateMaterialConsumption(index: number, field: keyof MaterialConsumptionInput, value: string) {
    const updated = [...materialConsumptions]
    updated[index] = { ...updated[index], [field]: value }

    // Auto-fill name and unit when material is selected
    if (field === 'material_id') {
      const material = masterMaterials.find(m => m.id === value)
      if (material) {
        updated[index].material_name = material.name
        updated[index].unit = material.unit
      }
    }

    setMaterialConsumptions(updated)
  }

  function removeMaterialConsumption(index: number) {
    setMaterialConsumptions(materialConsumptions.filter((_, i) => i !== index))
  }

  function toggleDateExpanded(date: string) {
    const newExpanded = new Set(expandedDates)
    if (newExpanded.has(date)) {
      newExpanded.delete(date)
    } else {
      newExpanded.add(date)
    }
    setExpandedDates(newExpanded)
  }

  // Compute workstation stats for cards
  const workstationStats = useMemo(() => {
    const stats: Record<string, { boqItemCount: number; totalQty: number }> = {}
    siteWorkstations.forEach(sw => {
      stats[sw.id] = { boqItemCount: 0, totalQty: 0 }
    })
    return stats
  }, [siteWorkstations])

  // Compute BOQ progress summary for detail view
  const boqProgressSummary = useMemo<BOQItemProgress[]>(() => {
    if (!selectedWorkstation || progressEntries.length === 0) return []

    // Group entries by line item
    const entriesByLineItem: Record<string, WorkstationBOQProgress[]> = {}
    progressEntries.forEach(entry => {
      if (!entriesByLineItem[entry.boq_line_item_id]) {
        entriesByLineItem[entry.boq_line_item_id] = []
      }
      entriesByLineItem[entry.boq_line_item_id].push(entry)
    })

    // Calculate Previous, New, Upto-Date for each line item
    return Object.entries(entriesByLineItem).map(([lineItemId, entries]) => {
      // Sort by date and created_at
      const sortedEntries = [...entries].sort((a, b) => {
        const dateCompare = a.entry_date.localeCompare(b.entry_date)
        if (dateCompare !== 0) return dateCompare
        return new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      })

      const boqLineItem = entries[0]?.boq_line_item
      const upto_date_quantity = sortedEntries.reduce((sum, e) => sum + e.quantity, 0)
      const previous_quantity = sortedEntries.slice(0, -1).reduce((sum, e) => sum + e.quantity, 0)
      const new_quantity = sortedEntries.length > 0 ? sortedEntries[sortedEntries.length - 1].quantity : 0

      return {
        boq_line_item_id: lineItemId,
        item_number: boqLineItem?.item_number || '',
        description: boqLineItem?.description || '',
        unit: boqLineItem?.unit || '',
        boq_quantity: boqLineItem?.quantity || 0,
        previous_quantity,
        new_quantity,
        upto_date_quantity,
      }
    }).sort((a, b) => a.item_number.localeCompare(b.item_number))
  }, [selectedWorkstation, progressEntries])

  // Group progress entries by date
  const entriesByDate = useMemo(() => {
    const grouped: Record<string, WorkstationBOQProgress[]> = {}
    progressEntries.forEach(entry => {
      if (!grouped[entry.entry_date]) {
        grouped[entry.entry_date] = []
      }
      grouped[entry.entry_date].push(entry)
    })
    return grouped
  }, [progressEntries])

  // Grand total
  const grandTotal = useMemo(() => {
    return boqProgressSummary.reduce((sum, item) => sum + item.upto_date_quantity, 0)
  }, [boqProgressSummary])

  // Filter line items by selected headline
  const filteredLineItems = useMemo(() => {
    if (!progressFormData.headline_id) return []
    return lineItems.filter(li => li.headline_id === progressFormData.headline_id)
  }, [progressFormData.headline_id, lineItems])

  // Get selected line item details
  const selectedLineItem = useMemo(() => {
    return lineItems.find(li => li.id === progressFormData.boq_line_item_id)
  }, [progressFormData.boq_line_item_id, lineItems])

  // Calculate previous qty for selected line item
  const previousQtyForSelectedItem = useMemo(() => {
    if (!selectedLineItem || !selectedWorkstation) return 0
    const entries = progressEntries.filter(e => e.boq_line_item_id === selectedLineItem.id)
    if (editingProgress) {
      // Exclude the entry being edited
      return entries
        .filter(e => e.id !== editingProgress.id)
        .reduce((sum, e) => sum + e.quantity, 0)
    }
    return entries.reduce((sum, e) => sum + e.quantity, 0)
  }, [selectedLineItem, selectedWorkstation, progressEntries, editingProgress])

  // Available workstations to assign (not already assigned)
  const availableWorkstations = useMemo(() => {
    const assignedIds = new Set(siteWorkstations.map(sw => sw.workstation_id))
    return masterWorkstations.filter(w => !assignedIds.has(w.id))
  }, [masterWorkstations, siteWorkstations])

  if (loading) {
    return (
      <div className="flex flex-col min-h-screen">
        <Header title="Workstation Progress" />
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
      <Header title="Workstation Progress" />

      <div className="flex-1 p-4 md:p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center gap-2">
          <Wrench className="h-6 w-6 text-blue-600" />
          <div>
            <h2 className="text-lg font-semibold">Workstation Progress</h2>
            <p className="text-sm text-slate-500">Track work progress at each workstation</p>
          </div>
        </div>

        {/* Site Selection and Actions */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
              <div className="w-full sm:w-72">
                <label className="text-sm font-medium flex items-center gap-1.5 mb-1.5">
                  <Building2 className="h-4 w-4 text-slate-400" />
                  Site
                </label>
                <Select value={selectedSiteId} onValueChange={(value) => {
                  setSelectedSiteId(value)
                  setSelectedWorkstation(null)
                }}>
                  <SelectTrigger>
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
              </div>

              {selectedSiteId && !selectedWorkstation && (
                <Button onClick={() => setAssignDialogOpen(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Assign Workstation
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Main Content */}
        {!selectedSiteId ? (
          <Card>
            <CardContent className="py-12">
              <div className="text-center">
                <Building2 className="h-12 w-12 mx-auto text-slate-300 mb-4" />
                <h3 className="text-lg font-medium text-slate-900 mb-2">Select a Site</h3>
                <p className="text-slate-500">Choose a site to view and manage workstations</p>
              </div>
            </CardContent>
          </Card>
        ) : !selectedWorkstation ? (
          // Workstation Cards Grid
          <>
            {siteWorkstations.length === 0 ? (
              <Card>
                <CardContent className="py-12">
                  <div className="text-center">
                    <Wrench className="h-12 w-12 mx-auto text-slate-300 mb-4" />
                    <h3 className="text-lg font-medium text-slate-900 mb-2">No Workstations</h3>
                    <p className="text-slate-500 mb-4">Assign workstations to this site to start tracking progress</p>
                    <Button onClick={() => setAssignDialogOpen(true)}>
                      <Plus className="h-4 w-4 mr-2" />
                      Assign Workstation
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {siteWorkstations.map((sw) => (
                  <Card
                    key={sw.id}
                    className="cursor-pointer hover:border-blue-500 hover:shadow-md transition-all"
                    onClick={() => setSelectedWorkstation(sw)}
                  >
                    <CardHeader className="pb-2">
                      <div className="flex items-start justify-between">
                        <CardTitle className="text-base">{sw.workstation?.name}</CardTitle>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-slate-400 hover:text-red-600"
                          onClick={(e) => {
                            e.stopPropagation()
                            handleRemoveWorkstation(sw)
                          }}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                      {sw.workstation?.description && (
                        <CardDescription className="text-xs">
                          {sw.workstation.description}
                        </CardDescription>
                      )}
                    </CardHeader>
                    <CardContent>
                      <div className="text-sm text-slate-500">
                        Click to view details
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </>
        ) : (
          // Detail View
          <>
            {/* Back Button and Header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <Button variant="outline" size="sm" onClick={() => setSelectedWorkstation(null)}>
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back
                </Button>
                <div>
                  <h3 className="text-lg font-semibold">{selectedWorkstation.workstation?.name}</h3>
                  {selectedWorkstation.workstation?.description && (
                    <p className="text-sm text-slate-500">{selectedWorkstation.workstation.description}</p>
                  )}
                </div>
              </div>
              <Button onClick={openAddProgressDialog}>
                <Plus className="h-4 w-4 mr-2" />
                Add Progress
              </Button>
            </div>

            {loadingProgress ? (
              <Card>
                <CardContent className="py-12">
                  <div className="text-center">
                    <Loader2 className="h-8 w-8 animate-spin text-blue-600 mx-auto mb-4" />
                    <p className="text-slate-500">Loading progress data...</p>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <>
                {/* BOQ Progress Summary Table */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">BOQ Progress by Line Item</CardTitle>
                    <CardDescription>
                      Summary of progress quantities for each BOQ item
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {boqProgressSummary.length === 0 ? (
                      <div className="text-center py-8 text-slate-500">
                        No progress entries yet. Click "Add Progress" to start tracking.
                      </div>
                    ) : (
                      <>
                        <div className="overflow-x-auto">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>BOQ Item</TableHead>
                                <TableHead className="text-center">Unit</TableHead>
                                <TableHead className="text-right">BOQ Qty</TableHead>
                                <TableHead className="text-right">Previous</TableHead>
                                <TableHead className="text-right">New</TableHead>
                                <TableHead className="text-right">Upto Date</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {boqProgressSummary.map((item) => (
                                <TableRow key={item.boq_line_item_id}>
                                  <TableCell>
                                    <div>
                                      <span className="font-mono text-blue-600 mr-2">{item.item_number}</span>
                                      <span className="text-slate-600 text-sm line-clamp-1">{item.description}</span>
                                    </div>
                                  </TableCell>
                                  <TableCell className="text-center">
                                    <Badge variant="secondary">{item.unit}</Badge>
                                  </TableCell>
                                  <TableCell className="text-right font-medium">
                                    {item.boq_quantity.toLocaleString('en-IN', { maximumFractionDigits: 3 })}
                                  </TableCell>
                                  <TableCell className="text-right">
                                    {item.previous_quantity.toLocaleString('en-IN', { maximumFractionDigits: 3 })}
                                  </TableCell>
                                  <TableCell className="text-right text-green-600 font-medium">
                                    {item.new_quantity.toLocaleString('en-IN', { maximumFractionDigits: 3 })}
                                  </TableCell>
                                  <TableCell className="text-right font-bold">
                                    {item.upto_date_quantity.toLocaleString('en-IN', { maximumFractionDigits: 3 })}
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                        <div className="mt-4 pt-4 border-t flex justify-end">
                          <div className="text-right">
                            <span className="text-sm text-slate-500 mr-4">Grand Total:</span>
                            <span className="text-lg font-bold">
                              {grandTotal.toLocaleString('en-IN', { maximumFractionDigits: 3 })}
                            </span>
                            <span className="text-sm text-slate-500 ml-1">(mixed units)</span>
                          </div>
                        </div>
                      </>
                    )}
                  </CardContent>
                </Card>

                {/* Progress Entries by Date */}
                {progressEntries.length > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Progress Entries</CardTitle>
                      <CardDescription>
                        Daily progress entries with material consumption
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      {Object.entries(entriesByDate)
                        .sort(([a], [b]) => b.localeCompare(a))
                        .map(([date, entries]) => (
                          <Collapsible
                            key={date}
                            open={expandedDates.has(date)}
                            onOpenChange={() => toggleDateExpanded(date)}
                          >
                            <CollapsibleTrigger asChild>
                              <Button variant="ghost" className="w-full justify-between p-4 h-auto">
                                <span className="flex items-center gap-2">
                                  {expandedDates.has(date) ? (
                                    <ChevronDown className="h-4 w-4" />
                                  ) : (
                                    <ChevronRight className="h-4 w-4" />
                                  )}
                                  <span className="font-medium">
                                    {new Date(date).toLocaleDateString('en-IN', {
                                      weekday: 'short',
                                      year: 'numeric',
                                      month: 'short',
                                      day: 'numeric',
                                    })}
                                  </span>
                                </span>
                                <Badge variant="secondary">{entries.length} entries</Badge>
                              </Button>
                            </CollapsibleTrigger>
                            <CollapsibleContent className="space-y-2 pl-6 pr-2 pb-2">
                              {entries.map((entry) => (
                                <Card key={entry.id} className="bg-slate-50">
                                  <CardContent className="p-4">
                                    <div className="flex items-start justify-between">
                                      <div className="flex-1">
                                        <div className="flex items-center gap-2 mb-2">
                                          <span className="font-mono text-blue-600 font-medium">
                                            {entry.boq_line_item?.item_number}
                                          </span>
                                          <span className="text-slate-600 text-sm line-clamp-1">
                                            {entry.boq_line_item?.description}
                                          </span>
                                        </div>
                                        <div className="flex items-center gap-4 text-sm">
                                          <span className="font-medium">
                                            {entry.quantity.toLocaleString('en-IN', { maximumFractionDigits: 3 })} {entry.boq_line_item?.unit}
                                          </span>
                                          {entry.notes && (
                                            <span className="text-slate-500 italic">"{entry.notes}"</span>
                                          )}
                                        </div>
                                        {entry.material_consumption && entry.material_consumption.length > 0 && (
                                          <div className="mt-2 pt-2 border-t border-slate-200">
                                            <div className="text-xs font-medium text-slate-500 mb-1">Materials:</div>
                                            <div className="flex flex-wrap gap-2">
                                              {entry.material_consumption.map((mc) => (
                                                <Badge key={mc.id} variant="outline" className="text-xs">
                                                  {mc.material_name}: {mc.quantity} {mc.unit}
                                                </Badge>
                                              ))}
                                            </div>
                                          </div>
                                        )}
                                      </div>
                                      <div className="flex gap-1">
                                        <Button
                                          variant="ghost"
                                          size="icon"
                                          className="h-8 w-8"
                                          onClick={() => openEditProgressDialog(entry)}
                                        >
                                          <Pencil className="h-4 w-4" />
                                        </Button>
                                        <Button
                                          variant="ghost"
                                          size="icon"
                                          className="h-8 w-8 text-red-600"
                                          onClick={() => handleDeleteProgress(entry)}
                                        >
                                          <Trash2 className="h-4 w-4" />
                                        </Button>
                                      </div>
                                    </div>
                                  </CardContent>
                                </Card>
                              ))}
                            </CollapsibleContent>
                          </Collapsible>
                        ))}
                    </CardContent>
                  </Card>
                )}
              </>
            )}
          </>
        )}
      </div>

      {/* Assign Workstation Dialog */}
      <Dialog open={assignDialogOpen} onOpenChange={setAssignDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Assign Workstation</DialogTitle>
            <DialogDescription>
              Select a workstation to assign to this site
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Workstation *</Label>
              <Select value={selectedWorkstationId} onValueChange={setSelectedWorkstationId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select workstation" />
                </SelectTrigger>
                <SelectContent>
                  {availableWorkstations.map((w) => (
                    <SelectItem key={w.id} value={w.id}>
                      {w.name}
                      {w.description && <span className="text-slate-500 ml-2">- {w.description}</span>}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {availableWorkstations.length === 0 && (
                <p className="text-sm text-amber-600">All workstations have been assigned to this site</p>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setAssignDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleAssignWorkstation} disabled={saving || !selectedWorkstationId}>
              {saving ? 'Assigning...' : 'Assign'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add/Edit Progress Dialog */}
      <Dialog open={progressDialogOpen} onOpenChange={setProgressDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {editingProgress ? 'Edit Progress Entry' : 'Add Progress Entry'}
            </DialogTitle>
            <DialogDescription>
              Record work progress against a BOQ line item
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            {/* Row 1: Date and BOQ Headline */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Date *</Label>
                <Input
                  type="date"
                  value={progressFormData.entry_date}
                  onChange={(e) => setProgressFormData({ ...progressFormData, entry_date: e.target.value })}
                  className="h-9"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">BOQ Headline *</Label>
                <Select
                  value={progressFormData.headline_id}
                  onValueChange={(value) => setProgressFormData({
                    ...progressFormData,
                    headline_id: value,
                    boq_line_item_id: '',
                  })}
                >
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="Select headline" />
                  </SelectTrigger>
                  <SelectContent>
                    {headlines.map((h) => (
                      <SelectItem key={h.id} value={h.id}>
                        {h.serial_number}. {h.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* BOQ Line Item */}
            <div className="space-y-1">
              <Label className="text-xs">BOQ Line Item *</Label>
              <Select
                value={progressFormData.boq_line_item_id}
                onValueChange={(value) => setProgressFormData({ ...progressFormData, boq_line_item_id: value })}
                disabled={!progressFormData.headline_id}
              >
                <SelectTrigger className="h-9">
                  <SelectValue placeholder={progressFormData.headline_id ? "Select line item" : "Select headline first"} />
                </SelectTrigger>
                <SelectContent>
                  {filteredLineItems.map((li) => (
                    <SelectItem key={li.id} value={li.id}>
                      {li.item_number} - {li.description.substring(0, 50)}...
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Context Info */}
            {selectedLineItem && (
              <div className="bg-slate-50 rounded-lg p-2">
                <div className="grid grid-cols-3 gap-3 text-xs">
                  <div>
                    <span className="text-slate-500">Unit:</span>
                    <span className="ml-1 font-medium">{selectedLineItem.unit}</span>
                  </div>
                  <div>
                    <span className="text-slate-500">Previous Qty:</span>
                    <span className="ml-1 font-medium">
                      {previousQtyForSelectedItem.toLocaleString('en-IN', { maximumFractionDigits: 3 })}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500">BOQ Qty:</span>
                    <span className="ml-1 font-medium">
                      {selectedLineItem.quantity.toLocaleString('en-IN', { maximumFractionDigits: 3 })}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Quantity and Notes in a row */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Quantity (Optional)</Label>
                <Input
                  type="number"
                  step="0.001"
                  placeholder="Enter quantity"
                  value={progressFormData.quantity}
                  onChange={(e) => setProgressFormData({ ...progressFormData, quantity: e.target.value })}
                  className="h-9"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Notes (Optional)</Label>
                <Input
                  placeholder="Add any notes..."
                  value={progressFormData.notes}
                  onChange={(e) => setProgressFormData({ ...progressFormData, notes: e.target.value })}
                  className="h-9"
                />
              </div>
            </div>

            {/* Material Consumption */}
            <div className="space-y-2 pt-2 border-t">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-medium">Material Consumption (Optional)</Label>
                <Button type="button" variant="outline" size="sm" onClick={addMaterialConsumption} className="h-7 text-xs">
                  <Plus className="h-3 w-3 mr-1" />
                  Add
                </Button>
              </div>

              {materialConsumptions.length === 0 ? (
                <p className="text-xs text-slate-500 text-center py-2">
                  No materials added. Click "Add" to track material consumption.
                </p>
              ) : (
                <div className="space-y-2">
                  {materialConsumptions.map((mc, index) => (
                    <div key={index} className="flex gap-2 items-center">
                      <div className="flex-1">
                        <Popover open={mc.popoverOpen} onOpenChange={(open) => setMaterialPopoverOpen(index, open)}>
                          <PopoverTrigger asChild>
                            <Button
                              variant="outline"
                              role="combobox"
                              aria-expanded={mc.popoverOpen}
                              className="w-full justify-between h-9 text-left font-normal"
                            >
                              {mc.material_id
                                ? mc.material_name || "Select material"
                                : "Search material..."}
                              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-[320px] p-0" align="start">
                            <div className="p-2 border-b">
                              <div className="flex items-center gap-2 px-2">
                                <Search className="h-4 w-4 text-slate-400" />
                                <input
                                  type="text"
                                  placeholder="Type to search materials..."
                                  className="flex-1 bg-transparent text-sm outline-none placeholder:text-slate-400"
                                  value={mc.searchTerm || ''}
                                  onChange={(e) => setMaterialSearchTerm(index, e.target.value)}
                                  autoFocus
                                />
                              </div>
                            </div>
                            <div className="max-h-[200px] overflow-y-auto">
                              {getFilteredMaterials(mc.searchTerm || '').length === 0 ? (
                                <div className="py-4 text-center text-sm text-slate-500">
                                  No materials found
                                </div>
                              ) : (
                                getFilteredMaterials(mc.searchTerm || '').map((m) => (
                                  <div
                                    key={m.id}
                                    className={`flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-slate-100 ${mc.material_id === m.id ? 'bg-slate-50' : ''}`}
                                    onClick={() => selectMaterial(index, m)}
                                  >
                                    <Check
                                      className={`h-4 w-4 ${mc.material_id === m.id ? "text-blue-600" : "text-transparent"}`}
                                    />
                                    <span className="flex-1 text-sm">{m.name}</span>
                                    <span className="text-xs text-slate-500">({m.unit})</span>
                                  </div>
                                ))
                              )}
                            </div>
                          </PopoverContent>
                        </Popover>
                      </div>
                      <div className="w-20">
                        <Input
                          type="number"
                          step="0.001"
                          placeholder="Qty"
                          value={mc.quantity}
                          onChange={(e) => updateMaterialConsumption(index, 'quantity', e.target.value)}
                          className="h-9"
                        />
                      </div>
                      <div className="w-16">
                        <Input
                          placeholder="Unit"
                          value={mc.unit}
                          readOnly
                          className="bg-slate-50 h-9 text-xs"
                        />
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="text-red-600 h-9 w-9"
                        onClick={() => removeMaterialConsumption(index)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setProgressDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveProgress} disabled={saving}>
              {saving ? 'Saving...' : editingProgress ? 'Update' : 'Save Progress'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
