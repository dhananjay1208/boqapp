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
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import {
  FileText,
  Plus,
  Pencil,
  Trash2,
  ChevronDown,
  ChevronRight,
  Eye,
  Upload,
  FileCheck,
  ClipboardList,
  Download,
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

interface BOQJMR {
  id: string
  line_item_id: string
  jmr_number: string | null
  jmr_date: string | null
  measurement_date: string | null
  boq_quantity: number | null
  executed_quantity: number | null
  approved_quantity: number | null
  customer_representative: string | null
  contractor_representative: string | null
  remarks: string | null
  status: 'draft' | 'submitted' | 'approved' | 'disputed'
  file_path: string | null
  file_name: string | null
  created_at: string
}

interface Props {
  headlineId: string
  lineItems: BOQLineItem[]
}

const STATUS_OPTIONS = [
  { value: 'draft', label: 'Draft', color: 'bg-slate-100 text-slate-700' },
  { value: 'submitted', label: 'Submitted', color: 'bg-blue-100 text-blue-700' },
  { value: 'approved', label: 'Approved', color: 'bg-green-100 text-green-700' },
  { value: 'disputed', label: 'Disputed', color: 'bg-red-100 text-red-700' },
]

export default function BOQJMRTab({ headlineId, lineItems }: Props) {
  const [jmrList, setJmrList] = useState<BOQJMR[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedLineItems, setExpandedLineItems] = useState<Set<string>>(new Set())

  // Dialog states
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [showViewDialog, setShowViewDialog] = useState(false)
  const [selectedLineItem, setSelectedLineItem] = useState<BOQLineItem | null>(null)
  const [selectedJMR, setSelectedJMR] = useState<BOQJMR | null>(null)

  // Form state
  const [formData, setFormData] = useState({
    jmr_number: '',
    jmr_date: new Date().toISOString().split('T')[0],
    measurement_date: '',
    boq_quantity: '',
    executed_quantity: '',
    approved_quantity: '',
    customer_representative: '',
    contractor_representative: '',
    remarks: '',
    status: 'draft',
  })

  const fileInputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetchData()
  }, [headlineId, lineItems.length])

  async function fetchData() {
    try {
      const lineItemIds = lineItems.map(li => li.id)
      if (lineItemIds.length > 0) {
        const { data, error } = await supabase
          .from('boq_jmr')
          .select('*')
          .in('line_item_id', lineItemIds)
          .order('created_at', { ascending: false })

        if (error) {
          console.error('Error fetching JMR:', error)
          // Table might not exist yet
          setJmrList([])
        } else {
          setJmrList(data || [])
        }
      }
    } catch (error) {
      console.error('Error fetching JMR data:', error)
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
    setFormData({
      jmr_number: '',
      jmr_date: new Date().toISOString().split('T')[0],
      measurement_date: '',
      boq_quantity: lineItem.quantity.toString(),
      executed_quantity: '',
      approved_quantity: '',
      customer_representative: '',
      contractor_representative: '',
      remarks: '',
      status: 'draft',
    })
    setShowCreateDialog(true)
  }

  function openViewDialog(jmr: BOQJMR) {
    setSelectedJMR(jmr)
    setFormData({
      jmr_number: jmr.jmr_number || '',
      jmr_date: jmr.jmr_date || '',
      measurement_date: jmr.measurement_date || '',
      boq_quantity: jmr.boq_quantity?.toString() || '',
      executed_quantity: jmr.executed_quantity?.toString() || '',
      approved_quantity: jmr.approved_quantity?.toString() || '',
      customer_representative: jmr.customer_representative || '',
      contractor_representative: jmr.contractor_representative || '',
      remarks: jmr.remarks || '',
      status: jmr.status || 'draft',
    })
    setShowViewDialog(true)
  }

  async function handleSaveJMR() {
    if (!selectedLineItem) return

    setSaving(true)
    try {
      const { data, error } = await supabase
        .from('boq_jmr')
        .insert({
          line_item_id: selectedLineItem.id,
          jmr_number: formData.jmr_number.trim() || null,
          jmr_date: formData.jmr_date || null,
          measurement_date: formData.measurement_date || null,
          boq_quantity: formData.boq_quantity ? parseFloat(formData.boq_quantity) : null,
          executed_quantity: formData.executed_quantity ? parseFloat(formData.executed_quantity) : null,
          approved_quantity: formData.approved_quantity ? parseFloat(formData.approved_quantity) : null,
          customer_representative: formData.customer_representative.trim() || null,
          contractor_representative: formData.contractor_representative.trim() || null,
          remarks: formData.remarks.trim() || null,
          status: formData.status,
        })
        .select()
        .single()

      if (error) throw error

      toast.success('JMR report created successfully')
      setShowCreateDialog(false)
      fetchData()
    } catch (error) {
      console.error('Error saving JMR:', error)
      toast.error('Failed to save JMR report')
    } finally {
      setSaving(false)
    }
  }

  async function handleUpdateJMR() {
    if (!selectedJMR) return

    setSaving(true)
    try {
      const { error } = await supabase
        .from('boq_jmr')
        .update({
          jmr_number: formData.jmr_number.trim() || null,
          jmr_date: formData.jmr_date || null,
          measurement_date: formData.measurement_date || null,
          boq_quantity: formData.boq_quantity ? parseFloat(formData.boq_quantity) : null,
          executed_quantity: formData.executed_quantity ? parseFloat(formData.executed_quantity) : null,
          approved_quantity: formData.approved_quantity ? parseFloat(formData.approved_quantity) : null,
          customer_representative: formData.customer_representative.trim() || null,
          contractor_representative: formData.contractor_representative.trim() || null,
          remarks: formData.remarks.trim() || null,
          status: formData.status,
        })
        .eq('id', selectedJMR.id)

      if (error) throw error

      toast.success('JMR report updated successfully')
      setShowViewDialog(false)
      fetchData()
    } catch (error) {
      console.error('Error updating JMR:', error)
      toast.error('Failed to update JMR report')
    } finally {
      setSaving(false)
    }
  }

  async function handleDeleteJMR(jmrId: string) {
    if (!confirm('Are you sure you want to delete this JMR report?')) return

    try {
      // First delete the file if it exists
      const jmr = jmrList.find(j => j.id === jmrId)
      if (jmr?.file_path) {
        await supabase.storage.from('compliance-docs').remove([jmr.file_path])
      }

      const { error } = await supabase
        .from('boq_jmr')
        .delete()
        .eq('id', jmrId)

      if (error) throw error

      toast.success('JMR report deleted')
      fetchData()
    } catch (error) {
      console.error('Error deleting JMR:', error)
      toast.error('Failed to delete JMR report')
    }
  }

  async function handleFileUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file || !selectedJMR) return

    setUploading(true)
    try {
      // Create file path
      const fileExt = file.name.split('.').pop()
      const fileName = `${selectedJMR.id}_jmr.${fileExt}`
      const filePath = `jmr-reports/${fileName}`

      // Upload to Supabase storage
      const { error: uploadError } = await supabase.storage
        .from('compliance-docs')
        .upload(filePath, file, { upsert: true })

      if (uploadError) throw uploadError

      // Update JMR record with file path
      const { error: updateError } = await supabase
        .from('boq_jmr')
        .update({
          file_path: filePath,
          file_name: file.name,
        })
        .eq('id', selectedJMR.id)

      if (updateError) throw updateError

      // Update local state
      setSelectedJMR({
        ...selectedJMR,
        file_path: filePath,
        file_name: file.name,
      })

      toast.success('JMR file uploaded successfully')
      fetchData()
    } catch (error) {
      console.error('Error uploading JMR file:', error)
      toast.error('Failed to upload JMR file')
    } finally {
      setUploading(false)
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  async function viewFile(filePath: string) {
    try {
      const { data, error } = await supabase.storage
        .from('compliance-docs')
        .createSignedUrl(filePath, 3600)

      if (error) {
        toast.error('Failed to generate download link')
        return
      }

      window.open(data.signedUrl, '_blank')
    } catch (error) {
      console.error('Error viewing JMR file:', error)
      toast.error('Failed to view JMR file')
    }
  }

  async function deleteFile() {
    if (!selectedJMR?.file_path) return
    if (!confirm('Are you sure you want to delete this file?')) return

    try {
      // Delete from storage
      await supabase.storage
        .from('compliance-docs')
        .remove([selectedJMR.file_path])

      // Update database
      const { error } = await supabase
        .from('boq_jmr')
        .update({
          file_path: null,
          file_name: null,
        })
        .eq('id', selectedJMR.id)

      if (error) throw error

      // Update local state
      setSelectedJMR({
        ...selectedJMR,
        file_path: null,
        file_name: null,
      })

      toast.success('JMR file deleted')
      fetchData()
    } catch (error) {
      console.error('Error deleting JMR file:', error)
      toast.error('Failed to delete JMR file')
    }
  }

  function getJMRForLineItem(lineItemId: string) {
    return jmrList.filter(j => j.line_item_id === lineItemId)
  }

  function getStatusBadge(status: string) {
    const option = STATUS_OPTIONS.find(o => o.value === status)
    return (
      <Badge className={option?.color || 'bg-slate-100 text-slate-700'}>
        {option?.label || status}
      </Badge>
    )
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="py-8">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
            <p className="text-slate-500 mt-4">Loading JMR reports...</p>
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
                <FileText className="h-5 w-5" />
                JMR Reports
              </CardTitle>
              <CardDescription>
                Upload and manage Joint Measurement Reports for BOQ line items
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {lineItems.length === 0 ? (
            <div className="text-center py-12">
              <ClipboardList className="h-12 w-12 mx-auto text-slate-300 mb-4" />
              <h3 className="text-lg font-medium text-slate-900 mb-2">No Line Items</h3>
              <p className="text-slate-500">Add line items first to create JMR reports.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {lineItems.map((lineItem) => {
                const lineItemJMRs = getJMRForLineItem(lineItem.id)
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
                              {lineItemJMRs.length} JMR report{lineItemJMRs.length !== 1 ? 's' : ''}
                              {' | '}{lineItem.quantity} {lineItem.unit}
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
                        >
                          <Plus className="h-4 w-4 mr-1" />
                          New JMR
                        </Button>
                      </div>

                      <CollapsibleContent>
                        <div className="p-4 border-t">
                          {lineItemJMRs.length === 0 ? (
                            <div className="text-center py-6">
                              <FileText className="h-8 w-8 mx-auto text-slate-300 mb-2" />
                              <p className="text-sm text-slate-500">No JMR reports for this item</p>
                            </div>
                          ) : (
                            <div className="space-y-2">
                              {lineItemJMRs.map((jmr) => (
                                <div
                                  key={jmr.id}
                                  className="flex items-center justify-between p-3 border rounded-lg hover:bg-slate-50"
                                >
                                  <div className="flex items-center gap-3">
                                    <FileText className="h-5 w-5 text-blue-600" />
                                    <div>
                                      <div className="flex items-center gap-2">
                                        <p className="font-medium">
                                          {jmr.jmr_number || 'JMR Report'}
                                        </p>
                                        {getStatusBadge(jmr.status)}
                                        {jmr.file_path && (
                                          <Badge variant="outline" className="bg-green-50 text-green-700">
                                            <FileCheck className="h-3 w-3 mr-1" />
                                            File Attached
                                          </Badge>
                                        )}
                                      </div>
                                      <p className="text-sm text-slate-500">
                                        {jmr.jmr_date && `Date: ${new Date(jmr.jmr_date).toLocaleDateString('en-IN')}`}
                                        {jmr.executed_quantity && ` | Executed: ${jmr.executed_quantity} ${lineItem.unit}`}
                                        {jmr.approved_quantity && ` | Approved: ${jmr.approved_quantity} ${lineItem.unit}`}
                                      </p>
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => openViewDialog(jmr)}
                                    >
                                      <Eye className="h-4 w-4 mr-1" />
                                      View/Edit
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => handleDeleteJMR(jmr.id)}
                                    >
                                      <Trash2 className="h-4 w-4 text-red-500" />
                                    </Button>
                                  </div>
                                </div>
                              ))}
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

      {/* Create JMR Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto bg-white">
          <DialogHeader>
            <DialogTitle>Create JMR Report</DialogTitle>
            <DialogDescription>
              Create JMR for BOQ Item: {selectedLineItem?.item_number} - {selectedLineItem?.description}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>JMR Number</Label>
                <Input
                  value={formData.jmr_number}
                  onChange={(e) => setFormData({ ...formData, jmr_number: e.target.value })}
                  placeholder="e.g., JMR-001"
                />
              </div>
              <div>
                <Label>JMR Date</Label>
                <Input
                  type="date"
                  value={formData.jmr_date}
                  onChange={(e) => setFormData({ ...formData, jmr_date: e.target.value })}
                />
              </div>
              <div>
                <Label>Measurement Date</Label>
                <Input
                  type="date"
                  value={formData.measurement_date}
                  onChange={(e) => setFormData({ ...formData, measurement_date: e.target.value })}
                />
              </div>
              <div>
                <Label>Status</Label>
                <Select
                  value={formData.status}
                  onValueChange={(value) => setFormData({ ...formData, status: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUS_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label>BOQ Quantity ({selectedLineItem?.unit})</Label>
                <Input
                  type="number"
                  step="0.001"
                  value={formData.boq_quantity}
                  onChange={(e) => setFormData({ ...formData, boq_quantity: e.target.value })}
                />
              </div>
              <div>
                <Label>Executed Quantity ({selectedLineItem?.unit})</Label>
                <Input
                  type="number"
                  step="0.001"
                  value={formData.executed_quantity}
                  onChange={(e) => setFormData({ ...formData, executed_quantity: e.target.value })}
                />
              </div>
              <div>
                <Label>Approved Quantity ({selectedLineItem?.unit})</Label>
                <Input
                  type="number"
                  step="0.001"
                  value={formData.approved_quantity}
                  onChange={(e) => setFormData({ ...formData, approved_quantity: e.target.value })}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Customer Representative</Label>
                <Input
                  value={formData.customer_representative}
                  onChange={(e) => setFormData({ ...formData, customer_representative: e.target.value })}
                  placeholder="Name of customer representative"
                />
              </div>
              <div>
                <Label>Contractor Representative</Label>
                <Input
                  value={formData.contractor_representative}
                  onChange={(e) => setFormData({ ...formData, contractor_representative: e.target.value })}
                  placeholder="Name of contractor representative"
                />
              </div>
            </div>

            <div>
              <Label>Remarks</Label>
              <Textarea
                value={formData.remarks}
                onChange={(e) => setFormData({ ...formData, remarks: e.target.value })}
                rows={3}
                placeholder="Any remarks or notes..."
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveJMR} disabled={saving}>
              {saving ? 'Saving...' : 'Create JMR'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View/Edit JMR Dialog */}
      <Dialog open={showViewDialog} onOpenChange={setShowViewDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto bg-white">
          <DialogHeader>
            <DialogTitle>JMR Report: {selectedJMR?.jmr_number || 'View/Edit'}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>JMR Number</Label>
                <Input
                  value={formData.jmr_number}
                  onChange={(e) => setFormData({ ...formData, jmr_number: e.target.value })}
                  placeholder="e.g., JMR-001"
                />
              </div>
              <div>
                <Label>JMR Date</Label>
                <Input
                  type="date"
                  value={formData.jmr_date}
                  onChange={(e) => setFormData({ ...formData, jmr_date: e.target.value })}
                />
              </div>
              <div>
                <Label>Measurement Date</Label>
                <Input
                  type="date"
                  value={formData.measurement_date}
                  onChange={(e) => setFormData({ ...formData, measurement_date: e.target.value })}
                />
              </div>
              <div>
                <Label>Status</Label>
                <Select
                  value={formData.status}
                  onValueChange={(value) => setFormData({ ...formData, status: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUS_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label>BOQ Quantity</Label>
                <Input
                  type="number"
                  step="0.001"
                  value={formData.boq_quantity}
                  onChange={(e) => setFormData({ ...formData, boq_quantity: e.target.value })}
                />
              </div>
              <div>
                <Label>Executed Quantity</Label>
                <Input
                  type="number"
                  step="0.001"
                  value={formData.executed_quantity}
                  onChange={(e) => setFormData({ ...formData, executed_quantity: e.target.value })}
                />
              </div>
              <div>
                <Label>Approved Quantity</Label>
                <Input
                  type="number"
                  step="0.001"
                  value={formData.approved_quantity}
                  onChange={(e) => setFormData({ ...formData, approved_quantity: e.target.value })}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Customer Representative</Label>
                <Input
                  value={formData.customer_representative}
                  onChange={(e) => setFormData({ ...formData, customer_representative: e.target.value })}
                  placeholder="Name of customer representative"
                />
              </div>
              <div>
                <Label>Contractor Representative</Label>
                <Input
                  value={formData.contractor_representative}
                  onChange={(e) => setFormData({ ...formData, contractor_representative: e.target.value })}
                  placeholder="Name of contractor representative"
                />
              </div>
            </div>

            <div>
              <Label>Remarks</Label>
              <Textarea
                value={formData.remarks}
                onChange={(e) => setFormData({ ...formData, remarks: e.target.value })}
                rows={3}
                placeholder="Any remarks or notes..."
              />
            </div>

            {/* File Upload Section */}
            <div className="border-t pt-4 mt-4">
              <Label className="mb-2 block">JMR Document</Label>
              <input
                type="file"
                ref={fileInputRef}
                accept=".pdf,.jpg,.jpeg,.png,.doc,.docx,.xls,.xlsx"
                onChange={handleFileUpload}
                className="hidden"
              />
              {selectedJMR?.file_path ? (
                <div className="flex items-center gap-3 p-3 bg-green-50 border border-green-200 rounded-lg">
                  <FileCheck className="h-5 w-5 text-green-600" />
                  <div className="flex-1">
                    <p className="font-medium text-green-800">Document uploaded</p>
                    <p className="text-sm text-green-600">{selectedJMR.file_name}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => viewFile(selectedJMR.file_path!)}
                    >
                      <Eye className="h-4 w-4 mr-1" />
                      View
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={deleteFile}
                      className="text-red-600 hover:text-red-700"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-3 p-3 bg-slate-50 border border-slate-200 rounded-lg">
                  <Upload className="h-5 w-5 text-slate-400" />
                  <div className="flex-1">
                    <p className="text-sm text-slate-600">
                      Upload JMR document (PDF, Word, Excel, or Image)
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                  >
                    {uploading ? (
                      <>Uploading...</>
                    ) : (
                      <>
                        <Upload className="h-4 w-4 mr-1" />
                        Upload
                      </>
                    )}
                  </Button>
                </div>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowViewDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleUpdateJMR} disabled={saving}>
              {saving ? 'Saving...' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
