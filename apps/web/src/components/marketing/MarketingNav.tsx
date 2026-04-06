'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Menu, X, ChevronDown } from 'lucide-react'
import { CoverGuardShield } from '@/components/icons/CoverGuardShield'
import { footerPageGroups } from './footerPageGroups'

const navDropdowns = {
  Product: footerPageGroups.Product,
  Company: footerPageGroups.Company,
  Resources: footerPageGroups.Resources,
}

export function MarketingNav() {
  const [mobileOpen, setMobileOpen] = useState(false)
  const [openDropdown, setOpenDropdown] = useState<string | null>(null)

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-lg border-b border-gray-100">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2.5">
            <CoverGuardShield className="h-9 w-9" />
            <span className="text-xl font-bold text-gray-900">CoverGuard</span>
          </Link>

          {/* Desktop nav links */}
          <nav className="hidden md:flex items-center gap-8">
            {Object.entries(navDropdowns).map(([group, links]) => (
              <div
                key={group}
                className="relative"
                onMouseEnter={() => setOpenDropdown(group)}
                onMouseLeave={() => setOpenDropdown(null)}
              >
                <button
                  className="inline-flex items-center gap-1 text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors"
                  onClick={() => setOpenDropdown(openDropdown === group ? null : group)}
                >
                  {group}
                  <ChevronDown className={`h-4 w-4 transition-transform ${openDropdown === group ? 'rotate-180' : ''}`} />
                </button>
                {openDropdown === group && (
                  <div className="absolute left-0 top-full pt-2 z-50">
                    <div className="min-w-[220px] rounded-lg border border-gray-200 bg-white shadow-lg py-2">
                      {links.map((link) => (
                        <Link
                          key={link.href}
                          href={link.href}
                          className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 hover:text-brand-600 transition-colors"
                          onClick={() => setOpenDropdown(null)}
                        >
                          {link.label}
                        </Link>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </nav>

          {/* Desktop auth buttons */}
          <div className="hidden md:flex items-center gap-3">
            <Link
              href="/get-started"
              className="text-sm font-medium text-gray-700 hover:text-gray-900 transition-colors px-4 py-2"
            >
              Log in
            </Link>
            <Link
              href="/get-started"
              className="inline-flex items-center justify-center rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 transition-colors"
            >
              Get Started
            </Link>
          </div>

          {/* Mobile menu button */}
          <button
            className="md:hidden p-2 text-gray-600 hover:text-gray-900"
            onClick={() => setMobileOpen(!mobileOpen)}
            aria-label="Toggle menu"
          >
            {mobileOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="md:hidden border-t border-gray-100 bg-white max-h-[80vh] overflow-y-auto">
          <div className="px-4 py-4 space-y-4">
            {Object.entries(navDropdowns).map(([group, links]) => (
              <details key={group} className="group">
                <summary className="flex cursor-pointer list-none items-center justify-between text-sm font-medium text-gray-700 py-2 [&::-webkit-details-marker]:hidden">
                  {group}
                  <ChevronDown className="h-4 w-4 transition-transform group-open:rotate-180" />
                </summary>
                <div className="mt-1 ml-3 space-y-1">
                  {links.map((link) => (
                    <Link
                      key={link.href}
                      href={link.href}
                      className="block text-sm text-gray-600 hover:text-gray-900 py-1.5"
                      onClick={() => setMobileOpen(false)}
                    >
                      {link.label}
                    </Link>
                  ))}
                </div>
              </details>
            ))}
            <div className="pt-3 border-t border-gray-100 space-y-2">
              <Link
                href="/get-started"
                className="block text-sm font-medium text-gray-700 hover:text-gray-900 py-2"
              >
                Log in
              </Link>
              <Link
                href="/get-started"
                className="block w-full text-center rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-700"
              >
                Get Started
              </Link>
            </div>
          </div>
        </div>
      )}
    </header>
  )
}
