'use client'

import { useEffect, useState, useCallback } from 'react'
import * as XLSX from 'xlsx'
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Building2, Package as PackageIcon, FileSpreadsheet, Gauge, Download } from 'lucide-react'
import { toast } from 'sonner'
import {
  fetchSites,
  fetchPackagesForSite,
  fetchHeadlinesForPackages,
  fetchLineItemsForHeadlines,
  fetchOverviewForScope,
  type Site,
  type PackageData,
  type BOQHeadline,
  type BOQLineItem,
  type LineItemOverview,
} from '@/lib/boq-item-workflow'

const ALL_HEADLINES = 'all'

export default function BOQItemOverviewPage() {
  const [sites, setSites] = useState<Site[]>([])
  const [packages, setPackages] = useState<PackageData[]>([])
  const [headlines, setHeadlines] = useState<BOQHeadline[]>([])
  const [selectedSite, setSelectedSite] = useState('')
  const [selectedPackage, setSelectedPackage] = useState('')
  const [selectedHeadline, setSelectedHeadline] = useState(ALL_HEADLINES)

  const [lineItems, setLineItems] = useState<BOQLineItem[]>([])
  const [overview, setOverview] = useState<Map<string, LineItemOverview>>(new Map())
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    fetchSites().then(setSites).catch(() => toast.error('Failed to load sites'))
  }, [])

  useEffect(() => {
    setSelectedPackage('')
    setSelectedHeadline(ALL_HEADLINES)
    setHeadlines([])
    if (!selectedSite) {
      setPackages([])
      return
    }
    fetchPackagesForSite(selectedSite).then(setPackages).catch(() => toast.error('Failed to load packages'))
  }, [selectedSite])

  useEffect(() => {
    setSelectedHeadline(ALL_HEADLINES)
    if (!selectedPackage) {
      setHeadlines([])
      return
    }
    fetchHeadlinesForPackages([selectedPackage]).then(setHeadlines).catch(() => toast.error('Failed to load headlines'))
  }, [selectedPackage])

  const load = useCallback(async () => {
    if (!selectedPackage || headlines.length === 0) {
      setLineItems([])
      setOverview(new Map())
      return
    }
    setLoading(true)
    try {
      const headlineIds = selectedHeadline === ALL_HEADLINES ? headlines.map((h) => h.id) : [selectedHeadline]
      const items = await fetchLineItemsForHeadlines(headlineIds)
      setLineItems(items)
      setOverview(await fetchOverviewForScope(items.map((i) => i.id)))
    } catch {
      toast.error('Failed to load overview')
    } finally {
      setLoading(false)
    }
  }, [selectedPackage, selectedHeadline, headlines])

  useEffect(() => {
    load()
  }, [load])

  function headlineName(headlineId: string) {
    const h = headlines.find((x) => x.id === headlineId)
    return h ? `${h.serial_number}. ${h.name}` : ''
  }

  function rowFor(li: BOQLineItem): LineItemOverview {
    return overview.get(li.id) || { lineItemId: li.id, materialsCount: 0, approvedCount: 0, tdsUploadedCount: 0, testCertCount: 0, raCount: 0, uptoDate: 0 }
  }

  function exportExcel() {
    const rows = [
      ['Item', 'Description', 'BOQ Qty', 'Unit', 'Materials', 'Approved', 'TDS Uploaded', 'Test Certs', 'RA Count', 'Upto Date', 'Remaining', 'Billed %'],
      ...lineItems.map((li) => {
        const o = rowFor(li)
        const remaining = li.quantity - o.uptoDate
        const pct = li.quantity > 0 ? (o.uptoDate / li.quantity) * 100 : 0
        return [li.item_number, li.description, li.quantity, li.unit, o.materialsCount, o.approvedCount, o.tdsUploadedCount, o.testCertCount, o.raCount, o.uptoDate, remaining, Number(pct.toFixed(1))]
      }),
    ]
    const ws = XLSX.utils.aoa_to_sheet(rows)
    ws['!cols'] = [{ wch: 10 }, { wch: 45 }, { wch: 10 }, { wch: 8 }, { wch: 10 }, { wch: 10 }, { wch: 12 }, { wch: 10 }, { wch: 9 }, { wch: 10 }, { wch: 10 }, { wch: 9 }]
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'BOQ Item Overview')
    XLSX.writeFile(wb, 'boq-item-overview.xlsx')
  }

  // Roll-up stats
  const totals = lineItems.reduce(
    (acc, li) => {
      const o = rowFor(li)
      acc.items += 1
      acc.withMaterials += o.materialsCount > 0 ? 1 : 0
      acc.fullyCerted += o.approvedCount > 0 && o.testCertCount >= o.approvedCount ? 1 : 0
      acc.withRa += o.raCount > 0 ? 1 : 0
      return acc
    },
    { items: 0, withMaterials: 0, fullyCerted: 0, withRa: 0 }
  )

  return (
    <div className="flex flex-col min-h-screen">
      <Header title="BOQ Item Overview" />
      <div className="flex-1 p-4 md:p-6 space-y-6">
        <div className="flex items-center gap-2">
          <Gauge className="h-6 w-6 text-teal-600" />
          <div>
            <h2 className="text-lg font-semibold">Compliance &amp; Billing Dashboard</h2>
            <p className="text-sm text-slate-500">Read-only progress per BOQ line item: materials identified, documents collected, and RA billing.</p>
          </div>
        </div>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Select Scope</CardTitle>
            <CardDescription>Choose a site and package; optionally narrow to one headline.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <label className="text-sm font-medium flex items-center gap-1.5"><Building2 className="h-4 w-4 text-slate-400" />Site</label>
                <Select value={selectedSite} onValueChange={setSelectedSite}>
                  <SelectTrigger><SelectValue placeholder="Select site" /></SelectTrigger>
                  <SelectContent>{sites.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium flex items-center gap-1.5"><PackageIcon className="h-4 w-4 text-slate-400" />Package</label>
                <Select value={selectedPackage} onValueChange={setSelectedPackage} disabled={!selectedSite}>
                  <SelectTrigger><SelectValue placeholder={selectedSite ? 'Select package' : 'Select site first'} /></SelectTrigger>
                  <SelectContent>{packages.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium flex items-center gap-1.5"><FileSpreadsheet className="h-4 w-4 text-slate-400" />Headline</label>
                <Select value={selectedHeadline} onValueChange={setSelectedHeadline} disabled={!selectedPackage}>
                  <SelectTrigger><SelectValue placeholder="All headlines" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ALL_HEADLINES}>All Headlines</SelectItem>
                    {headlines.map((h) => <SelectItem key={h.id} value={h.id}>{h.serial_number}. {h.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {!selectedPackage ? (
          <Card><CardContent className="py-12 text-center"><Gauge className="h-12 w-12 mx-auto text-slate-300 mb-4" /><h3 className="text-lg font-medium text-slate-900 mb-1">Select a Package</h3><p className="text-slate-500">Choose a site and package to view the line-item dashboard.</p></CardContent></Card>
        ) : loading ? (
          <Card><CardContent className="py-12 text-center text-slate-500">Loading dashboard…</CardContent></Card>
        ) : (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Card><CardContent className="pt-4 text-center"><p className="text-2xl font-bold text-slate-900">{totals.items}</p><p className="text-sm text-slate-500">Line Items</p></CardContent></Card>
              <Card><CardContent className="pt-4 text-center"><p className="text-2xl font-bold text-cyan-600">{totals.withMaterials}</p><p className="text-sm text-slate-500">With Materials</p></CardContent></Card>
              <Card><CardContent className="pt-4 text-center"><p className="text-2xl font-bold text-green-600">{totals.fullyCerted}</p><p className="text-sm text-slate-500">Test Certs Complete</p></CardContent></Card>
              <Card><CardContent className="pt-4 text-center"><p className="text-2xl font-bold text-teal-600">{totals.withRa}</p><p className="text-sm text-slate-500">RA Started</p></CardContent></Card>
            </div>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0">
                <CardTitle className="text-base">Line Items {selectedHeadline !== ALL_HEADLINES && `— ${headlineName(selectedHeadline)}`}</CardTitle>
                <Button variant="outline" size="sm" onClick={exportExcel} disabled={lineItems.length === 0}><Download className="h-4 w-4 mr-1.5" />Export</Button>
              </CardHeader>
              <CardContent>
                {lineItems.length === 0 ? (
                  <p className="text-sm text-slate-400 py-6 text-center">No line items in this scope.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-[80px]">Item</TableHead>
                          <TableHead>Description</TableHead>
                          <TableHead className="text-right">BOQ Qty</TableHead>
                          <TableHead className="text-center">Materials</TableHead>
                          <TableHead className="text-center">Approved</TableHead>
                          <TableHead className="text-center">TDS</TableHead>
                          <TableHead className="text-center">Test Certs</TableHead>
                          <TableHead className="text-center">RA</TableHead>
                          <TableHead className="text-right">Upto Date</TableHead>
                          <TableHead className="text-right">Remaining</TableHead>
                          <TableHead className="text-right">Billed</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {lineItems.map((li) => {
                          const o = rowFor(li)
                          const remaining = li.quantity - o.uptoDate
                          const pct = li.quantity > 0 ? (o.uptoDate / li.quantity) * 100 : 0
                          const certComplete = o.approvedCount > 0 && o.testCertCount >= o.approvedCount
                          return (
                            <TableRow key={li.id}>
                              <TableCell className="font-mono text-cyan-700">{li.item_number}</TableCell>
                              <TableCell className="max-w-[320px]"><span className="text-sm whitespace-normal break-words">{li.description}</span></TableCell>
                              <TableCell className="text-right">{li.quantity.toLocaleString('en-IN', { maximumFractionDigits: 2 })} {li.unit}</TableCell>
                              <TableCell className="text-center">{o.materialsCount}</TableCell>
                              <TableCell className="text-center">{o.approvedCount}</TableCell>
                              <TableCell className="text-center">{o.approvedCount > 0 ? `${o.tdsUploadedCount}/${o.approvedCount}` : '—'}</TableCell>
                              <TableCell className="text-center">
                                {o.approvedCount > 0 ? (
                                  <Badge variant="secondary" className={`text-xs ${certComplete ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-600'}`}>{o.testCertCount}/{o.approvedCount}</Badge>
                                ) : '—'}
                              </TableCell>
                              <TableCell className="text-center">{o.raCount || '—'}</TableCell>
                              <TableCell className="text-right">{o.uptoDate.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</TableCell>
                              <TableCell className={`text-right ${remaining < 0 ? 'text-blue-600' : ''}`}>{remaining.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</TableCell>
                              <TableCell className="text-right font-medium">{pct.toFixed(0)}%</TableCell>
                            </TableRow>
                          )
                        })}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </div>
  )
}
