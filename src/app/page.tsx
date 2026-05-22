'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { FileSpreadsheet, LogOut, User } from 'lucide-react'
import { clearSession, getSession, hasModuleAccess, isAdmin, isSuperuser, type Session } from '@/lib/auth'
import { MODULES, MODULE_GROUPS, getModule } from '@/lib/modules'
import { LandingBackdrop } from '@/lib/landing-backdrop'

export default function ModuleLandingPage() {
  const router = useRouter()
  const [session, setSession] = useState<Session | null>(null)
  const [checked, setChecked] = useState(false)

  useEffect(() => {
    const s = getSession()
    if (!s) {
      router.replace('/login')
      return
    }
    setSession(s)
    setChecked(true)
  }, [router])

  if (!checked || !session) return null

  function visibleModules(keys: typeof MODULES[number]['key'][]) {
    return keys
      .map((k) => getModule(k))
      .filter((m): m is NonNullable<ReturnType<typeof getModule>> => !!m)
      .filter((m) => {
        if (m.requires === 'superuser' && !isSuperuser(session)) return false
        if (m.requires === 'admin' && !isAdmin(session)) return false
        return hasModuleAccess(m.key, session)
      })
  }

  function handleLogout() {
    clearSession()
    router.replace('/login')
  }

  const roleLabel = session.role === 'superuser' ? 'Superuser' : session.role === 'admin' ? 'Admin' : 'User'

  return (
    <div className="relative min-h-screen overflow-hidden">
      <LandingBackdrop />

      {/* Header strip */}
      <header className="relative z-10 border-b border-white/50 bg-white/75 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 md:px-8">
          <Link href="/" className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-blue-600 to-blue-800 shadow-sm">
              <FileSpreadsheet className="h-5 w-5 text-white" />
            </div>
            <div className="leading-tight">
              <div className="text-sm font-semibold text-slate-900">{session.tenant_name}</div>
              <div className="text-xs text-slate-500">Construction Management System</div>
            </div>
          </Link>

          <div className="flex items-center gap-2">
            <div className="hidden sm:flex items-center gap-2 rounded-full border border-slate-200/80 bg-white/90 px-3 py-1.5 shadow-sm">
              <User className="h-3.5 w-3.5 text-slate-500" />
              <span className="text-xs font-medium text-slate-700">{session.full_name || session.username}</span>
              <Badge variant="secondary" className="text-[10px]">{roleLabel}</Badge>
            </div>
            <Button variant="ghost" size="sm" onClick={handleLogout}>
              <LogOut className="mr-1.5 h-4 w-4" />
              Sign out
            </Button>
          </div>
        </div>
      </header>

      {/* Body */}
      <main className="relative z-10 mx-auto max-w-7xl px-4 py-10 md:px-8 md:py-14">
        <div className="text-center">
          <h1 className="text-3xl font-bold tracking-tight text-slate-900 md:text-4xl">
            Construction Management System
          </h1>
          <p className="mt-2 text-sm text-slate-600 md:text-base">Select a module to continue</p>
        </div>

        <div className="mt-12 space-y-12">
          {MODULE_GROUPS.map((group) => {
            const mods = visibleModules(group.moduleKeys)
            if (mods.length === 0) return null
            return (
              <section key={group.name}>
                <div className="mb-6 flex items-center gap-3">
                  <div className="h-px flex-1 bg-slate-300/60" />
                  <span
                    className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium shadow-sm ${group.pillColor}`}
                  >
                    <span className="h-1.5 w-1.5 rounded-full bg-current opacity-70" />
                    {group.name}
                  </span>
                  <div className="h-px flex-1 bg-slate-300/60" />
                </div>
                <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
                  {mods.map((m) => {
                    const Icon = m.icon
                    return (
                      <Link key={m.key} href={m.href} className="group">
                        <Card className="h-full rounded-2xl border-slate-200/80 bg-white/95 shadow-sm transition-all duration-200 hover:-translate-y-1 hover:border-blue-200 hover:shadow-lg">
                          <CardContent className="flex h-full flex-col gap-4 p-6">
                            <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${m.tint}`}>
                              <Icon className="h-6 w-6" />
                            </div>
                            <div>
                              <div className="text-base font-semibold text-slate-900">{m.name}</div>
                              <div className="mt-1 text-xs text-slate-500 leading-relaxed">{m.description}</div>
                            </div>
                          </CardContent>
                        </Card>
                      </Link>
                    )
                  })}
                </div>
              </section>
            )
          })}
        </div>

        <p className="mt-16 text-center text-xs text-slate-500">
          © {new Date().getFullYear()} Cogneta Automation. All rights reserved.
        </p>
      </main>
    </div>
  )
}
