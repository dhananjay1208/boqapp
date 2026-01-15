'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
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
} from 'lucide-react'

const navigation = [
  { name: 'Dashboard', href: '/', icon: LayoutDashboard },
  { name: 'Sites', href: '/sites', icon: Building2 },
  { name: 'BOQ', href: '/boq', icon: FileSpreadsheet },
  { name: 'Materials', href: '/materials', icon: Package },
  { name: 'Compliance', href: '/compliance', icon: ClipboardCheck },
  { name: 'Checklists', href: '/checklists', icon: ClipboardCheck },
  { name: 'JMR', href: '/jmr', icon: FileText },
  { name: 'Billing', href: '/billing', icon: Receipt },
  { name: 'Reports', href: '/reports', icon: BarChart3 },
  { name: 'Settings', href: '/settings', icon: Settings },
]

interface MobileNavProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function MobileNav({ open, onOpenChange }: MobileNavProps) {
  const pathname = usePathname()

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="left" className="w-72 p-0 bg-slate-900">
        <SheetHeader className="h-16 px-6 border-b border-slate-800 flex flex-row items-center">
          <div className="h-8 w-8 rounded-lg bg-blue-600 flex items-center justify-center">
            <FileSpreadsheet className="h-5 w-5 text-white" />
          </div>
          <SheetTitle className="text-white ml-2">BOQ Manager</SheetTitle>
        </SheetHeader>

        <nav className="px-3 py-4 space-y-1">
          {navigation.map((item) => {
            const isActive = pathname === item.href ||
              (item.href !== '/' && pathname.startsWith(item.href))

            return (
              <Link
                key={item.name}
                href={item.href}
                onClick={() => onOpenChange(false)}
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
      </SheetContent>
    </Sheet>
  )
}
