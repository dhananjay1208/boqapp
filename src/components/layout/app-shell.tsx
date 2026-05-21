'use client'

import { usePathname } from 'next/navigation'
import { Sidebar } from '@/components/layout/sidebar'

// Pages that render full-bleed - no sidebar, no slate background.
const FULL_BLEED = new Set(['/login', '/'])

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  if (FULL_BLEED.has(pathname)) {
    return <>{children}</>
  }
  return (
    <div className="flex h-screen overflow-hidden">
      <aside className="hidden md:flex md:w-64 md:flex-col">
        <Sidebar />
      </aside>
      <main className="flex-1 overflow-y-auto bg-slate-50">{children}</main>
    </div>
  )
}
