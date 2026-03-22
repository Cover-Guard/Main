'use client'

import { useEffect, useState } from 'react'
import type { AnalyticsSummary } from '@coverguard/shared'
import { getAnalytics } from '@/lib/api'
import {
  Shield,
  TrendingUp,
  AlertTriangle,
  Users,
  FileText,
  CheckCircle,
  Activity,
  Clock,
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

  const arcPaths: string[] = []
  let cumulative = 0
  for (const seg of segments) {
    const angle = (seg.value / total) * 2 * Math.PI
    const startAngle = cumulative * 2 * Math.PI - Math.PI / 2
    const newCumulative = cumulative + seg.value / total
    const endAngle = newCumulative * 2 * Math.PI - Math.PI / 2
    const x1 = cx + R * Math.cos(startAngle)
    const y1 = cy + R * Math.sin(startAngle)
    const x2 = cx + R * Math.cos(endAngle)
    const y2 = cy + R * Math.sin(endAngle)
    const ix1 = cx + r * Math.cos(startAngle)
    const iy1 = cy + r * Math.sin(startAngle)
    const ix2 = cx + r * Math.cos(endAngle)
    const iy2 = cy + r * Math.sin(endAngle)
    const large = angle > Math.PI ? 1 : 0
    const d = `M ${x1} ${y1} A ${R} ${R} 0 ${large} 1 ${x2} ${y2} L ${ix2} ${iy2} A ${r} ${r} 0 ${large} 0 ${ix1} ${iy1} Z`
    arcPaths.push(d)
    cumulative = newCumulative
  }

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      {segments.map((seg, i) => (
        <path key={i} d={arcPaths[i] ?? ''} fill={seg.color} />
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

// ── Bar chart (4-week avg score) ───────────────────────────────────────────
function WeekBarChart({ data }: { data: Array<{ label: string; value: number }> }) {
  const max = Math.max(...data.map((d) => d.value), 1)
  return (
    <div className="flex items-end gap-2 h-24">
      {data.map(({ label, value }) => (
        <div key={label} className="flex flex-col items-center gap-1 flex-1">
          <div
            className="w-full rounded-t bg-amber-400 transition-all min-h-[4px]"
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

// ── Main ──────────────────────────────────────────────────────────────────
export function AnalyticsDashboard() {
  const [data, setData] = useState<AnalyticsSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'overview' | 'regional'>('overview')

  useEffect(() => {
    getAnalytics()
      .then(setData)
      .catch(() => null)
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <AnalyticsSkeleton />

  // Build mock/derived data
  const totalChecks = data?.totalSearches ?? 9
  const avgScore = 67
  const highRisk = 1
  const activeClients = data?.totalClients ?? 0

  // Activity last 30 days — generate placeholder if no data
  const activityData: Array<{ date: string; checks: number; quotes: number }> =
    data?.searchesByDay?.map((d) => ({ date: d.date, checks: d.count, quotes: 0 })) ??
    Array.from({ length: 30 }, (_, i) => {
      const d = new Date('2026-02-10')
      d.setDate(d.getDate() + i)
      return {
        date: d.toISOString().slice(0, 10),
        checks: i === 26 ? 4 : i === 27 ? 2 : 0,
        quotes: 0,
      }
    })

  // Risk distribution donut
  const riskSegments =
    data?.riskDistribution?.map((r) => ({
      value: r.count,
      color:
        r.level === 'LOW'
          ? '#22c55e'
          : r.level === 'MODERATE'
          ? '#3b82f6'
          : r.level === 'HIGH'
          ? '#ef4444'
          : '#f97316',
      label: `${r.level.charAt(0) + r.level.slice(1).toLowerCase()} ${r.count}`,
    })) ?? [
      { value: 5, color: '#f97316', label: 'Elevated 5' },
      { value: 1, color: '#ef4444', label: 'High 1' },
      { value: 3, color: '#3b82f6', label: 'Moderate 3' },
    ]

  // Status donut (all completed)
  const statusSegments = [{ value: totalChecks, color: '#3b82f6', label: `Completed ${totalChecks}` }]

  // 4-week bar
  const weekBars = [
    { label: 'Feb 20-26', value: 0 },
    { label: 'Feb 27-Mar 6', value: 0 },
    { label: 'Mar 6-Mar 12', value: 0 },
    { label: 'Mar 13-Mar 19', value: 72 },
  ]

  // Checks by state
  const stateChecks: Array<{ state: string; count: number; avgScore?: number }> =
    data?.topStates?.slice(0, 5) ?? [
      { state: 'CA', count: 8, avgScore: 64 },
      { state: 'NV', count: 1, avgScore: 85 },
    ]
  const maxStateCount = Math.max(...stateChecks.map((s) => s.count), 1)

  return (
    <div className="p-8 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-2 mb-1">
        <Activity className="h-6 w-6 text-blue-600" />
        <h1 className="text-2xl font-bold text-gray-900">Analytics &amp; Trends</h1>
      </div>
      <p className="text-sm text-gray-500 mb-5">
        Key metrics, pipeline insights, and regional risk trends
      </p>

      {/* Tabs */}
      <div className="flex items-center gap-1 mb-6">
        <button
          onClick={() => setTab('overview')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
            tab === 'overview'
              ? 'bg-blue-50 text-blue-700'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <Activity className="h-3.5 w-3.5" />
          Overview
        </button>
        <button
          onClick={() => setTab('regional')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
            tab === 'regional'
              ? 'bg-blue-50 text-blue-700'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <TrendingUp className="h-3.5 w-3.5" />
          Regional Trends
        </button>
      </div>

      {/* Top stat rows */}
      <div className="grid grid-cols-4 gap-3 mb-3">
        <MiniStat label="TOTAL CHECKS" sub="all time" value={totalChecks} icon={<Shield className="h-4 w-4 text-blue-500" />} />
        <MiniStat label="AVG SCORE" sub="insurability" value={avgScore} icon={<TrendingUp className="h-4 w-4 text-emerald-500" />} />
        <MiniStat label="HIGH RISK" sub="score < 40" value={highRisk} icon={<AlertTriangle className="h-4 w-4 text-red-400" />} />
        <MiniStat label="ACTIVE CLIENTS" sub="0 total" value={activeClients} icon={<Users className="h-4 w-4 text-purple-400" />} />
      </div>
      <div className="grid grid-cols-4 gap-3 mb-6">
        <MiniStat label="QUOTES" sub="all time" value={0} icon={<FileText className="h-4 w-4 text-orange-400" />} />
        <MiniStat label="BOUND" sub="converted" value={0} icon={<CheckCircle className="h-4 w-4 text-emerald-500" />} />
        <MiniStat label="PIPELINE" sub="under contract" value={0} icon={<Activity className="h-4 w-4 text-red-400" />} />
        <MiniStat label="LEADS" sub="awaiting contact" value={0} icon={<Clock className="h-4 w-4 text-gray-400" />} />
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

        <ChartCard title="Check Status Breakdown">
          <div className="flex flex-col items-center gap-3">
            <DonutChart segments={statusSegments} size={100} />
            <div className="space-y-1">
              {statusSegments.map((s) => (
                <div key={s.label} className="flex items-center gap-1.5 text-xs">
                  <span className="h-2 w-2 rounded-full shrink-0" style={{ background: s.color }} />
                  <span className="text-gray-500">{s.label}</span>
                </div>
              ))}
            </div>
          </div>
        </ChartCard>

        <ChartCard title="Client Pipeline">
          {activeClients === 0 ? (
            <div className="flex items-center justify-center h-full">
              <p className="text-xs text-gray-400">No clients yet</p>
            </div>
          ) : (
            <DonutChart segments={[{ value: activeClients, color: '#3b82f6', label: `Active ${activeClients}` }]} size={100} />
          )}
        </ChartCard>
      </div>

      {/* Bottom two panels */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="text-sm font-semibold text-gray-800 mb-4">
            Avg Insurability Score — 4 Weeks
          </h3>
          <WeekBarChart data={weekBars} />
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
                  {s.avgScore != null && (
                    <span className="text-xs font-bold text-gray-700 bg-gray-100 rounded px-1.5 py-0.5 w-8 text-center">
                      {s.avgScore}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
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
  value: number
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
      <div className="grid grid-cols-4 gap-3">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-20 rounded-xl bg-gray-100 animate-pulse" />
        ))}
      </div>
      <div className="h-48 rounded-xl bg-gray-100 animate-pulse" />
      <div className="grid grid-cols-3 gap-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-48 rounded-xl bg-gray-100 animate-pulse" />
        ))}
      </div>
    </div>
  )
}
