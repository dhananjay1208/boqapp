'use client'

import { useState, useEffect, useRef } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
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
  ClipboardCheck,
  ClipboardList,
  Plus,
  Pencil,
  Trash2,
  Printer,
  ChevronDown,
  ChevronRight,
  FileText,
  CheckCircle2,
  XCircle,
  MinusCircle,
  Eye,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'

interface BOQLineItem {
  id: string
  item_number: string
  description: string
  location: string | null
  unit: string
  quantity: number
}

interface ChecklistTemplate {
  id: string
  name: string
  description: string | null
  notes_template: string | null
  items?: { id: string; item_no: number; description: string }[]
}

interface BOQChecklist {
  id: string
  line_item_id: string
  template_id: string | null
  checklist_name: string
  project: string | null
  shop_drawing_no: string | null
  make: string | null
  checklist_date: string | null
  location: string | null
  notes: string | null
  status: 'draft' | 'completed'
  created_at: string
  items?: BOQChecklistItem[]
  clearances?: BOQChecklistClearance[]
}

interface BOQChecklistItem {
  id: string
  checklist_id: string
  item_no: number
  description: string
  status: 'Y' | 'N' | 'NA' | null
  remarks: string | null
}

interface BOQChecklistClearance {
  id: string
  checklist_id: string
  clearance_type: 'cw' | 'electrical' | 'hvac'
  representative_name: string | null
  clearance_date: string | null
  signature: string | null
}

interface Props {
  headlineId: string
  lineItems: BOQLineItem[]
}

const CLEARANCE_TYPES = [
  { value: 'cw', label: 'C&W Representative' },
  { value: 'electrical', label: 'Electrical Representative' },
  { value: 'hvac', label: 'HVAC Representative' },
]

