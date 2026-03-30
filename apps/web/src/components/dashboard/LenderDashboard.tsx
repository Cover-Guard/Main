'use client'

import { useEffect, useState, useMemo } from 'react'
import Link from 'next/link'
import {
  Building2,
  AlertTriangle,
  TrendingUp,
  DollarSign,
  ShieldCheck,
  ArrowUpDown,
  ChevronUp,
  ChevronDown,
} from 'lucide-react'
import { getLenderPortfolio, getLenderProperties } from '@/lib/api'
import type { LenderPortfolioSummary, LenderPropertyRow } from '@coverguard/shared'

// ── Formatters ───────────────────────────────────────────────────────────────

function fmt$(value: number | null): string {
  if (value == null) return '—'
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value)
}

function fmtNum(value: number | null): string {
  if (value == null) return '—'
  return new Intl.NumberFormat('en-US').format(value)
}

// ── Donut Chart ──────────────────────────────────────────────────────────────

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

// ── Bar Chart ────────────────────────────────────────────────────────────────

function RiskBarChart({ data }: { data: Array<{ label: string; value: number; color: string }> }) {
  const max = Math.max(...data.map((d) => d.value), 1)
  return (
    <div className="flex items-end gap-3 h-36">
      {data.map(({ label, value, color }) => (
        <div key={label} className="flex flex-col items-center gap-1 flex-1">
          <span className="text-xs font-medium text-gray-700">{value}</span>
          <div
            className="w-full rounded-t transition-all min-h-[4px]"
            style={{ height: `${(value / max) * 100}%`, backgroundColor: color }}
          />
          <span className="text-[10px] text-gray-500">{label}</span>
        </div>
      ))}
    </div>
  )
}

// ── Stat Card ────────────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  icon,
}: {
  label: string
  value: string | number
  icon: React.ReactNode
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
            {label}
          </p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{value}</p>
        </div>
        <div className="mt-0.5">{icon}</div>
      </div>
    </div>
  )
}

// ── Eligibility badge ────────────────────────────────────────────────────────

const ELIGIBILITY_STYLES: Record<string, string> = {
  ELIGIBLE: 'bg-green-100 text-green-700',
  CONDITIONAL: 'bg-yellow-100 text-yellow-700',
  INELIGIBLE: 'bg-red-100 text-red-700',
}

