import Link from 'next/link'
import { ChevronDown } from 'lucide-react'
import { footerPageGroups } from './footerPageGroups'

type Props = {
  /** Adds pt-16 to offset the fixed MarketingNav. Set false on pages without MarketingNav. */
  offsetNav?: boolean
}

export function FooterPagesNav({ offsetNav = true }: Props = {}) {
  return (
    <div className={offsetNav ? 'pt-16' : undefined}>
      <div className="w-full border-b border-gray-200 bg-gray-50">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex flex-wrap items-center gap-2 sm:gap-4 py-3">
            <span className="text-xs font-semibold uppercase tracking-wider text-gray-500 mr-2">
              Explore:
            </span>
            {Object.entries(footerPageGroups).map(([group, links]) => (
              <details key={group} className="group relative">
                <summary className="inline-flex cursor-pointer list-none items-center gap-1 rounded-md px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-white hover:text-gray-900 transition-colors [&::-webkit-details-marker]:hidden">
                  {group}
                  <ChevronDown className="h-4 w-4 transition-transform group-open:rotate-180" />
                </summary>
                <div className="absolute left-0 top-full mt-1 z-20 min-w-[220px] rounded-lg border border-gray-200 bg-white shadow-lg py-2">
                  {links.map((link) => (
                    <Link
                      key={link.href}
                      href={link.href}
                      className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 hover:text-brand-600 transition-colors"
                    >
                      {link.label}
                    </Link>
                  ))}
                </div>
              </details>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
