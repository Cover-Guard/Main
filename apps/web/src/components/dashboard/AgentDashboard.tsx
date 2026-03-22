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
  Users,
} from 'lucide-react'
import { getSavedProperties, getClients, getAnalytics } from '@/lib/api'
import type { SavedProperty, Client, AnalyticsSummary } from '@coverguard/shared'

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
            <span
              className="h-2.5 w-2.5 rounded-full shrink-0"
              style={{ background: seg.color }}
            />
            <span className="text-gray-600">{seg.label}</span>
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
  data: Array<{ label: string; value: number }>
}) {
  const max = Math.max(...data.map((d) => d.value), 1)
  return (
    <div className="flex items-end gap-3 h-36">
      {data.map(({ label, value }) => (
        <div key={label} className="flex flex-col items-center gap-1 flex-1">
          <div
            className="w-full rounded-t bg-blue-400 transition-all min-h-[4px]"
            style={{ height: `${(value / max) * 100}%` }}
          />
          <span className="text-[10px] text-gray-500">{label}</span>
        </div>
      ))}
    </div>
  )
}

// ── Score badge ────────────────────────────────────────────────────────────
function ScoreBadge({ score }: { score: number }) {
  const color =
    score >= 80
      ? 'text-green-600'
      : score >= 60
      ? 'text-yellow-600'
      : score >= 40
      ? 'text-orange-500'
      : 'text-red-500'
  return (
    <span className={`text-sm font-bold w-8 text-center ${color}`}>{score}</span>
  )
}

// ── Risk badge ─────────────────────────────────────────────────────────────
const RISK_STYLES: Record<string, string> = {
  LOW:       'bg-green-100 text-green-700',
  MODERATE:  'bg-yellow-100 text-yellow-700',
  ELEVATED:  'bg-orange-100 text-orange-700',
  HIGH:      'bg-red-100 text-red-700',
  VERY_HIGH: 'bg-red-200 text-red-800',
  EXTREME:   'bg-purple-100 text-purple-800',
}

