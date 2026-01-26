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
  HardHat,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'

interface LabourContractor {
  id: string
  name: string
}

interface ManpowerCategory {
  id: string
  name: string
}

interface Manpower {
  id: string
  contractor_id: string | null
  category_id: string | null
  // Denormalized for display
  contractor_name: string | null
  category: string
  description: string | null
  gender: 'male' | 'female' | 'any'
  rate: number
  daily_hours: number
  is_active: boolean
  created_at: string
  // Joined data
  labour_contractor?: { id: string; name: string } | null
  manpower_category?: { id: string; name: string } | null
}

export default function ManpowerMasterPage() {
  const [manpower, setManpower] = useState<Manpower[]>([])
  const [filteredManpower, setFilteredManpower] = useState<Manpower[]>([])
  const [loading, setLoading] = useState(true)

  // Lookup data
  const [contractors, setContractors] = useState<LabourContractor[]>([])
  const [categories, setCategories] = useState<ManpowerCategory[]>([])

  // Filters
  const [searchTerm, setSearchTerm] = useState('')
  const [filterContractor, setFilterContractor] = useState<string>('all')

  // Dialog states
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingManpower, setEditingManpower] = useState<Manpower | null>(null)
  const [saving, setSaving] = useState(false)

  // Form state
  const [formData, setFormData] = useState({
    contractor_id: '',
    category_id: '',
    gender: 'any' as 'male' | 'female' | 'any',
    rate: 0,
    daily_hours: 8,
  })

  useEffect(() => {
    fetchInitialData()
  }, [])

  useEffect(() => {
    filterManpower()
  }, [manpower, searchTerm, filterContractor])

  async function fetchInitialData() {
    try {
      // Fetch contractors
      const { data: contractorsData, error: contractorsError } = await supabase
        .from('master_labour_contractors')
        .select('id, name')
        .eq('is_active', true)
        .order('name')

      if (contractorsError) throw contractorsError
      setContractors(contractorsData || [])

      // Fetch categories
      const { data: categoriesData, error: categoriesError } = await supabase
        .from('master_manpower_categories')
        .select('id, name')
        .eq('is_active', true)
        .order('name')

      if (categoriesError) throw categoriesError
      setCategories(categoriesData || [])

      // Fetch manpower with joins
      await fetchManpower()
    } catch (error) {
      console.error('Error fetching initial data:', error)
      toast.error('Failed to load data')
    } finally {
      setLoading(false)
    }
  }

  async function fetchManpower() {
    try {
      const { data, error } = await supabase
        .from('master_manpower')
        .select(`
          *,
          labour_contractor:master_labour_contractors(id, name),
          manpower_category:master_manpower_categories(id, name)
        `)
        .eq('is_active', true)
        .order('created_at', { ascending: false })

      if (error) throw error
      setManpower(data || [])
    } catch (error) {
      console.error('Error fetching manpower:', error)
      toast.error('Failed to load manpower data')
    }
  }

  function filterManpower() {
    let filtered = [...manpower]

    if (searchTerm) {
      const term = searchTerm.toLowerCase()
      filtered = filtered.filter(m =>
        m.category?.toLowerCase().includes(term) ||
        m.manpower_category?.name?.toLowerCase().includes(term) ||
        m.labour_contractor?.name?.toLowerCase().includes(term) ||
        m.contractor_name?.toLowerCase().includes(term)
      )
    }

    if (filterContractor && filterContractor !== 'all') {
      filtered = filtered.filter(m => m.contractor_id === filterContractor)
    }

    setFilteredManpower(filtered)
  }

  function openCreateDialog() {
    setEditingManpower(null)
    setFormData({
      contractor_id: '',
      category_id: '',
      gender: 'any',
      rate: 0,
      daily_hours: 8,
    })
    setDialogOpen(true)
  }

  function openEditDialog(item: Manpower) {
    setEditingManpower(item)
    setFormData({
      contractor_id: item.contractor_id || '',
      category_id: item.category_id || '',
      gender: item.gender || 'any',
      rate: item.rate,
      daily_hours: item.daily_hours || 8,
    })
    setDialogOpen(true)
  }

  async function handleSave() {
    if (!formData.contractor_id) {
      toast.error('Please select a contractor')
      return
    }
    if (!formData.category_id) {
      toast.error('Please select a category')
      return
    }
    if (formData.rate < 0) {
      toast.error('Rate cannot be negative')
      return
    }

    // Get names for denormalized storage
    const contractor = contractors.find(c => c.id === formData.contractor_id)
    const category = categories.find(c => c.id === formData.category_id)

    setSaving(true)
    try {
      const saveData = {
        contractor_id: formData.contractor_id,
        category_id: formData.category_id,
        contractor_name: contractor?.name || null,
        category: category?.name || '',
        gender: formData.gender,
        rate: formData.rate,
        daily_hours: formData.daily_hours,
      }

      if (editingManpower) {
        const { error } = await supabase
          .from('master_manpower')
          .update(saveData)
          .eq('id', editingManpower.id)

        if (error) throw error
        toast.success('Manpower rate updated successfully')
      } else {
        const { error } = await supabase
          .from('master_manpower')
          .insert(saveData)

        if (error) throw error
        toast.success('Manpower rate created successfully')
      }

      setDialogOpen(false)
      fetchManpower()
    } catch (error: any) {
      console.error('Error saving manpower:', error)
      toast.error(error?.message || 'Failed to save manpower rate')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(item: Manpower) {
    const categoryName = item.manpower_category?.name || item.category
    if (!confirm(`Delete this manpower rate entry? This action cannot be undone.`)) return

    try {
      const { error } = await supabase
        .from('master_manpower')
        .update({ is_active: false })
        .eq('id', item.id)

      if (error) throw error
      toast.success('Manpower rate deleted')
      fetchManpower()
    } catch (error) {
      console.error('Error deleting manpower:', error)
      toast.error('Failed to delete manpower rate')
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
        <Header title="Manpower Rates" />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <Loader2 className="h-8 w-8 animate-spin text-blue-600 mx-auto mb-4" />
            <p className="text-slate-500">Loading manpower rates...</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col min-h-screen">
      <Header title="Manpower Rates" />

      <div className="flex-1 p-4 md:p-6 space-y-6">
        {/* Header Card */}
        <Card>
          <CardHeader>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  Manpower Rates
                </CardTitle>
                <CardDescription>
                  Define rates for contractor + category + gender combinations
                </CardDescription>
              </div>
              <Button onClick={openCreateDialog}>
                <Plus className="h-4 w-4 mr-2" />
                Add Rate
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
                    placeholder="Search by category or contractor..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
              {contractors.length > 0 && (
                <Select value={filterContractor} onValueChange={setFilterContractor}>
                  <SelectTrigger className="w-full sm:w-[200px]">
                    <HardHat className="h-4 w-4 mr-2" />
                    <SelectValue placeholder="All Contractors" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Contractors</SelectItem>
                    {contractors.map((contractor) => (
                      <SelectItem key={contractor.id} value={contractor.id}>
                        {contractor.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            {/* Stats */}
            <div className="flex gap-4 mt-4 text-sm text-slate-600">
              <span>{filteredManpower.length} manpower rates</span>
              {contractors.length > 0 && (
                <span>| {contractors.length} contractors</span>
              )}
              {categories.length > 0 && (
                <span>| {categories.length} categories</span>
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
                <h3 className="text-lg font-medium text-slate-900 mb-2">No Manpower Rates Found</h3>
                <p className="text-slate-500 mb-4">
                  {searchTerm || filterContractor !== 'all'
                    ? 'Try adjusting your search or filter'
                    : 'Add your first manpower rate to get started'}
                </p>
                {!searchTerm && filterContractor === 'all' && (
                  <Button onClick={openCreateDialog}>
                    <Plus className="h-4 w-4 mr-2" />
                    Add Rate
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
                      <TableHead className="text-center">Gender</TableHead>
                      <TableHead className="text-right">Daily Rate</TableHead>
                      <TableHead className="text-center">Daily Hours</TableHead>
                      <TableHead className="text-right">Hourly Rate</TableHead>
                      <TableHead className="w-[100px] text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredManpower.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <HardHat className="h-4 w-4 text-orange-500" />
                            <span className="font-medium">
                              {item.labour_contractor?.name || item.contractor_name || '-'}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <p className="font-medium">
                            {item.manpower_category?.name || item.category}
                          </p>
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
                        <TableCell className="text-center">
                          <span className="text-sm text-slate-600">{item.daily_hours || 8} hrs</span>
                        </TableCell>
                        <TableCell className="text-right">
                          <span className="text-sm font-mono text-slate-600">
                            ₹{(item.rate / (item.daily_hours || 8)).toFixed(2)}/hr
                          </span>
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
              {editingManpower ? 'Edit Manpower Rate' : 'Add New Manpower Rate'}
            </DialogTitle>
            <DialogDescription>
              {editingManpower
                ? 'Update the manpower rate details'
                : 'Define a rate for a contractor + category + gender combination'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Contractor */}
            <div className="space-y-2">
              <Label>Labour Contractor *</Label>
              <Select
                value={formData.contractor_id}
                onValueChange={(value) => setFormData({ ...formData, contractor_id: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select contractor" />
                </SelectTrigger>
                <SelectContent>
                  {contractors.map((contractor) => (
                    <SelectItem key={contractor.id} value={contractor.id}>
                      {contractor.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {contractors.length === 0 && (
                <p className="text-xs text-amber-600">No contractors found. Add contractors first.</p>
              )}
            </div>

            {/* Category */}
            <div className="space-y-2">
              <Label>Manpower Category *</Label>
              <Select
                value={formData.category_id}
                onValueChange={(value) => setFormData({ ...formData, category_id: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((category) => (
                    <SelectItem key={category.id} value={category.id}>
                      {category.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {categories.length === 0 && (
                <p className="text-xs text-amber-600">No categories found. Add categories first.</p>
              )}
            </div>

            {/* Gender */}
            <div className="space-y-2">
              <Label htmlFor="gender">Gender</Label>
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
              <p className="text-xs text-slate-500">Specify if rate differs by gender</p>
            </div>

            {/* Daily Rate and Hours */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="rate">Daily Rate (INR) *</Label>
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
              </div>
              <div className="space-y-2">
                <Label htmlFor="daily_hours">Daily Hours *</Label>
                <Input
                  id="daily_hours"
                  type="number"
                  step="0.5"
                  min="1"
                  max="24"
                  placeholder="8"
                  value={formData.daily_hours || ''}
                  onChange={(e) => setFormData({ ...formData, daily_hours: parseFloat(e.target.value) || 8 })}
                />
              </div>
            </div>
            <p className="text-xs text-slate-500">
              Daily rate of ₹{formData.rate.toLocaleString('en-IN')} for {formData.daily_hours} hours
              {formData.rate > 0 && formData.daily_hours > 0 && (
                <> (₹{(formData.rate / formData.daily_hours).toFixed(2)}/hr)</>
              )}
            </p>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? 'Saving...' : editingManpower ? 'Update' : 'Add Rate'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
