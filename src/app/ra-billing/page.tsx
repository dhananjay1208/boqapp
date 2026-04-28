'use client'

import { useEffect, useState } from 'react'
import { Header } from '@/components/layout/header'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
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
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import {
  ChevronDown,
  ChevronRight,
  FileSpreadsheet,
  Building2,
  Download,
  Loader2,
  IndianRupee,
  TrendingUp,
  BarChart3,
  ClipboardList,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'
import * as XLSX from 'xlsx'

interface Site {
  id: string
  name: string
}

interface PackageData {
  id: string
  name: string
  site_id: string
  billing_type: 'standard' | 'supply_installation'
}

interface LineItem {
  id: string
  headline_id: string
  item_number: string
  description: string
  location: string | null
  unit: string
  quantity: number
  rate: number | null
  total_amount: number | null
  gst_amount: number | null
  total_amount_with_gst: number | null
  actual_quantity: number | null
  actual_amount: number | null
  actual_amount_with_gst: number | null
  qty_ext: string | null
  supply_rate: number | null
  installation_rate: number | null
  supply_amount: number | null
  installation_amount: number | null
  actual_supply_amount: number | null
  actual_installation_amount: number | null
  actual_total_amount: number | null
}

interface Headline {
  id: string
  package_id: string
  serial_number: number
  name: string
  line_items: LineItem[]
}

interface PackageSummary {
  packageId: string
  packageName: string
  billingType: 'standard' | 'supply_installation'
  boqAmount: number
  actualAmount: number
  actualWithGst: number
}

function formatAmount(value: number | null): string {
  if (value === null || value === undefined) return '-'
  return value.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function formatQty(value: number | null): string {
  if (value === null || value === undefined) return '-'
  return value.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 3 })
}

