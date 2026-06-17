import {
  LayoutDashboard,
  Building2,
  FileSpreadsheet,
  TrendingUp,
  IndianRupee,
  Wrench,
  Receipt,
  Warehouse,
  Wallet,
  PieChart,
  CreditCard,
  ClipboardCheck,
  BarChart3,
  Database,
  Users,
  KeyRound,
  Briefcase,
  ShieldCheck,
  ClipboardList,
  Gauge,
} from 'lucide-react'

export type ModuleKey =
  | 'dashboard'
  | 'sites'
  | 'boq'
  | 'boq-progress'
  | 'boq-item-compliance'
  | 'boq-item-overview'
  | 'ra-billing'
  | 'workstations'
  | 'material-grn'
  | 'inventory'
  | 'document-compliance'
  | 'expenses'
  | 'expense-dashboard'
  | 'supplier-invoices'
  | 'checklists'
  | 'reports'
  | 'master-data'
  | 'admin-users'
  | 'admin-codes'
  | 'admin-tenants'

export interface ModuleDef {
  key: ModuleKey
  name: string
  description: string
  href: string
  icon: React.ComponentType<{ className?: string }>
  /** 'admin' = admin or superuser only. 'superuser' = Cogneta only. undefined = any role. */
  requires?: 'admin' | 'superuser'
  /** Color tint for the landing card icon background */
  tint: string
}

export const MODULES: ModuleDef[] = [
  // Management
  { key: 'dashboard', name: 'Dashboard', description: 'Expenses, compliance & BOQ overview', href: '/dashboard', icon: LayoutDashboard, tint: 'bg-blue-50 text-blue-600' },
  { key: 'sites', name: 'Sites', description: 'Manage project sites', href: '/sites', icon: Building2, tint: 'bg-emerald-50 text-emerald-600' },
  { key: 'master-data', name: 'Master Data', description: 'Materials, suppliers, manpower, equipment', href: '/master-data/materials', icon: Database, tint: 'bg-violet-50 text-violet-600' },
  { key: 'admin-users', name: 'Manage Users', description: 'Create users & assign module access', href: '/admin/users', icon: Users, tint: 'bg-amber-50 text-amber-600', requires: 'admin' },
  { key: 'admin-codes', name: 'Activation Codes', description: 'Issue per-site licenses', href: '/admin/codes', icon: KeyRound, tint: 'bg-rose-50 text-rose-600', requires: 'superuser' },
  { key: 'admin-tenants', name: 'Tenants', description: 'Manage customer companies', href: '/admin/tenants', icon: Briefcase, tint: 'bg-slate-100 text-slate-700', requires: 'superuser' },

  // Project Execution
  { key: 'boq', name: 'BOQ Management', description: 'Bill of Quantities & progress', href: '/boq', icon: FileSpreadsheet, tint: 'bg-blue-50 text-blue-600' },
  { key: 'boq-progress', name: 'BOQ Progress', description: 'Consolidated progress view', href: '/boq-progress', icon: TrendingUp, tint: 'bg-cyan-50 text-cyan-600' },
  { key: 'boq-item-compliance', name: 'BOQ Item Compliance', description: 'Per-line-item materials, TDS, test certs & RA billing', href: '/boq-item-compliance', icon: ClipboardList, tint: 'bg-cyan-50 text-cyan-600' },
  { key: 'boq-item-overview', name: 'BOQ Item Overview', description: 'Read-only per-line-item compliance & billing status', href: '/boq-item-overview', icon: Gauge, tint: 'bg-teal-50 text-teal-600' },
  { key: 'workstations', name: 'Workstations', description: 'Track work at physical locations', href: '/workstations', icon: Wrench, tint: 'bg-orange-50 text-orange-600' },
  { key: 'checklists', name: 'Checklists', description: 'Template library & PDF sign-offs', href: '/checklists', icon: ClipboardCheck, tint: 'bg-purple-50 text-purple-600' },

  // Materials & Inventory
  { key: 'material-grn', name: 'Material GRN', description: 'Goods receipt notes & compliance docs', href: '/material-grn', icon: Receipt, tint: 'bg-amber-50 text-amber-600' },
  { key: 'inventory', name: 'Inventory', description: 'Aggregated material stock', href: '/inventory', icon: Warehouse, tint: 'bg-yellow-50 text-yellow-700' },
  { key: 'document-compliance', name: 'Documents Compliance', description: 'Test certificates & TDS per material', href: '/document-compliance', icon: ShieldCheck, tint: 'bg-emerald-50 text-emerald-600' },

  // Finance & Billing
  { key: 'ra-billing', name: 'RA Billing', description: 'BOQ rates, amounts, GST, actuals', href: '/ra-billing', icon: IndianRupee, tint: 'bg-green-50 text-green-600' },
  { key: 'expenses', name: 'Expenses Recording', description: 'Material, manpower, equipment, other', href: '/expenses', icon: Wallet, tint: 'bg-teal-50 text-teal-600' },
  { key: 'expense-dashboard', name: 'Expense Dashboard', description: 'Analytics by category & date range', href: '/expense-dashboard', icon: PieChart, tint: 'bg-pink-50 text-pink-600' },
  { key: 'supplier-invoices', name: 'Supplier Invoices', description: 'Payment tracking', href: '/supplier-invoices', icon: CreditCard, tint: 'bg-indigo-50 text-indigo-600' },

  // Reports
  { key: 'reports', name: 'Reports', description: 'MIR reports & exports', href: '/reports', icon: BarChart3, tint: 'bg-slate-100 text-slate-700' },
]

