'use client'

import { useEffect, useState } from 'react'
import type { AnalyticsSummary } from '@coverguard/shared'
import { getAnalytics } from '@/lib/api'
import { ReportsContent } from '@/components/reports/ReportsContent'
import {
  Shield,
  TrendingUp,
  AlertTriangle,
  Users,
  FileText,
  CheckCircle,
  Activity,
  Clock,
  MapPin,
  Droplets,
  Flame,
  Wind,
  Mountain,
  ShieldAlert,
  DollarSign,
} from 'lucide-react'

// ── Donut SVG ───────────────────────────────────────────────────────────────
function DonutChart({
  segments,
  size = 100,
}: {
  segments: Array<{ value: number; color: string; label: string }>
  size?: number
}) {
  const total = segments.reduce((s, x) => s + x.value, 0)
  if (total === 0) {
    return (
      <div style={{ width: size, height: size }} className="flex items-center justify-center">
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          <circle
            cx={size / 2}
            cy={size / 2}
            r={size * 0.4}
            fill="none"
            stroke="#e5e7eb"
            strokeWidth={size * 0.15}
          />
        </svg>
      </div>
    )
  }

  const R = size * 0.4
  const r = size * 0.25
  const cx = size / 2
  const cy = size / 2

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
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      {segments.map((seg, i) => (
        <path key={i} d={arc(seg.value, cumulativeStarts[i] ?? 0)} fill={seg.color} />
      ))}
    </svg>
  )
}

// ── Line chart (simple SVG sparkline) ──────────────────────────────────────
function LineChart({
  data,
}: {
  data: Array<{ date: string; checks: number; quotes: number }>
}) {
  if (data.length === 0) return null
  const maxVal = Math.max(...data.flatMap((d) => [d.checks, d.quotes]), 1)
  const W = 600
  const H = 80
  const pad = 8

  function pts(key: 'checks' | 'quotes') {
    return data
      .map((d, i) => {
        const x = pad + (i / (data.length - 1)) * (W - 2 * pad)
        const y = H - pad - ((d[key] ?? 0) / maxVal) * (H - 2 * pad)
        return `${x},${y}`
      })
      .join(' ')
  }

  const xLabels = [data[0], data[Math.floor(data.length / 4)], data[Math.floor(data.length / 2)], data[Math.floor(3 * data.length / 4)], data[data.length - 1]].filter(Boolean)

  return (
    <div className="w-full overflow-hidden">
      <svg viewBox={`0 0 ${W} ${H + 20}`} className="w-full">
        <polyline
          points={pts('checks')}
          fill="none"
          stroke="#3b82f6"
          strokeWidth="2"
          strokeLinejoin="round"
        />
        <polyline
          points={pts('quotes')}
          fill="none"
          stroke="#10b981"
          strokeWidth="2"
          strokeLinejoin="round"
          strokeDasharray="4 2"
        />
        {xLabels.map((d, i) => {
          const idx = data.indexOf(d!)
          const x = pad + (idx / (data.length - 1)) * (W - 2 * pad)
          return (
            <text key={i} x={x} y={H + 14} textAnchor="middle" fontSize="10" fill="#9ca3af">
              {d!.date.slice(5)}
            </text>
          )
        })}
      </svg>
      <div className="flex items-center gap-4 mt-1 text-xs text-gray-500">
        <div className="flex items-center gap-1.5">
          <span className="h-0.5 w-5 bg-blue-500 inline-block" />
          Checks
        </div>
        <div className="flex items-center gap-1.5">
          <span className="h-0.5 w-5 bg-emerald-500 inline-block" />
          Quotes
        </div>
      </div>
    </div>
  )
}

// ── Bar chart (generic) ────────────────────────────────────────────────────
function BarChart({ data, color = 'bg-amber-400' }: { data: Array<{ label: string; value: number }>; color?: string }) {
  const max = Math.max(...data.map((d) => d.value), 1)
  return (
    <div className="flex items-end gap-2 h-24">
      {data.map(({ label, value }) => (
        <div key={label} className="flex flex-col items-center gap-1 flex-1">
          <div
            className={`w-full rounded-t ${color} transition-all min-h-[4px]`}
            style={{ height: `${(value / max) * 100}%` }}
          />
          <span className="text-[10px] text-gray-500 truncate w-full text-center">
            {label}
          </span>
        </div>
      ))}
    </div>
  )
}

