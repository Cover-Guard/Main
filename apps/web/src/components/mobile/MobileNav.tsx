'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  Search,
  LayoutDashboard,
  BarChart2,
  User,
  Shield,
} from 'lucide-react'
import { cn } from '@/lib/utils'

const tabs = [
  { href: '/check',     label: 'Check',     icon: Shield,          exact: true },
  { href: '/search',    label: 'Search',    icon: Search,          exact: false },
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, exact: false },
  { href: '/analytics', label: 'Analytics', icon: BarChart2,       exact: false },
  { href: '/account',   label: 'Account',   icon: User,            exact: false },
]

const HIDDEN_ROUTES = ['/login', '/register', '/agents/login', '/agents/register', '/onboarding']

/**
 * Fixed bottom navigation bar shown only on mobile (hidden at md+).
 * Lives outside SidebarLayout so it renders on top of page content.
 * Hidden on auth/onboarding pages — only visible after login.
 */
export function MobileNav() {
  const pathname = usePathname()

  const hidden =
    pathname === '/' || HIDDEN_ROUTES.some((r) => pathname.startsWith(r))

  function isActive(href: string, exact?: boolean) {
    if (exact) return pathname === href
    return pathname.startsWith(href)
  }

  if (hidden) return null

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 flex border-t border-gray-200 bg-white md:hidden"
      style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
      aria-label="Mobile navigation"
    >
      {tabs.map(({ href, label, icon: Icon, exact }) => {
        const active = isActive(href, exact)
        return (
          <Link
            key={href}
            href={href}
            className={cn(
              'flex flex-1 flex-col items-center justify-center gap-0.5 py-2.5 text-[10px] font-medium transition-colors',
              active ? 'text-brand-600' : 'text-gray-500 hover:text-gray-700'
            )}
            aria-current={active ? 'page' : undefined}
          >
            <div
              className={cn(
                'flex h-6 w-6 items-center justify-center rounded-full transition-colors',
                active ? 'bg-brand-50' : ''
              )}
            >
              <Icon className={cn('h-4.5 w-4.5', active ? 'text-brand-600' : 'text-gray-500')} style={{ width: 18, height: 18 }} />
            </div>
            <span>{label}</span>
          </Link>
        )
      })}
    </nav>
  )
}