function EligibilityBadge({ status }: { status: string }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
        ELIGIBILITY_STYLES[status] ?? 'bg-gray-100 text-gray-600'
      }`}
    >
      {status.charAt(0) + status.slice(1).toLowerCase()}
    </span>
  )
}

// ── Risk level badge ─────────────────────────────────────────────────────────

const RISK_STYLES: Record<string, string> = {
  LOW: 'text-green-700',
  MODERATE: 'text-blue-700',
  HIGH: 'text-orange-700',
  VERY_HIGH: 'text-red-700',
  EXTREME: 'text-purple-700',
}

// ── Sort helpers ─────────────────────────────────────────────────────────────

type SortKey = 'address' | 'state' | 'riskScore' | 'riskLevel' | 'floodZone' | 'eligibility' | 'value'
type SortDir = 'asc' | 'desc'

function SortHeader({
  label,
  sortKeyVal,
  currentSortKey,
  currentSortDir,
  onSort,
}: {
  label: string
  sortKeyVal: SortKey
  currentSortKey: SortKey
  currentSortDir: SortDir
  onSort: (key: SortKey) => void
}) {
  return (
    <button
      onClick={() => onSort(sortKeyVal)}
      className="flex items-center gap-1 text-[11px] font-semibold text-gray-500 uppercase tracking-wider hover:text-gray-700"
    >
      {label}
      {currentSortKey === sortKeyVal ? (
        currentSortDir === 'asc' ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />
      ) : (
        <ArrowUpDown className="h-3 w-3 opacity-40" />
      )}
    </button>
  )
}

function compareRows(a: LenderPropertyRow, b: LenderPropertyRow, key: SortKey): number {
  switch (key) {
    case 'address':
      return a.address.localeCompare(b.address)
    case 'state':
      return a.state.localeCompare(b.state)
    case 'riskScore':
      return (a.overallRiskScore ?? 0) - (b.overallRiskScore ?? 0)
    case 'riskLevel':
      return (a.overallRiskLevel ?? '').localeCompare(b.overallRiskLevel ?? '')
    case 'floodZone':
      return (a.floodZone ?? '').localeCompare(b.floodZone ?? '')
    case 'eligibility': {
      const order = { ELIGIBLE: 0, CONDITIONAL: 1, INELIGIBLE: 2 }
      return (order[a.loanEligibility] ?? 3) - (order[b.loanEligibility] ?? 3)
    }
    case 'value':
      return (a.estimatedValue ?? 0) - (b.estimatedValue ?? 0)
    default:
      return 0
  }
}

// ── Main Component ───────────────────────────────────────────────────────────

export function LenderDashboard() {
  const [portfolio, setPortfolio] = useState<LenderPortfolioSummary | null>(null)
  const [properties, setProperties] = useState<LenderPropertyRow[]>([])
  const [loading, setLoading] = useState(true)
  const [errors, setErrors] = useState<string[]>([])
  const [sortKey, setSortKey] = useState<SortKey>('riskScore')
  const [sortDir, setSortDir] = useState<SortDir>('desc')

  useEffect(() => {
    Promise.allSettled([getLenderPortfolio(), getLenderProperties()])
      .then(([portfolioResult, propsResult]) => {
        const errs: string[] = []
        if (portfolioResult.status === 'fulfilled') {
          setPortfolio(portfolioResult.value)
        } else {
          errs.push('Portfolio: ' + (portfolioResult.reason instanceof Error ? portfolioResult.reason.message : 'Failed to load'))
        }
        if (propsResult.status === 'fulfilled') {
          setProperties(propsResult.value)
        } else {
          errs.push('Properties: ' + (propsResult.reason instanceof Error ? propsResult.reason.message : 'Failed to load'))
        }
        if (errs.length > 0) setErrors(errs)
      })
      .finally(() => setLoading(false))
  }, [])

  const sortedProperties = useMemo(() => {
    const sorted = [...properties].sort((a, b) => compareRows(a, b, sortKey))
    return sortDir === 'desc' ? sorted.reverse() : sorted
  }, [properties, sortKey, sortDir])

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(key)
      setSortDir('desc')
    }
  }

  // Chart data
  const RISK_COLORS: Record<string, string> = {
    LOW: '#22c55e',
    MODERATE: '#3b82f6',
    HIGH: '#f97316',
    VERY_HIGH: '#ef4444',
    EXTREME: '#7c3aed',
  }

  const riskBarData = (portfolio?.riskDistribution ?? []).map((r) => ({
    label: r.level.charAt(0) + r.level.slice(1).toLowerCase().replace('_', ' '),
    value: r.count,
    color: RISK_COLORS[r.level] ?? '#94a3b8',
  }))

  const eligibilitySegments = portfolio
    ? [
        { value: portfolio.loanEligibility.eligible, color: '#22c55e', label: `Eligible (${portfolio.loanEligibility.eligible})` },
        { value: portfolio.loanEligibility.conditional, color: '#eab308', label: `Conditional (${portfolio.loanEligibility.conditional})` },
        { value: portfolio.loanEligibility.ineligible, color: '#ef4444', label: `Ineligible (${portfolio.loanEligibility.ineligible})` },
      ]
    : []

  if (loading) {
    return (
      <div className="p-8 max-w-6xl mx-auto space-y-6">
        <div className="h-8 w-64 bg-gray-100 rounded animate-pulse" />
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-24 bg-gray-100 rounded-xl animate-pulse" />
          ))}
        </div>
        <div className="grid grid-cols-2 gap-4">
          {[1, 2].map((i) => (
            <div key={i} className="h-52 bg-gray-100 rounded-xl animate-pulse" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="p-8 max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Lender Risk Review</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Portfolio risk overview and loan eligibility assessment
        </p>
      </div>

      {/* Error banner */}
      {errors.length > 0 && (
        <div className="mb-5 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
          <div className="flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
            <div className="flex-1 text-sm text-amber-800">
              <p className="font-medium mb-1">Some data failed to load</p>
              {errors.map((e, i) => (
                <p key={i} className="text-amber-700 text-xs">{e}</p>
              ))}
            </div>
            <button onClick={() => setErrors([])} className="text-amber-400 hover:text-amber-600 text-xs font-medium shrink-0">
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
        <StatCard
          label="TOTAL PROPERTIES"
          value={fmtNum(portfolio?.totalProperties ?? 0)}
          icon={<Building2 className="h-5 w-5 text-blue-500" />}
        />
        <StatCard
          label="AVG RISK SCORE"
          value={portfolio?.avgRiskScore ?? '—'}
          icon={<TrendingUp className="h-5 w-5 text-orange-500" />}
        />
        <StatCard
          label="HIGH RISK"
          value={fmtNum(portfolio?.highRiskCount ?? 0)}
          icon={<AlertTriangle className="h-5 w-5 text-red-400" />}
        />
        <StatCard
          label="TOTAL EST. VALUE"
          value={fmt$(portfolio?.totalEstimatedValue ?? 0)}
          icon={<DollarSign className="h-5 w-5 text-green-500" />}
        />
        <StatCard
          label="AVG INSURANCE COST"
          value={fmt$(portfolio?.avgInsuranceCost ?? null)}
          icon={<ShieldCheck className="h-5 w-5 text-purple-500" />}
        />
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="text-sm font-semibold text-gray-800 mb-4">Loan Eligibility</h3>
          <DonutChart segments={eligibilitySegments} />
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="text-sm font-semibold text-gray-800 mb-4">Risk Distribution</h3>
          {riskBarData.length > 0 ? (
            <RiskBarChart data={riskBarData} />
          ) : (
            <div className="flex items-center justify-center h-36 text-sm text-gray-400">
              No risk data yet
            </div>
          )}
        </div>
      </div>

      {/* Properties table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100">
          <h3 className="text-sm font-semibold text-gray-800">Properties</h3>
        </div>

        {sortedProperties.length === 0 ? (
          <div className="py-12 text-center text-gray-400">
            <Building2 className="mx-auto mb-3 h-10 w-10 opacity-30" />
            <p className="font-medium">No properties in portfolio</p>
            <p className="mt-1 text-sm">Save properties to see them in your lender review.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left px-4 py-3">
                    <SortHeader label="Address" sortKeyVal="address" currentSortKey={sortKey} currentSortDir={sortDir} onSort={handleSort} />
                  </th>
                  <th className="text-left px-4 py-3">
                    <SortHeader label="State" sortKeyVal="state" currentSortKey={sortKey} currentSortDir={sortDir} onSort={handleSort} />
                  </th>
                  <th className="text-left px-4 py-3">
                    <SortHeader label="Risk Score" sortKeyVal="riskScore" currentSortKey={sortKey} currentSortDir={sortDir} onSort={handleSort} />
                  </th>
                  <th className="text-left px-4 py-3">
                    <SortHeader label="Risk Level" sortKeyVal="riskLevel" currentSortKey={sortKey} currentSortDir={sortDir} onSort={handleSort} />
                  </th>
                  <th className="text-left px-4 py-3">
                    <SortHeader label="Flood Zone" sortKeyVal="floodZone" currentSortKey={sortKey} currentSortDir={sortDir} onSort={handleSort} />
                  </th>
                  <th className="text-center px-4 py-3">
                    <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">SFHA</span>
                  </th>
                  <th className="text-left px-4 py-3">
                    <SortHeader label="Eligibility" sortKeyVal="eligibility" currentSortKey={sortKey} currentSortDir={sortDir} onSort={handleSort} />
                  </th>
                  <th className="text-right px-4 py-3">
                    <SortHeader label="Est. Value" sortKeyVal="value" currentSortKey={sortKey} currentSortDir={sortDir} onSort={handleSort} />
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {sortedProperties.map((row) => (
                  <tr key={row.propertyId} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3">
                      <Link
                        href={`/properties/${row.propertyId}`}
                        className="text-sm font-medium text-blue-600 hover:underline"
                      >
                        {row.address}
                      </Link>
                      <p className="text-xs text-gray-400">{row.city}, {row.state} {row.zip}</p>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700">{row.state}</td>
                    <td className="px-4 py-3">
                      <span className="text-sm font-semibold text-gray-900">
                        {row.overallRiskScore ?? '—'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-sm font-medium ${RISK_STYLES[row.overallRiskLevel ?? ''] ?? 'text-gray-500'}`}>
                        {row.overallRiskLevel
                          ? row.overallRiskLevel.charAt(0) + row.overallRiskLevel.slice(1).toLowerCase().replace('_', ' ')
                          : '—'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700">{row.floodZone ?? '—'}</td>
                    <td className="px-4 py-3 text-center">
                      {row.inSFHA ? (
                        <span className="inline-flex items-center rounded-full bg-red-100 text-red-700 px-2 py-0.5 text-[11px] font-semibold">
                          Yes
                        </span>
                      ) : (
                        <span className="text-xs text-gray-400">No</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <EligibilityBadge status={row.loanEligibility} />
                    </td>
                    <td className="px-4 py-3 text-right text-sm text-gray-700">
                      {fmt$(row.estimatedValue)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
