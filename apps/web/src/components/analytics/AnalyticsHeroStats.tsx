'use client'

import { useEffect, useState, type ReactNode } from 'react'
import {
  Search as SearchIcon,
  Shield,
  Users,
  FileText,
  TrendingUp,
  TrendingDown,
  Sparkles,
} from 'lucide-react'
import type { AnalyticsSummary } from '@coverguard/shared'
import { cn } from '@/lib/utils'
import { isDemoMode, setDemoMode } from '@/lib/mockData'

export interface AnalyticsHeroStatsProps {
  data: AnalyticsSummary | null
  /** Called when the demo-mode toggle is flipped. Parent should refetch analytics. */
  onDemoModeChange?: (next: boolean) => void
  className?: string
}

interface HeroStat {
  label: string
  value: string
  helper?: string
  delta?: { value: string; direction: 'up' | 'down' | 'flat' }
  icon: ReactNode
  sparkline?: number[]
}

/**
 * Top-of-analytics hero strip.
 *
 * Replaces the compressed text-[9px]/text-xl stat blocks buried inside
 * individual panels with four always-visible, large-type KPIs that answer
 * "what's going on right now?" at a glance — plus a demo-mode toggle so
 * empty accounts can instantly see what a populated dashboard looks like.
 */
export function AnalyticsHeroStats({
  data,
  onDemoModeChange,
  className,
}: AnalyticsHeroStatsProps) {
  const stats = computeHeroStats(data)

  return (
    <section
      className={cn(
        'mb-4 rounded-xl border border-border bg-background p-4 shadow-panel',
        className,
      )}
    >
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-heading text-foreground">Analytics overview</h2>
          <p className="text-caption text-muted-foreground">
            Last 30 days · Updated just now
          </p>
        </div>
        <DemoDataToggle onChange={onDemoModeChange} />
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {stats.map((s) => (
          <HeroStatCard key={s.label} stat={s} />
        ))}
      </div>
    </section>
  )
}

export default AnalyticsHeroStats

// ─── Hero stat card ──────────────────────────────────────────────────────────

function HeroStatCard({ stat }: { stat: HeroStat }) {
  return (
    <div className="flex flex-col gap-2 rounded-lg border border-border bg-background p-4">
      <div className="flex items-center justify-between">
        <span className="text-stat-label uppercase tracking-wide text-muted-foreground">
          {stat.label}
        </span>
        <span className="flex h-7 w-7 items-center justify-center rounded-md bg-muted">
          {stat.icon}
        </span>
      </div>
      <div className="flex items-end justify-between gap-2">
        <div className="flex items-end gap-2">
          <span className="text-stat-value text-foreground">{stat.value}</span>
          {stat.delta ? (
            <span
              className={cn(
                'mb-1 inline-flex items-center gap-0.5 text-caption font-semibold',
                stat.delta.direction === 'up' && 'text-emerald-600',
                stat.delta.direction === 'down' && 'text-red-600',
                stat.delta.direction === 'flat' && 'text-muted-foreground',
              )}
            >
              {stat.delta.direction === 'up' ? (
                <TrendingUp className="h-3 w-3" />
              ) : stat.delta.direction === 'down' ? (
                <TrendingDown className="h-3 w-3" />
              ) : null}
              {stat.delta.value}
            </span>
          ) : null}
        </div>
        {stat.sparkline && stat.sparkline.length > 1 ? (
          <Sparkline points={stat.sparkline} />
        ) : null}
      </div>
      {stat.helper ? (
        <p className="text-caption text-muted-foreground">{stat.helper}</p>
      ) : null}
    </div>
  )
}

// ─── Sparkline ───────────────────────────────────────────────────────────────

