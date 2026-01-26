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
  Clock,
  Download,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'
import * as XLSX from 'xlsx'

interface Site {
  id: string
  name: string
}

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
  contractor_name: string | null
  category: string
  description: string | null
  gender: 'male' | 'female' | 'any'
  rate: number
  daily_hours: number
  labour_contractor?: { id: string; name: string } | null
  manpower_category?: { id: string; name: string } | null
}

interface Equipment {
  id: string
  name: string
  hourly_rate: number
}

interface GRNInvoice {
  id: string
  invoice_number: string
  grn_date: string
  supplier: {
    id: string
    supplier_name: string
  }
  grn_line_items: {
    id: string
    material_name: string
    quantity: number
    unit: string
    amount_without_gst: number
    amount_with_gst: number
  }[]
}

interface ManpowerExpense {
  id: string
  expense_date: string
  manpower_id: string
  manpower_category: string
  contractor_name: string | null
  gender: string | null
  num_persons: number
  start_time: string | null
  end_time: string | null
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
  const [contractors, setContractors] = useState<LabourContractor[]>([])
  const [manpowerCategories, setManpowerCategories] = useState<ManpowerCategory[]>([])
  const [manpowerList, setManpowerList] = useState<Manpower[]>([])
  const [equipmentList, setEquipmentList] = useState<Equipment[]>([])

  // Expenses
  const [grnInvoices, setGrnInvoices] = useState<GRNInvoice[]>([])
  const [manpowerExpenses, setManpowerExpenses] = useState<ManpowerExpense[]>([])
  const [equipmentExpenses, setEquipmentExpenses] = useState<EquipmentExpense[]>([])
  const [otherExpenses, setOtherExpenses] = useState<OtherExpense[]>([])

  // Dialog states
  const [manpowerDialogOpen, setManpowerDialogOpen] = useState(false)
  const [equipmentDialogOpen, setEquipmentDialogOpen] = useState(false)
  const [otherDialogOpen, setOtherDialogOpen] = useState(false)

  // Editing states
  const [editingManpower, setEditingManpower] = useState<ManpowerExpense | null>(null)
  const [editingEquipment, setEditingEquipment] = useState<EquipmentExpense | null>(null)
  const [editingOther, setEditingOther] = useState<OtherExpense | null>(null)

  // Form states
  const [manpowerForm, setManpowerForm] = useState({
    contractor_id: '',
    category_id: '',
    gender: '',
    manpower_id: '',
    num_persons: 1,
    start_time: '08:00',
    end_time: '17:00',
    notes: ''
  })
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

      // Fetch labour contractors
      const { data: contractorsData, error: contractorsError } = await supabase
        .from('master_labour_contractors')
        .select('id, name')
        .eq('is_active', true)
        .order('name')

      if (contractorsError) throw contractorsError
      setContractors(contractorsData || [])

      // Fetch manpower categories
      const { data: categoriesData, error: categoriesError } = await supabase
        .from('master_manpower_categories')
        .select('id, name')
        .eq('is_active', true)
        .order('name')

      if (categoriesError) throw categoriesError
      setManpowerCategories(categoriesData || [])

      // Fetch manpower rates with joins
      const { data: manpowerData, error: manpowerError } = await supabase
        .from('master_manpower')
        .select(`
          *,
          labour_contractor:master_labour_contractors(id, name),
          manpower_category:master_manpower_categories(id, name)
        `)
        .eq('is_active', true)
        .order('created_at', { ascending: false })

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
      // Fetch GRN invoices for material expenses (from Material GRN module)
      const grnRes = await supabase
        .from('grn_invoices')
        .select(`
          id,
          invoice_number,
          grn_date,
          supplier:suppliers(id, supplier_name),
          grn_line_items(id, material_name, quantity, unit, amount_without_gst, amount_with_gst)
        `)
        .eq('site_id', selectedSiteId)
        .eq('grn_date', selectedDate)
        .order('created_at')

