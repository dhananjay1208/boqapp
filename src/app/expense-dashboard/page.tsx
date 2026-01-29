'use client'

import { useState, useEffect, useMemo } from 'react'
import { Header } from '@/components/layout/header'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Building2,
  Calendar,
  Package,
  Users,
  Truck,
  Receipt,
  TrendingUp,
  TrendingDown,
  Loader2,
  IndianRupee,
  BarChart3,
  PieChart as PieChartIcon,
  ArrowUpRight,
  ArrowDownRight,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
  BarChart,
  Bar,
  ComposedChart,
  Line,
  LabelList,
} from 'recharts'
import { format, subDays, startOfDay, eachDayOfInterval, parseISO, differenceInDays } from 'date-fns'
import { Input } from '@/components/ui/input'

interface Site {
  id: string
  name: string
}

interface DailyExpense {
  date: string
  material: number
  manpower: number
  equipment: number
  other: number
  total: number
}

interface CategoryTotal {
  name: string
  value: number
  color: string
  icon: React.ReactNode
}

const COLORS = {
  material: '#3b82f6',   // blue
  manpower: '#22c55e',   // green
  equipment: '#f97316',  // orange
  other: '#a855f7',      // purple
}

const DATE_RANGES = [
  { value: '7', label: 'Last 7 Days' },
  { value: '14', label: 'Last 14 Days' },
  { value: '30', label: 'Last 30 Days' },
  { value: '60', label: 'Last 60 Days' },
  { value: '90', label: 'Last 90 Days' },
  { value: 'custom', label: 'Custom Range' },
]

