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
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      {fracs.map(([start, end], i) => (
        <path key={i} d={arc(start, end)} fill={segments[i]!.color} />
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
        const x = pad + (i / Math.max(data.length - 1, 1)) * (W - 2 * pad)
        const y = H - pad - ((d[key] ?? 0) / maxVal) * (H - 2 * pad)
        return `${x},${y}`
      })
      .join(' ')
  }

  const step = Math.max(Math.floor(data.length / 4), 1)
  const xLabels = [0, step, step * 2, step * 3, data.length - 1]
    .filter((i, pos, arr) => arr.indexOf(i) === pos && i < data.length)
    .map((i) => ({ idx: i, d: data[i] }))

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
        {xLabels.map(({ idx, d }) => {
          const x = pad + (idx / Math.max(data.length - 1, 1)) * (W - 2 * pad)
          return (
            <text key={idx} x={x} y={H + 14} textAnchor="middle" fontSize="10" fill="#9ca3af">
              {d.date.slice(5)}
            </text>
          )
        })}
      </svg>
      <div className="mt-1 flex items-center gap-4 text-xs text-gray-500">
        <div className="flex items-center gap-1.5">
          <span className="inline-block h-0.5 w-5 bg-blue-500" />
          Checks
        </div>
        <div className="flex items-center gap-1.5">
          <span className="inline-block h-0.5 w-5 bg-emerald-500" />
          Quotes
        </div>
      </div>
    </div>
  )
}

// ── Bar chart (4-week avg search count) ────────────────────────────────────
function WeekBarChart({ data }: { data: Array<{ label: string; value: number }> }) {
  const max = Math.max(...data.map((d) => d.value), 1)
  return (
    <div className="flex h-24 items-end gap-2">
      {data.map(({ label, value }) => (
        <div key={label} className="flex flex-1 flex-col items-center gap-1">
          <span className="text-[10px] font-semibold text-gray-600">{value || ''}</span>
          <div
            className="w-full rounded-t bg-amber-400 transition-all"
            style={{ height: `${Math.max((value / max) * 100, value > 0 ? 4 : 0)}%`, minHeight: value > 0 ? 4 : 0 }}
          />
          <span className="w-full truncate text-center text-[9px] text-gray-500">{label}</span>
        </div>
      ))}
    </div>
  )
}

// ── Helpers ─────────────────────────────────────────────────────────────────

const LEVEL_MIDPOINT: Record<string, number> = {
  LOW: 15, MODERATE: 38, HIGH: 60, VERY_HIGH: 80, EXTREME: 95,
}

function computeAvgScore(dist: Array<{ level: string; count: number }>): number {
  const total = dist.reduce((s, r) => s + r.count, 0)
  if (!total) return 0
  const weighted = dist.reduce((s, r) => s + (LEVEL_MIDPOINT[r.level] ?? 50) * r.count, 0)
  return Math.round(weighted / total)
}

