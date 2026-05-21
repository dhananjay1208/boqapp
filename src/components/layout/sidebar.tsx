'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'
import {
  LayoutDashboard,
  Building2,
  FileSpreadsheet,
  ClipboardCheck,
  BarChart3,
  Database,
  ChevronDown,
  ChevronRight,
  ListTree,
  Receipt,
  Warehouse,
  Truck,
  Users,
  Wallet,
  PieChart,
  TrendingUp,
  CreditCard,
  HardHat,
  Tag,
  Wrench,
  FileText,
  LayoutList,
  IndianRupee,
  Home,
  LogOut,
  KeyRound,
  Briefcase,
} from 'lucide-react'
import { clearSession, getSession, hasModuleAccess, isAdmin, isSuperuser, type Session } from '@/lib/auth'
import type { ModuleKey } from '@/lib/modules'

interface NavItem {
  name: string
  href: string
  icon: React.ComponentType<{ className?: string }>
  moduleKey: ModuleKey
  requires?: 'admin' | 'superuser'
}

interface NavGroup {
  name: string
  icon: React.ComponentType<{ className?: string }>
  items: NavItem[]
  moduleKey: ModuleKey
}

const navigation: NavItem[] = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard, moduleKey: 'dashboard' },
  { name: 'Sites', href: '/sites', icon: Building2, moduleKey: 'sites' },
  { name: 'BOQ Management', href: '/boq', icon: FileSpreadsheet, moduleKey: 'boq' },
  { name: 'BOQ Progress', href: '/boq-progress', icon: TrendingUp, moduleKey: 'boq-progress' },
  { name: 'RA Billing', href: '/ra-billing', icon: IndianRupee, moduleKey: 'ra-billing' },
  { name: 'Workstations', href: '/workstations', icon: Wrench, moduleKey: 'workstations' },
  { name: 'Material GRN', href: '/material-grn', icon: Receipt, moduleKey: 'material-grn' },
  { name: 'Inventory', href: '/inventory', icon: Warehouse, moduleKey: 'inventory' },
  { name: 'Expenses Recording', href: '/expenses', icon: Wallet, moduleKey: 'expenses' },
  { name: 'Expense Dashboard', href: '/expense-dashboard', icon: PieChart, moduleKey: 'expense-dashboard' },
  { name: 'Supplier Invoices', href: '/supplier-invoices', icon: CreditCard, moduleKey: 'supplier-invoices' },
  { name: 'Checklists', href: '/checklists', icon: ClipboardCheck, moduleKey: 'checklists' },
]

const adminItems: NavItem[] = [
  { name: 'Manage Users', href: '/admin/users', icon: Users, moduleKey: 'admin-users', requires: 'admin' },
  { name: 'Activation Codes', href: '/admin/codes', icon: KeyRound, moduleKey: 'admin-codes', requires: 'superuser' },
  { name: 'Tenants', href: '/admin/tenants', icon: Briefcase, moduleKey: 'admin-tenants', requires: 'superuser' },
]

const reportsGroup: NavGroup = {
  name: 'Reports',
  icon: BarChart3,
  moduleKey: 'reports',
  items: [
    { name: 'Overview', href: '/reports', icon: LayoutList, moduleKey: 'reports' },
    { name: 'MIR Reports', href: '/reports/mir', icon: FileText, moduleKey: 'reports' },
  ],
}

const masterDataGroup: NavGroup = {
  name: 'Master Data',
  icon: Database,
  moduleKey: 'master-data',
  items: [
    { name: 'Workstations', href: '/master-data/workstations', icon: Wrench, moduleKey: 'master-data' },
    { name: 'Material List', href: '/master-data/materials', icon: ListTree, moduleKey: 'master-data' },
    { name: 'Equipment Types', href: '/master-data/equipment-types', icon: Truck, moduleKey: 'master-data' },
    { name: 'Equipment Rates', href: '/master-data/equipment', icon: Truck, moduleKey: 'master-data' },
    { name: 'Labour Contractors', href: '/master-data/labour-contractors', icon: HardHat, moduleKey: 'master-data' },
    { name: 'Manpower Categories', href: '/master-data/manpower-categories', icon: Tag, moduleKey: 'master-data' },
    { name: 'Manpower Rates', href: '/master-data/manpower', icon: Users, moduleKey: 'master-data' },
    { name: 'Suppliers', href: '/master-data/suppliers', icon: Building2, moduleKey: 'master-data' },
  ],
}

