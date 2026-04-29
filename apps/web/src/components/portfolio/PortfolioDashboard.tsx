'use client'

import {
  applyPortfolioFilters,
  formatPortfolioPremium,
  perilLabel,
  retentionRiskCopy,
  summarizePortfolio,
  type PortfolioFilters,
  type PortfolioPolicy,
} from '@coverguard/shared'
import { Building2, Filter, ShieldAlert, ShieldCheck, TrendingDown } from 'lucide-react'
import { useMemo, useState } from 'react'

/**
 * Book-of-business / portfolio dashboard (P2 #16).
 *
 * Spec: docs/enhancements/P2-enhancements.md.
 *
 * Renders a producer's portfolio of in-force policies with summary
 * cards, filter chips, and a sortable table. The dashboard recomputes
 * filtered rows + summary in a single `useMemo` pass so a 5,000-row
 * book stays inside the spec's 2-second budget.
 *
 * Stateless + presentational: the parent fetches the portfolio from
 * the AMS adapter (P1 #6) and passes it in. The drill-down handler
 * lets the producer jump to the full report (the third spec acceptance
 * criterion).
 */
export interface PortfolioDashboardProps {
  policies: readonly PortfolioPolicy[]
  initialFilters?: Partial<PortfolioFilters>
  /** Fired when the user clicks a row's "View report" button. */
  onDrillDown: (policy: PortfolioPolicy) => void
}

export function PortfolioDashboard({
  policies,
  initialFilters,
  onDrillDown,
}: PortfolioDashboardProps) {
  const [filters, setFilters] = useState<PortfolioFilters>({
    states: initialFilters?.states ?? [],
    perils: initialFilters?.perils ?? [],
    carriers: initialFilters?.carriers ?? [],
    producers: initialFilters?.producers ?? [],
    minRetentionRisk: initialFilters?.minRetentionRisk ?? null,
    searchQuery: initialFilters?.searchQuery ?? '',
  })

  // Single pass: filter + summarize. Keeps render inside the 2s budget.
  const { filtered, summary } = useMemo(() => {
    const f = applyPortfolioFilters(policies, filters)
    const s = summarizePortfolio(policies.length, f)
    return { filtered: f, summary: s }
  }, [policies, filters])

  return (
    <section
      aria-labelledby="portfolio-heading"
      className="flex flex-col gap-4"
    >
      <header className="flex items-end justify-between gap-4">
        <div>
          <h2
            id="portfolio-heading"
            className="text-xl font-semibold text-slate-900"
          >
            Book of business
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            {summary.filteredPolicies.toLocaleString()} of{' '}
            {summary.totalPolicies.toLocaleString()} policies shown
          </p>
        </div>
      </header>

      <SummaryCards summary={summary} />
      <FilterBar
        filters={filters}
        onChange={setFilters}
        policies={policies}
      />
      <PortfolioTable rows={filtered} onDrillDown={onDrillDown} />
    </section>
  )
}

// =============================================================================
// Summary cards
// =============================================================================

function SummaryCards({
  summary,
}: {
  summary: ReturnType<typeof summarizePortfolio>
}) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <SummaryCard
        icon={<Building2 className="h-4 w-4 text-slate-500" aria-hidden />}
        label="Policies in view"
        value={summary.filteredPolicies.toLocaleString()}
      />
      <SummaryCard
        icon={<ShieldCheck className="h-4 w-4 text-emerald-500" aria-hidden />}
        label="Average score"
        value={summary.averageScore === null ? 'â' : `${summary.averageScore}/100`}
      />
      <SummaryCard
        icon={<TrendingDown className="h-4 w-4 text-blue-500" aria-hidden />}
        label="Total annual premium"
        value={formatPortfolioPremium(summary.totalAnnualPremiumUsd)}
      />
      <SummaryCard
        icon={<ShieldAlert className="h-4 w-4 text-amber-500" aria-hidden />}
        label="At-risk policies"
        value={(
          summary.retentionBreakdown.HIGH + summary.retentionBreakdown.CRITICAL
        ).toLocaleString()}
      />
    </div>
  )
}

function SummaryCard({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode
  label: string
  value: string
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-slate-500">
        {icon}
        {label}
      </div>
      <p className="mt-2 text-2xl font-semibold text-slate-900">{value}</p>
    </div>
  )
}

// =============================================================================
// Filter bar
// =============================================================================

