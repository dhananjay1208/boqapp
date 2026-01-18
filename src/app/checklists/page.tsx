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
  GripVertical,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'
import * as XLSX from 'xlsx'

interface ChecklistTemplate {
  id: string
  name: string
  description: string | null
  notes_template: string | null
  created_at: string
  items?: ChecklistTemplateItem[]
}

interface ChecklistTemplateItem {
  id: string
  template_id: string
  item_no: number
  description: string
  sort_order: number
}

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
  const [formItems, setFormItems] = useState<{ item_no: number; description: string }[]>([
    { item_no: 1, description: '' },
  ])

  // Upload state
  const [uploadedItems, setUploadedItems] = useState<{ item_no: number; description: string }[]>([])
  const [uploadName, setUploadName] = useState('')
  const [uploadDescription, setUploadDescription] = useState('')

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
    setFormItems([{ item_no: 1, description: '' }])
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
      template.items?.map(item => ({
        item_no: item.item_no,
        description: item.description,
      })) || [{ item_no: 1, description: '' }]
    )
    setEditingTemplate(template)
    setShowCreateDialog(true)
  }

  function addItem() {
    setFormItems([...formItems, { item_no: formItems.length + 1, description: '' }])
  }

  function removeItem(index: number) {
    if (formItems.length > 1) {
      const newItems = formItems.filter((_, i) => i !== index)
      // Renumber items
      setFormItems(newItems.map((item, i) => ({ ...item, item_no: i + 1 })))
    }
  }

  function updateItem(index: number, description: string) {
    const newItems = [...formItems]
    newItems[index].description = description
    setFormItems(newItems)
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

    try {
      if (editingTemplate) {
        // Update existing template
        const { error: templateError } = await supabase
          .from('checklist_templates')
          .update({
            name: formName.trim(),
            description: formDescription.trim() || null,
            notes_template: formNotes.trim() || null,
          })
          .eq('id', editingTemplate.id)

        if (templateError) throw templateError

        // Delete existing items and re-insert
        await supabase
          .from('checklist_template_items')
          .delete()
          .eq('template_id', editingTemplate.id)

        const { error: itemsError } = await supabase
          .from('checklist_template_items')
          .insert(
            validItems.map((item, index) => ({
              template_id: editingTemplate.id,
              item_no: index + 1,
              description: item.description.trim(),
              sort_order: index + 1,
            }))
          )

        if (itemsError) throw itemsError

        toast.success('Template updated successfully')
      } else {
        // Create new template
        const { data: template, error: templateError } = await supabase
          .from('checklist_templates')
          .insert({
            name: formName.trim(),
            description: formDescription.trim() || null,
            notes_template: formNotes.trim() || null,
          })
          .select()
          .single()

        if (templateError) throw templateError

        const { error: itemsError } = await supabase
          .from('checklist_template_items')
          .insert(
            validItems.map((item, index) => ({
              template_id: template.id,
              item_no: index + 1,
              description: item.description.trim(),
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

  function handleFileSelect(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer)
        const workbook = XLSX.read(data, { type: 'array' })
        const sheetName = workbook.SheetNames[0]
        const worksheet = workbook.Sheets[sheetName]
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][]

        // Parse the template format
        // Row 4: CHECKLIST FOR [name]
        // Row 9: Headers (S No, Item description, Status, Remarks)
        // Row 10+: Items

        let checklistName = ''
        const items: { item_no: number; description: string }[] = []

        jsonData.forEach((row, index) => {
          // Check for checklist name (row 4 in Excel = index 3)
          if (row[1] && typeof row[1] === 'string' && row[1].includes('CHECKLIST FOR')) {
            checklistName = row[1].replace('CHECKLIST FOR', '').trim()
          }

          // Check for items (rows after headers)
          // Items have a number in first column and description in second
          if (typeof row[0] === 'number' && row[0] >= 1 && row[0] <= 20) {
            const description = row[1]?.toString().trim()
            if (description) {
              items.push({
                item_no: row[0],
                description: description,
              })
            }
          }
        })

        if (items.length === 0) {
          // If no items found with descriptions, create empty placeholders
          for (let i = 1; i <= 10; i++) {
            items.push({ item_no: i, description: '' })
          }
        }

        setUploadName(checklistName || file.name.replace(/\.[^/.]+$/, ''))
        setUploadDescription('')
        setUploadedItems(items)
        setShowUploadDialog(true)
      } catch (error) {
        console.error('Error parsing Excel file:', error)
        toast.error('Failed to parse Excel file')
      }
    }
    reader.readAsArrayBuffer(file)

    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  async function handleSaveUploadedTemplate() {
    if (!uploadName.trim()) {
      toast.error('Please enter a template name')
      return
    }

    const validItems = uploadedItems.filter(item => item.description.trim())
    if (validItems.length === 0) {
      toast.error('Please add at least one item with description')
      return
    }

    try {
      const { data: template, error: templateError } = await supabase
        .from('checklist_templates')
        .insert({
          name: uploadName.trim(),
          description: uploadDescription.trim() || null,
        })
        .select()
        .single()

      if (templateError) throw templateError

      const { error: itemsError } = await supabase
        .from('checklist_template_items')
        .insert(
          validItems.map((item, index) => ({
            template_id: template.id,
            item_no: index + 1,
            description: item.description.trim(),
            sort_order: index + 1,
          }))
        )

      if (itemsError) throw itemsError

      toast.success('Template created from Excel')
      setShowUploadDialog(false)
      setUploadedItems([])
      setUploadName('')
      setUploadDescription('')
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
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
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
                          {template.items?.sort((a, b) => a.item_no - b.item_no).map((item) => (
                            <TableRow key={item.id}>
                              <TableCell className="font-medium">{item.item_no}</TableCell>
                              <TableCell>{item.description}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                      {template.notes_template && (
                        <div className="mt-4 p-3 bg-slate-50 rounded">
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
                {uploadedItems.map((item, index) => (
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
                ))}
              </div>
            </div>
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
      </div>
    </div>
  )
}
