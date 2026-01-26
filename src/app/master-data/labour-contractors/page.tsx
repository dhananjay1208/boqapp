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
  HardHat,
  Plus,
  Pencil,
  Trash2,
  Search,
  Loader2,
  Phone,
  User,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'

interface LabourContractor {
  id: string
  name: string
  contact_person: string | null
  contact_number: string | null
  address: string | null
  is_active: boolean
  created_at: string
}

export default function LabourContractorsPage() {
  const [contractors, setContractors] = useState<LabourContractor[]>([])
  const [filteredContractors, setFilteredContractors] = useState<LabourContractor[]>([])
  const [loading, setLoading] = useState(true)

  // Filter
  const [searchTerm, setSearchTerm] = useState('')

  // Dialog states
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingContractor, setEditingContractor] = useState<LabourContractor | null>(null)
  const [saving, setSaving] = useState(false)

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    contact_person: '',
    contact_number: '',
    address: '',
  })

  useEffect(() => {
    fetchContractors()
  }, [])

  useEffect(() => {
    filterContractors()
  }, [contractors, searchTerm])

  async function fetchContractors() {
    try {
      const { data, error } = await supabase
        .from('master_labour_contractors')
        .select('*')
        .eq('is_active', true)
        .order('name')

      if (error) throw error
      setContractors(data || [])
    } catch (error) {
      console.error('Error fetching contractors:', error)
      toast.error('Failed to load labour contractors')
    } finally {
      setLoading(false)
    }
  }

  function filterContractors() {
    let filtered = [...contractors]

    if (searchTerm) {
      const term = searchTerm.toLowerCase()
      filtered = filtered.filter(c =>
        c.name.toLowerCase().includes(term) ||
        c.contact_person?.toLowerCase().includes(term) ||
        c.contact_number?.includes(term)
      )
    }

    setFilteredContractors(filtered)
  }

  function openCreateDialog() {
    setEditingContractor(null)
    setFormData({
      name: '',
      contact_person: '',
      contact_number: '',
      address: '',
    })
    setDialogOpen(true)
  }

  function openEditDialog(contractor: LabourContractor) {
    setEditingContractor(contractor)
    setFormData({
      name: contractor.name,
      contact_person: contractor.contact_person || '',
      contact_number: contractor.contact_number || '',
      address: contractor.address || '',
    })
    setDialogOpen(true)
  }

  async function handleSave() {
    if (!formData.name.trim()) {
      toast.error('Please enter contractor name')
      return
    }

    setSaving(true)
    try {
      const saveData = {
        name: formData.name.trim(),
        contact_person: formData.contact_person.trim() || null,
        contact_number: formData.contact_number.trim() || null,
        address: formData.address.trim() || null,
      }

      if (editingContractor) {
        const { error } = await supabase
          .from('master_labour_contractors')
          .update(saveData)
          .eq('id', editingContractor.id)

        if (error) throw error
        toast.success('Labour contractor updated successfully')
      } else {
        const { error } = await supabase
          .from('master_labour_contractors')
          .insert(saveData)

        if (error) throw error
        toast.success('Labour contractor created successfully')
      }

      setDialogOpen(false)
      fetchContractors()
    } catch (error: any) {
      console.error('Error saving contractor:', error)
      toast.error(error?.message || 'Failed to save labour contractor')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(contractor: LabourContractor) {
    if (!confirm(`Delete "${contractor.name}"? This action cannot be undone.`)) return

    try {
      const { error } = await supabase
        .from('master_labour_contractors')
        .update({ is_active: false })
        .eq('id', contractor.id)

      if (error) throw error
      toast.success('Labour contractor deleted')
      fetchContractors()
    } catch (error) {
      console.error('Error deleting contractor:', error)
      toast.error('Failed to delete labour contractor')
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col min-h-screen">
        <Header title="Labour Contractors" />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <Loader2 className="h-8 w-8 animate-spin text-blue-600 mx-auto mb-4" />
            <p className="text-slate-500">Loading labour contractors...</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col min-h-screen">
      <Header title="Labour Contractors" />

      <div className="flex-1 p-4 md:p-6 space-y-6">
        {/* Header Card */}
        <Card>
          <CardHeader>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <HardHat className="h-5 w-5" />
                  Labour Contractors
                </CardTitle>
                <CardDescription>
                  Manage labour contractors for manpower supply
                </CardDescription>
              </div>
              <Button onClick={openCreateDialog}>
                <Plus className="h-4 w-4 mr-2" />
                Add Contractor
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {/* Search */}
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                  placeholder="Search by name, contact person, or phone..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            {/* Stats */}
            <div className="flex gap-4 mt-4 text-sm text-slate-600">
              <span>{filteredContractors.length} labour contractors</span>
            </div>
          </CardContent>
        </Card>

        {/* Contractors Table */}
        {filteredContractors.length === 0 ? (
          <Card>
            <CardContent className="py-12">
              <div className="text-center">
                <HardHat className="h-12 w-12 mx-auto text-slate-300 mb-4" />
                <h3 className="text-lg font-medium text-slate-900 mb-2">No Labour Contractors Found</h3>
                <p className="text-slate-500 mb-4">
                  {searchTerm
                    ? 'Try adjusting your search'
                    : 'Add your first labour contractor to get started'}
                </p>
                {!searchTerm && (
                  <Button onClick={openCreateDialog}>
                    <Plus className="h-4 w-4 mr-2" />
                    Add Contractor
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
                      <TableHead>Contractor Name</TableHead>
                      <TableHead>Contact Person</TableHead>
                      <TableHead>Contact Number</TableHead>
                      <TableHead>Address</TableHead>
                      <TableHead className="w-[100px] text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredContractors.map((contractor) => (
                      <TableRow key={contractor.id}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <HardHat className="h-4 w-4 text-orange-500" />
                            <span className="font-medium">{contractor.name}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          {contractor.contact_person ? (
                            <div className="flex items-center gap-2">
                              <User className="h-4 w-4 text-slate-400" />
                              <span>{contractor.contact_person}</span>
                            </div>
                          ) : (
                            <span className="text-slate-400">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {contractor.contact_number ? (
                            <div className="flex items-center gap-2">
                              <Phone className="h-4 w-4 text-slate-400" />
                              <span>{contractor.contact_number}</span>
                            </div>
                          ) : (
                            <span className="text-slate-400">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <span className="text-sm text-slate-500">
                            {contractor.address || '-'}
                          </span>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => openEditDialog(contractor)}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDelete(contractor)}
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
              {editingContractor ? 'Edit Labour Contractor' : 'Add New Labour Contractor'}
            </DialogTitle>
            <DialogDescription>
              {editingContractor
                ? 'Update the labour contractor details'
                : 'Add a new labour contractor to the master list'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Contractor Name */}
            <div className="space-y-2">
              <Label htmlFor="name">Contractor Name *</Label>
              <Input
                id="name"
                placeholder="e.g., ABC Labour Contractors"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>

            {/* Contact Person */}
            <div className="space-y-2">
              <Label htmlFor="contact_person">Contact Person</Label>
              <Input
                id="contact_person"
                placeholder="e.g., Mr. Sharma"
                value={formData.contact_person}
                onChange={(e) => setFormData({ ...formData, contact_person: e.target.value })}
              />
            </div>

            {/* Contact Number */}
            <div className="space-y-2">
              <Label htmlFor="contact_number">Contact Number</Label>
              <Input
                id="contact_number"
                placeholder="e.g., 9876543210"
                value={formData.contact_number}
                onChange={(e) => setFormData({ ...formData, contact_number: e.target.value })}
              />
            </div>

            {/* Address */}
            <div className="space-y-2">
              <Label htmlFor="address">Address</Label>
              <Textarea
                id="address"
                placeholder="Full address..."
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                rows={2}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? 'Saving...' : editingContractor ? 'Update' : 'Add Contractor'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
