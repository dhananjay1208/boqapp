'use client'

import { useState, useEffect } from 'react'
import { Header } from '@/components/layout/header'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
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
  Wrench,
  Plus,
  Pencil,
  Trash2,
  Search,
  Loader2,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'

interface MasterWorkstation {
  id: string
  name: string
  description: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

export default function MasterWorkstationsPage() {
  const [workstations, setWorkstations] = useState<MasterWorkstation[]>([])
  const [filteredWorkstations, setFilteredWorkstations] = useState<MasterWorkstation[]>([])
  const [loading, setLoading] = useState(true)

  // Filters
  const [searchTerm, setSearchTerm] = useState('')

  // Dialog states
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingWorkstation, setEditingWorkstation] = useState<MasterWorkstation | null>(null)
  const [saving, setSaving] = useState(false)

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    description: '',
  })

  useEffect(() => {
    fetchWorkstations()
  }, [])

  useEffect(() => {
    filterWorkstations()
  }, [workstations, searchTerm])

  async function fetchWorkstations() {
    try {
      const { data, error } = await supabase
        .from('master_workstations')
        .select('*')
        .eq('is_active', true)
        .order('name')

      if (error) throw error
      setWorkstations(data || [])
    } catch (error) {
      console.error('Error fetching workstations:', error)
      toast.error('Failed to load workstations')
    } finally {
      setLoading(false)
    }
  }

  function filterWorkstations() {
    let filtered = [...workstations]

    if (searchTerm) {
      const term = searchTerm.toLowerCase()
      filtered = filtered.filter(w =>
        w.name.toLowerCase().includes(term) ||
        (w.description && w.description.toLowerCase().includes(term))
      )
    }

    setFilteredWorkstations(filtered)
  }

  function openCreateDialog() {
    setEditingWorkstation(null)
    setFormData({
      name: '',
      description: '',
    })
    setDialogOpen(true)
  }

  function openEditDialog(workstation: MasterWorkstation) {
    setEditingWorkstation(workstation)
    setFormData({
      name: workstation.name,
      description: workstation.description || '',
    })
    setDialogOpen(true)
  }

  async function handleSave() {
    if (!formData.name.trim()) {
      toast.error('Please enter a workstation name')
      return
    }

    setSaving(true)
    try {
      if (editingWorkstation) {
        // Update
        const { error } = await supabase
          .from('master_workstations')
          .update({
            name: formData.name.trim().toUpperCase(),
            description: formData.description.trim() || null,
          })
          .eq('id', editingWorkstation.id)

        if (error) throw error
        toast.success('Workstation updated successfully')
      } else {
        // Create
        const { error } = await supabase
          .from('master_workstations')
          .insert({
            name: formData.name.trim().toUpperCase(),
            description: formData.description.trim() || null,
          })

        if (error) throw error
        toast.success('Workstation created successfully')
      }

      setDialogOpen(false)
      fetchWorkstations()
    } catch (error: any) {
      console.error('Error saving workstation:', error)
      if (error?.message?.includes('duplicate key') || error?.code === '23505') {
        toast.error('A workstation with this name already exists')
      } else {
        toast.error(error?.message || 'Failed to save workstation')
      }
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(workstation: MasterWorkstation) {
    if (!confirm(`Delete "${workstation.name}"? This action cannot be undone.`)) return

    try {
      // Soft delete by setting is_active to false
      const { error } = await supabase
        .from('master_workstations')
        .update({ is_active: false })
        .eq('id', workstation.id)

      if (error) throw error
      toast.success('Workstation deleted')
      fetchWorkstations()
    } catch (error) {
      console.error('Error deleting workstation:', error)
      toast.error('Failed to delete workstation')
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col min-h-screen">
        <Header title="Workstations" />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <Loader2 className="h-8 w-8 animate-spin text-blue-600 mx-auto mb-4" />
            <p className="text-slate-500">Loading workstations...</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col min-h-screen">
      <Header title="Workstations" />

      <div className="flex-1 p-4 md:p-6 space-y-6">
        {/* Header Card */}
        <Card>
          <CardHeader>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Wrench className="h-5 w-5" />
                  Workstations
                </CardTitle>
                <CardDescription>
                  Manage workstation types for tracking progress at construction sites
                </CardDescription>
              </div>
              <Button onClick={openCreateDialog}>
                <Plus className="h-4 w-4 mr-2" />
                Add Workstation
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
                    placeholder="Search workstations..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
            </div>

            {/* Stats */}
            <div className="flex gap-4 mt-4 text-sm text-slate-600">
              <span>{filteredWorkstations.length} workstations</span>
            </div>
          </CardContent>
        </Card>

        {/* Workstations Table */}
        {filteredWorkstations.length === 0 ? (
          <Card>
            <CardContent className="py-12">
              <div className="text-center">
                <Wrench className="h-12 w-12 mx-auto text-slate-300 mb-4" />
                <h3 className="text-lg font-medium text-slate-900 mb-2">No Workstations Found</h3>
                <p className="text-slate-500 mb-4">
                  {searchTerm
                    ? 'Try adjusting your search'
                    : 'Add your first workstation to get started'}
                </p>
                {!searchTerm && (
                  <Button onClick={openCreateDialog}>
                    <Plus className="h-4 w-4 mr-2" />
                    Add Workstation
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
                    <TableHead>Name</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead className="w-[100px] text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredWorkstations.map((workstation) => (
                    <TableRow key={workstation.id}>
                      <TableCell className="font-medium">{workstation.name}</TableCell>
                      <TableCell className="text-slate-600">
                        {workstation.description || '-'}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openEditDialog(workstation)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDelete(workstation)}
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
              {editingWorkstation ? 'Edit Workstation' : 'Add New Workstation'}
            </DialogTitle>
            <DialogDescription>
              {editingWorkstation
                ? 'Update the workstation details'
                : 'Add a new workstation type'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Name */}
            <div className="space-y-2">
              <Label htmlFor="name">Name *</Label>
              <Input
                id="name"
                placeholder="e.g., HT ROOM"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
              <p className="text-xs text-slate-500">Name will be converted to uppercase</p>
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label htmlFor="description">Description (Optional)</Label>
              <Input
                id="description"
                placeholder="e.g., High Tension Room"
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
              {saving ? 'Saving...' : editingWorkstation ? 'Update' : 'Add Workstation'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
