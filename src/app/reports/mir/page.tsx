'use client'

import { useState, useEffect } from 'react'
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
  Building2,
  FileText,
  Download,
  Loader2,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

interface Site {
  id: string
  name: string
}

interface Supplier {
  id: string
  supplier_name: string
}

interface GRNLineItemDocument {
  id: string
  grn_line_item_id: string
  document_type: 'mir' | 'test_certificate' | 'tds'
  is_applicable: boolean
  is_uploaded: boolean
}

interface GRNLineItem {
  id: string
  grn_invoice_id: string
  material_id: string | null
  material_name: string
  quantity: number
  unit: string
  rate: number
  gst_rate: number
  amount_without_gst: number
  amount_with_gst: number
  notes: string | null
  documents: GRNLineItemDocument[]
}

interface GRNInvoiceDC {
  id: string
  grn_invoice_id: string
  is_applicable: boolean
  is_uploaded: boolean
  file_path: string | null
}

interface GRNInvoice {
  id: string
  site_id: string
  supplier_id: string
  invoice_number: string
  invoice_date: string | null
  grn_date: string
  notes: string | null
  supplier: Supplier | null
  dc: GRNInvoiceDC | null
  line_items: GRNLineItem[]
}

interface MIROption {
  value: string      // GRN date (YYYY-MM-DD)
  label: string      // "MIR 1 - 22 Jan 2026"
  mirNumber: number  // 1, 2, 3, etc.
  formattedDate: string
}

interface MIRReportRow {
  sno: number
  invoiceNumber: string
  material: string
  qty: number
  unit: string
  dc: 'Y' | 'N' | 'NA'
  testCert: 'Y' | 'N' | 'NA'
  tds: 'Y' | 'N' | 'NA'
}

