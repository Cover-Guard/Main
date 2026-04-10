'use client'

import type { ReactNode } from 'react'
import Link from 'next/link'
import {
  Shield,
  Users,
  BarChart3,
  Search as SearchIcon,
  ArrowUpRight,
  TrendingUp,
  TrendingDown,
} from 'lucide-react'
import { cn } from '@/lib/utils'

export interface AgentDashboardHeroProps {
  /** Current signed-in agent's display name. Optional — falls back to a generic greeting. */
  agentName?: string
  /** Count of saved properties for the "Saved properties" KPI. */
  savedPropertyCount: number
  /** Count of managed clients for the "Clients" KPI. */
  clientCount: number
  /** Show skeleton placeholders instead of live numbers while loading. */
  loading?: boolean
  /** Whether the dashboard is rendering mock / demo data. */
  demoMode?: boolean
  /** Optional delta indicator for the Saved Properties KPI (e.g. "+2 this week"). */
  savedDelta?: { value: string; direction: 'up' | 'down' | 'flat' }
  /** Optional delta indicator for the Clients KPI. */
  clientDelta?: { value: string; direction: 'up' | 'down' | 'flat' }
  /** Slot for the existing SearchBar. Keeps this hero agnostic of typeahead wiring. */
  searchSlot: ReactNode
}

/**
 * Hero block for the agent dashboard.
 *
 * Replaces the cramped text-2xl header + single-row StatCard grid with a
 * three-zone layout:
 *
 *   1. Greeting + demo badge + "Go to analytics" shortcut
 *   2. Full-width search (caller-supplied via searchSlot)
 *   3. 4-card KPI rail (Saved / Clients / Analytics / Search) using the
 *      new display + stat-value + stat-label tokens
 */
export function AgentDashboardHero({
  agentName,
  savedPropertyCount,
  clientCount,
  loading = false,
  demoMode = false,
  savedDelta,
  clientDelta,
  searchSlot,
}: AgentDashboardHeroProps) {
  const greeting = agentName ? `Welcome back, ${agentName}` : 'Agent Dashboard'

  return (
    <section className="mb-5">
      {/* Zone 1 — greeting + badges */}
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-display text-foreground">{greeting}</h1>
          <p className="mt-1 text-body text-muted-foreground">
            Property insurability intelligence for real estate professionals
          </p>
        </div>

        <div className="flex items-center gap-2">
          {demoMode ? (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-caption font-semibold text-amber-700">
              <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
              Demo data
            </span>
          ) : null}
          <Link
            href="/analytics"
            className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-3 py-1.5 text-caption font-semibold text-foreground shadow-sm transition-colors hover:bg-muted"
          >
            <BarChart3 className="h-3.5 w-3.5" />
            Analytics
            <ArrowUpRight className="h-3 w-3 text-muted-foreground" />
          </Link>
        </div>
      </div>

      {/* Zone 2 — search (caller-supplied so this stays decoupled from typeahead) */}
      <div className="mb-5">{searchSlot}</div>

      {/* Zone 3 — KPI rail */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <HeroKpiCard
          label="Saved properties"
          value={loading ? '—' : savedPropertyCount.toString()}
          delta={savedDelta}
          icon={<Shield className="h-4 w-4 text-brand-600" />}
        />
        <HeroKpiCard
          label="Clients"
          value={loading ? '—' : clientCount.toString()}
          delta={clientDelta}
          icon={<Users className="h-4 w-4 text-purple-500" />}
        />
        <HeroKpiCard
          label="Reports this month"
          value={loading ? '—' : demoMode ? '42' : '—'}
          helper="Last 30 days"
          icon={<BarChart3 className="h-4 w-4 text-emerald-600" />}
          href="/analytics"
        />
        <HeroKpiCard
          label="New property search"
          value="Start"
          helper="Type an address to begin"
          icon={<SearchIcon className="h-4 w-4 text-teal-600" />}
          href="/search"
          interactive
        />
      </div>
    </section>
  )
}

export default AgentDashboardHero

// ─── KPI card ────────────────────────────────────────────────────────────────

interface HeroKpiCardProps {
  label: string
  value: string
  helper?: string
  delta?: { value: string; direction: 'up' | 'down' | 'flat' }
  icon: ReactNode
  href?: string
  interactive?: boolean
}

function HeroKpiCard({
  label,
  value,
  helper,
  delta,
  icon,
  href,
  interactive,
}: HeroKpiCardProps) {
  const inner = (
    <div
      className={cn(
        'flex h-full flex-col justify-between gap-3 rounded-xl border border-border bg-background p-4 shadow-panel transition-shadow',
        (href || interactive) && 'hover:shadow-panel-hover',
      )}
    >
      <div className="flex items-center justify-between">
        <span className="text-stat-label uppercase tracking-wide text-muted-foreground">
          {label}
        </span>
        <span className="flex h-7 w-7 items-center justify-center rounded-md bg-muted">
          {icon}
        </span>
      </div>
      <div className="flex items-end gap-2">
        <span className="text-stat-value text-foreground">{value}</span>
        {delta ? (
          <span
            className={cn(
              'mb-1 inline-flex items-center gap-0.5 text-caption font-semibold',
              delta.direction === 'up' && 'text-emerald-600',
              delta.direction === 'down' && 'text-red-600',
              delta.direction === 'flat' && 'text-muted-foreground',
            )}
          >
            {delta.direction === 'up' ? (
              <TrendingUp className="h-3 w-3" />
            ) : delta.direction === 'down' ? (
              <TrendingDown className="h-3 w-3" />
            ) : null}
            {delta.value}
          </span>
        ) : null}
      </div>
      {helper ? (
        <p className="text-caption text-muted-foreground">{helper}</p>
      ) : null}
    </div>
  )

  if (href) {
    return (
      <Link
        href={href}
        className="block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:rounded-xl"
      >
        {inner}
      </Link>
    )
  }
  return inner
}
