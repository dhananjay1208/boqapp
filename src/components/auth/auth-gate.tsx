'use client'

import { useEffect, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import Link from 'next/link'
import { Loader2, Lock } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { getSession, hasModuleAccess, isAdmin, isSuperuser, type Session } from '@/lib/auth'
import { moduleKeyForPath, getModule } from '@/lib/modules'

interface AuthGateProps {
  children: React.ReactNode
}

const PUBLIC_PATHS = new Set(['/login'])

export function AuthGate({ children }: AuthGateProps) {
  const router = useRouter()
  const pathname = usePathname()
  const [session, setSession] = useState<Session | null>(null)
  const [checked, setChecked] = useState(false)

  useEffect(() => {
    const s = getSession()
    setSession(s)
    setChecked(true)
    if (!s && !PUBLIC_PATHS.has(pathname)) {
      router.replace('/login')
    }
  }, [pathname, router])

  // Loading state until we've checked localStorage.
  if (!checked) {
    return (
      <div className="flex h-screen w-full items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
      </div>
    )
  }

  // Public path - render directly.
  if (PUBLIC_PATHS.has(pathname)) {
    return <>{children}</>
  }

  // No session - the redirect above is in flight; render a thin placeholder.
  if (!session) {
    return (
      <div className="flex h-screen w-full items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
      </div>
    )
  }

  // Per-module access check.
  const moduleKey = moduleKeyForPath(pathname)
  if (moduleKey) {
    const mod = getModule(moduleKey)
    if (mod?.requires === 'superuser' && !isSuperuser(session)) {
      return <NoAccess reason="superuser" />
    }
    if (mod?.requires === 'admin' && !isAdmin(session)) {
      return <NoAccess reason="admin" />
    }
    if (!hasModuleAccess(moduleKey, session)) {
      return <NoAccess reason="module" />
    }
  }

  return <>{children}</>
}

function NoAccess({ reason }: { reason: 'admin' | 'superuser' | 'module' }) {
  const message =
    reason === 'superuser'
      ? 'This page is only available to Cogneta administrators.'
      : reason === 'admin'
      ? 'This page is only available to admin users. Ask your admin to grant access.'
      : "You don't have access to this module. Contact your admin to request access."

  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <Card className="max-w-md">
        <CardContent className="flex flex-col items-center gap-4 py-10 text-center">
          <div className="rounded-full bg-amber-50 p-3">
            <Lock className="h-6 w-6 text-amber-600" />
          </div>
          <div>
            <h2 className="text-lg font-semibold">Access restricted</h2>
            <p className="mt-1 text-sm text-slate-600">{message}</p>
          </div>
          <Link href="/">
            <Button variant="outline">Back to home</Button>
          </Link>
        </CardContent>
      </Card>
    </div>
  )
}
