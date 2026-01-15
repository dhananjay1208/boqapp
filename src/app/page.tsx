'use client'

import { Header } from '@/components/layout/header'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Building2,
  FileSpreadsheet,
  Package,
  ClipboardCheck,
  TrendingUp,
  AlertCircle,
} from 'lucide-react'
import Link from 'next/link'

// Placeholder stats - will be replaced with real data
const stats = [
  {
    title: 'Active Sites',
    value: '0',
    description: 'Currently in progress',
    icon: Building2,
    href: '/sites',
  },
  {
    title: 'BOQ Items',
    value: '0',
    description: 'Total line items',
    icon: FileSpreadsheet,
    href: '/boq',
  },
  {
    title: 'Materials Tracked',
    value: '0',
    description: 'Across all projects',
    icon: Package,
    href: '/materials',
  },
  {
    title: 'Pending Compliance',
    value: '0',
    description: 'Documents to upload',
    icon: ClipboardCheck,
    href: '/compliance',
  },
]

export default function DashboardPage() {
  return (
    <div className="flex flex-col min-h-screen">
      <Header title="Dashboard" />

      <div className="flex-1 p-4 md:p-6 space-y-6">
        {/* Welcome Message */}
        <div className="bg-gradient-to-r from-blue-600 to-blue-700 rounded-xl p-6 text-white">
          <h2 className="text-2xl font-bold mb-2">Welcome to BOQ Manager</h2>
          <p className="text-blue-100">
            Manage your construction projects from BOQ to Payment - all in one place.
          </p>
        </div>

        {/* Stats Grid */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {stats.map((stat) => (
            <Link key={stat.title} href={stat.href}>
              <Card className="hover:shadow-md transition-shadow cursor-pointer">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-slate-600">
                    {stat.title}
                  </CardTitle>
                  <stat.icon className="h-5 w-5 text-slate-400" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stat.value}</div>
                  <p className="text-xs text-slate-500 mt-1">{stat.description}</p>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>

        {/* Quick Actions & Recent Activity */}
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Quick Actions */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Quick Actions
              </CardTitle>
              <CardDescription>Common tasks to get started</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Link
                href="/sites/new"
                className="flex items-center gap-3 p-3 rounded-lg bg-slate-50 hover:bg-slate-100 transition-colors"
              >
                <div className="h-10 w-10 rounded-lg bg-blue-100 flex items-center justify-center">
                  <Building2 className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <p className="font-medium">Create New Site</p>
                  <p className="text-sm text-slate-500">Start a new project</p>
                </div>
              </Link>
              <Link
                href="/boq/upload"
                className="flex items-center gap-3 p-3 rounded-lg bg-slate-50 hover:bg-slate-100 transition-colors"
              >
                <div className="h-10 w-10 rounded-lg bg-green-100 flex items-center justify-center">
                  <FileSpreadsheet className="h-5 w-5 text-green-600" />
                </div>
                <div>
                  <p className="font-medium">Upload BOQ</p>
                  <p className="text-sm text-slate-500">Import from Excel</p>
                </div>
              </Link>
              <Link
                href="/materials"
                className="flex items-center gap-3 p-3 rounded-lg bg-slate-50 hover:bg-slate-100 transition-colors"
              >
                <div className="h-10 w-10 rounded-lg bg-orange-100 flex items-center justify-center">
                  <Package className="h-5 w-5 text-orange-600" />
                </div>
                <div>
                  <p className="font-medium">Track Materials</p>
                  <p className="text-sm text-slate-500">Log material receipts</p>
                </div>
              </Link>
            </CardContent>
          </Card>

          {/* Getting Started */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertCircle className="h-5 w-5" />
                Getting Started
              </CardTitle>
              <CardDescription>Follow these steps to set up your project</CardDescription>
            </CardHeader>
            <CardContent>
              <ol className="space-y-4">
                <li className="flex items-start gap-3">
                  <Badge variant="outline" className="mt-0.5">1</Badge>
                  <div>
                    <p className="font-medium">Create a Site</p>
                    <p className="text-sm text-slate-500">
                      Add your project site (e.g., TCS-Vizag)
                    </p>
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <Badge variant="outline" className="mt-0.5">2</Badge>
                  <div>
                    <p className="font-medium">Add Packages</p>
                    <p className="text-sm text-slate-500">
                      Create work packages (LA-Civil, LA-Plumbing, etc.)
                    </p>
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <Badge variant="outline" className="mt-0.5">3</Badge>
                  <div>
                    <p className="font-medium">Upload BOQ</p>
                    <p className="text-sm text-slate-500">
                      Import your BOQ from Excel or enter manually
                    </p>
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <Badge variant="outline" className="mt-0.5">4</Badge>
                  <div>
                    <p className="font-medium">Track & Manage</p>
                    <p className="text-sm text-slate-500">
                      Add materials, compliance docs, and track progress
                    </p>
                  </div>
                </li>
              </ol>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
