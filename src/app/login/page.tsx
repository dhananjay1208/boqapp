'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
import { FileSpreadsheet, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react'
import { login, lookupTenantName, getSession } from '@/lib/auth'
import { toast } from 'sonner'
import { LandingBackdrop } from '@/lib/landing-backdrop'

export default function LoginPage() {
  const router = useRouter()
  const [companyCode, setCompanyCode] = useState('')
  const [password, setPassword] = useState('')
  const [tenantName, setTenantName] = useState<string | null>(null)
  const [tenantLookupState, setTenantLookupState] = useState<'idle' | 'looking' | 'found' | 'unknown'>('idle')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (getSession()) router.replace('/')
  }, [router])

  // Debounced company-code lookup for confirmation.
  useEffect(() => {
    const trimmed = companyCode.trim()
    if (!trimmed) {
      setTenantName(null)
      setTenantLookupState('idle')
      return
    }
    setTenantLookupState('looking')
    const handle = setTimeout(async () => {
      const name = await lookupTenantName(trimmed)
      if (name) {
        setTenantName(name)
        setTenantLookupState('found')
      } else {
        setTenantName(null)
        setTenantLookupState('unknown')
      }
    }, 400)
    return () => clearTimeout(handle)
  }, [companyCode])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      await login(companyCode, password)
      toast.success('Welcome')
      router.replace('/')
    } catch (err: any) {
      setError(err?.message || 'Login failed')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden">
      <LandingBackdrop />

      {/* Foreground content */}
      <div className="relative z-10 w-full max-w-md px-6">
        {/* Brand */}
        <div className="mb-8 flex flex-col items-center text-center">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-600 to-blue-800 shadow-lg">
            <FileSpreadsheet className="h-8 w-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900">BOQ Manager</h1>
          <p className="text-sm text-slate-600">Construction Management System</p>
        </div>

        <Card className="border-white/10 bg-white/95 backdrop-blur-md shadow-2xl">
          <CardContent className="space-y-5 py-7">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Sign in to your company</h2>
              <p className="mt-1 text-sm text-slate-500">
                Enter your company code and password to continue.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="company">Company code</Label>
                <Input
                  id="company"
                  placeholder="e.g. EFC"
                  value={companyCode}
                  onChange={(e) => setCompanyCode(e.target.value)}
                  autoComplete="organization"
                  required
                />
                <div className="min-h-[1.25rem] text-xs">
                  {tenantLookupState === 'looking' && companyCode.trim() && (
                    <span className="flex items-center gap-1.5 text-slate-400">
                      <Loader2 className="h-3 w-3 animate-spin" />
                      Looking up company...
                    </span>
                  )}
                  {tenantLookupState === 'found' && tenantName && (
                    <span className="flex items-center gap-1.5 text-emerald-700">
                      <CheckCircle2 className="h-3 w-3" />
                      {tenantName}
                    </span>
                  )}
                  {tenantLookupState === 'unknown' && (
                    <span className="flex items-center gap-1.5 text-amber-700">
                      <AlertCircle className="h-3 w-3" />
                      Unknown company code
                    </span>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  required
                />
              </div>

              {error && (
                <div className="flex items-start gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                  <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <Button type="submit" className="w-full" disabled={submitting}>
                {submitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Signing in...
                  </>
                ) : (
                  'Sign in'
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

        <p className="mt-6 text-center text-xs text-slate-500">
          © {new Date().getFullYear()} Cogneta Automation. All rights reserved.
        </p>
      </div>
    </div>
  )
}
