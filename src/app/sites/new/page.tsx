'use client'

import { useEffect, useState } from 'react'
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
import { ArrowLeft, Building2, Save, KeyRound, ShieldCheck } from 'lucide-react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'
import { getSession, isSuperuser, type Session } from '@/lib/auth'

export default function NewSitePage() {
  const router = useRouter()
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({
    name: '',
    client_name: '',
    location: '',
    status: 'active' as 'active' | 'completed' | 'on_hold',
    activation_code: '',
  })

  useEffect(() => {
    setSession(getSession())
  }, [])

  const requiresCode = !!session && !isSuperuser(session)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!session) {
      toast.error('You are not signed in')
      return
    }
    if (!formData.name.trim()) {
      toast.error('Site name is required')
      return
    }
    if (requiresCode && !formData.activation_code.trim()) {
      toast.error('Activation code is required')
      return
    }

    setLoading(true)
    try {
      let codeRow: { id: string } | null = null

      if (requiresCode) {
        // Validate activation code: must exist, belong to this tenant, and be unused.
        const code = formData.activation_code.trim()
        const { data: existing, error: codeErr } = await supabase
          .from('site_activation_codes')
          .select('id, tenant_id, used_at')
          .eq('code', code)
          .maybeSingle()

        if (codeErr) throw codeErr
        if (!existing) {
          toast.error('Activation code not recognised')
          setLoading(false)
          return
        }
        if (existing.tenant_id !== session.tenant_id) {
          toast.error('This activation code is not valid for your company')
          setLoading(false)
          return
        }
        if (existing.used_at) {
          toast.error('This activation code has already been used')
          setLoading(false)
          return
        }
        codeRow = { id: existing.id }
      }

      // Create the site.
      const { data: newSite, error } = await supabase
        .from('sites')
        .insert([
          {
            name: formData.name.trim(),
            client_name: formData.client_name.trim() || null,
            location: formData.location.trim() || null,
            status: formData.status,
            tenant_id: session.tenant_id,
          },
        ])
        .select()
        .single()

      if (error) throw error

      // Consume the activation code (link it to the new site).
      if (codeRow && newSite) {
        await supabase
          .from('site_activation_codes')
          .update({ used_at: new Date().toISOString(), used_by_site_id: newSite.id })
          .eq('id', codeRow.id)
      }

      toast.success('Site created successfully')
      router.push(`/sites/${newSite.id}`)
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
                {/* Activation code (non-superuser tenants only) */}
                {requiresCode && (
                  <div className="space-y-2 rounded-lg border border-blue-100 bg-blue-50/60 p-4">
                    <Label htmlFor="activation_code" className="flex items-center gap-1.5">
                      <KeyRound className="h-4 w-4 text-blue-600" />
                      Activation Code <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      id="activation_code"
                      placeholder="e.g. EFC-A8K2-9PXM"
                      value={formData.activation_code}
                      onChange={(e) => setFormData({ ...formData, activation_code: e.target.value })}
                      required
                    />
                    <p className="text-xs text-slate-600">
                      A single-use code issued for this paid site. Contact Cogneta Automation if you don't have one.
                    </p>
                  </div>
                )}
                {!requiresCode && (
                  <div className="flex items-start gap-2 rounded-lg border border-emerald-100 bg-emerald-50/60 p-3 text-sm text-emerald-800">
                    <ShieldCheck className="h-4 w-4 flex-shrink-0 mt-0.5" />
                    <span>Signed in as superuser — activation code not required for this tenant.</span>
                  </div>
                )}

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
