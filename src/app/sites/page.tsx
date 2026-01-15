'use client'

import { useEffect, useState } from 'react'
import { Header } from '@/components/layout/header'
import { Button } from '@/components/ui/button'
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Plus, MoreHorizontal, Building2, MapPin, Eye, Pencil, Trash2 } from 'lucide-react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import type { Site } from '@/types/database'
import { toast } from 'sonner'
import { format } from 'date-fns'

export default function SitesPage() {
  const [sites, setSites] = useState<Site[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchSites()
  }, [])

  async function fetchSites() {
    try {
      const { data, error } = await supabase
        .from('sites')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) throw error
      setSites(data || [])
    } catch (error) {
      console.error('Error fetching sites:', error)
      toast.error('Failed to fetch sites')
    } finally {
      setLoading(false)
    }
  }

  async function deleteSite(id: string) {
    if (!confirm('Are you sure you want to delete this site? This will also delete all related data.')) {
      return
    }

    try {
      const { error } = await supabase
        .from('sites')
        .delete()
        .eq('id', id)

      if (error) throw error

      setSites(sites.filter(s => s.id !== id))
      toast.success('Site deleted successfully')
    } catch (error) {
      console.error('Error deleting site:', error)
      toast.error('Failed to delete site')
    }
  }

  const statusColors = {
    active: 'bg-green-100 text-green-700',
    completed: 'bg-blue-100 text-blue-700',
    on_hold: 'bg-yellow-100 text-yellow-700',
  }

  return (
    <div className="flex flex-col min-h-screen">
      <Header title="Sites" />

      <div className="flex-1 p-4 md:p-6 space-y-6">
        {/* Header Actions */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold">All Sites</h2>
            <p className="text-sm text-slate-500">Manage your project sites</p>
          </div>
          <Link href="/sites/new">
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              New Site
            </Button>
          </Link>
        </div>

        {/* Sites List */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              Project Sites
            </CardTitle>
            <CardDescription>
              {sites.length} site{sites.length !== 1 ? 's' : ''} total
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-8 text-slate-500">Loading sites...</div>
            ) : sites.length === 0 ? (
              <div className="text-center py-12">
                <Building2 className="h-12 w-12 mx-auto text-slate-300 mb-4" />
                <h3 className="text-lg font-medium text-slate-900 mb-2">No sites yet</h3>
                <p className="text-slate-500 mb-4">Get started by creating your first project site.</p>
                <Link href="/sites/new">
                  <Button>
                    <Plus className="h-4 w-4 mr-2" />
                    Create Site
                  </Button>
                </Link>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Site Name</TableHead>
                      <TableHead>Client</TableHead>
                      <TableHead>Location</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Created</TableHead>
                      <TableHead className="w-[50px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sites.map((site) => (
                      <TableRow key={site.id}>
                        <TableCell className="font-medium">
                          <Link
                            href={`/sites/${site.id}`}
                            className="hover:text-blue-600 hover:underline"
                          >
                            {site.name}
                          </Link>
                        </TableCell>
                        <TableCell>{site.client_name || '-'}</TableCell>
                        <TableCell>
                          {site.location ? (
                            <span className="flex items-center gap-1">
                              <MapPin className="h-3 w-3 text-slate-400" />
                              {site.location}
                            </span>
                          ) : (
                            '-'
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge className={statusColors[site.status]} variant="secondary">
                            {site.status.replace('_', ' ')}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-slate-500">
                          {format(new Date(site.created_at), 'MMM d, yyyy')}
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
                                <Link href={`/sites/${site.id}`}>
                                  <Eye className="h-4 w-4 mr-2" />
                                  View
                                </Link>
                              </DropdownMenuItem>
                              <DropdownMenuItem asChild>
                                <Link href={`/sites/${site.id}/edit`}>
                                  <Pencil className="h-4 w-4 mr-2" />
                                  Edit
                                </Link>
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                className="text-red-600"
                                onClick={() => deleteSite(site.id)}
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
