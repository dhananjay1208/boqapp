'use client'

import { useState, useEffect, useMemo } from 'react'
import { Header } from '@/components/layout/header'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Building2,
  Loader2,
  CreditCard,
  ArrowLeft,
  FileText,
  Check,
  IndianRupee,
  Receipt,
  Clock,
  CheckCircle2,
  ExternalLink,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

interface Site {
  id: string
  name: string
}

interface Supplier {
  id: string
  supplier_name: string
  gstin: string | null
}

interface GrnInvoice {
  id: string
  site_id: string
  supplier_id: string
  invoice_number: string
  grn_date: string
  supplier: Supplier
}

interface GrnLineItem {
  id: string
  grn_invoice_id: string
  material_id: string
  material_name: string
  quantity: number
  unit: string
  rate: number
  gst_rate: number
  amount_without_gst: number
  amount_with_gst: number
}

interface GrnInvoiceDc {
  id: string
  grn_invoice_id: string
  is_applicable: boolean
  is_uploaded: boolean
  file_path: string | null
  file_name: string | null
}

interface SupplierInvoicePayment {
  id: string
  site_id: string
  supplier_id: string
  invoice_number: string
  payment_status: 'pending' | 'paid'
  payment_reference: string | null
  paid_at: string | null
  paid_by: string | null
  notes: string | null
}

interface SupplierSummary {
  supplier_id: string
  supplier_name: string
  gstin: string | null
  total_invoices: number
  pending_count: number
  paid_count: number
  pending_amount: number
  paid_amount: number
}

interface InvoiceDetail {
  invoice_number: string
  supplier_id: string
  supplier_name: string
  amount_without_gst: number
  gst_amount: number
  total_amount: number
  dc_uploaded: boolean
  dc_file_path: string | null
  dc_file_name: string | null
  payment_status: 'pending' | 'paid'
  payment_reference: string | null
  paid_at: string | null
  grn_count: number
}

