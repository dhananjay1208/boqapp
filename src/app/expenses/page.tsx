'use client'

import { useState, useEffect } from 'react'
import { Header } from '@/components/layout/header'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
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
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs'
import {
  Building2,
  Calendar,
  Package,
  Users,
  Truck,
  Receipt,
  Plus,
  Pencil,
  Trash2,
  Loader2,
  IndianRupee,
  Calculator,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'

interface Site {
  id: string
  name: string
}

interface Manpower {
  id: string
  category: string
  hourly_rate: number
}

interface Equipment {
  id: string
  name: string
  hourly_rate: number
}

interface MaterialExpense {
  id: string
  expense_date: string
  amount: number
  invoice_reference: string | null
  notes: string | null
}

interface ManpowerExpense {
  id: string
  expense_date: string
  manpower_id: string
  manpower_category: string
  hours: number
  rate: number
  amount: number
  notes: string | null
}

interface EquipmentExpense {
  id: string
  expense_date: string
  equipment_id: string
  equipment_name: string
  hours: number
  rate: number
  amount: number
  notes: string | null
}

interface OtherExpense {
  id: string
  expense_date: string
  description: string
  amount: number
  notes: string | null
}

export default function ExpensesPage() {
  const [sites, setSites] = useState<Site[]>([])
  const [selectedSiteId, setSelectedSiteId] = useState<string>('')
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0])
  const [loading, setLoading] = useState(true)
  const [loadingExpenses, setLoadingExpenses] = useState(false)

  // Master data
  const [manpowerList, setManpowerList] = useState<Manpower[]>([])
  const [equipmentList, setEquipmentList] = useState<Equipment[]>([])

  // Expenses
  const [materialExpenses, setMaterialExpenses] = useState<MaterialExpense[]>([])
  const [manpowerExpenses, setManpowerExpenses] = useState<ManpowerExpense[]>([])
  const [equipmentExpenses, setEquipmentExpenses] = useState<EquipmentExpense[]>([])
  const [otherExpenses, setOtherExpenses] = useState<OtherExpense[]>([])

  // Dialog states
  const [materialDialogOpen, setMaterialDialogOpen] = useState(false)
  const [manpowerDialogOpen, setManpowerDialogOpen] = useState(false)
  const [equipmentDialogOpen, setEquipmentDialogOpen] = useState(false)
  const [otherDialogOpen, setOtherDialogOpen] = useState(false)

  // Editing states
  const [editingMaterial, setEditingMaterial] = useState<MaterialExpense | null>(null)
  const [editingManpower, setEditingManpower] = useState<ManpowerExpense | null>(null)
  const [editingEquipment, setEditingEquipment] = useState<EquipmentExpense | null>(null)
  const [editingOther, setEditingOther] = useState<OtherExpense | null>(null)

  // Form states
  const [materialForm, setMaterialForm] = useState({ amount: 0, invoice_reference: '', notes: '' })
  const [manpowerForm, setManpowerForm] = useState({ manpower_id: '', hours: 0, notes: '' })
  const [equipmentForm, setEquipmentForm] = useState({ equipment_id: '', hours: 0, notes: '' })
  const [otherForm, setOtherForm] = useState({ description: '', amount: 0, notes: '' })

  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetchInitialData()
  }, [])

  useEffect(() => {
    if (selectedSiteId && selectedDate) {
      fetchExpenses()
    }
  }, [selectedSiteId, selectedDate])

  async function fetchInitialData() {
    try {
      // Fetch sites
      const { data: sitesData, error: sitesError } = await supabase
        .from('sites')
        .select('id, name')
        .order('name')

      if (sitesError) throw sitesError
      setSites(sitesData || [])

      if (sitesData && sitesData.length > 0) {
        setSelectedSiteId(sitesData[0].id)
      }

      // Fetch manpower categories
      const { data: manpowerData, error: manpowerError } = await supabase
        .from('master_manpower')
        .select('id, category, hourly_rate')
        .eq('is_active', true)
        .order('category')

      if (manpowerError) throw manpowerError
      setManpowerList(manpowerData || [])

      // Fetch equipment
      const { data: equipmentData, error: equipmentError } = await supabase
        .from('master_equipment')
        .select('id, name, hourly_rate')
        .eq('is_active', true)
        .order('name')

      if (equipmentError) throw equipmentError
      setEquipmentList(equipmentData || [])
    } catch (error) {
      console.error('Error fetching initial data:', error)
      toast.error('Failed to load data')
    } finally {
      setLoading(false)
    }
  }

  async function fetchExpenses() {
    setLoadingExpenses(true)
    try {
      // Fetch all expense types in parallel
      const [materialRes, manpowerRes, equipmentRes, otherRes] = await Promise.all([
        supabase
          .from('expense_material')
          .select('*')
          .eq('site_id', selectedSiteId)
          .eq('expense_date', selectedDate)
          .order('created_at'),
        supabase
          .from('expense_manpower')
          .select('*')
          .eq('site_id', selectedSiteId)
          .eq('expense_date', selectedDate)
          .order('created_at'),
        supabase
          .from('expense_equipment')
          .select('*')
          .eq('site_id', selectedSiteId)
          .eq('expense_date', selectedDate)
          .order('created_at'),
        supabase
          .from('expense_other')
          .select('*')
          .eq('site_id', selectedSiteId)
          .eq('expense_date', selectedDate)
          .order('created_at'),
      ])

      setMaterialExpenses(materialRes.data || [])
      setManpowerExpenses(manpowerRes.data || [])
      setEquipmentExpenses(equipmentRes.data || [])
      setOtherExpenses(otherRes.data || [])
    } catch (error) {
      console.error('Error fetching expenses:', error)
      toast.error('Failed to load expenses')
    } finally {
      setLoadingExpenses(false)
    }
  }

  // Material expense handlers
  function openMaterialDialog(expense?: MaterialExpense) {
    if (expense) {
      setEditingMaterial(expense)
      setMaterialForm({
        amount: expense.amount,
        invoice_reference: expense.invoice_reference || '',
        notes: expense.notes || '',
      })
    } else {
      setEditingMaterial(null)
      setMaterialForm({ amount: 0, invoice_reference: '', notes: '' })
    }
    setMaterialDialogOpen(true)
  }

  async function saveMaterialExpense() {
    if (materialForm.amount <= 0) {
      toast.error('Amount must be greater than 0')
      return
    }

    setSaving(true)
    try {
      if (editingMaterial) {
        const { error } = await supabase
          .from('expense_material')
          .update({
            amount: materialForm.amount,
            invoice_reference: materialForm.invoice_reference || null,
            notes: materialForm.notes || null,
          })
          .eq('id', editingMaterial.id)

        if (error) throw error
        toast.success('Material expense updated')
      } else {
        const { error } = await supabase
          .from('expense_material')
          .insert({
            site_id: selectedSiteId,
            expense_date: selectedDate,
            amount: materialForm.amount,
            invoice_reference: materialForm.invoice_reference || null,
            notes: materialForm.notes || null,
          })

        if (error) throw error
        toast.success('Material expense added')
      }

      setMaterialDialogOpen(false)
      fetchExpenses()
    } catch (error) {
      console.error('Error saving material expense:', error)
      toast.error('Failed to save expense')
    } finally {
      setSaving(false)
    }
  }

  async function deleteMaterialExpense(id: string) {
    if (!confirm('Delete this expense?')) return

    try {
      const { error } = await supabase.from('expense_material').delete().eq('id', id)
      if (error) throw error
      toast.success('Expense deleted')
      fetchExpenses()
    } catch (error) {
      console.error('Error deleting expense:', error)
      toast.error('Failed to delete expense')
    }
  }

  // Manpower expense handlers
  function openManpowerDialog(expense?: ManpowerExpense) {
    if (expense) {
      setEditingManpower(expense)
      setManpowerForm({
        manpower_id: expense.manpower_id,
        hours: expense.hours,
        notes: expense.notes || '',
      })
    } else {
      setEditingManpower(null)
      setManpowerForm({ manpower_id: '', hours: 0, notes: '' })
    }
    setManpowerDialogOpen(true)
  }

  function getManpowerRate(manpowerId: string): number {
    const mp = manpowerList.find(m => m.id === manpowerId)
    return mp?.hourly_rate || 0
  }

  function getManpowerCategory(manpowerId: string): string {
    const mp = manpowerList.find(m => m.id === manpowerId)
    return mp?.category || ''
  }

  async function saveManpowerExpense() {
    if (!manpowerForm.manpower_id) {
      toast.error('Please select a manpower category')
      return
    }
    if (manpowerForm.hours <= 0) {
      toast.error('Hours must be greater than 0')
      return
    }

    const rate = getManpowerRate(manpowerForm.manpower_id)
    const amount = manpowerForm.hours * rate
    const category = getManpowerCategory(manpowerForm.manpower_id)

    setSaving(true)
    try {
      if (editingManpower) {
        const { error } = await supabase
          .from('expense_manpower')
          .update({
            manpower_id: manpowerForm.manpower_id,
            manpower_category: category,
            hours: manpowerForm.hours,
            rate: rate,
            amount: amount,
            notes: manpowerForm.notes || null,
          })
          .eq('id', editingManpower.id)

        if (error) throw error
        toast.success('Manpower expense updated')
      } else {
        const { error } = await supabase
          .from('expense_manpower')
          .insert({
            site_id: selectedSiteId,
            expense_date: selectedDate,
            manpower_id: manpowerForm.manpower_id,
            manpower_category: category,
            hours: manpowerForm.hours,
            rate: rate,
            amount: amount,
            notes: manpowerForm.notes || null,
          })

        if (error) throw error
        toast.success('Manpower expense added')
      }

      setManpowerDialogOpen(false)
      fetchExpenses()
    } catch (error) {
      console.error('Error saving manpower expense:', error)
      toast.error('Failed to save expense')
    } finally {
      setSaving(false)
    }
  }

  async function deleteManpowerExpense(id: string) {
    if (!confirm('Delete this expense?')) return

    try {
      const { error } = await supabase.from('expense_manpower').delete().eq('id', id)
      if (error) throw error
      toast.success('Expense deleted')
      fetchExpenses()
    } catch (error) {
      console.error('Error deleting expense:', error)
      toast.error('Failed to delete expense')
    }
  }

  // Equipment expense handlers
  function openEquipmentDialog(expense?: EquipmentExpense) {
    if (expense) {
      setEditingEquipment(expense)
      setEquipmentForm({
        equipment_id: expense.equipment_id,
        hours: expense.hours,
        notes: expense.notes || '',
      })
    } else {
      setEditingEquipment(null)
      setEquipmentForm({ equipment_id: '', hours: 0, notes: '' })
    }
    setEquipmentDialogOpen(true)
  }

  function getEquipmentRate(equipmentId: string): number {
    const eq = equipmentList.find(e => e.id === equipmentId)
    return eq?.hourly_rate || 0
  }

  function getEquipmentName(equipmentId: string): string {
    const eq = equipmentList.find(e => e.id === equipmentId)
    return eq?.name || ''
  }

  async function saveEquipmentExpense() {
    if (!equipmentForm.equipment_id) {
      toast.error('Please select equipment')
      return
    }
    if (equipmentForm.hours <= 0) {
      toast.error('Hours must be greater than 0')
      return
    }

    const rate = getEquipmentRate(equipmentForm.equipment_id)
    const amount = equipmentForm.hours * rate
    const name = getEquipmentName(equipmentForm.equipment_id)

    setSaving(true)
    try {
      if (editingEquipment) {
        const { error } = await supabase
          .from('expense_equipment')
          .update({
            equipment_id: equipmentForm.equipment_id,
            equipment_name: name,
            hours: equipmentForm.hours,
            rate: rate,
            amount: amount,
            notes: equipmentForm.notes || null,
          })
          .eq('id', editingEquipment.id)

        if (error) throw error
        toast.success('Equipment expense updated')
      } else {
        const { error } = await supabase
          .from('expense_equipment')
          .insert({
            site_id: selectedSiteId,
            expense_date: selectedDate,
            equipment_id: equipmentForm.equipment_id,
            equipment_name: name,
            hours: equipmentForm.hours,
            rate: rate,
            amount: amount,
            notes: equipmentForm.notes || null,
          })

        if (error) throw error
        toast.success('Equipment expense added')
      }

      setEquipmentDialogOpen(false)
      fetchExpenses()
    } catch (error) {
      console.error('Error saving equipment expense:', error)
      toast.error('Failed to save expense')
    } finally {
      setSaving(false)
    }
  }

  async function deleteEquipmentExpense(id: string) {
    if (!confirm('Delete this expense?')) return

    try {
      const { error } = await supabase.from('expense_equipment').delete().eq('id', id)
      if (error) throw error
      toast.success('Expense deleted')
      fetchExpenses()
    } catch (error) {
      console.error('Error deleting expense:', error)
      toast.error('Failed to delete expense')
    }
  }

  // Other expense handlers
  function openOtherDialog(expense?: OtherExpense) {
    if (expense) {
      setEditingOther(expense)
      setOtherForm({
        description: expense.description,
        amount: expense.amount,
        notes: expense.notes || '',
      })
    } else {
      setEditingOther(null)
      setOtherForm({ description: '', amount: 0, notes: '' })
    }
    setOtherDialogOpen(true)
  }

  async function saveOtherExpense() {
    if (!otherForm.description.trim()) {
      toast.error('Please enter a description')
      return
    }
    if (otherForm.amount <= 0) {
      toast.error('Amount must be greater than 0')
      return
    }

    setSaving(true)
    try {
      if (editingOther) {
        const { error } = await supabase
          .from('expense_other')
          .update({
            description: otherForm.description.trim(),
            amount: otherForm.amount,
            notes: otherForm.notes || null,
          })
          .eq('id', editingOther.id)

        if (error) throw error
        toast.success('Other expense updated')
      } else {
        const { error } = await supabase
          .from('expense_other')
          .insert({
            site_id: selectedSiteId,
            expense_date: selectedDate,
            description: otherForm.description.trim(),
            amount: otherForm.amount,
            notes: otherForm.notes || null,
          })

        if (error) throw error
        toast.success('Other expense added')
      }

      setOtherDialogOpen(false)
      fetchExpenses()
    } catch (error) {
      console.error('Error saving other expense:', error)
      toast.error('Failed to save expense')
    } finally {
      setSaving(false)
    }
  }

  async function deleteOtherExpense(id: string) {
    if (!confirm('Delete this expense?')) return

    try {
      const { error } = await supabase.from('expense_other').delete().eq('id', id)
      if (error) throw error
      toast.success('Expense deleted')
      fetchExpenses()
    } catch (error) {
      console.error('Error deleting expense:', error)
      toast.error('Failed to delete expense')
    }
  }

  // Calculate totals
  const materialTotal = materialExpenses.reduce((sum, e) => sum + e.amount, 0)
  const manpowerTotal = manpowerExpenses.reduce((sum, e) => sum + e.amount, 0)
  const equipmentTotal = equipmentExpenses.reduce((sum, e) => sum + e.amount, 0)
  const otherTotal = otherExpenses.reduce((sum, e) => sum + e.amount, 0)
  const grandTotal = materialTotal + manpowerTotal + equipmentTotal + otherTotal

  if (loading) {
    return (
      <div className="flex flex-col min-h-screen">
        <Header title="Expenses Recording" />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <Loader2 className="h-8 w-8 animate-spin text-blue-600 mx-auto mb-4" />
            <p className="text-slate-500">Loading...</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col min-h-screen">
      <Header title="Expenses Recording" />

      <div className="flex-1 p-4 md:p-6 space-y-4">
        {/* Site and Date Selection */}
        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center gap-2">
              <Receipt className="h-5 w-5" />
              Daily Expense Recording
            </CardTitle>
            <CardDescription>
              Record daily expenses for material, manpower, equipment, and other categories
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="flex-1">
                <Label className="text-xs text-slate-500 mb-1 block">Site</Label>
                <Select value={selectedSiteId} onValueChange={setSelectedSiteId}>
                  <SelectTrigger>
                    <Building2 className="h-4 w-4 mr-2" />
                    <SelectValue placeholder="Select site" />
                  </SelectTrigger>
                  <SelectContent>
                    {sites.map((site) => (
                      <SelectItem key={site.id} value={site.id}>
                        {site.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="w-full sm:w-48">
                <Label className="text-xs text-slate-500 mb-1 block">Date</Label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <Input
                    type="date"
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Daily Summary */}
        {selectedSiteId && (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <Card className="bg-blue-50 border-blue-200">
              <CardContent className="p-3">
                <div className="flex items-center gap-2">
                  <Package className="h-4 w-4 text-blue-600" />
                  <span className="text-xs text-blue-600 font-medium">Material</span>
                </div>
                <p className="text-lg font-bold text-blue-700 mt-1">
                  {materialTotal.toLocaleString('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 })}
                </p>
              </CardContent>
            </Card>
            <Card className="bg-green-50 border-green-200">
              <CardContent className="p-3">
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-green-600" />
                  <span className="text-xs text-green-600 font-medium">Manpower</span>
                </div>
                <p className="text-lg font-bold text-green-700 mt-1">
                  {manpowerTotal.toLocaleString('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 })}
                </p>
              </CardContent>
            </Card>
            <Card className="bg-orange-50 border-orange-200">
              <CardContent className="p-3">
                <div className="flex items-center gap-2">
                  <Truck className="h-4 w-4 text-orange-600" />
                  <span className="text-xs text-orange-600 font-medium">Equipment</span>
                </div>
                <p className="text-lg font-bold text-orange-700 mt-1">
                  {equipmentTotal.toLocaleString('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 })}
                </p>
              </CardContent>
            </Card>
            <Card className="bg-purple-50 border-purple-200">
              <CardContent className="p-3">
                <div className="flex items-center gap-2">
                  <Receipt className="h-4 w-4 text-purple-600" />
                  <span className="text-xs text-purple-600 font-medium">Other</span>
                </div>
                <p className="text-lg font-bold text-purple-700 mt-1">
                  {otherTotal.toLocaleString('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 })}
                </p>
              </CardContent>
            </Card>
            <Card className="bg-slate-100 border-slate-300 col-span-2 md:col-span-1">
              <CardContent className="p-3">
                <div className="flex items-center gap-2">
                  <Calculator className="h-4 w-4 text-slate-600" />
                  <span className="text-xs text-slate-600 font-medium">Total</span>
                </div>
                <p className="text-lg font-bold text-slate-800 mt-1">
                  {grandTotal.toLocaleString('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 })}
                </p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Expense Tabs */}
        {selectedSiteId && (
          <Tabs defaultValue="material" className="space-y-4">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="material" className="text-xs sm:text-sm">
                <Package className="h-4 w-4 mr-1 sm:mr-2" />
                <span className="hidden sm:inline">Material</span>
              </TabsTrigger>
              <TabsTrigger value="manpower" className="text-xs sm:text-sm">
                <Users className="h-4 w-4 mr-1 sm:mr-2" />
                <span className="hidden sm:inline">Manpower</span>
              </TabsTrigger>
              <TabsTrigger value="equipment" className="text-xs sm:text-sm">
                <Truck className="h-4 w-4 mr-1 sm:mr-2" />
                <span className="hidden sm:inline">Equipment</span>
              </TabsTrigger>
              <TabsTrigger value="other" className="text-xs sm:text-sm">
                <Receipt className="h-4 w-4 mr-1 sm:mr-2" />
                <span className="hidden sm:inline">Other</span>
              </TabsTrigger>
            </TabsList>

            {/* Material Tab */}
            <TabsContent value="material">
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-base">Material Expenses</CardTitle>
                      <CardDescription>Record material expenses as per GRN invoice amounts</CardDescription>
                    </div>
                    <Button size="sm" onClick={() => openMaterialDialog()}>
                      <Plus className="h-4 w-4 mr-1" />
                      Add
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  {loadingExpenses ? (
                    <div className="text-center py-8">
                      <Loader2 className="h-6 w-6 animate-spin mx-auto text-slate-400" />
                    </div>
                  ) : materialExpenses.length === 0 ? (
                    <div className="text-center py-8 text-slate-500">
                      <Package className="h-10 w-10 mx-auto text-slate-300 mb-2" />
                      <p>No material expenses recorded for this date</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {materialExpenses.map((expense) => (
                        <div key={expense.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <Badge variant="secondary" className="font-mono">
                                <IndianRupee className="h-3 w-3 mr-1" />
                                {expense.amount.toLocaleString('en-IN')}
                              </Badge>
                              {expense.invoice_reference && (
                                <span className="text-xs text-slate-500">Inv: {expense.invoice_reference}</span>
                              )}
                            </div>
                            {expense.notes && <p className="text-xs text-slate-500 mt-1">{expense.notes}</p>}
                          </div>
                          <div className="flex gap-1">
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openMaterialDialog(expense)}>
                              <Pencil className="h-3 w-3" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-red-600" onClick={() => deleteMaterialExpense(expense.id)}>
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Manpower Tab */}
            <TabsContent value="manpower">
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-base">Manpower Expenses</CardTitle>
                      <CardDescription>Record man-hours - amount is auto-calculated from master rates</CardDescription>
                    </div>
                    <Button size="sm" onClick={() => openManpowerDialog()}>
                      <Plus className="h-4 w-4 mr-1" />
                      Add
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  {loadingExpenses ? (
                    <div className="text-center py-8">
                      <Loader2 className="h-6 w-6 animate-spin mx-auto text-slate-400" />
                    </div>
                  ) : manpowerExpenses.length === 0 ? (
                    <div className="text-center py-8 text-slate-500">
                      <Users className="h-10 w-10 mx-auto text-slate-300 mb-2" />
                      <p>No manpower expenses recorded for this date</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {manpowerExpenses.map((expense) => (
                        <div key={expense.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                          <div className="flex-1">
                            <div className="font-medium text-sm">{expense.manpower_category}</div>
                            <div className="flex items-center gap-3 text-xs text-slate-500 mt-1">
                              <span>{expense.hours} hrs</span>
                              <span>@ {expense.rate.toLocaleString('en-IN', { style: 'currency', currency: 'INR' })}/hr</span>
                              <Badge variant="secondary" className="font-mono">
                                <IndianRupee className="h-3 w-3 mr-1" />
                                {expense.amount.toLocaleString('en-IN')}
                              </Badge>
                            </div>
                            {expense.notes && <p className="text-xs text-slate-500 mt-1">{expense.notes}</p>}
                          </div>
                          <div className="flex gap-1">
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openManpowerDialog(expense)}>
                              <Pencil className="h-3 w-3" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-red-600" onClick={() => deleteManpowerExpense(expense.id)}>
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Equipment Tab */}
            <TabsContent value="equipment">
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-base">Equipment Expenses</CardTitle>
                      <CardDescription>Record equipment hours - amount is auto-calculated from master rates</CardDescription>
                    </div>
                    <Button size="sm" onClick={() => openEquipmentDialog()}>
                      <Plus className="h-4 w-4 mr-1" />
                      Add
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  {loadingExpenses ? (
                    <div className="text-center py-8">
                      <Loader2 className="h-6 w-6 animate-spin mx-auto text-slate-400" />
                    </div>
                  ) : equipmentExpenses.length === 0 ? (
                    <div className="text-center py-8 text-slate-500">
                      <Truck className="h-10 w-10 mx-auto text-slate-300 mb-2" />
                      <p>No equipment expenses recorded for this date</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {equipmentExpenses.map((expense) => (
                        <div key={expense.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                          <div className="flex-1">
                            <div className="font-medium text-sm">{expense.equipment_name}</div>
                            <div className="flex items-center gap-3 text-xs text-slate-500 mt-1">
                              <span>{expense.hours} hrs</span>
                              <span>@ {expense.rate.toLocaleString('en-IN', { style: 'currency', currency: 'INR' })}/hr</span>
                              <Badge variant="secondary" className="font-mono">
                                <IndianRupee className="h-3 w-3 mr-1" />
                                {expense.amount.toLocaleString('en-IN')}
                              </Badge>
                            </div>
                            {expense.notes && <p className="text-xs text-slate-500 mt-1">{expense.notes}</p>}
                          </div>
                          <div className="flex gap-1">
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEquipmentDialog(expense)}>
                              <Pencil className="h-3 w-3" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-red-600" onClick={() => deleteEquipmentExpense(expense.id)}>
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Other Tab */}
            <TabsContent value="other">
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-base">Other Expenses</CardTitle>
                      <CardDescription>Record miscellaneous/operational expenses</CardDescription>
                    </div>
                    <Button size="sm" onClick={() => openOtherDialog()}>
                      <Plus className="h-4 w-4 mr-1" />
                      Add
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  {loadingExpenses ? (
                    <div className="text-center py-8">
                      <Loader2 className="h-6 w-6 animate-spin mx-auto text-slate-400" />
                    </div>
                  ) : otherExpenses.length === 0 ? (
                    <div className="text-center py-8 text-slate-500">
                      <Receipt className="h-10 w-10 mx-auto text-slate-300 mb-2" />
                      <p>No other expenses recorded for this date</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {otherExpenses.map((expense) => (
                        <div key={expense.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                          <div className="flex-1">
                            <div className="font-medium text-sm">{expense.description}</div>
                            <div className="flex items-center gap-2 mt-1">
                              <Badge variant="secondary" className="font-mono">
                                <IndianRupee className="h-3 w-3 mr-1" />
                                {expense.amount.toLocaleString('en-IN')}
                              </Badge>
                            </div>
                            {expense.notes && <p className="text-xs text-slate-500 mt-1">{expense.notes}</p>}
                          </div>
                          <div className="flex gap-1">
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openOtherDialog(expense)}>
                              <Pencil className="h-3 w-3" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-red-600" onClick={() => deleteOtherExpense(expense.id)}>
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        )}
      </div>

      {/* Material Dialog */}
      <Dialog open={materialDialogOpen} onOpenChange={setMaterialDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingMaterial ? 'Edit Material Expense' : 'Add Material Expense'}</DialogTitle>
            <DialogDescription>Enter the invoice amount for material expenses</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="material_amount">Amount (INR) *</Label>
              <div className="relative">
                <IndianRupee className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                  id="material_amount"
                  type="number"
                  step="0.01"
                  min="0"
                  value={materialForm.amount || ''}
                  onChange={(e) => setMaterialForm({ ...materialForm, amount: parseFloat(e.target.value) || 0 })}
                  className="pl-10"
                  placeholder="0.00"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="invoice_ref">Invoice Reference</Label>
              <Input
                id="invoice_ref"
                value={materialForm.invoice_reference}
                onChange={(e) => setMaterialForm({ ...materialForm, invoice_reference: e.target.value })}
                placeholder="e.g., INV-001"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="material_notes">Notes</Label>
              <Textarea
                id="material_notes"
                value={materialForm.notes}
                onChange={(e) => setMaterialForm({ ...materialForm, notes: e.target.value })}
                placeholder="Additional details..."
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMaterialDialogOpen(false)}>Cancel</Button>
            <Button onClick={saveMaterialExpense} disabled={saving}>
              {saving ? 'Saving...' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Manpower Dialog */}
      <Dialog open={manpowerDialogOpen} onOpenChange={setManpowerDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingManpower ? 'Edit Manpower Expense' : 'Add Manpower Expense'}</DialogTitle>
            <DialogDescription>Select category and enter hours worked</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Manpower Category *</Label>
              <Select
                value={manpowerForm.manpower_id}
                onValueChange={(value) => setManpowerForm({ ...manpowerForm, manpower_id: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  {manpowerList.map((mp) => (
                    <SelectItem key={mp.id} value={mp.id}>
                      {mp.category} - {mp.hourly_rate.toLocaleString('en-IN', { style: 'currency', currency: 'INR' })}/hr
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="manpower_hours">Hours Worked *</Label>
              <Input
                id="manpower_hours"
                type="number"
                step="0.5"
                min="0"
                value={manpowerForm.hours || ''}
                onChange={(e) => setManpowerForm({ ...manpowerForm, hours: parseFloat(e.target.value) || 0 })}
                placeholder="0"
              />
            </div>
            {manpowerForm.manpower_id && manpowerForm.hours > 0 && (
              <div className="p-3 bg-green-50 rounded-lg border border-green-200">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-green-700">Calculated Amount:</span>
                  <span className="font-bold text-green-800">
                    {(manpowerForm.hours * getManpowerRate(manpowerForm.manpower_id)).toLocaleString('en-IN', { style: 'currency', currency: 'INR' })}
                  </span>
                </div>
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="manpower_notes">Notes</Label>
              <Textarea
                id="manpower_notes"
                value={manpowerForm.notes}
                onChange={(e) => setManpowerForm({ ...manpowerForm, notes: e.target.value })}
                placeholder="Additional details..."
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setManpowerDialogOpen(false)}>Cancel</Button>
            <Button onClick={saveManpowerExpense} disabled={saving}>
              {saving ? 'Saving...' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Equipment Dialog */}
      <Dialog open={equipmentDialogOpen} onOpenChange={setEquipmentDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingEquipment ? 'Edit Equipment Expense' : 'Add Equipment Expense'}</DialogTitle>
            <DialogDescription>Select equipment and enter hours used</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Equipment *</Label>
              <Select
                value={equipmentForm.equipment_id}
                onValueChange={(value) => setEquipmentForm({ ...equipmentForm, equipment_id: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select equipment" />
                </SelectTrigger>
                <SelectContent>
                  {equipmentList.map((eq) => (
                    <SelectItem key={eq.id} value={eq.id}>
                      {eq.name} - {eq.hourly_rate.toLocaleString('en-IN', { style: 'currency', currency: 'INR' })}/hr
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="equipment_hours">Hours Used *</Label>
              <Input
                id="equipment_hours"
                type="number"
                step="0.5"
                min="0"
                value={equipmentForm.hours || ''}
                onChange={(e) => setEquipmentForm({ ...equipmentForm, hours: parseFloat(e.target.value) || 0 })}
                placeholder="0"
              />
            </div>
            {equipmentForm.equipment_id && equipmentForm.hours > 0 && (
              <div className="p-3 bg-orange-50 rounded-lg border border-orange-200">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-orange-700">Calculated Amount:</span>
                  <span className="font-bold text-orange-800">
                    {(equipmentForm.hours * getEquipmentRate(equipmentForm.equipment_id)).toLocaleString('en-IN', { style: 'currency', currency: 'INR' })}
                  </span>
                </div>
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="equipment_notes">Notes</Label>
              <Textarea
                id="equipment_notes"
                value={equipmentForm.notes}
                onChange={(e) => setEquipmentForm({ ...equipmentForm, notes: e.target.value })}
                placeholder="Additional details..."
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEquipmentDialogOpen(false)}>Cancel</Button>
            <Button onClick={saveEquipmentExpense} disabled={saving}>
              {saving ? 'Saving...' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Other Expense Dialog */}
      <Dialog open={otherDialogOpen} onOpenChange={setOtherDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingOther ? 'Edit Other Expense' : 'Add Other Expense'}</DialogTitle>
            <DialogDescription>Enter miscellaneous/operational expenses</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="other_desc">Description *</Label>
              <Input
                id="other_desc"
                value={otherForm.description}
                onChange={(e) => setOtherForm({ ...otherForm, description: e.target.value })}
                placeholder="e.g., Site electricity, Water supply"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="other_amount">Amount (INR) *</Label>
              <div className="relative">
                <IndianRupee className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                  id="other_amount"
                  type="number"
                  step="0.01"
                  min="0"
                  value={otherForm.amount || ''}
                  onChange={(e) => setOtherForm({ ...otherForm, amount: parseFloat(e.target.value) || 0 })}
                  className="pl-10"
                  placeholder="0.00"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="other_notes">Remarks/Notes</Label>
              <Textarea
                id="other_notes"
                value={otherForm.notes}
                onChange={(e) => setOtherForm({ ...otherForm, notes: e.target.value })}
                placeholder="Additional details about this expense..."
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOtherDialogOpen(false)}>Cancel</Button>
            <Button onClick={saveOtherExpense} disabled={saving}>
              {saving ? 'Saving...' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
