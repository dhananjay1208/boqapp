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
  Download,
  FileSpreadsheet,
  CheckCircle2,
  AlertCircle,
  XCircle,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'
import {
  parseMaterialsExcel,
  exportMaterialsXlsx,
  downloadMaterialsTemplate,
  type ParsedImport,
} from '@/lib/materials-excel'

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

  // Import dialog state
  const [importDialogOpen, setImportDialogOpen] = useState(false)
  const [importFileName, setImportFileName] = useState<string | null>(null)
  const [parsed, setParsed] = useState<ParsedImport | null>(null)
  const [importBusy, setImportBusy] = useState(false)
  const [dragActive, setDragActive] = useState(false)

  // Delete confirmation state
  const [deleteTarget, setDeleteTarget] = useState<MasterMaterial | null>(null)
  const [deleting, setDeleting] = useState(false)

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

  function askDelete(material: MasterMaterial) {
    setDeleteTarget(material)
  }

  async function confirmDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      // Soft delete by setting is_active to false
      const { error } = await supabase
        .from('master_materials')
        .update({ is_active: false })
        .eq('id', deleteTarget.id)
      if (error) throw error
      toast.success(`"${deleteTarget.name}" deleted`)
      setDeleteTarget(null)
      fetchMaterials()
    } catch (error) {
      console.error('Error deleting material:', error)
      toast.error('Failed to delete material')
    } finally {
      setDeleting(false)
    }
  }

  function handleExport() {
    if (materials.length === 0) {
      toast.error('Nothing to export')
      return
    }
    const date = new Date().toISOString().slice(0, 10)
    exportMaterialsXlsx(materials, `materials_${date}.xlsx`)
  }

  function openImportDialog() {
    setImportFileName(null)
    setParsed(null)
    setDragActive(false)
    setImportDialogOpen(true)
  }

  async function handleImportFile(file: File) {
    setImportFileName(file.name)
    setParsed(null)
    try {
      // We pass ALL materials (active + inactive) so the importer can reactivate soft-deleted rows.
      const { data, error } = await supabase
        .from('master_materials')
        .select('id, category, name, unit, description, is_active')
      if (error) throw error
      const result = await parseMaterialsExcel(file, data || [])
      if (result.totalRows === 0) {
        toast.error('No data rows found in the file')
        setParsed(null)
        return
      }
      setParsed(result)
    } catch (err: any) {
      console.error(err)
      toast.error(err?.message || 'Failed to read file')
      setParsed(null)
    }
  }

  function onFileInput(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    if (f) handleImportFile(f)
    e.target.value = '' // allow re-selecting the same file
  }

  function onDragEvent(e: React.DragEvent, active: boolean) {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(active)
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)
    const f = e.dataTransfer.files?.[0]
    if (f) handleImportFile(f)
  }

  async function handleConfirmImport() {
    if (!parsed) return
    setImportBusy(true)
    try {
      // Inserts — chunk into batches of 500 to stay well under Supabase's payload limit.
      const insertRows = parsed.toInsert.map((r) => ({
        category: r.category,
        name: r.name,
        unit: r.unit,
        description: r.description,
      }))
      for (let i = 0; i < insertRows.length; i += 500) {
        const batch = insertRows.slice(i, i + 500)
        const { error } = await supabase.from('master_materials').insert(batch)
        if (error) throw error
      }

      // Updates — Supabase update() doesn't accept array payloads, so loop.
      for (const u of parsed.toUpdate) {
        const update: Record<string, unknown> = {
          category: u.category,
          name: u.name,
          unit: u.unit,
          description: u.description,
        }
        if (u.reactivate) update.is_active = true
        const { error } = await supabase
          .from('master_materials')
          .update(update)
          .eq('id', u.id)
        if (error) throw error
      }

      toast.success(
        `Imported ${parsed.toInsert.length} new + ${parsed.toUpdate.length} updated` +
          (parsed.skipped.length ? `, ${parsed.skipped.length} skipped` : '')
      )
      setImportDialogOpen(false)
      setParsed(null)
      setImportFileName(null)
      fetchMaterials()
    } catch (err: any) {
      console.error(err)
      toast.error(err?.message || 'Import failed')
    } finally {
      setImportBusy(false)
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
              <div className="flex flex-wrap items-center gap-2">
                <Button variant="outline" onClick={downloadMaterialsTemplate}>
                  <FileSpreadsheet className="h-4 w-4 mr-2" />
                  Template
                </Button>
                <Button variant="outline" onClick={openImportDialog}>
                  <Upload className="h-4 w-4 mr-2" />
                  Import
                </Button>
                <Button variant="outline" onClick={handleExport}>
                  <Download className="h-4 w-4 mr-2" />
                  Export
                </Button>
                <Button onClick={openCreateDialog}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Material
                </Button>
              </div>
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
                    <TableHead className="w-[200px] text-right">Actions</TableHead>
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
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => openEditDialog(material)}
                            >
                              <Pencil className="h-3.5 w-3.5 mr-1.5" />
                              Edit
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => askDelete(material)}
                              className="text-red-600 hover:bg-red-50 hover:text-red-700 border-red-200"
                            >
                              <Trash2 className="h-3.5 w-3.5 mr-1.5" />
                              Delete
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

      {/* Import Dialog */}
      <Dialog open={importDialogOpen} onOpenChange={(o) => !importBusy && setImportDialogOpen(o)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Import Materials from Excel</DialogTitle>
            <DialogDescription>
              Upload an .xlsx file with <span className="font-mono">Category</span>,{' '}
              <span className="font-mono">Material Name</span>,{' '}
              <span className="font-mono">Unit</span>, and{' '}
              <span className="font-mono">Description</span> columns. Existing materials are
              matched by category + name (case-insensitive).
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {!parsed && (
              <div
                onDragEnter={(e) => onDragEvent(e, true)}
                onDragLeave={(e) => onDragEvent(e, false)}
                onDragOver={(e) => onDragEvent(e, true)}
                onDrop={onDrop}
                className={
                  'rounded-lg border-2 border-dashed p-8 text-center transition-colors ' +
                  (dragActive ? 'border-blue-400 bg-blue-50' : 'border-slate-200 bg-slate-50')
                }
              >
                <Upload className="h-10 w-10 mx-auto text-slate-400 mb-3" />
                <p className="text-sm text-slate-600 mb-3">
                  {importFileName ? `Selected: ${importFileName}` : 'Drag and drop an .xlsx file here, or'}
                </p>
                <label>
                  <input
                    type="file"
                    accept=".xlsx,.xls"
                    onChange={onFileInput}
                    className="hidden"
                  />
                  <Button type="button" variant="outline" asChild>
                    <span className="cursor-pointer">Browse File</span>
                  </Button>
                </label>
              </div>
            )}

            {parsed && (
              <>
                <div className="flex items-center gap-3 text-sm">
                  <FileSpreadsheet className="h-4 w-4 text-slate-500" />
                  <span className="font-medium">{importFileName}</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setParsed(null)
                      setImportFileName(null)
                    }}
                    disabled={importBusy}
                  >
                    Choose another
                  </Button>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div className="rounded-md border border-emerald-200 bg-emerald-50 p-3">
                    <div className="flex items-center gap-2 text-emerald-700">
                      <CheckCircle2 className="h-4 w-4" />
                      <span className="text-xs font-medium">New</span>
                    </div>
                    <p className="mt-1 text-2xl font-bold text-emerald-900">
                      {parsed.toInsert.length}
                    </p>
                  </div>
                  <div className="rounded-md border border-blue-200 bg-blue-50 p-3">
                    <div className="flex items-center gap-2 text-blue-700">
                      <AlertCircle className="h-4 w-4" />
                      <span className="text-xs font-medium">Updates</span>
                    </div>
                    <p className="mt-1 text-2xl font-bold text-blue-900">{parsed.toUpdate.length}</p>
                  </div>
                  <div className="rounded-md border border-amber-200 bg-amber-50 p-3">
                    <div className="flex items-center gap-2 text-amber-700">
                      <XCircle className="h-4 w-4" />
                      <span className="text-xs font-medium">Skipped</span>
                    </div>
                    <p className="mt-1 text-2xl font-bold text-amber-900">{parsed.skipped.length}</p>
                  </div>
                </div>

                <div className="rounded-md border max-h-[40vh] overflow-y-auto">
                  <Table>
                    <TableHeader className="sticky top-0 bg-white">
                      <TableRow>
                        <TableHead className="w-[60px]">Row</TableHead>
                        <TableHead className="w-[110px]">Action</TableHead>
                        <TableHead>Category</TableHead>
                        <TableHead>Material Name</TableHead>
                        <TableHead className="w-[80px]">Unit</TableHead>
                        <TableHead>Notes</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {parsed.toInsert.slice(0, 50).map((r) => (
                        <TableRow key={`i${r.excelRow}`}>
                          <TableCell className="text-slate-500">{r.excelRow}</TableCell>
                          <TableCell>
                            <Badge className="bg-emerald-100 text-emerald-700" variant="secondary">
                              New
                            </Badge>
                          </TableCell>
                          <TableCell>{r.category}</TableCell>
                          <TableCell>{r.name}</TableCell>
                          <TableCell>{r.unit}</TableCell>
                          <TableCell className="text-xs text-slate-500">
                            {r.description ?? ''}
                          </TableCell>
                        </TableRow>
                      ))}
                      {parsed.toUpdate.slice(0, 50).map((r) => (
                        <TableRow key={`u${r.excelRow}`}>
                          <TableCell className="text-slate-500">{r.excelRow}</TableCell>
                          <TableCell>
                            <Badge className="bg-blue-100 text-blue-700" variant="secondary">
                              {r.reactivate ? 'Restore' : 'Update'}
                            </Badge>
                          </TableCell>
                          <TableCell>{r.category}</TableCell>
                          <TableCell>{r.name}</TableCell>
                          <TableCell>{r.unit}</TableCell>
                          <TableCell className="text-xs text-slate-500">
                            {r.description ?? ''}
                          </TableCell>
                        </TableRow>
                      ))}
                      {parsed.skipped.slice(0, 50).map((s) => (
                        <TableRow key={`s${s.excelRow}`}>
                          <TableCell className="text-slate-500">{s.excelRow}</TableCell>
                          <TableCell>
                            <Badge className="bg-amber-100 text-amber-700" variant="secondary">
                              Skip
                            </Badge>
                          </TableCell>
                          <TableCell>{s.data.category ?? ''}</TableCell>
                          <TableCell>{s.data.name ?? ''}</TableCell>
                          <TableCell>{s.data.unit ?? ''}</TableCell>
                          <TableCell className="text-xs text-amber-700">{s.reason}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                {parsed.toInsert.length + parsed.toUpdate.length + parsed.skipped.length > 150 && (
                  <p className="text-xs text-slate-500">
                    Showing first 50 of each category. All rows will be processed on confirm.
                  </p>
                )}
              </>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setImportDialogOpen(false)}
              disabled={importBusy}
            >
              Cancel
            </Button>
            <Button
              onClick={handleConfirmImport}
              disabled={
                importBusy ||
                !parsed ||
                parsed.toInsert.length + parsed.toUpdate.length === 0
              }
            >
              {importBusy ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Importing...
                </>
              ) : (
                'Import'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={!!deleteTarget}
        onOpenChange={(o) => !deleting && !o && setDeleteTarget(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete material?</DialogTitle>
            <DialogDescription>
              Remove <span className="font-medium">{deleteTarget?.name}</span> from the master
              list. Existing GRN entries and workstation records that reference it are not
              affected. The material can be restored by re-importing it from Excel.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteTarget(null)}
              disabled={deleting}
            >
              Cancel
            </Button>
            <Button variant="destructive" onClick={confirmDelete} disabled={deleting}>
              {deleting ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4 mr-2" />
              )}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
