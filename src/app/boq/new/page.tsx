'use client'

import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Header } from '@/components/layout/header'
import { Button } from '@/components/ui/button'
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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ArrowLeft, FileSpreadsheet, Save } from 'lucide-react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'

interface Site {
  id: string
  name: string
}

interface Package {
  id: string
  name: string
  site_id: string
}

function NewBOQForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const packageIdParam = searchParams.get('package')

  const [sites, setSites] = useState<Site[]>([])
  const [packages, setPackages] = useState<Package[]>([])
  const [loading, setLoading] = useState(false)

  const [selectedSite, setSelectedSite] = useState('')
  const [selectedPackage, setSelectedPackage] = useState(packageIdParam || '')
  const [formData, setFormData] = useState({
    serial_number: 1,
    name: '',
    description: '',
  })

  useEffect(() => {
    fetchData()
  }, [])

  useEffect(() => {
    // Auto-select site when package is provided
    if (packageIdParam && packages.length > 0) {
      const pkg = packages.find(p => p.id === packageIdParam)
      if (pkg) {
        setSelectedSite(pkg.site_id)
        setSelectedPackage(packageIdParam)
      }
    }
  }, [packageIdParam, packages])

  useEffect(() => {
    // Fetch next serial number when package changes
    if (selectedPackage) {
      fetchNextSerialNumber()
    }
  }, [selectedPackage])

  async function fetchData() {
    try {
      const { data: sitesData } = await supabase
        .from('sites')
        .select('id, name')
        .order('name')

      setSites(sitesData || [])

      const { data: packagesData } = await supabase
        .from('packages')
        .select('id, name, site_id')
        .order('name')

      setPackages(packagesData || [])
    } catch (error) {
      console.error('Error fetching data:', error)
    }
  }

  async function fetchNextSerialNumber() {
    try {
      const { data } = await supabase
        .from('boq_headlines')
        .select('serial_number')
        .eq('package_id', selectedPackage)
        .order('serial_number', { ascending: false })
        .limit(1)

      const nextNumber = data && data.length > 0 ? data[0].serial_number + 1 : 1
      setFormData(prev => ({ ...prev, serial_number: nextNumber }))
    } catch (error) {
      console.error('Error fetching serial number:', error)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    if (!selectedPackage) {
      toast.error('Please select a package')
      return
    }

    if (!formData.name.trim()) {
      toast.error('BOQ headline name is required')
      return
    }

    setLoading(true)

    try {
      const { data, error } = await supabase
        .from('boq_headlines')
        .insert({
          package_id: selectedPackage,
          serial_number: formData.serial_number,
          name: formData.name.trim(),
          description: formData.description.trim() || null,
          status: 'pending',
        })
        .select()
        .single()

      if (error) throw error

      toast.success('BOQ headline created successfully')
      router.push(`/boq/${data.id}`)
    } catch (error) {
      console.error('Error creating BOQ headline:', error)
      toast.error('Failed to create BOQ headline')
    } finally {
      setLoading(false)
    }
  }

  const filteredPackages = selectedSite
    ? packages.filter(p => p.site_id === selectedSite)
    : packages

  return (
    <div className="flex flex-col min-h-screen">
      <Header title="Add BOQ Headline" />

      <div className="flex-1 p-4 md:p-6">
        {/* Back Button */}
        <Link href="/boq" className="inline-flex items-center text-sm text-slate-600 hover:text-slate-900 mb-6">
          <ArrowLeft className="h-4 w-4 mr-1" />
          Back to BOQ
        </Link>

        <div className="max-w-2xl">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileSpreadsheet className="h-5 w-5" />
                Create BOQ Headline
              </CardTitle>
              <CardDescription>
                Add a new BOQ headline item (e.g., PCC Work, Brick Work, Plastering)
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-6">
                {/* Site Selection */}
                <div className="space-y-2">
                  <Label>Site *</Label>
                  <Select
                    value={selectedSite}
                    onValueChange={(value) => {
                      setSelectedSite(value)
                      setSelectedPackage('')
                    }}
                  >
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

                {/* Package Selection */}
                <div className="space-y-2">
                  <Label>Package *</Label>
                  <Select
                    value={selectedPackage}
                    onValueChange={setSelectedPackage}
                    disabled={!selectedSite}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={selectedSite ? "Select package" : "Select site first"} />
                    </SelectTrigger>
                    <SelectContent>
                      {filteredPackages.map((pkg) => (
                        <SelectItem key={pkg.id} value={pkg.id}>
                          {pkg.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {selectedSite && filteredPackages.length === 0 && (
                    <p className="text-sm text-amber-600">
                      No packages found for this site.{' '}
                      <Link href={`/sites/${selectedSite}`} className="underline">
                        Add a package
                      </Link>{' '}
                      first.
                    </p>
                  )}
                </div>

                {/* Serial Number */}
                <div className="space-y-2">
                  <Label htmlFor="serial_number">Serial Number</Label>
                  <Input
                    id="serial_number"
                    type="number"
                    min="1"
                    value={formData.serial_number}
                    onChange={(e) => setFormData({ ...formData, serial_number: parseInt(e.target.value) || 1 })}
                  />
                  <p className="text-xs text-slate-500">
                    Auto-filled based on existing items. You can change if needed.
                  </p>
                </div>

                {/* Name */}
                <div className="space-y-2">
                  <Label htmlFor="name">
                    BOQ Headline Name *
                  </Label>
                  <Input
                    id="name"
                    placeholder="e.g., P.C.C. WORK, FULL BRICK WORK, PLASTERING"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                  />
                  <p className="text-xs text-slate-500">
                    The main category name for this BOQ item
                  </p>
                </div>

                {/* Description */}
                <div className="space-y-2">
                  <Label htmlFor="description">Description (Optional)</Label>
                  <Textarea
                    id="description"
                    placeholder="Detailed description of the work scope..."
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    rows={4}
                  />
                </div>

                {/* Submit Buttons */}
                <div className="flex flex-col-reverse sm:flex-row gap-3 pt-4">
                  <Link href="/boq" className="w-full sm:w-auto">
                    <Button type="button" variant="outline" className="w-full">
                      Cancel
                    </Button>
                  </Link>
                  <Button type="submit" disabled={loading} className="w-full sm:w-auto">
                    {loading ? (
                      'Creating...'
                    ) : (
                      <>
                        <Save className="h-4 w-4 mr-2" />
                        Create BOQ Headline
                      </>
                    )}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

export default function NewBOQPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-screen">Loading...</div>}>
      <NewBOQForm />
    </Suspense>
  )
}