// ── Monthly bar chart ──────────────────────────────────────────────────────
function MonthlyBarChart({ data }: { data: Array<{ month: string; count: number }> }) {
  const max = Math.max(...data.map((d) => d.count), 1)
  return (
    <div className="flex items-end gap-1.5 h-32">
      {data.map(({ month, count }) => {
        const label = new Date(month + '-01').toLocaleDateString('en-US', { month: 'short' })
        return (
          <div key={month} className="flex flex-col items-center gap-1 flex-1">
            <span className="text-[9px] text-gray-400">{count > 0 ? count : ''}</span>
            <div
              className="w-full rounded-t bg-blue-400 transition-all min-h-[2px]"
              style={{ height: `${(count / max) * 100}%` }}
            />
            <span className="text-[9px] text-gray-500">{label}</span>
          </div>
        )
      })}
    </div>
  )
}

// ── Horizontal score bar ───────────────────────────────────────────────────
function ScoreBar({ score, label, color }: { score: number; label: string; color: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-gray-500 w-24 shrink-0">{label}</span>
      <div className="flex-1 h-2 rounded-full bg-gray-100 overflow-hidden">
        <div
          className="h-2 rounded-full transition-all"
          style={{ width: `${score}%`, background: color }}
        />
      </div>
      <span className="text-xs font-medium text-gray-600 w-8 text-right">{score}</span>
    </div>
  )
}