export default function SupplierInvoicesPage() {
  const [sites, setSites] = useState<Site[]>([])
  const [selectedSiteId, setSelectedSiteId] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [loadingData, setLoadingData] = useState(false)

  // Raw data from database
  const [grnInvoices, setGrnInvoices] = useState<GrnInvoice[]>([])
  const [grnLineItems, setGrnLineItems] = useState<GrnLineItem[]>([])
  const [grnDcDocs, setGrnDcDocs] = useState<GrnInvoiceDc[]>([])
  const [payments, setPayments] = useState<SupplierInvoicePayment[]>([])

  // UI state
  const [selectedSupplier, setSelectedSupplier] = useState<SupplierSummary | null>(null)
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false)
  const [selectedInvoice, setSelectedInvoice] = useState<InvoiceDetail | null>(null)
  const [paymentReference, setPaymentReference] = useState('')
  const [paymentNotes, setPaymentNotes] = useState('')
  const [savingPayment, setSavingPayment] = useState(false)

  useEffect(() => {
    fetchSites()
  }, [])

  useEffect(() => {
    if (selectedSiteId) {
      fetchData()
    } else {
      setGrnInvoices([])
      setGrnLineItems([])
      setGrnDcDocs([])
      setPayments([])
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

      if (data && data.length > 0) {
        setSelectedSiteId(data[0].id)
      }
    } catch (error) {
      console.error('Error fetching sites:', error)
      toast.error('Failed to load sites')
    } finally {
      setLoading(false)
    }
  }

  async function fetchData() {
    setLoadingData(true)
    try {
      // Fetch all GRN invoices for the site with supplier data
      const { data: invoicesData, error: invoicesError } = await supabase
        .from('grn_invoices')
        .select(`
          id,
          site_id,
          supplier_id,
          invoice_number,
          grn_date,
          supplier:suppliers(id, supplier_name, gstin)
        `)
        .eq('site_id', selectedSiteId)

      if (invoicesError) throw invoicesError

      // Transform to handle the joined supplier data
      const invoices: GrnInvoice[] = (invoicesData || []).map((inv: any) => ({
        ...inv,
        supplier: inv.supplier
      }))

      setGrnInvoices(invoices)

      if (invoices.length === 0) {
        setGrnLineItems([])
        setGrnDcDocs([])
        setPayments([])
        setLoadingData(false)
        return
      }

      const invoiceIds = invoices.map(inv => inv.id)

      // Fetch all line items for these invoices
      const { data: lineItemsData, error: lineItemsError } = await supabase
        .from('grn_line_items')
        .select('*')
        .in('grn_invoice_id', invoiceIds)

      if (lineItemsError) throw lineItemsError
      setGrnLineItems(lineItemsData || [])

      // Fetch DC documents for these invoices
      const { data: dcData, error: dcError } = await supabase
        .from('grn_invoice_dc')
        .select('*')
        .in('grn_invoice_id', invoiceIds)

      if (dcError) throw dcError
      setGrnDcDocs(dcData || [])

      // Fetch payment records for this site (handle gracefully if table doesn't exist)
      try {
        const { data: paymentsData, error: paymentsError } = await supabase
          .from('supplier_invoice_payments')
          .select('*')
          .eq('site_id', selectedSiteId)

        if (paymentsError) {
          console.warn('Could not fetch payments (table may not exist yet):', paymentsError.message)
          setPayments([])
        } else {
          setPayments(paymentsData || [])
        }
      } catch (paymentError) {
        console.warn('Payment table query failed:', paymentError)
        setPayments([])
      }

    } catch (error) {
      console.error('Error fetching data:', error)
      toast.error('Failed to load invoice data')
    } finally {
      setLoadingData(false)
    }
  }

  // Aggregate data by (invoice_number, supplier_id)
  const invoiceAggregates = useMemo(() => {
    const aggregates: { [key: string]: InvoiceDetail } = {}

    grnInvoices.forEach(inv => {
      const key = `${inv.supplier_id}|${inv.invoice_number}`

      if (!aggregates[key]) {
        // Find payment status for this invoice
        const payment = payments.find(
          p => p.supplier_id === inv.supplier_id && p.invoice_number === inv.invoice_number
        )

        // Find DC for this invoice (use first one found)
        const dc = grnDcDocs.find(d => d.grn_invoice_id === inv.id)

        aggregates[key] = {
          invoice_number: inv.invoice_number,
          supplier_id: inv.supplier_id,
          supplier_name: inv.supplier.supplier_name,
          amount_without_gst: 0,
          gst_amount: 0,
          total_amount: 0,
          dc_uploaded: dc?.is_uploaded || false,
          dc_file_path: dc?.file_path || null,
          dc_file_name: dc?.file_name || null,
          payment_status: payment?.payment_status || 'pending',
          payment_reference: payment?.payment_reference || null,
          paid_at: payment?.paid_at || null,
          grn_count: 0,
        }
      }

      aggregates[key].grn_count += 1

      // If we haven't captured DC yet for this aggregate, check this invoice
      if (!aggregates[key].dc_uploaded) {
        const dc = grnDcDocs.find(d => d.grn_invoice_id === inv.id)
        if (dc?.is_uploaded) {
          aggregates[key].dc_uploaded = true
          aggregates[key].dc_file_path = dc.file_path
          aggregates[key].dc_file_name = dc.file_name
        }
      }
    })

    // Add line item amounts to aggregates
    grnLineItems.forEach(li => {
      const invoice = grnInvoices.find(inv => inv.id === li.grn_invoice_id)
      if (invoice) {
        const key = `${invoice.supplier_id}|${invoice.invoice_number}`
        if (aggregates[key]) {
          aggregates[key].amount_without_gst += parseFloat(String(li.amount_without_gst)) || 0
          aggregates[key].total_amount += parseFloat(String(li.amount_with_gst)) || 0
        }
      }
    })

    // Calculate GST amounts
    Object.values(aggregates).forEach(agg => {
      agg.gst_amount = agg.total_amount - agg.amount_without_gst
    })

    return aggregates
  }, [grnInvoices, grnLineItems, grnDcDocs, payments])

  // Group by supplier for summary cards
  const supplierSummaries = useMemo(() => {
    const summaries: { [key: string]: SupplierSummary } = {}

    Object.values(invoiceAggregates).forEach(inv => {
      if (!summaries[inv.supplier_id]) {
        const supplier = grnInvoices.find(g => g.supplier_id === inv.supplier_id)?.supplier
        summaries[inv.supplier_id] = {
          supplier_id: inv.supplier_id,
          supplier_name: supplier?.supplier_name || 'Unknown',
          gstin: supplier?.gstin || null,
          total_invoices: 0,
          pending_count: 0,
          paid_count: 0,
          pending_amount: 0,
          paid_amount: 0,
        }
      }

      summaries[inv.supplier_id].total_invoices += 1
      if (inv.payment_status === 'paid') {
        summaries[inv.supplier_id].paid_count += 1
        summaries[inv.supplier_id].paid_amount += inv.total_amount
      } else {
        summaries[inv.supplier_id].pending_count += 1
        summaries[inv.supplier_id].pending_amount += inv.total_amount
      }
    })

    return Object.values(summaries).sort((a, b) => a.supplier_name.localeCompare(b.supplier_name))
  }, [invoiceAggregates, grnInvoices])

  // Get invoices for selected supplier
  const supplierInvoices = useMemo(() => {
    if (!selectedSupplier) return []
    return Object.values(invoiceAggregates)
      .filter(inv => inv.supplier_id === selectedSupplier.supplier_id)
      .sort((a, b) => a.invoice_number.localeCompare(b.invoice_number))
  }, [invoiceAggregates, selectedSupplier])

  // Format currency
  const formatCurrency = (value: number) => {
    return `₹${value.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  }

  // Handle payment confirmation
  async function handleMarkAsPaid() {
    if (!selectedInvoice || !paymentReference.trim()) {
      toast.error('Payment reference is required')
      return
    }

    setSavingPayment(true)
    try {
      const paymentData = {
        site_id: selectedSiteId,
        supplier_id: selectedInvoice.supplier_id,
        invoice_number: selectedInvoice.invoice_number,
        payment_status: 'paid' as const,
        payment_reference: paymentReference.trim(),
        paid_at: new Date().toISOString(),
        notes: paymentNotes.trim() || null,
      }

      // Upsert the payment record
      const { error } = await supabase
        .from('supplier_invoice_payments')
        .upsert(paymentData, {
          onConflict: 'site_id,supplier_id,invoice_number',
        })

      if (error) throw error

      toast.success('Payment recorded successfully')
      setPaymentDialogOpen(false)
      setSelectedInvoice(null)
      setPaymentReference('')
      setPaymentNotes('')

      // Refresh data
      fetchData()
    } catch (error) {
      console.error('Error saving payment:', error)
      toast.error('Failed to save payment')
    } finally {
      setSavingPayment(false)
    }
  }

  // Open DC file
  function openDcFile(filePath: string) {
    const { data } = supabase.storage
      .from('grn-documents')
      .getPublicUrl(filePath)
    window.open(data.publicUrl, '_blank')
  }

  if (loading) {
    return (
      <div className="flex flex-col min-h-screen">
        <Header title="Supplier Invoices" />
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
      <Header title="Supplier Invoices" />

      <div className="flex-1 p-4 md:p-6 space-y-6">
        {/* Header Card */}
        <Card>
          <CardHeader className="pb-4">
            <div className="flex flex-col gap-4">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <CreditCard className="h-5 w-5" />
                  Supplier Invoice Management
                </CardTitle>
                <CardDescription>
                  Track and manage supplier invoice payments
                </CardDescription>
              </div>

              <div className="flex flex-col sm:flex-row gap-3">
                <Select value={selectedSiteId} onValueChange={setSelectedSiteId}>
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
            </div>
          </CardHeader>
        </Card>

        {/* Content */}
        {!selectedSiteId ? (
          <Card>
            <CardContent className="py-12">
              <div className="text-center">
                <Building2 className="h-12 w-12 mx-auto text-slate-300 mb-4" />
                <h3 className="text-lg font-medium text-slate-900 mb-2">Select a Site</h3>
                <p className="text-slate-500">Choose a site to view supplier invoices</p>
              </div>
            </CardContent>
          </Card>
        ) : loadingData ? (
          <Card>
            <CardContent className="py-12">
              <div className="text-center">
                <Loader2 className="h-8 w-8 animate-spin text-blue-600 mx-auto mb-4" />
                <p className="text-slate-500">Loading invoice data...</p>
              </div>
            </CardContent>
          </Card>
        ) : supplierSummaries.length === 0 ? (
          <Card>
            <CardContent className="py-12">
              <div className="text-center">
                <Receipt className="h-12 w-12 mx-auto text-slate-300 mb-4" />
                <h3 className="text-lg font-medium text-slate-900 mb-2">No Invoices Found</h3>
                <p className="text-slate-500">No supplier invoices have been recorded for this site</p>
              </div>
            </CardContent>
          </Card>
        ) : selectedSupplier ? (
          /* Invoice Details View */
          <div className="space-y-4">
            <Card>
              <CardHeader className="pb-4">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-lg">{selectedSupplier.supplier_name}</CardTitle>
                    {selectedSupplier.gstin && (
                      <CardDescription>GSTIN: {selectedSupplier.gstin}</CardDescription>
                    )}
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setSelectedSupplier(null)}
                  >
                    <ArrowLeft className="h-4 w-4 mr-2" />
                    Back
                  </Button>
                </div>
              </CardHeader>
            </Card>

            {/* Invoice Table */}
            <Card>
              <CardContent className="pt-6">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Invoice #</TableHead>
                        <TableHead className="text-right">Excl. GST</TableHead>
                        <TableHead className="text-right">GST</TableHead>
                        <TableHead className="text-right">Total</TableHead>
                        <TableHead className="text-center">DC</TableHead>
                        <TableHead className="text-center">Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {supplierInvoices.map((invoice) => (
                        <TableRow key={invoice.invoice_number}>
                          <TableCell className="font-medium">
                            {invoice.invoice_number}
                            {invoice.grn_count > 1 && (
                              <span className="text-xs text-slate-500 ml-1">
                                ({invoice.grn_count} GRNs)
                              </span>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            {formatCurrency(invoice.amount_without_gst)}
                          </TableCell>
                          <TableCell className="text-right">
                            {formatCurrency(invoice.gst_amount)}
                          </TableCell>
                          <TableCell className="text-right font-medium">
                            {formatCurrency(invoice.total_amount)}
                          </TableCell>
                          <TableCell className="text-center">
                            {invoice.dc_uploaded && invoice.dc_file_path ? (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 w-8 p-0"
                                onClick={() => openDcFile(invoice.dc_file_path!)}
                              >
                                <FileText className="h-4 w-4 text-blue-600" />
                              </Button>
                            ) : (
                              <span className="text-slate-400">-</span>
                            )}
                          </TableCell>
                          <TableCell className="text-center">
                            {invoice.payment_status === 'paid' ? (
                              <div className="flex flex-col items-center">
                                <Badge className="bg-green-100 text-green-700 hover:bg-green-100">
                                  <Check className="h-3 w-3 mr-1" />
                                  Paid
                                </Badge>
                                {invoice.payment_reference && (
                                  <span className="text-xs text-slate-500 mt-1">
                                    {invoice.payment_reference}
                                  </span>
                                )}
                              </div>
                            ) : (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  setSelectedInvoice(invoice)
                                  setPaymentDialogOpen(true)
                                }}
                              >
                                Mark Paid
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                {/* Summary Footer */}
                <div className="mt-4 pt-4 border-t flex flex-wrap gap-4 justify-end">
                  <div className="text-sm">
                    <span className="text-slate-500">Total Pending:</span>{' '}
                    <span className="font-semibold text-orange-600">
                      {formatCurrency(selectedSupplier.pending_amount)}
                    </span>
                  </div>
                  <div className="text-sm">
                    <span className="text-slate-500">Total Paid:</span>{' '}
                    <span className="font-semibold text-green-600">
                      {formatCurrency(selectedSupplier.paid_amount)}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        ) : (
          /* Supplier Summary Cards */
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {supplierSummaries.map((supplier) => (
              <Card
                key={supplier.supplier_id}
                className="cursor-pointer hover:shadow-md transition-shadow hover:border-blue-300"
                onClick={() => setSelectedSupplier(supplier)}
              >
                <CardContent className="pt-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-slate-900 truncate">
                        {supplier.supplier_name}
                      </h3>
                      {supplier.gstin && (
                        <p className="text-xs text-slate-500 truncate">
                          {supplier.gstin}
                        </p>
                      )}
                    </div>
                    <div className="h-10 w-10 rounded-lg bg-blue-100 flex items-center justify-center flex-shrink-0 ml-3">
                      <Receipt className="h-5 w-5 text-blue-600" />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-500">Total Invoices</span>
                      <span className="font-medium">{supplier.total_invoices}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="flex items-center gap-1 text-orange-600">
                        <Clock className="h-3 w-3" />
                        Pending
                      </span>
                      <span className="font-medium">{supplier.pending_count}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="flex items-center gap-1 text-green-600">
                        <CheckCircle2 className="h-3 w-3" />
                        Paid
                      </span>
                      <span className="font-medium">{supplier.paid_count}</span>
                    </div>
                  </div>

                  <div className="mt-4 pt-4 border-t">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-slate-500">Pending Amount</span>
                      <span className={cn(
                        "font-semibold",
                        supplier.pending_amount > 0 ? "text-orange-600" : "text-slate-400"
                      )}>
                        {formatCurrency(supplier.pending_amount)}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Payment Confirmation Dialog */}
      <Dialog open={paymentDialogOpen} onOpenChange={setPaymentDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Confirm Payment</DialogTitle>
            <DialogDescription>
              Record payment for this invoice
            </DialogDescription>
          </DialogHeader>

          {selectedInvoice && (
            <div className="space-y-4">
              <div className="p-4 bg-slate-50 rounded-lg space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">Invoice</span>
                  <span className="font-medium">{selectedInvoice.invoice_number}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">Supplier</span>
                  <span className="font-medium">{selectedInvoice.supplier_name}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">Amount</span>
                  <span className="font-semibold text-blue-600">
                    {formatCurrency(selectedInvoice.total_amount)}
                  </span>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="payment-reference">
                  Payment Reference <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="payment-reference"
                  placeholder="NEFT/UTR Number"
                  value={paymentReference}
                  onChange={(e) => setPaymentReference(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="payment-notes">Notes (Optional)</Label>
                <Textarea
                  id="payment-notes"
                  placeholder="Any additional notes..."
                  value={paymentNotes}
                  onChange={(e) => setPaymentNotes(e.target.value)}
                  rows={2}
                />
              </div>
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => {
                setPaymentDialogOpen(false)
                setSelectedInvoice(null)
                setPaymentReference('')
                setPaymentNotes('')
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleMarkAsPaid}
              disabled={savingPayment || !paymentReference.trim()}
            >
              {savingPayment && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Confirm Payment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