function buildWeekBars(searchesByDay: Array<{ date: string; count: number }>): Array<{ label: string; value: number }> {
  // Build 4 complete-week buckets ending today
  const today = new Date()
  const buckets: Array<{ label: string; start: Date; end: Date; value: number }> = []
  for (let w = 3; w >= 0; w--) {
    const end   = new Date(today)
    end.setDate(today.getDate() - w * 7)
    const start = new Date(end)
    start.setDate(end.getDate() - 6)
    const label = `${(start.getMonth() + 1).toString().padStart(2, '0')}/${start.getDate().toString().padStart(2, '0')}–${(end.getMonth() + 1).toString().padStart(2, '0')}/${end.getDate().toString().padStart(2, '0')}`
    buckets.push({ label, start, end, value: 0 })
  }

  for (const { date, count } of searchesByDay) {
    const d = new Date(date)
    for (const b of buckets) {
      if (d >= b.start && d <= b.end) {
        b.value += count
        break
      }
    }
  }

  return buckets.map(({ label, value }) => ({ label, value }))
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

  const totalChecks    = data?.totalSearches ?? 0
  const activeClients  = data?.totalClients ?? 0
  const totalReports   = data?.totalReports ?? 0
  const dist           = data?.riskDistribution ?? []
  const avgScore       = dist.length ? computeAvgScore(dist) : 0
  const highRisk       = dist
    .filter((r) => ['HIGH', 'VERY_HIGH', 'EXTREME'].includes(r.level))
    .reduce((s, r) => s + r.count, 0)

  // Activity last 30 days
  const activityData: Array<{ date: string; checks: number; quotes: number }> =
    data?.searchesByDay?.map((d) => ({ date: d.date, checks: d.count, quotes: 0 })) ?? []

  // Risk distribution donut
  const riskSegments = dist.length
    ? dist.map((r) => ({
        value: r.count,
        color:
          r.level === 'LOW'       ? '#22c55e' :
          r.level === 'MODERATE'  ? '#3b82f6' :
          r.level === 'HIGH'      ? '#f97316' :
          r.level === 'VERY_HIGH' ? '#ef4444' : '#7f1d1d',
        label: `${r.level.replace('_', ' ')} (${r.count})`,
      }))
    : [{ value: 1, color: '#e5e7eb', label: 'No data' }]

  // Status donut
  const statusSegments = totalChecks > 0
    ? [{ value: totalChecks, color: '#3b82f6', label: `Completed ${totalChecks}` }]
    : [{ value: 1, color: '#e5e7eb', label: 'No checks yet' }]

  // 4-week bar
  const weekBars = buildWeekBars(data?.searchesByDay ?? [])

  // Checks by state
  const stateChecks = data?.topStates?.slice(0, 5) ?? []
  const maxStateCount = Math.max(...stateChecks.map((s) => s.count), 1)

  return (
    <div className="mx-auto max-w-5xl p-8">
      {/* Header */}
      <div className="mb-1 flex items-center gap-2">
        <Activity className="h-6 w-6 text-blue-600" />
        <h1 className="text-2xl font-bold text-gray-900">Analytics &amp; Trends</h1>
      </div>
      <p className="mb-5 text-sm text-gray-500">
        Key metrics, pipeline insights, and regional risk trends
      </p>

      {/* Tabs */}
      <div className="mb-6 flex items-center gap-1">
        <button
          onClick={() => setTab('overview')}
          className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
            tab === 'overview' ? 'bg-blue-50 text-blue-700' : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <Activity className="h-3.5 w-3.5" />
          Overview
        </button>
        <button
          onClick={() => setTab('regional')}
          className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
            tab === 'regional' ? 'bg-blue-50 text-blue-700' : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <TrendingUp className="h-3.5 w-3.5" />
          Regional Trends
        </button>
      </div>

      {/* Top stat rows */}
      <div className="mb-3 grid grid-cols-4 gap-3">
        <MiniStat label="TOTAL CHECKS"   sub="all time"     value={totalChecks}   icon={<Shield       className="h-4 w-4 text-blue-500"   />} />
        <MiniStat label="AVG RISK SCORE" sub="across saved" value={avgScore || '—'} icon={<TrendingUp  className="h-4 w-4 text-emerald-500" />} />
        <MiniStat label="HIGH RISK"      sub="HIGH or above" value={highRisk}      icon={<AlertTriangle className="h-4 w-4 text-red-400"    />} />
        <MiniStat label="ACTIVE CLIENTS" sub="total"        value={activeClients}  icon={<Users        className="h-4 w-4 text-purple-400"  />} />
      </div>
      <div className="mb-6 grid grid-cols-4 gap-3">
        <MiniStat label="QUOTES"   sub="all time"        value={0} icon={<FileText     className="h-4 w-4 text-orange-400" />} />
        <MiniStat label="BOUND"    sub="converted"       value={0} icon={<CheckCircle  className="h-4 w-4 text-emerald-500" />} />
        <MiniStat label="PIPELINE" sub="under contract"  value={0} icon={<Activity     className="h-4 w-4 text-red-400"    />} />
        <MiniStat label="REPORTS"  sub="generated"       value={totalReports} icon={<Clock className="h-4 w-4 text-gray-400" />} />
      </div>

      {/* Activity line chart */}
      <div className="mb-4 rounded-xl border border-gray-200 bg-white p-5">
        <div className="mb-3 flex items-center gap-2">
          <Activity className="h-4 w-4 text-emerald-500" />
          <h3 className="text-sm font-semibold text-gray-800">Activity — Last 30 Days</h3>
        </div>
        {activityData.length > 0 ? (
          <LineChart data={activityData} />
        ) : (
          <p className="py-4 text-center text-sm text-gray-400">No activity yet</p>
        )}
      </div>

      {/* Three donut charts */}
      <div className="mb-4 grid grid-cols-3 gap-4">
        <ChartCard title="Risk Level Distribution">
          <div className="flex flex-col items-center gap-3">
            <DonutChart segments={riskSegments} size={100} />
            <div className="space-y-1">
              {dist.map((r) => (
                <div key={r.level} className="flex items-center gap-1.5 text-xs">
                  <span
                    className="h-2 w-2 shrink-0 rounded-full"
                    style={{
                      background:
                        r.level === 'LOW'       ? '#22c55e' :
                        r.level === 'MODERATE'  ? '#3b82f6' :
                        r.level === 'HIGH'      ? '#f97316' :
                        r.level === 'VERY_HIGH' ? '#ef4444' : '#7f1d1d',
                    }}
                  />
                  <span className="text-gray-500">{r.level.replace('_', ' ')} ({r.count})</span>
                </div>
              ))}
              {dist.length === 0 && <p className="text-xs text-gray-400">No data yet</p>}
            </div>
          </div>
        </ChartCard>

        <ChartCard title="Check Status Breakdown">
          <div className="flex flex-col items-center gap-3">
            <DonutChart segments={statusSegments} size={100} />
            <div className="space-y-1">
              {statusSegments.map((s) => (
                <div key={s.label} className="flex items-center gap-1.5 text-xs">
                  <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: s.color }} />
                  <span className="text-gray-500">{s.label}</span>
                </div>
              ))}
            </div>
          </div>
        </ChartCard>

        <ChartCard title="Client Pipeline">
          {activeClients === 0 ? (
            <div className="flex h-full items-center justify-center">
              <p className="text-xs text-gray-400">No clients yet</p>
            </div>
          ) : (
            <DonutChart
              segments={[{ value: activeClients, color: '#3b82f6', label: `Active ${activeClients}` }]}
              size={100}
            />
          )}
        </ChartCard>
      </div>

      {/* Bottom two panels */}
      <div className="grid grid-cols-2 gap-4">
        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <h3 className="mb-4 text-sm font-semibold text-gray-800">Property Checks — 4 Weeks</h3>
          <WeekBarChart data={weekBars} />
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <h3 className="mb-4 text-sm font-semibold text-gray-800">Checks by State</h3>
          {stateChecks.length === 0 ? (
            <p className="text-sm text-gray-400">No data yet.</p>
          ) : (
            <div className="space-y-3">
              {stateChecks.map((s, i) => (
                <div key={s.state} className="flex items-center gap-3">
                  <span className="w-4 text-xs text-gray-400">{i + 1}</span>
                  <span className="w-6 text-xs font-semibold text-gray-700">{s.state}</span>
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-gray-100">
                    <div
                      className="h-2 rounded-full bg-emerald-400"
                      style={{ width: `${(s.count / maxStateCount) * 100}%` }}
                    />
                  </div>
                  <span className="w-6 text-right text-xs text-gray-400">{s.count}</span>
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
  value: number | string
  icon: React.ReactNode
}) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">{label}</p>
          <p className="mt-0.5 text-2xl font-bold text-gray-900">{value}</p>
          <p className="mt-0.5 text-[10px] text-gray-400">{sub}</p>
        </div>
        <div>{icon}</div>
      </div>
    </div>
  )
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5">
      <h3 className="mb-3 text-xs font-semibold text-gray-600">{title}</h3>
      <div className="flex flex-col items-center">{children}</div>
    </div>
  )
}

function AnalyticsSkeleton() {
  return (
    <div className="mx-auto max-w-5xl space-y-4 p-8">
      <div className="grid grid-cols-4 gap-3">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-20 animate-pulse rounded-xl bg-gray-100" />
        ))}
      </div>
      <div className="h-48 animate-pulse rounded-xl bg-gray-100" />
      <div className="grid grid-cols-3 gap-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-48 animate-pulse rounded-xl bg-gray-100" />
        ))}
      </div>
    </div>
  )
}
