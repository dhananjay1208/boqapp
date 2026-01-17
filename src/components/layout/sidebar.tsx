'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import {
  LayoutDashboard,
  Building2,
  FileSpreadsheet,
  Package,
  ClipboardCheck,
  FileText,
  Receipt,
  BarChart3,
  Settings,
  Table2,
  CheckSquare,
} from 'lucide-react'

const navigation = [
  { name: 'Dashboard', href: '/', icon: LayoutDashboard },
  { name: 'Sites', href: '/sites', icon: Building2 },
  { name: 'BOQ', href: '/boq', icon: FileSpreadsheet },
  { name: 'MIR View', href: '/mir-view', icon: Table2 },
  { name: 'Materials', href: '/materials', icon: Package },
  { name: 'Compliance', href: '/compliance', icon: ClipboardCheck },
  { name: 'Checklists', href: '/checklists', icon: ClipboardCheck },
  { name: 'JMR', href: '/jmr', icon: FileText },
  { name: 'Billing Readiness', href: '/billing-readiness', icon: CheckSquare },
  { name: 'Billing', href: '/billing', icon: Receipt },
  { name: 'Reports', href: '/reports', icon: BarChart3 },
]

interface SidebarProps {
  className?: string
}

export function Sidebar({ className }: SidebarProps) {
  const pathname = usePathname()

  return (
    <div className={cn('flex h-full flex-col bg-slate-900 text-white', className)}>
      {/* Logo */}
      <div className="flex h-16 items-center px-6 border-b border-slate-800">
        <Link href="/" className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-blue-600 flex items-center justify-center">
            <FileSpreadsheet className="h-5 w-5" />
          </div>
          <span className="font-semibold text-lg">BOQ Manager</span>
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {navigation.map((item) => {
          const isActive = pathname === item.href ||
            (item.href !== '/' && pathname.startsWith(item.href))

          return (
            <Link
              key={item.name}
              href={item.href}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                isActive
                  ? 'bg-blue-600 text-white'
                  : 'text-slate-300 hover:bg-slate-800 hover:text-white'
              )}
            >
              <item.icon className="h-5 w-5 flex-shrink-0" />
              {item.name}
            </Link>
          )
        })}
      </nav>

      {/* Footer */}
      <div className="p-4 border-t border-slate-800">
        <Link
          href="/settings"
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-slate-300 hover:bg-slate-800 hover:text-white transition-colors"
        >
          <Settings className="h-5 w-5" />
          Settings
        </Link>
      </div>
    </div>
  )
}