      // Fetch other expense types in parallel
      const [manpowerRes, equipmentRes, otherRes] = await Promise.all([
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

      setGrnInvoices(grnRes.data || [])
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

  // Calculate total material amount from GRN invoices
  function getTotalMaterialAmount(): number {
    return grnInvoices.reduce((total, invoice) => {
      const invoiceTotal = invoice.grn_line_items.reduce((sum, item) => sum + (item.amount_with_gst || 0), 0)
      return total + invoiceTotal
    }, 0)
  }

  // Manpower expense handlers
  function openManpowerDialog(expense?: ManpowerExpense) {
    if (expense) {
      setEditingManpower(expense)
      // Find the manpower entry to get contractor/category/gender
      const mp = manpowerList.find(m => m.id === expense.manpower_id)
      setManpowerForm({
        contractor_id: mp?.contractor_id || '',
        category_id: mp?.category_id || '',
        gender: expense.gender || mp?.gender || '',
        manpower_id: expense.manpower_id,
        num_persons: expense.num_persons || 1,
        start_time: expense.start_time || '08:00',
        end_time: expense.end_time || '17:00',
        notes: expense.notes || '',
      })
    } else {
      setEditingManpower(null)
      setManpowerForm({
        contractor_id: '',
        category_id: '',
        gender: '',
        manpower_id: '',
        num_persons: 1,
        start_time: '08:00',
        end_time: '17:00',
        notes: ''
      })
    }
    setManpowerDialogOpen(true)
  }

  // Get categories available for selected contractor
  function getCategoriesForContractor(contractorId: string): ManpowerCategory[] {
    const categoryIds = manpowerList
      .filter(m => m.contractor_id === contractorId)
      .map(m => m.category_id)
      .filter((id): id is string => id !== null)
    const uniqueIds = [...new Set(categoryIds)]
    return manpowerCategories.filter(c => uniqueIds.includes(c.id))
  }

  // Get genders available for selected contractor and category
  function getGendersForContractorAndCategory(contractorId: string, categoryId: string): { gender: string; label: string }[] {
    const filtered = manpowerList.filter(m =>
      m.contractor_id === contractorId && m.category_id === categoryId
    )
    const genders = filtered.map(m => m.gender)
    const uniqueGenders = [...new Set(genders)]
    return uniqueGenders.map(g => ({
      gender: g,
      label: g === 'male' ? 'Male' : g === 'female' ? 'Female' : 'Any'
    }))
  }

  // Find matching manpower entry based on contractor, category, gender
  function findManpowerEntry(contractorId: string, categoryId: string, gender: string): Manpower | undefined {
    return manpowerList.find(m =>
      m.contractor_id === contractorId &&
      m.category_id === categoryId &&
      m.gender === gender
    )
  }

  // Calculate total hours from start and end time
  function calculateHours(startTime: string, endTime: string): number {
    if (!startTime || !endTime) return 0
    const [startH, startM] = startTime.split(':').map(Number)
    const [endH, endM] = endTime.split(':').map(Number)
    const startMinutes = startH * 60 + startM
    const endMinutes = endH * 60 + endM
    const diffMinutes = endMinutes - startMinutes
    return Math.max(0, diffMinutes / 60)
  }

  function getManpowerCategory(manpowerId: string): string {
    const mp = manpowerList.find(m => m.id === manpowerId)
    return mp?.manpower_category?.name || mp?.category || ''
  }

  // Export to Excel function
  function exportToExcel() {
    const siteName = sites.find(s => s.id === selectedSiteId)?.name || 'Unknown Site'
    const formattedDate = new Date(selectedDate).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    })

    // Create workbook
    const wb = XLSX.utils.book_new()

    // ============ SUMMARY SHEET ============
    const summaryData = [
      ['DAILY EXPENSE REPORT'],
      [],
      ['Site:', siteName],
      ['Date:', formattedDate],
      ['Generated:', new Date().toLocaleString('en-IN')],
      [],
      ['EXPENSE SUMMARY'],
      [],
      ['Category', 'Amount (INR)'],
      ['Material (from GRN)', materialTotal],
      ['Manpower', manpowerTotal],
      ['Equipment', equipmentTotal],
      ['Other', otherTotal],
      [],
      ['GRAND TOTAL', grandTotal],
    ]
    const summaryWs = XLSX.utils.aoa_to_sheet(summaryData)
    summaryWs['!cols'] = [{ wch: 25 }, { wch: 20 }]
    XLSX.utils.book_append_sheet(wb, summaryWs, 'Summary')

    // ============ MATERIAL SHEET (from GRN) ============
    const materialRows: any[][] = [
      ['MATERIAL EXPENSES (FROM GRN)'],
      [],
      ['Invoice No', 'Supplier', 'Material', 'Quantity', 'Unit', 'Amount (Excl GST)', 'Amount (Incl GST)'],
    ]

    grnInvoices.forEach(invoice => {
      invoice.grn_line_items.forEach((item, idx) => {
        materialRows.push([
          idx === 0 ? invoice.invoice_number : '',
          idx === 0 ? (invoice.supplier?.supplier_name || '') : '',
          item.material_name,
          item.quantity,
          item.unit,
          item.amount_without_gst,
          item.amount_with_gst,
        ])
      })
    })

    if (grnInvoices.length > 0) {
      materialRows.push([])
      materialRows.push(['', '', '', '', 'TOTAL',
        grnInvoices.reduce((sum, inv) => sum + inv.grn_line_items.reduce((s, i) => s + (i.amount_without_gst || 0), 0), 0),
        materialTotal
      ])
    }

    const materialWs = XLSX.utils.aoa_to_sheet(materialRows)
    materialWs['!cols'] = [{ wch: 15 }, { wch: 20 }, { wch: 25 }, { wch: 10 }, { wch: 8 }, { wch: 15 }, { wch: 15 }]
    XLSX.utils.book_append_sheet(wb, materialWs, 'Material')

    // ============ MANPOWER SHEET ============
    const manpowerRows: any[][] = [
      ['MANPOWER EXPENSES'],
      [],
      ['Contractor', 'Category', 'Gender', 'Persons', 'Start Time', 'End Time', 'Hours', 'Rate/Hr', 'Amount', 'Remarks'],
    ]

    manpowerExpenses.forEach(exp => {
      manpowerRows.push([
        exp.contractor_name || '-',
        exp.manpower_category,
        exp.gender || '-',
        exp.num_persons || 1,
        exp.start_time || '-',
        exp.end_time || '-',
        exp.hours,
        exp.rate,
        exp.amount,
        exp.notes || '',
      ])
    })

    if (manpowerExpenses.length > 0) {
      manpowerRows.push([])
      manpowerRows.push(['', '', '', '', '', '', '', 'TOTAL', manpowerTotal, ''])
    }

    const manpowerWs = XLSX.utils.aoa_to_sheet(manpowerRows)
    manpowerWs['!cols'] = [{ wch: 18 }, { wch: 15 }, { wch: 8 }, { wch: 8 }, { wch: 10 }, { wch: 10 }, { wch: 8 }, { wch: 10 }, { wch: 12 }, { wch: 25 }]
    XLSX.utils.book_append_sheet(wb, manpowerWs, 'Manpower')

    // ============ EQUIPMENT SHEET ============
    const equipmentRows: any[][] = [
      ['EQUIPMENT EXPENSES'],
      [],
      ['Equipment', 'Hours', 'Rate/Hr', 'Amount', 'Notes'],
    ]

    equipmentExpenses.forEach(exp => {
      equipmentRows.push([
        exp.equipment_name,
        exp.hours,
        exp.rate,
        exp.amount,
        exp.notes || '',
      ])
    })

    if (equipmentExpenses.length > 0) {
      equipmentRows.push([])
      equipmentRows.push(['', '', 'TOTAL', equipmentTotal, ''])
    }

    const equipmentWs = XLSX.utils.aoa_to_sheet(equipmentRows)
    equipmentWs['!cols'] = [{ wch: 25 }, { wch: 10 }, { wch: 12 }, { wch: 12 }, { wch: 30 }]
    XLSX.utils.book_append_sheet(wb, equipmentWs, 'Equipment')

    // ============ OTHER EXPENSES SHEET ============
    const otherRows: any[][] = [
      ['OTHER EXPENSES'],
      [],
      ['Description', 'Amount', 'Notes'],
    ]

    otherExpenses.forEach(exp => {
      otherRows.push([
        exp.description,
        exp.amount,
        exp.notes || '',
      ])
    })

    if (otherExpenses.length > 0) {
      otherRows.push([])
      otherRows.push(['TOTAL', otherTotal, ''])
    }

    const otherWs = XLSX.utils.aoa_to_sheet(otherRows)
    otherWs['!cols'] = [{ wch: 35 }, { wch: 15 }, { wch: 30 }]
    XLSX.utils.book_append_sheet(wb, otherWs, 'Other')

    // Generate filename and download
    const dateStr = selectedDate.replace(/-/g, '')
    const siteNameClean = siteName.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 20)
    const filename = `Expenses_${siteNameClean}_${dateStr}.xlsx`