export default function BOQChecklistsTab({ headlineId, lineItems }: Props) {
  const [templates, setTemplates] = useState<ChecklistTemplate[]>([])
  const [checklists, setChecklists] = useState<BOQChecklist[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedLineItems, setExpandedLineItems] = useState<Set<string>>(new Set())

  // Dialog states
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [showViewDialog, setShowViewDialog] = useState(false)
  const [selectedLineItem, setSelectedLineItem] = useState<BOQLineItem | null>(null)
  const [selectedChecklist, setSelectedChecklist] = useState<BOQChecklist | null>(null)

  // Form state
  const [selectedTemplateId, setSelectedTemplateId] = useState('')
  const [formData, setFormData] = useState({
    checklist_name: '',
    project: '',
    shop_drawing_no: '',
    make: '',
    checklist_date: new Date().toISOString().split('T')[0],
    location: '',
    notes: '',
  })
  const [formItems, setFormItems] = useState<{ item_no: number; description: string; status: string; remarks: string }[]>([])
  const [formClearances, setFormClearances] = useState<{ clearance_type: string; representative_name: string; clearance_date: string }[]>([])

  const printRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    fetchData()
  }, [headlineId])

  async function fetchData() {
    try {
      // Fetch templates
      const { data: templatesData } = await supabase
        .from('checklist_templates')
        .select(`
          *,
          items:checklist_template_items(*)
        `)
        .order('name')

      setTemplates(templatesData || [])

      // Fetch checklists for all line items
      const lineItemIds = lineItems.map(li => li.id)
      if (lineItemIds.length > 0) {
        const { data: checklistsData } = await supabase
          .from('boq_checklists')
          .select(`
            *,
            items:boq_checklist_items(*),
            clearances:boq_checklist_clearances(*)
          `)
          .in('line_item_id', lineItemIds)
          .order('created_at', { ascending: false })

        setChecklists(checklistsData || [])
      }
    } catch (error) {
      console.error('Error fetching data:', error)
      toast.error('Failed to load checklists')
    } finally {
      setLoading(false)
    }
  }

  function toggleLineItemExpand(id: string) {
    const newExpanded = new Set(expandedLineItems)
    if (newExpanded.has(id)) {
      newExpanded.delete(id)
    } else {
      newExpanded.add(id)
    }
    setExpandedLineItems(newExpanded)
  }

  function openCreateDialog(lineItem: BOQLineItem) {
    setSelectedLineItem(lineItem)
    setSelectedTemplateId('')
    setFormData({
      checklist_name: '',
      project: '',
      shop_drawing_no: '',
      make: '',
      checklist_date: new Date().toISOString().split('T')[0],
      location: lineItem.location || '',
      notes: '',
    })
    setFormItems([])
    setFormClearances(
      CLEARANCE_TYPES.map(ct => ({
        clearance_type: ct.value,
        representative_name: '',
        clearance_date: '',
      }))
    )
    setShowCreateDialog(true)
  }

  function handleTemplateSelect(templateId: string) {
    setSelectedTemplateId(templateId)
    const template = templates.find(t => t.id === templateId)
    if (template) {
      setFormData(prev => ({
        ...prev,
        checklist_name: template.name,
        notes: template.notes_template || '',
      }))
      setFormItems(
        template.items?.map(item => ({
          item_no: item.item_no,
          description: item.description,
          status: '',
          remarks: '',
        })) || []
      )
    }
  }

  function updateItemStatus(index: number, status: string) {
    const newItems = [...formItems]
    newItems[index].status = status
    setFormItems(newItems)
  }

  function updateItemRemarks(index: number, remarks: string) {
    const newItems = [...formItems]
    newItems[index].remarks = remarks
    setFormItems(newItems)
  }

  function updateClearance(index: number, field: string, value: string) {
    const newClearances = [...formClearances]
    newClearances[index] = { ...newClearances[index], [field]: value }
    setFormClearances(newClearances)
  }

  async function handleSaveChecklist() {
    if (!selectedLineItem) return
    if (!formData.checklist_name.trim()) {
      toast.error('Please enter a checklist name')
      return
    }

    try {
      // Create checklist
      const { data: checklist, error: checklistError } = await supabase
        .from('boq_checklists')
        .insert({
          line_item_id: selectedLineItem.id,
          template_id: selectedTemplateId || null,
          checklist_name: formData.checklist_name.trim(),
          project: formData.project.trim() || null,
          shop_drawing_no: formData.shop_drawing_no.trim() || null,
          make: formData.make.trim() || null,
          checklist_date: formData.checklist_date || null,
          location: formData.location.trim() || null,
          notes: formData.notes.trim() || null,
          status: 'draft',
        })
        .select()
        .single()

      if (checklistError) throw checklistError

      // Create checklist items
      if (formItems.length > 0) {
        const { error: itemsError } = await supabase
          .from('boq_checklist_items')
          .insert(
            formItems.map(item => ({
              checklist_id: checklist.id,
              item_no: item.item_no,
              description: item.description,
              status: item.status || null,
              remarks: item.remarks.trim() || null,
            }))
          )
        if (itemsError) throw itemsError
      }

      // Create clearances
      const validClearances = formClearances.filter(c => c.representative_name.trim())
      if (validClearances.length > 0) {
        const { error: clearancesError } = await supabase
          .from('boq_checklist_clearances')
          .insert(
            validClearances.map(c => ({
              checklist_id: checklist.id,
              clearance_type: c.clearance_type,
              representative_name: c.representative_name.trim(),
              clearance_date: c.clearance_date || null,
            }))
          )
        if (clearancesError) throw clearancesError
      }

      toast.success('Checklist created successfully')
      setShowCreateDialog(false)
      fetchData()
    } catch (error) {
      console.error('Error saving checklist:', error)
      toast.error('Failed to save checklist')
    }
  }

  function openViewDialog(checklist: BOQChecklist) {
    setSelectedChecklist(checklist)
    setFormData({
      checklist_name: checklist.checklist_name,
      project: checklist.project || '',
      shop_drawing_no: checklist.shop_drawing_no || '',
      make: checklist.make || '',
      checklist_date: checklist.checklist_date || '',
      location: checklist.location || '',
      notes: checklist.notes || '',
    })
    setFormItems(
      checklist.items?.map(item => ({
        item_no: item.item_no,
        description: item.description,
        status: item.status || '',
        remarks: item.remarks || '',
      })) || []
    )
    setFormClearances(
      CLEARANCE_TYPES.map(ct => {
        const existing = checklist.clearances?.find(c => c.clearance_type === ct.value)
        return {
          clearance_type: ct.value,
          representative_name: existing?.representative_name || '',
          clearance_date: existing?.clearance_date || '',
        }
      })
    )
    setShowViewDialog(true)
  }

  async function handleUpdateChecklist() {
    if (!selectedChecklist) return

    try {
      // Update checklist
      const { error: checklistError } = await supabase
        .from('boq_checklists')
        .update({
          checklist_name: formData.checklist_name.trim(),
          project: formData.project.trim() || null,
          shop_drawing_no: formData.shop_drawing_no.trim() || null,
          make: formData.make.trim() || null,
          checklist_date: formData.checklist_date || null,
          location: formData.location.trim() || null,
          notes: formData.notes.trim() || null,
        })
        .eq('id', selectedChecklist.id)

      if (checklistError) throw checklistError

      // Update items
      for (const item of formItems) {
        const existingItem = selectedChecklist.items?.find(i => i.item_no === item.item_no)
        if (existingItem) {
          await supabase
            .from('boq_checklist_items')
            .update({
              status: item.status || null,
              remarks: item.remarks.trim() || null,
            })
            .eq('id', existingItem.id)
        }
      }

      // Update clearances - delete and re-insert
      await supabase
        .from('boq_checklist_clearances')
        .delete()
        .eq('checklist_id', selectedChecklist.id)

      const validClearances = formClearances.filter(c => c.representative_name.trim())
      if (validClearances.length > 0) {
        await supabase
          .from('boq_checklist_clearances')
          .insert(
            validClearances.map(c => ({
              checklist_id: selectedChecklist.id,
              clearance_type: c.clearance_type,
              representative_name: c.representative_name.trim(),
              clearance_date: c.clearance_date || null,
            }))
          )
      }

      toast.success('Checklist updated successfully')
      setShowViewDialog(false)
      fetchData()
    } catch (error) {
      console.error('Error updating checklist:', error)
      toast.error('Failed to update checklist')
    }
  }

  async function handleDeleteChecklist(checklistId: string) {
    if (!confirm('Are you sure you want to delete this checklist?')) return

    try {
      const { error } = await supabase
        .from('boq_checklists')
        .delete()
        .eq('id', checklistId)

      if (error) throw error

      toast.success('Checklist deleted')
      fetchData()
    } catch (error) {
      console.error('Error deleting checklist:', error)
      toast.error('Failed to delete checklist')
    }
  }

  function handlePrint() {
    const printContent = document.getElementById('print-checklist')
    if (!printContent) return

    const printWindow = window.open('', '_blank')
    if (!printWindow) {
      toast.error('Please allow popups to print')
      return
    }

    const lineItem = lineItems.find(li => li.id === selectedChecklist?.line_item_id)

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Checklist - ${formData.checklist_name}</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 20px; font-size: 12px; }
          h1 { text-align: center; font-size: 16px; margin-bottom: 20px; }
          .header-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 20px; }
          .header-item { display: flex; gap: 8px; }
          .header-label { font-weight: bold; min-width: 120px; }
          table { width: 100%; border-collapse: collapse; margin: 20px 0; }
          th, td { border: 1px solid #000; padding: 8px; text-align: left; }
          th { background-color: #f0f0f0; }
          .status-cell { text-align: center; width: 60px; }
          .notes { margin: 20px 0; padding: 10px; border: 1px solid #ccc; min-height: 50px; }
          .clearances { margin-top: 30px; }
          .clearance-row { display: grid; grid-template-columns: 200px 1fr 100px 150px; gap: 10px; padding: 8px 0; border-bottom: 1px solid #ccc; }
          .signature-line { border-bottom: 1px solid #000; min-width: 100px; display: inline-block; }
          @media print { body { padding: 0; } }
        </style>
      </head>
      <body>
        <h1>CHECKLIST FOR ${formData.checklist_name.toUpperCase()}</h1>

        <div class="header-grid">
          <div class="header-item"><span class="header-label">Project:</span> ${formData.project || '-'}</div>
          <div class="header-item"><span class="header-label">Make:</span> ${formData.make || '-'}</div>
          <div class="header-item"><span class="header-label">Shop Drawing No.:</span> ${formData.shop_drawing_no || '-'}</div>
          <div class="header-item"><span class="header-label">Date:</span> ${formData.checklist_date ? new Date(formData.checklist_date).toLocaleDateString('en-IN') : '-'}</div>
          <div class="header-item"><span class="header-label">BOQ Line Item No.:</span> ${lineItem?.item_number || '-'}</div>
          <div class="header-item"><span class="header-label">Location:</span> ${formData.location || '-'}</div>
        </div>

        <table>
          <thead>
            <tr>
              <th style="width: 50px;">S No.</th>
              <th>Item Description</th>
              <th class="status-cell">Status</th>
              <th style="width: 200px;">Remarks</th>
            </tr>
          </thead>
          <tbody>
            ${formItems.map(item => `
              <tr>
                <td>${item.item_no}</td>
                <td>${item.description}</td>
                <td class="status-cell">${item.status || '-'}</td>
                <td>${item.remarks || '-'}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>

        <div class="notes">
          <strong>Note:</strong> ${formData.notes || '-'}
        </div>

        <div class="clearances">
          <h3>Clearances Provided By</h3>
          <div class="clearance-row" style="font-weight: bold; border-bottom: 2px solid #000;">
            <span>Representative</span>
            <span>Name</span>
            <span>Date</span>
            <span>Signature</span>
          </div>
          ${formClearances.map(c => {
            const label = CLEARANCE_TYPES.find(ct => ct.value === c.clearance_type)?.label || c.clearance_type
            return `
              <div class="clearance-row">
                <span>${label}</span>
                <span>${c.representative_name || '-'}</span>
                <span>${c.clearance_date ? new Date(c.clearance_date).toLocaleDateString('en-IN') : '-'}</span>
                <span class="signature-line">&nbsp;</span>
              </div>
            `
          }).join('')}
        </div>
      </body>
      </html>
    `)

    printWindow.document.close()
    printWindow.print()
  }

  function getStatusBadge(status: string | null) {
    switch (status) {
      case 'Y':
        return <Badge className="bg-green-100 text-green-700"><CheckCircle2 className="h-3 w-3 mr-1" />Y</Badge>
      case 'N':
        return <Badge className="bg-red-100 text-red-700"><XCircle className="h-3 w-3 mr-1" />N</Badge>
      case 'NA':
        return <Badge className="bg-slate-100 text-slate-500"><MinusCircle className="h-3 w-3 mr-1" />NA</Badge>
      default:
        return <Badge variant="outline">-</Badge>
    }
  }

  function getChecklistsForLineItem(lineItemId: string) {
    return checklists.filter(c => c.line_item_id === lineItemId)
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="py-8">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
            <p className="text-slate-500 mt-4">Loading checklists...</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <CardTitle className="flex items-center gap-2">
                <ClipboardList className="h-5 w-5" />
                BOQ Checklists
              </CardTitle>
              <CardDescription>
                Create and manage quality checklists for BOQ line items
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {templates.length === 0 && (
            <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg mb-4">
              <p className="text-amber-800 text-sm">
                No checklist templates found. Please create templates in the{' '}
                <a href="/checklists" className="underline font-medium">Checklists</a> section first.
              </p>
            </div>
          )}

          {lineItems.length === 0 ? (
            <div className="text-center py-12">
              <ClipboardList className="h-12 w-12 mx-auto text-slate-300 mb-4" />
              <h3 className="text-lg font-medium text-slate-900 mb-2">No Line Items</h3>
              <p className="text-slate-500">Add line items first to create checklists.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {lineItems.map((lineItem) => {
                const lineItemChecklists = getChecklistsForLineItem(lineItem.id)
                return (
                  <Collapsible
                    key={lineItem.id}
                    open={expandedLineItems.has(lineItem.id)}
                    onOpenChange={() => toggleLineItemExpand(lineItem.id)}
                  >
                    <div className="border rounded-lg">
                      <div className="flex items-center justify-between p-4 bg-slate-50">
                        <CollapsibleTrigger className="flex items-center gap-3 flex-1 text-left">
                          {expandedLineItems.has(lineItem.id) ? (
                            <ChevronDown className="h-5 w-5 text-slate-400" />
                          ) : (
                            <ChevronRight className="h-5 w-5 text-slate-400" />
                          )}
                          <div>
                            <div className="flex items-center gap-2">
                              <Badge variant="outline">{lineItem.item_number}</Badge>
                              <span className="font-medium">{lineItem.description}</span>
                            </div>
                            <p className="text-sm text-slate-500 mt-1">
                              {lineItemChecklists.length} checklist{lineItemChecklists.length !== 1 ? 's' : ''}
                              {lineItem.location && ` | ${lineItem.location}`}
                            </p>
                          </div>
                        </CollapsibleTrigger>
                        <Button
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation()
                            openCreateDialog(lineItem)
                          }}
                          disabled={templates.length === 0}
                        >
                          <Plus className="h-4 w-4 mr-1" />
                          New Checklist
                        </Button>
                      </div>

                      <CollapsibleContent>
                        <div className="p-4 border-t">
                          {lineItemChecklists.length === 0 ? (
                            <div className="text-center py-6">
                              <ClipboardCheck className="h-8 w-8 mx-auto text-slate-300 mb-2" />
                              <p className="text-sm text-slate-500">No checklists for this item</p>
                            </div>
                          ) : (
                            <div className="space-y-2">
                              {lineItemChecklists.map((checklist) => {
                                const completedItems = checklist.items?.filter(i => i.status === 'Y').length || 0
                                const totalItems = checklist.items?.length || 0
                                return (
                                  <div
                                    key={checklist.id}
                                    className="flex items-center justify-between p-3 border rounded-lg hover:bg-slate-50"
                                  >
                                    <div className="flex items-center gap-3">
                                      <FileText className="h-5 w-5 text-blue-600" />
                                      <div>
                                        <p className="font-medium">{checklist.checklist_name}</p>
                                        <p className="text-sm text-slate-500">
                                          {completedItems}/{totalItems} items completed
                                          {checklist.checklist_date && ` | ${new Date(checklist.checklist_date).toLocaleDateString('en-IN')}`}
                                        </p>
                                      </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => openViewDialog(checklist)}
                                      >
                                        <Eye className="h-4 w-4 mr-1" />
                                        View/Edit
                                      </Button>
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => handleDeleteChecklist(checklist.id)}
                                      >
                                        <Trash2 className="h-4 w-4 text-red-500" />
                                      </Button>
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
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create Checklist Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto bg-white">
          <DialogHeader>
            <DialogTitle>Create Checklist</DialogTitle>
            <DialogDescription>
              Fill out checklist for BOQ Item: {selectedLineItem?.item_number} - {selectedLineItem?.description}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6">
            {/* Template Selection */}
            <div>
              <Label>Select Template *</Label>
              <Select value={selectedTemplateId} onValueChange={handleTemplateSelect}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a checklist template..." />
                </SelectTrigger>
                <SelectContent>
                  {templates.map((template) => (
                    <SelectItem key={template.id} value={template.id}>
                      {template.name} ({template.items?.length || 0} items)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {selectedTemplateId && (
              <>
                {/* Header Info */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2">
                    <Label>Checklist Name</Label>
                    <Input
                      value={formData.checklist_name}
                      onChange={(e) => setFormData({ ...formData, checklist_name: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label>Project</Label>
                    <Input
                      value={formData.project}
                      onChange={(e) => setFormData({ ...formData, project: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label>Make</Label>
                    <Input
                      value={formData.make}
                      onChange={(e) => setFormData({ ...formData, make: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label>Shop Drawing No.</Label>
                    <Input
                      value={formData.shop_drawing_no}
                      onChange={(e) => setFormData({ ...formData, shop_drawing_no: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label>Date</Label>
                    <Input
                      type="date"
                      value={formData.checklist_date}
                      onChange={(e) => setFormData({ ...formData, checklist_date: e.target.value })}
                    />
                  </div>
                  <div className="col-span-2">
                    <Label>Location</Label>
                    <Input
                      value={formData.location}
                      onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                    />
                  </div>
                </div>

                {/* Checklist Items */}
                <div>
                  <Label className="mb-2 block">Checklist Items</Label>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-16">S.No</TableHead>
                        <TableHead>Description</TableHead>
                        <TableHead className="w-32">Status</TableHead>
                        <TableHead className="w-48">Remarks</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {formItems.map((item, index) => (
                        <TableRow key={index}>
                          <TableCell>{item.item_no}</TableCell>
                          <TableCell>{item.description}</TableCell>
                          <TableCell>
                            <Select
                              value={item.status}
                              onValueChange={(value) => updateItemStatus(index, value)}
                            >
                              <SelectTrigger className="h-8">
                                <SelectValue placeholder="-" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="Y">Y</SelectItem>
                                <SelectItem value="N">N</SelectItem>
                                <SelectItem value="NA">NA</SelectItem>
                              </SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell>
                            <Input
                              value={item.remarks}
                              onChange={(e) => updateItemRemarks(index, e.target.value)}
                              placeholder="Remarks"
                              className="h-8"
                            />
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                {/* Notes */}
                <div>
                  <Label>Notes</Label>
                  <Textarea
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    rows={3}
                  />
                </div>

                {/* Clearances */}
                <div>
                  <Label className="mb-2 block">Clearances</Label>
                  <div className="space-y-2">
                    {formClearances.map((clearance, index) => {
                      const label = CLEARANCE_TYPES.find(ct => ct.value === clearance.clearance_type)?.label
                      return (
                        <div key={clearance.clearance_type} className="grid grid-cols-3 gap-2 items-center">
                          <span className="text-sm font-medium">{label}</span>
                          <Input
                            value={clearance.representative_name}
                            onChange={(e) => updateClearance(index, 'representative_name', e.target.value)}
                            placeholder="Name"
                            className="h-8"
                          />
                          <Input
                            type="date"
                            value={clearance.clearance_date}
                            onChange={(e) => updateClearance(index, 'clearance_date', e.target.value)}
                            className="h-8"
                          />
                        </div>
                      )
                    })}
                  </div>
                </div>
              </>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveChecklist} disabled={!selectedTemplateId}>
              Save Checklist
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View/Edit Checklist Dialog */}
      <Dialog open={showViewDialog} onOpenChange={setShowViewDialog}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto bg-white">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between">
              <span>Checklist: {selectedChecklist?.checklist_name}</span>
              <Button variant="outline" size="sm" onClick={handlePrint}>
                <Printer className="h-4 w-4 mr-1" />
                Print
              </Button>
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-6" id="print-checklist">
            {/* Header Info */}
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <Label>Checklist Name</Label>
                <Input
                  value={formData.checklist_name}
                  onChange={(e) => setFormData({ ...formData, checklist_name: e.target.value })}
                />
              </div>
              <div>
                <Label>Project</Label>
                <Input
                  value={formData.project}
                  onChange={(e) => setFormData({ ...formData, project: e.target.value })}
                />
              </div>
              <div>
                <Label>Make</Label>
                <Input
                  value={formData.make}
                  onChange={(e) => setFormData({ ...formData, make: e.target.value })}
                />
              </div>
              <div>
                <Label>Shop Drawing No.</Label>
                <Input
                  value={formData.shop_drawing_no}
                  onChange={(e) => setFormData({ ...formData, shop_drawing_no: e.target.value })}
                />
              </div>
              <div>
                <Label>Date</Label>
                <Input
                  type="date"
                  value={formData.checklist_date}
                  onChange={(e) => setFormData({ ...formData, checklist_date: e.target.value })}
                />
              </div>
              <div className="col-span-2">
                <Label>Location</Label>
                <Input
                  value={formData.location}
                  onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                />
              </div>
            </div>

            {/* Checklist Items */}
            <div>
              <Label className="mb-2 block">Checklist Items</Label>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-16">S.No</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead className="w-32">Status</TableHead>
                    <TableHead className="w-48">Remarks</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {formItems.map((item, index) => (
                    <TableRow key={index}>
                      <TableCell>{item.item_no}</TableCell>
                      <TableCell>{item.description}</TableCell>
                      <TableCell>
                        <Select
                          value={item.status}
                          onValueChange={(value) => updateItemStatus(index, value)}
                        >
                          <SelectTrigger className="h-8">
                            <SelectValue placeholder="-" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Y">Y</SelectItem>
                            <SelectItem value="N">N</SelectItem>
                            <SelectItem value="NA">NA</SelectItem>
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <Input
                          value={item.remarks}
                          onChange={(e) => updateItemRemarks(index, e.target.value)}
                          placeholder="Remarks"
                          className="h-8"
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {/* Notes */}
            <div>
              <Label>Notes</Label>
              <Textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                rows={3}
              />
            </div>

            {/* Clearances */}
            <div>
              <Label className="mb-2 block">Clearances</Label>
              <div className="space-y-2">
                {formClearances.map((clearance, index) => {
                  const label = CLEARANCE_TYPES.find(ct => ct.value === clearance.clearance_type)?.label
                  return (
                    <div key={clearance.clearance_type} className="grid grid-cols-3 gap-2 items-center">
                      <span className="text-sm font-medium">{label}</span>
                      <Input
                        value={clearance.representative_name}
                        onChange={(e) => updateClearance(index, 'representative_name', e.target.value)}
                        placeholder="Name"
                        className="h-8"
                      />
                      <Input
                        type="date"
                        value={clearance.clearance_date}
                        onChange={(e) => updateClearance(index, 'clearance_date', e.target.value)}
                        className="h-8"
                      />
                    </div>
                  )
                })}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowViewDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleUpdateChecklist}>
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
