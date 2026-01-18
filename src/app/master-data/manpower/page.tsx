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
  IndianRupee,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'

interface Manpower {
  id: string
  category: string
  description: string | null
  hourly_rate: number
  is_active: boolean
  created_at: string
}

export default function ManpowerMasterPage() {
  const [manpower, setManpower] = useState<Manpower[]>([])
  const [filteredManpower, setFilteredManpower] = useState<Manpower[]>([])
  const [loading, setLoading] = useState(true)

  // Filters
  const [searchTerm, setSearchTerm] = useState('')

  // Dialog states
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingManpower, setEditingManpower] = useState<Manpower | null>(null)
  const [saving, setSaving] = useState(false)

  // Form state
  const [formData, setFormData] = useState({
    category: '',
    description: '',
    hourly_rate: 0,
  })

  useEffect(() => {
    fetchManpower()
  }, [])

  useEffect(() => {
    filterManpower()
  }, [manpower, searchTerm])

  async function fetchManpower() {
    try {
      const { data, error } = await supabase
        .from('master_manpower')
        .select('*')
        .eq('is_active', true)
        .order('category')

      if (error) throw error
      setManpower(data || [])
    } catch (error) {
      console.error('Error fetching manpower:', error)
      toast.error('Failed to load manpower categories')
    } finally {
      setLoading(false)
    }
  }

  function filterManpower() {
    let filtered = [...manpower]

    if (searchTerm) {
      const term = searchTerm.toLowerCase()
      filtered = filtered.filter(m =>
        m.category.toLowerCase().includes(term) ||
        m.description?.toLowerCase().includes(term)
      )
    }

    setFilteredManpower(filtered)
  }

  function openCreateDialog() {
    setEditingManpower(null)
    setFormData({
      category: '',
      description: '',
      hourly_rate: 0,
    })
    setDialogOpen(true)
  }

  function openEditDialog(item: Manpower) {
    setEditingManpower(item)
    setFormData({
      category: item.category,
      description: item.description || '',
      hourly_rate: item.hourly_rate,
    })
    setDialogOpen(true)
  }

  async function handleSave() {
    if (!formData.category.trim()) {
      toast.error('Please enter manpower category')
      return
    }
    if (formData.hourly_rate < 0) {
      toast.error('Hourly rate cannot be negative')
      return
    }

    setSaving(true)
    try {
      if (editingManpower) {
        const { error } = await supabase
          .from('master_manpower')
          .update({
            category: formData.category.trim(),
            description: formData.description.trim() || null,
            hourly_rate: formData.hourly_rate,
          })
          .eq('id', editingManpower.id)

        if (error) throw error
        toast.success('Manpower category updated successfully')
      } else {
        const { error } = await supabase
          .from('master_manpower')
          .insert({
            category: formData.category.trim(),
            description: formData.description.trim() || null,
            hourly_rate: formData.hourly_rate,
          })

        if (error) throw error
        toast.success('Manpower category created successfully')
      }

      setDialogOpen(false)
      fetchManpower()
    } catch (error: any) {
      console.error('Error saving manpower:', error)
      toast.error(error?.message || 'Failed to save manpower category')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(item: Manpower) {
    if (!confirm(`Delete "${item.category}"? This action cannot be undone.`)) return

    try {
      const { error } = await supabase
        .from('master_manpower')
        .update({ is_active: false })
        .eq('id', item.id)

      if (error) throw error
      toast.success('Manpower category deleted')
      fetchManpower()
    } catch (error) {
      console.error('Error deleting manpower:', error)
      toast.error('Failed to delete manpower category')
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col min-h-screen">
        <Header title="Manpower Master" />
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
      <Header title="Manpower Master" />

      <div className="flex-1 p-4 md:p-6 space-y-6">
        {/* Header Card */}
        <Card>
          <CardHeader>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  Manpower Master
                </CardTitle>
                <CardDescription>
                  Manage manpower categories and their hourly rates
                </CardDescription>
              </div>
              <Button onClick={openCreateDialog}>
                <Plus className="h-4 w-4 mr-2" />
                Add Manpower
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {/* Search */}
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <Input
                    placeholder="Search manpower categories..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
            </div>

            {/* Stats */}
            <div className="flex gap-4 mt-4 text-sm text-slate-600">
              <span>{filteredManpower.length} manpower categories</span>
            </div>
          </CardContent>
        </Card>

        {/* Manpower Table */}
        {filteredManpower.length === 0 ? (
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
                    Add Manpower
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
                    <TableHead>Category</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead className="w-[150px] text-right">Hourly Rate</TableHead>
                    <TableHead className="w-[100px] text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredManpower.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell>
                        <p className="font-medium">{item.category}</p>
                      </TableCell>
                      <TableCell>
                        <p className="text-sm text-slate-500">{item.description || '-'}</p>
                      </TableCell>
                      <TableCell className="text-right">
                        <Badge variant="secondary" className="font-mono">
                          <IndianRupee className="h-3 w-3 mr-1" />
                          {item.hourly_rate.toLocaleString('en-IN', { minimumFractionDigits: 2 })}/hr
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openEditDialog(item)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDelete(item)}
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
            </CardContent>
          </Card>
        )}
      </div>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingManpower ? 'Edit Manpower' : 'Add New Manpower'}
            </DialogTitle>
            <DialogDescription>
              {editingManpower
                ? 'Update the manpower category details'
                : 'Add a new manpower category to the master list'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Category Name */}
            <div className="space-y-2">
              <Label htmlFor="category">Category *</Label>
              <Input
                id="category"
                placeholder="e.g., Worker, Supervisor, Mason"
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
              />
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Input
                id="description"
                placeholder="e.g., General Construction Worker, Site Supervisor"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              />
            </div>

            {/* Hourly Rate */}
            <div className="space-y-2">
              <Label htmlFor="hourly_rate">Hourly Rate (INR) *</Label>
              <div className="relative">
                <IndianRupee className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                  id="hourly_rate"
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                  value={formData.hourly_rate || ''}
                  onChange={(e) => setFormData({ ...formData, hourly_rate: parseFloat(e.target.value) || 0 })}
                  className="pl-10"
                />
              </div>
              <p className="text-xs text-slate-500">Rate per hour for this manpower category</p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? 'Saving...' : editingManpower ? 'Update' : 'Add Manpower'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
