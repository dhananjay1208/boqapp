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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import {
  Building2,
  Package,
  FileSpreadsheet,
  ClipboardCheck,
  FileText,
  Flame,
  Info,
  TrendingUp,
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
  serial_number: number
  name: string
  package_id: string
}

interface BOQLineItem {
  id: string
  item_number: string
  description: string
  location: string | null
  unit: string
  quantity: number
  checklist_status: string
  jmr_status: string
}

interface Consumption {
  id: string
  line_item_id: string
  material_name: string
  quantity: number
  unit: string
  consumption_date: string
}

// Status options with colors
const checklistStatusOptions = [
  { value: 'not_applicable', label: 'N/A', color: 'bg-gray-100 text-gray-600' },
  { value: 'pending', label: 'Pending', color: 'bg-slate-100 text-slate-700' },
  { value: 'created', label: 'Created', color: 'bg-blue-100 text-blue-700' },
  { value: 'in_progress', label: 'In Progress', color: 'bg-amber-100 text-amber-700' },
  { value: 'completed', label: 'Completed', color: 'bg-green-100 text-green-700' },
  { value: 'approved', label: 'Approved', color: 'bg-emerald-100 text-emerald-700' },
  { value: 'uploaded', label: 'Uploaded', color: 'bg-purple-100 text-purple-700' },
]

const jmrStatusOptions = [
  { value: 'not_applicable', label: 'N/A', color: 'bg-gray-100 text-gray-600' },
  { value: 'pending', label: 'Pending', color: 'bg-slate-100 text-slate-700' },
  { value: 'in_progress', label: 'In Progress', color: 'bg-amber-100 text-amber-700' },
  { value: 'completed', label: 'Completed', color: 'bg-green-100 text-green-700' },
  { value: 'approved', label: 'Approved', color: 'bg-emerald-100 text-emerald-700' },
  { value: 'uploaded', label: 'Uploaded', color: 'bg-purple-100 text-purple-700' },
]

function getStatusBadge(options: typeof checklistStatusOptions, value: string) {
  const option = options.find(opt => opt.value === value) || options[1]
  return option
}

