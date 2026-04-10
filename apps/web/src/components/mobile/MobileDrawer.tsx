'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  Shield,
  LayoutDashboard,
  Wrench,
  BarChart2,
  Settings,
  HelpCircle,
  X,
  LogOut,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

const navItems = [
  { href: '/check',     label: 'Search',     icon: Shield,          exact: true },
  { href: '/dashboard', label: 'Dashboard',  icon: LayoutDashboard, exact: false },
  { href: '/toolkit',   label: 'Toolkit',    icon: Wrench,          exact: false },
  { href: '/analytics', label: 'Analytics',  icon: BarChart2,       exact: false },
  { href: '/help',      label: 'Help',       icon: HelpCircle,      exact: false },
  { href: '/account',   label: 'Settings',   icon: Settings,        exact: false },
]

interface MobileDrawerProps {
  open: boolean
  onClose: () => void
}

/**
 * Slide-in navigation drawer for mobile.
 * Triggered by the hamburger menu in the mobile top bar.
 */
export function MobileDrawer({ open, onClose }: MobileDrawerProps) {
  const pathname = usePathname()
  const router = useRouter()

  // Close on Escape
  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  // Prevent body scroll while open
  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [open])

  async function signOut() {
    try {
      const supabase = createClient()
      await supabase.auth.signOut()
    } catch {
      // Sign-out failed — still redirect to login
    }
    onClose()
    router.push('/login')
    router.refresh()
  }

  function isActive(href: string, exact?: boolean) {
    if (exact) return pathname === href
    return pathname.startsWith(href)
  }

  return (
    <>
      {/* Backdrop */}
      <div
        aria-hidden
        onClick={onClose}
        className={cn(
          'fixed inset-0 z-40 bg-black/50 transition-opacity duration-300 md:hidden',
          open ? 'opacity-100' : 'pointer-events-none opacity-0'
        )}
      />

      {/* Drawer panel */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Navigation menu"
        className={cn(
          'fixed left-0 top-0 z-50 flex h-full w-72 flex-col bg-[#0d1929] text-white',
          'transition-transform duration-300 ease-out md:hidden',
          open ? 'translate-x-0' : '-translate-x-full'
        )}
        style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}
      >
        {/* Header */}
        <div className="flex h-14 items-center justify-between border-b border-white/10 px-5">
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-teal-400" />
            <span className="text-base font-bold tracking-tight">CoverGuard</span>
          </div>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-white/50 hover:bg-white/10 hover:text-white"
            aria-label="Close menu"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Nav items */}
        <nav className="flex-1 overflow-y-auto px-3 py-4">
          <div className="space-y-0.5">
            {navItems.map(({ href, label, icon: Icon, exact }) => {
              const active = isActive(href, exact)
              const isNewCheck = href === '/check'
              return (
                <Link
                  key={href}
                  href={href}
                  onClick={onClose}
                  className={cn(
                    'flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition-colors',
                    isNewCheck
                      ? active
                        ? 'bg-white text-[#0d1929]'
                        : 'text-white/70 hover:bg-white/10 hover:text-white'
                      : active
                      ? 'bg-white/10 text-white'
                      : 'text-white/60 hover:bg-white/5 hover:text-white'
                  )}
                >
                  <Icon className="h-5 w-5 shrink-0" />
                  {label}
                </Link>
              )
            })}
          </div>
        </nav>

        {/* Footer */}
        <div className="border-t border-white/10 px-3 py-4" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 1rem)' }}>
          <button
            onClick={signOut}
            className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium text-red-400 hover:bg-red-500/10 hover:text-red-300 transition-colors"
          >
            <LogOut className="h-5 w-5 shrink-0" />
            Sign out
          </button>
        </div>
      </div>
    </>
  )
}
