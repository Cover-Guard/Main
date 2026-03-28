'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import {
  Building2,
  DollarSign,
  AlertTriangle,
  TrendingUp,
  Shield,
  MapPin,
  ArrowRight,
  BarChart3,
} from 'lucide-react'
import { getPortfolioSummary } from '@/lib/api'
import type { LenderPortfolioSummary } from '@coverguard/shared'

function formatCurrency(value: number): string {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`
  if (value >= 1_000) return `$${(value / 1_000).toFixed(0)}K`
  return `$${value.toLocaleString()}`
}

function riskColor(score: number): string {
  if (score <= 25) return 'text-green-600'
  if (score <= 50) return 'text-yellow-600'
  if (score <= 70) return 'text-orange-600'
  return 'text-red-600'
}

function riskBgColor(level: string): string {
  return {
    LOW: 'bg-green-100 text-green-800',
    MODERATE: 'bg-yellow-100 text-yellow-800',
    HIGH: 'bg-orange-100 text-orange-800',
    VERY_HIGH: 'bg-red-100 text-red-800',
    EXTREME: 'bg-red-200 text-red-900',
  }[level] ?? 'bg-gray-100 text-gray-800'
}

// ── Horizontal bar chart ──────────────────────────────────────────────────
function HorizontalBar({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  const pct = max > 0 ? (value / max) * 100 : 0
  return (
    <div className="flex items-center gap-3">
      <span className="text-xs text-gray-600 w-24 text-right shrink-0">{label}</span>
      <div className="flex-1 h-5 bg-gray-100 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${color}`}
          style={{ width: `${Math.max(pct, 2)}%` }}
        />
      </div>
      <span className="text-xs font-medium text-gray-700 w-8">{Math.round(value)}</span>
    </div>
  )
}