export interface ModuleGroup {
  name: string
  pillColor: string
  moduleKeys: ModuleKey[]
}

export const MODULE_GROUPS: ModuleGroup[] = [
  {
    name: 'Management',
    pillColor: 'bg-blue-50 text-blue-700 border-blue-200',
    moduleKeys: ['dashboard', 'sites', 'master-data', 'admin-users', 'admin-codes', 'admin-tenants'],
  },
  {
    name: 'Project Execution',
    pillColor: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    moduleKeys: ['boq', 'boq-progress', 'boq-item-compliance', 'boq-item-overview', 'workstations', 'checklists'],
  },
  {
    name: 'Materials & Inventory',
    pillColor: 'bg-amber-50 text-amber-700 border-amber-200',
    moduleKeys: ['material-grn', 'inventory', 'document-compliance'],
  },
  {
    name: 'Finance & Billing',
    pillColor: 'bg-green-50 text-green-700 border-green-200',
    moduleKeys: ['ra-billing', 'expenses', 'expense-dashboard', 'supplier-invoices'],
  },
  {
    name: 'Reports',
    pillColor: 'bg-slate-100 text-slate-700 border-slate-200',
    moduleKeys: ['reports'],
  },
]

export const ALL_MODULE_KEYS: ModuleKey[] = MODULES.map((m) => m.key)

export function getModule(key: ModuleKey): ModuleDef | undefined {
  return MODULES.find((m) => m.key === key)
}

/** Map a pathname (e.g. /material-grn/abc) to a moduleKey for AuthGate. */
export function moduleKeyForPath(pathname: string): ModuleKey | null {
  if (pathname === '/' || pathname === '/login') return null
  if (pathname.startsWith('/dashboard')) return 'dashboard'
  if (pathname.startsWith('/sites')) return 'sites'
  if (pathname.startsWith('/boq-progress')) return 'boq-progress'
  if (pathname.startsWith('/boq-item-compliance')) return 'boq-item-compliance'
  if (pathname.startsWith('/boq-item-overview')) return 'boq-item-overview'
  if (pathname.startsWith('/boq')) return 'boq'
  if (pathname.startsWith('/ra-billing')) return 'ra-billing'
  if (pathname.startsWith('/workstations')) return 'workstations'
  if (pathname.startsWith('/material-grn')) return 'material-grn'
  if (pathname.startsWith('/inventory')) return 'inventory'
  if (pathname.startsWith('/document-compliance')) return 'document-compliance'
  if (pathname.startsWith('/expense-dashboard')) return 'expense-dashboard'
  if (pathname.startsWith('/expenses')) return 'expenses'
  if (pathname.startsWith('/supplier-invoices')) return 'supplier-invoices'
  if (pathname.startsWith('/checklists')) return 'checklists'
  if (pathname.startsWith('/reports')) return 'reports'
  if (pathname.startsWith('/master-data')) return 'master-data'
  if (pathname.startsWith('/admin/users')) return 'admin-users'
  if (pathname.startsWith('/admin/codes')) return 'admin-codes'
  if (pathname.startsWith('/admin/tenants')) return 'admin-tenants'
  return null
}
