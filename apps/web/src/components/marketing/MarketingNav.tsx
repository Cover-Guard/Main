'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Menu, X } from 'lucide-react'
import { CoverGuardShield } from '@/components/icons/CoverGuardShield'

const navLinks = [
  { label: 'Product', href: '#product' },
  { label: 'Solutions', href: '#solutions' },
  { label: 'Pricing', href: '/pricing' },
  { label: 'Investors', href: '#investors' },
]

export function MarketingNav() {
  const [mobileOpen, setMobileOpen] = useState(false)

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
            {navLinks.map((link) =>
              link.href.startsWith('#') ? (
                <a
                  key={link.href}
                  href={link.href}
                  className="text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors"
                >
                  {link.label}
                </a>
              ) : (
                <Link
                  key={link.href}
                  href={link.href}
                  className="text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors"
                >
                  {link.label}
                </Link>
              )
            )}
          </nav>

          {/* Desktop auth buttons */}
          <div className="hidden md:flex items-center gap-3">
            <Link
              href="/login"
              className="text-sm font-medium text-gray-700 hover:text-gray-900 transition-colors px-4 py-2"
            >
              Log in
            </Link>
            <Link
              href="/register"
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
        <div className="md:hidden border-t border-gray-100 bg-white">
          <div className="px-4 py-4 space-y-3">
            {navLinks.map((link) =>
              link.href.startsWith('#') ? (
                <a
                  key={link.href}
                  href={link.href}
                  className="block text-sm font-medium text-gray-600 hover:text-gray-900 py-2"
                  onClick={() => setMobileOpen(false)}
                >
                  {link.label}
                </a>
              ) : (
                <Link
                  key={link.href}
                  href={link.href}
                  className="block text-sm font-medium text-gray-600 hover:text-gray-900 py-2"
                  onClick={() => setMobileOpen(false)}
                >
                  {link.label}
                </Link>
              )
            )}
            <div className="pt-3 border-t border-gray-100 space-y-2">
              <Link
                href="/login"
                className="block text-sm font-medium text-gray-700 hover:text-gray-900 py-2"
              >
                Log in
              </Link>
              <Link
                href="/register"
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
