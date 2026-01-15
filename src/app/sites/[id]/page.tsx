'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Header } from '@/components/layout/header'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  ArrowLeft,
  Building2,
  MapPin,
  Package,
  Plus,
  MoreHorizontal,
  Eye,
  Pencil,
  Trash2,
  FileSpreadsheet,
} from 'lucide-react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import type { Site, Package as PackageType } from '@/types/database'
import { toast } from 'sonner'
import { format } from 'date-fns'

export default function SiteDetailPage() {
  const params = useParams()
  const router = useRouter()
  const siteId = params.id as string

  const [site, setSite] = useState<Site | null>(null)
  const [packages, setPackages] = useState<PackageType[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [newPackage, setNewPackage] = useState({ name: '', code: '' })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetchSiteData()
  }, [siteId])

  async function fetchSiteData() {
    try {
      // Fetch site
      const { data: siteData, error: siteError } = await supabase
        .from('sites')
        .select('*')
        .eq('id', siteId)
        .single()

      if (siteError) throw siteError
      setSite(siteData)

      // Fetch packages
      const { data: packagesData, error: packagesError } = await supabase
        .from('packages')
        .select('*')
        .eq('site_id', siteId)
        .order('created_at', { ascending: true })

      if (packagesError) throw packagesError
      setPackages(packagesData || [])
    } catch (error) {
      console.error('Error fetching site data:', error)
      toast.error('Failed to load site data')
      router.push('/sites')
    } finally {
      setLoading(false)
    }
  }

  async function createPackage(e: React.FormEvent) {
    e.preventDefault()

    if (!newPackage.name.trim()) {
      toast.error('Package name is required')
      return
    }

    setSaving(true)
    try {
      const { data, error } = await supabase
        .from('packages')
        .insert([{
          site_id: siteId,
          name: newPackage.name.trim(),
          code: newPackage.code.trim() || null,
        }])
        .select()
        .single()

      if (error) throw error

      setPackages([...packages, data])
      setNewPackage({ name: '', code: '' })
      setDialogOpen(false)
      toast.success('Package created successfully')
    } catch (error) {
      console.error('Error creating package:', error)
      toast.error('Failed to create package')
    } finally {
      setSaving(false)
    }
  }

  async function deletePackage(id: string) {
    if (!confirm('Are you sure you want to delete this package? This will also delete all related BOQ items.')) {
      return
    }

    try {
      const { error } = await supabase
        .from('packages')
        .delete()
        .eq('id', id)

      if (error) throw error

      setPackages(packages.filter(p => p.id !== id))
      toast.success('Package deleted successfully')
    } catch (error) {
      console.error('Error deleting package:', error)
      toast.error('Failed to delete package')
    }
  }

  const statusColors = {
    active: 'bg-green-100 text-green-700',
    completed: 'bg-blue-100 text-blue-700',
    on_hold: 'bg-yellow-100 text-yellow-700',
  }

  if (loading) {
    return (
      <div className="flex flex-col min-h-screen">
        <Header title="Loading..." />
        <div className="flex-1 flex items-center justify-center">
          <p className="text-slate-500">Loading site data...</p>
        </div>
      </div>
    )
  }

  if (!site) {
    return null
  }

  return (
    <div className="flex flex-col min-h-screen">
      <Header title={site.name} />

      <div className="flex-1 p-4 md:p-6 space-y-6">
        {/* Back Button */}
        <Link href="/sites" className="inline-flex items-center text-sm text-slate-600 hover:text-slate-900">
          <ArrowLeft className="h-4 w-4 mr-1" />
          Back to Sites
        </Link>

        {/* Site Info Card */}
        <Card>
          <CardHeader>
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Building2 className="h-5 w-5" />
                  {site.name}
                </CardTitle>
                <CardDescription className="mt-1">
                  {site.client_name && <span>{site.client_name}</span>}
                  {site.client_name && site.location && <span> • </span>}
                  {site.location && (
                    <span className="inline-flex items-center gap-1">
                      <MapPin className="h-3 w-3" />
                      {site.location}
                    </span>
                  )}
                </CardDescription>
              </div>
              <Badge className={statusColors[site.status]} variant="secondary">
                {site.status.replace('_', ' ')}
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-sm text-slate-500">
              Created on {format(new Date(site.created_at), 'MMMM d, yyyy')}
            </div>
          </CardContent>
        </Card>

        {/* Packages Section */}
        <Card>
          <CardHeader>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Package className="h-5 w-5" />
                  Work Packages
                </CardTitle>
                <CardDescription>
                  {packages.length} package{packages.length !== 1 ? 's' : ''} for this site
                </CardDescription>
              </div>
              <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogTrigger asChild>
                  <Button>
                    <Plus className="h-4 w-4 mr-2" />
                    Add Package
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <form onSubmit={createPackage}>
                    <DialogHeader>
                      <DialogTitle>Add Work Package</DialogTitle>
                      <DialogDescription>
                        Create a new work package for this site (e.g., LA-Civil Work, LA-Plumbing Work)
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                      <div className="space-y-2">
                        <Label htmlFor="package-name">
                          Package Name <span className="text-red-500">*</span>
                        </Label>
                        <Input
                          id="package-name"
                          placeholder="e.g., LA-CIVIL WORK"
                          value={newPackage.name}
                          onChange={(e) => setNewPackage({ ...newPackage, name: e.target.value })}
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="package-code">Code (Optional)</Label>
                        <Input
                          id="package-code"
                          placeholder="e.g., LA-CW"
                          value={newPackage.code}
                          onChange={(e) => setNewPackage({ ...newPackage, code: e.target.value })}
                        />
                      </div>
                    </div>
                    <DialogFooter>
                      <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                        Cancel
                      </Button>
                      <Button type="submit" disabled={saving}>
                        {saving ? 'Creating...' : 'Create Package'}
                      </Button>
                    </DialogFooter>
                  </form>
                </DialogContent>
              </Dialog>
            </div>
          </CardHeader>
          <CardContent>
            {packages.length === 0 ? (
              <div className="text-center py-12">
                <Package className="h-12 w-12 mx-auto text-slate-300 mb-4" />
                <h3 className="text-lg font-medium text-slate-900 mb-2">No packages yet</h3>
                <p className="text-slate-500 mb-4">
                  Add work packages to start organizing your BOQ items.
                </p>
                <Button onClick={() => setDialogOpen(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Package
                </Button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Package Name</TableHead>
                      <TableHead>Code</TableHead>
                      <TableHead>BOQ Items</TableHead>
                      <TableHead>Created</TableHead>
                      <TableHead className="w-[50px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {packages.map((pkg) => (
                      <TableRow key={pkg.id}>
                        <TableCell className="font-medium">
                          <Link
                            href={`/boq?package=${pkg.id}`}
                            className="hover:text-blue-600 hover:underline"
                          >
                            {pkg.name}
                          </Link>
                        </TableCell>
                        <TableCell>{pkg.code || '-'}</TableCell>
                        <TableCell>
                          <Link
                            href={`/boq?package=${pkg.id}`}
                            className="inline-flex items-center gap-1 text-blue-600 hover:underline"
                          >
                            <FileSpreadsheet className="h-3 w-3" />
                            View BOQ
                          </Link>
                        </TableCell>
                        <TableCell className="text-slate-500">
                          {format(new Date(pkg.created_at), 'MMM d, yyyy')}
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
                                <Link href={`/boq?package=${pkg.id}`}>
                                  <Eye className="h-4 w-4 mr-2" />
                                  View BOQ
                                </Link>
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                className="text-red-600"
                                onClick={() => deletePackage(pkg.id)}
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

        {/* Quick Actions */}
        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-3">
            <Link href={`/boq/upload?site=${siteId}`}>
              <Button variant="outline">
                <FileSpreadsheet className="h-4 w-4 mr-2" />
                Upload BOQ Excel
              </Button>
            </Link>
            <Link href={`/boq?site=${siteId}`}>
              <Button variant="outline">
                <Eye className="h-4 w-4 mr-2" />
                View All BOQ
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
