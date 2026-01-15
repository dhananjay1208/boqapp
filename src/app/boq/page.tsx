'use client'

import { Suspense, useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { Header } from '@/components/layout/header'
import { Button } from '@/components/ui/button'
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  FileSpreadsheet,
  Plus,
  Upload,
  MoreHorizontal,
  Eye,
  Trash2,
  Building2,
  Package,
} from 'lucide-react'
import Link from 'next/link'
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
  description: string | null
  status: string
  created_at: string
  packages: {
    id: string
    name: string
    sites: {
      id: string
      name: string
    }
  }
}

function BOQContent() {
  const searchParams = useSearchParams()
  const siteFilter = searchParams.get('site')
  const packageFilter = searchParams.get('package')

  const [sites, setSites] = useState<Site[]>([])
  const [packages, setPackages] = useState<PackageData[]>([])
  const [headlines, setHeadlines] = useState<BOQHeadline[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedSite, setSelectedSite] = useState<string>(siteFilter || 'all')
  const [selectedPackage, setSelectedPackage] = useState<string>(packageFilter || 'all')

  useEffect(() => {
    fetchData()
  }, [])

  useEffect(() => {
    fetchHeadlines()
  }, [selectedSite, selectedPackage])

  async function fetchData() {
    try {
      // Fetch sites
      const { data: sitesData } = await supabase
        .from('sites')
        .select('id, name')
        .order('name')

      setSites(sitesData || [])

      // Fetch packages
      const { data: packagesData } = await supabase
        .from('packages')
        .select('id, name, site_id')
        .order('name')

      setPackages(packagesData || [])
    } catch (error) {
      console.error('Error fetching data:', error)
    }
  }

  async function fetchHeadlines() {
    setLoading(true)
    try {
      let query = supabase
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
        .order('serial_number')

      if (selectedPackage && selectedPackage !== 'all') {
        query = query.eq('package_id', selectedPackage)
      } else if (selectedSite && selectedSite !== 'all') {
        // Get packages for this site first
        const sitePackages = packages.filter(p => p.site_id === selectedSite)
        const packageIds = sitePackages.map(p => p.id)
        if (packageIds.length > 0) {
          query = query.in('package_id', packageIds)
        } else {
          setHeadlines([])
          setLoading(false)
          return
        }
      }

      const { data, error } = await query

      if (error) throw error
      setHeadlines(data || [])
    } catch (error) {
      console.error('Error fetching headlines:', error)
      toast.error('Failed to fetch BOQ data')
    } finally {
      setLoading(false)
    }
  }

  async function deleteHeadline(id: string) {
    if (!confirm('Are you sure you want to delete this BOQ headline? This will also delete all line items.')) {
      return
    }

    try {
      const { error } = await supabase
        .from('boq_headlines')
        .delete()
        .eq('id', id)

      if (error) throw error

      setHeadlines(headlines.filter(h => h.id !== id))
      toast.success('BOQ headline deleted')
    } catch (error) {
      console.error('Error deleting headline:', error)
      toast.error('Failed to delete BOQ headline')
    }
  }

  const filteredPackages = selectedSite && selectedSite !== 'all'
    ? packages.filter(p => p.site_id === selectedSite)
    : packages

  const statusColors: Record<string, string> = {
    pending: 'bg-slate-100 text-slate-700',
    in_progress: 'bg-blue-100 text-blue-700',
    completed: 'bg-green-100 text-green-700',
  }

  return (
    <div className="flex flex-col min-h-screen">
      <Header title="BOQ Management" />

      <div className="flex-1 p-4 md:p-6 space-y-6">
        {/* Header Actions */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold">Bill of Quantities</h2>
            <p className="text-sm text-slate-500">Manage BOQ headlines and line items</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/boq/upload">
              <Button variant="outline">
                <Upload className="h-4 w-4 mr-2" />
                Upload Excel
              </Button>
            </Link>
            <Link href="/boq/new">
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Add BOQ Item
              </Button>
            </Link>
          </div>
        </div>

        {/* Filters */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Filters</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="flex-1">
                <label className="text-sm font-medium mb-1.5 block">Site</label>
                <Select value={selectedSite} onValueChange={(value) => {
                  setSelectedSite(value)
                  setSelectedPackage('all')
                }}>
                  <SelectTrigger>
                    <SelectValue placeholder="All Sites" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Sites</SelectItem>
                    {sites.map((site) => (
                      <SelectItem key={site.id} value={site.id}>
                        {site.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex-1">
                <label className="text-sm font-medium mb-1.5 block">Package</label>
                <Select value={selectedPackage} onValueChange={setSelectedPackage}>
                  <SelectTrigger>
                    <SelectValue placeholder="All Packages" />
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
            </div>
          </CardContent>
        </Card>

        {/* BOQ Headlines List */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileSpreadsheet className="h-5 w-5" />
              BOQ Headlines
            </CardTitle>
            <CardDescription>
              {headlines.length} headline{headlines.length !== 1 ? 's' : ''} found
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-8 text-slate-500">Loading BOQ data...</div>
            ) : headlines.length === 0 ? (
              <div className="text-center py-12">
                <FileSpreadsheet className="h-12 w-12 mx-auto text-slate-300 mb-4" />
                <h3 className="text-lg font-medium text-slate-900 mb-2">No BOQ items yet</h3>
                <p className="text-slate-500 mb-4">
                  Upload a BOQ Excel file or add items manually.
                </p>
                <div className="flex flex-wrap justify-center gap-2">
                  <Link href="/boq/upload">
                    <Button variant="outline">
                      <Upload className="h-4 w-4 mr-2" />
                      Upload Excel
                    </Button>
                  </Link>
                  <Link href="/boq/new">
                    <Button>
                      <Plus className="h-4 w-4 mr-2" />
                      Add Manually
                    </Button>
                  </Link>
                </div>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[60px]">S.No</TableHead>
                      <TableHead>BOQ Headline</TableHead>
                      <TableHead>Site / Package</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="w-[50px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {headlines.map((headline) => (
                      <TableRow key={headline.id}>
                        <TableCell className="font-medium">
                          {headline.serial_number}
                        </TableCell>
                        <TableCell>
                          <Link
                            href={`/boq/${headline.id}`}
                            className="font-medium hover:text-blue-600 hover:underline"
                          >
                            {headline.name}
                          </Link>
                          {headline.description && (
                            <p className="text-sm text-slate-500 mt-0.5 line-clamp-1">
                              {headline.description}
                            </p>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col gap-1">
                            <span className="flex items-center gap-1 text-sm">
                              <Building2 className="h-3 w-3 text-slate-400" />
                              {headline.packages?.sites?.name || '-'}
                            </span>
                            <span className="flex items-center gap-1 text-sm text-slate-500">
                              <Package className="h-3 w-3 text-slate-400" />
                              {headline.packages?.name || '-'}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge className={statusColors[headline.status] || statusColors.pending} variant="secondary">
                            {headline.status.replace('_', ' ')}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem asChild>
                                <Link href={`/boq/${headline.id}`}>
                                  <Eye className="h-4 w-4 mr-2" />
                                  View Details
                                </Link>
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                className="text-red-600"
                                onClick={() => deleteHeadline(headline.id)}
                              >
                                <Trash2 className="h-4 w-4 mr-2" />
                                Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

export default function BOQPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-screen">Loading...</div>}>
      <BOQContent />
    </Suspense>
  )
}