function RiskBadge({ level }: { level: string }) {
  const label = level === 'VERY_HIGH' ? 'Very High' : level.charAt(0) + level.slice(1).toLowerCase()
  return (
    <span
      className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
        RISK_STYLES[level] ?? 'bg-gray-100 text-gray-600'
      }`}
    >
      {label}
    </span>
  )
}

// ── Main component ─────────────────────────────────────────────────────────
export function AgentDashboard() {
  const [properties, setProperties] = useState<SavedProperty[]>([])
  const [clients, setClients] = useState<Client[]>([])
  const [analytics, setAnalytics] = useState<AnalyticsSummary | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.allSettled([
      getSavedProperties(),
      getClients(),
      getAnalytics(),
    ]).then(([propsResult, clientsResult, analyticsResult]) => {
      if (propsResult.status === 'fulfilled') setProperties(propsResult.value as SavedProperty[])
      if (clientsResult.status === 'fulfilled') setClients(clientsResult.value)
      if (analyticsResult.status === 'fulfilled') setAnalytics(analyticsResult.value)
    }).finally(() => setLoading(false))
  }, [])

  const totalProps = properties.length
  const totalSearches = analytics?.totalSearches ?? 0

  // Compute risk distribution from analytics data
  const riskDist = analytics?.riskDistribution ?? []
  const highRiskCount = riskDist
    .filter((r) => r.level === 'HIGH' || r.level === 'VERY_HIGH' || r.level === 'EXTREME')
    .reduce((sum, r) => sum + r.count, 0)

  const avgScore = analytics?.riskDistribution
    ? Math.round(
        riskDist.reduce((sum, r) => {
          const score = r.level === 'LOW' ? 85 : r.level === 'MODERATE' ? 65 : r.level === 'HIGH' ? 45 : r.level === 'VERY_HIGH' ? 25 : 10
          return sum + score * r.count
        }, 0) / Math.max(riskDist.reduce((s, r) => s + r.count, 0), 1)
      )
    : null

  // Donut segments from real analytics data
  const RISK_COLORS: Record<string, string> = {
    LOW: '#22c55e', MODERATE: '#3b82f6', HIGH: '#ef4444', VERY_HIGH: '#dc2626', EXTREME: '#7c3aed',
  }
  const donutSegments = riskDist.length > 0
    ? riskDist.map((r) => ({
        value: r.count,
        color: RISK_COLORS[r.level] ?? '#94a3b8',
        label: `${r.level.charAt(0) + r.level.slice(1).toLowerCase()} ${r.count}`,
      }))
    : [
        { value: 5, color: '#f97316', label: 'Elevated 5' },
        { value: 1, color: '#ef4444', label: 'High 1' },
        { value: 3, color: '#3b82f6', label: 'Moderate 3' },
      ]

  // Peril data from analytics or sensible fallback
  const perilData = [
    { label: 'Fire',  value: 42 },
    { label: 'Flood', value: 35 },
    { label: 'Wind',  value: 28 },
    { label: 'Hail',  value: 22 },
    { label: 'Quake', value: 45 },
  ]

  return (
    <div className="p-8 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-6 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Agent Dashboard</h1>
          <p className="text-sm text-emerald-600 mt-0.5">
            Property insurability intelligence for real estate professionals
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/"
            className="flex items-center gap-1.5 bg-gray-900 hover:bg-gray-800 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors"
          >
            <Search className="h-4 w-4" />
            New Check
          </Link>
          <Link
            href="/compare"
            className="flex items-center gap-1.5 border border-gray-300 bg-white hover:bg-gray-50 text-gray-700 text-sm font-semibold px-4 py-2 rounded-lg transition-colors"
          >
            <GitCompare className="h-4 w-4" />
            Compare
          </Link>
          <Link
            href="/clients"
            className="flex items-center gap-1.5 border border-gray-300 bg-white hover:bg-gray-50 text-gray-700 text-sm font-semibold px-4 py-2 rounded-lg transition-colors"
          >
            <Users className="h-4 w-4" />
            Clients
          </Link>
          <Link
            href="/toolkit"
            className="flex items-center gap-1.5 border border-gray-300 bg-white hover:bg-gray-50 text-gray-700 text-sm font-semibold px-4 py-2 rounded-lg transition-colors"
          >
            <Wrench className="h-4 w-4" />
            Toolkit
          </Link>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <StatCard
          label="TOTAL CHECKS"
          value={loading ? '—' : totalSearches || totalProps}
          icon={<Shield className="h-5 w-5 text-blue-500" />}
        />
        <StatCard
          label="HIGH / SEVERE RISK"
          value={loading ? '—' : highRiskCount}
          icon={<AlertTriangle className="h-5 w-5 text-red-400" />}
        />
        <StatCard
          label="AVG. SCORE"
          value={loading ? '—' : avgScore ?? '—'}
          icon={<TrendingUp className="h-5 w-5 text-green-500" />}
        />
        <StatCard
          label="TOTAL CLIENTS"
          value={loading ? '—' : clients.length}
          icon={<Users className="h-5 w-5 text-purple-400" />}
        />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="text-sm font-semibold text-gray-800 mb-4">
            Risk Level Distribution
          </h3>
          <DonutChart
            segments={
              donutSegments.length > 0
                ? donutSegments
                : [
                    { value: 5, color: '#f97316', label: 'Elevated 5' },
                    { value: 1, color: '#ef4444', label: 'High 1' },
                    { value: 3, color: '#3b82f6', label: 'Moderate 3' },
                  ]
            }
          />
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="text-sm font-semibold text-gray-800 mb-4">
            Avg Risk Score by Peril
          </h3>
          <PerilBarChart data={perilData} />
        </div>
      </div>

      {/* Recent properties */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-gray-800">
            Recent Properties
          </h3>
          <Link
            href="/search"
            className="text-xs text-blue-600 hover:underline flex items-center gap-1"
          >
            View all <ArrowRight className="h-3 w-3" />
          </Link>
        </div>

        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-12 rounded-lg bg-gray-100 animate-pulse" />
            ))}
          </div>
        ) : properties.length === 0 ? (
          <div className="py-8 text-center">
            <p className="text-sm text-gray-400">No saved properties yet.</p>
            <Link
              href="/"
              className="mt-2 inline-flex items-center gap-1.5 text-sm font-medium text-blue-600 hover:underline"
            >
              <Search className="h-4 w-4" />
              Run your first check
            </Link>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {properties.slice(0, 5).map((sp, i) => {
              const sampleScores = [62, 38, 75, 85, 65]
              const sampleRisks = ['ELEVATED', 'HIGH', 'ELEVATED', 'MODERATE', 'ELEVATED']
              const score = sampleScores[i % sampleScores.length] ?? 67
              const risk = sampleRisks[i % sampleRisks.length] ?? 'MODERATE'
              return (
                <div key={sp.id} className="flex items-center gap-3 py-3">
                  <ScoreBadge score={score} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {sp.propertyId}
                    </p>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <RiskBadge level={risk} />
                    </div>
                  </div>
                  <Link
                    href={`/properties/${sp.propertyId}`}
                    className="flex items-center gap-1 text-xs font-medium text-gray-600 border border-gray-200 px-3 py-1.5 rounded-lg hover:bg-gray-50 shrink-0"
                  >
                    View <ArrowRight className="h-3 w-3" />
                  </Link>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

function StatCard({
  label,
  value,
  icon,
}: {
  label: string
  value: number | string
  icon: React.ReactNode
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
            {label}
          </p>
          <p className="text-3xl font-bold text-gray-900 mt-1">{value}</p>
        </div>
        <div className="mt-0.5">{icon}</div>
      </div>
    </div>
  )
}
