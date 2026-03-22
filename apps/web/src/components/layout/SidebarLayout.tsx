'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  Shield,
  Search,
  LayoutDashboard,
  Users,
  GitCompare,
  Wrench,
  BarChart2,
  Settings,
  ChevronLeft,
  ChevronRight,
  Download,
  X,
  FileText,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { AIAdvisor } from './AIAdvisor'

const navItems = [
  { href: '/',          label: 'New Check',  icon: Search,          exact: true },
  { href: '/dashboard', label: 'Dashboard',  icon: LayoutDashboard, exact: false },
  { href: '/clients',   label: 'Clients',    icon: Users,           exact: false },
  { href: '/reports',   label: 'Reports',    icon: FileText,        exact: false },
  { href: '/compare',   label: 'Compare',    icon: GitCompare,      exact: false },
  { href: '/toolkit',   label: 'Toolkit',    icon: Wrench,          exact: false },
  { href: '/analytics', label: 'Analytics',  icon: BarChart2,       exact: false },
  { href: '/account',   label: 'Settings',   icon: Settings,        exact: false },
]

export function SidebarLayout({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false)
  const [bannerVisible, setBannerVisible] = useState(true)
  const pathname = usePathname()

  function isActive(href: string, exact?: boolean) {
    if (exact) return pathname === href || pathname === '/search'
    return pathname.startsWith(href)
  }

  return (
    <div className="flex h-screen overflow-hidden">
      {/* ── Sidebar ── */}
      <aside
        className={cn(
          'flex flex-col flex-shrink-0 bg-[#0d1929] text-white transition-all duration-200 z-10',
          collapsed ? 'w-[60px]' : 'w-[160px]'
        )}
      >
        {/* Logo row */}
        <div className="flex h-12 items-center justify-between px-3 border-b border-white/10">
          {!collapsed && (
            <div className="flex items-center gap-2 min-w-0">
              <Shield className="h-5 w-5 text-teal-400 shrink-0" />
              <span className="font-bold text-sm truncate">CoverGuard</span>
            </div>
          )}
          {collapsed && <Shield className="h-5 w-5 text-teal-400 mx-auto" />}
          <button
            onClick={() => setCollapsed(!collapsed)}
            className={cn(
              'text-white/40 hover:text-white p-1 rounded transition-colors shrink-0',
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
            const isNewCheck = label === 'New Check'
            return (
              <Link
                key={href}
                href={href}
                title={collapsed ? label : undefined}
                className={cn(
                  'flex items-center gap-2.5 rounded-md px-2 py-2 text-sm font-medium transition-colors',
                  collapsed ? 'justify-center' : '',
                  isNewCheck
                    ? active
                      ? 'bg-white text-[#0d1929]'
                      : 'text-white/70 hover:bg-white/10 hover:text-white'
                    : active
                    ? 'bg-white/10 text-white'
                    : 'text-white/60 hover:bg-white/5 hover:text-white'
                )}
              >
                <Icon className="h-4 w-4 shrink-0" />
                {!collapsed && <span className="truncate">{label}</span>}
              </Link>
            )
          })}
        </nav>
      </aside>

      {/* ── Main content ── */}
      <div className="flex flex-col flex-1 overflow-hidden min-w-0">
        {/* Top banner */}
        {bannerVisible && (
          <div className="flex items-center justify-between bg-[#0d1929] px-4 h-10 shrink-0">
            <div className="flex items-center gap-2 text-white">
              <Shield className="h-4 w-4 text-teal-400 shrink-0" />
              <span className="text-sm font-semibold">CoverGuard is on Android!</span>
              <span className="text-white/50 text-xs hidden sm:inline">
                Take insurance checks on the go.
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button className="flex items-center gap-1 bg-teal-500 hover:bg-teal-400 text-white text-xs font-semibold px-3 py-1.5 rounded-md transition-colors">
                <Download className="h-3 w-3" />
                Download
              </button>
              <button
                onClick={() => setBannerVisible(false)}
                className="text-white/40 hover:text-white p-1 transition-colors"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        )}

        {/* Page content */}
        <main className="flex-1 overflow-auto bg-[#f2f4f7]">
          {children}
        </main>
      </div>

      {/* AI Advisor */}
      <AIAdvisor />
    </div>
  )
}
