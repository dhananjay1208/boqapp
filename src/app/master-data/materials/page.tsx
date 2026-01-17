'use client'

import { useState, useEffect } from 'react'
import { Header } from '@/components/layout/header'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
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
  Package,
  Plus,
  Pencil,
  Trash2,
  Search,
  Filter,
  Loader2,
  Upload,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'

interface MasterMaterial {
  id: string
  category: string
  name: string
  unit: string
  description: string | null
  is_active: boolean
  created_at: string
}

const COMMON_UNITS = ['nos', 'bags', 'kg', 'cum', 'sqm', 'rmt', 'ltr', 'set', 'pair', 'roll', 'box', 'pkt']

export default function MasterMaterialsPage() {
  const [materials, setMaterials] = useState<MasterMaterial[]>([])
  const [filteredMaterials, setFilteredMaterials] = useState<MasterMaterial[]>([])
  const [loading, setLoading] = useState(true)
  const [categories, setCategories] = useState<string[]>([])

  // Filters
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string>('all')

  // Dialog states
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingMaterial, setEditingMaterial] = useState<MasterMaterial | null>(null)
  const [saving, setSaving] = useState(false)

  // Form state
  const [formData, setFormData] = useState({
    category: '',
    name: '',
    unit: '',
    description: '',
  })
  const [newCategory, setNewCategory] = useState('')
  const [showNewCategory, setShowNewCategory] = useState(false)

  useEffect(() => {
    fetchMaterials()
  }, [])

  useEffect(() => {
    filterMaterials()
  }, [materials, searchTerm, selectedCategory])

  async function fetchMaterials() {
    try {
      const { data, error } = await supabase
        .from('master_materials')
        .select('*')
        .eq('is_active', true)
        .order('category')
        .order('name')

      if (error) throw error

      setMaterials(data || [])

      // Extract unique categories
      const uniqueCategories = [...new Set((data || []).map(m => m.category))].sort()
      setCategories(uniqueCategories)
    } catch (error) {
      console.error('Error fetching materials:', error)
      toast.error('Failed to load materials')
    } finally {
      setLoading(false)
    }
  }

  function filterMaterials() {
    let filtered = [...materials]

    if (searchTerm) {
      const term = searchTerm.toLowerCase()
      filtered = filtered.filter(m =>
        m.name.toLowerCase().includes(term) ||
        m.category.toLowerCase().includes(term) ||
        m.unit.toLowerCase().includes(term)
      )
    }

    if (selectedCategory && selectedCategory !== 'all') {
      filtered = filtered.filter(m => m.category === selectedCategory)
    }

    setFilteredMaterials(filtered)
  }

  function openCreateDialog() {
    setEditingMaterial(null)
    setFormData({
      category: '',
      name: '',
      unit: 'nos',
      description: '',
    })
    setNewCategory('')
    setShowNewCategory(false)
    setDialogOpen(true)
  }

  function openEditDialog(material: MasterMaterial) {
    setEditingMaterial(material)
    setFormData({
      category: material.category,
      name: material.name,
      unit: material.unit,
      description: material.description || '',
    })
    setNewCategory('')
    setShowNewCategory(false)
    setDialogOpen(true)
  }

  async function handleSave() {
    const category = showNewCategory ? newCategory.trim() : formData.category
    if (!category) {
      toast.error('Please select or enter a category')
      return
    }
    if (!formData.name.trim()) {
      toast.error('Please enter a material name')
      return
    }
    if (!formData.unit.trim()) {
      toast.error('Please select or enter a unit')
      return
    }

    setSaving(true)
    try {
      if (editingMaterial) {
        // Update
        const { error } = await supabase
          .from('master_materials')
          .update({
            category: category,
            name: formData.name.trim(),
            unit: formData.unit.trim(),
            description: formData.description.trim() || null,
          })
          .eq('id', editingMaterial.id)

        if (error) throw error
        toast.success('Material updated successfully')
      } else {
        // Create
        const { error } = await supabase
          .from('master_materials')
          .insert({
            category: category,
            name: formData.name.trim(),
            unit: formData.unit.trim(),
            description: formData.description.trim() || null,
          })

        if (error) throw error
        toast.success('Material created successfully')
      }

      setDialogOpen(false)
      fetchMaterials()
    } catch (error: any) {
      console.error('Error saving material:', error)
      toast.error(error?.message || 'Failed to save material')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(material: MasterMaterial) {
    if (!confirm(`Delete "${material.name}"? This action cannot be undone.`)) return

    try {
      // Soft delete by setting is_active to false
      const { error } = await supabase
        .from('master_materials')
        .update({ is_active: false })
        .eq('id', material.id)

      if (error) throw error
      toast.success('Material deleted')
      fetchMaterials()
    } catch (error) {
      console.error('Error deleting material:', error)
      toast.error('Failed to delete material')
    }
  }

  // Group materials by category for display
  const materialsByCategory = filteredMaterials.reduce((acc, material) => {
    if (!acc[material.category]) {
      acc[material.category] = []
    }
    acc[material.category].push(material)
    return acc
  }, {} as Record<string, MasterMaterial[]>)

  if (loading) {
    return (
      <div className="flex flex-col min-h-screen">
        <Header title="Material Master List" />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <Loader2 className="h-8 w-8 animate-spin text-blue-600 mx-auto mb-4" />
            <p className="text-slate-500">Loading materials...</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col min-h-screen">
      <Header title="Material Master List" />

      <div className="flex-1 p-4 md:p-6 space-y-6">
        {/* Header Card */}
        <Card>
          <CardHeader>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Package className="h-5 w-5" />
                  Material Master List
                </CardTitle>
                <CardDescription>
                  Manage the master list of materials used across projects
                </CardDescription>
              </div>
              <Button onClick={openCreateDialog}>
                <Plus className="h-4 w-4 mr-2" />
                Add Material
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {/* Filters */}
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <Input
                    placeholder="Search materials..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
              <div className="w-full sm:w-64">
                <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                  <SelectTrigger>
                    <Filter className="h-4 w-4 mr-2" />
                    <SelectValue placeholder="Filter by category" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Categories</SelectItem>
                    {categories.map((cat) => (
                      <SelectItem key={cat} value={cat}>
                        {cat}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Stats */}
            <div className="flex gap-4 mt-4 text-sm text-slate-600">
              <span>{filteredMaterials.length} materials</span>
              <span>|</span>
              <span>{Object.keys(materialsByCategory).length} categories</span>
            </div>
          </CardContent>
        </Card>

        {/* Materials Table */}
        {filteredMaterials.length === 0 ? (
          <Card>
            <CardContent className="py-12">
              <div className="text-center">
                <Package className="h-12 w-12 mx-auto text-slate-300 mb-4" />
                <h3 className="text-lg font-medium text-slate-900 mb-2">No Materials Found</h3>
                <p className="text-slate-500 mb-4">
                  {searchTerm || selectedCategory !== 'all'
                    ? 'Try adjusting your search or filter'
                    : 'Add your first material to get started'}
                </p>
                {!searchTerm && selectedCategory === 'all' && (
                  <Button onClick={openCreateDialog}>
                    <Plus className="h-4 w-4 mr-2" />
                    Add Material
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[200px]">Category</TableHead>
                    <TableHead>Material Name</TableHead>
                    <TableHead className="w-[100px]">Unit</TableHead>
                    <TableHead className="w-[100px] text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {Object.entries(materialsByCategory).map(([category, categoryMaterials]) => (
                    categoryMaterials.map((material, index) => (
                      <TableRow key={material.id}>
                        <TableCell>
                          {index === 0 ? (
                            <Badge variant="outline" className="font-medium">
                              {category}
                            </Badge>
                          ) : null}
                        </TableCell>
                        <TableCell>
                          <div>
                            <p className="font-medium">{material.name}</p>
                            {material.description && (
                              <p className="text-xs text-slate-500">{material.description}</p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary">{material.unit}</Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => openEditDialog(material)}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDelete(material)}
                              className="text-red-600"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingMaterial ? 'Edit Material' : 'Add New Material'}
            </DialogTitle>
            <DialogDescription>
              {editingMaterial
                ? 'Update the material details'
                : 'Add a new material to the master list'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Category */}
            <div className="space-y-2">
              <Label>Category *</Label>
              {showNewCategory ? (
                <div className="flex gap-2">
                  <Input
                    placeholder="Enter new category name"
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value)}
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setShowNewCategory(false)
                      setNewCategory('')
                    }}
                  >
                    Cancel
                  </Button>
                </div>
              ) : (
                <div className="flex gap-2">
                  <Select
                    value={formData.category}
                    onValueChange={(value) => setFormData({ ...formData, category: value })}
                  >
                    <SelectTrigger className="flex-1">
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map((cat) => (
                        <SelectItem key={cat} value={cat}>
                          {cat}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowNewCategory(true)}
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </div>

            {/* Material Name */}
            <div className="space-y-2">
              <Label htmlFor="name">Material Name *</Label>
              <Input
                id="name"
                placeholder="e.g., Ultra Tech PPC"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>

            {/* Unit */}
            <div className="space-y-2">
              <Label>Unit *</Label>
              <div className="flex gap-2">
                <Select
                  value={COMMON_UNITS.includes(formData.unit) ? formData.unit : ''}
                  onValueChange={(value) => setFormData({ ...formData, unit: value })}
                >
                  <SelectTrigger className="flex-1">
                    <SelectValue placeholder="Select unit" />
                  </SelectTrigger>
                  <SelectContent>
                    {COMMON_UNITS.map((unit) => (
                      <SelectItem key={unit} value={unit}>
                        {unit}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  placeholder="Or type custom"
                  value={!COMMON_UNITS.includes(formData.unit) ? formData.unit : ''}
                  onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                  className="w-32"
                />
              </div>
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label htmlFor="description">Description (Optional)</Label>
              <Input
                id="description"
                placeholder="Additional details..."
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? 'Saving...' : editingMaterial ? 'Update' : 'Add Material'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
