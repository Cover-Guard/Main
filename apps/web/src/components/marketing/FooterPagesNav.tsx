'use client'

import { useState, useRef, useEffect } from 'react'
import Link from 'next/link'
import { ChevronDown } from 'lucide-react'

export const footerPageGroups = {
  Product: [
    { label: 'Risk Intelligence', href: '/product/risk-intelligence' },
    { label: 'Carrier Availability', href: '/product/carrier-availability' },
    { label: 'Quote Requests', href: '/product/quote-requests' },
    { label: 'Agent Dashboard', href: '/product/agent-dashboard' },
  ],
  Company: [
    { label: 'Pricing', href: '/pricing' },
    { label: 'Investors', href: '/investors' },
    { label: 'Careers', href: '/careers' },
  ],
  Resources: [
    { label: 'Documentation', href: '/docs' },
    { label: 'API Reference', href: '/api-reference' },
    { label: 'Blog', href: '/blog' },
    { label: 'Contact', href: '/contact' },
  ],
  Legal: [
    { label: 'Privacy Policy', href: '/privacy' },
    { label: 'Terms of Service', href: '/terms' },
    { label: 'Security', href: '/security' },
  ],
} as const

export function FooterPagesNav() {
  const [openGroup, setOpenGroup] = useState<string | null>(null)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpenGroup(null)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  return (
    <div className="w-full border-b border-gray-200 bg-gray-50">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div ref={ref} className="flex flex-wrap items-center gap-2 sm:gap-4 py-3">
          <span className="text-xs font-semibold uppercase tracking-wider text-gray-500 mr-2">
            Explore:
          </span>
          {Object.entries(footerPageGroups).map(([group, links]) => (
            <div key={group} className="relative">
              <button
                onClick={() => setOpenGroup(openGroup === group ? null : group)}
                className="inline-flex items-center gap-1 rounded-md px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-white hover:text-gray-900 transition-colors"
                aria-expanded={openGroup === group}
                aria-haspopup="true"
              >
                {group}
                <ChevronDown
                  className={`h-4 w-4 transition-transform ${openGroup === group ? 'rotate-180' : ''}`}
                />
              </button>
              {openGroup === group && (
                <div className="absolute left-0 top-full mt-1 z-20 min-w-[220px] rounded-lg border border-gray-200 bg-white shadow-lg py-2">
                  {links.map((link) => (
                    <Link
                      key={link.href}
                      href={link.href}
                      className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 hover:text-brand-600 transition-colors"
                      onClick={() => setOpenGroup(null)}
                    >
                      {link.label}
                    </Link>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
