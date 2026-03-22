'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import {
  Search,
  GitCompare,
  Wrench,
  Shield,
  AlertTriangle,
  TrendingUp,
  FileText,
  ArrowRight,
  BookmarkCheck,
} from 'lucide-react'
import { getSavedProperties, getProperty, getPropertyRisk, getAnalytics } from '@/lib/api'
import type { SavedProperty, Property, PropertyRiskProfile, AnalyticsSummary } from '@coverguard/shared'

// ── Donut SVG ──────────────────────────────────────────────────────────────────

function DonutChart({ segments }: { segments: Array<{ value: number; color: string; label: string }> }) {
  const total = segments.reduce((s, x) => s + x.value, 0)
  if (total === 0) {
    return (
      <div className="flex h-36 items-center justify-center text-sm text-gray-400">
        No risk data yet
      </div>
    )
  }

  const R = 54
  const r = 34
  const cx = 64
  const cy = 64

  const fracs = segments.reduce<Array<[number, number]>>((acc, seg) => {
    const start = acc.length > 0 ? acc[acc.length - 1]![1] : 0
    return [...acc, [start, start + seg.value / total]]
  }, [])

  function arc(startFrac: number, endFrac: number) {
    const angle = (endFrac - startFrac) * 2 * Math.PI
    const startAngle = startFrac * 2 * Math.PI - Math.PI / 2
    const endAngle = endFrac * 2 * Math.PI - Math.PI / 2

    const x1 = cx + R * Math.cos(startAngle)
    const y1 = cy + R * Math.sin(startAngle)
    const x2 = cx + R * Math.cos(endAngle)
    const y2 = cy + R * Math.sin(endAngle)
    const ix1 = cx + r * Math.cos(startAngle)
    const iy1 = cy + r * Math.sin(startAngle)
    const ix2 = cx + r * Math.cos(endAngle)
    const iy2 = cy + r * Math.sin(endAngle)
    const large = angle > Math.PI ? 1 : 0
    return `M ${x1} ${y1} A ${R} ${R} 0 ${large} 1 ${x2} ${y2} L ${ix2} ${iy2} A ${r} ${r} 0 ${large} 0 ${ix1} ${iy1} Z`
  }

  return (
    <div className="flex items-center gap-4">
      <svg width={128} height={128} viewBox="0 0 128 128">
        {fracs.map(([start, end], i) => (
          <path key={i} d={arc(start, end)} fill={segments[i]!.color} />
        ))}
      </svg>
      <div className="space-y-1.5">
        {segments.map((seg) => (
          <div key={seg.label} className="flex items-center gap-2 text-xs">
            <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: seg.color }} />
            <span className="text-gray-600">{seg.label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Bar chart ──────────────────────────────────────────────────────────────────

function PerilBarChart({ data }: { data: Array<{ label: string; value: number; color: string }> }) {
  const max = Math.max(...data.map((d) => d.value), 1)
  return (
    <div className="flex h-36 items-end gap-3">
      {data.map(({ label, value, color }) => (
        <div key={label} className="flex flex-1 flex-col items-center gap-1">
          <span className="text-[10px] font-semibold text-gray-600">{value}</span>
          <div
            className="w-full rounded-t transition-all"
            style={{ height: `${Math.max((value / max) * 100, 4)}%`, background: color, minHeight: 4 }}
          />
          <span className="text-[10px] text-gray-500">{label}</span>
        </div>
      ))}
    </div>
  )
}

// ── Score badge ────────────────────────────────────────────────────────────────

function ScoreBadge({ score }: { score: number }) {
  const color =
    score <= 25  ? 'text-green-600'  :
    score <= 50  ? 'text-yellow-600' :
    score <= 70  ? 'text-orange-500' : 'text-red-500'
  return <span className={`w-8 text-center text-sm font-bold ${color}`}>{score}</span>
}

// ── Risk badge ─────────────────────────────────────────────────────────────────

const RISK_STYLES: Record<string, string> = {
  LOW:       'bg-green-100 text-green-700',
  MODERATE:  'bg-yellow-100 text-yellow-700',
  HIGH:      'bg-orange-100 text-orange-700',
  VERY_HIGH: 'bg-red-100 text-red-700',
  EXTREME:   'bg-red-200 text-red-900',
}

function RiskBadge({ level }: { level: string }) {
  const label = level === 'VERY_HIGH' ? 'Very High' : level.charAt(0) + level.slice(1).toLowerCase()
  return (
    <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${RISK_STYLES[level] ?? 'bg-gray-100 text-gray-600'}`}>
      {label}
    </span>
  )
}

// ── Enriched property row ──────────────────────────────────────────────────────

interface EnrichedRow {
  savedProp: SavedProperty
  property:  Property | null
  risk:      PropertyRiskProfile | null
}

// ── Main component ─────────────────────────────────────────────────────────────

export function AgentDashboard() {
  const [enriched,  setEnriched]  = useState<EnrichedRow[]>([])
  const [analytics, setAnalytics] = useState<AnalyticsSummary | null>(null)
  const [loading,   setLoading]   = useState(true)

  useEffect(() => {
    async function load() {
      const [savedResult, analyticsResult] = await Promise.allSettled([
        getSavedProperties(),
        getAnalytics(),
      ])

      const saved = (savedResult.status === 'fulfilled' ? savedResult.value : []) as SavedProperty[]
      const ana   = analyticsResult.status === 'fulfilled' ? analyticsResult.value : null
      setAnalytics(ana)

      // Fetch property + risk for the first 5 saved properties
      const rows = await Promise.all(
        saved.slice(0, 5).map(async (sp): Promise<EnrichedRow> => {
          const [propResult, riskResult] = await Promise.allSettled([
            getProperty(sp.propertyId),
            getPropertyRisk(sp.propertyId),
          ])
          return {
            savedProp: sp,
            property: propResult.status === 'fulfilled' ? propResult.value : null,
            risk:     riskResult.status === 'fulfilled' ? riskResult.value : null,
          }
        })
      )
      setEnriched(rows)
    }

    load().finally(() => setLoading(false))
  }, [])

  const totalProps   = analytics?.totalSavedProperties ?? enriched.length
  const totalClients = analytics?.totalClients ?? 0
  const totalReports = analytics?.totalReports ?? 0

  // Compute high-risk count from analytics distribution
  const highRiskCount = analytics?.riskDistribution
    ?.filter((r) => ['HIGH', 'VERY_HIGH', 'EXTREME'].includes(r.level))
    .reduce((sum, r) => sum + r.count, 0) ?? 0

  // Risk distribution donut from real analytics data
  const donutSegments = analytics?.riskDistribution?.length
    ? analytics.riskDistribution.map((r) => ({
        value: r.count,
        color:
          r.level === 'LOW'       ? '#22c55e' :
          r.level === 'MODERATE'  ? '#3b82f6' :
          r.level === 'HIGH'      ? '#f97316' :
          r.level === 'VERY_HIGH' ? '#ef4444' : '#7f1d1d',
        label: `${r.level.replace('_', ' ')} (${r.count})`,
      }))
    : []

  // Peril breakdown from saved enriched rows
  const perilAvg = (key: keyof PropertyRiskProfile['flood']) => {
    const scores = enriched
      .flatMap((r) => (r.risk ? [
        r.risk.flood[key as keyof typeof r.risk.flood] as number,
        r.risk.fire[key as keyof typeof r.risk.fire] as number,
        r.risk.wind[key as keyof typeof r.risk.wind] as number,
        r.risk.earthquake[key as keyof typeof r.risk.earthquake] as number,
        r.risk.crime[key as keyof typeof r.risk.crime] as number,
      ] : []))
    return scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0
  }

  const perilData = enriched.length
    ? [
        { label: 'Flood',  value: Math.round(enriched.filter(r => r.risk).reduce((s, r) => s + (r.risk!.flood.score),      0) / Math.max(enriched.filter(r=>r.risk).length, 1)), color: '#3b82f6' },
        { label: 'Fire',   value: Math.round(enriched.filter(r => r.risk).reduce((s, r) => s + (r.risk!.fire.score),       0) / Math.max(enriched.filter(r=>r.risk).length, 1)), color: '#ef4444' },
        { label: 'Wind',   value: Math.round(enriched.filter(r => r.risk).reduce((s, r) => s + (r.risk!.wind.score),       0) / Math.max(enriched.filter(r=>r.risk).length, 1)), color: '#8b5cf6' },
        { label: 'Quake',  value: Math.round(enriched.filter(r => r.risk).reduce((s, r) => s + (r.risk!.earthquake.score), 0) / Math.max(enriched.filter(r=>r.risk).length, 1)), color: '#f97316' },
        { label: 'Crime',  value: Math.round(enriched.filter(r => r.risk).reduce((s, r) => s + (r.risk!.crime.score),      0) / Math.max(enriched.filter(r=>r.risk).length, 1)), color: '#6b7280' },
      ]
    : [
        { label: 'Flood',  value: 0, color: '#3b82f6' },
        { label: 'Fire',   value: 0, color: '#ef4444' },
        { label: 'Wind',   value: 0, color: '#8b5cf6' },
        { label: 'Quake',  value: 0, color: '#f97316' },
        { label: 'Crime',  value: 0, color: '#6b7280' },
      ]

  return (
    <div className="mx-auto max-w-5xl p-8">
      {/* Header */}
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Agent Dashboard</h1>
          <p className="mt-0.5 text-sm text-emerald-600">Property insurability intelligence for real estate professionals</p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/" className="flex items-center gap-1.5 rounded-lg bg-gray-900 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-gray-800">
            <Search className="h-4 w-4" /> New Check
          </Link>
          <Link href="/compare" className="flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 transition-colors hover:bg-gray-50">
            <GitCompare className="h-4 w-4" /> Compare
          </Link>
          <Link href="/toolkit" className="flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 transition-colors hover:bg-gray-50">
            <Wrench className="h-4 w-4" /> Toolkit
          </Link>
        </div>
      </div>

      {/* Stat cards */}
      <div className="mb-6 grid grid-cols-4 gap-4">
        <StatCard label="SAVED PROPERTIES" value={loading ? '—' : totalProps}   icon={<BookmarkCheck className="h-5 w-5 text-blue-500" />}   />
        <StatCard label="HIGH / SEVERE RISK" value={loading ? '—' : highRiskCount} icon={<AlertTriangle  className="h-5 w-5 text-red-400" />}    />
        <StatCard label="ACTIVE CLIENTS"    value={loading ? '—' : totalClients}  icon={<TrendingUp    className="h-5 w-5 text-green-500" />}  />
        <StatCard label="REPORTS GENERATED" value={loading ? '—' : totalReports}  icon={<FileText      className="h-5 w-5 text-purple-400" />} />
      </div>

      {/* Charts */}
      <div className="mb-6 grid grid-cols-2 gap-4">
        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <h3 className="mb-4 text-sm font-semibold text-gray-800">Risk Level Distribution</h3>
          <DonutChart segments={donutSegments} />
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <h3 className="mb-4 text-sm font-semibold text-gray-800">Avg Risk Score by Peril</h3>
          <PerilBarChart data={perilData} />
        </div>
      </div>

      {/* Recent properties */}
      <div className="rounded-xl border border-gray-200 bg-white p-5">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-800">Recent Properties</h3>
          <Link href="/search" className="flex items-center gap-1 text-xs text-blue-600 hover:underline">
            Search all <ArrowRight className="h-3 w-3" />
          </Link>
        </div>

        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => <div key={i} className="skeleton h-12" />)}
          </div>
        ) : enriched.length === 0 ? (
          <div className="py-8 text-center">
            <Shield className="mx-auto mb-2 h-8 w-8 text-gray-200" />
            <p className="text-sm text-gray-400">No saved properties yet.</p>
            <Link href="/" className="mt-2 inline-flex items-center gap-1.5 text-sm font-medium text-blue-600 hover:underline">
              <Search className="h-4 w-4" /> Run your first check
            </Link>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {enriched.map(({ savedProp, property, risk }) => (
              <div key={savedProp.id} className="flex items-center gap-3 py-3">
                {risk ? (
                  <ScoreBadge score={risk.overallRiskScore} />
                ) : (
                  <span className="w-8 text-center text-xs text-gray-300">—</span>
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-gray-900">
                    {property?.address ?? savedProp.propertyId}
                  </p>
                  <div className="mt-0.5 flex items-center gap-1.5">
                    {property && <span className="text-[10px] text-gray-400">{property.city}, {property.state}</span>}
                    {risk && <RiskBadge level={risk.overallRiskLevel} />}
                  </div>
                </div>
                <Link
                  href={`/properties/${savedProp.propertyId}`}
                  className="flex shrink-0 items-center gap-1 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50"
                >
                  View <ArrowRight className="h-3 w-3" />
                </Link>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function StatCard({ label, value, icon }: { label: string; value: number | string; icon: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">{label}</p>
          <p className="mt-1 text-3xl font-bold text-gray-900">{value}</p>
        </div>
        <div className="mt-0.5">{icon}</div>
      </div>
    </div>
  )
}
