'use client'

import { useState, useEffect } from 'react'
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
import { Badge } from '@/components/ui/badge'
import {
  FileSpreadsheet,
  Building2,
  Package,
  Download,
  CheckCircle2,
  XCircle,
  MinusCircle,
  Filter,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'

interface Site {
  id: string
  name: string
  location: string | null
}

interface Package {
  id: string
  site_id: string
  name: string
  code: string | null
}

interface BOQHeadline {
  id: string
  package_id: string
  serial_number: number
  name: string
}

interface MIRData {
  package_name: string
  boq_line_no: string
  invoice_no: string | null
  receipt_date: string | null
  material_name: string
  material_id: string
  quantity: number
  unit: string
  dc_status: 'Y' | 'N' | 'NA'
  mir_status: 'Y' | 'N' | 'NA'
  test_cert_status: 'Y' | 'N' | 'NA'
  tds_status: 'Y' | 'N' | 'NA'
}

export default function MIRViewPage() {
  const [sites, setSites] = useState<Site[]>([])
  const [packages, setPackages] = useState<Package[]>([])
  const [boqHeadlines, setBoqHeadlines] = useState<BOQHeadline[]>([])
  const [selectedSite, setSelectedSite] = useState<string>('')
  const [selectedPackage, setSelectedPackage] = useState<string>('')
  const [selectedHeadline, setSelectedHeadline] = useState<string>('')
  const [mirData, setMirData] = useState<MIRData[]>([])
  const [loading, setLoading] = useState(false)
  const [loadingSites, setLoadingSites] = useState(true)

  // Fetch sites on mount
  useEffect(() => {
    fetchSites()
  }, [])

  // Fetch packages when site changes
  useEffect(() => {
    if (selectedSite) {
      fetchPackages(selectedSite)
      setSelectedPackage('')
      setSelectedHeadline('')
      setBoqHeadlines([])
      setMirData([])
    }
  }, [selectedSite])

  // Fetch BOQ headlines when package changes
  useEffect(() => {
    if (selectedPackage) {
      fetchBoqHeadlines(selectedPackage)
      setSelectedHeadline('')
      setMirData([])
    }
  }, [selectedPackage])

  // Fetch MIR data when headline changes
  useEffect(() => {
    if (selectedHeadline) {
      fetchMIRData(selectedHeadline)
    }
  }, [selectedHeadline])

  async function fetchSites() {
    try {
      const { data, error } = await supabase
        .from('sites')
        .select('*')
        .order('name')

      if (error) throw error
      setSites(data || [])
    } catch (error) {
      console.error('Error fetching sites:', error)
      toast.error('Failed to load sites')
    } finally {
      setLoadingSites(false)
    }
  }

  async function fetchPackages(siteId: string) {
    try {
      const { data, error } = await supabase
        .from('packages')
        .select('*')
        .eq('site_id', siteId)
        .order('name')

      if (error) throw error
      setPackages(data || [])
    } catch (error) {
      console.error('Error fetching packages:', error)
      toast.error('Failed to load packages')
    }
  }

  async function fetchBoqHeadlines(packageId: string) {
    try {
      const { data, error } = await supabase
        .from('boq_headlines')
        .select('*')
        .eq('package_id', packageId)
        .order('serial_number')

      if (error) throw error
      setBoqHeadlines(data || [])
    } catch (error) {
      console.error('Error fetching BOQ headlines:', error)
      toast.error('Failed to load BOQ headlines')
    }
  }

  async function fetchMIRData(headlineId: string) {
    setLoading(true)
    try {
      // Get headline info
      const { data: headline } = await supabase
        .from('boq_headlines')
        .select('name')
        .eq('id', headlineId)
        .single()

      // Get line items
      const { data: lineItems } = await supabase
        .from('boq_line_items')
        .select('*')
        .eq('headline_id', headlineId)
        .order('item_number')

      if (!lineItems || lineItems.length === 0) {
        setMirData([])
        setLoading(false)
        return
      }

      const lineItemIds = lineItems.map(li => li.id)

      // Get materials
      const { data: materials } = await supabase
        .from('materials')
        .select('*')
        .in('line_item_id', lineItemIds)

      if (!materials || materials.length === 0) {
        setMirData([])
        setLoading(false)
        return
      }

      const materialIds = materials.map(m => m.id)

      // Get receipts
      const { data: receipts } = await supabase
        .from('material_receipts')
        .select('*')
        .in('material_id', materialIds)
        .order('receipt_date', { ascending: false })

      // Get compliance documents
      const { data: complianceDocs } = await supabase
        .from('compliance_documents')
        .select('*')
        .in('material_id', materialIds)

      // Build MIR data
      const mirRows: MIRData[] = []

      materials.forEach(material => {
        const lineItem = lineItems.find(li => li.id === material.line_item_id)
        const materialReceipts = (receipts || []).filter(r => r.material_id === material.id)
        const materialCompliance = (complianceDocs || []).filter(c => c.material_id === material.id)

        // Get compliance status
        const getComplianceStatus = (docType: string): 'Y' | 'N' | 'NA' => {
          const doc = materialCompliance.find(c => c.document_type === docType)
          if (!doc) return 'N'
          if (!doc.is_applicable) return 'NA'
          return doc.is_uploaded ? 'Y' : 'N'
        }

        if (materialReceipts.length > 0) {
          // Add a row for each receipt
          materialReceipts.forEach(receipt => {
            mirRows.push({
              package_name: headline?.name || '',
              boq_line_no: lineItem?.item_number || '',
              invoice_no: receipt.invoice_number,
              receipt_date: receipt.receipt_date,
              material_name: material.name,
              material_id: material.id,
              quantity: receipt.quantity_received,
              unit: material.unit,
              dc_status: getComplianceStatus('dc'),
              mir_status: getComplianceStatus('mir'),
              test_cert_status: getComplianceStatus('test_certificate'),
              tds_status: getComplianceStatus('tds'),
            })
          })
        } else {
          // Add a row for material without receipts
          mirRows.push({
            package_name: headline?.name || '',
            boq_line_no: lineItem?.item_number || '',
            invoice_no: null,
            receipt_date: null,
            material_name: material.name,
            material_id: material.id,
            quantity: 0,
            unit: material.unit,
            dc_status: getComplianceStatus('dc'),
            mir_status: getComplianceStatus('mir'),
            test_cert_status: getComplianceStatus('test_certificate'),
            tds_status: getComplianceStatus('tds'),
          })
        }
      })

      // Sort by BOQ line number
      mirRows.sort((a, b) => {
        const aNum = parseFloat(a.boq_line_no) || 0
        const bNum = parseFloat(b.boq_line_no) || 0
        return aNum - bNum
      })

      setMirData(mirRows)
    } catch (error) {
      console.error('Error fetching MIR data:', error)
      toast.error('Failed to load MIR data')
    } finally {
      setLoading(false)
    }
  }

  function getStatusBadge(status: 'Y' | 'N' | 'NA') {
    switch (status) {
      case 'Y':
        return (
          <Badge className="bg-green-100 text-green-700 hover:bg-green-100">
            <CheckCircle2 className="h-3 w-3 mr-1" />
            Y
          </Badge>
        )
      case 'N':
        return (
          <Badge className="bg-red-100 text-red-700 hover:bg-red-100">
            <XCircle className="h-3 w-3 mr-1" />
            N
          </Badge>
        )
      case 'NA':
        return (
          <Badge className="bg-slate-100 text-slate-500 hover:bg-slate-100">
            <MinusCircle className="h-3 w-3 mr-1" />
            NA
          </Badge>
        )
    }
  }

  // Calculate summary stats
  const totalMaterials = new Set(mirData.map(r => r.material_id)).size
  const totalReceipts = mirData.filter(r => r.receipt_date).length
  const compliantDocs = mirData.filter(r =>
    r.dc_status !== 'N' && r.mir_status !== 'N' && r.test_cert_status !== 'N' && r.tds_status !== 'N'
  ).length

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <FileSpreadsheet className="h-6 w-6" />
            MIR View
          </h1>
          <p className="text-slate-500 mt-1">
            Material Inspection Report - View materials, receipts, and compliance status
          </p>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-lg flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Select Site, Package & Work Category
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Site</label>
              <Select value={selectedSite} onValueChange={setSelectedSite}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a site..." />
                </SelectTrigger>
                <SelectContent>
                  {sites.map((site) => (
                    <SelectItem key={site.id} value={site.id}>
                      <div className="flex items-center gap-2">
                        <Building2 className="h-4 w-4" />
                        {site.name}
                        {site.location && (
                          <span className="text-slate-400">- {site.location}</span>
                        )}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">Package</label>
              <Select
                value={selectedPackage}
                onValueChange={setSelectedPackage}
                disabled={!selectedSite}
              >
                <SelectTrigger>
                  <SelectValue placeholder={selectedSite ? "Select a package..." : "Select site first"} />
                </SelectTrigger>
                <SelectContent>
                  {packages.map((pkg) => (
                    <SelectItem key={pkg.id} value={pkg.id}>
                      <div className="flex items-center gap-2">
                        <Package className="h-4 w-4" />
                        {pkg.name}
                        {pkg.code && (
                          <span className="text-slate-400">({pkg.code})</span>
                        )}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">Work Category</label>
              <Select
                value={selectedHeadline}
                onValueChange={setSelectedHeadline}
                disabled={!selectedPackage}
              >
                <SelectTrigger>
                  <SelectValue placeholder={selectedPackage ? "Select work category..." : "Select package first"} />
                </SelectTrigger>
                <SelectContent>
                  {boqHeadlines.map((headline) => (
                    <SelectItem key={headline.id} value={headline.id}>
                      <div className="flex items-center gap-2">
                        <FileSpreadsheet className="h-4 w-4" />
                        {headline.serial_number}. {headline.name}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Summary Stats */}
      {selectedHeadline && mirData.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <p className="text-3xl font-bold text-blue-600">{totalMaterials}</p>
                <p className="text-sm text-slate-500">Materials</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <p className="text-3xl font-bold text-green-600">{totalReceipts}</p>
                <p className="text-sm text-slate-500">Receipts</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <p className="text-3xl font-bold text-purple-600">{mirData.length}</p>
                <p className="text-sm text-slate-500">Total Entries</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <p className="text-3xl font-bold text-amber-600">
                  {mirData.length > 0 ? Math.round((compliantDocs / mirData.length) * 100) : 0}%
                </p>
                <p className="text-sm text-slate-500">Docs Complete</p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Data Table */}
      <Card>
        <CardHeader>
          <CardTitle>Material Inspection Records</CardTitle>
          <CardDescription>
            {selectedHeadline
              ? `Showing ${mirData.length} records for selected work category`
              : 'Select a site, package and work category to view records'
            }
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
              <p className="text-slate-500 mt-4">Loading data...</p>
            </div>
          ) : !selectedHeadline ? (
            <div className="text-center py-12">
              <FileSpreadsheet className="h-12 w-12 mx-auto text-slate-300 mb-4" />
              <h3 className="text-lg font-medium text-slate-900 mb-2">No Work Category Selected</h3>
              <p className="text-slate-500">Select a site, package and work category to view the MIR data.</p>
            </div>
          ) : mirData.length === 0 ? (
            <div className="text-center py-12">
              <Package className="h-12 w-12 mx-auto text-slate-300 mb-4" />
              <h3 className="text-lg font-medium text-slate-900 mb-2">No Materials Found</h3>
              <p className="text-slate-500">No materials have been added to this work category yet.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50">
                    <TableHead className="font-semibold">Work Category</TableHead>
                    <TableHead className="font-semibold">BOQ Line</TableHead>
                    <TableHead className="font-semibold">Invoice No.</TableHead>
                    <TableHead className="font-semibold">Date</TableHead>
                    <TableHead className="font-semibold">Description</TableHead>
                    <TableHead className="font-semibold text-right">Qty</TableHead>
                    <TableHead className="font-semibold">Unit</TableHead>
                    <TableHead className="font-semibold text-center">DC</TableHead>
                    <TableHead className="font-semibold text-center">MIR</TableHead>
                    <TableHead className="font-semibold text-center">Test Cert</TableHead>
                    <TableHead className="font-semibold text-center">TDS</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {mirData.map((row, index) => (
                    <TableRow key={`${row.material_id}-${index}`} className="hover:bg-slate-50">
                      <TableCell className="font-medium">{row.package_name}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{row.boq_line_no}</Badge>
                      </TableCell>
                      <TableCell>{row.invoice_no || '-'}</TableCell>
                      <TableCell>
                        {row.receipt_date
                          ? new Date(row.receipt_date).toLocaleDateString('en-IN', {
                              day: '2-digit',
                              month: '2-digit',
                              year: 'numeric'
                            })
                          : '-'
                        }
                      </TableCell>
                      <TableCell className="max-w-[200px] truncate" title={row.material_name}>
                        {row.material_name}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {row.quantity > 0 ? row.quantity : '-'}
                      </TableCell>
                      <TableCell>{row.unit}</TableCell>
                      <TableCell className="text-center">{getStatusBadge(row.dc_status)}</TableCell>
                      <TableCell className="text-center">{getStatusBadge(row.mir_status)}</TableCell>
                      <TableCell className="text-center">{getStatusBadge(row.test_cert_status)}</TableCell>
                      <TableCell className="text-center">{getStatusBadge(row.tds_status)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