export default function BOQProgressPage() {
  const [sites, setSites] = useState<Site[]>([])
  const [packages, setPackages] = useState<PackageData[]>([])
  const [headlines, setHeadlines] = useState<BOQHeadline[]>([])
  const [lineItems, setLineItems] = useState<BOQLineItem[]>([])
  const [consumptions, setConsumptions] = useState<Consumption[]>([])

  const [selectedSite, setSelectedSite] = useState<string>('')
  const [selectedPackage, setSelectedPackage] = useState<string>('')
  const [selectedHeadline, setSelectedHeadline] = useState<string>('')

  const [loading, setLoading] = useState(false)
  const [descriptionDialogOpen, setDescriptionDialogOpen] = useState(false)
  const [selectedLineItem, setSelectedLineItem] = useState<BOQLineItem | null>(null)

  useEffect(() => {
    fetchSitesAndPackages()
  }, [])

  useEffect(() => {
    if (selectedSite) {
      fetchHeadlines()
    } else {
      setHeadlines([])
      setSelectedPackage('')
      setSelectedHeadline('')
    }
  }, [selectedSite, selectedPackage])

  useEffect(() => {
    if (selectedHeadline) {
      fetchLineItemsAndConsumptions()
    } else {
      setLineItems([])
      setConsumptions([])
    }
  }, [selectedHeadline])

  async function fetchSitesAndPackages() {
    try {
      const [sitesRes, packagesRes] = await Promise.all([
        supabase.from('sites').select('id, name').order('name'),
        supabase.from('packages').select('id, name, site_id').order('name'),
      ])

      setSites(sitesRes.data || [])
      setPackages(packagesRes.data || [])
    } catch (error) {
      console.error('Error fetching data:', error)
    }
  }

  async function fetchHeadlines() {
    if (!selectedSite) return

    try {
      let packageIds: string[] = []

      if (selectedPackage) {
        packageIds = [selectedPackage]
      } else {
        packageIds = packages.filter(p => p.site_id === selectedSite).map(p => p.id)
      }

      if (packageIds.length === 0) {
        setHeadlines([])
        return
      }

      const { data, error } = await supabase
        .from('boq_headlines')
        .select('id, serial_number, name, package_id')
        .in('package_id', packageIds)
        .order('serial_number')

      if (error) throw error
      setHeadlines(data || [])
    } catch (error) {
      console.error('Error fetching headlines:', error)
    }
  }

  async function fetchLineItemsAndConsumptions() {
    if (!selectedHeadline) return

    setLoading(true)
    try {
      // Fetch line items
      const { data: lineItemsData, error: lineItemsError } = await supabase
        .from('boq_line_items')
        .select('id, item_number, description, location, unit, quantity, checklist_status, jmr_status')
        .eq('headline_id', selectedHeadline)
        .order('item_number')

      if (lineItemsError) throw lineItemsError
      setLineItems(lineItemsData || [])

      // Fetch consumptions for these line items
      if (lineItemsData && lineItemsData.length > 0) {
        const lineItemIds = lineItemsData.map(li => li.id)
        const { data: consumptionsData, error: consumptionsError } = await supabase
          .from('material_consumption')
          .select('id, line_item_id, material_name, quantity, unit, consumption_date')
          .in('line_item_id', lineItemIds)
          .order('consumption_date', { ascending: false })

        if (consumptionsError) throw consumptionsError
        setConsumptions(consumptionsData || [])
      } else {
        setConsumptions([])
      }
    } catch (error) {
      console.error('Error fetching data:', error)
      toast.error('Failed to load data')
    } finally {
      setLoading(false)
    }
  }

  function getConsumptionsForLineItem(lineItemId: string) {
    return consumptions.filter(c => c.line_item_id === lineItemId)
  }

  function openDescriptionDialog(lineItem: BOQLineItem) {
    setSelectedLineItem(lineItem)
    setDescriptionDialogOpen(true)
  }

  const filteredPackages = selectedSite
    ? packages.filter(p => p.site_id === selectedSite)
    : []

  const selectedHeadlineData = headlines.find(h => h.id === selectedHeadline)

  // Calculate summary stats
  const totalItems = lineItems.length
  const checklistCompleted = lineItems.filter(li =>
    ['completed', 'approved', 'uploaded'].includes(li.checklist_status || 'pending')
  ).length
  const jmrCompleted = lineItems.filter(li =>
    ['completed', 'approved', 'uploaded'].includes(li.jmr_status || 'pending')
  ).length
  const itemsWithConsumption = lineItems.filter(li =>
    getConsumptionsForLineItem(li.id).length > 0
  ).length

  return (
    <div className="flex flex-col min-h-screen">
      <Header title="BOQ Progress Tracker" />

      <div className="flex-1 p-4 md:p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center gap-2">
          <TrendingUp className="h-6 w-6 text-blue-600" />
          <div>
            <h2 className="text-lg font-semibold">Progress Tracker</h2>
            <p className="text-sm text-slate-500">Track BOQ line item progress for Checklist, JMR and Material Consumption</p>
          </div>
        </div>

        {/* Filters */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Select BOQ Headline</CardTitle>
            <CardDescription>Choose site, package and headline to view progress</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Site Filter */}
              <div className="space-y-1.5">
                <label className="text-sm font-medium flex items-center gap-1.5">
                  <Building2 className="h-4 w-4 text-slate-400" />
                  Site
                </label>
                <Select value={selectedSite} onValueChange={(value) => {
                  setSelectedSite(value)
                  setSelectedPackage('')
                  setSelectedHeadline('')
                }}>
                  <SelectTrigger>
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

              {/* Package Filter */}
              <div className="space-y-1.5">
                <label className="text-sm font-medium flex items-center gap-1.5">
                  <Package className="h-4 w-4 text-slate-400" />
                  Work Package
                </label>
                <Select
                  value={selectedPackage}
                  onValueChange={(value) => {
                    setSelectedPackage(value)
                    setSelectedHeadline('')
                  }}
                  disabled={!selectedSite}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={selectedSite ? "Select package" : "Select site first"} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Packages</SelectItem>
                    {filteredPackages.map((pkg) => (
                      <SelectItem key={pkg.id} value={pkg.id}>
                        {pkg.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Headline Filter */}
              <div className="space-y-1.5">
                <label className="text-sm font-medium flex items-center gap-1.5">
                  <FileSpreadsheet className="h-4 w-4 text-slate-400" />
                  BOQ Headline
                </label>
                <Select
                  value={selectedHeadline}
                  onValueChange={setSelectedHeadline}
                  disabled={!selectedSite}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={selectedSite ? "Select headline" : "Select site first"} />
                  </SelectTrigger>
                  <SelectContent>
                    {headlines.map((headline) => (
                      <SelectItem key={headline.id} value={headline.id}>
                        {headline.serial_number}. {headline.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Progress View */}
        {!selectedSite ? (
          <Card>
            <CardContent className="py-12">
              <div className="text-center">
                <Building2 className="h-12 w-12 mx-auto text-slate-300 mb-4" />
                <h3 className="text-lg font-medium text-slate-900 mb-2">Select a Site</h3>
                <p className="text-slate-500">Choose a site to start tracking BOQ progress</p>
              </div>
            </CardContent>
          </Card>
        ) : !selectedHeadline ? (
          <Card>
            <CardContent className="py-12">
              <div className="text-center">
                <FileSpreadsheet className="h-12 w-12 mx-auto text-slate-300 mb-4" />
                <h3 className="text-lg font-medium text-slate-900 mb-2">Select a BOQ Headline</h3>
                <p className="text-slate-500">Choose a headline to view line item progress</p>
              </div>
            </CardContent>
          </Card>
        ) : loading ? (
          <Card>
            <CardContent className="py-12">
              <div className="text-center text-slate-500">Loading progress data...</div>
            </CardContent>
          </Card>
        ) : (
          <>
            {/* Summary Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Card>
                <CardContent className="pt-4">
                  <div className="text-center">
                    <p className="text-2xl font-bold text-slate-900">{totalItems}</p>
                    <p className="text-sm text-slate-500">Line Items</p>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4">
                  <div className="text-center">
                    <p className="text-2xl font-bold text-orange-600">{itemsWithConsumption}</p>
                    <p className="text-sm text-slate-500">With Consumption</p>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4">
                  <div className="text-center">
                    <p className="text-2xl font-bold text-green-600">{checklistCompleted}/{totalItems}</p>
                    <p className="text-sm text-slate-500">Checklist Done</p>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4">
                  <div className="text-center">
                    <p className="text-2xl font-bold text-purple-600">{jmrCompleted}/{totalItems}</p>
                    <p className="text-sm text-slate-500">JMR Done</p>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Progress Table */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileSpreadsheet className="h-5 w-5" />
                  {selectedHeadlineData?.serial_number}. {selectedHeadlineData?.name}
                </CardTitle>
                <CardDescription>
                  {lineItems.length} line item{lineItems.length !== 1 ? 's' : ''} in this headline
                </CardDescription>
              </CardHeader>
              <CardContent>
                {lineItems.length === 0 ? (
                  <div className="text-center py-8 text-slate-500">
                    No line items found for this headline
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <TooltipProvider>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-[80px]">S.No</TableHead>
                            <TableHead>Material Consumed</TableHead>
                            <TableHead className="text-center">Checklist</TableHead>
                            <TableHead className="text-center">JMR</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {lineItems.map((lineItem) => {
                            const lineConsumptions = getConsumptionsForLineItem(lineItem.id)
                            const checklistStatus = getStatusBadge(checklistStatusOptions, lineItem.checklist_status || 'pending')
                            const jmrStatus = getStatusBadge(jmrStatusOptions, lineItem.jmr_status || 'pending')

                            return (
                              <TableRow key={lineItem.id}>
                                <TableCell>
                                  <div className="flex items-center gap-1">
                                    <span className="font-mono font-medium text-blue-600">
                                      {lineItem.item_number}
                                    </span>
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <Button
                                          variant="ghost"
                                          size="icon"
                                          className="h-6 w-6"
                                          onClick={() => openDescriptionDialog(lineItem)}
                                        >
                                          <Info className="h-3.5 w-3.5 text-slate-400" />
                                        </Button>
                                      </TooltipTrigger>
                                      <TooltipContent side="right" className="max-w-xs">
                                        <p className="text-xs">Click to view description</p>
                                      </TooltipContent>
                                    </Tooltip>
                                  </div>
                                </TableCell>
                                <TableCell>
                                  {lineConsumptions.length === 0 ? (
                                    <span className="text-slate-400 text-sm">No consumption</span>
                                  ) : (
                                    <div className="space-y-1">
                                      {lineConsumptions.slice(0, 2).map((c) => (
                                        <div key={c.id} className="flex items-center gap-2 text-sm">
                                          <Flame className="h-3 w-3 text-orange-500" />
                                          <span className="truncate max-w-[150px]">{c.material_name}</span>
                                          <span className="text-slate-500 font-medium">
                                            {c.quantity.toLocaleString('en-IN', { maximumFractionDigits: 2 })} {c.unit}
                                          </span>
                                        </div>
                                      ))}
                                      {lineConsumptions.length > 2 && (
                                        <span className="text-xs text-slate-400">
                                          +{lineConsumptions.length - 2} more
                                        </span>
                                      )}
                                    </div>
                                  )}
                                </TableCell>
                                <TableCell className="text-center">
                                  <Badge className={`${checklistStatus.color} text-xs`} variant="secondary">
                                    <ClipboardCheck className="h-3 w-3 mr-1" />
                                    {checklistStatus.label}
                                  </Badge>
                                </TableCell>
                                <TableCell className="text-center">
                                  <Badge className={`${jmrStatus.color} text-xs`} variant="secondary">
                                    <FileText className="h-3 w-3 mr-1" />
                                    {jmrStatus.label}
                                  </Badge>
                                </TableCell>
                              </TableRow>
                            )
                          })}
                        </TableBody>
                      </Table>
                    </TooltipProvider>
                  </div>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </div>

      {/* Description Dialog */}
      <Dialog open={descriptionDialogOpen} onOpenChange={setDescriptionDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <span className="font-mono text-blue-600">{selectedLineItem?.item_number}</span>
              Line Item Details
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-slate-500">Description</label>
              <p className="mt-1 text-sm text-slate-900">{selectedLineItem?.description}</p>
            </div>
            {selectedLineItem?.location && (
              <div>
                <label className="text-sm font-medium text-slate-500">Location</label>
                <p className="mt-1 text-sm text-slate-900">{selectedLineItem.location}</p>
              </div>
            )}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-slate-500">Quantity</label>
                <p className="mt-1 text-sm text-slate-900">{selectedLineItem?.quantity} {selectedLineItem?.unit}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-slate-500">Unit</label>
                <p className="mt-1 text-sm text-slate-900">{selectedLineItem?.unit}</p>
              </div>
            </div>
            {selectedLineItem && (
              <div className="pt-3 border-t">
                <label className="text-sm font-medium text-slate-500">Material Consumption</label>
                <div className="mt-2 space-y-2">
                  {getConsumptionsForLineItem(selectedLineItem.id).length === 0 ? (
                    <p className="text-sm text-slate-400">No materials consumed yet</p>
                  ) : (
                    getConsumptionsForLineItem(selectedLineItem.id).map((c) => (
                      <div key={c.id} className="flex items-center justify-between text-sm bg-orange-50 rounded-md px-3 py-2">
                        <div className="flex items-center gap-2">
                          <Flame className="h-4 w-4 text-orange-500" />
                          <span>{c.material_name}</span>
                        </div>
                        <span className="font-medium text-orange-700">
                          {c.quantity.toLocaleString('en-IN', { maximumFractionDigits: 3 })} {c.unit}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
