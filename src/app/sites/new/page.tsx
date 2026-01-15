'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
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
import { ArrowLeft, Building2, Save } from 'lucide-react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'

export default function NewSitePage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({
    name: '',
    client_name: '',
    location: '',
    status: 'active' as 'active' | 'completed' | 'on_hold',
  })

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    if (!formData.name.trim()) {
      toast.error('Site name is required')
      return
    }

    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('sites')
        .insert([{
          name: formData.name.trim(),
          client_name: formData.client_name.trim() || null,
          location: formData.location.trim() || null,
          status: formData.status,
        }])
        .select()
        .single()

      if (error) throw error

      toast.success('Site created successfully')
      router.push(`/sites/${data.id}`)
    } catch (error) {
      console.error('Error creating site:', error)
      toast.error('Failed to create site')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col min-h-screen">
      <Header title="New Site" />

      <div className="flex-1 p-4 md:p-6">
        {/* Back Button */}
        <Link href="/sites" className="inline-flex items-center text-sm text-slate-600 hover:text-slate-900 mb-6">
          <ArrowLeft className="h-4 w-4 mr-1" />
          Back to Sites
        </Link>

        <div className="max-w-2xl">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="h-5 w-5" />
                Create New Site
              </CardTitle>
              <CardDescription>
                Add a new project site to start tracking BOQ and materials.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-6">
                {/* Site Name */}
                <div className="space-y-2">
                  <Label htmlFor="name">
                    Site Name <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="name"
                    placeholder="e.g., TCS-Vizag"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                  />
                  <p className="text-xs text-slate-500">
                    A unique name to identify this project site
                  </p>
                </div>

                {/* Client Name */}
                <div className="space-y-2">
                  <Label htmlFor="client_name">Client Name</Label>
                  <Input
                    id="client_name"
                    placeholder="e.g., TCS"
                    value={formData.client_name}
                    onChange={(e) => setFormData({ ...formData, client_name: e.target.value })}
                  />
                  <p className="text-xs text-slate-500">
                    The company or organization this project is for
                  </p>
                </div>

                {/* Location */}
                <div className="space-y-2">
                  <Label htmlFor="location">Location</Label>
                  <Textarea
                    id="location"
                    placeholder="e.g., Visakhapatnam, Andhra Pradesh"
                    value={formData.location}
                    onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                    rows={2}
                  />
                  <p className="text-xs text-slate-500">
                    Physical location or address of the site
                  </p>
                </div>

                {/* Status */}
                <div className="space-y-2">
                  <Label htmlFor="status">Status</Label>
                  <Select
                    value={formData.status}
                    onValueChange={(value: 'active' | 'completed' | 'on_hold') =>
                      setFormData({ ...formData, status: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="on_hold">On Hold</SelectItem>
                      <SelectItem value="completed">Completed</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Submit Buttons */}
                <div className="flex flex-col-reverse sm:flex-row gap-3 pt-4">
                  <Link href="/sites" className="w-full sm:w-auto">
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
                        Create Site
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
