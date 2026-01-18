'use client'

import { useState } from 'react'
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
  ClipboardCheck,
  Receipt,
  BarChart3,
  Settings,
  Database,
  ChevronDown,
  ChevronRight,
  ListTree,
  Warehouse,
  Truck,
  Users,
  Wallet,
  PieChart,
  TrendingUp,
} from 'lucide-react'

const navigation = [
  { name: 'Dashboard', href: '/', icon: LayoutDashboard },
  { name: 'Sites', href: '/sites', icon: Building2 },
  { name: 'BOQ Management', href: '/boq', icon: FileSpreadsheet },
  { name: 'BOQ Progress', href: '/boq-progress', icon: TrendingUp },
  { name: 'Material GRN', href: '/material-grn', icon: Receipt },
  { name: 'Inventory', href: '/inventory', icon: Warehouse },
  { name: 'Expenses Recording', href: '/expenses', icon: Wallet },
  { name: 'Expense Dashboard', href: '/expense-dashboard', icon: PieChart },
  { name: 'Checklists', href: '/checklists', icon: ClipboardCheck },
  { name: 'Reports', href: '/reports', icon: BarChart3 },
]

const masterDataItems = [
  { name: 'Material List', href: '/master-data/materials', icon: ListTree },
  { name: 'Equipment', href: '/master-data/equipment', icon: Truck },
  { name: 'Manpower', href: '/master-data/manpower', icon: Users },
]

interface MobileNavProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function MobileNav({ open, onOpenChange }: MobileNavProps) {
  const pathname = usePathname()
  const [masterDataExpanded, setMasterDataExpanded] = useState(
    pathname.startsWith('/master-data')
  )

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="left" className="w-72 p-0 bg-slate-900 flex flex-col">
        <SheetHeader className="h-16 px-6 border-b border-slate-800 flex flex-row items-center">
          <div className="h-8 w-8 rounded-lg bg-blue-600 flex items-center justify-center">
            <FileSpreadsheet className="h-5 w-5 text-white" />
          </div>
          <SheetTitle className="text-white ml-2">BOQ Manager</SheetTitle>
        </SheetHeader>

        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {navigation.map((item) => {
            const isActive = pathname === item.href ||
              (item.href !== '/' && pathname.startsWith(item.href + '/'))

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

          {/* Master Data Group */}
          <div className="pt-2">
            <button
              onClick={() => setMasterDataExpanded(!masterDataExpanded)}
              className={cn(
                'flex items-center justify-between w-full px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                pathname.startsWith('/master-data')
                  ? 'bg-slate-800 text-white'
                  : 'text-slate-300 hover:bg-slate-800 hover:text-white'
              )}
            >
              <span className="flex items-center gap-3">
                <Database className="h-5 w-5 flex-shrink-0" />
                Master Data
              </span>
              {masterDataExpanded ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
            </button>

            {masterDataExpanded && (
              <div className="mt-1 ml-4 space-y-1">
                {masterDataItems.map((item) => {
                  const isActive = pathname === item.href ||
                    pathname.startsWith(item.href)

                  return (
                    <Link
                      key={item.name}
                      href={item.href}
                      onClick={() => onOpenChange(false)}
                      className={cn(
                        'flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                        isActive
                          ? 'bg-blue-600 text-white'
                          : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                      )}
                    >
                      <item.icon className="h-4 w-4 flex-shrink-0" />
                      {item.name}
                    </Link>
                  )
                })}
              </div>
            )}
          </div>
        </nav>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800">
          <Link
            href="/settings"
            onClick={() => onOpenChange(false)}
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-slate-300 hover:bg-slate-800 hover:text-white transition-colors"
          >
            <Settings className="h-5 w-5" />
            Settings
          </Link>
        </div>
      </SheetContent>
    </Sheet>
  )
}
