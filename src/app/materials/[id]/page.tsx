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
  ArrowLeft,
  Plus,
  MoreHorizontal,
  Pencil,
  Trash2,
  PackageOpen,
  Calendar,
  Building2,
  FileSpreadsheet,
  TrendingUp,
  Truck,
} from 'lucide-react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'

interface Material {
  id: string
  line_item_id: string
  name: string
  material_type: string | null
  unit: string
  required_quantity: number | null
  created_at: string
  boq_line_items: {
    id: string
    item_number: string
    description: string
    boq_headlines: {
      id: string
      serial_number: number
      name: string
      packages: {
        id: string
        name: string
        sites: {
          id: string
          name: string
        }
      }
    }
  }
}

interface MaterialReceipt {
  id: string
  material_id: string
  invoice_number: string | null
  receipt_date: string
  quantity_received: number
  vendor_name: string | null
  notes: string | null
  created_at: string
}

const emptyReceipt = {
  invoice_number: '',
  receipt_date: new Date().toISOString().split('T')[0],
  quantity_received: 0,
  vendor_name: '',
  notes: '',
}

export default function MaterialDetailPage() {
  const params = useParams()
  const router = useRouter()
  const materialId = params.id as string

  const [material, setMaterial] = useState<Material | null>(null)
  const [receipts, setReceipts] = useState<MaterialReceipt[]>([])
  const [loading, setLoading] = useState(true)

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingReceipt, setEditingReceipt] = useState<MaterialReceipt | null>(null)
  const [formData, setFormData] = useState(emptyReceipt)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetchData()
  }, [materialId])

  async function fetchData() {
    try {
      // Fetch material
      const { data: materialData, error: materialError } = await supabase
        .from('materials')
        .select(`
          *,
          boq_line_items (
            id,
            item_number,
            description,
            boq_headlines (
              id,
              serial_number,
              name,
              packages (
                id,
                name,
                sites (
                  id,
                  name
                )
              )
            )
          )
        `)
        .eq('id', materialId)
        .single()

      if (materialError) throw materialError
      setMaterial(materialData)

      // Fetch receipts
      const { data: receiptsData, error: receiptsError } = await supabase
        .from('material_receipts')
        .select('*')
        .eq('material_id', materialId)
        .order('receipt_date', { ascending: false })

      if (receiptsError) throw receiptsError
      setReceipts(receiptsData || [])
    } catch (error) {
      console.error('Error fetching data:', error)
      toast.error('Failed to load material data')
      router.push('/materials')
    } finally {
      setLoading(false)
    }
  }

  function openAddDialog() {
    setEditingReceipt(null)
    setFormData({ ...emptyReceipt })
    setDialogOpen(true)
  }

  function openEditDialog(receipt: MaterialReceipt) {
    setEditingReceipt(receipt)
    setFormData({
      invoice_number: receipt.invoice_number || '',
      receipt_date: receipt.receipt_date,
      quantity_received: receipt.quantity_received,
      vendor_name: receipt.vendor_name || '',
      notes: receipt.notes || '',
    })
    setDialogOpen(true)
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()

    if (!formData.quantity_received || formData.quantity_received <= 0) {
      toast.error('Quantity received is required')
      return
    }

    setSaving(true)

    try {
      if (editingReceipt) {
        const { error } = await supabase
          .from('material_receipts')
          .update({
            invoice_number: formData.invoice_number || null,
            receipt_date: formData.receipt_date,
            quantity_received: formData.quantity_received,
            vendor_name: formData.vendor_name || null,
            notes: formData.notes || null,
          })
          .eq('id', editingReceipt.id)

        if (error) throw error

        setReceipts(receipts.map(r =>
          r.id === editingReceipt.id
            ? { ...r, ...formData, invoice_number: formData.invoice_number || null, vendor_name: formData.vendor_name || null, notes: formData.notes || null }
            : r
        ))
        toast.success('Receipt updated')
      } else {
        const { data, error } = await supabase
          .from('material_receipts')
          .insert({
            material_id: materialId,
            invoice_number: formData.invoice_number || null,
            receipt_date: formData.receipt_date,
            quantity_received: formData.quantity_received,
            vendor_name: formData.vendor_name || null,
            notes: formData.notes || null,
          })
          .select()
          .single()

        if (error) throw error

        setReceipts([data, ...receipts])
        toast.success('Receipt added')
      }

      setDialogOpen(false)
    } catch (error) {
      console.error('Error saving receipt:', error)
      toast.error('Failed to save receipt')
    } finally {
      setSaving(false)
    }
  }

  async function deleteReceipt(id: string) {
    if (!confirm('Are you sure you want to delete this receipt?')) {
      return
    }

    try {
      const { error } = await supabase
        .from('material_receipts')
        .delete()
        .eq('id', id)

      if (error) throw error

      setReceipts(receipts.filter(r => r.id !== id))
      toast.success('Receipt deleted')
    } catch (error) {
      console.error('Error deleting receipt:', error)
      toast.error('Failed to delete receipt')
    }
  }

  // Calculate totals
  const totalReceived = receipts.reduce((sum, r) => sum + (r.quantity_received || 0), 0)
  const required = material?.required_quantity || 0
  const progress = required > 0 ? Math.min((totalReceived / required) * 100, 100) : 0
  const remaining = Math.max(required - totalReceived, 0)

  if (loading) {
    return (
      <div className="flex flex-col min-h-screen">
        <Header title="Loading..." />
        <div className="flex-1 flex items-center justify-center">
          <p className="text-slate-500">Loading material data...</p>
        </div>
      </div>
    )
  }

  if (!material) {
    return null
  }

  return (
    <div className="flex flex-col min-h-screen">
      <Header title={material.name} />

      <div className="flex-1 p-4 md:p-6 space-y-6">
        {/* Back Button */}
        <Link href="/materials" className="inline-flex items-center text-sm text-slate-600 hover:text-slate-900">
          <ArrowLeft className="h-4 w-4 mr-1" />
          Back to Materials
        </Link>

        {/* Material Info Card */}
        <Card>
          <CardHeader>
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <PackageOpen className="h-5 w-5" />
                  {material.name}
                </CardTitle>
                <CardDescription className="mt-2 space-y-1">
                  <span className="flex items-center gap-1">
                    <Building2 className="h-3 w-3" />
                    {material.boq_line_items?.boq_headlines?.packages?.sites?.name} &gt;{' '}
                    {material.boq_line_items?.boq_headlines?.packages?.name}
                  </span>
                  <span className="flex items-center gap-1">
                    <FileSpreadsheet className="h-3 w-3" />
                    {material.boq_line_items?.item_number} - {material.boq_line_items?.description?.substring(0, 60)}...
                  </span>
                </CardDescription>
              </div>
              <Badge variant="outline" className="text-sm">
                {material.material_type || 'direct'}
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            {/* Progress Stats */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
              <div className="bg-slate-50 rounded-lg p-4">
                <p className="text-sm text-slate-500">Required</p>
                <p className="text-2xl font-semibold">
                  {required || '-'} <span className="text-sm font-normal text-slate-500">{material.unit}</span>
                </p>
              </div>
              <div className="bg-green-50 rounded-lg p-4">
                <p className="text-sm text-green-600">Received</p>
                <p className="text-2xl font-semibold text-green-700">
                  {totalReceived} <span className="text-sm font-normal">{material.unit}</span>
                </p>
              </div>
              <div className="bg-amber-50 rounded-lg p-4">
                <p className="text-sm text-amber-600">Remaining</p>
                <p className="text-2xl font-semibold text-amber-700">
                  {remaining} <span className="text-sm font-normal">{material.unit}</span>
                </p>
              </div>
              <div className="bg-blue-50 rounded-lg p-4">
                <p className="text-sm text-blue-600">Progress</p>
                <p className="text-2xl font-semibold text-blue-700">
                  {progress.toFixed(0)}%
                </p>
              </div>
            </div>

            {/* Progress Bar */}
            {required > 0 && (
              <div className="space-y-2">
                <Progress value={progress} className="h-3" />
                <p className="text-sm text-slate-500 text-right">
                  {totalReceived} / {required} {material.unit} received
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Receipts Card */}
        <Card>
          <CardHeader>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Truck className="h-5 w-5" />
                  Material Receipts
                </CardTitle>
                <CardDescription>
                  {receipts.length} receipt{receipts.length !== 1 ? 's' : ''} recorded
                </CardDescription>
              </div>
              <Button onClick={openAddDialog}>
                <Plus className="h-4 w-4 mr-2" />
                Add Receipt
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {receipts.length === 0 ? (
              <div className="text-center py-12">
                <Truck className="h-12 w-12 mx-auto text-slate-300 mb-4" />
                <h3 className="text-lg font-medium text-slate-900 mb-2">No receipts yet</h3>
                <p className="text-slate-500 mb-4">
                  Record material receipts as they arrive on site.
                </p>
                <Button onClick={openAddDialog}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Receipt
                </Button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Invoice No.</TableHead>
                      <TableHead>Vendor</TableHead>
                      <TableHead className="text-right">Quantity</TableHead>
                      <TableHead>Notes</TableHead>
                      <TableHead className="w-[50px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {receipts.map((receipt) => (
                      <TableRow key={receipt.id}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Calendar className="h-4 w-4 text-slate-400" />
                            {new Date(receipt.receipt_date).toLocaleDateString('en-IN')}
                          </div>
                        </TableCell>
                        <TableCell>{receipt.invoice_number || '-'}</TableCell>
                        <TableCell>{receipt.vendor_name || '-'}</TableCell>
                        <TableCell className="text-right font-medium">
                          {receipt.quantity_received} {material.unit}
                        </TableCell>
                        <TableCell className="max-w-[200px]">
                          <p className="truncate text-sm text-slate-500">
                            {receipt.notes || '-'}
                          </p>
                        </TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => openEditDialog(receipt)}>
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
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Add/Edit Receipt Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <form onSubmit={handleSave}>
            <DialogHeader>
              <DialogTitle>
                {editingReceipt ? 'Edit Receipt' : 'Add Receipt'}
              </DialogTitle>
              <DialogDescription>
                {editingReceipt
                  ? 'Update receipt details'
                  : 'Record a new material receipt'
                }
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="receipt_date">Receipt Date *</Label>
                  <Input
                    id="receipt_date"
                    type="date"
                    value={formData.receipt_date}
                    onChange={(e) => setFormData({ ...formData, receipt_date: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="quantity_received">Quantity Received *</Label>
                  <Input
                    id="quantity_received"
                    type="number"
                    step="0.001"
                    min="0"
                    placeholder="0"
                    value={formData.quantity_received || ''}
                    onChange={(e) => setFormData({
                      ...formData,
                      quantity_received: parseFloat(e.target.value) || 0
                    })}
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="invoice_number">Invoice Number</Label>
                  <Input
                    id="invoice_number"
                    placeholder="INV-001"
                    value={formData.invoice_number}
                    onChange={(e) => setFormData({ ...formData, invoice_number: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="vendor_name">Vendor Name</Label>
                  <Input
                    id="vendor_name"
                    placeholder="Supplier name"
                    value={formData.vendor_name}
                    onChange={(e) => setFormData({ ...formData, vendor_name: e.target.value })}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="notes">Notes</Label>
                <Textarea
                  id="notes"
                  placeholder="Additional details..."
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  rows={2}
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? 'Saving...' : (editingReceipt ? 'Update' : 'Add Receipt')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