// ── Risk level badge ───────────────────────────────────────────────────────
function RiskBadge({ level }: { level: string }) {
  const colors: Record<string, string> = {
    LOW: 'bg-green-100 text-green-700',
    MODERATE: 'bg-blue-100 text-blue-700',
    HIGH: 'bg-red-100 text-red-700',
    VERY_HIGH: 'bg-red-200 text-red-800',
    EXTREME: 'bg-purple-100 text-purple-700',
  }
  const display = level.replace('_', ' ')
  return (
    <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${colors[level] ?? 'bg-gray-100 text-gray-600'}`}>
      {display}
    </span>
  )
}

type TopLevelTab = 'overview' | 'regional' | 'reports'

const RISK_COLORS: Record<string, string> = {
  LOW: '#22c55e', MODERATE: '#3b82f6', HIGH: '#ef4444', VERY_HIGH: '#dc2626', EXTREME: '#7c3aed',
}

const riskScoreMap: Record<string, number> = {
  LOW: 85, MODERATE: 65, HIGH: 45, VERY_HIGH: 25, EXTREME: 10,
}

// ── Main ──────────────────────────────────────────────────────────────────
export function AnalyticsDashboard({ initialTab }: { initialTab?: TopLevelTab }) {
  const [data, setData] = useState<AnalyticsSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tab, setTab] = useState<TopLevelTab>(initialTab ?? 'overview')

  useEffect(() => {
    getAnalytics()
      .then(setData)
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load analytics'))
      .finally(() => setLoading(false))
  }, [])

  if (loading && tab !== 'reports') return <AnalyticsSkeleton />

  if (error) {
    return (
      <div className="p-8 max-w-5xl mx-auto">
        <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-center">
          <AlertTriangle className="mx-auto h-8 w-8 text-red-400 mb-2" />
          <p className="font-semibold text-red-700">Failed to load analytics</p>
          <p className="text-sm text-red-500 mt-1">{error}</p>
          <button
            onClick={() => { setError(null); setLoading(true); getAnalytics().then(setData).catch((e) => setError(e instanceof Error ? e.message : 'Failed to load analytics')).finally(() => setLoading(false)) }}
            className="mt-4 px-4 py-2 text-sm font-semibold bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="p-8 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-2 mb-1">
        <Activity className="h-6 w-6 text-blue-600" />
        <h1 className="text-2xl font-bold text-gray-900">Analytics &amp; Reports</h1>
      </div>
      <p className="text-sm text-gray-500 mb-5">
        Key metrics, pipeline insights, regional risk trends, and saved property reports
      </p>

      {/* Tabs */}
      <div className="flex items-center gap-1 mb-6 border-b border-gray-200 pb-0">
        <TabButton active={tab === 'overview'} onClick={() => setTab('overview')} icon={<Activity className="h-3.5 w-3.5" />}>
          Overview
        </TabButton>
        <TabButton active={tab === 'regional'} onClick={() => setTab('regional')} icon={<TrendingUp className="h-3.5 w-3.5" />}>
          Regional Trends
        </TabButton>
        <TabButton active={tab === 'reports'} onClick={() => setTab('reports')} icon={<FileText className="h-3.5 w-3.5" />}>
          Reports
        </TabButton>
      </div>

      {/* Reports tab */}
      {tab === 'reports' && (
        <div className="-mx-8 -mt-6">
          <ReportsContent />
        </div>
      )}

      {/* Overview tab */}
      {tab === 'overview' && data && <OverviewTab data={data} />}

      {/* Regional Trends tab */}
      {tab === 'regional' && data && <RegionalTab data={data} />}
    </div>
  )
}

// ── Overview Tab ──────────────────────────────────────────────────────────
function OverviewTab({ data }: { data: AnalyticsSummary }) {
  const totalChecks = data.totalSearches
  const activeClients = data.totalClients

  // avgScore: weighted average from risk distribution
  const riskDist = data.riskDistribution ?? []
  const totalRiskItems = riskDist.reduce((s, r) => s + r.count, 0)
  const avgScore =
    totalRiskItems > 0
      ? Math.round(
          riskDist.reduce((s, r) => s + (riskScoreMap[r.level] ?? 50) * r.count, 0) /
            totalRiskItems
        )
      : 0

  // highRisk: count of HIGH + VERY_HIGH + EXTREME
  const highRisk = riskDist
    .filter((r) => r.level === 'HIGH' || r.level === 'VERY_HIGH' || r.level === 'EXTREME')
    .reduce((s, r) => s + r.count, 0)

  // Quote metrics
  const quotes = data.quoteRequests

  // Activity last 30 days
  const activityData: Array<{ date: string; checks: number; quotes: number }> =
    (data.searchesByDay ?? []).length > 0
      ? data.searchesByDay.map((d) => ({ date: d.date, checks: d.count, quotes: 0 }))
      : Array.from({ length: 30 }, (_, i) => {
          const d = new Date()
          d.setDate(d.getDate() - (29 - i))
          return { date: d.toISOString().slice(0, 10), checks: 0, quotes: 0 }
        })

  // Risk distribution donut
  const riskSegments =
    riskDist.length > 0
      ? riskDist.map((r) => ({
          value: r.count,
          color: RISK_COLORS[r.level] ?? '#94a3b8',
          label: `${r.level.charAt(0) + r.level.slice(1).toLowerCase().replace('_', ' ')} ${r.count}`,
        }))
      : [{ value: 1, color: '#e5e7eb', label: 'No data' }]

  // Quote status donut
  const quoteSegments =
    quotes.total > 0
      ? [
          { value: quotes.pending, color: '#f59e0b', label: `Pending ${quotes.pending}` },
          { value: quotes.sent, color: '#3b82f6', label: `Sent ${quotes.sent}` },
          { value: quotes.responded, color: '#22c55e', label: `Responded ${quotes.responded}` },
          { value: quotes.declined, color: '#ef4444', label: `Declined ${quotes.declined}` },
        ].filter((s) => s.value > 0)
      : [{ value: 1, color: '#e5e7eb', label: 'No quotes yet' }]

  // Client pipeline donut
  const pipeline = data.clientPipeline
  const pipelineTotal = pipeline.active + pipeline.prospect + pipeline.closed + pipeline.inactive
  const pipelineSegments =
    pipelineTotal > 0
      ? [
          { value: pipeline.active, color: '#22c55e', label: `Active ${pipeline.active}` },
          { value: pipeline.prospect, color: '#3b82f6', label: `Prospect ${pipeline.prospect}` },
          { value: pipeline.closed, color: '#6b7280', label: `Closed ${pipeline.closed}` },
          { value: pipeline.inactive, color: '#d1d5db', label: `Inactive ${pipeline.inactive}` },
        ].filter((s) => s.value > 0)
      : [{ value: 1, color: '#e5e7eb', label: 'No clients yet' }]

  // 4-week bar — group searchesByDay into 7-day buckets
  const searchDays = data.searchesByDay ?? []
  const weekBars = Array.from({ length: 4 }, (_, wi) => {
    const weekEnd = 29 - wi * 7
    const weekStart = weekEnd - 6
    const count = searchDays
      .slice(Math.max(0, weekStart), weekEnd + 1)
      .reduce((s, d) => s + d.count, 0)
    const endDate = new Date()
    endDate.setDate(endDate.getDate() - wi * 7)
    const startDate = new Date(endDate)
    startDate.setDate(startDate.getDate() - 6)
    const fmt = (d: Date) =>
      d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    return { label: `${fmt(startDate)}`, value: count }
  }).reverse()

  // Checks by state
  const stateChecks = (data.topStates ?? []).slice(0, 5)
  const maxStateCount = Math.max(...stateChecks.map((s) => s.count), 1)

  return (
    <>
      {/* Top stat rows */}
      <div className="grid grid-cols-4 gap-3 mb-3">
        <MiniStat label="TOTAL CHECKS" sub="all time" value={totalChecks} icon={<Shield className="h-4 w-4 text-blue-500" />} />
        <MiniStat label="AVG SCORE" sub="insurability" value={avgScore} icon={<TrendingUp className="h-4 w-4 text-emerald-500" />} />
        <MiniStat label="HIGH RISK" sub="score < 40" value={highRisk} icon={<AlertTriangle className="h-4 w-4 text-red-400" />} />
        <MiniStat label="ACTIVE CLIENTS" sub={`${data.totalClients} total`} value={activeClients} icon={<Users className="h-4 w-4 text-purple-400" />} />
      </div>
      <div className="grid grid-cols-4 gap-3 mb-6">
        <MiniStat label="QUOTES" sub="all time" value={quotes.total} icon={<FileText className="h-4 w-4 text-orange-400" />} />
        <MiniStat label="RESPONDED" sub="carrier replied" value={quotes.responded} icon={<CheckCircle className="h-4 w-4 text-emerald-500" />} />
        <MiniStat label="PENDING" sub="awaiting response" value={quotes.pending} icon={<Clock className="h-4 w-4 text-amber-400" />} />
        <MiniStat
          label="AVG PREMIUM"
          sub="annual estimate"
          value={data.avgInsuranceCost != null ? `$${data.avgInsuranceCost.toLocaleString()}` : '—'}
          icon={<DollarSign className="h-4 w-4 text-green-500" />}
        />
      </div>

      {/* Activity line chart */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 mb-4">
        <div className="flex items-center gap-2 mb-3">
          <Activity className="h-4 w-4 text-emerald-500" />
          <h3 className="text-sm font-semibold text-gray-800">
            Activity — Last 30 Days
          </h3>
        </div>
        <LineChart data={activityData} />
      </div>

      {/* Three donut charts */}
      <div className="grid grid-cols-3 gap-4 mb-4">
        <ChartCard title="Risk Level Distribution">
          <div className="flex flex-col items-center gap-3">
            <DonutChart segments={riskSegments} size={100} />
            <div className="space-y-1">
              {riskSegments.map((s) => (
                <div key={s.label} className="flex items-center gap-1.5 text-xs">
                  <span className="h-2 w-2 rounded-full shrink-0" style={{ background: s.color }} />
                  <span className="text-gray-500">{s.label}</span>
                </div>
              ))}
            </div>
          </div>
        </ChartCard>

        <ChartCard title="Quote Request Status">
          <div className="flex flex-col items-center gap-3">
            <DonutChart segments={quoteSegments} size={100} />
            <div className="space-y-1">
              {quoteSegments.map((s) => (
                <div key={s.label} className="flex items-center gap-1.5 text-xs">
                  <span className="h-2 w-2 rounded-full shrink-0" style={{ background: s.color }} />
                  <span className="text-gray-500">{s.label}</span>
                </div>
              ))}
            </div>
          </div>
        </ChartCard>

        <ChartCard title="Client Pipeline">
          <div className="flex flex-col items-center gap-3">
            <DonutChart segments={pipelineSegments} size={100} />
            <div className="space-y-1">
              {pipelineSegments.map((s) => (
                <div key={s.label} className="flex items-center gap-1.5 text-xs">
                  <span className="h-2 w-2 rounded-full shrink-0" style={{ background: s.color }} />
                  <span className="text-gray-500">{s.label}</span>
                </div>
              ))}
            </div>
          </div>
        </ChartCard>
      </div>

      {/* Bottom three panels */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="text-sm font-semibold text-gray-800 mb-4">
            Checks — Last 4 Weeks
          </h3>
          <BarChart data={weekBars} />
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="text-sm font-semibold text-gray-800 mb-4">
            Checks by State
          </h3>
          {stateChecks.length === 0 ? (
            <p className="text-sm text-gray-400">No data yet.</p>
          ) : (
            <div className="space-y-3">
              {stateChecks.map((s, i) => (
                <div key={s.state} className="flex items-center gap-3">
                  <span className="text-xs text-gray-400 w-4">{i + 1}</span>
                  <span className="text-xs font-semibold text-gray-700 w-6">{s.state}</span>
                  <div className="flex-1 h-2 rounded-full bg-gray-100 overflow-hidden">
                    <div
                      className="h-2 rounded-full bg-emerald-400"
                      style={{ width: `${(s.count / maxStateCount) * 100}%` }}
                    />
                  </div>
                  <span className="text-xs text-gray-400 w-6 text-right">{s.count}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="text-sm font-semibold text-gray-800 mb-4">Recent Activity</h3>
          {(data.recentActivity ?? []).length === 0 ? (
            <p className="text-sm text-gray-400">No activity yet.</p>
          ) : (
            <div className="space-y-2">
              {data.recentActivity.slice(0, 7).map((item, i) => (
                <div key={i} className="flex items-start gap-2 text-xs">
                  <span className={`mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full ${
                    item.type === 'search' ? 'bg-blue-400' :
                    item.type === 'save' ? 'bg-emerald-400' : 'bg-purple-400'
                  }`} />
                  <span className="flex-1 text-gray-600 truncate">{item.description}</span>
                  <span className="text-gray-400 shrink-0">
                    {new Date(item.timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  )
}

// ── Regional Trends Tab ──────────────────────────────────────────────────
function RegionalTab({ data }: { data: AnalyticsSummary }) {
  const regional = data.regionalRisk ?? []
  const searchesByMonth = data.searchesByMonth ?? []

  // Compute highest-risk category per state
  const riskCategories = [
    { key: 'avgFloodScore' as const, label: 'Flood', icon: Droplets, color: '#3b82f6' },
    { key: 'avgFireScore' as const, label: 'Fire', icon: Flame, color: '#ef4444' },
    { key: 'avgWindScore' as const, label: 'Wind', icon: Wind, color: '#6366f1' },
    { key: 'avgEarthquakeScore' as const, label: 'Earthquake', icon: Mountain, color: '#f59e0b' },
    { key: 'avgCrimeScore' as const, label: 'Crime', icon: ShieldAlert, color: '#8b5cf6' },
  ]

  // Aggregate risk category averages across all states
  const categoryAverages = regional.length > 0
    ? riskCategories.map((cat) => {
        const avg = Math.round(
          regional.reduce((s, r) => s + r[cat.key], 0) / regional.length
        )
        return { ...cat, avg }
      })
    : []

  // Find highest risk states per category
  const topRiskByCategory = riskCategories.map((cat) => {
    const sorted = [...regional].sort((a, b) => b[cat.key] - a[cat.key])
    return { category: cat.label, color: cat.color, topStates: sorted.slice(0, 3) }
  })

  return (
    <>
      {/* Monthly search volume */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 mb-4">
        <div className="flex items-center gap-2 mb-4">
          <TrendingUp className="h-4 w-4 text-blue-500" />
          <h3 className="text-sm font-semibold text-gray-800">
            Search Volume — Last 12 Months
          </h3>
        </div>
        {searchesByMonth.length > 0 ? (
          <MonthlyBarChart data={searchesByMonth} />
        ) : (
          <p className="text-sm text-gray-400 text-center py-8">No search data yet.</p>
        )}
      </div>

      {/* Average risk scores by category */}
      {categoryAverages.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-5 mb-4">
          <h3 className="text-sm font-semibold text-gray-800 mb-4">
            Average Risk Scores Across Your Properties
          </h3>
          <div className="space-y-3">
            {categoryAverages.map((cat) => (
              <ScoreBar key={cat.label} score={cat.avg} label={cat.label} color={cat.color} />
            ))}
          </div>
        </div>
      )}

      {/* State-level risk table */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 mb-4">
        <div className="flex items-center gap-2 mb-4">
          <MapPin className="h-4 w-4 text-emerald-500" />
          <h3 className="text-sm font-semibold text-gray-800">
            Risk Breakdown by State
          </h3>
        </div>

        {regional.length === 0 ? (
          <div className="text-center py-12">
            <MapPin className="h-10 w-10 text-gray-200 mx-auto mb-3" />
            <p className="text-sm text-gray-400">Save properties to see regional risk trends.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left font-semibold text-gray-500 py-2 pr-3">State</th>
                  <th className="text-center font-semibold text-gray-500 py-2 px-2">Properties</th>
                  <th className="text-center font-semibold text-gray-500 py-2 px-2">Overall</th>
                  <th className="text-center font-semibold text-gray-500 py-2 px-2">
                    <span className="flex items-center justify-center gap-1"><Droplets className="h-3 w-3" /> Flood</span>
                  </th>
                  <th className="text-center font-semibold text-gray-500 py-2 px-2">
                    <span className="flex items-center justify-center gap-1"><Flame className="h-3 w-3" /> Fire</span>
                  </th>
                  <th className="text-center font-semibold text-gray-500 py-2 px-2">
                    <span className="flex items-center justify-center gap-1"><Wind className="h-3 w-3" /> Wind</span>
                  </th>
                  <th className="text-center font-semibold text-gray-500 py-2 px-2">
                    <span className="flex items-center justify-center gap-1"><Mountain className="h-3 w-3" /> Quake</span>
                  </th>
                  <th className="text-center font-semibold text-gray-500 py-2 px-2">
                    <span className="flex items-center justify-center gap-1"><ShieldAlert className="h-3 w-3" /> Crime</span>
                  </th>
                  <th className="text-center font-semibold text-gray-500 py-2 px-2">Risk Level</th>
                </tr>
              </thead>
              <tbody>
                {regional.map((r) => (
                  <tr key={r.state} className="border-b border-gray-50 hover:bg-gray-50/50">
                    <td className="py-2.5 pr-3 font-semibold text-gray-800">{r.state}</td>
                    <td className="text-center py-2.5 px-2 text-gray-600">{r.propertyCount}</td>
                    <td className="text-center py-2.5 px-2">
                      <ScoreCell score={r.avgOverallScore} />
                    </td>
                    <td className="text-center py-2.5 px-2">
                      <ScoreCell score={r.avgFloodScore} />
                    </td>
                    <td className="text-center py-2.5 px-2">
                      <ScoreCell score={r.avgFireScore} />
                    </td>
                    <td className="text-center py-2.5 px-2">
                      <ScoreCell score={r.avgWindScore} />
                    </td>
                    <td className="text-center py-2.5 px-2">
                      <ScoreCell score={r.avgEarthquakeScore} />
                    </td>
                    <td className="text-center py-2.5 px-2">
                      <ScoreCell score={r.avgCrimeScore} />
                    </td>
                    <td className="text-center py-2.5 px-2">
                      <RiskBadge level={r.dominantRiskLevel} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Highest risk states per category */}
      {regional.length > 0 && (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
          {topRiskByCategory.map(({ category, color, topStates }) => (
            <div key={category} className="bg-white rounded-xl border border-gray-200 p-4">
              <h4 className="text-xs font-semibold text-gray-600 mb-3">
                Highest {category} Risk
              </h4>
              {topStates.length === 0 ? (
                <p className="text-xs text-gray-400">No data</p>
              ) : (
                <div className="space-y-2">
                  {topStates.map((st, i) => {
                    const catKey = riskCategories.find((c) => c.label === category)!.key
                    const score = st[catKey]
                    return (
                      <div key={st.state} className="flex items-center gap-2">
                        <span className="text-xs text-gray-400 w-4">{i + 1}</span>
                        <span className="text-xs font-semibold text-gray-700 w-6">{st.state}</span>
                        <div className="flex-1 h-2 rounded-full bg-gray-100 overflow-hidden">
                          <div
                            className="h-2 rounded-full"
                            style={{ width: `${score}%`, background: color }}
                          />
                        </div>
                        <span className="text-xs text-gray-500 w-6 text-right">{score}</span>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </>
  )
}

// ── Score cell (colored by risk) ──────────────────────────────────────────
function ScoreCell({ score }: { score: number }) {
  const color =
    score >= 70 ? 'text-red-600 font-semibold' :
    score >= 50 ? 'text-amber-600 font-medium' :
    score >= 30 ? 'text-blue-600' :
    'text-green-600'
  return <span className={`text-xs ${color}`}>{score}</span>
}

function TabButton({
  active,
  onClick,
  icon,
  children,
}: {
  active: boolean
  onClick: () => void
  icon: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 px-3 py-2 rounded-t-md text-sm font-medium transition-colors border-b-2 -mb-px ${
        active
          ? 'border-blue-600 text-blue-700 bg-blue-50/60'
          : 'border-transparent text-gray-500 hover:text-gray-700'
      }`}
    >
      {icon}
      {children}
    </button>
  )
}

