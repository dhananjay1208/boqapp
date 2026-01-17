'use client'

import { useEffect, useState } from 'react'
import { Header } from '@/components/layout/header'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
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
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import {
  CheckCircle2,
  XCircle,
  MinusCircle,
  Eye,
  Download,
  ChevronDown,
  ChevronRight,
  FileSpreadsheet,
  Building2,
  Package,
  ClipboardCheck,
  FileText,
  AlertCircle,
  Loader2,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'

interface Site {
  id: string
  name: string
}

interface PackageData {
  id: string
  name: string
  site_id: string
}

interface BOQHeadline {
  id: string
  package_id: string
  serial_number: number
  name: string
  packages?: {
    id: string
    name: string
    sites: {
      id: string
      name: string
    }
  }
}

interface BOQLineItem {
  id: string
  headline_id: string
  item_number: string
  description: string
  location: string | null
  unit: string
  quantity: number
}

interface Material {
  id: string
  line_item_id: string
  name: string
}

interface ComplianceDoc {
  id: string
  material_id: string
  document_type: string
  is_applicable: boolean
  is_uploaded: boolean
  file_path: string | null
  file_name: string | null
}

interface BOQChecklist {
  id: string
  line_item_id: string
  checklist_name: string
  status: string
  signed_copy_path: string | null
  signed_copy_name: string | null
}

interface BOQJMR {
  id: string
  line_item_id: string
  jmr_number: string | null
  status: string
  file_path: string | null
  file_name: string | null
}

interface LineItemReadiness {
  lineItem: BOQLineItem
  materials: Material[]
  complianceDocs: ComplianceDoc[]
  checklists: BOQChecklist[]
  jmrs: BOQJMR[]
  // Computed status
  dcStatus: 'Y' | 'N' | 'NA'
  mirStatus: 'Y' | 'N' | 'NA'
  testCertStatus: 'Y' | 'N' | 'NA'
  tdsStatus: 'Y' | 'N' | 'NA'
  checklistStatus: 'Y' | 'N' | 'NA'
  jmrStatus: 'Y' | 'N' | 'NA'
  // File paths for viewing
  dcFiles: { path: string; name: string }[]
  mirFiles: { path: string; name: string }[]
  testCertFiles: { path: string; name: string }[]
  tdsFiles: { path: string; name: string }[]
  checklistFiles: { path: string; name: string }[]
  jmrFiles: { path: string; name: string }[]
}

interface HeadlineReadiness {
  headline: BOQHeadline
  lineItems: LineItemReadiness[]
  overallProgress: number
}

export default function BillingReadinessPage() {
  const [sites, setSites] = useState<Site[]>([])
  const [selectedSiteId, setSelectedSiteId] = useState<string>('')
  const [headlineReadiness, setHeadlineReadiness] = useState<HeadlineReadiness[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedHeadlines, setExpandedHeadlines] = useState<Set<string>>(new Set())

  useEffect(() => {
    fetchSites()
  }, [])

  useEffect(() => {
    if (selectedSiteId) {
      fetchReadinessData()
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

      // Auto-select first site if available
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

  async function fetchReadinessData() {
    setLoading(true)
    try {
      // Fetch all headlines for the selected site
      const { data: headlines, error: headlinesError } = await supabase
        .from('boq_headlines')
        .select(`
          *,
          packages (
            id,
            name,
            sites (
              id,
              name
            )
          )
        `)
        .eq('packages.site_id', selectedSiteId)
        .order('serial_number')

      if (headlinesError) throw headlinesError

      // Filter out headlines that don't belong to the selected site
      const filteredHeadlines = (headlines || []).filter(h => h.packages?.sites?.id === selectedSiteId)

      if (filteredHeadlines.length === 0) {
        setHeadlineReadiness([])
        setLoading(false)
        return
      }

      const headlineIds = filteredHeadlines.map(h => h.id)

      // Fetch all line items for these headlines
      const { data: lineItems, error: lineItemsError } = await supabase
        .from('boq_line_items')
        .select('*')
        .in('headline_id', headlineIds)
        .order('item_number')

      if (lineItemsError) throw lineItemsError

      const lineItemIds = (lineItems || []).map(li => li.id)

      if (lineItemIds.length === 0) {
        setHeadlineReadiness(filteredHeadlines.map(h => ({
          headline: h,
          lineItems: [],
          overallProgress: 0,
        })))
        setLoading(false)
        return
      }

      // Fetch materials for all line items
      const { data: materials, error: materialsError } = await supabase
        .from('materials')
        .select('*')
        .in('line_item_id', lineItemIds)

      if (materialsError) throw materialsError

      const materialIds = (materials || []).map(m => m.id)

      // Fetch compliance documents for all materials
      let complianceDocs: ComplianceDoc[] = []
      if (materialIds.length > 0) {
        const { data: docsData, error: docsError } = await supabase
          .from('compliance_documents')
          .select('*')
          .in('material_id', materialIds)

        if (docsError) {
          console.error('Error fetching compliance docs:', docsError)
        } else {
          complianceDocs = docsData || []
        }
      }

      // Fetch checklists for all line items
      let checklists: BOQChecklist[] = []
      const { data: checklistsData, error: checklistsError } = await supabase
        .from('boq_checklists')
        .select('*')
        .in('line_item_id', lineItemIds)

      if (checklistsError) {
        console.error('Error fetching checklists:', checklistsError)
      } else {
        checklists = checklistsData || []
      }

      // Fetch JMRs for all line items
      let jmrs: BOQJMR[] = []
      const { data: jmrsData, error: jmrsError } = await supabase
        .from('boq_jmr')
        .select('*')
        .in('line_item_id', lineItemIds)

      if (jmrsError) {
        console.error('Error fetching JMRs:', jmrsError)
      } else {
        jmrs = jmrsData || []
      }

      // Build readiness data structure
      const readinessData: HeadlineReadiness[] = filteredHeadlines.map(headline => {
        const headlineLineItems = (lineItems || []).filter(li => li.headline_id === headline.id)

        const lineItemsReadiness: LineItemReadiness[] = headlineLineItems.map(lineItem => {
          const lineItemMaterials = (materials || []).filter(m => m.line_item_id === lineItem.id)
          const materialIds = lineItemMaterials.map(m => m.id)
          const lineItemDocs = complianceDocs.filter(d => materialIds.includes(d.material_id))
          const lineItemChecklists = checklists.filter(c => c.line_item_id === lineItem.id)
          const lineItemJmrs = jmrs.filter(j => j.line_item_id === lineItem.id)

          // Compute document status for each type
          const getDocStatus = (docType: string): { status: 'Y' | 'N' | 'NA'; files: { path: string; name: string }[] } => {
            const docs = lineItemDocs.filter(d => d.document_type === docType)

            if (docs.length === 0) {
              // No materials or no docs initialized
              if (lineItemMaterials.length === 0) {
                return { status: 'NA', files: [] }
              }
              return { status: 'N', files: [] }
            }

            const applicableDocs = docs.filter(d => d.is_applicable)
            const uploadedDocs = docs.filter(d => d.is_applicable && d.is_uploaded && d.file_path)
            const naCount = docs.filter(d => !d.is_applicable).length

            if (naCount === docs.length) {
              return { status: 'NA', files: [] }
            }

            if (applicableDocs.length === 0) {
              return { status: 'NA', files: [] }
            }

            if (uploadedDocs.length === applicableDocs.length) {
              return {
                status: 'Y',
                files: uploadedDocs.map(d => ({ path: d.file_path!, name: d.file_name || 'Document' })),
              }
            }

            return {
              status: 'N',
              files: uploadedDocs.map(d => ({ path: d.file_path!, name: d.file_name || 'Document' })),
            }
          }

          // Compute checklist status
          const getChecklistStatus = (): { status: 'Y' | 'N' | 'NA'; files: { path: string; name: string }[] } => {
            if (lineItemChecklists.length === 0) {
              return { status: 'N', files: [] }
            }

            const signedChecklists = lineItemChecklists.filter(c => c.signed_copy_path)
            if (signedChecklists.length > 0) {
              return {
                status: 'Y',
                files: signedChecklists.map(c => ({ path: c.signed_copy_path!, name: c.signed_copy_name || c.checklist_name })),
              }
            }

            return { status: 'N', files: [] }
          }

          // Compute JMR status
          const getJmrStatus = (): { status: 'Y' | 'N' | 'NA'; files: { path: string; name: string }[] } => {
            if (lineItemJmrs.length === 0) {
              return { status: 'N', files: [] }
            }

            const approvedJmrs = lineItemJmrs.filter(j => j.status === 'approved' && j.file_path)
            if (approvedJmrs.length > 0) {
              return {
                status: 'Y',
                files: approvedJmrs.map(j => ({ path: j.file_path!, name: j.file_name || j.jmr_number || 'JMR' })),
              }
            }

            // Check if any JMR has a file uploaded (even if not approved)
            const jmrsWithFiles = lineItemJmrs.filter(j => j.file_path)
            if (jmrsWithFiles.length > 0) {
              return {
                status: 'N', // Not approved yet
                files: jmrsWithFiles.map(j => ({ path: j.file_path!, name: j.file_name || j.jmr_number || 'JMR' })),
              }
            }

            return { status: 'N', files: [] }
          }

          const dcResult = getDocStatus('dc')
          const mirResult = getDocStatus('mir')
          const testCertResult = getDocStatus('test_certificate')
          const tdsResult = getDocStatus('tds')
          const checklistResult = getChecklistStatus()
          const jmrResult = getJmrStatus()

          return {
            lineItem,
            materials: lineItemMaterials,
            complianceDocs: lineItemDocs,
            checklists: lineItemChecklists,
            jmrs: lineItemJmrs,
            dcStatus: dcResult.status,
            mirStatus: mirResult.status,
            testCertStatus: testCertResult.status,
            tdsStatus: tdsResult.status,
            checklistStatus: checklistResult.status,
            jmrStatus: jmrResult.status,
            dcFiles: dcResult.files,
            mirFiles: mirResult.files,
            testCertFiles: testCertResult.files,
            tdsFiles: tdsResult.files,
            checklistFiles: checklistResult.files,
            jmrFiles: jmrResult.files,
          }
        })

        // Calculate overall progress
        const totalChecks = lineItemsReadiness.length * 6 // 6 document types per line item
        let completedChecks = 0
        lineItemsReadiness.forEach(li => {
          if (li.dcStatus === 'Y' || li.dcStatus === 'NA') completedChecks++
          if (li.mirStatus === 'Y' || li.mirStatus === 'NA') completedChecks++
          if (li.testCertStatus === 'Y' || li.testCertStatus === 'NA') completedChecks++
          if (li.tdsStatus === 'Y' || li.tdsStatus === 'NA') completedChecks++
          if (li.checklistStatus === 'Y' || li.checklistStatus === 'NA') completedChecks++
          if (li.jmrStatus === 'Y' || li.jmrStatus === 'NA') completedChecks++
        })

        const overallProgress = totalChecks > 0 ? Math.round((completedChecks / totalChecks) * 100) : 0

        return {
          headline,
          lineItems: lineItemsReadiness,
          overallProgress,
        }
      })

      setHeadlineReadiness(readinessData)
    } catch (error) {
      console.error('Error fetching readiness data:', error)
      toast.error('Failed to load billing readiness data')
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

  async function viewDocument(filePath: string) {
    try {
      const { data, error } = await supabase.storage
        .from('compliance-docs')
        .createSignedUrl(filePath, 3600)

      if (error) {
        toast.error('Failed to generate download link')
        return
      }

      window.open(data.signedUrl, '_blank')
    } catch (error) {
      console.error('Error viewing document:', error)
      toast.error('Failed to view document')
    }
  }

  async function downloadDocument(filePath: string, fileName: string) {
    try {
      const { data, error } = await supabase.storage
        .from('compliance-docs')
        .createSignedUrl(filePath, 3600)

      if (error) {
        toast.error('Failed to generate download link')
        return
      }

      // Create a temporary link and trigger download
      const link = document.createElement('a')
      link.href = data.signedUrl
      link.download = fileName
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
    } catch (error) {
      console.error('Error downloading document:', error)
      toast.error('Failed to download document')
    }
  }

  function StatusCell({
    status,
    files,
    label
  }: {
    status: 'Y' | 'N' | 'NA'
    files: { path: string; name: string }[]
    label: string
  }) {
    if (status === 'NA') {
      return (
        <div className="flex items-center justify-center">
          <Badge variant="outline" className="bg-slate-100 text-slate-500">
            <MinusCircle className="h-3 w-3 mr-1" />
            NA
          </Badge>
        </div>
      )
    }

    if (status === 'N') {
      return (
        <div className="flex items-center justify-center">
          <Badge variant="outline" className="bg-red-50 text-red-600 border-red-200">
            <XCircle className="h-3 w-3 mr-1" />
            N
          </Badge>
        </div>
      )
    }

    // Status is 'Y' - show with view/download options
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="flex items-center justify-center gap-1">
              <Badge variant="outline" className="bg-green-50 text-green-600 border-green-200">
                <CheckCircle2 className="h-3 w-3 mr-1" />
                Y
              </Badge>
              {files.length > 0 && (
                <div className="flex gap-0.5">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={() => viewDocument(files[0].path)}
                  >
                    <Eye className="h-3 w-3 text-blue-600" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={() => downloadDocument(files[0].path, files[0].name)}
                  >
                    <Download className="h-3 w-3 text-slate-600" />
                  </Button>
                </div>
              )}
            </div>
          </TooltipTrigger>
          <TooltipContent>
            <p>{label}</p>
            {files.length > 1 && <p className="text-xs text-slate-400">{files.length} files</p>}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    )
  }

  // Calculate overall site progress
  const overallSiteProgress = headlineReadiness.length > 0
    ? Math.round(headlineReadiness.reduce((sum, h) => sum + h.overallProgress, 0) / headlineReadiness.length)
    : 0

  const totalLineItems = headlineReadiness.reduce((sum, h) => sum + h.lineItems.length, 0)
  const readyLineItems = headlineReadiness.reduce((sum, h) =>
    sum + h.lineItems.filter(li =>
      (li.dcStatus === 'Y' || li.dcStatus === 'NA') &&
      (li.mirStatus === 'Y' || li.mirStatus === 'NA') &&
      (li.testCertStatus === 'Y' || li.testCertStatus === 'NA') &&
      (li.tdsStatus === 'Y' || li.tdsStatus === 'NA') &&
      (li.checklistStatus === 'Y' || li.checklistStatus === 'NA') &&
      (li.jmrStatus === 'Y' || li.jmrStatus === 'NA')
    ).length, 0)

  return (
    <div className="flex flex-col min-h-screen">
      <Header title="Billing Readiness" />

      <div className="flex-1 p-4 md:p-6 space-y-6">
        {/* Site Selection and Summary */}
        <Card>
          <CardHeader>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <ClipboardCheck className="h-5 w-5" />
                  Billing Readiness Dashboard
                </CardTitle>
                <CardDescription>
                  Track document completion status for billing preparation
                </CardDescription>
              </div>
              <div className="w-full sm:w-64">
                <Select value={selectedSiteId} onValueChange={setSelectedSiteId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a site..." />
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
          <CardContent>
            {selectedSiteId && !loading && (
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-slate-50 rounded-lg p-4 text-center">
                  <p className="text-3xl font-bold">{headlineReadiness.length}</p>
                  <p className="text-sm text-slate-500">BOQ Headlines</p>
                </div>
                <div className="bg-blue-50 rounded-lg p-4 text-center">
                  <p className="text-3xl font-bold text-blue-700">{totalLineItems}</p>
                  <p className="text-sm text-blue-600">Line Items</p>
                </div>
                <div className="bg-green-50 rounded-lg p-4 text-center">
                  <p className="text-3xl font-bold text-green-700">{readyLineItems}</p>
                  <p className="text-sm text-green-600">Ready for Billing</p>
                </div>
                <div className="bg-purple-50 rounded-lg p-4">
                  <div className="text-center mb-2">
                    <p className="text-3xl font-bold text-purple-700">{overallSiteProgress}%</p>
                    <p className="text-sm text-purple-600">Overall Progress</p>
                  </div>
                  <Progress value={overallSiteProgress} className="h-2" />
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Loading State */}
        {loading && (
          <Card>
            <CardContent className="py-12">
              <div className="flex flex-col items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-blue-600 mb-4" />
                <p className="text-slate-500">Loading billing readiness data...</p>
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
                <p className="text-slate-500">Choose a site to view billing readiness status</p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* No Data */}
        {selectedSiteId && !loading && headlineReadiness.length === 0 && (
          <Card>
            <CardContent className="py-12">
              <div className="text-center">
                <FileSpreadsheet className="h-12 w-12 mx-auto text-slate-300 mb-4" />
                <h3 className="text-lg font-medium text-slate-900 mb-2">No BOQ Data</h3>
                <p className="text-slate-500">No BOQ headlines found for this site</p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Headlines and Line Items */}
        {selectedSiteId && !loading && headlineReadiness.length > 0 && (
          <div className="space-y-4">
            {headlineReadiness.map((hr) => (
              <Card key={hr.headline.id}>
                <Collapsible
                  open={expandedHeadlines.has(hr.headline.id)}
                  onOpenChange={() => toggleHeadlineExpand(hr.headline.id)}
                >
                  <CollapsibleTrigger asChild>
                    <CardHeader className="cursor-pointer hover:bg-slate-50 transition-colors">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          {expandedHeadlines.has(hr.headline.id) ? (
                            <ChevronDown className="h-5 w-5 text-slate-400" />
                          ) : (
                            <ChevronRight className="h-5 w-5 text-slate-400" />
                          )}
                          <div>
                            <CardTitle className="text-base flex items-center gap-2">
                              <FileSpreadsheet className="h-4 w-4" />
                              {hr.headline.serial_number}. {hr.headline.name}
                            </CardTitle>
                            <CardDescription>
                              {hr.lineItems.length} line items | {hr.headline.packages?.name}
                            </CardDescription>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="text-right">
                            <p className="text-sm font-medium">{hr.overallProgress}% Complete</p>
                            <Progress value={hr.overallProgress} className="h-2 w-24" />
                          </div>
                          <Badge
                            variant="outline"
                            className={
                              hr.overallProgress === 100
                                ? 'bg-green-100 text-green-700 border-green-200'
                                : hr.overallProgress >= 50
                                ? 'bg-amber-100 text-amber-700 border-amber-200'
                                : 'bg-red-100 text-red-700 border-red-200'
                            }
                          >
                            {hr.overallProgress === 100 ? 'Ready' : hr.overallProgress >= 50 ? 'In Progress' : 'Pending'}
                          </Badge>
                        </div>
                      </div>
                    </CardHeader>
                  </CollapsibleTrigger>

                  <CollapsibleContent>
                    <CardContent className="pt-0">
                      {hr.lineItems.length === 0 ? (
                        <div className="text-center py-6">
                          <AlertCircle className="h-8 w-8 mx-auto text-slate-300 mb-2" />
                          <p className="text-sm text-slate-500">No line items for this headline</p>
                        </div>
                      ) : (
                        <div className="overflow-x-auto">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead className="w-24">S.No</TableHead>
                                <TableHead>Description</TableHead>
                                <TableHead className="text-center w-28">DC</TableHead>
                                <TableHead className="text-center w-28">MIR</TableHead>
                                <TableHead className="text-center w-28">Test Cert</TableHead>
                                <TableHead className="text-center w-28">TDS</TableHead>
                                <TableHead className="text-center w-28">Checklist</TableHead>
                                <TableHead className="text-center w-28">JMR</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {hr.lineItems.map((li) => (
                                <TableRow key={li.lineItem.id}>
                                  <TableCell className="font-mono font-medium">
                                    {li.lineItem.item_number}
                                  </TableCell>
                                  <TableCell>
                                    <div>
                                      <p className="font-medium line-clamp-1">{li.lineItem.description}</p>
                                      <p className="text-xs text-slate-500">
                                        {li.lineItem.quantity} {li.lineItem.unit}
                                        {li.lineItem.location && ` | ${li.lineItem.location}`}
                                      </p>
                                    </div>
                                  </TableCell>
                                  <TableCell>
                                    <StatusCell
                                      status={li.dcStatus}
                                      files={li.dcFiles}
                                      label="Delivery Challan/Eway Bill/Invoice"
                                    />
                                  </TableCell>
                                  <TableCell>
                                    <StatusCell
                                      status={li.mirStatus}
                                      files={li.mirFiles}
                                      label="Material Inspection Report"
                                    />
                                  </TableCell>
                                  <TableCell>
                                    <StatusCell
                                      status={li.testCertStatus}
                                      files={li.testCertFiles}
                                      label="Test Certificate"
                                    />
                                  </TableCell>
                                  <TableCell>
                                    <StatusCell
                                      status={li.tdsStatus}
                                      files={li.tdsFiles}
                                      label="Technical Data Sheet"
                                    />
                                  </TableCell>
                                  <TableCell>
                                    <StatusCell
                                      status={li.checklistStatus}
                                      files={li.checklistFiles}
                                      label="Signed Checklist"
                                    />
                                  </TableCell>
                                  <TableCell>
                                    <StatusCell
                                      status={li.jmrStatus}
                                      files={li.jmrFiles}
                                      label="Approved JMR"
                                    />
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                      )}
                    </CardContent>
                  </CollapsibleContent>
                </Collapsible>
              </Card>
            ))}
          </div>
        )}

        {/* Legend */}
        {selectedSiteId && !loading && headlineReadiness.length > 0 && (
          <Card>
            <CardContent className="py-4">
              <div className="flex flex-wrap items-center gap-6 text-sm">
                <span className="font-medium text-slate-700">Legend:</span>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="bg-green-50 text-green-600 border-green-200">
                    <CheckCircle2 className="h-3 w-3 mr-1" />
                    Y
                  </Badge>
                  <span className="text-slate-600">Uploaded</span>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="bg-red-50 text-red-600 border-red-200">
                    <XCircle className="h-3 w-3 mr-1" />
                    N
                  </Badge>
                  <span className="text-slate-600">Not Uploaded</span>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="bg-slate-100 text-slate-500">
                    <MinusCircle className="h-3 w-3 mr-1" />
                    NA
                  </Badge>
                  <span className="text-slate-600">Not Applicable</span>
                </div>
                <div className="flex items-center gap-2">
                  <Eye className="h-4 w-4 text-blue-600" />
                  <span className="text-slate-600">View Document</span>
                </div>
                <div className="flex items-center gap-2">
                  <Download className="h-4 w-4 text-slate-600" />
                  <span className="text-slate-600">Download</span>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
