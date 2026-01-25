'use client'

import { useEffect, useState } from 'react'
import { Header } from '@/components/layout/header'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
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
  FileSpreadsheet,
  Package,
  ClipboardCheck,
  FileText,
  Wallet,
  Users,
  Truck,
  MoreHorizontal,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Upload,
  Ban,
  Loader2,
  Receipt,
  TrendingUp,
} from 'lucide-react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

interface Site {
  id: string
  name: string
}

interface ExpenseSummary {
  material: number
  manpower: number
  equipment: number
  other: number
  total: number
}

interface ComplianceSummary {
  total: number
  uploaded: number
  pending: number
  notApplicable: number
}

interface StatusBreakdown {
  not_applicable: number
  pending: number
  created?: number
  in_progress: number
  completed: number
  approved: number
  uploaded: number
}

interface PackageProgress {
  id: string
  name: string
  totalLineItems: number
  checklistStatus: StatusBreakdown
  jmrStatus: StatusBreakdown
}

export default function DashboardPage() {
  const [sites, setSites] = useState<Site[]>([])
  const [selectedSiteId, setSelectedSiteId] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [dataLoading, setDataLoading] = useState(false)

  // Dashboard data
  const [expenseSummary, setExpenseSummary] = useState<ExpenseSummary>({
    material: 0,
    manpower: 0,
    equipment: 0,
    other: 0,
    total: 0,
  })
  const [complianceSummary, setComplianceSummary] = useState<ComplianceSummary>({
    total: 0,
    uploaded: 0,
    pending: 0,
    notApplicable: 0,
  })
  const [packageProgress, setPackageProgress] = useState<PackageProgress[]>([])

  useEffect(() => {
    fetchSites()
  }, [])

  useEffect(() => {
    if (selectedSiteId) {
      fetchDashboardData()
    }
  }, [selectedSiteId])

  async function fetchSites() {
    try {
      const { data, error } = await supabase
        .from('sites')
        .select('id, name')
        .order('name')

      if (error) throw error
      setSites(data || [])

      // Auto-select first site
      if (data && data.length > 0) {
        setSelectedSiteId(data[0].id)
      }
    } catch (error) {
      console.error('Error fetching sites:', error)
    } finally {
      setLoading(false)
    }
  }

  async function fetchDashboardData() {
    if (!selectedSiteId) return

    setDataLoading(true)
    try {
      await Promise.all([
        fetchExpenseSummary(),
        fetchComplianceSummary(),
        fetchBOQProgress(),
      ])
    } catch (error) {
      console.error('Error fetching dashboard data:', error)
    } finally {
      setDataLoading(false)
    }
  }

  async function fetchExpenseSummary() {
    try {
      // Fetch all expense types in parallel
      const [materialRes, manpowerRes, equipmentRes, otherRes] = await Promise.all([
        supabase
          .from('expense_material')
          .select('amount')
          .eq('site_id', selectedSiteId),
        supabase
          .from('expense_manpower')
          .select('amount')
          .eq('site_id', selectedSiteId),
        supabase
          .from('expense_equipment')
          .select('amount')
          .eq('site_id', selectedSiteId),
        supabase
          .from('expense_other')
          .select('amount')
          .eq('site_id', selectedSiteId),
      ])

      const material = (materialRes.data || []).reduce((sum, e) => sum + (parseFloat(e.amount) || 0), 0)
      const manpower = (manpowerRes.data || []).reduce((sum, e) => sum + (parseFloat(e.amount) || 0), 0)
      const equipment = (equipmentRes.data || []).reduce((sum, e) => sum + (parseFloat(e.amount) || 0), 0)
      const other = (otherRes.data || []).reduce((sum, e) => sum + (parseFloat(e.amount) || 0), 0)

      setExpenseSummary({
        material,
        manpower,
        equipment,
        other,
        total: material + manpower + equipment + other,
      })
    } catch (error) {
      console.error('Error fetching expense summary:', error)
    }
  }

  async function fetchComplianceSummary() {
    try {
      let totalDocs = 0
      let uploadedDocs = 0
      let pendingDocs = 0
      let notApplicableDocs = 0

      // ============================================
      // 1. Get compliance from OLD tables (material_grn + grn_compliance_documents)
      // ============================================
      const { data: oldGrnData, error: oldGrnError } = await supabase
        .from('material_grn')
        .select('id')
        .eq('site_id', selectedSiteId)

      if (oldGrnError) {
        console.error('Error fetching old GRN data:', oldGrnError)
      }

      if (oldGrnData && oldGrnData.length > 0) {
        const oldGrnIds = oldGrnData.map(g => g.id)

        const { data: oldDocsData, error: oldDocsError } = await supabase
          .from('grn_compliance_documents')
          .select('is_applicable, is_uploaded')
          .in('grn_id', oldGrnIds)

        if (oldDocsError) {
          console.error('Error fetching old compliance docs:', oldDocsError)
        } else {
          const oldDocs = oldDocsData || []
          totalDocs += oldDocs.filter(d => d.is_applicable).length
          notApplicableDocs += oldDocs.filter(d => !d.is_applicable).length
          uploadedDocs += oldDocs.filter(d => d.is_applicable && d.is_uploaded).length
          pendingDocs += oldDocs.filter(d => d.is_applicable && !d.is_uploaded).length
        }
      }

      // ============================================
      // 2. Get compliance from NEW tables (grn_invoices, grn_invoice_dc, grn_line_items, grn_line_item_documents)
      // ============================================
      const { data: newInvoicesData, error: newInvoicesError } = await supabase
        .from('grn_invoices')
        .select('id')
        .eq('site_id', selectedSiteId)

      if (newInvoicesError) {
        console.error('Error fetching new invoices:', newInvoicesError)
      }

      if (newInvoicesData && newInvoicesData.length > 0) {
        const invoiceIds = newInvoicesData.map(inv => inv.id)

        // Get DC documents
        const { data: dcDocsData, error: dcDocsError } = await supabase
          .from('grn_invoice_dc')
          .select('is_applicable, is_uploaded')
          .in('grn_invoice_id', invoiceIds)

        if (dcDocsError) {
          console.error('Error fetching DC docs:', dcDocsError)
        } else {
          const dcDocs = dcDocsData || []
          totalDocs += dcDocs.filter(d => d.is_applicable).length
          notApplicableDocs += dcDocs.filter(d => !d.is_applicable).length
          uploadedDocs += dcDocs.filter(d => d.is_applicable && d.is_uploaded).length
          pendingDocs += dcDocs.filter(d => d.is_applicable && !d.is_uploaded).length
        }

        // Get line item documents
        const { data: lineItemsData, error: lineItemsError } = await supabase
          .from('grn_line_items')
          .select('id')
          .in('grn_invoice_id', invoiceIds)

        if (lineItemsError) {
          console.error('Error fetching line items:', lineItemsError)
        }

        if (lineItemsData && lineItemsData.length > 0) {
          const lineItemIds = lineItemsData.map(li => li.id)

          const { data: lineItemDocsData, error: lineItemDocsError } = await supabase
            .from('grn_line_item_documents')
            .select('is_applicable, is_uploaded')
            .in('grn_line_item_id', lineItemIds)

          if (lineItemDocsError) {
            console.error('Error fetching line item docs:', lineItemDocsError)
          } else {
            const lineItemDocs = lineItemDocsData || []
            totalDocs += lineItemDocs.filter(d => d.is_applicable).length
            notApplicableDocs += lineItemDocs.filter(d => !d.is_applicable).length
            uploadedDocs += lineItemDocs.filter(d => d.is_applicable && d.is_uploaded).length
            pendingDocs += lineItemDocs.filter(d => d.is_applicable && !d.is_uploaded).length
          }
        }
      }

      setComplianceSummary({
        total: totalDocs,
        uploaded: uploadedDocs,
        pending: pendingDocs,
        notApplicable: notApplicableDocs
      })
    } catch (error) {
      console.error('Error fetching compliance summary:', error)
    }
  }

  async function fetchBOQProgress() {
    try {
      // Get packages for this site
      const { data: packagesData, error: packagesError } = await supabase
        .from('packages')
        .select('id, name')
        .eq('site_id', selectedSiteId)
        .order('name')

      if (packagesError) throw packagesError

      if (!packagesData || packagesData.length === 0) {
        setPackageProgress([])
        return
      }

      const packageIds = packagesData.map(p => p.id)

      // Get headlines for these packages
      const { data: headlinesData, error: headlinesError } = await supabase
        .from('boq_headlines')
        .select('id, package_id')
        .in('package_id', packageIds)

      if (headlinesError) throw headlinesError

      if (!headlinesData || headlinesData.length === 0) {
        setPackageProgress(packagesData.map(p => ({
          id: p.id,
          name: p.name,
          totalLineItems: 0,
          checklistStatus: { not_applicable: 0, pending: 0, created: 0, in_progress: 0, completed: 0, approved: 0, uploaded: 0 },
          jmrStatus: { not_applicable: 0, pending: 0, in_progress: 0, completed: 0, approved: 0, uploaded: 0 },
        })))
        return
      }

      const headlineIds = headlinesData.map(h => h.id)

      // Get line items with their statuses
      const { data: lineItemsData, error: lineItemsError } = await supabase
        .from('boq_line_items')
        .select('id, headline_id, checklist_status, jmr_status')
        .in('headline_id', headlineIds)

      if (lineItemsError) throw lineItemsError

      // Build progress for each package
      const progress: PackageProgress[] = packagesData.map(pkg => {
        const pkgHeadlineIds = headlinesData
          .filter(h => h.package_id === pkg.id)
          .map(h => h.id)

        const pkgLineItems = (lineItemsData || []).filter(li =>
          pkgHeadlineIds.includes(li.headline_id)
        )

        const checklistStatus: StatusBreakdown = {
          not_applicable: 0,
          pending: 0,
          created: 0,
          in_progress: 0,
          completed: 0,
          approved: 0,
          uploaded: 0,
        }

        const jmrStatus: StatusBreakdown = {
          not_applicable: 0,
          pending: 0,
          in_progress: 0,
          completed: 0,
          approved: 0,
          uploaded: 0,
        }

        pkgLineItems.forEach(li => {
          const cs = li.checklist_status || 'pending'
          const js = li.jmr_status || 'pending'

          if (cs in checklistStatus) {
            checklistStatus[cs as keyof StatusBreakdown]++
          } else {
            checklistStatus.pending++
          }

          if (js in jmrStatus) {
            jmrStatus[js as keyof StatusBreakdown]++
          } else {
            jmrStatus.pending++
          }
        })

        return {
          id: pkg.id,
          name: pkg.name,
          totalLineItems: pkgLineItems.length,
          checklistStatus,
          jmrStatus,
        }
      })

      setPackageProgress(progress)
    } catch (error) {
      console.error('Error fetching BOQ progress:', error)
    }
  }

  function formatCurrency(amount: number) {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(amount)
  }

  function getApplicableCount(status: StatusBreakdown, includeCreated = false) {
    const base = status.pending + status.in_progress + status.completed + status.approved + status.uploaded
    return includeCreated && status.created ? base + status.created : base
  }

  if (loading) {
    return (
      <div className="flex flex-col min-h-screen">
        <Header title="Dashboard" />
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col min-h-screen">
      <Header title="Dashboard" />

      <div className="flex-1 p-4 md:p-6 space-y-6">
        {/* Site Selection Header */}
        <Card className="bg-gradient-to-r from-blue-600 to-blue-700">
          <CardContent className="py-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="text-white">
                <h2 className="text-xl font-bold">Site Dashboard</h2>
                <p className="text-blue-100 text-sm">View expenses, compliance and BOQ progress</p>
              </div>
              <Select value={selectedSiteId} onValueChange={setSelectedSiteId}>
                <SelectTrigger className="w-full sm:w-[250px] bg-white">
                  <Building2 className="h-4 w-4 mr-2 text-slate-500" />
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
          </CardContent>
        </Card>

        {!selectedSiteId ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Building2 className="h-12 w-12 mx-auto text-slate-300 mb-4" />
              <h3 className="text-lg font-medium text-slate-900 mb-2">Select a Site</h3>
              <p className="text-slate-500">Choose a site to view dashboard data</p>
            </CardContent>
          </Card>
        ) : dataLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
          </div>
        ) : (
          <>
            {/* Expense Dashboard Section */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  <Wallet className="h-5 w-5 text-green-600" />
                  Expense Dashboard
                </h3>
                <Link href="/expense-dashboard" className="text-sm text-blue-600 hover:underline">
                  View Details →
                </Link>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                <Card className="bg-blue-50 border-blue-200">
                  <CardContent className="pt-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Package className="h-4 w-4 text-blue-600" />
                      <span className="text-xs font-medium text-blue-700">Material</span>
                    </div>
                    <p className="text-lg font-bold text-blue-900">{formatCurrency(expenseSummary.material)}</p>
                  </CardContent>
                </Card>

                <Card className="bg-purple-50 border-purple-200">
                  <CardContent className="pt-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Users className="h-4 w-4 text-purple-600" />
                      <span className="text-xs font-medium text-purple-700">Manpower</span>
                    </div>
                    <p className="text-lg font-bold text-purple-900">{formatCurrency(expenseSummary.manpower)}</p>
                  </CardContent>
                </Card>

                <Card className="bg-orange-50 border-orange-200">
                  <CardContent className="pt-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Truck className="h-4 w-4 text-orange-600" />
                      <span className="text-xs font-medium text-orange-700">Equipment</span>
                    </div>
                    <p className="text-lg font-bold text-orange-900">{formatCurrency(expenseSummary.equipment)}</p>
                  </CardContent>
                </Card>

                <Card className="bg-slate-50 border-slate-200">
                  <CardContent className="pt-4">
                    <div className="flex items-center gap-2 mb-2">
                      <MoreHorizontal className="h-4 w-4 text-slate-600" />
                      <span className="text-xs font-medium text-slate-700">Other</span>
                    </div>
                    <p className="text-lg font-bold text-slate-900">{formatCurrency(expenseSummary.other)}</p>
                  </CardContent>
                </Card>

                <Card className="bg-green-50 border-green-200 col-span-2 md:col-span-1">
                  <CardContent className="pt-4">
                    <div className="flex items-center gap-2 mb-2">
                      <TrendingUp className="h-4 w-4 text-green-600" />
                      <span className="text-xs font-medium text-green-700">Total</span>
                    </div>
                    <p className="text-xl font-bold text-green-900">{formatCurrency(expenseSummary.total)}</p>
                  </CardContent>
                </Card>
              </div>
            </div>

            {/* Material Compliance Dashboard Section */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  <Receipt className="h-5 w-5 text-amber-600" />
                  Material Compliance
                </h3>
                <Link href="/material-grn" className="text-sm text-blue-600 hover:underline">
                  Manage GRN →
                </Link>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Card>
                  <CardContent className="pt-4">
                    <div className="flex items-center gap-2 mb-2">
                      <FileText className="h-4 w-4 text-slate-500" />
                      <span className="text-xs font-medium text-slate-600">Total Documents</span>
                    </div>
                    <p className="text-2xl font-bold text-slate-900">{complianceSummary.total}</p>
                  </CardContent>
                </Card>

                <Card className="bg-green-50 border-green-200">
                  <CardContent className="pt-4">
                    <div className="flex items-center gap-2 mb-2">
                      <CheckCircle2 className="h-4 w-4 text-green-600" />
                      <span className="text-xs font-medium text-green-700">Uploaded</span>
                    </div>
                    <p className="text-2xl font-bold text-green-900">{complianceSummary.uploaded}</p>
                  </CardContent>
                </Card>

                <Card className={complianceSummary.pending > 0 ? "bg-amber-50 border-amber-200" : ""}>
                  <CardContent className="pt-4">
                    <div className="flex items-center gap-2 mb-2">
                      <AlertTriangle className={`h-4 w-4 ${complianceSummary.pending > 0 ? 'text-amber-600' : 'text-slate-500'}`} />
                      <span className={`text-xs font-medium ${complianceSummary.pending > 0 ? 'text-amber-700' : 'text-slate-600'}`}>
                        Pending Upload
                      </span>
                    </div>
                    <p className={`text-2xl font-bold ${complianceSummary.pending > 0 ? 'text-amber-900' : 'text-slate-900'}`}>
                      {complianceSummary.pending}
                    </p>
                  </CardContent>
                </Card>

                <Card className="bg-slate-50 border-slate-200">
                  <CardContent className="pt-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Ban className="h-4 w-4 text-slate-500" />
                      <span className="text-xs font-medium text-slate-600">Not Applicable</span>
                    </div>
                    <p className="text-2xl font-bold text-slate-700">{complianceSummary.notApplicable}</p>
                  </CardContent>
                </Card>
              </div>
            </div>

            {/* BOQ Progress Dashboard Section */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  <FileSpreadsheet className="h-5 w-5 text-blue-600" />
                  BOQ Progress by Package
                </h3>
                <Link href="/boq-progress" className="text-sm text-blue-600 hover:underline">
                  Track Progress →
                </Link>
              </div>

              {packageProgress.length === 0 ? (
                <Card>
                  <CardContent className="py-8 text-center">
                    <Package className="h-10 w-10 mx-auto text-slate-300 mb-3" />
                    <p className="text-slate-500">No packages found for this site</p>
                    <Link href="/sites" className="text-sm text-blue-600 hover:underline mt-2 inline-block">
                      Add packages →
                    </Link>
                  </CardContent>
                </Card>
              ) : (
                <div className="grid gap-4">
                  {packageProgress.map((pkg) => {
                    const checklistApplicable = getApplicableCount(pkg.checklistStatus, true)
                    const jmrApplicable = getApplicableCount(pkg.jmrStatus, false)

                    return (
                      <Card key={pkg.id}>
                        <CardHeader className="pb-3">
                          <div className="flex items-center justify-between">
                            <CardTitle className="text-base flex items-center gap-2">
                              <Package className="h-4 w-4 text-blue-600" />
                              {pkg.name}
                            </CardTitle>
                            <Badge variant="secondary">{pkg.totalLineItems} Line Items</Badge>
                          </div>
                        </CardHeader>
                        <CardContent className="space-y-4">
                          {/* Checklist Status */}
                          <div className="space-y-2">
                            <div className="flex items-center gap-2">
                              <ClipboardCheck className="h-4 w-4 text-purple-600" />
                              <span className="text-sm font-medium">Checklist Status</span>
                              <span className="text-xs text-slate-500">
                                (Applicable: {checklistApplicable})
                              </span>
                            </div>
                            <div className="flex flex-wrap gap-2">
                              {pkg.checklistStatus.not_applicable > 0 && (
                                <Badge variant="outline" className="bg-gray-50 text-gray-600 text-xs">
                                  N/A: {pkg.checklistStatus.not_applicable}
                                </Badge>
                              )}
                              {pkg.checklistStatus.pending > 0 && (
                                <Badge variant="outline" className="bg-slate-50 text-slate-700 text-xs">
                                  <Clock className="h-3 w-3 mr-1" />
                                  Pending: {pkg.checklistStatus.pending}
                                </Badge>
                              )}
                              {(pkg.checklistStatus.created || 0) > 0 && (
                                <Badge variant="outline" className="bg-blue-50 text-blue-700 text-xs">
                                  Created: {pkg.checklistStatus.created}
                                </Badge>
                              )}
                              {pkg.checklistStatus.in_progress > 0 && (
                                <Badge variant="outline" className="bg-amber-50 text-amber-700 text-xs">
                                  In Progress: {pkg.checklistStatus.in_progress}
                                </Badge>
                              )}
                              {pkg.checklistStatus.completed > 0 && (
                                <Badge variant="outline" className="bg-green-50 text-green-700 text-xs">
                                  <CheckCircle2 className="h-3 w-3 mr-1" />
                                  Completed: {pkg.checklistStatus.completed}
                                </Badge>
                              )}
                              {pkg.checklistStatus.approved > 0 && (
                                <Badge variant="outline" className="bg-emerald-50 text-emerald-700 text-xs">
                                  Approved: {pkg.checklistStatus.approved}
                                </Badge>
                              )}
                              {pkg.checklistStatus.uploaded > 0 && (
                                <Badge variant="outline" className="bg-purple-50 text-purple-700 text-xs">
                                  <Upload className="h-3 w-3 mr-1" />
                                  Uploaded: {pkg.checklistStatus.uploaded}
                                </Badge>
                              )}
                            </div>
                          </div>

                          {/* JMR Status */}
                          <div className="space-y-2">
                            <div className="flex items-center gap-2">
                              <FileText className="h-4 w-4 text-indigo-600" />
                              <span className="text-sm font-medium">JMR Status</span>
                              <span className="text-xs text-slate-500">
                                (Applicable: {jmrApplicable})
                              </span>
                            </div>
                            <div className="flex flex-wrap gap-2">
                              {pkg.jmrStatus.not_applicable > 0 && (
                                <Badge variant="outline" className="bg-gray-50 text-gray-600 text-xs">
                                  N/A: {pkg.jmrStatus.not_applicable}
                                </Badge>
                              )}
                              {pkg.jmrStatus.pending > 0 && (
                                <Badge variant="outline" className="bg-slate-50 text-slate-700 text-xs">
                                  <Clock className="h-3 w-3 mr-1" />
                                  Pending: {pkg.jmrStatus.pending}
                                </Badge>
                              )}
                              {pkg.jmrStatus.in_progress > 0 && (
                                <Badge variant="outline" className="bg-amber-50 text-amber-700 text-xs">
                                  In Progress: {pkg.jmrStatus.in_progress}
                                </Badge>
                              )}
                              {pkg.jmrStatus.completed > 0 && (
                                <Badge variant="outline" className="bg-green-50 text-green-700 text-xs">
                                  <CheckCircle2 className="h-3 w-3 mr-1" />
                                  Completed: {pkg.jmrStatus.completed}
                                </Badge>
                              )}
                              {pkg.jmrStatus.approved > 0 && (
                                <Badge variant="outline" className="bg-emerald-50 text-emerald-700 text-xs">
                                  Approved: {pkg.jmrStatus.approved}
                                </Badge>
                              )}
                              {pkg.jmrStatus.uploaded > 0 && (
                                <Badge variant="outline" className="bg-purple-50 text-purple-700 text-xs">
                                  <Upload className="h-3 w-3 mr-1" />
                                  Uploaded: {pkg.jmrStatus.uploaded}
                                </Badge>
                              )}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    )
                  })}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