export default function ExpenseDashboardPage() {
  const [sites, setSites] = useState<Site[]>([])
  const [selectedSiteId, setSelectedSiteId] = useState<string>('')
  const [selectedSiteName, setSelectedSiteName] = useState<string>('')
  const [dateRange, setDateRange] = useState<string>('30')
  const [customFromDate, setCustomFromDate] = useState<string>(format(subDays(new Date(), 30), 'yyyy-MM-dd'))
  const [customToDate, setCustomToDate] = useState<string>(format(new Date(), 'yyyy-MM-dd'))
  const [loading, setLoading] = useState(true)
  const [loadingData, setLoadingData] = useState(false)

  // Raw expense data
  const [materialExpenses, setMaterialExpenses] = useState<any[]>([])
  const [manpowerExpenses, setManpowerExpenses] = useState<any[]>([])
  const [equipmentExpenses, setEquipmentExpenses] = useState<any[]>([])
  const [otherExpenses, setOtherExpenses] = useState<any[]>([])

  useEffect(() => {
    fetchSites()
  }, [])

  useEffect(() => {
    if (selectedSiteId) {
      // For custom range, only fetch when both dates are valid
      if (dateRange === 'custom') {
        if (customFromDate && customToDate) {
          fetchExpenseData()
        }
      } else {
        fetchExpenseData()
      }
    }
  }, [selectedSiteId, dateRange, customFromDate, customToDate])

  async function fetchSites() {
    try {
      const { data, error } = await supabase
        .from('sites')
        .select('id, name')
        .order('name')

      if (error) throw error
      setSites(data || [])

      if (data && data.length > 0) {
        setSelectedSiteId(data[0].id)
        setSelectedSiteName(data[0].name)
      }
    } catch (error) {
      console.error('Error fetching sites:', error)
      toast.error('Failed to load sites')
    } finally {
      setLoading(false)
    }
  }

  async function fetchExpenseData() {
    setLoadingData(true)
    let startDateStr: string
    let endDateStr: string

    if (dateRange === 'custom') {
      startDateStr = customFromDate
      endDateStr = customToDate
    } else {
      const endDate = new Date()
      const startDate = subDays(endDate, parseInt(dateRange))
      startDateStr = format(startDate, 'yyyy-MM-dd')
      endDateStr = format(endDate, 'yyyy-MM-dd')
    }

    try {
      // Fetch GRN invoices for material expenses (from Material GRN module)
      const [grnRes, manpowerRes, equipmentRes, otherRes] = await Promise.all([
        supabase
          .from('grn_invoices')
          .select(`
            id,
            grn_date,
            grn_line_items(amount_with_gst)
          `)
          .eq('site_id', selectedSiteId)
          .gte('grn_date', startDateStr)
          .lte('grn_date', endDateStr),
        supabase
          .from('expense_manpower')
          .select('expense_date, amount')
          .eq('site_id', selectedSiteId)
          .gte('expense_date', startDateStr)
          .lte('expense_date', endDateStr),
        supabase
          .from('expense_equipment')
          .select('expense_date, amount')
          .eq('site_id', selectedSiteId)
          .gte('expense_date', startDateStr)
          .lte('expense_date', endDateStr),
        supabase
          .from('expense_other')
          .select('expense_date, amount')
          .eq('site_id', selectedSiteId)
          .gte('expense_date', startDateStr)
          .lte('expense_date', endDateStr),
      ])

      // Transform GRN data to material expenses format
      // Each invoice becomes an expense entry with total amount from line items
      const materialData = (grnRes.data || []).map((invoice: any) => {
        const totalAmount = (invoice.grn_line_items || []).reduce(
          (sum: number, item: any) => sum + (item.amount_with_gst || 0),
          0
        )
        return {
          expense_date: invoice.grn_date,
          amount: totalAmount,
        }
      })

      setMaterialExpenses(materialData)
      setManpowerExpenses(manpowerRes.data || [])
      setEquipmentExpenses(equipmentRes.data || [])
      setOtherExpenses(otherRes.data || [])
    } catch (error) {
      console.error('Error fetching expense data:', error)
      toast.error('Failed to load expense data')
    } finally {
      setLoadingData(false)
    }
  }

  // Calculate daily data for charts
  const dailyData = useMemo(() => {
    let startDate: Date
    let endDate: Date

    if (dateRange === 'custom') {
      startDate = parseISO(customFromDate)
      endDate = parseISO(customToDate)
    } else {
      endDate = new Date()
      startDate = subDays(endDate, parseInt(dateRange))
    }

    const days = eachDayOfInterval({ start: startDate, end: endDate })

    const aggregated: { [key: string]: DailyExpense } = {}

    // Initialize all days with zero values
    days.forEach(day => {
      const dateStr = format(day, 'yyyy-MM-dd')
      aggregated[dateStr] = {
        date: dateStr,
        material: 0,
        manpower: 0,
        equipment: 0,
        other: 0,
        total: 0,
      }
    })

    // Aggregate material expenses
    materialExpenses.forEach(e => {
      if (aggregated[e.expense_date]) {
        aggregated[e.expense_date].material += parseFloat(e.amount) || 0
      }
    })

    // Aggregate manpower expenses
    manpowerExpenses.forEach(e => {
      if (aggregated[e.expense_date]) {
        aggregated[e.expense_date].manpower += parseFloat(e.amount) || 0
      }
    })

    // Aggregate equipment expenses
    equipmentExpenses.forEach(e => {
      if (aggregated[e.expense_date]) {
        aggregated[e.expense_date].equipment += parseFloat(e.amount) || 0
      }
    })

    // Aggregate other expenses
    otherExpenses.forEach(e => {
      if (aggregated[e.expense_date]) {
        aggregated[e.expense_date].other += parseFloat(e.amount) || 0
      }
    })

    // Calculate totals
    Object.values(aggregated).forEach(day => {
      day.total = day.material + day.manpower + day.equipment + day.other
    })

    return Object.values(aggregated).sort((a, b) => a.date.localeCompare(b.date))
  }, [materialExpenses, manpowerExpenses, equipmentExpenses, otherExpenses, dateRange, customFromDate, customToDate])

  // Calculate category totals
  const categoryTotals = useMemo(() => {
    const material = materialExpenses.reduce((sum, e) => sum + (parseFloat(e.amount) || 0), 0)
    const manpower = manpowerExpenses.reduce((sum, e) => sum + (parseFloat(e.amount) || 0), 0)
    const equipment = equipmentExpenses.reduce((sum, e) => sum + (parseFloat(e.amount) || 0), 0)
    const other = otherExpenses.reduce((sum, e) => sum + (parseFloat(e.amount) || 0), 0)

    return {
      material,
      manpower,
      equipment,
      other,
      total: material + manpower + equipment + other,
    }
  }, [materialExpenses, manpowerExpenses, equipmentExpenses, otherExpenses])

  // Pie chart data
  const pieData = useMemo(() => {
    return [
      { name: 'Material', value: categoryTotals.material, color: COLORS.material },
      { name: 'Manpower', value: categoryTotals.manpower, color: COLORS.manpower },
      { name: 'Equipment', value: categoryTotals.equipment, color: COLORS.equipment },
      { name: 'Other', value: categoryTotals.other, color: COLORS.other },
    ].filter(item => item.value > 0)
  }, [categoryTotals])

  // Last 7 days data for prominent bar chart
  const last7DaysData = useMemo(() => {
    const endDate = new Date()
    const startDate = subDays(endDate, 6) // Last 7 days including today
    const days = eachDayOfInterval({ start: startDate, end: endDate })

    return days.map(day => {
      const dateStr = format(day, 'yyyy-MM-dd')
      const dayData = dailyData.find(d => d.date === dateStr)
      return {
        date: dateStr,
        day: format(day, 'EEE'),
        dayDate: format(day, 'dd MMM'),
        total: dayData?.total || 0,
        material: dayData?.material || 0,
        manpower: dayData?.manpower || 0,
        equipment: dayData?.equipment || 0,
        other: dayData?.other || 0,
      }
    })
  }, [dailyData])

  // Calculate trend (compare last half vs first half)
  const trend = useMemo(() => {
    if (dailyData.length < 2) return { percentage: 0, isUp: true }

    const midPoint = Math.floor(dailyData.length / 2)
    const firstHalf = dailyData.slice(0, midPoint)
    const secondHalf = dailyData.slice(midPoint)

    const firstHalfTotal = firstHalf.reduce((sum, d) => sum + d.total, 0)
    const secondHalfTotal = secondHalf.reduce((sum, d) => sum + d.total, 0)

    if (firstHalfTotal === 0) return { percentage: 0, isUp: true }

    const change = ((secondHalfTotal - firstHalfTotal) / firstHalfTotal) * 100
    return {
      percentage: Math.abs(change).toFixed(1),
      isUp: change >= 0,
    }
  }, [dailyData])

  // Format currency
  const formatCurrency = (value: number) => {
    if (value >= 10000000) {
      return `₹${(value / 10000000).toFixed(2)} Cr`
    } else if (value >= 100000) {
      return `₹${(value / 100000).toFixed(2)} L`
    } else if (value >= 1000) {
      return `₹${(value / 1000).toFixed(1)} K`
    }
    return `₹${value.toLocaleString('en-IN')}`
  }

  // Custom tooltip for charts
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white p-3 border rounded-lg shadow-lg">
          <p className="font-medium text-sm mb-2">
            {format(parseISO(label), 'dd MMM yyyy')}
          </p>
          {payload.map((entry: any, index: number) => (
            <div key={index} className="flex items-center gap-2 text-xs">
              <div
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: entry.color }}
              />
              <span className="capitalize">{entry.dataKey}:</span>
              <span className="font-medium">
                {formatCurrency(entry.value)}
              </span>
            </div>
          ))}
        </div>
      )
    }
    return null
  }

  function handleSiteChange(siteId: string) {
    setSelectedSiteId(siteId)
    const site = sites.find(s => s.id === siteId)
    setSelectedSiteName(site?.name || '')
  }

  if (loading) {
    return (
      <div className="flex flex-col min-h-screen">
        <Header title="Expense Dashboard" />
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
    <div className="flex flex-col min-h-screen bg-slate-50">
      <Header title="Expense Dashboard" />

      <div className="flex-1 p-4 md:p-6 space-y-6">
        {/* Site and Date Range Selection */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
              <div className="flex flex-col sm:flex-row gap-4">
                <div>
                  <label className="text-xs text-slate-500 mb-1 block">Select Site</label>
                  <Select value={selectedSiteId} onValueChange={handleSiteChange}>
                    <SelectTrigger className="w-full sm:w-[250px]">
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
                <div>
                  <label className="text-xs text-slate-500 mb-1 block">Date Range</label>
                  <Select value={dateRange} onValueChange={setDateRange}>
                    <SelectTrigger className="w-full sm:w-[180px]">
                      <Calendar className="h-4 w-4 mr-2" />
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {DATE_RANGES.map((range) => (
                        <SelectItem key={range.value} value={range.value}>
                          {range.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {dateRange === 'custom' && (
                  <>
                    <div>
                      <label className="text-xs text-slate-500 mb-1 block">From</label>
                      <Input
                        type="date"
                        value={customFromDate}
                        onChange={(e) => setCustomFromDate(e.target.value)}
                        className="w-full sm:w-[160px]"
                        max={customToDate}
                      />
                    </div>
                    <div>
                      <label className="text-xs text-slate-500 mb-1 block">To</label>
                      <Input
                        type="date"
                        value={customToDate}
                        onChange={(e) => setCustomToDate(e.target.value)}
                        className="w-full sm:w-[160px]"
                        min={customFromDate}
                        max={format(new Date(), 'yyyy-MM-dd')}
                      />
                    </div>
                  </>
                )}
              </div>
              {selectedSiteName && (
                <div className="text-right">
                  <p className="text-sm text-slate-500">Viewing expenses for</p>
                  <p className="text-lg font-semibold text-slate-900">{selectedSiteName}</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {loadingData ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
          </div>
        ) : (
          <>
            {/* Summary Cards */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              {/* Total Expenses Card */}
              <Card className="col-span-2 md:col-span-1 bg-gradient-to-br from-slate-800 to-slate-900 text-white">
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-slate-300 text-sm">Total Expenses</span>
                    <div className={`flex items-center text-xs ${trend.isUp ? 'text-red-400' : 'text-green-400'}`}>
                      {trend.isUp ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                      {trend.percentage}%
                    </div>
                  </div>
                  <p className="text-2xl md:text-3xl font-bold">
                    {formatCurrency(categoryTotals.total)}
                  </p>
                  <p className="text-xs text-slate-400 mt-1">
                    {dateRange === 'custom'
                      ? `${format(parseISO(customFromDate), 'dd MMM')} - ${format(parseISO(customToDate), 'dd MMM yyyy')}`
                      : `Last ${dateRange} days`}
                  </p>
                </CardContent>
              </Card>

              {/* Material Card */}
              <Card className="border-l-4 border-l-blue-500">
                <CardContent className="pt-4 pb-4">
                  <div className="flex items-center gap-2 mb-1">
                    <div className="h-8 w-8 rounded-lg bg-blue-100 flex items-center justify-center">
                      <Package className="h-4 w-4 text-blue-600" />
                    </div>
                    <span className="text-xs text-slate-500">Material</span>
                  </div>
                  <p className="text-xl font-bold text-slate-900">
                    {formatCurrency(categoryTotals.material)}
                  </p>
                  <p className="text-xs text-slate-400">
                    {categoryTotals.total > 0
                      ? `${((categoryTotals.material / categoryTotals.total) * 100).toFixed(1)}% of total`
                      : '0% of total'}
                  </p>
                </CardContent>
              </Card>

              {/* Manpower Card */}
              <Card className="border-l-4 border-l-green-500">
                <CardContent className="pt-4 pb-4">
                  <div className="flex items-center gap-2 mb-1">
                    <div className="h-8 w-8 rounded-lg bg-green-100 flex items-center justify-center">
                      <Users className="h-4 w-4 text-green-600" />
                    </div>
                    <span className="text-xs text-slate-500">Manpower</span>
                  </div>
                  <p className="text-xl font-bold text-slate-900">
                    {formatCurrency(categoryTotals.manpower)}
                  </p>
                  <p className="text-xs text-slate-400">
                    {categoryTotals.total > 0
                      ? `${((categoryTotals.manpower / categoryTotals.total) * 100).toFixed(1)}% of total`
                      : '0% of total'}
                  </p>
                </CardContent>
              </Card>

              {/* Equipment Card */}
              <Card className="border-l-4 border-l-orange-500">
                <CardContent className="pt-4 pb-4">
                  <div className="flex items-center gap-2 mb-1">
                    <div className="h-8 w-8 rounded-lg bg-orange-100 flex items-center justify-center">
                      <Truck className="h-4 w-4 text-orange-600" />
                    </div>
                    <span className="text-xs text-slate-500">Equipment</span>
                  </div>
                  <p className="text-xl font-bold text-slate-900">
                    {formatCurrency(categoryTotals.equipment)}
                  </p>
                  <p className="text-xs text-slate-400">
                    {categoryTotals.total > 0
                      ? `${((categoryTotals.equipment / categoryTotals.total) * 100).toFixed(1)}% of total`
                      : '0% of total'}
                  </p>
                </CardContent>
              </Card>

              {/* Other Card */}
              <Card className="border-l-4 border-l-purple-500">
                <CardContent className="pt-4 pb-4">
                  <div className="flex items-center gap-2 mb-1">
                    <div className="h-8 w-8 rounded-lg bg-purple-100 flex items-center justify-center">
                      <Receipt className="h-4 w-4 text-purple-600" />
                    </div>
                    <span className="text-xs text-slate-500">Other</span>
                  </div>
                  <p className="text-xl font-bold text-slate-900">
                    {formatCurrency(categoryTotals.other)}
                  </p>
                  <p className="text-xs text-slate-400">
                    {categoryTotals.total > 0
                      ? `${((categoryTotals.other / categoryTotals.total) * 100).toFixed(1)}% of total`
                      : '0% of total'}
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Last 7 Days Bar Chart - Prominent */}
            <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-blue-900">
                  <BarChart3 className="h-5 w-5" />
                  Last 7 Days Expenses
                </CardTitle>
                <CardDescription className="text-blue-700">
                  Daily total expenses with amounts
                </CardDescription>
              </CardHeader>
              <CardContent>
                {last7DaysData.every(d => d.total === 0) ? (
                  <div className="h-[280px] flex items-center justify-center text-slate-500">
                    <div className="text-center">
                      <BarChart3 className="h-12 w-12 mx-auto text-slate-300 mb-2" />
                      <p>No expenses recorded in the last 7 days</p>
                    </div>
                  </div>
                ) : (
                  <div className="h-[280px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={last7DaysData} margin={{ top: 30, right: 20, left: 20, bottom: 5 }}>
                        <defs>
                          <linearGradient id="barGradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#3b82f6" stopOpacity={1}/>
                            <stop offset="100%" stopColor="#6366f1" stopOpacity={1}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#cbd5e1" vertical={false} />
                        <XAxis
                          dataKey="dayDate"
                          tick={{ fontSize: 12, fontWeight: 500 }}
                          stroke="#64748b"
                          axisLine={{ stroke: '#cbd5e1' }}
                        />
                        <YAxis
                          tickFormatter={(value) => formatCurrency(value)}
                          tick={{ fontSize: 11 }}
                          stroke="#64748b"
                          axisLine={{ stroke: '#cbd5e1' }}
                        />
                        <Tooltip
                          cursor={{ fill: 'rgba(59, 130, 246, 0.1)' }}
                          content={({ active, payload, label }) => {
                            if (active && payload && payload.length) {
                              const data = payload[0].payload
                              return (
                                <div className="bg-white p-4 border rounded-xl shadow-lg">
                                  <p className="font-bold text-slate-900 mb-2">{label}</p>
                                  <div className="space-y-1 text-sm">
                                    <div className="flex justify-between gap-4">
                                      <span className="text-blue-600">Material:</span>
                                      <span className="font-medium">{formatCurrency(data.material)}</span>
                                    </div>
                                    <div className="flex justify-between gap-4">
                                      <span className="text-green-600">Manpower:</span>
                                      <span className="font-medium">{formatCurrency(data.manpower)}</span>
                                    </div>
                                    <div className="flex justify-between gap-4">
                                      <span className="text-orange-600">Equipment:</span>
                                      <span className="font-medium">{formatCurrency(data.equipment)}</span>
                                    </div>
                                    <div className="flex justify-between gap-4">
                                      <span className="text-purple-600">Other:</span>
                                      <span className="font-medium">{formatCurrency(data.other)}</span>
                                    </div>
                                    <div className="border-t pt-1 mt-1 flex justify-between gap-4 font-bold">
                                      <span>Total:</span>
                                      <span>{formatCurrency(data.total)}</span>
                                    </div>
                                  </div>
                                </div>
                              )
                            }
                            return null
                          }}
                        />
                        <Bar
                          dataKey="total"
                          fill="url(#barGradient)"
                          radius={[8, 8, 0, 0]}
                          maxBarSize={80}
                        >
                          <LabelList
                            dataKey="total"
                            position="top"
                            formatter={(value) => Number(value) > 0 ? formatCurrency(Number(value)) : ''}
                            style={{
                              fontSize: '12px',
                              fontWeight: 'bold',
                              fill: '#1e40af',
                            }}
                          />
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
                {/* Summary below chart */}
                <div className="grid grid-cols-3 gap-4 mt-4 pt-4 border-t border-blue-200">
                  <div className="text-center">
                    <p className="text-xs text-blue-600 font-medium">7-Day Total</p>
                    <p className="text-xl font-bold text-blue-900">
                      {formatCurrency(last7DaysData.reduce((sum, d) => sum + d.total, 0))}
                    </p>
                  </div>
                  <div className="text-center">
                    <p className="text-xs text-blue-600 font-medium">Daily Average</p>
                    <p className="text-xl font-bold text-blue-900">
                      {formatCurrency(last7DaysData.reduce((sum, d) => sum + d.total, 0) / 7)}
                    </p>
                  </div>
                  <div className="text-center">
                    <p className="text-xs text-blue-600 font-medium">Peak Day</p>
                    <p className="text-xl font-bold text-blue-900">
                      {formatCurrency(Math.max(...last7DaysData.map(d => d.total)))}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Charts Row */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Expense Trend Chart */}
              <Card className="lg:col-span-2">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        <TrendingUp className="h-5 w-5" />
                        Expense Trend
                      </CardTitle>
                      <CardDescription>Daily expenses over the selected period</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {dailyData.every(d => d.total === 0) ? (
                    <div className="h-[300px] flex items-center justify-center text-slate-500">
                      <div className="text-center">
                        <BarChart3 className="h-12 w-12 mx-auto text-slate-300 mb-2" />
                        <p>No expense data for this period</p>
                      </div>
                    </div>
                  ) : (
                    <div className="h-[300px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={dailyData}>
                          <defs>
                            <linearGradient id="colorMaterial" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor={COLORS.material} stopOpacity={0.8}/>
                              <stop offset="95%" stopColor={COLORS.material} stopOpacity={0.1}/>
                            </linearGradient>
                            <linearGradient id="colorManpower" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor={COLORS.manpower} stopOpacity={0.8}/>
                              <stop offset="95%" stopColor={COLORS.manpower} stopOpacity={0.1}/>
                            </linearGradient>
                            <linearGradient id="colorEquipment" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor={COLORS.equipment} stopOpacity={0.8}/>
                              <stop offset="95%" stopColor={COLORS.equipment} stopOpacity={0.1}/>
                            </linearGradient>
                            <linearGradient id="colorOther" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor={COLORS.other} stopOpacity={0.8}/>
                              <stop offset="95%" stopColor={COLORS.other} stopOpacity={0.1}/>
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                          <XAxis
                            dataKey="date"
                            tickFormatter={(value) => format(parseISO(value), 'dd MMM')}
                            tick={{ fontSize: 11 }}
                            stroke="#94a3b8"
                          />
                          <YAxis
                            tickFormatter={(value) => formatCurrency(value)}
                            tick={{ fontSize: 11 }}
                            stroke="#94a3b8"
                          />
                          <Tooltip content={<CustomTooltip />} />
                          <Area
                            type="monotone"
                            dataKey="material"
                            stackId="1"
                            stroke={COLORS.material}
                            fill="url(#colorMaterial)"
                          />
                          <Area
                            type="monotone"
                            dataKey="manpower"
                            stackId="1"
                            stroke={COLORS.manpower}
                            fill="url(#colorManpower)"
                          />
                          <Area
                            type="monotone"
                            dataKey="equipment"
                            stackId="1"
                            stroke={COLORS.equipment}
                            fill="url(#colorEquipment)"
                          />
                          <Area
                            type="monotone"
                            dataKey="other"
                            stackId="1"
                            stroke={COLORS.other}
                            fill="url(#colorOther)"
                          />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                  {/* Legend */}
                  <div className="flex flex-wrap justify-center gap-4 mt-4">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS.material }} />
                      <span className="text-xs text-slate-600">Material</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS.manpower }} />
                      <span className="text-xs text-slate-600">Manpower</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS.equipment }} />
                      <span className="text-xs text-slate-600">Equipment</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS.other }} />
                      <span className="text-xs text-slate-600">Other</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Pie Chart */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <PieChartIcon className="h-5 w-5" />
                    Category Distribution
                  </CardTitle>
                  <CardDescription>Expense breakdown by category</CardDescription>
                </CardHeader>
                <CardContent>
                  {pieData.length === 0 ? (
                    <div className="h-[280px] flex items-center justify-center text-slate-500">
                      <div className="text-center">
                        <PieChartIcon className="h-12 w-12 mx-auto text-slate-300 mb-2" />
                        <p>No data available</p>
                      </div>
                    </div>
                  ) : (
                    <div className="h-[280px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={pieData}
                            cx="50%"
                            cy="50%"
                            innerRadius={60}
                            outerRadius={90}
                            paddingAngle={3}
                            dataKey="value"
                            label={({ percent }) => `${((percent || 0) * 100).toFixed(0)}%`}
                            labelLine={false}
                          >
                            {pieData.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={entry.color} />
                            ))}
                          </Pie>
                          <Tooltip
                            formatter={(value) => formatCurrency(Number(value) || 0)}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                  {/* Pie Legend */}
                  <div className="space-y-2 mt-2">
                    {pieData.map((item, index) => (
                      <div key={index} className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} />
                          <span className="text-slate-600">{item.name}</span>
                        </div>
                        <span className="font-medium">{formatCurrency(item.value)}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Daily Comparison Bar Chart */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="h-5 w-5" />
                  Daily Expense Comparison
                </CardTitle>
                <CardDescription>Compare daily total expenses across categories</CardDescription>
              </CardHeader>
              <CardContent>
                {dailyData.every(d => d.total === 0) ? (
                  <div className="h-[250px] flex items-center justify-center text-slate-500">
                    <div className="text-center">
                      <BarChart3 className="h-12 w-12 mx-auto text-slate-300 mb-2" />
                      <p>No expense data for this period</p>
                    </div>
                  </div>
                ) : (
                  <div className="h-[250px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <ComposedChart data={dailyData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                        <XAxis
                          dataKey="date"
                          tickFormatter={(value) => format(parseISO(value), 'dd')}
                          tick={{ fontSize: 10 }}
                          stroke="#94a3b8"
                        />
                        <YAxis
                          tickFormatter={(value) => formatCurrency(value)}
                          tick={{ fontSize: 10 }}
                          stroke="#94a3b8"
                        />
                        <Tooltip content={<CustomTooltip />} />
                        <Bar dataKey="material" stackId="a" fill={COLORS.material} />
                        <Bar dataKey="manpower" stackId="a" fill={COLORS.manpower} />
                        <Bar dataKey="equipment" stackId="a" fill={COLORS.equipment} />
                        <Bar dataKey="other" stackId="a" fill={COLORS.other} />
                        <Line
                          type="monotone"
                          dataKey="total"
                          stroke="#1e293b"
                          strokeWidth={2}
                          dot={false}
                        />
                      </ComposedChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Daily Statistics Table */}
            <Card>
              <CardHeader>
                <CardTitle>Daily Statistics</CardTitle>
                <CardDescription>Average and peak expenses</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="p-4 bg-slate-50 rounded-lg">
                    <p className="text-xs text-slate-500 mb-1">Average Daily Expense</p>
                    <p className="text-lg font-bold text-slate-900">
                      {formatCurrency(categoryTotals.total / (dateRange === 'custom'
                        ? Math.max(1, differenceInDays(parseISO(customToDate), parseISO(customFromDate)) + 1)
                        : parseInt(dateRange)))}
                    </p>
                  </div>
                  <div className="p-4 bg-slate-50 rounded-lg">
                    <p className="text-xs text-slate-500 mb-1">Peak Day Expense</p>
                    <p className="text-lg font-bold text-slate-900">
                      {formatCurrency(Math.max(...dailyData.map(d => d.total)))}
                    </p>
                  </div>
                  <div className="p-4 bg-slate-50 rounded-lg">
                    <p className="text-xs text-slate-500 mb-1">Days with Expenses</p>
                    <p className="text-lg font-bold text-slate-900">
                      {dailyData.filter(d => d.total > 0).length} days
                    </p>
                  </div>
                  <div className="p-4 bg-slate-50 rounded-lg">
                    <p className="text-xs text-slate-500 mb-1">Expense Trend</p>
                    <div className={`flex items-center gap-1 text-lg font-bold ${trend.isUp ? 'text-red-600' : 'text-green-600'}`}>
                      {trend.isUp ? <TrendingUp className="h-5 w-5" /> : <TrendingDown className="h-5 w-5" />}
                      {trend.percentage}%
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </div>
  )
}