function FilterBar({
  filters,
  onChange,
  policies,
}: {
  filters: PortfolioFilters
  onChange: (next: PortfolioFilters) => void
  policies: readonly PortfolioPolicy[]
}) {
  const states = useMemo(
    () =>
      Array.from(new Set(policies.map((p) => p.property.state))).sort(),
    [policies],
  )
  const carriers = useMemo(
    () => Array.from(new Set(policies.map((p) => p.carrierName))).sort(),
    [policies],
  )

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border border-slate-200 bg-white p-3">
      <Filter className="h-4 w-4 text-slate-500" aria-hidden />
      <input
        type="search"
        placeholder="Search address, carrier, policy #"
        value={filters.searchQuery}
        onChange={(e) => onChange({ ...filters, searchQuery: e.target.value })}
        className="min-w-[200px] flex-1 rounded-md border border-slate-300 px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        aria-label="Search portfolio"
      />
      <FacetSelect
        label="State"
        options={states}
        selected={filters.states}
        onChange={(v) => onChange({ ...filters, states: v })}
      />
      <FacetSelect
        label="Carrier"
        options={carriers}
        selected={filters.carriers}
        onChange={(v) => onChange({ ...filters, carriers: v })}
      />
      <RetentionSelect
        value={filters.minRetentionRisk}
        onChange={(v) => onChange({ ...filters, minRetentionRisk: v })}
      />
    </div>
  )
}

function FacetSelect({
  label,
  options,
  selected,
  onChange,
}: {
  label: string
  options: string[]
  selected: string[]
  onChange: (next: string[]) => void
}) {
  return (
    <select
      multiple
      aria-label={label}
      value={selected}
      onChange={(e) =>
        onChange(Array.from(e.target.selectedOptions).map((o) => o.value))
      }
      className="rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm"
      size={1}
    >
      <option value="" disabled>
        {label}
      </option>
      {options.map((opt) => (
        <option key={opt} value={opt}>
          {opt}
        </option>
      ))}
    </select>
  )
}

function RetentionSelect({
  value,
  onChange,
}: {
  value: PortfolioFilters['minRetentionRisk']
  onChange: (next: PortfolioFilters['minRetentionRisk']) => void
}) {
  return (
    <select
      aria-label="Minimum retention risk"
      value={value ?? ''}
      onChange={(e) =>
        onChange(
          e.target.value === ''
            ? null
            : (e.target.value as PortfolioFilters['minRetentionRisk']),
        )
      }
      className="rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm"
    >
      <option value="">All risk levels</option>
      <option value="MEDIUM">Watch+</option>
      <option value="HIGH">At risk+</option>
      <option value="CRITICAL">Non-renewal</option>
    </select>
  )
}

// =============================================================================
// Table
// =============================================================================

function PortfolioTable({
  rows,
  onDrillDown,
}: {
  rows: readonly PortfolioPolicy[]
  onDrillDown: (policy: PortfolioPolicy) => void
}) {
  if (rows.length === 0) {
    return (
      <div className="rounded-lg border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">
        No policies match these filters.
      </div>
    )
  }
  return (
    <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
      <table className="min-w-full divide-y divide-slate-200 text-sm">
        <thead className="bg-slate-50 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
          <tr>
            <th className="px-4 py-2">Property</th>
            <th className="px-4 py-2">Carrier</th>
            <th className="px-4 py-2">Score</th>
            <th className="px-4 py-2">Peril</th>
            <th className="px-4 py-2">Retention</th>
            <th className="px-4 py-2 text-right">Premium</th>
            <th className="px-4 py-2" />
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.map((p) => (
            <tr key={p.id}>
              <td className="px-4 py-2 align-top">
                <div className="font-medium text-slate-900">
                  {p.property.addressLine1}
                </div>
                <div className="text-xs text-slate-500">
                  {p.property.city}, {p.property.state} {p.property.postalCode}
                </div>
              </td>
              <td className="px-4 py-2 align-top text-slate-700">{p.carrierName}</td>
              <td className="px-4 py-2 align-top font-medium">
                {p.insurabilityScore}/100
              </td>
              <td className="px-4 py-2 align-top text-slate-700">
                {perilLabel(p.dominantPeril)}
              </td>
              <td className="px-4 py-2 align-top">
                <RetentionPill level={p.retentionRisk} />
              </td>
              <td className="px-4 py-2 align-top text-right font-mono text-slate-700">
                {formatPortfolioPremium(p.annualPremiumUsd)}
              </td>
              <td className="px-4 py-2 align-top text-right">
                <button
                  type="button"
                  onClick={() => onDrillDown(p)}
                  className="rounded-md border border-slate-300 px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
                >
                  View report
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function RetentionPill({ level }: { level: PortfolioPolicy['retentionRisk'] }) {
  const { label, variant } = retentionRiskCopy(level)
  const cls = {
    success: 'bg-emerald-100 text-emerald-800',
    neutral: 'bg-slate-100 text-slate-800',
    warning: 'bg-amber-100 text-amber-800',
    danger: 'bg-red-100 text-red-800',
  }[variant]
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${cls}`}
    >
      {label}
    </span>
  )
}

