'use client'

import { Menu } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { MobileNav } from './mobile-nav'
import { useState } from 'react'

interface HeaderProps {
  title?: string
}

export function Header({ title }: HeaderProps) {
  const [mobileNavOpen, setMobileNavOpen] = useState(false)

  return (
    <header className="sticky top-0 z-40 flex h-16 items-center gap-4 border-b bg-white px-4 md:px-6">
      {/* Mobile menu button */}
      <Button
        variant="ghost"
        size="icon"
        className="md:hidden"
        onClick={() => setMobileNavOpen(true)}
      >
        <Menu className="h-6 w-6" />
        <span className="sr-only">Open menu</span>
      </Button>

      {/* Title */}
      {title && (
        <h1 className="text-lg font-semibold md:text-xl">{title}</h1>
      )}

      {/* Right side - can add notifications, user menu later */}
      <div className="ml-auto flex items-center gap-2">
        {/* Placeholder for future features */}
      </div>

      {/* Mobile Navigation */}
      <MobileNav open={mobileNavOpen} onOpenChange={setMobileNavOpen} />
    </header>
  )
}
