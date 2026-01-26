'use client'

import { useState, useEffect } from 'react'
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
  Users,
  Plus,
  Pencil,
  Trash2,
  Search,
  Loader2,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'

interface ManpowerCategory {
  id: string
  name: string
  description: string | null
  is_active: boolean
  created_at: string
}

export default function ManpowerCategoriesPage() {
  const [categories, setCategories] = useState<ManpowerCategory[]>([])
  const [filteredCategories, setFilteredCategories] = useState<ManpowerCategory[]>([])
  const [loading, setLoading] = useState(true)

  // Filter
  const [searchTerm, setSearchTerm] = useState('')

  // Dialog states
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingCategory, setEditingCategory] = useState<ManpowerCategory | null>(null)
  const [saving, setSaving] = useState(false)

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    description: '',
  })

  useEffect(() => {
    fetchCategories()
  }, [])

  useEffect(() => {
    filterCategories()
  }, [categories, searchTerm])

  async function fetchCategories() {
    try {
      const { data, error } = await supabase
        .from('master_manpower_categories')
        .select('*')
        .eq('is_active', true)
        .order('name')

      if (error) throw error
      setCategories(data || [])
    } catch (error) {
      console.error('Error fetching categories:', error)
      toast.error('Failed to load manpower categories')
    } finally {
      setLoading(false)
    }
  }

  function filterCategories() {
    let filtered = [...categories]

    if (searchTerm) {
      const term = searchTerm.toLowerCase()
      filtered = filtered.filter(c =>
        c.name.toLowerCase().includes(term) ||
        c.description?.toLowerCase().includes(term)
      )
    }

    setFilteredCategories(filtered)
  }

  function openCreateDialog() {
    setEditingCategory(null)
    setFormData({
      name: '',
      description: '',
    })
    setDialogOpen(true)
  }

  function openEditDialog(category: ManpowerCategory) {
    setEditingCategory(category)
    setFormData({
      name: category.name,
      description: category.description || '',
    })
    setDialogOpen(true)
  }

  async function handleSave() {
    if (!formData.name.trim()) {
      toast.error('Please enter category name')
      return
    }

    setSaving(true)
    try {
      const saveData = {
        name: formData.name.trim(),
        description: formData.description.trim() || null,
      }

      if (editingCategory) {
        const { error } = await supabase
          .from('master_manpower_categories')
          .update(saveData)
          .eq('id', editingCategory.id)

        if (error) throw error
        toast.success('Manpower category updated successfully')
      } else {
        const { error } = await supabase
          .from('master_manpower_categories')
          .insert(saveData)

        if (error) throw error
        toast.success('Manpower category created successfully')
      }

      setDialogOpen(false)
      fetchCategories()
    } catch (error: any) {
      console.error('Error saving category:', error)
      if (error?.code === '23505') {
        toast.error('A category with this name already exists')
      } else {
        toast.error(error?.message || 'Failed to save manpower category')
      }
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(category: ManpowerCategory) {
    if (!confirm(`Delete "${category.name}"? This action cannot be undone.`)) return

    try {
      const { error } = await supabase
        .from('master_manpower_categories')
        .update({ is_active: false })
        .eq('id', category.id)

      if (error) throw error
      toast.success('Manpower category deleted')
      fetchCategories()
    } catch (error) {
      console.error('Error deleting category:', error)
      toast.error('Failed to delete manpower category')
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col min-h-screen">
        <Header title="Manpower Categories" />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <Loader2 className="h-8 w-8 animate-spin text-blue-600 mx-auto mb-4" />
            <p className="text-slate-500">Loading manpower categories...</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col min-h-screen">
      <Header title="Manpower Categories" />

      <div className="flex-1 p-4 md:p-6 space-y-6">
        {/* Header Card */}
        <Card>
          <CardHeader>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  Manpower Categories
                </CardTitle>
                <CardDescription>
                  Define categories of manpower (Mason, Helper, Carpenter, etc.)
                </CardDescription>
              </div>
              <Button onClick={openCreateDialog}>
                <Plus className="h-4 w-4 mr-2" />
                Add Category
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {/* Search */}
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                  placeholder="Search by name or description..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            {/* Stats */}
            <div className="flex gap-4 mt-4 text-sm text-slate-600">
              <span>{filteredCategories.length} manpower categories</span>
            </div>
          </CardContent>
        </Card>

        {/* Categories Table */}
        {filteredCategories.length === 0 ? (
          <Card>
            <CardContent className="py-12">
              <div className="text-center">
                <Users className="h-12 w-12 mx-auto text-slate-300 mb-4" />
                <h3 className="text-lg font-medium text-slate-900 mb-2">No Manpower Categories Found</h3>
                <p className="text-slate-500 mb-4">
                  {searchTerm
                    ? 'Try adjusting your search'
                    : 'Add your first manpower category to get started'}
                </p>
                {!searchTerm && (
                  <Button onClick={openCreateDialog}>
                    <Plus className="h-4 w-4 mr-2" />
                    Add Category
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Category Name</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead className="w-[100px] text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredCategories.map((category) => (
                      <TableRow key={category.id}>
                        <TableCell>
                          <span className="font-medium">{category.name}</span>
                        </TableCell>
                        <TableCell>
                          <span className="text-sm text-slate-500">
                            {category.description || '-'}
                          </span>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => openEditDialog(category)}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDelete(category)}
                              className="text-red-600"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingCategory ? 'Edit Manpower Category' : 'Add New Manpower Category'}
            </DialogTitle>
            <DialogDescription>
              {editingCategory
                ? 'Update the manpower category details'
                : 'Add a new manpower category to the master list'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Category Name */}
            <div className="space-y-2">
              <Label htmlFor="name">Category Name *</Label>
              <Input
                id="name"
                placeholder="e.g., Mason, Helper, Carpenter, Welder"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                placeholder="Brief description of this category..."
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={2}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? 'Saving...' : editingCategory ? 'Update' : 'Add Category'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
