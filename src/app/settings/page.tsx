'use client'

import { Construction } from 'lucide-react'
import { Header } from '@/components/layout/header'
import { Card, CardContent } from '@/components/ui/card'

export default function SettingsPage() {
  return (
    <div className="flex flex-col h-full">
      <Header />
      <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Settings</h1>
          <p className="text-slate-600 mt-1">Manage application settings</p>
        </div>

        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <div className="h-16 w-16 rounded-full bg-amber-100 flex items-center justify-center mb-4">
              <Construction className="h-8 w-8 text-amber-600" />
            </div>
            <h2 className="text-xl font-semibold text-slate-900 mb-2">Under Construction</h2>
            <p className="text-slate-500 text-center max-w-md">
              This page is currently under development. Please check back later for settings and configuration options.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