interface SidebarProps {
  className?: string
}

function visibleForSession(item: NavItem, session: Session | null) {
  if (!session) return false
  if (item.requires === 'superuser' && !isSuperuser(session)) return false
  if (item.requires === 'admin' && !isAdmin(session)) return false
  return hasModuleAccess(item.moduleKey, session)
}

export function Sidebar({ className }: SidebarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const [session, setSession] = useState<Session | null>(null)
  const [masterDataExpanded, setMasterDataExpanded] = useState(pathname.startsWith('/master-data'))
  const [reportsExpanded, setReportsExpanded] = useState(pathname.startsWith('/reports'))

  useEffect(() => {
    setSession(getSession())
  }, [pathname])

  function handleLogout() {
    clearSession()
    router.replace('/login')
  }

  const filteredNav = navigation.filter((item) => visibleForSession(item, session))
  const filteredAdmin = adminItems.filter((item) => visibleForSession(item, session))
  const showReports = visibleForSession({ name: 'Reports', href: '/reports', icon: BarChart3, moduleKey: 'reports' }, session)
  const showMasterData = visibleForSession({ name: 'Master Data', href: '/master-data', icon: Database, moduleKey: 'master-data' }, session)

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
        {/* Home (module landing) */}
        <Link
          href="/"
          className={cn(
            'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
            pathname === '/'
              ? 'bg-blue-600 text-white'
              : 'text-slate-300 hover:bg-slate-800 hover:text-white'
          )}
        >
          <Home className="h-5 w-5 flex-shrink-0" />
          Home
        </Link>

        {filteredNav.map((item) => {
          const isActive =
            pathname === item.href ||
            (item.href !== '/' && pathname.startsWith(item.href + '/'))
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

        {/* Reports Group */}
        {showReports && (
          <div className="pt-2">
            <button
              onClick={() => setReportsExpanded(!reportsExpanded)}
              className={cn(
                'flex items-center justify-between w-full px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                pathname.startsWith('/reports')
                  ? 'bg-slate-800 text-white'
                  : 'text-slate-300 hover:bg-slate-800 hover:text-white'
              )}
            >
              <span className="flex items-center gap-3">
                <reportsGroup.icon className="h-5 w-5 flex-shrink-0" />
                {reportsGroup.name}
              </span>
              {reportsExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            </button>
            {reportsExpanded && (
              <div className="mt-1 ml-4 space-y-1">
                {reportsGroup.items.map((item) => {
                  const isActive = pathname === item.href
                  return (
                    <Link
                      key={item.name}
                      href={item.href}
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
        )}

        {/* Master Data Group */}
        {showMasterData && (
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
                <masterDataGroup.icon className="h-5 w-5 flex-shrink-0" />
                {masterDataGroup.name}
              </span>
              {masterDataExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            </button>
            {masterDataExpanded && (
              <div className="mt-1 ml-4 space-y-1">
                {masterDataGroup.items.map((item) => {
                  const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
                  return (
                    <Link
                      key={item.name}
                      href={item.href}
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
        )}

        {/* Admin section */}
        {filteredAdmin.length > 0 && (
          <div className="pt-4">
            <div className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
              Admin
            </div>
            {filteredAdmin.map((item) => {
              const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
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
          </div>
        )}
      </nav>

      {/* Footer - user identity + sign out */}
      <div className="border-t border-slate-800 p-4 space-y-2">
        {session && (
          <div className="px-2 py-1.5 rounded-md bg-slate-800/60">
            <div className="text-xs text-slate-400">{session.tenant_name}</div>
            <div className="text-sm font-medium text-white truncate">
              {session.full_name || session.username}
            </div>
          </div>
        )}
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-slate-300 hover:bg-slate-800 hover:text-white transition-colors"
        >
          <LogOut className="h-5 w-5" />
          Sign out
        </button>
      </div>
    </div>
  )
}
