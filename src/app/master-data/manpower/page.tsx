'use client'

import { useState, useEffect } from 'react'
import { Header } from '@/components/layout/header'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
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
  Building2,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'

interface Manpower {
  id: string
  contractor_name: string | null
  category: string
  description: string | null
  gender: 'male' | 'female' | 'any'
  rate: number
  is_active: boolean
  created_at: string
}

export default function ManpowerMasterPage() {
  const [manpower, setManpower] = useState<Manpower[]>([])
  const [filteredManpower, setFilteredManpower] = useState<Manpower[]>([])
  const [loading, setLoading] = useState(true)

  // Filters
  const [searchTerm, setSearchTerm] = useState('')
  const [filterContractor, setFilterContractor] = useState<string>('all')

  // Dialog states
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingManpower, setEditingManpower] = useState<Manpower | null>(null)
  const [saving, setSaving] = useState(false)

  // Form state
  const [formData, setFormData] = useState({
    contractor_name: '',
    category: '',
    description: '',
    gender: 'any' as 'male' | 'female' | 'any',
    rate: 0,
  })

  // Get unique contractors for filter
  const contractors = [...new Set(manpower.map(m => m.contractor_name).filter(Boolean))] as string[]

  useEffect(() => {
    fetchManpower()
  }, [])

  useEffect(() => {
    filterManpower()
  }, [manpower, searchTerm, filterContractor])

  async function fetchManpower() {
    try {
      const { data, error } = await supabase
        .from('master_manpower')
        .select('*')
        .eq('is_active', true)
        .order('contractor_name', { nullsFirst: false })
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
        m.description?.toLowerCase().includes(term) ||
        m.contractor_name?.toLowerCase().includes(term)
      )
    }

    if (filterContractor && filterContractor !== 'all') {
      filtered = filtered.filter(m => m.contractor_name === filterContractor)
    }

    setFilteredManpower(filtered)
  }

  function openCreateDialog() {
    setEditingManpower(null)
    setFormData({
      contractor_name: '',
      category: '',
      description: '',
      gender: 'any',
      rate: 0,
    })
    setDialogOpen(true)
  }

  function openEditDialog(item: Manpower) {
    setEditingManpower(item)
    setFormData({
      contractor_name: item.contractor_name || '',
      category: item.category,
      description: item.description || '',
      gender: item.gender || 'any',
      rate: item.rate,
    })
    setDialogOpen(true)
  }

  async function handleSave() {
    if (!formData.category.trim()) {
      toast.error('Please enter manpower category')
      return
    }
    if (formData.rate < 0) {
      toast.error('Rate cannot be negative')
      return
    }

    setSaving(true)
    try {
      const saveData = {
        contractor_name: formData.contractor_name.trim() || null,
        category: formData.category.trim(),
        description: formData.description.trim() || null,
        gender: formData.gender,
        rate: formData.rate,
      }

      if (editingManpower) {
        const { error } = await supabase
          .from('master_manpower')
          .update(saveData)
          .eq('id', editingManpower.id)

        if (error) throw error
        toast.success('Manpower category updated successfully')
      } else {
        const { error } = await supabase
          .from('master_manpower')
          .insert(saveData)

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

  function getGenderLabel(gender: string) {
    switch (gender) {
      case 'male': return 'Male'
      case 'female': return 'Female'
      default: return 'Any'
    }
  }

  function getGenderBadgeColor(gender: string) {
    switch (gender) {
      case 'male': return 'bg-blue-100 text-blue-700'
      case 'female': return 'bg-pink-100 text-pink-700'
      default: return 'bg-slate-100 text-slate-700'
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
                  Manage manpower categories, contractors, and rates
                </CardDescription>
              </div>
              <Button onClick={openCreateDialog}>
                <Plus className="h-4 w-4 mr-2" />
                Add Manpower
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
                    placeholder="Search by category, description, or contractor..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
              {contractors.length > 0 && (
                <Select value={filterContractor} onValueChange={setFilterContractor}>
                  <SelectTrigger className="w-full sm:w-[200px]">
                    <Building2 className="h-4 w-4 mr-2" />
                    <SelectValue placeholder="All Contractors" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Contractors</SelectItem>
                    {contractors.map((contractor) => (
                      <SelectItem key={contractor} value={contractor}>
                        {contractor}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            {/* Stats */}
            <div className="flex gap-4 mt-4 text-sm text-slate-600">
              <span>{filteredManpower.length} manpower categories</span>
              {contractors.length > 0 && (
                <span>• {contractors.length} contractors</span>
              )}
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
                  {searchTerm || filterContractor !== 'all'
                    ? 'Try adjusting your search or filter'
                    : 'Add your first manpower category to get started'}
                </p>
                {!searchTerm && filterContractor === 'all' && (
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
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Contractor</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead className="text-center">Gender</TableHead>
                      <TableHead className="text-right">Rate</TableHead>
                      <TableHead className="w-[100px] text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredManpower.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell>
                          {item.contractor_name ? (
                            <div className="flex items-center gap-2">
                              <Building2 className="h-4 w-4 text-slate-400" />
                              <span className="font-medium">{item.contractor_name}</span>
                            </div>
                          ) : (
                            <span className="text-slate-400">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <p className="font-medium">{item.category}</p>
                        </TableCell>
                        <TableCell>
                          <p className="text-sm text-slate-500">{item.description || '-'}</p>
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge className={getGenderBadgeColor(item.gender)}>
                            {getGenderLabel(item.gender)}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <Badge variant="secondary" className="font-mono">
                            <IndianRupee className="h-3 w-3 mr-1" />
                            {item.rate.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
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
              {editingManpower ? 'Edit Manpower' : 'Add New Manpower'}
            </DialogTitle>
            <DialogDescription>
              {editingManpower
                ? 'Update the manpower category details'
                : 'Add a new manpower category to the master list'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Contractor Name */}
            <div className="space-y-2">
              <Label htmlFor="contractor_name">Contractor Name</Label>
              <Input
                id="contractor_name"
                placeholder="e.g., ABC Contractors, XYZ Labor Supply"
                value={formData.contractor_name}
                onChange={(e) => setFormData({ ...formData, contractor_name: e.target.value })}
              />
              <p className="text-xs text-slate-500">Leave empty if not specific to a contractor</p>
            </div>

            {/* Category Name */}
            <div className="space-y-2">
              <Label htmlFor="category">Category *</Label>
              <Input
                id="category"
                placeholder="e.g., Mason, Helper, Carpenter, Welder"
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
              />
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Input
                id="description"
                placeholder="e.g., Skilled brick mason, General helper"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              />
            </div>

            {/* Gender */}
            <div className="space-y-2">
              <Label htmlFor="gender">Category Gender</Label>
              <Select
                value={formData.gender}
                onValueChange={(value: 'male' | 'female' | 'any') => setFormData({ ...formData, gender: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select gender" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="any">Any</SelectItem>
                  <SelectItem value="male">Male</SelectItem>
                  <SelectItem value="female">Female</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-slate-500">Specify if this category is gender-specific</p>
            </div>

            {/* Rate */}
            <div className="space-y-2">
              <Label htmlFor="rate">Rate (INR) *</Label>
              <div className="relative">
                <IndianRupee className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                  id="rate"
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                  value={formData.rate || ''}
                  onChange={(e) => setFormData({ ...formData, rate: parseFloat(e.target.value) || 0 })}
                  className="pl-10"
                />
              </div>
              <p className="text-xs text-slate-500">Daily or per-unit rate for this manpower category</p>
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
