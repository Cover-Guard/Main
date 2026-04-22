'use client'

import { useState } from 'react'
import type { MitigationPlan } from '@coverguard/shared'
import { formatCurrency } from '@coverguard/shared'
import { ChevronDown, ChevronUp, Wrench, TrendingDown, Clock, Flame, Wind, Droplets, Mountain, ShieldAlert, Sparkles } from 'lucide-react'

interface MitigationSavingsCardProps {
  plan: MitigationPlan
  /** If true, the expanded list is open on initial render. */
  defaultExpanded?: boolean
}

const PERIL_ICON = {
  flood: Droplets,
  fire: Flame,
  wind: Wind,
  earthquake: Mountain,
  crime: ShieldAlert,
  general: Sparkles,
} as const

/**
 * Mitigation Savings Calculator card — shows the agent and homeowner the top
 * premium-reduction actions for this property, each annotated with estimated
 * annual savings, one-time investment, and payback window.
 *
 * Spec: docs/gtm/value-add-activities/06-mitigation-savings.md
 */
export function MitigationSavingsCard({ plan, defaultExpanded = false }: MitigationSavingsCardProps) {
  const [expanded, setExpanded] = useState(defaultExpanded)

  if (plan.suggestions.length === 0) return null

  const count = plan.suggestions.length

  return (
    <div className="card border border-emerald-200 bg-emerald-50/40 p-5">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-100">
          <TrendingDown className="h-5 w-5 text-emerald-700" aria-hidden="true" />
        </div>
        <div className="flex-1">
          <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">
            Lower your premium
          </p>
          <h3 className="text-base font-bold text-gray-900">
            {count} {count === 1 ? 'way' : 'ways'} to save up to{' '}
            <span className="text-emerald-700">
              {formatCurrency(plan.totalPotentialAnnualSavings)}
            </span>{' '}
            per year
          </h3>
          <p className="mt-0.5 text-sm text-gray-600">
            Estimated against a baseline premium of {formatCurrency(plan.baselineAnnualPremium)}.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="flex shrink-0 items-center gap-1 rounded-md px-3 py-1.5 text-sm font-medium text-emerald-700 hover:bg-emerald-100"
          aria-expanded={expanded}
          aria-controls="mitigation-suggestions-list"
        >
          {expanded ? 'Hide' : 'Show'}
          {expanded ? (
            <ChevronUp className="h-4 w-4" aria-hidden="true" />
          ) : (
            <ChevronDown className="h-4 w-4" aria-hidden="true" />
          )}
        </button>
      </div>

      {expanded && (
        <ul id="mitigation-suggestions-list" className="mt-4 space-y-3">
          {plan.suggestions.map((s) => {
            const Icon = PERIL_ICON[s.action.peril] ?? Wrench
            return (
              <li
                key={s.action.id}
                className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm"
              >
                <div className="flex items-start gap-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gray-100">
                    <Icon className="h-4 w-4 text-gray-600" aria-hidden="true" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-gray-900">{s.action.title}</p>
                    <p className="mt-0.5 text-sm text-gray-600">{s.action.description}</p>
                    <p className="mt-1 text-xs italic text-gray-500">{s.rationale}</p>
                  </div>
                </div>
                <dl className="mt-3 grid grid-cols-3 gap-3 border-t border-gray-100 pt-3 text-xs">
                  <div>
                    <dt className="flex items-center gap-1 font-medium text-gray-500">
                      <TrendingDown className="h-3 w-3" aria-hidden="true" /> Savings / yr
                    </dt>
                    <dd className="mt-0.5 text-sm font-bold text-emerald-700">
                      {formatCurrency(s.estimatedAnnualSavings)}
                    </dd>
                  </div>
                  <div>
                    <dt className="flex items-center gap-1 font-medium text-gray-500">
                      <Wrench className="h-3 w-3" aria-hidden="true" /> Investment
                    </dt>
                    <dd className="mt-0.5 text-sm font-bold text-gray-900">
                      {formatCurrency(s.estimatedInvestment)}
                    </dd>
                  </div>
                  <div>
                    <dt className="flex items-center gap-1 font-medium text-gray-500">
                      <Clock className="h-3 w-3" aria-hidden="true" /> Payback
                    </dt>
                    <dd className="mt-0.5 text-sm font-bold text-gray-900">
                      {Number.isFinite(s.paybackYears) ? `${s.paybackYears} yrs` : '—'}
                    </dd>
                  </div>
                </dl>
                {s.action.source && (
                  <p className="mt-2 text-[10px] uppercase tracking-wider text-gray-400">
                    Source: {s.action.source}
                  </p>
                )}
              </li>
            )
          })}
        </ul>
      )}

      <p className="mt-4 text-[11px] italic leading-snug text-gray-500">{plan.disclaimer}</p>
    </div>
  )
}