export function LenderPortfolioDashboard() {
  const [portfolio, setPortfolio] = useState<LenderPortfolioSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getPortfolioSummary()
      .then(setPortfolio)
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load portfolio'))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="p-8 max-w-5xl mx-auto space-y-4">
        <div className="h-8 w-64 bg-gray-200 rounded animate-pulse" />
        <div className="grid grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-24 bg-gray-100 rounded-xl animate-pulse" />
          ))}
        </div>
        <div className="grid grid-cols-2 gap-4">
          {[1, 2].map((i) => (
            <div key={i} className="h-56 bg-gray-100 rounded-xl animate-pulse" />
          ))}
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-8 max-w-5xl mx-auto">
        <div className="rounded-xl bg-red-50 border border-red-200 p-6 text-center">
          <AlertTriangle className="mx-auto h-8 w-8 text-red-400 mb-2" />
          <p className="text-sm text-red-700">{error}</p>
        </div>
      </div>
    )
  }

  if (!portfolio) return null

  const { riskByPeril } = portfolio
  const maxPerilScore = Math.max(
    riskByPeril.avgFloodScore,
    riskByPeril.avgFireScore,
    riskByPeril.avgWindScore,
    riskByPeril.avgEarthquakeScore,
    riskByPeril.avgCrimeScore,
    1,
  )

  return (
    <div className="p-8 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Portfolio Risk Dashboard</h1>
          <p className="text-sm text-blue-600 mt-0.5">
            Aggregate risk exposure across your saved properties
          </p>
        </div>
        <Link
          href="/search"
          className="flex items-center gap-1.5 bg-gray-900 hover:bg-gray-800 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors"
        >
          <Building2 className="h-4 w-4" />
          Add Property
        </Link>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <KPICard
          label="PORTFOLIO SIZE"
          value={portfolio.totalProperties}
          icon={<Building2 className="h-5 w-5 text-blue-500" />}
        />
        <KPICard
          label="TOTAL EXPOSURE"
          value={formatCurrency(portfolio.totalEstimatedValue)}
          icon={<DollarSign className="h-5 w-5 text-green-500" />}
        />
        <KPICard
          label="AVG RISK SCORE"
          value={Math.round(portfolio.avgOverallRiskScore)}
          valueClass={riskColor(portfolio.avgOverallRiskScore)}
          icon={<Shield className="h-5 w-5 text-orange-500" />}
        />
        <KPICard
          label="AVG INSURANCE"
          value={portfolio.avgInsuranceCost ? formatCurrency(portfolio.avgInsuranceCost) + '/yr' : 'N/A'}
          icon={<TrendingUp className="h-5 w-5 text-purple-500" />}
        />
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        {/* Risk by peril */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center gap-2 mb-4">
            <BarChart3 className="h-4 w-4 text-blue-500" />
            <h3 className="text-sm font-semibold text-gray-800">Avg Risk Score by Peril</h3>
          </div>
          <div className="space-y-2.5">
            <HorizontalBar label="Flood" value={riskByPeril.avgFloodScore} max={maxPerilScore} color="bg-blue-400" />
            <HorizontalBar label="Fire" value={riskByPeril.avgFireScore} max={maxPerilScore} color="bg-red-400" />
            <HorizontalBar label="Wind" value={riskByPeril.avgWindScore} max={maxPerilScore} color="bg-cyan-400" />
            <HorizontalBar label="Earthquake" value={riskByPeril.avgEarthquakeScore} max={maxPerilScore} color="bg-amber-400" />
            <HorizontalBar label="Crime" value={riskByPeril.avgCrimeScore} max={maxPerilScore} color="bg-purple-400" />
          </div>
        </div>

        {/* Risk distribution */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="text-sm font-semibold text-gray-800 mb-4">Risk Level Distribution</h3>
          {portfolio.riskDistribution.length === 0 ? (
            <div className="py-8 text-center text-sm text-gray-400">No risk data available</div>
          ) : (
            <div className="space-y-2">
              {portfolio.riskDistribution.map((r) => {
                const total = portfolio.riskDistribution.reduce((s, x) => s + x.count, 0)
                const pct = total > 0 ? (r.count / total) * 100 : 0
                return (
                  <div key={r.level} className="flex items-center gap-3">
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded ${riskBgColor(r.level)}`}>
                      {r.level}
                    </span>
                    <div className="flex-1 h-4 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${
                          r.level === 'LOW' ? 'bg-green-400' :
                          r.level === 'MODERATE' ? 'bg-yellow-400' :
                          r.level === 'HIGH' ? 'bg-orange-400' :
                          'bg-red-500'
                        }`}
                        style={{ width: `${Math.max(pct, 3)}%` }}
                      />
                    </div>
                    <span className="text-xs text-gray-600 w-8 text-right">{r.count}</span>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* State exposure */}
      {portfolio.stateExposure.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-5 mb-6">
          <div className="flex items-center gap-2 mb-4">
            <MapPin className="h-4 w-4 text-emerald-500" />
            <h3 className="text-sm font-semibold text-gray-800">Geographic Exposure</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide border-b border-gray-100">
                  <th className="text-left py-2 pr-4">State</th>
                  <th className="text-right py-2 px-4">Properties</th>
                  <th className="text-right py-2 px-4">Total Value</th>
                  <th className="text-right py-2 pl-4">Avg Risk</th>
                </tr>
              </thead>
              <tbody>
                {portfolio.stateExposure.map((s) => (
                  <tr key={s.state} className="border-b border-gray-50 last:border-0">
                    <td className="py-2 pr-4 font-medium text-gray-900">{s.state}</td>
                    <td className="py-2 px-4 text-right text-gray-600">{s.count}</td>
                    <td className="py-2 px-4 text-right text-gray-600">{formatCurrency(s.totalValue)}</td>
                    <td className={`py-2 pl-4 text-right font-semibold ${riskColor(s.avgRiskScore)}`}>
                      {Math.round(s.avgRiskScore)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* High risk properties */}
      {portfolio.highRiskProperties.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center gap-2 mb-4">
            <AlertTriangle className="h-4 w-4 text-red-500" />
            <h3 className="text-sm font-semibold text-gray-800">
              High-Risk Properties ({portfolio.highRiskProperties.length})
            </h3>
          </div>
          <div className="divide-y divide-gray-50">
            {portfolio.highRiskProperties.slice(0, 10).map((p) => (
              <div key={p.propertyId} className="flex items-center gap-3 py-2.5">
                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded ${riskBgColor(p.overallRiskLevel)}`}>
                  {p.overallRiskScore}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{p.address}</p>
                  <p className="text-xs text-gray-400">{p.city}, {p.state}</p>
                </div>
                {p.estimatedValue && (
                  <span className="text-xs text-gray-500 shrink-0">{formatCurrency(p.estimatedValue)}</span>
                )}
                <Link
                  href={`/properties/${p.propertyId}`}
                  className="flex items-center gap-1 text-xs font-medium text-gray-600 border border-gray-200 px-2.5 py-1 rounded-lg hover:bg-gray-50 shrink-0"
                >
                  View <ArrowRight className="h-3 w-3" />
                </Link>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Empty state */}
      {portfolio.totalProperties === 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
          <Building2 className="mx-auto h-10 w-10 text-gray-200 mb-3" />
          <p className="font-semibold text-gray-700">No properties in portfolio</p>
          <p className="text-sm text-gray-400 mt-1 mb-4">
            Save properties to start building your portfolio risk view.
          </p>
          <Link
            href="/search"
            className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-5 py-2.5 rounded-lg transition-colors"
          >
            Search Properties
          </Link>
        </div>
      )}
    </div>
  )
}

function KPICard({
  label,
  value,
  icon,
  valueClass,
}: {
  label: string
  value: number | string
  icon: React.ReactNode
  valueClass?: string
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">{label}</p>
          <p className={`text-2xl font-bold mt-1 ${valueClass ?? 'text-gray-900'}`}>{value}</p>
        </div>
        <div className="mt-0.5">{icon}</div>
      </div>
    </div>
  )
}