    XLSX.writeFile(wb, filename)
    toast.success('Expense report exported successfully')
  }

  async function saveManpowerExpense() {
    // Find the manpower entry based on selections
    const mpEntry = findManpowerEntry(manpowerForm.contractor_id, manpowerForm.category_id, manpowerForm.gender)

    if (!mpEntry) {
      toast.error('Please select contractor, category, and gender')
      return
    }
    if (manpowerForm.num_persons <= 0) {
      toast.error('Number of persons must be at least 1')
      return
    }
    if (!manpowerForm.start_time || !manpowerForm.end_time) {
      toast.error('Please select start and end time')
      return
    }

    const hours = calculateHours(manpowerForm.start_time, manpowerForm.end_time)
    if (hours <= 0) {
      toast.error('End time must be after start time')
      return
    }

    const hourlyRate = mpEntry.rate / (mpEntry.daily_hours || 8)
    const amount = hourlyRate * hours * manpowerForm.num_persons

    // Get names for denormalized storage
    const contractorName = mpEntry.labour_contractor?.name || mpEntry.contractor_name
    const categoryName = mpEntry.manpower_category?.name || mpEntry.category

    setSaving(true)
    try {
      if (editingManpower) {
        const { error } = await supabase
          .from('expense_manpower')
          .update({
            manpower_id: mpEntry.id,
            manpower_category: categoryName,
            contractor_name: contractorName || null,
            gender: mpEntry.gender,
            num_persons: manpowerForm.num_persons,
            start_time: manpowerForm.start_time,
            end_time: manpowerForm.end_time,
            hours: hours,
            rate: hourlyRate,
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
            manpower_id: mpEntry.id,
            manpower_category: categoryName,
            contractor_name: contractorName || null,
            gender: mpEntry.gender,
            num_persons: manpowerForm.num_persons,
            start_time: manpowerForm.start_time,
            end_time: manpowerForm.end_time,
            hours: hours,
            rate: hourlyRate,
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
  const materialTotal = getTotalMaterialAmount()
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
              <div className="flex items-end">
                <Button
                  variant="outline"
                  onClick={exportToExcel}
                  disabled={!selectedSiteId || loadingExpenses}
                  className="w-full sm:w-auto"
                >
                  <Download className="h-4 w-4 mr-2" />
                  Export
                </Button>
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
                  <div>
                    <CardTitle className="text-base">Material Expenses (from GRN)</CardTitle>
                    <CardDescription>Auto-fetched from Material GRN module for this date</CardDescription>
                  </div>
                </CardHeader>
                <CardContent>
                  {loadingExpenses ? (
                    <div className="text-center py-8">
                      <Loader2 className="h-6 w-6 animate-spin mx-auto text-slate-400" />
                    </div>
                  ) : grnInvoices.length === 0 ? (
                    <div className="text-center py-8 text-slate-500">
                      <Package className="h-10 w-10 mx-auto text-slate-300 mb-2" />
                      <p>No GRN invoices recorded for this date</p>
                      <p className="text-xs mt-1">Add GRN entries in Material GRN module</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {grnInvoices.map((invoice) => {
                        const invoiceTotal = invoice.grn_line_items.reduce(
                          (sum, item) => sum + (item.amount_with_gst || 0), 0
                        )
                        const invoiceTotalExclGst = invoice.grn_line_items.reduce(
                          (sum, item) => sum + (item.amount_without_gst || 0), 0
                        )
                        return (
                          <div key={invoice.id} className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                            <div className="flex items-start justify-between mb-2">
                              <div>
                                <div className="flex items-center gap-2">
                                  <span className="font-medium text-sm">{invoice.invoice_number}</span>
                                  <Badge variant="outline" className="text-xs">
                                    {invoice.supplier?.supplier_name || 'Unknown Supplier'}
                                  </Badge>
                                </div>
                              </div>
                              <Badge variant="secondary" className="font-mono">
                                <IndianRupee className="h-3 w-3 mr-1" />
                                {invoiceTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                              </Badge>
                            </div>
                            <div className="space-y-1">
                              {invoice.grn_line_items.map((item) => (
                                <div key={item.id} className="flex items-center justify-between text-xs text-slate-600 pl-2 border-l-2 border-slate-300">
                                  <span>{item.material_name} ({item.quantity} {item.unit})</span>
                                  <span className="font-mono">₹{item.amount_with_gst?.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                                </div>
                              ))}
                            </div>
                            <div className="mt-2 pt-2 border-t border-slate-200 flex justify-between text-xs text-slate-500">
                              <span>Excl. GST: ₹{invoiceTotalExclGst.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                              <span>GST: ₹{(invoiceTotal - invoiceTotalExclGst).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                            </div>
                          </div>
                        )
                      })}
                      {/* Total Summary */}
                      <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
                        <div className="flex items-center justify-between">
                          <span className="font-medium text-blue-700">Total Material Expenses ({grnInvoices.length} invoice{grnInvoices.length !== 1 ? 's' : ''})</span>
                          <Badge className="bg-blue-600 font-mono text-sm">
                            <IndianRupee className="h-3 w-3 mr-1" />
                            {getTotalMaterialAmount().toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                          </Badge>
                        </div>
                      </div>
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
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-sm">{expense.manpower_category}</span>
                              {expense.contractor_name && (
                                <span className="text-xs text-slate-500">({expense.contractor_name})</span>
                              )}
                              {expense.gender && expense.gender !== 'any' && (
                                <Badge variant="outline" className="text-xs">
                                  {expense.gender === 'male' ? 'M' : 'F'}
                                </Badge>
                              )}
                            </div>
                            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 mt-1">
                              <span>{expense.num_persons || 1} person{(expense.num_persons || 1) > 1 ? 's' : ''}</span>
                              {expense.start_time && expense.end_time && (
                                <span>({expense.start_time} - {expense.end_time})</span>
                              )}
                              <span>{expense.hours.toFixed(1)} hrs</span>
                              <span>@ {expense.rate.toLocaleString('en-IN', { style: 'currency', currency: 'INR' })}/hr</span>
                              <Badge variant="secondary" className="font-mono">
                                <IndianRupee className="h-3 w-3 mr-1" />
                                {expense.amount.toLocaleString('en-IN')}
                              </Badge>
                            </div>
                            {expense.notes && <p className="text-xs text-slate-500 mt-1 italic">{expense.notes}</p>}
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

      {/* Manpower Dialog */}
      <Dialog open={manpowerDialogOpen} onOpenChange={setManpowerDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingManpower ? 'Edit Manpower Expense' : 'Add Manpower Expense'}</DialogTitle>
            <DialogDescription>Select manpower details and working hours</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {/* Contractor Selection */}
            <div className="space-y-2">
              <Label>Contractor *</Label>
              <Select
                value={manpowerForm.contractor_id}
                onValueChange={(value) => setManpowerForm({
                  ...manpowerForm,
                  contractor_id: value,
                  category_id: '',
                  gender: '',
                  manpower_id: ''
                })}
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
                <p className="text-xs text-amber-600">No contractors found. Add contractors first in Master Data.</p>
              )}
            </div>

            {/* Category Selection - filtered by contractor */}
            <div className="space-y-2">
              <Label>Category *</Label>
              <Select
                value={manpowerForm.category_id}
                onValueChange={(value) => setManpowerForm({
                  ...manpowerForm,
                  category_id: value,
                  gender: '',
                  manpower_id: ''
                })}
                disabled={!manpowerForm.contractor_id}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  {getCategoriesForContractor(manpowerForm.contractor_id).map((category) => (
                    <SelectItem key={category.id} value={category.id}>
                      {category.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {manpowerForm.contractor_id && getCategoriesForContractor(manpowerForm.contractor_id).length === 0 && (
                <p className="text-xs text-amber-600">No categories with rates for this contractor. Add rates in Master Data.</p>
              )}
            </div>

            {/* Gender Selection - filtered by contractor and category */}
            <div className="space-y-2">
              <Label>Gender *</Label>
              <Select
                value={manpowerForm.gender}
                onValueChange={(value) => {
                  const mpEntry = findManpowerEntry(manpowerForm.contractor_id, manpowerForm.category_id, value)
                  setManpowerForm({
                    ...manpowerForm,
                    gender: value,
                    manpower_id: mpEntry?.id || ''
                  })
                }}
                disabled={!manpowerForm.category_id}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select gender" />
                </SelectTrigger>
                <SelectContent>
                  {getGendersForContractorAndCategory(manpowerForm.contractor_id, manpowerForm.category_id).map(({ gender, label }) => (
                    <SelectItem key={gender} value={gender}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Show selected manpower rate info */}
            {manpowerForm.manpower_id && (() => {
              const mp = manpowerList.find(m => m.id === manpowerForm.manpower_id)
              if (!mp) return null
              const hourlyRate = mp.rate / (mp.daily_hours || 8)
              return (
                <div className="p-2 bg-slate-100 rounded text-xs text-slate-600">
                  Daily Rate: {mp.rate.toLocaleString('en-IN', { style: 'currency', currency: 'INR' })} for {mp.daily_hours} hrs
                  (Hourly: {hourlyRate.toLocaleString('en-IN', { style: 'currency', currency: 'INR' })}/hr)
                </div>
              )
            })()}

            {/* Number of Persons */}
            <div className="space-y-2">
              <Label htmlFor="num_persons">Number of Persons *</Label>
              <Input
                id="num_persons"
                type="number"
                min="1"
                value={manpowerForm.num_persons || ''}
                onChange={(e) => setManpowerForm({ ...manpowerForm, num_persons: parseInt(e.target.value) || 1 })}
                placeholder="1"
              />
            </div>

            {/* Start and End Time */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="start_time">Start Time *</Label>
                <Input
                  id="start_time"
                  type="time"
                  value={manpowerForm.start_time}
                  onChange={(e) => setManpowerForm({ ...manpowerForm, start_time: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="end_time">End Time *</Label>
                <Input
                  id="end_time"
                  type="time"
                  value={manpowerForm.end_time}
                  onChange={(e) => setManpowerForm({ ...manpowerForm, end_time: e.target.value })}
                />
              </div>
            </div>

            {/* Calculated Amount Display */}
            {manpowerForm.manpower_id && manpowerForm.start_time && manpowerForm.end_time && (() => {
              const mp = manpowerList.find(m => m.id === manpowerForm.manpower_id)
              if (!mp) return null
              const hours = calculateHours(manpowerForm.start_time, manpowerForm.end_time)
              const hourlyRate = mp.rate / (mp.daily_hours || 8)
              const totalAmount = hourlyRate * hours * manpowerForm.num_persons
              if (hours <= 0) return null
              return (
                <div className="p-3 bg-green-50 rounded-lg border border-green-200">
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between text-slate-600">
                      <span>Total Hours:</span>
                      <span>{hours.toFixed(1)} hrs</span>
                    </div>
                    <div className="flex justify-between text-slate-600">
                      <span>Calculation:</span>
                      <span>{hourlyRate.toFixed(2)}/hr × {hours.toFixed(1)} hrs × {manpowerForm.num_persons} persons</span>
                    </div>
                    <div className="flex justify-between text-green-700 font-medium pt-1 border-t border-green-200">
                      <span>Total Amount:</span>
                      <span className="font-bold">
                        {totalAmount.toLocaleString('en-IN', { style: 'currency', currency: 'INR' })}
                      </span>
                    </div>
                  </div>
                </div>
              )
            })()}

            {/* Notes/Remarks */}
            <div className="space-y-2">
              <Label htmlFor="manpower_notes">Remarks / Worker Names</Label>
              <Textarea
                id="manpower_notes"
                value={manpowerForm.notes}
                onChange={(e) => setManpowerForm({ ...manpowerForm, notes: e.target.value })}
                placeholder="List names of workers or additional notes..."
                rows={3}
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
