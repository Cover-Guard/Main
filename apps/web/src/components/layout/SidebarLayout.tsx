'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  Search,
  LayoutDashboard,
  Users,

  Wrench,
  BarChart2,
  Settings,
  ChevronLeft,
  ChevronRight,
  Download,
  X,
  Menu,
  LogOut,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { CoverGuardShield } from '@/components/icons/CoverGuardShield'
import { AIAdvisor } from './AIAdvisor'
import { MobileDrawer } from '@/components/mobile/MobileDrawer'
import { getMe } from '@/lib/api'
import { createClient } from '@/lib/supabase/client'
import type { User } from '@coverguard/shared'

const navItems = [
  { href: '/check',     label: 'Search a Property',  icon: Search,          exact: true },
  { href: '/dashboard', label: 'Dashboard',  icon: LayoutDashboard, exact: false },
  { href: '/clients',   label: 'Clients',    icon: Users,           exact: false },
  { href: '/toolkit',   label: 'Toolkit',    icon: Wrench,          exact: false },
  { href: '/analytics', label: 'Analytics',  icon: BarChart2,       exact: false },
  { href: '/account',   label: 'Settings',   icon: Settings,        exact: false },
]

export function SidebarLayout({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false)
  const [bannerVisible, setBannerVisible] = useState(() => {
    if (typeof window === 'undefined') return true
    return localStorage.getItem('cg_banner_dismissed') !== '1'
  })
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [user, setUser] = useState<User | null>(null)
  const pathname = usePathname()

  useEffect(() => {
    getMe()
      .then(setUser)
      .catch(() => {
        // User not authenticated or session expired — sidebar renders without user info.
        setUser(null)
      })
  }, [])

  async function handleSignOut() {
    try {
      const supabase = createClient()
      await supabase.auth.signOut()
    } catch {
      // Sign-out may fail if session is already expired — continue with redirect
    }
    window.location.href = '/login'
  }

  const initials = user?.firstName && user?.lastName
    ? `${user.firstName[0] ?? '?'}${user.lastName[0] ?? '?'}`
    : user?.email?.[0]?.toUpperCase() ?? '?'

  const displayName = user?.firstName
    ? `${user.firstName}${user.lastName ? ` ${user.lastName[0] ?? ''}.` : ''}`
    : user?.email?.split('@')[0] ?? ''

  function isActive(href: string, exact?: boolean) {
    if (exact) return pathname === href
    return pathname === href || pathname.startsWith(href + '/')
  }

  return (
    <>
      {/* ── Mobile Drawer (md and below) ─────────────────────────────── */}
      <MobileDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} />

      <div className="flex h-screen overflow-hidden">

        {/* ── Desktop Sidebar (hidden on mobile) ───────────────────────── */}
        <aside
          className={cn(
            'hidden md:flex flex-col flex-shrink-0 bg-[#0d1929] text-white transition-all duration-200 z-10',
            collapsed ? 'w-[60px]' : 'w-[160px]'
          )}
        >
          {/* Logo row */}
          <div className="flex h-12 items-center justify-between px-3 border-b border-white/10">
            {!collapsed && (
              <div className="flex items-center gap-2 min-w-0">
                <CoverGuardShield className="h-5 w-5 shrink-0" />
                <span className="font-bold text-sm truncate">CoverGuard</span>
              </div>
            )}
            {collapsed && <CoverGuardShield className="h-5 w-5 mx-auto" />}
            <button
              onClick={() => setCollapsed(!collapsed)}
              aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              aria-expanded={!collapsed}
              className={cn(
                'text-white/70 hover:text-white p-1 rounded transition-colors shrink-0',
                collapsed && 'mx-auto'
              )}
            >
              {collapsed ? (
                <ChevronRight className="h-4 w-4" />
              ) : (
                <ChevronLeft className="h-4 w-4" />
              )}
            </button>
          </div>

          {/* Nav items */}
          <nav className="flex-1 py-2 px-2 space-y-0.5">
            {navItems.map(({ href, label, icon: Icon, exact }) => {
              const active = isActive(href, exact)
              const isNewCheck = label === 'Search a Property'
              return (
                <Link
                  key={href}
                  href={href}
                  title={label}
                  className={cn(
                    'flex items-center gap-2.5 rounded-md px-2 py-2 text-sm font-medium transition-colors',
                    collapsed ? 'justify-center' : '',
                    isNewCheck
                      ? active
                        ? 'bg-white text-[#0d1929]'
                        : 'text-white/85 hover:bg-white/10 hover:text-white'
                      : active
                      ? 'bg-white/10 text-white'
                      : 'text-white/80 hover:bg-white/5 hover:text-white'
                  )}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  {!collapsed && <span className="truncate">{label}</span>}
                </Link>
              )
            })}
          </nav>

          {/* User profile footer */}
          {user && (
            <div className="border-t border-white/10 px-2 py-2">
              {collapsed ? (
                <button
                  onClick={handleSignOut}
                  title="Sign out"
                  className="w-full flex justify-center p-2 rounded-md text-white/50 hover:text-white hover:bg-white/5 transition-colors"
                >
                  <LogOut className="h-4 w-4" />
                </button>
              ) : (
                <div className="flex items-center gap-2 px-1 py-1">
                  <div className="h-7 w-7 shrink-0 rounded-full bg-teal-500 flex items-center justify-center text-[10px] font-bold text-white">
                    {initials}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] font-semibold text-white truncate">{displayName}</p>
                    <p className="text-[9px] text-white/65 capitalize truncate">{user.role?.toLowerCase()}</p>
                  </div>
                  <button
                    onClick={handleSignOut}
                    title="Sign out"
                    className="text-white/65 hover:text-white transition-colors shrink-0"
                  >
                    <LogOut className="h-3.5 w-3.5" />
                  </button>
                </div>
              )}
            </div>
          )}
        </aside>

        {/* ── Main content ─────────────────────────────────────────────── */}
        <div className="flex flex-col flex-1 overflow-hidden min-w-0">

          {/* Mobile top bar (md and below) */}
          <div className="flex h-12 items-center justify-between border-b border-gray-200 bg-white px-4 md:hidden">
            <button
              onClick={() => setDrawerOpen(true)}
              className="flex h-9 w-9 items-center justify-center rounded-lg text-gray-600 hover:bg-gray-100"
              aria-label="Open navigation menu"
            >
              <Menu className="h-5 w-5" />
            </button>
            <Link href="/" className="flex items-center gap-2">
              <CoverGuardShield className="h-5 w-5" />
              <span className="text-base font-bold tracking-tight text-gray-900">CoverGuard</span>
            </Link>
            {/* Spacer to keep logo centred */}
            <div className="w-9" />
          </div>

          {/* App download banner (desktop only) */}
          {bannerVisible && (
            <div className="hidden md:flex items-center justify-between bg-[#0d1929] px-4 h-10 shrink-0">
              <div className="flex items-center gap-2 text-white">
                <CoverGuardShield className="h-4 w-4 shrink-0" />
                <span className="text-sm font-semibold">CoverGuard is on Android!</span>
                <span className="text-white/80 text-xs hidden sm:inline">
                  Take insurance checks on the go.
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button className="flex items-center gap-1 bg-teal-500 hover:bg-teal-400 text-white text-xs font-semibold px-3 py-1.5 rounded-md transition-colors">
                  <Download className="h-3 w-3" />
                  Download
                </button>
                <button
                  onClick={() => { setBannerVisible(false); localStorage.setItem('cg_banner_dismissed', '1') }}
                  aria-label="Dismiss app download banner"
                  className="text-white/70 hover:text-white p-1 transition-colors rounded"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          )}

          <main id="main-content" className="flex-1 overflow-hidden bg-[#f2f4f7]">
            <div className="h-full overflow-auto">
              {children}
            </div>
          </main>
        </div>

        {/* AI Advisor (desktop only) */}
        <div className="hidden md:block">
          <AIAdvisor />
        </div>
      </div>
    </>
  )
}
