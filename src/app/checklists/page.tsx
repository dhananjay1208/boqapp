'use client'

import { useState, useEffect, useRef } from 'react'
import { Header } from '@/components/layout/header'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  ClipboardCheck,
  Plus,
  Upload,
  Pencil,
  Trash2,
  FileSpreadsheet,
  ChevronDown,
  ChevronUp,
  FileText,
  Printer,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'
import { parseChecklistFile, type ParsedChecklistItem } from '@/lib/checklist-parser'
import { generateChecklistPdf, type ChecklistPdfMetadata } from '@/lib/checklist-pdf'

interface ChecklistTemplate {
  id: string
  name: string
  description: string | null
  notes_template: string | null
  signatories: string[] | null
  created_at: string
  items?: ChecklistTemplateItem[]
}

interface ChecklistTemplateItem {
  id: string
  template_id: string
  item_no: number
  description: string
  section: string | null
  sort_order: number
}

const DEFAULT_SIGNATORIES = [
  'C&W Representative',
  'Electrical Representative',
  'HVAC Representative',
  'Siemens Representative',
  'IT Representative',
  'Ostraca Representative',
]

export default function ChecklistsPage() {
  const [templates, setTemplates] = useState<ChecklistTemplate[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [showUploadDialog, setShowUploadDialog] = useState(false)
  const [editingTemplate, setEditingTemplate] = useState<ChecklistTemplate | null>(null)
  const [expandedTemplate, setExpandedTemplate] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Form state for create/edit
  const [formName, setFormName] = useState('')
  const [formDescription, setFormDescription] = useState('')
  const [formNotes, setFormNotes] = useState('')
  const [formItems, setFormItems] = useState<{ item_no: number; description: string; section: string | null }[]>([
    { item_no: 1, description: '', section: null },
  ])
  const [formSignatories, setFormSignatories] = useState<string[]>([...DEFAULT_SIGNATORIES])

  // Upload state
  const [uploadedItems, setUploadedItems] = useState<ParsedChecklistItem[]>([])
  const [uploadName, setUploadName] = useState('')
  const [uploadDescription, setUploadDescription] = useState('')
  const [uploadSignatories, setUploadSignatories] = useState<string[]>([...DEFAULT_SIGNATORIES])

  // Filled-PDF metadata dialog state
  const [showMetadataDialog, setShowMetadataDialog] = useState(false)
  const [pdfTemplate, setPdfTemplate] = useState<ChecklistTemplate | null>(null)
  const [pdfMetadata, setPdfMetadata] = useState<ChecklistPdfMetadata>({})

  useEffect(() => {
    fetchTemplates()
  }, [])

  async function fetchTemplates() {
    try {
      const { data, error } = await supabase
        .from('checklist_templates')
        .select(`
          *,
          items:checklist_template_items(*)
        `)
        .order('created_at', { ascending: false })

      if (error) {
        console.error('Error fetching templates:', error)
        // Table might not exist yet - show empty list
        setTemplates([])
        return
      }
      setTemplates(data || [])
    } catch (error) {
      console.error('Error fetching templates:', error)
      // Don't show toast - table might not exist yet
      setTemplates([])
    } finally {
      setLoading(false)
    }
  }

  function resetForm() {
    setFormName('')
    setFormDescription('')
    setFormNotes('')
    setFormItems([{ item_no: 1, description: '', section: null }])
    setFormSignatories([...DEFAULT_SIGNATORIES])
  }

  function openCreateDialog() {
    resetForm()
    setEditingTemplate(null)
    setShowCreateDialog(true)
  }

  function openEditDialog(template: ChecklistTemplate) {
    setFormName(template.name)
    setFormDescription(template.description || '')
    setFormNotes(template.notes_template || '')
    setFormItems(
      template.items
        ?.slice()
        .sort((a, b) => a.sort_order - b.sort_order)
        .map(item => ({
          item_no: item.item_no,
          description: item.description,
          section: item.section,
        })) || [{ item_no: 1, description: '', section: null }]
    )
    setFormSignatories(
      template.signatories && template.signatories.length > 0
        ? [...template.signatories]
        : [...DEFAULT_SIGNATORIES]
    )
    setEditingTemplate(template)
    setShowCreateDialog(true)
  }

  function addItem() {
    const lastSection = formItems.length > 0 ? formItems[formItems.length - 1].section : null
    setFormItems([...formItems, { item_no: formItems.length + 1, description: '', section: lastSection }])
  }

  function removeItem(index: number) {
    if (formItems.length > 1) {
      const newItems = formItems.filter((_, i) => i !== index)
      setFormItems(newItems.map((item, i) => ({ ...item, item_no: i + 1 })))
    }
  }

  function updateItem(index: number, description: string) {
    const newItems = [...formItems]
    newItems[index].description = description
    setFormItems(newItems)
  }

  function addSignatory() {
    setFormSignatories([...formSignatories, ''])
  }

  function updateSignatory(index: number, value: string) {
    const next = [...formSignatories]
    next[index] = value
    setFormSignatories(next)
  }

  function removeSignatory(index: number) {
    setFormSignatories(formSignatories.filter((_, i) => i !== index))
  }

  async function handleSaveTemplate() {
    if (!formName.trim()) {
      toast.error('Please enter a template name')
      return
    }

    const validItems = formItems.filter(item => item.description.trim())
    if (validItems.length === 0) {
      toast.error('Please add at least one item')
      return
    }

    const cleanSignatories = formSignatories.map((s) => s.trim()).filter(Boolean)

    try {
      if (editingTemplate) {
        const { error: templateError } = await supabase
          .from('checklist_templates')
          .update({
            name: formName.trim(),
            description: formDescription.trim() || null,
            notes_template: formNotes.trim() || null,
            signatories: cleanSignatories,
          })
          .eq('id', editingTemplate.id)

        if (templateError) throw templateError

        await supabase
          .from('checklist_template_items')
          .delete()
          .eq('template_id', editingTemplate.id)

        const { error: itemsError } = await supabase
          .from('checklist_template_items')
          .insert(
            validItems.map((item, index) => ({
              template_id: editingTemplate.id,
              item_no: item.item_no,
              description: item.description.trim(),
              section: item.section || null,
              sort_order: index + 1,
            }))
          )

        if (itemsError) throw itemsError

        toast.success('Template updated successfully')
      } else {
        const { data: template, error: templateError } = await supabase
          .from('checklist_templates')
          .insert({
            name: formName.trim(),
            description: formDescription.trim() || null,
            notes_template: formNotes.trim() || null,
            signatories: cleanSignatories,
          })
          .select()
          .single()

        if (templateError) throw templateError

        const { error: itemsError } = await supabase
          .from('checklist_template_items')
          .insert(
            validItems.map((item, index) => ({
              template_id: template.id,
              item_no: item.item_no,
              description: item.description.trim(),
              section: item.section || null,
              sort_order: index + 1,
            }))
          )

        if (itemsError) throw itemsError

        toast.success('Template created successfully')
      }

      setShowCreateDialog(false)
      fetchTemplates()
    } catch (error) {
      console.error('Error saving template:', error)
      toast.error('Failed to save template')
    }
  }

  async function handleDeleteTemplate(templateId: string) {
    if (!confirm('Are you sure you want to delete this template?')) return

    try {
      const { error } = await supabase
        .from('checklist_templates')
        .delete()
        .eq('id', templateId)

      if (error) throw error

      toast.success('Template deleted successfully')
      fetchTemplates()
    } catch (error) {
      console.error('Error deleting template:', error)
      toast.error('Failed to delete template')
    }
  }

  async function handleFileSelect(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return

    try {
      const parsed = await parseChecklistFile(file)
      setUploadName(parsed.name || file.name.replace(/\.[^/.]+$/, ''))
      setUploadDescription(parsed.description || '')
      setUploadedItems(parsed.items)
      setUploadSignatories(parsed.signatories)
      setShowUploadDialog(true)
    } catch (error) {
      console.error('Error parsing Excel file:', error)
      toast.error('Failed to parse Excel file')
    } finally {
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  async function handleSaveUploadedTemplate() {
    if (!uploadName.trim()) {
      toast.error('Please enter a template name')
      return
    }

    const validItems = uploadedItems.filter((item) => item.description.trim())
    if (validItems.length === 0) {
      toast.error('Please add at least one item with description')
      return
    }

    const cleanSignatories = uploadSignatories.map((s) => s.trim()).filter(Boolean)

    try {
      const { data: template, error: templateError } = await supabase
        .from('checklist_templates')
        .insert({
          name: uploadName.trim(),
          description: uploadDescription.trim() || null,
          signatories: cleanSignatories,
        })
        .select()
        .single()

      if (templateError) throw templateError

      const { error: itemsError } = await supabase
        .from('checklist_template_items')
        .insert(
          validItems.map((item, index) => ({
            template_id: template.id,
            item_no: item.item_no,
            description: item.description.trim(),
            section: item.section || null,
            sort_order: index + 1,
          }))
        )

      if (itemsError) throw itemsError

      toast.success('Template created from Excel')
      setShowUploadDialog(false)
      setUploadedItems([])
      setUploadName('')
      setUploadDescription('')
      setUploadSignatories([...DEFAULT_SIGNATORIES])
      fetchTemplates()
    } catch (error) {
      console.error('Error saving uploaded template:', error)
      toast.error('Failed to save template')
    }
  }

  function updateUploadedItem(index: number, description: string) {
    const newItems = [...uploadedItems]
    newItems[index].description = description
    setUploadedItems(newItems)
  }

  // ===== PDF Export =====

  function exportBlankPdf(template: ChecklistTemplate) {
    if (!template.items || template.items.length === 0) {
      toast.error('Template has no items')
      return
    }
    const sortedItems = template.items.slice().sort((a, b) => a.sort_order - b.sort_order)
    const doc = generateChecklistPdf(
      {
        name: template.name,
        description: template.description,
        notes_template: template.notes_template,
        signatories: template.signatories && template.signatories.length > 0 ? template.signatories : DEFAULT_SIGNATORIES,
        items: sortedItems.map((i) => ({
          section: i.section,
          item_no: i.item_no,
          description: i.description,
        })),
      },
      {},
      { mode: 'blank' }
    )
    doc.save(`Checklist_${template.name.replace(/[^A-Za-z0-9]+/g, '_')}_BLANK.pdf`)
    toast.success('Blank PDF generated')
  }

  function openMetadataDialog(template: ChecklistTemplate) {
    if (!template.items || template.items.length === 0) {
      toast.error('Template has no items')
      return
    }
    setPdfTemplate(template)
    const today = new Date().toISOString().split('T')[0]
    setPdfMetadata({
      project: '',
      make: '',
      date: today,
      shopDrawingNo: '',
      boqLineItemNo: '',
      location: '',
      buildingFloor: '',
    })
    setShowMetadataDialog(true)
  }

  function exportFilledPdf() {
    if (!pdfTemplate?.items) return
    const sortedItems = pdfTemplate.items.slice().sort((a, b) => a.sort_order - b.sort_order)
    const doc = generateChecklistPdf(
      {
        name: pdfTemplate.name,
        description: pdfTemplate.description,
        notes_template: pdfTemplate.notes_template,
        signatories:
          pdfTemplate.signatories && pdfTemplate.signatories.length > 0
            ? pdfTemplate.signatories
            : DEFAULT_SIGNATORIES,
        items: sortedItems.map((i) => ({
          section: i.section,
          item_no: i.item_no,
          description: i.description,
        })),
      },
      pdfMetadata,
      { mode: 'filled' }
    )
    doc.save(`Checklist_${pdfTemplate.name.replace(/[^A-Za-z0-9]+/g, '_')}_FILLED.pdf`)
    setShowMetadataDialog(false)
    toast.success('Filled PDF generated')
  }

  return (
    <div className="flex flex-col h-full">
      <Header />
      <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <ClipboardCheck className="h-6 w-6" />
            Checklist Templates
          </h1>
          <p className="text-slate-500 mt-1">
            Create and manage checklist templates for BOQ quality checks
          </p>
        </div>
        <div className="flex gap-2">
          <input
            type="file"
            ref={fileInputRef}
            accept=".xlsx,.xls"
            onChange={handleFileSelect}
            className="hidden"
          />
          <Button variant="outline" onClick={() => fileInputRef.current?.click()}>
            <Upload className="h-4 w-4 mr-2" />
            Upload Excel
          </Button>
          <Button onClick={openCreateDialog}>
            <Plus className="h-4 w-4 mr-2" />
            Create Template
          </Button>
        </div>
      </div>

      {/* Templates List */}
      <Card>
        <CardHeader>
          <CardTitle>Templates</CardTitle>
          <CardDescription>
            {templates.length} checklist template{templates.length !== 1 ? 's' : ''} available
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
              <p className="text-slate-500 mt-4">Loading templates...</p>
            </div>
          ) : templates.length === 0 ? (
            <div className="text-center py-8">
              <ClipboardCheck className="h-12 w-12 mx-auto text-slate-300 mb-4" />
              <h3 className="text-lg font-medium text-slate-900 mb-2">No Templates</h3>
              <p className="text-slate-500 mb-4">Create your first checklist template or upload from Excel</p>
              <div className="flex justify-center gap-2">
                <Button variant="outline" onClick={() => fileInputRef.current?.click()}>
                  <Upload className="h-4 w-4 mr-2" />
                  Upload Excel
                </Button>
                <Button onClick={openCreateDialog}>
                  <Plus className="h-4 w-4 mr-2" />
                  Create Template
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {templates.map((template) => (
                <div
                  key={template.id}
                  className="border rounded-lg overflow-hidden"
                >
                  <div
                    className="flex items-center justify-between p-4 bg-slate-50 cursor-pointer hover:bg-slate-100"
                    onClick={() => setExpandedTemplate(expandedTemplate === template.id ? null : template.id)}
                  >
                    <div className="flex items-center gap-3">
                      <FileSpreadsheet className="h-5 w-5 text-blue-600" />
                      <div>
                        <h3 className="font-medium">{template.name}</h3>
                        <p className="text-sm text-slate-500">
                          {template.items?.length || 0} items
                          {template.description && ` - ${template.description}`}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        title="Export Blank PDF"
                        onClick={(e) => {
                          e.stopPropagation()
                          exportBlankPdf(template)
                        }}
                      >
                        <Printer className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        title="Export Filled PDF"
                        onClick={(e) => {
                          e.stopPropagation()
                          openMetadataDialog(template)
                        }}
                      >
                        <FileText className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        title="Edit template"
                        onClick={(e) => {
                          e.stopPropagation()
                          openEditDialog(template)
                        }}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        title="Delete template"
                        onClick={(e) => {
                          e.stopPropagation()
                          handleDeleteTemplate(template.id)
                        }}
                      >
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </Button>
                      {expandedTemplate === template.id ? (
                        <ChevronUp className="h-5 w-5 text-slate-400" />
                      ) : (
                        <ChevronDown className="h-5 w-5 text-slate-400" />
                      )}
                    </div>
                  </div>
                  {expandedTemplate === template.id && (
                    <div className="p-4 border-t">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-16">S.No</TableHead>
                            <TableHead>Item Description</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {(() => {
                            const sorted = template.items?.slice().sort((a, b) => a.sort_order - b.sort_order) || []
                            const rows: React.ReactElement[] = []
                            let lastSection: string | null | undefined = undefined
                            for (const item of sorted) {
                              if (item.section !== lastSection) {
                                lastSection = item.section
                                if (item.section) {
                                  rows.push(
                                    <TableRow key={`sec-${item.id}`} className="bg-blue-50">
                                      <TableCell colSpan={2} className="text-sm font-semibold text-blue-900">
                                        {item.section}
                                      </TableCell>
                                    </TableRow>
                                  )
                                }
                              }
                              rows.push(
                                <TableRow key={item.id}>
                                  <TableCell className="font-medium">{item.item_no}</TableCell>
                                  <TableCell>{item.description}</TableCell>
                                </TableRow>
                              )
                            }
                            return rows
                          })()}
                        </TableBody>
                      </Table>
                      {template.signatories && template.signatories.length > 0 && (
                        <div className="mt-4 p-3 bg-slate-50 rounded">
                          <p className="text-sm font-medium text-slate-700 mb-1">Signatories ({template.signatories.length}):</p>
                          <p className="text-sm text-slate-600">{template.signatories.join(' · ')}</p>
                        </div>
                      )}
                      {template.notes_template && (
                        <div className="mt-2 p-3 bg-slate-50 rounded">
                          <p className="text-sm font-medium text-slate-700">Notes Template:</p>
                          <p className="text-sm text-slate-600">{template.notes_template}</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create/Edit Template Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto bg-white">
          <DialogHeader>
            <DialogTitle>
              {editingTemplate ? 'Edit Template' : 'Create Checklist Template'}
            </DialogTitle>
            <DialogDescription>
              Define the items that will be checked in this template
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <Label htmlFor="name">Template Name *</Label>
                <Input
                  id="name"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="e.g., PCC Work Checklist"
                />
              </div>
              <div className="col-span-2">
                <Label htmlFor="description">Description</Label>
                <Input
                  id="description"
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  placeholder="Brief description of this checklist"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <Label>Checklist Items</Label>
                <Button type="button" variant="outline" size="sm" onClick={addItem}>
                  <Plus className="h-4 w-4 mr-1" />
                  Add Item
                </Button>
              </div>
              <div className="space-y-2 max-h-[300px] overflow-y-auto">
                {formItems.map((item, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <span className="w-8 text-center text-sm font-medium text-slate-500">
                      {item.item_no}
                    </span>
                    <Input
                      value={item.description}
                      onChange={(e) => updateItem(index, e.target.value)}
                      placeholder="Item description"
                      className="flex-1"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => removeItem(index)}
                      disabled={formItems.length === 1}
                    >
                      <Trash2 className="h-4 w-4 text-red-500" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <Label htmlFor="notes">Notes Template</Label>
              <Textarea
                id="notes"
                value={formNotes}
                onChange={(e) => setFormNotes(e.target.value)}
                placeholder="Default notes or instructions for this checklist"
                rows={3}
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <Label>Signatories</Label>
                <Button type="button" variant="outline" size="sm" onClick={addSignatory}>
                  <Plus className="h-4 w-4 mr-1" />
                  Add Signatory
                </Button>
              </div>
              <p className="text-xs text-slate-500 mb-2">
                Names that appear in the signature block at the bottom of the printed checklist
              </p>
              <div className="space-y-2 max-h-[180px] overflow-y-auto">
                {formSignatories.map((sig, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <Input
                      value={sig}
                      onChange={(e) => updateSignatory(index, e.target.value)}
                      placeholder="e.g., C&W Representative"
                      className="flex-1"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => removeSignatory(index)}
                    >
                      <Trash2 className="h-4 w-4 text-red-500" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveTemplate}>
              {editingTemplate ? 'Save Changes' : 'Create Template'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Upload Preview Dialog */}
      <Dialog open={showUploadDialog} onOpenChange={setShowUploadDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto bg-white">
          <DialogHeader>
            <DialogTitle>Import Checklist Template</DialogTitle>
            <DialogDescription>
              Review and edit the imported checklist items before saving
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <Label htmlFor="uploadName">Template Name *</Label>
                <Input
                  id="uploadName"
                  value={uploadName}
                  onChange={(e) => setUploadName(e.target.value)}
                  placeholder="Enter template name"
                />
              </div>
              <div className="col-span-2">
                <Label htmlFor="uploadDescription">Description</Label>
                <Input
                  id="uploadDescription"
                  value={uploadDescription}
                  onChange={(e) => setUploadDescription(e.target.value)}
                  placeholder="Brief description"
                />
              </div>
            </div>

            <div>
              <Label>Checklist Items ({uploadedItems.length})</Label>
              <div className="space-y-2 max-h-[300px] overflow-y-auto mt-2">
                {(() => {
                  const rows: React.ReactElement[] = []
                  let lastSection: string | null | undefined = undefined
                  uploadedItems.forEach((item, index) => {
                    if (item.section !== lastSection) {
                      lastSection = item.section
                      if (item.section) {
                        rows.push(
                          <div key={`sec-${index}`} className="text-xs font-semibold text-blue-900 bg-blue-50 px-2 py-1 rounded mt-2">
                            {item.section}
                          </div>
                        )
                      }
                    }
                    rows.push(
                      <div key={index} className="flex items-center gap-2">
                        <span className="w-8 text-center text-sm font-medium text-slate-500">
                          {item.item_no}
                        </span>
                        <Input
                          value={item.description}
                          onChange={(e) => updateUploadedItem(index, e.target.value)}
                          placeholder="Item description"
                          className="flex-1"
                        />
                      </div>
                    )
                  })
                  return rows
                })()}
              </div>
            </div>

            {uploadSignatories.length > 0 && (
              <div>
                <Label>Detected Signatories ({uploadSignatories.length})</Label>
                <p className="text-xs text-slate-500 mt-1">
                  Edit later via the template&apos;s Edit dialog if needed
                </p>
                <div className="text-sm text-slate-600 mt-1 p-2 bg-slate-50 rounded">
                  {uploadSignatories.join(' · ')}
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowUploadDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveUploadedTemplate}>
              Save Template
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Filled PDF Metadata Dialog */}
      <Dialog open={showMetadataDialog} onOpenChange={setShowMetadataDialog}>
        <DialogContent className="max-w-xl bg-white">
          <DialogHeader>
            <DialogTitle>Generate Filled PDF</DialogTitle>
            <DialogDescription>
              Fill in the per-submission details. Leave any field blank to print an underline for handwriting.
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <Label htmlFor="md-project">Project</Label>
              <Input
                id="md-project"
                value={pdfMetadata.project || ''}
                onChange={(e) => setPdfMetadata({ ...pdfMetadata, project: e.target.value })}
                placeholder="e.g., TCS Vizag"
              />
            </div>
            <div>
              <Label htmlFor="md-make">Make</Label>
              <Input
                id="md-make"
                value={pdfMetadata.make || ''}
                onChange={(e) => setPdfMetadata({ ...pdfMetadata, make: e.target.value })}
                placeholder="e.g., K-Light"
              />
            </div>
            <div>
              <Label htmlFor="md-date">Date</Label>
              <Input
                id="md-date"
                type="date"
                value={pdfMetadata.date || ''}
                onChange={(e) => setPdfMetadata({ ...pdfMetadata, date: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="md-drawing">Shop Drawing No</Label>
              <Input
                id="md-drawing"
                value={pdfMetadata.shopDrawingNo || ''}
                onChange={(e) => setPdfMetadata({ ...pdfMetadata, shopDrawingNo: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="md-boq">BOQ Line Item No</Label>
              <Input
                id="md-boq"
                value={pdfMetadata.boqLineItemNo || ''}
                onChange={(e) => setPdfMetadata({ ...pdfMetadata, boqLineItemNo: e.target.value })}
              />
            </div>
            <div className="col-span-2">
              <Label htmlFor="md-location">Location</Label>
              <Input
                id="md-location"
                value={pdfMetadata.location || ''}
                onChange={(e) => setPdfMetadata({ ...pdfMetadata, location: e.target.value })}
              />
            </div>
            <div className="col-span-2">
              <Label htmlFor="md-floor">Building &amp; Floor</Label>
              <Input
                id="md-floor"
                value={pdfMetadata.buildingFloor || ''}
                onChange={(e) => setPdfMetadata({ ...pdfMetadata, buildingFloor: e.target.value })}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowMetadataDialog(false)}>
              Cancel
            </Button>
            <Button onClick={exportFilledPdf}>
              Generate PDF
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      </div>
    </div>
  )
}
