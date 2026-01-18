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
  Truck,
  Plus,
  Pencil,
  Trash2,
  Search,
  Loader2,
  IndianRupee,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'

interface Equipment {
  id: string
  name: string
  description: string | null
  hourly_rate: number
  is_active: boolean
  created_at: string
}

export default function EquipmentMasterPage() {
  const [equipment, setEquipment] = useState<Equipment[]>([])
  const [filteredEquipment, setFilteredEquipment] = useState<Equipment[]>([])
  const [loading, setLoading] = useState(true)

  // Filters
  const [searchTerm, setSearchTerm] = useState('')

  // Dialog states
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingEquipment, setEditingEquipment] = useState<Equipment | null>(null)
  const [saving, setSaving] = useState(false)

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    hourly_rate: 0,
  })

  useEffect(() => {
    fetchEquipment()
  }, [])

  useEffect(() => {
    filterEquipment()
  }, [equipment, searchTerm])

  async function fetchEquipment() {
    try {
      const { data, error } = await supabase
        .from('master_equipment')
        .select('*')
        .eq('is_active', true)
        .order('name')

      if (error) throw error
      setEquipment(data || [])
    } catch (error) {
      console.error('Error fetching equipment:', error)
      toast.error('Failed to load equipment')
    } finally {
      setLoading(false)
    }
  }

  function filterEquipment() {
    let filtered = [...equipment]

    if (searchTerm) {
      const term = searchTerm.toLowerCase()
      filtered = filtered.filter(e =>
        e.name.toLowerCase().includes(term) ||
        e.description?.toLowerCase().includes(term)
      )
    }

    setFilteredEquipment(filtered)
  }

  function openCreateDialog() {
    setEditingEquipment(null)
    setFormData({
      name: '',
      description: '',
      hourly_rate: 0,
    })
    setDialogOpen(true)
  }

  function openEditDialog(item: Equipment) {
    setEditingEquipment(item)
    setFormData({
      name: item.name,
      description: item.description || '',
      hourly_rate: item.hourly_rate,
    })
    setDialogOpen(true)
  }

  async function handleSave() {
    if (!formData.name.trim()) {
      toast.error('Please enter equipment name')
      return
    }
    if (formData.hourly_rate < 0) {
      toast.error('Hourly rate cannot be negative')
      return
    }

    setSaving(true)
    try {
      if (editingEquipment) {
        const { error } = await supabase
          .from('master_equipment')
          .update({
            name: formData.name.trim(),
            description: formData.description.trim() || null,
            hourly_rate: formData.hourly_rate,
          })
          .eq('id', editingEquipment.id)

        if (error) throw error
        toast.success('Equipment updated successfully')
      } else {
        const { error } = await supabase
          .from('master_equipment')
          .insert({
            name: formData.name.trim(),
            description: formData.description.trim() || null,
            hourly_rate: formData.hourly_rate,
          })

        if (error) throw error
        toast.success('Equipment created successfully')
      }

      setDialogOpen(false)
      fetchEquipment()
    } catch (error: any) {
      console.error('Error saving equipment:', error)
      toast.error(error?.message || 'Failed to save equipment')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(item: Equipment) {
    if (!confirm(`Delete "${item.name}"? This action cannot be undone.`)) return

    try {
      const { error } = await supabase
        .from('master_equipment')
        .update({ is_active: false })
        .eq('id', item.id)

      if (error) throw error
      toast.success('Equipment deleted')
      fetchEquipment()
    } catch (error) {
      console.error('Error deleting equipment:', error)
      toast.error('Failed to delete equipment')
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col min-h-screen">
        <Header title="Equipment Master" />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <Loader2 className="h-8 w-8 animate-spin text-blue-600 mx-auto mb-4" />
            <p className="text-slate-500">Loading equipment...</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col min-h-screen">
      <Header title="Equipment Master" />

      <div className="flex-1 p-4 md:p-6 space-y-6">
        {/* Header Card */}
        <Card>
          <CardHeader>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Truck className="h-5 w-5" />
                  Equipment Master
                </CardTitle>
                <CardDescription>
                  Manage equipment types and their hourly rates
                </CardDescription>
              </div>
              <Button onClick={openCreateDialog}>
                <Plus className="h-4 w-4 mr-2" />
                Add Equipment
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
                    placeholder="Search equipment..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
            </div>

            {/* Stats */}
            <div className="flex gap-4 mt-4 text-sm text-slate-600">
              <span>{filteredEquipment.length} equipment types</span>
            </div>
          </CardContent>
        </Card>

        {/* Equipment Table */}
        {filteredEquipment.length === 0 ? (
          <Card>
            <CardContent className="py-12">
              <div className="text-center">
                <Truck className="h-12 w-12 mx-auto text-slate-300 mb-4" />
                <h3 className="text-lg font-medium text-slate-900 mb-2">No Equipment Found</h3>
                <p className="text-slate-500 mb-4">
                  {searchTerm
                    ? 'Try adjusting your search'
                    : 'Add your first equipment type to get started'}
                </p>
                {!searchTerm && (
                  <Button onClick={openCreateDialog}>
                    <Plus className="h-4 w-4 mr-2" />
                    Add Equipment
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
                    <TableHead>Equipment Name</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead className="w-[150px] text-right">Hourly Rate</TableHead>
                    <TableHead className="w-[100px] text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredEquipment.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell>
                        <p className="font-medium">{item.name}</p>
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
              {editingEquipment ? 'Edit Equipment' : 'Add New Equipment'}
            </DialogTitle>
            <DialogDescription>
              {editingEquipment
                ? 'Update the equipment details'
                : 'Add a new equipment type to the master list'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Equipment Name */}
            <div className="space-y-2">
              <Label htmlFor="name">Equipment Name *</Label>
              <Input
                id="name"
                placeholder="e.g., JCB, Roller, Crane"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Input
                id="description"
                placeholder="e.g., Backhoe Loader, Road Compactor"
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
              <p className="text-xs text-slate-500">Rate per hour for this equipment</p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? 'Saving...' : editingEquipment ? 'Update' : 'Add Equipment'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
