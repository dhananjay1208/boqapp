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
  FileText,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { computeUptoDateMap } from '@/lib/upto-date'
import { toast } from 'sonner'
import * as XLSX from 'xlsx'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

interface Site {
  id: string
  name: string
}

interface PackageData {
  id: string
  name: string
  site_id: string
  billing_type: 'standard' | 'supply_installation'
  actual_source: 'template' | 'execution'
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
  actualSource: 'template' | 'execution'
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

// Compute the "execution" actuals for a single line item: Actual Qty = Upto Date,
// Actual Amounts = quantity × rate. GST percentage on Standard lines is derived
// from the BOQ row (gst_amount / total_amount) when total_amount > 0.
function computeExecutionActuals(
  li: Pick<LineItem, 'rate' | 'total_amount' | 'gst_amount' | 'supply_rate' | 'installation_rate'>,
  uptoQty: number,
  isSI: boolean
) {
  if (isSI) {
    const supply = uptoQty * (li.supply_rate || 0)
    const install = uptoQty * (li.installation_rate || 0)
    return {
      actualQty: uptoQty,
      actualAmount: supply + install,
      actualWithGst: supply + install,
      actualSupplyAmount: supply,
      actualInstallationAmount: install,
      actualTotalAmount: supply + install,
    }
  }
  const amount = uptoQty * (li.rate || 0)
  const gstPct =
    li.total_amount && li.total_amount > 0 ? (li.gst_amount || 0) / li.total_amount : 0
  return {
    actualQty: uptoQty,
    actualAmount: amount,
    actualWithGst: amount * (1 + gstPct),
    actualSupplyAmount: 0,
    actualInstallationAmount: 0,
    actualTotalAmount: 0,
  }
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
        .select('id, name, site_id, billing_type, actual_source')
        .eq('site_id', selectedSiteId)
        .order('name')
      if (error) throw error
      setPackages(data || [])
      if (data && data.length > 0) {
        setSelectedPackageId(data[0].id)
      }
    } catch {
      toast.error('Failed to load packages')
    }
  }

  async function fetchSiteSummary() {
    setSummaryLoading(true)
    try {
      const { data, error } = await supabase
        .from('packages')
        .select(`
          id, name, billing_type, actual_source,
          boq_headlines(
            id,
            line_items:boq_line_items(
              id,
              rate, total_amount, gst_amount,
              supply_rate, installation_rate,
              actual_amount, actual_amount_with_gst,
              supply_amount, installation_amount,
              actual_supply_amount, actual_installation_amount, actual_total_amount
            )
          )
        `)
        .eq('site_id', selectedSiteId)
        .order('name')

      if (error) throw error

      type SummaryLi = {
        id: string
        rate: number | null
        total_amount: number | null
        gst_amount: number | null
        supply_rate: number | null
        installation_rate: number | null
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
        actual_source: 'template' | 'execution'
        boq_headlines: { line_items: SummaryLi[] }[] | null
      }
      const sumNum = (n: number | null | undefined) => n || 0
      const pkgs = (data || []) as SummaryPkg[]

      // Single batched Upto Date lookup across every line item in the site
      const allIds = pkgs.flatMap((p) =>
        (p.boq_headlines || []).flatMap((h) => (h.line_items || []).map((li) => li.id))
      )
      const uptoMap = await computeUptoDateMap(allIds)

      const summary: PackageSummary[] = pkgs.map((pkg) => {
        const lineItems: SummaryLi[] = (pkg.boq_headlines || []).flatMap((h) => h.line_items || [])
        const isSI = pkg.billing_type === 'supply_installation'

        const boqAmount = isSI
          ? lineItems.reduce((s, li) => s + sumNum(li.supply_amount) + sumNum(li.installation_amount), 0)
          : lineItems.reduce((s, li) => s + sumNum(li.total_amount), 0)

        let actualAmount: number
        let actualWithGst: number

        if (pkg.actual_source === 'template') {
          actualAmount = isSI
            ? lineItems.reduce((s, li) => s + sumNum(li.actual_supply_amount) + sumNum(li.actual_installation_amount), 0)
            : lineItems.reduce((s, li) => s + sumNum(li.actual_amount), 0)
          actualWithGst = isSI
            ? lineItems.reduce((s, li) => s + (li.actual_total_amount ?? (sumNum(li.actual_supply_amount) + sumNum(li.actual_installation_amount))), 0)
            : lineItems.reduce((s, li) => s + sumNum(li.actual_amount_with_gst), 0)
        } else {
          // Execution: derive actuals from Upto Date × rate
          actualAmount = lineItems.reduce(
            (s, li) => s + computeExecutionActuals(li, uptoMap[li.id] || 0, isSI).actualAmount,
            0
          )
          actualWithGst = lineItems.reduce(
            (s, li) => s + computeExecutionActuals(li, uptoMap[li.id] || 0, isSI).actualWithGst,
            0
          )
        }

        return {
          packageId: pkg.id,
          packageName: pkg.name,
          billingType: pkg.billing_type,
          actualSource: pkg.actual_source,
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

  async function fetchBillingData(sourceOverride?: 'template' | 'execution') {
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
      const sorted: Headline[] = (data || []).map((h: Headline) => ({
        ...h,
        line_items: (h.line_items || []).sort((a: LineItem, b: LineItem) =>
          parseFloat(a.item_number) - parseFloat(b.item_number)
        ),
      }))

      // When the package's actual source is 'execution', derive Actual Qty / Amounts
      // from Upto Date (JMR-approved or workstation fallback) instead of the stored
      // Excel-template values. Mutates line items so all downstream display, subtotals,
      // grand totals and export read these effective values transparently.
      const pkg = packages.find((p) => p.id === selectedPackageId)
      const source = sourceOverride ?? pkg?.actual_source ?? 'execution'
      const isSI = pkg?.billing_type === 'supply_installation'

      if (source === 'execution') {
        const allIds = sorted.flatMap((h) => h.line_items.map((li) => li.id))
        const uptoMap = await computeUptoDateMap(allIds)
        for (const h of sorted) {
          for (const li of h.line_items) {
            const eff = computeExecutionActuals(li, uptoMap[li.id] || 0, isSI)
            li.actual_quantity = eff.actualQty
            if (isSI) {
              li.actual_supply_amount = eff.actualSupplyAmount
              li.actual_installation_amount = eff.actualInstallationAmount
              li.actual_total_amount = eff.actualTotalAmount
            } else {
              li.actual_amount = eff.actualAmount
              li.actual_amount_with_gst = eff.actualWithGst
            }
          }
        }
      }

      setHeadlines(sorted)
      // Expand all headlines by default
      setExpandedHeadlines(new Set(sorted.map((h: Headline) => h.id)))
    } catch {
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

  async function changeActualSource(newSource: 'template' | 'execution') {
    if (!selectedPackageId) return
    try {
      const { error } = await supabase
        .from('packages')
        .update({ actual_source: newSource })
        .eq('id', selectedPackageId)
      if (error) throw error
      // Update local packages state so fetchBillingData closes over the new source
      setPackages((prev) =>
        prev.map((p) => (p.id === selectedPackageId ? { ...p, actual_source: newSource } : p))
      )
      // Refetch both views so they reflect the new source. Pass the source
      // explicitly to fetchBillingData since the React state update from
      // setPackages above hasn't been committed yet at this point.
      await Promise.all([fetchBillingData(newSource), fetchSiteSummary()])
      toast.success(
        newSource === 'execution'
          ? 'Switched to BOQ Management (Upto Date) actuals'
          : 'Switched to Excel Template actuals'
      )
    } catch {
      toast.error('Failed to change actual source')
    }
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

  function exportToPDF() {
    if (!selectedPackageId || headlines.length === 0) return

    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
    const pageWidth = doc.internal.pageSize.getWidth()
    const pageHeight = doc.internal.pageSize.getHeight()
    const margin = 10

    const siteName = sites.find(s => s.id === selectedSiteId)?.name || 'Site'
    const pkg = packages.find(p => p.id === selectedPackageId)
    const pkgName = pkg?.name || 'Package'
    const sourceLabel = pkg?.actual_source === 'execution' ? 'BOQ Management (Upto Date)' : 'Excel Template'
    const billingTypeLabel = isSupplyInstallation ? 'Supply & Installation' : 'Standard'
    const generatedDate = new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })

    // Header band
    doc.setFillColor(30, 41, 59)
    doc.rect(0, 0, pageWidth, 18, 'F')
    doc.setTextColor(255, 255, 255)
    doc.setFontSize(16)
    doc.setFont('helvetica', 'bold')
    doc.text('RA Billing Statement', margin, 12)
    doc.setFontSize(9)
    doc.setFont('helvetica', 'normal')
    doc.text(`Generated: ${generatedDate}`, pageWidth - margin, 12, { align: 'right' })

    // Sub-header info bar
    doc.setFillColor(241, 245, 249)
    doc.rect(0, 18, pageWidth, 14, 'F')
    doc.setTextColor(15, 23, 42)
    doc.setFontSize(11)
    doc.setFont('helvetica', 'bold')
    doc.text(siteName, margin, 25)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    doc.text(`Package: ${pkgName}  |  ${billingTypeLabel}`, margin, 30)
    doc.text(`Actual Source: ${sourceLabel}`, pageWidth - margin, 30, { align: 'right' })

    // Summary cards
    let currentY = 38
    const cardGap = 3
    const cardWidth = (pageWidth - margin * 2 - cardGap * 3) / 4
    const cardHeight = 18
    const cardLabels = ['Total BOQ Amount', 'Total Actual Amount', 'Billing %', 'Items with Actuals']
    const cardValues = [
      formatAmount(totalBOQAmount),
      formatAmount(totalActualAmount),
      `${billingPercent.toFixed(1)}%`,
      `${itemsWithActuals} / ${allLineItems.length}`,
    ]
    for (let i = 0; i < 4; i++) {
      const x = margin + i * (cardWidth + cardGap)
      doc.setFillColor(248, 250, 252)
      doc.setDrawColor(226, 232, 240)
      doc.roundedRect(x, currentY, cardWidth, cardHeight, 1.5, 1.5, 'FD')
      doc.setFontSize(8)
      doc.setTextColor(100, 116, 139)
      doc.setFont('helvetica', 'normal')
      doc.text(cardLabels[i], x + 3, currentY + 6)
      doc.setFontSize(11)
      doc.setTextColor(15, 23, 42)
      doc.setFont('helvetica', 'bold')
      doc.text(cardValues[i], x + 3, currentY + 14)
    }
    currentY += cardHeight + 6

    // Table headers
    const headers = isSupplyInstallation
      ? ['S.No', 'Description', 'Unit', 'Qty Ext', 'Qty', 'Supply Rate', 'Install Rate', 'Supply Amt', 'Install Amt', 'Actual Qty', 'Actual Supply', 'Actual Install', 'Actual Total']
      : ['S.No', 'Description', 'Location', 'Unit', 'Qty', 'Rate', 'Total Amt', 'GST Amt', 'Total w/GST', 'Actual Qty', 'Actual Amt', 'Actual w/GST']
    const numCols = headers.length

    type CellDef = string | { content: string; colSpan?: number; styles?: Record<string, unknown> }
    const subtotalFill = [241, 245, 249] as [number, number, number]
    const grandFill = [15, 23, 42] as [number, number, number]
    const headlineFill = [219, 234, 254] as [number, number, number]
    const headlineText = [30, 58, 138] as [number, number, number]
    const body: CellDef[][] = []

    for (const headline of headlines) {
      // Headline title row spans full width
      body.push([{
        content: `${headline.serial_number}. ${headline.name}`,
        colSpan: numCols,
        styles: { fillColor: headlineFill, textColor: headlineText, fontStyle: 'bold', halign: 'left' },
      }])

      for (const li of headline.line_items) {
        if (isSupplyInstallation) {
          body.push([
            li.item_number,
            li.description,
            li.unit || '-',
            li.qty_ext || '-',
            formatQty(li.quantity),
            formatAmount(li.supply_rate),
            formatAmount(li.installation_rate),
            formatAmount(li.supply_amount),
            formatAmount(li.installation_amount),
            formatQty(li.actual_quantity),
            formatAmount(li.actual_supply_amount),
            formatAmount(li.actual_installation_amount),
            formatAmount(li.actual_total_amount),
          ])
        } else {
          body.push([
            li.item_number,
            li.description,
            li.location || '-',
            li.unit || '-',
            formatQty(li.quantity),
            formatAmount(li.rate),
            formatAmount(li.total_amount),
            formatAmount(li.gst_amount),
            formatAmount(li.total_amount_with_gst),
            formatQty(li.actual_quantity),
            formatAmount(li.actual_amount),
            formatAmount(li.actual_amount_with_gst),
          ])
        }
      }

      const sub = getHeadlineSubtotals(headline.line_items)
      const subStyle = { fillColor: subtotalFill, fontStyle: 'bold', halign: 'right' }
      const subFillOnly = { fillColor: subtotalFill }
      if (isSupplyInstallation) {
        body.push([
          { content: 'Subtotal', colSpan: 7, styles: subStyle },
          { content: formatAmount(sub.supplyAmount), styles: subStyle },
          { content: formatAmount(sub.installationAmount), styles: subStyle },
          { content: '', styles: subFillOnly },
          { content: formatAmount(sub.actualSupplyAmount), styles: subStyle },
          { content: formatAmount(sub.actualInstallationAmount), styles: subStyle },
          { content: formatAmount(sub.actualTotalAmount), styles: subStyle },
        ])
      } else {
        body.push([
          { content: 'Subtotal', colSpan: 6, styles: subStyle },
          { content: formatAmount(sub.totalAmount), styles: subStyle },
          { content: formatAmount(sub.gstAmount), styles: subStyle },
          { content: formatAmount(sub.totalAmountWithGst), styles: subStyle },
          { content: '', styles: subFillOnly },
          { content: formatAmount(sub.actualAmount), styles: subStyle },
          { content: formatAmount(sub.actualAmountWithGst), styles: subStyle },
        ])
      }
    }

    // Grand total
    const grand = getHeadlineSubtotals(allLineItems)
    const grandStyle = { fillColor: grandFill, textColor: [255, 255, 255], fontStyle: 'bold', halign: 'right' }
    const grandFillOnly = { fillColor: grandFill }
    if (isSupplyInstallation) {
      body.push([
        { content: 'GRAND TOTAL', colSpan: 7, styles: grandStyle },
        { content: formatAmount(grand.supplyAmount), styles: grandStyle },
        { content: formatAmount(grand.installationAmount), styles: grandStyle },
        { content: '', styles: grandFillOnly },
        { content: formatAmount(grand.actualSupplyAmount), styles: grandStyle },
        { content: formatAmount(grand.actualInstallationAmount), styles: grandStyle },
        { content: formatAmount(totalActualAmount), styles: grandStyle },
      ])
    } else {
      body.push([
        { content: 'GRAND TOTAL', colSpan: 6, styles: grandStyle },
        { content: formatAmount(grand.totalAmount), styles: grandStyle },
        { content: formatAmount(grand.gstAmount), styles: grandStyle },
        { content: formatAmount(totalBOQAmount), styles: grandStyle },
        { content: '', styles: grandFillOnly },
        { content: formatAmount(grand.actualAmount), styles: grandStyle },
        { content: formatAmount(totalActualAmount), styles: grandStyle },
      ])
    }

    const colStyles: Record<string, { cellWidth: number; halign?: 'left' | 'center' | 'right' }> =
      isSupplyInstallation
        ? {
            0: { cellWidth: 11, halign: 'center' },
            1: { cellWidth: 60 },
            2: { cellWidth: 12, halign: 'center' },
            3: { cellWidth: 18 },
            4: { cellWidth: 14, halign: 'right' },
            5: { cellWidth: 18, halign: 'right' },
            6: { cellWidth: 18, halign: 'right' },
            7: { cellWidth: 21, halign: 'right' },
            8: { cellWidth: 21, halign: 'right' },
            9: { cellWidth: 14, halign: 'right' },
            10: { cellWidth: 22, halign: 'right' },
            11: { cellWidth: 22, halign: 'right' },
            12: { cellWidth: 22, halign: 'right' },
          }
        : {
            0: { cellWidth: 11, halign: 'center' },
            1: { cellWidth: 65 },
            2: { cellWidth: 22 },
            3: { cellWidth: 12, halign: 'center' },
            4: { cellWidth: 16, halign: 'right' },
            5: { cellWidth: 18, halign: 'right' },
            6: { cellWidth: 22, halign: 'right' },
            7: { cellWidth: 20, halign: 'right' },
            8: { cellWidth: 22, halign: 'right' },
            9: { cellWidth: 16, halign: 'right' },
            10: { cellWidth: 22, halign: 'right' },
            11: { cellWidth: 22, halign: 'right' },
          }

    autoTable(doc, {
      startY: currentY,
      head: [headers],
      body,
      headStyles: { fillColor: [51, 65, 85], textColor: [255, 255, 255], fontSize: 8, halign: 'center', fontStyle: 'bold' },
      bodyStyles: { fontSize: 7.5, cellPadding: 1.5, valign: 'middle' },
      columnStyles: colStyles,
      margin: { left: margin, right: margin, top: 15, bottom: 12 },
      didDrawPage: () => {
        const pageInfo = doc.getCurrentPageInfo()
        const pageCount = doc.getNumberOfPages()
        doc.setFontSize(8)
        doc.setTextColor(100, 116, 139)
        doc.text(
          `Page ${pageInfo.pageNumber} of ${pageCount}  |  ${siteName} - ${pkgName}`,
          pageWidth / 2,
          pageHeight - 5,
          { align: 'center' }
        )
      },
    })

    // Signature block
    const lastTable = (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable
    let finalY = (lastTable?.finalY || currentY) + 18
    if (finalY > pageHeight - 25) {
      doc.addPage()
      finalY = 30
    }
    doc.setDrawColor(15, 23, 42)
    doc.setLineWidth(0.3)
    doc.setFontSize(10)
    doc.setTextColor(15, 23, 42)
    doc.setFont('helvetica', 'normal')
    const signWidth = 80
    const leftX = margin + 20
    const rightX = pageWidth - margin - 20 - signWidth
    doc.line(leftX, finalY, leftX + signWidth, finalY)
    doc.line(rightX, finalY, rightX + signWidth, finalY)
    doc.text('Prepared by', leftX + signWidth / 2, finalY + 5, { align: 'center' })
    doc.text('Approved by', rightX + signWidth / 2, finalY + 5, { align: 'center' })

    doc.save(`RA_Billing_${siteName}_${pkgName}.pdf`)
    toast.success('Exported to PDF')
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
                <Select
                  value={selectedPkg?.actual_source ?? 'execution'}
                  onValueChange={(v) => changeActualSource(v as 'template' | 'execution')}
                  disabled={!selectedPackageId}
                >
                  <SelectTrigger className="w-full sm:w-56" title="Source for Actual Qty">
                    <SelectValue placeholder="Actual source" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="execution">From BOQ Management (Upto Date)</SelectItem>
                    <SelectItem value="template">From Excel Template</SelectItem>
                  </SelectContent>
                </Select>
                {headlines.length > 0 && (
                  <>
                    <Button variant="outline" onClick={exportToExcel}>
                      <Download className="h-4 w-4 mr-2" />
                      Excel
                    </Button>
                    <Button variant="outline" onClick={exportToPDF}>
                      <FileText className="h-4 w-4 mr-2" />
                      PDF
                    </Button>
                  </>
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
                            <div className="text-xs text-slate-500">
                              {row.billingType === 'supply_installation' && 'Supply & Installation · '}
                              {row.actualSource === 'execution' ? 'Actual: Upto Date' : 'Actual: Excel Template'}
                            </div>
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
