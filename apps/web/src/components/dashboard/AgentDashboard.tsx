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
  ArrowRight,
  Users,
  Activity,
  MapPin,
} from 'lucide-react'
import { getAnalytics, getSavedProperties, getPropertyRisk } from '@/lib/api'
import type { AnalyticsSummary, PropertyRiskProfile } from '@coverguard/shared'
import { riskScoreColor, riskLevelClasses } from '@/lib/utils'
import { riskLevelToLabel } from '@coverguard/shared'

// ── Donut SVG ──────────────────────────────────────────────────────────────
function DonutChart({
  segments,
}: {
  segments: Array<{ value: number; color: string; label: string }>
}) {
  const total = segments.reduce((s, x) => s + x.value, 0)
  if (total === 0) {
    return (
      <div className="flex items-center justify-center h-36 text-sm text-gray-400">
        No data yet
      </div>
    )
  }

  const R = 54
  const r = 34
  const cx = 64
  const cy = 64

  function arc(value: number, cumulativeBefore: number) {
    const angle = (value / total) * 2 * Math.PI
    const startAngle = cumulativeBefore * 2 * Math.PI - Math.PI / 2
    const endAngle = (cumulativeBefore + value / total) * 2 * Math.PI - Math.PI / 2
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

  const cumulativeStarts = segments.map((_, i) =>
    segments.slice(0, i).reduce((sum, s) => sum + s.value / total, 0)
  )

  return (
    <div className="flex items-center gap-4">
      <svg width={128} height={128} viewBox="0 0 128 128">
        {segments.map((seg, i) => (
          <path key={i} d={arc(seg.value, cumulativeStarts[i] ?? 0)} fill={seg.color} />
        ))}
      </svg>
      <div className="space-y-1.5">
        {segments.map((seg) => (
          <div key={seg.label} className="flex items-center gap-2 text-xs">
            <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ background: seg.color }} />
            <span className="text-gray-600">
              {seg.label} <span className="text-gray-400">({seg.value})</span>
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Bar chart ──────────────────────────────────────────────────────────────
function PerilBarChart({
  data,
}: {
  data: Array<{ label: string; value: number; color: string }>
}) {
  const max = Math.max(...data.map((d) => d.value), 1)
  return (
    <div className="flex items-end gap-3 h-36">
      {data.map(({ label, value, color }) => (
        <div key={label} className="flex flex-col items-center gap-1 flex-1">
          <span className="text-[10px] font-semibold text-gray-500">{value}</span>
          <div
            className="w-full rounded-t transition-all min-h-[4px]"
            style={{ height: `${(value / max) * 100}%`, background: color }}
          />
          <span className="text-[10px] text-gray-500">{label}</span>
        </div>
      ))}
    </div>
  )
}

const ACTIVITY_ICONS: Record<string, string> = {
  search: '🔍',
  save: '🏠',
  report: '📄',
}

interface RecentPropertyData {
  propertyId: string
  address?: string
  risk: PropertyRiskProfile | null
}

// ── Main component ─────────────────────────────────────────────────────────
export function AgentDashboard() {
  const [analytics, setAnalytics] = useState<AnalyticsSummary | null>(null)
  const [recentProperties, setRecentProperties] = useState<RecentPropertyData[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadData() {
      try {
        const [analyticsResult, savedResult] = await Promise.allSettled([
          getAnalytics(),
          getSavedProperties(),
        ])

        if (analyticsResult.status === 'fulfilled') {
          setAnalytics(analyticsResult.value)
        }

        if (savedResult.status === 'fulfilled') {
          const recent = (savedResult.value as Array<{ propertyId: string; property?: { address?: string } }>).slice(0, 5)
          const riskResults = await Promise.all(
            recent.map(async (sp) => {
              try {
                const risk = await getPropertyRisk(sp.propertyId)
                return { propertyId: sp.propertyId, address: sp.property?.address, risk }
              } catch {
                return { propertyId: sp.propertyId, address: sp.property?.address, risk: null }
              }
            })
          )
          setRecentProperties(riskResults)
        }
      } catch {
        // ignore
      } finally {
        setLoading(false)
      }
    }
    loadData()
  }, [])

  const RISK_COLORS: Record<string, string> = {
    LOW: '#22c55e',
    MODERATE: '#f59e0b',
    HIGH: '#f97316',
    VERY_HIGH: '#ef4444',
    EXTREME: '#a855f7',
  }

  const donutSegments = analytics?.riskDistribution
    ?.filter((r) => r.count > 0)
    .map((r) => ({
      value: r.count,
      color: RISK_COLORS[r.level] ?? '#94a3b8',
      label: r.level.replace('_', ' '),
    })) ?? []

  const perilData = recentProperties.length > 0
    ? [
        { label: 'Flood',  value: Math.round(recentProperties.reduce((s, p) => s + (p.risk?.flood.score ?? 0), 0) / recentProperties.length), color: '#3b82f6' },
        { label: 'Fire',   value: Math.round(recentProperties.reduce((s, p) => s + (p.risk?.fire.score ?? 0), 0) / recentProperties.length), color: '#ef4444' },
        { label: 'Wind',   value: Math.round(recentProperties.reduce((s, p) => s + (p.risk?.wind.score ?? 0), 0) / recentProperties.length), color: '#8b5cf6' },
        { label: 'Quake',  value: Math.round(recentProperties.reduce((s, p) => s + (p.risk?.earthquake.score ?? 0), 0) / recentProperties.length), color: '#f59e0b' },
        { label: 'Crime',  value: Math.round(recentProperties.reduce((s, p) => s + (p.risk?.crime.score ?? 0), 0) / recentProperties.length), color: '#6b7280' },
      ]
    : [
        { label: 'Flood', value: 0, color: '#3b82f6' },
        { label: 'Fire', value: 0, color: '#ef4444' },
        { label: 'Wind', value: 0, color: '#8b5cf6' },
        { label: 'Quake', value: 0, color: '#f59e0b' },
        { label: 'Crime', value: 0, color: '#6b7280' },
      ]

  const highRiskCount = analytics?.riskDistribution
    ?.filter((r) => r.level === 'HIGH' || r.level === 'VERY_HIGH' || r.level === 'EXTREME')
    .reduce((s, r) => s + r.count, 0) ?? 0

  const avgScore = recentProperties.length > 0
    ? Math.round(recentProperties.reduce((s, p) => s + (p.risk?.overallRiskScore ?? 0), 0) / recentProperties.length)
    : null

  const topState = analytics?.topStates?.[0]?.state

  return (
    <div className="p-8 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Agent Dashboard</h1>
          <p className="text-sm text-emerald-600 mt-0.5">
            Property insurability intelligence for real estate professionals
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Link href="/" className="flex items-center gap-1.5 bg-gray-900 hover:bg-gray-800 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors">
            <Search className="h-4 w-4" />
            New Check
          </Link>
          <Link href="/compare" className="flex items-center gap-1.5 border border-gray-300 bg-white hover:bg-gray-50 text-gray-700 text-sm font-semibold px-4 py-2 rounded-lg transition-colors">
            <GitCompare className="h-4 w-4" />
            Compare
          </Link>
          <Link href="/clients" className="flex items-center gap-1.5 border border-gray-300 bg-white hover:bg-gray-50 text-gray-700 text-sm font-semibold px-4 py-2 rounded-lg transition-colors">
            <Users className="h-4 w-4" />
            Clients
          </Link>
          <Link href="/toolkit" className="flex items-center gap-1.5 border border-gray-300 bg-white hover:bg-gray-50 text-gray-700 text-sm font-semibold px-4 py-2 rounded-lg transition-colors">
            <Wrench className="h-4 w-4" />
            Toolkit
          </Link>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <StatCard
          label="TOTAL PROPERTIES"
          value={loading ? '—' : (analytics?.totalSavedProperties ?? 0)}
          icon={<Shield className="h-5 w-5 text-blue-500" />}
          sub={topState ? `Most in ${topState}` : undefined}
        />
        <StatCard
          label="HIGH / SEVERE RISK"
          value={loading ? '—' : highRiskCount}
          icon={<AlertTriangle className="h-5 w-5 text-red-400" />}
          sub={highRiskCount > 0 ? 'Require attention' : 'All manageable'}
        />
        <StatCard
          label="AVG. RISK SCORE"
          value={loading ? '—' : (avgScore !== null ? avgScore : '—')}
          icon={<TrendingUp className="h-5 w-5 text-green-500" />}
          sub="Across recent properties"
        />
        <StatCard
          label="TOTAL CLIENTS"
          value={loading ? '—' : (analytics?.totalClients ?? 0)}
          icon={<Users className="h-5 w-5 text-purple-400" />}
          sub={`${analytics?.totalSearches ?? 0} searches`}
        />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="text-sm font-semibold text-gray-800 mb-4">Risk Level Distribution</h3>
          {loading ? (
            <div className="h-36 animate-pulse rounded bg-gray-100" />
          ) : donutSegments.length > 0 ? (
            <DonutChart segments={donutSegments} />
          ) : (
            <div className="flex items-center justify-center h-36 text-sm text-gray-400">
              Save properties to see distribution
            </div>
          )}
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="text-sm font-semibold text-gray-800 mb-1">Avg Risk Score by Peril</h3>
          <p className="text-xs text-gray-400 mb-3">Based on {recentProperties.length} recent properties</p>
          {loading ? (
            <div className="h-36 animate-pulse rounded bg-gray-100" />
          ) : (
            <PerilBarChart data={perilData} />
          )}
        </div>
      </div>

      {/* Top States */}
      {!loading && analytics?.topStates && analytics.topStates.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-5 mb-6">
          <h3 className="text-sm font-semibold text-gray-800 mb-4">Top States by Saved Properties</h3>
          <div className="flex flex-wrap gap-3">
            {analytics.topStates.slice(0, 8).map(({ state, count }) => (
              <div key={state} className="flex items-center gap-2 bg-gray-50 rounded-lg px-3 py-2">
                <MapPin className="h-3.5 w-3.5 text-gray-400" />
                <span className="text-sm font-semibold text-gray-700">{state}</span>
                <span className="text-xs text-gray-400">{count}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent properties */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-gray-800">Recent Properties</h3>
          <Link href="/reports" className="text-xs text-blue-600 hover:underline flex items-center gap-1">
            View all <ArrowRight className="h-3 w-3" />
          </Link>
        </div>

        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-16 rounded-lg bg-gray-100 animate-pulse" />
            ))}
          </div>
        ) : recentProperties.length === 0 ? (
          <div className="py-8 text-center">
            <p className="text-sm text-gray-400">No saved properties yet.</p>
            <Link href="/" className="mt-2 inline-flex items-center gap-1.5 text-sm font-medium text-blue-600 hover:underline">
              <Search className="h-4 w-4" />
              Run your first check
            </Link>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {recentProperties.map((rp) => (
              <div key={rp.propertyId} className="flex items-center gap-3 py-3">
                {rp.risk ? (
                  <span className={`text-sm font-bold w-8 text-center ${riskScoreColor(rp.risk.overallRiskScore)}`}>
                    {rp.risk.overallRiskScore}
                  </span>
                ) : (
                  <span className="text-sm text-gray-300 w-8 text-center">—</span>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">
                    {rp.address ?? rp.propertyId}
                  </p>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    {rp.risk && (
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${riskLevelClasses(rp.risk.overallRiskLevel)}`}>
                        {riskLevelToLabel(rp.risk.overallRiskLevel)}
                      </span>
                    )}
                    {rp.risk && (
                      <span className="text-[10px] text-gray-400">
                        F:{rp.risk.flood.score} Fi:{rp.risk.fire.score} W:{rp.risk.wind.score}
                      </span>
                    )}
                  </div>
                </div>
                <Link
                  href={`/properties/${rp.propertyId}`}
                  className="flex items-center gap-1 text-xs font-medium text-gray-600 border border-gray-200 px-3 py-1.5 rounded-lg hover:bg-gray-50 shrink-0"
                >
                  View <ArrowRight className="h-3 w-3" />
                </Link>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Recent Activity */}
      {!loading && analytics?.recentActivity && analytics.recentActivity.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center gap-2 mb-4">
            <Activity className="h-4 w-4 text-gray-500" />
            <h3 className="text-sm font-semibold text-gray-800">Recent Activity</h3>
          </div>
          <div className="space-y-3">
            {analytics.recentActivity.slice(0, 8).map((activity, i) => (
              <div key={i} className="flex items-start gap-3 text-sm">
                <span className="text-base shrink-0">{ACTIVITY_ICONS[activity.type] ?? '📌'}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-gray-700 truncate">{activity.description}</p>
                  <p className="text-xs text-gray-400">
                    {new Date(activity.timestamp).toLocaleString('en-US', {
                      month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
                    })}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function StatCard({
  label,
  value,
  icon,
  sub,
}: {
  label: string
  value: number | string
  icon: React.ReactNode
  sub?: string
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">{label}</p>
          <p className="text-3xl font-bold text-gray-900 mt-1">{value}</p>
          {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
        </div>
        <div className="mt-0.5">{icon}</div>
      </div>
    </div>
  )
}
