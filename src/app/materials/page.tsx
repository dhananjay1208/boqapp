'use client'

import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Header } from '@/components/layout/header'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
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
  Package,
  Plus,
  MoreHorizontal,
  Pencil,
  Trash2,
  Eye,
  Building2,
  FileSpreadsheet,
  Search,
  PackageOpen,
} from 'lucide-react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'

interface Site {
  id: string
  name: string
}

interface PackageData {
  id: string
  name: string
  site_id: string
}

interface Material {
  id: string
  line_item_id: string
  name: string
  material_type: string | null
  unit: string
  required_quantity: number | null
  created_at: string
  total_received: number
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

const emptyMaterial = {
  name: '',
  material_type: 'direct',
  unit: 'nos',
  required_quantity: 0,
}

function MaterialsContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const lineItemIdParam = searchParams.get('lineItem')
  const headlineIdParam = searchParams.get('headline')

  const [sites, setSites] = useState<Site[]>([])
  const [packages, setPackages] = useState<PackageData[]>([])
  const [materials, setMaterials] = useState<Material[]>([])
  const [loading, setLoading] = useState(true)

  // Filters
  const [selectedSite, setSelectedSite] = useState<string>('all')
  const [searchQuery, setSearchQuery] = useState('')

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingMaterial, setEditingMaterial] = useState<Material | null>(null)
  const [formData, setFormData] = useState(emptyMaterial)
  const [saving, setSaving] = useState(false)
  const [selectedLineItemId, setSelectedLineItemId] = useState<string>('')

  // Line items for dropdown
  const [lineItems, setLineItems] = useState<any[]>([])

  useEffect(() => {
    fetchData()
  }, [])

  async function fetchData() {
    try {
      // Fetch sites
      const { data: sitesData } = await supabase
        .from('sites')
        .select('id, name')
        .order('name')

      setSites(sitesData || [])

      // Fetch packages
      const { data: packagesData } = await supabase
        .from('packages')
        .select('id, name, site_id')
        .order('name')

      setPackages(packagesData || [])

      // Fetch materials with related data
      const { data: materialsData, error } = await supabase
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
        .order('created_at', { ascending: false })

      if (error) throw error

      // Fetch receipts totals for each material
      const materialsWithReceipts = await Promise.all(
        (materialsData || []).map(async (material) => {
          const { data: receipts } = await supabase
            .from('material_receipts')
            .select('quantity_received')
            .eq('material_id', material.id)

          const totalReceived = receipts?.reduce((sum, r) => sum + (r.quantity_received || 0), 0) || 0

          return { ...material, total_received: totalReceived }
        })
      )

      setMaterials(materialsWithReceipts)

      // Fetch line items for the add dialog
      const { data: lineItemsData } = await supabase
        .from('boq_line_items')
        .select(`
          id,
          item_number,
          description,
          boq_headlines (
            serial_number,
            name,
            packages (
              name,
              sites (name)
            )
          )
        `)
        .order('item_number')

      setLineItems(lineItemsData || [])

      // Set default line item if provided in URL
      if (lineItemIdParam) {
        setSelectedLineItemId(lineItemIdParam)
      }
    } catch (error) {
      console.error('Error fetching data:', error)
      toast.error('Failed to load materials')
    } finally {
      setLoading(false)
    }
  }

  function openAddDialog() {
    setEditingMaterial(null)
    setFormData({ ...emptyMaterial })
    setSelectedLineItemId(lineItemIdParam || '')
    setDialogOpen(true)
  }

  function openEditDialog(material: Material) {
    setEditingMaterial(material)
    setFormData({
      name: material.name,
      material_type: material.material_type || 'direct',
      unit: material.unit,
      required_quantity: material.required_quantity || 0,
    })
    setSelectedLineItemId(material.line_item_id)
    setDialogOpen(true)
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()

    if (!selectedLineItemId) {
      toast.error('Please select a BOQ line item')
      return
    }

    if (!formData.name.trim()) {
      toast.error('Material name is required')
      return
    }

    setSaving(true)

    try {
      if (editingMaterial) {
        const { error } = await supabase
          .from('materials')
          .update({
            name: formData.name,
            material_type: formData.material_type,
            unit: formData.unit,
            required_quantity: formData.required_quantity || null,
          })
          .eq('id', editingMaterial.id)

        if (error) throw error
        toast.success('Material updated')
      } else {
        const { error } = await supabase
          .from('materials')
          .insert({
            line_item_id: selectedLineItemId,
            name: formData.name,
            material_type: formData.material_type,
            unit: formData.unit,
            required_quantity: formData.required_quantity || null,
          })

        if (error) throw error
        toast.success('Material added')
      }

      setDialogOpen(false)
      fetchData()
    } catch (error) {
      console.error('Error saving material:', error)
      toast.error('Failed to save material')
    } finally {
      setSaving(false)
    }
  }

  async function deleteMaterial(id: string) {
    if (!confirm('Are you sure you want to delete this material? All receipts will also be deleted.')) {
      return
    }

    try {
      const { error } = await supabase
        .from('materials')
        .delete()
        .eq('id', id)

      if (error) throw error

      setMaterials(materials.filter(m => m.id !== id))
      toast.success('Material deleted')
    } catch (error) {
      console.error('Error deleting material:', error)
      toast.error('Failed to delete material')
    }
  }

  // Filter materials
  const filteredMaterials = materials.filter(material => {
    const siteMatch = selectedSite === 'all' ||
      material.boq_line_items?.boq_headlines?.packages?.sites?.id === selectedSite

    const searchMatch = !searchQuery ||
      material.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      material.boq_line_items?.description?.toLowerCase().includes(searchQuery.toLowerCase())

    return siteMatch && searchMatch
  })

  const getStatusBadge = (material: Material) => {
    const required = material.required_quantity || 0
    const received = material.total_received || 0

    if (required === 0) {
      return <Badge variant="secondary">No target</Badge>
    }

    const percentage = (received / required) * 100

    if (percentage >= 100) {
      return <Badge className="bg-green-100 text-green-700">Complete</Badge>
    } else if (percentage > 0) {
      return <Badge className="bg-amber-100 text-amber-700">{percentage.toFixed(0)}%</Badge>
    } else {
      return <Badge className="bg-slate-100 text-slate-700">Pending</Badge>
    }
  }

  return (
    <div className="flex flex-col min-h-screen">
      <Header title="Materials" />

      <div className="flex-1 p-4 md:p-6 space-y-6">
        {/* Filters */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <Input
                    placeholder="Search materials..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
              <Select value={selectedSite} onValueChange={setSelectedSite}>
                <SelectTrigger className="w-full sm:w-[200px]">
                  <SelectValue placeholder="Filter by site" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Sites</SelectItem>
                  {sites.map((site) => (
                    <SelectItem key={site.id} value={site.id}>
                      {site.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button onClick={openAddDialog}>
                <Plus className="h-4 w-4 mr-2" />
                Add Material
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Materials List */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <PackageOpen className="h-5 w-5" />
              Materials
            </CardTitle>
            <CardDescription>
              {filteredMaterials.length} material{filteredMaterials.length !== 1 ? 's' : ''} found
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-12">
                <p className="text-slate-500">Loading materials...</p>
              </div>
            ) : filteredMaterials.length === 0 ? (
              <div className="text-center py-12">
                <PackageOpen className="h-12 w-12 mx-auto text-slate-300 mb-4" />
                <h3 className="text-lg font-medium text-slate-900 mb-2">No materials found</h3>
                <p className="text-slate-500 mb-4">
                  {searchQuery || selectedSite !== 'all'
                    ? 'Try adjusting your filters'
                    : 'Add materials to track for your BOQ line items'
                  }
                </p>
                <Button onClick={openAddDialog}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Material
                </Button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Material</TableHead>
                      <TableHead>BOQ Item</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Unit</TableHead>
                      <TableHead className="text-right">Required</TableHead>
                      <TableHead className="text-right">Received</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="w-[50px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredMaterials.map((material) => (
                      <TableRow key={material.id}>
                        <TableCell className="font-medium">
                          {material.name}
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">
                            <p className="font-medium">
                              {material.boq_line_items?.item_number} - {material.boq_line_items?.description?.substring(0, 40)}...
                            </p>
                            <p className="text-slate-500 text-xs">
                              {material.boq_line_items?.boq_headlines?.packages?.sites?.name} &gt;{' '}
                              {material.boq_line_items?.boq_headlines?.packages?.name}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">
                            {material.material_type || 'direct'}
                          </Badge>
                        </TableCell>
                        <TableCell>{material.unit}</TableCell>
                        <TableCell className="text-right">
                          {material.required_quantity || '-'}
                        </TableCell>
                        <TableCell className="text-right">
                          {material.total_received || 0}
                        </TableCell>
                        <TableCell>{getStatusBadge(material)}</TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => router.push(`/materials/${material.id}`)}>
                                <Eye className="h-4 w-4 mr-2" />
                                View Receipts
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => openEditDialog(material)}>
                                <Pencil className="h-4 w-4 mr-2" />
                                Edit
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

      {/* Add/Edit Material Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <form onSubmit={handleSave}>
            <DialogHeader>
              <DialogTitle>
                {editingMaterial ? 'Edit Material' : 'Add Material'}
              </DialogTitle>
              <DialogDescription>
                {editingMaterial
                  ? 'Update material details'
                  : 'Add a new material to track for a BOQ line item'
                }
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>BOQ Line Item *</Label>
                <Select
                  value={selectedLineItemId}
                  onValueChange={setSelectedLineItemId}
                  disabled={!!editingMaterial}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select BOQ line item" />
                  </SelectTrigger>
                  <SelectContent>
                    {lineItems.map((item) => (
                      <SelectItem key={item.id} value={item.id}>
                        {item.item_number} - {item.description?.substring(0, 50)}...
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="name">Material Name *</Label>
                <Input
                  id="name"
                  placeholder="e.g., Cement, Steel, Sand"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Type</Label>
                  <Select
                    value={formData.material_type}
                    onValueChange={(value) => setFormData({ ...formData, material_type: value })}
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
                    value={formData.unit}
                    onValueChange={(value) => setFormData({ ...formData, unit: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="nos">nos</SelectItem>
                      <SelectItem value="bags">bags</SelectItem>
                      <SelectItem value="kg">kg</SelectItem>
                      <SelectItem value="ton">ton</SelectItem>
                      <SelectItem value="cum">cum</SelectItem>
                      <SelectItem value="Cu.m">Cu.m</SelectItem>
                      <SelectItem value="Sq.m">Sq.m</SelectItem>
                      <SelectItem value="Rmt">Rmt</SelectItem>
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
                  value={formData.required_quantity || ''}
                  onChange={(e) => setFormData({
                    ...formData,
                    required_quantity: e.target.value ? parseFloat(e.target.value) : 0
                  })}
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? 'Saving...' : (editingMaterial ? 'Update' : 'Add Material')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default function MaterialsPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-screen">Loading...</div>}>
      <MaterialsContent />
    </Suspense>
  )
}
