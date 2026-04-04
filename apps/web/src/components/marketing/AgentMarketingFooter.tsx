import Link from 'next/link'
import { CoverGuardShield } from '@/components/icons/CoverGuardShield'
import { footerPageGroups } from './footerPageGroups'

/** Map a footer path like /product/risk-intelligence to an inline #anchor slug. */
export function pathToAnchor(href: string): string {
  const segments = href.split('/').filter(Boolean)
  return '#' + (segments[segments.length - 1] ?? '')
}

/**
 * Footer variant for the B2B marketing page: every link scrolls to an inline
 * section on the same page instead of routing to a separate landing page.
 */
export function AgentMarketingFooter() {
  return (
    <footer className="bg-gray-900 text-gray-400">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-16">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-8">
          <div className="col-span-2 md:col-span-1">
            <Link href="/agents" className="flex items-center gap-2">
              <CoverGuardShield className="h-8 w-8" />
              <span className="text-lg font-bold text-white">CoverGuard</span>
            </Link>
            <p className="mt-4 text-sm leading-relaxed">
              Property insurability intelligence built for real estate agents.
            </p>
          </div>

          {Object.entries(footerPageGroups).map(([category, links]) => (
            <div key={category}>
              <h4 className="text-sm font-semibold text-white">{category}</h4>
              <ul className="mt-4 space-y-3">
                {links.map((link) => (
                  <li key={link.label}>
                    <a
                      href={pathToAnchor(link.href)}
                      className="text-sm hover:text-white transition-colors"
                    >
                      {link.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-16 pt-8 border-t border-gray-800 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-sm">
            &copy; {new Date().getFullYear()} CoverGuard, Inc. All rights reserved.
          </p>
          <div className="flex items-center gap-6">
            <a href="#privacy" className="text-sm hover:text-white transition-colors">
              Privacy
            </a>
            <a href="#terms" className="text-sm hover:text-white transition-colors">
              Terms
            </a>
          </div>
        </div>
      </div>
    </footer>
  )
}
