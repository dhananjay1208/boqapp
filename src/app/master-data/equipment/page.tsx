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
  Truck,
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

interface Supplier {
  id: string
  supplier_name: string
}

interface Equipment {
  id: string
  name: string
  description: string | null
}

interface EquipmentRate {
  id: string
  supplier_id: string
  equipment_id: string
  rate: number           // Daily rate in INR
  daily_hours: number    // Hours per day (default 8)
  is_active: boolean
  created_at: string
  updated_at: string
  // Joined relations
  supplier?: { id: string; supplier_name: string } | null
  equipment?: { id: string; name: string; description: string | null } | null
}

export default function EquipmentRatesPage() {
  const [equipmentRates, setEquipmentRates] = useState<EquipmentRate[]>([])
  const [filteredRates, setFilteredRates] = useState<EquipmentRate[]>([])
  const [loading, setLoading] = useState(true)

  // Lookup data
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [equipmentList, setEquipmentList] = useState<Equipment[]>([])

  // Filters
  const [searchTerm, setSearchTerm] = useState('')
  const [filterSupplier, setFilterSupplier] = useState<string>('all')

  // Dialog states
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingRate, setEditingRate] = useState<EquipmentRate | null>(null)
  const [saving, setSaving] = useState(false)

  // Form state
  const [formData, setFormData] = useState({
    supplier_id: '',
    equipment_id: '',
    rate: 0,
    daily_hours: 8,
  })

  useEffect(() => {
    fetchInitialData()
  }, [])

  useEffect(() => {
    filterRates()
  }, [equipmentRates, searchTerm, filterSupplier])

  async function fetchInitialData() {
    try {
      // Fetch suppliers
      const { data: suppliersData, error: suppliersError } = await supabase
        .from('suppliers')
        .select('id, supplier_name')
        .order('supplier_name')

      if (suppliersError) throw suppliersError
      setSuppliers(suppliersData || [])

      // Fetch equipment types
      const { data: equipmentData, error: equipmentError } = await supabase
        .from('master_equipment')
        .select('id, name, description')
        .eq('is_active', true)
        .order('name')

      if (equipmentError) throw equipmentError
      setEquipmentList(equipmentData || [])

      // Fetch equipment rates with joins
      await fetchEquipmentRates()
    } catch (error) {
      console.error('Error fetching initial data:', error)
      toast.error('Failed to load data')
    } finally {
      setLoading(false)
    }
  }

  async function fetchEquipmentRates() {
    try {
      const { data, error } = await supabase
        .from('master_equipment_rates')
        .select(`
          *,
          supplier:suppliers(id, supplier_name),
          equipment:master_equipment(id, name, description)
        `)
        .eq('is_active', true)
        .order('created_at', { ascending: false })

      if (error) throw error
      setEquipmentRates(data || [])
    } catch (error) {
      console.error('Error fetching equipment rates:', error)
      toast.error('Failed to load equipment rates')
    }
  }

  function filterRates() {
    let filtered = [...equipmentRates]

    if (searchTerm) {
      const term = searchTerm.toLowerCase()
      filtered = filtered.filter(r =>
        r.supplier?.supplier_name?.toLowerCase().includes(term) ||
        r.equipment?.name?.toLowerCase().includes(term) ||
        r.equipment?.description?.toLowerCase().includes(term)
      )
    }

    if (filterSupplier && filterSupplier !== 'all') {
      filtered = filtered.filter(r => r.supplier_id === filterSupplier)
    }

    setFilteredRates(filtered)
  }

  function openCreateDialog() {
    setEditingRate(null)
    setFormData({
      supplier_id: '',
      equipment_id: '',
      rate: 0,
      daily_hours: 8,
    })
    setDialogOpen(true)
  }

  function openEditDialog(item: EquipmentRate) {
    setEditingRate(item)
    setFormData({
      supplier_id: item.supplier_id,
      equipment_id: item.equipment_id,
      rate: item.rate,
      daily_hours: item.daily_hours || 8,
    })
    setDialogOpen(true)
  }

  async function handleSave() {
    if (!formData.supplier_id) {
      toast.error('Please select a supplier')
      return
    }
    if (!formData.equipment_id) {
      toast.error('Please select equipment')
      return
    }
    if (formData.rate < 0) {
      toast.error('Rate cannot be negative')
      return
    }
    if (formData.daily_hours <= 0) {
      toast.error('Daily hours must be greater than 0')
      return
    }

    setSaving(true)
    try {
      const saveData = {
        supplier_id: formData.supplier_id,
        equipment_id: formData.equipment_id,
        rate: formData.rate,
        daily_hours: formData.daily_hours,
      }

      if (editingRate) {
        const { error } = await supabase
          .from('master_equipment_rates')
          .update(saveData)
          .eq('id', editingRate.id)

        if (error) throw error
        toast.success('Equipment rate updated successfully')
      } else {
        // Check for existing rate with same supplier+equipment combo
        const { data: existing } = await supabase
          .from('master_equipment_rates')
          .select('id')
          .eq('supplier_id', formData.supplier_id)
          .eq('equipment_id', formData.equipment_id)
          .eq('is_active', true)
          .single()

        if (existing) {
          toast.error('A rate already exists for this supplier and equipment combination')
          setSaving(false)
          return
        }

        const { error } = await supabase
          .from('master_equipment_rates')
          .insert(saveData)

        if (error) throw error
        toast.success('Equipment rate created successfully')
      }

      setDialogOpen(false)
      fetchEquipmentRates()
    } catch (error: any) {
      console.error('Error saving equipment rate:', error)
      if (error?.code === '23505') {
        toast.error('A rate already exists for this supplier and equipment combination')
      } else {
        toast.error(error?.message || 'Failed to save equipment rate')
      }
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(item: EquipmentRate) {
    const equipmentName = item.equipment?.name || 'this equipment'
    const supplierName = item.supplier?.supplier_name || 'this supplier'
    if (!confirm(`Delete the rate for "${equipmentName}" from "${supplierName}"? This action cannot be undone.`)) return

    try {
      const { error } = await supabase
        .from('master_equipment_rates')
        .update({ is_active: false })
        .eq('id', item.id)

      if (error) throw error
      toast.success('Equipment rate deleted')
      fetchEquipmentRates()
    } catch (error) {
      console.error('Error deleting equipment rate:', error)
      toast.error('Failed to delete equipment rate')
    }
  }

  // Get unique suppliers count
  const uniqueSuppliers = new Set(equipmentRates.map(r => r.supplier_id)).size
  // Get unique equipment count
  const uniqueEquipment = new Set(equipmentRates.map(r => r.equipment_id)).size

  if (loading) {
    return (
      <div className="flex flex-col min-h-screen">
        <Header title="Equipment Rates" />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <Loader2 className="h-8 w-8 animate-spin text-blue-600 mx-auto mb-4" />
            <p className="text-slate-500">Loading equipment rates...</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col min-h-screen">
      <Header title="Equipment Rates" />

      <div className="flex-1 p-4 md:p-6 space-y-6">
        {/* Header Card */}
        <Card>
          <CardHeader>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Truck className="h-5 w-5" />
                  Equipment Rates
                </CardTitle>
                <CardDescription>
                  Define rates for supplier + equipment combinations
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
                    placeholder="Search by supplier or equipment..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
              {suppliers.length > 0 && (
                <Select value={filterSupplier} onValueChange={setFilterSupplier}>
                  <SelectTrigger className="w-full sm:w-[200px]">
                    <Building2 className="h-4 w-4 mr-2" />
                    <SelectValue placeholder="All Suppliers" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Suppliers</SelectItem>
                    {suppliers.map((supplier) => (
                      <SelectItem key={supplier.id} value={supplier.id}>
                        {supplier.supplier_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            {/* Stats */}
            <div className="flex gap-4 mt-4 text-sm text-slate-600">
              <span>{filteredRates.length} rates defined</span>
              {uniqueSuppliers > 0 && (
                <span>| {uniqueSuppliers} suppliers</span>
              )}
              {uniqueEquipment > 0 && (
                <span>| {uniqueEquipment} equipment types</span>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Equipment Rates Table */}
        {filteredRates.length === 0 ? (
          <Card>
            <CardContent className="py-12">
              <div className="text-center">
                <Truck className="h-12 w-12 mx-auto text-slate-300 mb-4" />
                <h3 className="text-lg font-medium text-slate-900 mb-2">No Equipment Rates Found</h3>
                <p className="text-slate-500 mb-4">
                  {searchTerm || filterSupplier !== 'all'
                    ? 'Try adjusting your search or filter'
                    : 'Add your first equipment rate to get started'}
                </p>
                {!searchTerm && filterSupplier === 'all' && (
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
                      <TableHead>Supplier</TableHead>
                      <TableHead>Equipment</TableHead>
                      <TableHead className="text-right">Daily Rate</TableHead>
                      <TableHead className="text-center">Daily Hours</TableHead>
                      <TableHead className="text-right">Hourly Rate</TableHead>
                      <TableHead className="w-[100px] text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredRates.map((item) => {
                      const hourlyRate = item.daily_hours > 0 ? item.rate / item.daily_hours : 0
                      return (
                        <TableRow key={item.id}>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Building2 className="h-4 w-4 text-blue-500" />
                              <span className="font-medium">
                                {item.supplier?.supplier_name || '-'}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div>
                              <p className="font-medium">{item.equipment?.name || '-'}</p>
                              {item.equipment?.description && (
                                <p className="text-xs text-slate-500">{item.equipment.description}</p>
                              )}
                            </div>
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
                              ₹{hourlyRate.toFixed(2)}/hr
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
                      )
                    })}
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
              {editingRate ? 'Edit Equipment Rate' : 'Add New Equipment Rate'}
            </DialogTitle>
            <DialogDescription>
              {editingRate
                ? 'Update the equipment rate details'
                : 'Define a rate for a supplier + equipment combination'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Supplier */}
            <div className="space-y-2">
              <Label>Supplier *</Label>
              <Select
                value={formData.supplier_id}
                onValueChange={(value) => setFormData({ ...formData, supplier_id: value })}
                disabled={!!editingRate}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select supplier" />
                </SelectTrigger>
                <SelectContent>
                  {suppliers.map((supplier) => (
                    <SelectItem key={supplier.id} value={supplier.id}>
                      {supplier.supplier_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {suppliers.length === 0 && (
                <p className="text-xs text-amber-600">No suppliers found. Add suppliers first in Master Data.</p>
              )}
            </div>

            {/* Equipment */}
            <div className="space-y-2">
              <Label>Equipment *</Label>
              <Select
                value={formData.equipment_id}
                onValueChange={(value) => setFormData({ ...formData, equipment_id: value })}
                disabled={!!editingRate}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select equipment" />
                </SelectTrigger>
                <SelectContent>
                  {equipmentList.map((eq) => (
                    <SelectItem key={eq.id} value={eq.id}>
                      {eq.name}
                      {eq.description && ` - ${eq.description}`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {equipmentList.length === 0 && (
                <p className="text-xs text-amber-600">No equipment found. Add equipment types first.</p>
              )}
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
                  min="0.5"
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
                <> = ₹{(formData.rate / formData.daily_hours).toFixed(2)}/hr</>
              )}
            </p>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? 'Saving...' : editingRate ? 'Update' : 'Add Rate'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