function Sparkline({ points }: { points: number[] }) {
  if (points.length < 2) return null
  const max = Math.max(...points)
  const min = Math.min(...points)
  const range = max - min || 1
  const width = 56
  const height = 20
  const step = width / (points.length - 1)
  const path = points
    .map((p, i) => {
      const x = i * step
      const y = height - ((p - min) / range) * height
      return `${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`
    })
    .join(' ')
  return (
    <svg width={width} height={height} className="text-brand-500" aria-hidden>
      <path d={path} stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

// ─── Demo data toggle ────────────────────────────────────────────────────────

function DemoDataToggle({ onChange }: { onChange?: (next: boolean) => void }) {
  const [on, setOn] = useState(false)
  // Hydration-safe read of localStorage-backed demo mode. SSR renders with
  // `on=false`, then the effect flips to the real value once mounted. A
  // single cascading render on mount is the intended behavior here.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setOn(isDemoMode())
  }, [])

  const handleClick = () => {
    const next = !on
    setOn(next)
    setDemoMode(next)
    onChange?.(next)
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      className={cn(
        'inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-caption font-semibold transition-colors',
        on
          ? 'border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100'
          : 'border-border bg-background text-foreground hover:bg-muted',
      )}
      aria-pressed={on}
    >
      <Sparkles className="h-3 w-3" />
      {on ? 'Demo data · On' : 'Preview with demo data'}
    </button>
  )
}

// ─── Derivation ──────────────────────────────────────────────────────────────

/**
 * Build hero stats from an AnalyticsSummary. Returns placeholder "—" values
 * with a helpful subtitle if data is null (pre-load, or empty account).
 */
export function computeHeroStats(data: AnalyticsSummary | null): HeroStat[] {
  if (!data) {
    return [
      { label: 'Searches',         value: '—', helper: 'No activity yet', icon: <SearchIcon className="h-4 w-4 text-brand-600" /> },
      { label: 'Saved properties', value: '—', helper: 'No activity yet', icon: <Shield     className="h-4 w-4 text-purple-500" /> },
      { label: 'Active clients',   value: '—', helper: 'No activity yet', icon: <Users      className="h-4 w-4 text-emerald-600" /> },
      { label: 'Reports run',      value: '—', helper: 'No activity yet', icon: <FileText   className="h-4 w-4 text-teal-600" /> },
    ]
  }

  const byDay = data.searchesByDay ?? []
  const sparkPoints = byDay.map((d) => d.count)
  const last7 = byDay.slice(-7).reduce((s, d) => s + d.count, 0)
  const prev7 = byDay.slice(-14, -7).reduce((s, d) => s + d.count, 0)
  const delta =
    prev7 === 0
      ? null
      : {
          value: `${Math.round(((last7 - prev7) / prev7) * 100)}%`,
          direction: (last7 > prev7 ? 'up' : last7 < prev7 ? 'down' : 'flat') as
            | 'up'
            | 'down'
            | 'flat',
        }

  return [
    {
      label: 'Searches',
      value: data.totalSearches.toLocaleString(),
      helper: `${last7} in the last 7 days`,
      delta: delta ?? undefined,
      icon: <SearchIcon className="h-4 w-4 text-brand-600" />,
      sparkline: sparkPoints,
    },
    {
      label: 'Saved properties',
      value: data.totalSavedProperties.toLocaleString(),
      helper: data.avgInsuranceCost
        ? `Avg premium $${data.avgInsuranceCost.toLocaleString()}/yr`
        : undefined,
      icon: <Shield className="h-4 w-4 text-purple-500" />,
    },
    {
      label: 'Active clients',
      value: data.totalClients.toLocaleString(),
      helper: `${data.clientPipeline.active} active · ${data.clientPipeline.prospect} prospects`,
      icon: <Users className="h-4 w-4 text-emerald-600" />,
    },
    {
      label: 'Reports run',
      value: data.totalReports.toLocaleString(),
      helper: `${data.quoteRequests.total} quote requests sent`,
      icon: <FileText className="h-4 w-4 text-teal-600" />,
    },
  ]
}