export default function RABillingPage() {
  const [sites, setSites] = useState<Site[]>([])
  const [packages, setPackages] = useState<PackageData[]>([])
  const [selectedSiteId, setSelectedSiteId] = useState<string>('')
  const [selectedPackageId, setSelectedPackageId] = useState<string>('')
  const [headlines, setHeadlines] = useState<Headline[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedHeadlines, setExpandedHeadlines] = useState<Set<string>>(new Set())
  const [siteSummary, setSiteSummary] = useState<PackageSummary[]>([])
  const [summaryLoading, setSummaryLoading] = useState(false)

  useEffect(() => {
    fetchSites()
  }, [])

  useEffect(() => {
    if (selectedSiteId) {
      fetchPackages()
      fetchSiteSummary()
      setSelectedPackageId('')
      setHeadlines([])
    } else {
      setSiteSummary([])
    }
  }, [selectedSiteId])

  useEffect(() => {
    if (selectedPackageId) {
      fetchBillingData()
    }
  }, [selectedPackageId])

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
      }
    } catch (error) {
      toast.error('Failed to load sites')
    } finally {
      setLoading(false)
    }
  }

  async function fetchPackages() {
    try {
      const { data, error } = await supabase
        .from('packages')
        .select('id, name, site_id, billing_type')
        .eq('site_id', selectedSiteId)
        .order('name')
      if (error) throw error
      setPackages(data || [])
      if (data && data.length > 0) {
        setSelectedPackageId(data[0].id)
      }
    } catch (error) {
      toast.error('Failed to load packages')
    }
  }

  async function fetchSiteSummary() {
    setSummaryLoading(true)
    try {
      const { data, error } = await supabase
        .from('packages')
        .select(`
          id, name, billing_type,
          boq_headlines(
            id,
            line_items:boq_line_items(
              total_amount, actual_amount, actual_amount_with_gst,
              supply_amount, installation_amount,
              actual_supply_amount, actual_installation_amount, actual_total_amount
            )
          )
        `)
        .eq('site_id', selectedSiteId)
        .order('name')

      if (error) throw error

      type SummaryLi = {
        total_amount: number | null
        actual_amount: number | null
        actual_amount_with_gst: number | null
        supply_amount: number | null
        installation_amount: number | null
        actual_supply_amount: number | null
        actual_installation_amount: number | null
        actual_total_amount: number | null
      }
      type SummaryPkg = {
        id: string
        name: string
        billing_type: 'standard' | 'supply_installation'
        boq_headlines: { line_items: SummaryLi[] }[] | null
      }
      const sumNum = (n: number | null | undefined) => n || 0

      const summary: PackageSummary[] = ((data || []) as SummaryPkg[]).map((pkg) => {
        const lineItems: SummaryLi[] = (pkg.boq_headlines || []).flatMap((h) => h.line_items || [])
        const isSI = pkg.billing_type === 'supply_installation'

        const boqAmount = isSI
          ? lineItems.reduce((s, li) => s + sumNum(li.supply_amount) + sumNum(li.installation_amount), 0)
          : lineItems.reduce((s, li) => s + sumNum(li.total_amount), 0)

        const actualAmount = isSI
          ? lineItems.reduce((s, li) => s + sumNum(li.actual_supply_amount) + sumNum(li.actual_installation_amount), 0)
          : lineItems.reduce((s, li) => s + sumNum(li.actual_amount), 0)

        const actualWithGst = isSI
          ? lineItems.reduce((s, li) => s + (li.actual_total_amount ?? (sumNum(li.actual_supply_amount) + sumNum(li.actual_installation_amount))), 0)
          : lineItems.reduce((s, li) => s + sumNum(li.actual_amount_with_gst), 0)

        return {
          packageId: pkg.id,
          packageName: pkg.name,
          billingType: pkg.billing_type,
          boqAmount,
          actualAmount,
          actualWithGst,
        }
      })

      setSiteSummary(summary)
    } catch {
      toast.error('Failed to load site summary')
    } finally {
      setSummaryLoading(false)
    }
  }

  async function fetchBillingData() {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('boq_headlines')
        .select(`
          *,
          line_items:boq_line_items(*)
        `)
        .eq('package_id', selectedPackageId)
        .order('serial_number')

      if (error) throw error

      // Sort line items within each headline
      const sorted = (data || []).map((h: any) => ({
        ...h,
        line_items: (h.line_items || []).sort((a: LineItem, b: LineItem) =>
          parseFloat(a.item_number) - parseFloat(b.item_number)
        ),
      }))

      setHeadlines(sorted)
      // Expand all headlines by default
      setExpandedHeadlines(new Set(sorted.map((h: Headline) => h.id)))
    } catch (error) {
      toast.error('Failed to load billing data')
    } finally {
      setLoading(false)
    }
  }

  function toggleHeadlineExpand(id: string) {
    const newExpanded = new Set(expandedHeadlines)
    if (newExpanded.has(id)) {
      newExpanded.delete(id)
    } else {
      newExpanded.add(id)
    }
    setExpandedHeadlines(newExpanded)
  }

  // Determine billing type from selected package
  const selectedPkg = packages.find(p => p.id === selectedPackageId)
  const isSupplyInstallation = selectedPkg?.billing_type === 'supply_installation'

  // Summary calculations
  const allLineItems = headlines.flatMap(h => h.line_items)

  const totalBOQAmount = isSupplyInstallation
    ? allLineItems.reduce((sum, li) => sum + (li.supply_amount || 0) + (li.installation_amount || 0), 0)
    : allLineItems.reduce((sum, li) => sum + (li.total_amount_with_gst || 0), 0)

  const totalActualAmount = isSupplyInstallation
    ? allLineItems.reduce((sum, li) => sum + (li.actual_total_amount || ((li.actual_supply_amount || 0) + (li.actual_installation_amount || 0))), 0)
    : allLineItems.reduce((sum, li) => sum + (li.actual_amount_with_gst || 0), 0)

  const billingPercent = totalBOQAmount > 0 ? (totalActualAmount / totalBOQAmount) * 100 : 0
  const itemsWithActuals = allLineItems.filter(li => li.actual_quantity && li.actual_quantity > 0).length

  function getHeadlineSubtotals(lineItems: LineItem[]) {
    if (isSupplyInstallation) {
      return {
        supplyAmount: lineItems.reduce((s, li) => s + (li.supply_amount || 0), 0),
        installationAmount: lineItems.reduce((s, li) => s + (li.installation_amount || 0), 0),
        totalBoq: lineItems.reduce((s, li) => s + (li.supply_amount || 0) + (li.installation_amount || 0), 0),
        actualSupplyAmount: lineItems.reduce((s, li) => s + (li.actual_supply_amount || 0), 0),
        actualInstallationAmount: lineItems.reduce((s, li) => s + (li.actual_installation_amount || 0), 0),
        actualTotalAmount: lineItems.reduce((s, li) => s + (li.actual_total_amount || ((li.actual_supply_amount || 0) + (li.actual_installation_amount || 0))), 0),
        // Standard fields (unused but keeps return type consistent)
        totalAmount: 0, gstAmount: 0, totalAmountWithGst: 0, actualAmount: 0, actualAmountWithGst: 0,
      }
    }
    return {
      totalAmount: lineItems.reduce((s, li) => s + (li.total_amount || 0), 0),
      gstAmount: lineItems.reduce((s, li) => s + (li.gst_amount || 0), 0),
      totalAmountWithGst: lineItems.reduce((s, li) => s + (li.total_amount_with_gst || 0), 0),
      actualAmount: lineItems.reduce((s, li) => s + (li.actual_amount || 0), 0),
      actualAmountWithGst: lineItems.reduce((s, li) => s + (li.actual_amount_with_gst || 0), 0),
      // S&I fields (unused)
      supplyAmount: 0, installationAmount: 0, totalBoq: 0,
      actualSupplyAmount: 0, actualInstallationAmount: 0, actualTotalAmount: 0,
    }
  }

  function exportToExcel() {
    const wb = XLSX.utils.book_new()
    const rows: any[][] = []

    if (isSupplyInstallation) {
      rows.push(['S.No', 'Description', 'Unit', 'Qty Ext', 'Quantity', 'Supply Rate', 'Install Rate', 'Supply Amt', 'Install Amt', 'Actual Qty', 'Actual Supply Amt', 'Actual Install Amt', 'Actual Total Amt'])

      for (const headline of headlines) {
        rows.push([headline.serial_number, headline.name, '', '', '', '', '', '', '', '', '', '', ''])
        for (const li of headline.line_items) {
          rows.push([
            li.item_number, li.description, li.unit, li.qty_ext || '', li.quantity,
            li.supply_rate, li.installation_rate, li.supply_amount, li.installation_amount,
            li.actual_quantity, li.actual_supply_amount, li.actual_installation_amount, li.actual_total_amount,
          ])
        }
        const sub = getHeadlineSubtotals(headline.line_items)
        rows.push(['', 'Subtotal', '', '', '', '', '', sub.supplyAmount, sub.installationAmount, '', sub.actualSupplyAmount, sub.actualInstallationAmount, sub.actualTotalAmount])
      }

      const grandTotals = getHeadlineSubtotals(allLineItems)
      rows.push([])
      rows.push(['', 'GRAND TOTAL', '', '', '', '', '', grandTotals.supplyAmount, grandTotals.installationAmount, '', grandTotals.actualSupplyAmount, grandTotals.actualInstallationAmount, grandTotals.actualTotalAmount])
    } else {
      rows.push(['S.No', 'Description', 'Location', 'Unit', 'Quantity', 'Rate', 'Total Amount', 'GST Amount', 'Total w/ GST', 'Actual Qty', 'Actual Amount', 'Actual Amt w/ GST'])

      for (const headline of headlines) {
        rows.push([headline.serial_number, headline.name, '', '', '', '', '', '', '', '', '', ''])
        for (const li of headline.line_items) {
          rows.push([
            li.item_number, li.description, li.location || '', li.unit, li.quantity,
            li.rate, li.total_amount, li.gst_amount, li.total_amount_with_gst,
            li.actual_quantity, li.actual_amount, li.actual_amount_with_gst,
          ])
        }
        const sub = getHeadlineSubtotals(headline.line_items)
        rows.push(['', 'Subtotal', '', '', '', '', sub.totalAmount, sub.gstAmount, sub.totalAmountWithGst, '', sub.actualAmount, sub.actualAmountWithGst])
      }

      const grandTotals = getHeadlineSubtotals(allLineItems)
      rows.push([])
      rows.push(['', 'GRAND TOTAL', '', '', '', '', grandTotals.totalAmount, grandTotals.gstAmount, grandTotals.totalAmountWithGst, '', grandTotals.actualAmount, grandTotals.actualAmountWithGst])
    }

    const ws = XLSX.utils.aoa_to_sheet(rows)
    ws['!cols'] = isSupplyInstallation
      ? [{ wch: 8 }, { wch: 40 }, { wch: 8 }, { wch: 10 }, { wch: 10 }, { wch: 12 }, { wch: 12 }, { wch: 14 }, { wch: 14 }, { wch: 12 }, { wch: 14 }, { wch: 14 }, { wch: 14 }]
      : [{ wch: 8 }, { wch: 40 }, { wch: 15 }, { wch: 8 }, { wch: 10 }, { wch: 12 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 12 }, { wch: 14 }, { wch: 14 }]

    const siteName = sites.find(s => s.id === selectedSiteId)?.name || 'Site'
    const pkgName = packages.find(p => p.id === selectedPackageId)?.name || 'Package'
    XLSX.utils.book_append_sheet(wb, ws, 'RA Billing')
    XLSX.writeFile(wb, `RA_Billing_${siteName}_${pkgName}.xlsx`)
    toast.success('Exported to Excel')
  }

  const filteredPackages = packages.filter(p => p.site_id === selectedSiteId)

  return (
    <div className="flex flex-col min-h-screen">
      <Header title="RA Billing" />

      <div className="flex-1 p-4 md:p-6 space-y-6">
        {/* Filters */}
        <Card>
          <CardHeader>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <IndianRupee className="h-5 w-5" />
                  RA Billing
                </CardTitle>
                <CardDescription>
                  View billing data with BOQ and actual quantities
                </CardDescription>
              </div>
              <div className="flex flex-col sm:flex-row gap-3">
                <Select value={selectedSiteId} onValueChange={setSelectedSiteId}>
                  <SelectTrigger className="w-full sm:w-48">
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
                <Select value={selectedPackageId} onValueChange={setSelectedPackageId} disabled={!selectedSiteId}>
                  <SelectTrigger className="w-full sm:w-48">
                    <SelectValue placeholder="Select package" />
                  </SelectTrigger>
                  <SelectContent>
                    {filteredPackages.map((pkg) => (
                      <SelectItem key={pkg.id} value={pkg.id}>
                        {pkg.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {headlines.length > 0 && (
                  <Button variant="outline" onClick={exportToExcel}>
                    <Download className="h-4 w-4 mr-2" />
                    Export
                  </Button>
                )}
              </div>
            </div>
          </CardHeader>
        </Card>

        {/* Site Summary */}
        {selectedSiteId && (summaryLoading || siteSummary.length > 0) && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">RA Billing Site Summary</CardTitle>
              <CardDescription>{sites.find(s => s.id === selectedSiteId)?.name || ''}</CardDescription>
            </CardHeader>
            <CardContent>
              {summaryLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Package</TableHead>
                        <TableHead className="text-right whitespace-nowrap">BOQ amount</TableHead>
                        <TableHead className="text-right whitespace-nowrap">Actual amount</TableHead>
                        <TableHead className="text-right whitespace-nowrap">Actual with GST</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {siteSummary.map((row) => (
                        <TableRow key={row.packageId}>
                          <TableCell>
                            <div className="font-medium">{row.packageName}</div>
                            {row.billingType === 'supply_installation' && (
                              <div className="text-xs text-slate-500">(Supply &amp; Installation)</div>
                            )}
                          </TableCell>
                          <TableCell className="text-right">{formatAmount(row.boqAmount)}</TableCell>
                          <TableCell className="text-right">{formatAmount(row.actualAmount)}</TableCell>
                          <TableCell className="text-right">{formatAmount(row.actualWithGst)}</TableCell>
                        </TableRow>
                      ))}
                      <TableRow className="bg-slate-50 font-medium">
                        <TableCell>Total</TableCell>
                        <TableCell className="text-right">
                          {formatAmount(siteSummary.reduce((s, r) => s + r.boqAmount, 0))}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatAmount(siteSummary.reduce((s, r) => s + r.actualAmount, 0))}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatAmount(siteSummary.reduce((s, r) => s + r.actualWithGst, 0))}
                        </TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Summary Cards */}
        {selectedPackageId && !loading && headlines.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-100 rounded-lg">
                    <IndianRupee className="h-5 w-5 text-blue-700" />
                  </div>
                  <div>
                    <p className="text-sm text-slate-500">Total BOQ Amount</p>
                    <p className="text-xl font-bold">{formatAmount(totalBOQAmount)}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-green-100 rounded-lg">
                    <TrendingUp className="h-5 w-5 text-green-700" />
                  </div>
                  <div>
                    <p className="text-sm text-slate-500">Total Actual Amount</p>
                    <p className="text-xl font-bold">{formatAmount(totalActualAmount)}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-purple-100 rounded-lg">
                    <BarChart3 className="h-5 w-5 text-purple-700" />
                  </div>
                  <div>
                    <p className="text-sm text-slate-500">Billing %</p>
                    <p className="text-xl font-bold">{billingPercent.toFixed(1)}%</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-amber-100 rounded-lg">
                    <ClipboardList className="h-5 w-5 text-amber-700" />
                  </div>
                  <div>
                    <p className="text-sm text-slate-500">Items with Actuals</p>
                    <p className="text-xl font-bold">{itemsWithActuals} / {allLineItems.length}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Loading State */}
        {loading && (
          <Card>
            <CardContent className="py-12">
              <div className="flex flex-col items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-blue-600 mb-4" />
                <p className="text-slate-500">Loading billing data...</p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* No Site Selected */}
        {!selectedSiteId && !loading && (
          <Card>
            <CardContent className="py-12">
              <div className="text-center">
                <Building2 className="h-12 w-12 mx-auto text-slate-300 mb-4" />
                <h3 className="text-lg font-medium text-slate-900 mb-2">Select a Site</h3>
                <p className="text-slate-500">Choose a site and package to view RA billing data</p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* No Data */}
        {selectedPackageId && !loading && headlines.length === 0 && (
          <Card>
            <CardContent className="py-12">
              <div className="text-center">
                <FileSpreadsheet className="h-12 w-12 mx-auto text-slate-300 mb-4" />
                <h3 className="text-lg font-medium text-slate-900 mb-2">No BOQ Data</h3>
                <p className="text-slate-500">No BOQ data found for this package</p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Billing Table grouped by headline */}
        {selectedPackageId && !loading && headlines.length > 0 && (
          <div className="space-y-4">
            {headlines.map((headline) => {
              const sub = getHeadlineSubtotals(headline.line_items)
              return (
                <Card key={headline.id}>
                  <Collapsible
                    open={expandedHeadlines.has(headline.id)}
                    onOpenChange={() => toggleHeadlineExpand(headline.id)}
                  >
                    <CollapsibleTrigger asChild>
                      <CardHeader className="cursor-pointer hover:bg-slate-50 transition-colors py-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            {expandedHeadlines.has(headline.id) ? (
                              <ChevronDown className="h-5 w-5 text-slate-400" />
                            ) : (
                              <ChevronRight className="h-5 w-5 text-slate-400" />
                            )}
                            <div>
                              <CardTitle className="text-base">
                                {headline.serial_number}. {headline.name}
                              </CardTitle>
                              <CardDescription>
                                {headline.line_items.length} items | Subtotal: {formatAmount(isSupplyInstallation ? sub.totalBoq : sub.totalAmountWithGst)}
                              </CardDescription>
                            </div>
                          </div>
                          {(isSupplyInstallation ? sub.actualTotalAmount > 0 : sub.actualAmountWithGst > 0) && (
                            <div className="text-right text-sm">
                              <p className="text-slate-500">Actual</p>
                              <p className="font-medium text-green-700">{formatAmount(isSupplyInstallation ? sub.actualTotalAmount : sub.actualAmountWithGst)}</p>
                            </div>
                          )}
                        </div>
                      </CardHeader>
                    </CollapsibleTrigger>

                    <CollapsibleContent>
                      <CardContent className="pt-0">
                        <div className="overflow-x-auto">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead className="w-[60px] whitespace-nowrap">S.No</TableHead>
                                <TableHead className="min-w-[200px] max-w-[350px]">Description</TableHead>
                                {isSupplyInstallation ? (
                                  <>
                                    <TableHead className="whitespace-nowrap">Unit</TableHead>
                                    <TableHead className="whitespace-nowrap">Qty Ext</TableHead>
                                    <TableHead className="text-right whitespace-nowrap">Qty</TableHead>
                                    <TableHead className="text-right whitespace-nowrap">Supply Rate</TableHead>
                                    <TableHead className="text-right whitespace-nowrap">Install Rate</TableHead>
                                    <TableHead className="text-right whitespace-nowrap">Supply Amt</TableHead>
                                    <TableHead className="text-right whitespace-nowrap">Install Amt</TableHead>
                                    <TableHead className="text-right whitespace-nowrap">Actual Qty</TableHead>
                                    <TableHead className="text-right whitespace-nowrap">Actual Supply</TableHead>
                                    <TableHead className="text-right whitespace-nowrap">Actual Install</TableHead>
                                    <TableHead className="text-right whitespace-nowrap">Actual Total</TableHead>
                                  </>
                                ) : (
                                  <>
                                    <TableHead className="whitespace-nowrap">Location</TableHead>
                                    <TableHead className="whitespace-nowrap">Unit</TableHead>
                                    <TableHead className="text-right whitespace-nowrap">Qty</TableHead>
                                    <TableHead className="text-right whitespace-nowrap">Rate</TableHead>
                                    <TableHead className="text-right whitespace-nowrap">Total Amt</TableHead>
                                    <TableHead className="text-right whitespace-nowrap">GST Amt</TableHead>
                                    <TableHead className="text-right whitespace-nowrap">Total w/ GST</TableHead>
                                    <TableHead className="text-right whitespace-nowrap">Actual Qty</TableHead>
                                    <TableHead className="text-right whitespace-nowrap">Actual Amt</TableHead>
                                    <TableHead className="text-right whitespace-nowrap">Actual w/ GST</TableHead>
                                  </>
                                )}
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {headline.line_items.map((li) => (
                                <TableRow key={li.id}>
                                  <TableCell className="font-mono text-sm">{li.item_number}</TableCell>
                                  <TableCell className="max-w-[350px]">
                                    <p className="whitespace-normal break-words" title={li.description}>{li.description}</p>
                                  </TableCell>
                                  {isSupplyInstallation ? (
                                    <>
                                      <TableCell>{li.unit || '-'}</TableCell>
                                      <TableCell className="text-sm">{li.qty_ext || '-'}</TableCell>
                                      <TableCell className="text-right">{formatQty(li.quantity)}</TableCell>
                                      <TableCell className="text-right">{formatAmount(li.supply_rate)}</TableCell>
                                      <TableCell className="text-right">{formatAmount(li.installation_rate)}</TableCell>
                                      <TableCell className="text-right">{formatAmount(li.supply_amount)}</TableCell>
                                      <TableCell className="text-right">{formatAmount(li.installation_amount)}</TableCell>
                                      <TableCell className="text-right">{formatQty(li.actual_quantity)}</TableCell>
                                      <TableCell className="text-right">{formatAmount(li.actual_supply_amount)}</TableCell>
                                      <TableCell className="text-right">{formatAmount(li.actual_installation_amount)}</TableCell>
                                      <TableCell className="text-right font-medium">{formatAmount(li.actual_total_amount)}</TableCell>
                                    </>
                                  ) : (
                                    <>
                                      <TableCell className="text-sm text-slate-500">{li.location || '-'}</TableCell>
                                      <TableCell>{li.unit || '-'}</TableCell>
                                      <TableCell className="text-right">{formatQty(li.quantity)}</TableCell>
                                      <TableCell className="text-right">{formatAmount(li.rate)}</TableCell>
                                      <TableCell className="text-right">{formatAmount(li.total_amount)}</TableCell>
                                      <TableCell className="text-right">{formatAmount(li.gst_amount)}</TableCell>
                                      <TableCell className="text-right font-medium">{formatAmount(li.total_amount_with_gst)}</TableCell>
                                      <TableCell className="text-right">{formatQty(li.actual_quantity)}</TableCell>
                                      <TableCell className="text-right">{formatAmount(li.actual_amount)}</TableCell>
                                      <TableCell className="text-right font-medium">{formatAmount(li.actual_amount_with_gst)}</TableCell>
                                    </>
                                  )}
                                </TableRow>
                              ))}
                              {/* Subtotal row */}
                              {isSupplyInstallation ? (
                                <TableRow className="bg-slate-50 font-medium">
                                  <TableCell colSpan={7} className="text-right">Subtotal</TableCell>
                                  <TableCell className="text-right">{formatAmount(sub.supplyAmount)}</TableCell>
                                  <TableCell className="text-right">{formatAmount(sub.installationAmount)}</TableCell>
                                  <TableCell />
                                  <TableCell className="text-right">{formatAmount(sub.actualSupplyAmount)}</TableCell>
                                  <TableCell className="text-right">{formatAmount(sub.actualInstallationAmount)}</TableCell>
                                  <TableCell className="text-right">{formatAmount(sub.actualTotalAmount)}</TableCell>
                                </TableRow>
                              ) : (
                                <TableRow className="bg-slate-50 font-medium">
                                  <TableCell colSpan={6} className="text-right">Subtotal</TableCell>
                                  <TableCell className="text-right">{formatAmount(sub.totalAmount)}</TableCell>
                                  <TableCell className="text-right">{formatAmount(sub.gstAmount)}</TableCell>
                                  <TableCell className="text-right">{formatAmount(sub.totalAmountWithGst)}</TableCell>
                                  <TableCell />
                                  <TableCell className="text-right">{formatAmount(sub.actualAmount)}</TableCell>
                                  <TableCell className="text-right">{formatAmount(sub.actualAmountWithGst)}</TableCell>
                                </TableRow>
                              )}
                            </TableBody>
                          </Table>
                        </div>
                      </CardContent>
                    </CollapsibleContent>
                  </Collapsible>
                </Card>
              )
            })}

            {/* Grand Total */}
            <Card>
              <CardContent className="py-4">
                <div className="overflow-x-auto">
                  <Table>
                    <TableBody>
                      {isSupplyInstallation ? (
                        <TableRow className="bg-slate-900 text-white font-bold">
                          <TableCell colSpan={7} className="text-right text-white">GRAND TOTAL</TableCell>
                          <TableCell className="text-right text-white">{formatAmount(getHeadlineSubtotals(allLineItems).supplyAmount)}</TableCell>
                          <TableCell className="text-right text-white">{formatAmount(getHeadlineSubtotals(allLineItems).installationAmount)}</TableCell>
                          <TableCell className="text-white" />
                          <TableCell className="text-right text-white">{formatAmount(getHeadlineSubtotals(allLineItems).actualSupplyAmount)}</TableCell>
                          <TableCell className="text-right text-white">{formatAmount(getHeadlineSubtotals(allLineItems).actualInstallationAmount)}</TableCell>
                          <TableCell className="text-right text-white">{formatAmount(totalActualAmount)}</TableCell>
                        </TableRow>
                      ) : (
                        <TableRow className="bg-slate-900 text-white font-bold">
                          <TableCell colSpan={6} className="text-right text-white">GRAND TOTAL</TableCell>
                          <TableCell className="text-right text-white">{formatAmount(getHeadlineSubtotals(allLineItems).totalAmount)}</TableCell>
                          <TableCell className="text-right text-white">{formatAmount(getHeadlineSubtotals(allLineItems).gstAmount)}</TableCell>
                          <TableCell className="text-right text-white">{formatAmount(totalBOQAmount)}</TableCell>
                          <TableCell className="text-white" />
                          <TableCell className="text-right text-white">{formatAmount(getHeadlineSubtotals(allLineItems).actualAmount)}</TableCell>
                          <TableCell className="text-right text-white">{formatAmount(totalActualAmount)}</TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  )
}