function MiniStat({
  label,
  sub,
  value,
  icon,
}: {
  label: string
  sub: string
  value: number | string
  icon: React.ReactNode
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
            {label}
          </p>
          <p className="text-2xl font-bold text-gray-900 mt-0.5">{value}</p>
          <p className="text-[10px] text-gray-400 mt-0.5">{sub}</p>
        </div>
        <div>{icon}</div>
      </div>
    </div>
  )
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <h3 className="text-xs font-semibold text-gray-600 mb-3">{title}</h3>
      <div className="flex flex-col items-center">{children}</div>
    </div>
  )
}

function AnalyticsSkeleton() {
  return (
    <div className="p-8 max-w-5xl mx-auto space-y-4">
      <div className="h-8 w-48 bg-gray-100 animate-pulse rounded mb-2" />
      <div className="h-4 w-72 bg-gray-100 animate-pulse rounded mb-6" />
      <div className="grid grid-cols-4 gap-3">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-20 rounded-xl bg-gray-100 animate-pulse" />
        ))}
      </div>
      <div className="grid grid-cols-4 gap-3">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-20 rounded-xl bg-gray-100 animate-pulse" />
        ))}
      </div>
      <div className="h-36 rounded-xl bg-gray-100 animate-pulse" />
      <div className="grid grid-cols-3 gap-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-48 rounded-xl bg-gray-100 animate-pulse" />
        ))}
      </div>
      <div className="grid grid-cols-3 gap-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-36 rounded-xl bg-gray-100 animate-pulse" />
        ))}
      </div>
    </div>
  )
}