export default function MIRReportsPage() {
  const [sites, setSites] = useState<Site[]>([])
  const [selectedSiteId, setSelectedSiteId] = useState<string>('')
  const [invoiceList, setInvoiceList] = useState<GRNInvoice[]>([])
  const [mirOptions, setMirOptions] = useState<MIROption[]>([])
  const [selectedMirDate, setSelectedMirDate] = useState<string>('')
  const [reportData, setReportData] = useState<MIRReportRow[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingInvoices, setLoadingInvoices] = useState(false)

  // Fetch sites on mount
  useEffect(() => {
    fetchSites()
  }, [])

  // Fetch invoices when site changes
  useEffect(() => {
    if (selectedSiteId) {
      fetchInvoices()
    } else {
      setInvoiceList([])
      setMirOptions([])
      setSelectedMirDate('')
      setReportData([])
    }
  }, [selectedSiteId])

  // Generate report data when MIR selection changes
  useEffect(() => {
    if (selectedMirDate) {
      generateReportData()
    } else {
      setReportData([])
    }
  }, [selectedMirDate, invoiceList])

  async function fetchSites() {
    try {
      const { data, error } = await supabase
        .from('sites')
        .select('id, name')
        .order('name')

      if (error) throw error
      setSites(data || [])
    } catch (error) {
      toast.error('Failed to load sites')
    } finally {
      setLoading(false)
    }
  }

  async function fetchInvoices() {
    setLoadingInvoices(true)
    try {
      const { data, error } = await supabase
        .from('grn_invoices')
        .select(`
          *,
          supplier:suppliers(id, supplier_name),
          dc:grn_invoice_dc(*),
          line_items:grn_line_items(
            *,
            documents:grn_line_item_documents(*)
          )
        `)
        .eq('site_id', selectedSiteId)
        .order('grn_date', { ascending: true })

      if (error) throw error

      // Transform data (handle array to single object for joins)
      const transformedData = (data || []).map((inv: any) => ({
        ...inv,
        supplier: Array.isArray(inv.supplier) ? inv.supplier[0] : inv.supplier,
        dc: Array.isArray(inv.dc) ? inv.dc[0] : inv.dc,
        line_items: (inv.line_items || []).map((li: any) => ({
          ...li,
          documents: li.documents || []
        }))
      }))

      setInvoiceList(transformedData)

      // Build MIR options from unique GRN dates
      const uniqueDates = [...new Set(transformedData.map((inv: GRNInvoice) => inv.grn_date))].sort()
      const options: MIROption[] = uniqueDates.map((date, idx) => {
        const d = new Date(date)
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
        const formattedDate = `${d.getDate().toString().padStart(2, '0')} ${months[d.getMonth()]} ${d.getFullYear()}`
        return {
          value: date,
          label: `MIR ${idx + 1} - ${formattedDate}`,
          mirNumber: idx + 1,
          formattedDate
        }
      })

      setMirOptions(options)
      setSelectedMirDate('')
      setReportData([])
    } catch (error) {
      toast.error('Failed to load invoices')
    } finally {
      setLoadingInvoices(false)
    }
  }

  function generateReportData() {
    const selectedInvoices = invoiceList.filter(inv => inv.grn_date === selectedMirDate)
    let sno = 1

    const rows: MIRReportRow[] = selectedInvoices.flatMap(inv => {
      return inv.line_items.map((li, itemIdx) => {
        // DC status (from invoice level)
        let dcStatus: 'Y' | 'N' | 'NA' = 'N'
        if (inv.dc) {
          if (!inv.dc.is_applicable) {
            dcStatus = 'NA'
          } else {
            dcStatus = inv.dc.is_uploaded ? 'Y' : 'N'
          }
        }

        // Test Certificate status
        const testDoc = li.documents.find(d => d.document_type === 'test_certificate')
        let testStatus: 'Y' | 'N' | 'NA' = 'N'
        if (testDoc) {
          if (!testDoc.is_applicable) {
            testStatus = 'NA'
          } else {
            testStatus = testDoc.is_uploaded ? 'Y' : 'N'
          }
        }

        // TDS status
        const tdsDoc = li.documents.find(d => d.document_type === 'tds')
        let tdsStatus: 'Y' | 'N' | 'NA' = 'N'
        if (tdsDoc) {
          if (!tdsDoc.is_applicable) {
            tdsStatus = 'NA'
          } else {
            tdsStatus = tdsDoc.is_uploaded ? 'Y' : 'N'
          }
        }

        return {
          sno: sno++,
          invoiceNumber: inv.invoice_number,
          material: li.material_name,
          qty: li.quantity,
          unit: li.unit,
          dc: itemIdx === 0 ? dcStatus : 'N' as 'Y' | 'N' | 'NA', // DC only on first item of invoice
          testCert: testStatus,
          tds: tdsStatus
        }
      })
    })

    setReportData(rows)
  }

  function generatePDF() {
    const selectedMir = mirOptions.find(m => m.value === selectedMirDate)
    if (!selectedMir) {
      toast.error('Please select a MIR')
      return
    }

    const siteName = sites.find(s => s.id === selectedSiteId)?.name || 'Unknown Site'

    const doc = new jsPDF()

    // Title
    doc.setFontSize(16)
    doc.setFont('helvetica', 'bold')
    doc.text('MATERIAL INSPECTION REPORT', 105, 20, { align: 'center' })

    // Site and MIR info
    doc.setFontSize(11)
    doc.setFont('helvetica', 'normal')
    doc.text(`Site: ${siteName}`, 14, 35)
    doc.text(`MIR Reference: MIR ${selectedMir.mirNumber}`, 14, 42)
    doc.text(`Date: ${selectedMir.formattedDate}`, 14, 49)

    // Table
    autoTable(doc, {
      startY: 60,
      head: [['S.No', 'Material', 'Qty', 'Unit', 'DC', 'Test Cert', 'TDS']],
      body: reportData.map(row => [
        row.sno,
        row.material,
        row.qty,
        row.unit,
        row.dc,
        row.testCert,
        row.tds
      ]),
      headStyles: {
        fillColor: [51, 65, 85],
        fontSize: 10,
        fontStyle: 'bold'
      },
      bodyStyles: {
        fontSize: 9
      },
      columnStyles: {
        0: { cellWidth: 15, halign: 'center' },  // S.No
        1: { cellWidth: 80 },  // Material
        2: { cellWidth: 20, halign: 'right' },  // Qty
        3: { cellWidth: 20, halign: 'center' },  // Unit
        4: { cellWidth: 15, halign: 'center' },  // DC
        5: { cellWidth: 20, halign: 'center' },  // Test Cert
        6: { cellWidth: 15, halign: 'center' },  // TDS
      },
      margin: { left: 14, right: 14 }
    })

    // Get the final Y position after the table
    const finalY = (doc as any).lastAutoTable.finalY + 30

    // Check if we need a new page for signatures
    if (finalY > 250) {
      doc.addPage()
      drawSignatureSection(doc, 40)
    } else {
      drawSignatureSection(doc, finalY)
    }

    // Save
    const dateStr = selectedMir.formattedDate.replace(/ /g, '-')
    const filename = `MIR_${selectedMir.mirNumber}_${siteName.replace(/[^a-zA-Z0-9]/g, '_')}_${dateStr}.pdf`
    doc.save(filename)
    toast.success('PDF downloaded successfully')
  }

  function drawSignatureSection(doc: jsPDF, startY: number) {
    doc.setFontSize(10)
    doc.setFont('helvetica', 'normal')

    // Prepared by
    doc.text('Prepared by: _______________________', 14, startY)
    doc.setFontSize(8)
    doc.text('(Name & Signature)', 35, startY + 6)

    // Approved by
    doc.setFontSize(10)
    doc.text('Approved by: _______________________', 120, startY)
    doc.setFontSize(8)
    doc.text('(Name & Signature)', 141, startY + 6)

    // Date lines
    doc.setFontSize(10)
    doc.text('Date: _____________', 14, startY + 18)
    doc.text('Date: _____________', 120, startY + 18)
  }

  if (loading) {
    return (
      <div className="flex flex-col min-h-screen">
        <Header title="MIR Reports" />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <Loader2 className="h-8 w-8 animate-spin text-blue-600 mx-auto mb-4" />
            <p className="text-slate-500">Loading...</p>
          </div>
        </div>
      </div>
    )
  }

  const selectedMir = mirOptions.find(m => m.value === selectedMirDate)

  return (
    <div className="flex flex-col min-h-screen">
      <Header title="MIR Reports" />

      <div className="flex-1 p-4 md:p-6 space-y-6">
        {/* Header Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              MIR Reports
            </CardTitle>
            <CardDescription>
              Generate Material Inspection Reports for individual MIRs
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Site Selector */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">Site</label>
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

              {/* MIR Selector */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">MIR Reference</label>
                <Select
                  value={selectedMirDate}
                  onValueChange={setSelectedMirDate}
                  disabled={!selectedSiteId || loadingInvoices || mirOptions.length === 0}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={loadingInvoices ? "Loading..." : "Select MIR"} />
                  </SelectTrigger>
                  <SelectContent>
                    {mirOptions.map((mir) => (
                      <SelectItem key={mir.value} value={mir.value}>
                        {mir.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Download Button */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">&nbsp;</label>
                <Button
                  onClick={generatePDF}
                  disabled={!selectedMirDate || reportData.length === 0}
                  className="w-full"
                >
                  <Download className="h-4 w-4 mr-2" />
                  Download PDF
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Preview Card */}
        {selectedMirDate && reportData.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Preview</CardTitle>
              <CardDescription>
                {selectedMir?.label} - {sites.find(s => s.id === selectedSiteId)?.name}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-100">
                      <TableHead className="w-16 text-center">S.No</TableHead>
                      <TableHead>Material</TableHead>
                      <TableHead className="w-20 text-right">Qty</TableHead>
                      <TableHead className="w-20 text-center">Unit</TableHead>
                      <TableHead className="w-16 text-center">DC</TableHead>
                      <TableHead className="w-24 text-center">Test Cert</TableHead>
                      <TableHead className="w-16 text-center">TDS</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {reportData.map((row) => (
                      <TableRow key={row.sno}>
                        <TableCell className="text-center">{row.sno}</TableCell>
                        <TableCell>{row.material}</TableCell>
                        <TableCell className="text-right">{row.qty}</TableCell>
                        <TableCell className="text-center">{row.unit}</TableCell>
                        <TableCell className="text-center">
                          <span className={
                            row.dc === 'Y' ? 'text-green-600 font-medium' :
                            row.dc === 'NA' ? 'text-slate-400' :
                            'text-red-600 font-medium'
                          }>
                            {row.dc}
                          </span>
                        </TableCell>
                        <TableCell className="text-center">
                          <span className={
                            row.testCert === 'Y' ? 'text-green-600 font-medium' :
                            row.testCert === 'NA' ? 'text-slate-400' :
                            'text-red-600 font-medium'
                          }>
                            {row.testCert}
                          </span>
                        </TableCell>
                        <TableCell className="text-center">
                          <span className={
                            row.tds === 'Y' ? 'text-green-600 font-medium' :
                            row.tds === 'NA' ? 'text-slate-400' :
                            'text-red-600 font-medium'
                          }>
                            {row.tds}
                          </span>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Signature Preview */}
              <div className="mt-8 pt-8 border-t">
                <div className="flex justify-between">
                  <div>
                    <p className="text-sm text-slate-600">Prepared by: _______________________</p>
                    <p className="text-xs text-slate-400 mt-1 ml-16">(Name & Signature)</p>
                    <p className="text-sm text-slate-600 mt-4">Date: _____________</p>
                  </div>
                  <div>
                    <p className="text-sm text-slate-600">Approved by: _______________________</p>
                    <p className="text-xs text-slate-400 mt-1 ml-16">(Name & Signature)</p>
                    <p className="text-sm text-slate-600 mt-4">Date: _____________</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Empty State */}
        {!selectedSiteId && (
          <Card>
            <CardContent className="py-12">
              <div className="text-center">
                <Building2 className="h-12 w-12 mx-auto text-slate-300 mb-4" />
                <h3 className="text-lg font-medium text-slate-900 mb-2">Select a Site</h3>
                <p className="text-slate-500">Choose a site to view available MIR reports</p>
              </div>
            </CardContent>
          </Card>
        )}

        {selectedSiteId && !loadingInvoices && mirOptions.length === 0 && (
          <Card>
            <CardContent className="py-12">
              <div className="text-center">
                <FileText className="h-12 w-12 mx-auto text-slate-300 mb-4" />
                <h3 className="text-lg font-medium text-slate-900 mb-2">No MIR Data</h3>
                <p className="text-slate-500">No GRN entries found for this site. Add GRN entries first.</p>
              </div>
            </CardContent>
          </Card>
        )}

        {selectedSiteId && loadingInvoices && (
          <Card>
            <CardContent className="py-12">
              <div className="text-center">
                <Loader2 className="h-8 w-8 animate-spin text-blue-600 mx-auto mb-4" />
                <p className="text-slate-500">Loading MIR data...</p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
