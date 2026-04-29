'use client'

import type {
  CarrierIntegrationProgressSummary,
} from '@coverguard/shared'
import {
  countLiveIntegrations,
  nextMilestone,
  summarizeIntegrationProgress,
  type CarrierIntegrationRecord,
} from '@coverguard/shared'
import { Plug, Target } from 'lucide-react'

/**
 * Rollup card for the BD program tracker + the public trust portal
 * (P2 #12).
 *
 * Stateless. Takes a flat list of {@link CarrierIntegrationRecord}
 * and renders the live-integration count, the progress bar toward the
 * 25-carrier target, and the next spec milestone (5 / 15 / 25).
 *
 * Spec: docs/enhancements/P2-enhancements.md ("P2 #12 - Direct Carrier
 * API Integrations (Top 25 P&C)") - acceptance criteria are 5 by Q+2,
 * 15 by Q+4, 25 by Q+6.
 */
export interface CarrierIntegrationProgressCardProps {
  records: readonly CarrierIntegrationRecord[]
  /** Override the target (defaults to spec's 25). */
  target?: number
}

export function CarrierIntegrationProgressCard({
  records,
  target,
}: CarrierIntegrationProgressCardProps) {
  const summary: CarrierIntegrationProgressSummary =
    summarizeIntegrationProgress(records, target)
  const live = countLiveIntegrations(records)
  const next = nextMilestone(live)
  const percent = Math.round(summary.progressToTarget * 100)

  return (
    <section
      aria-labelledby="carrier-integration-progress-heading"
      className="rounded-2xl border border-gray-200 bg-white p-5"
    >
      <header className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <Plug className="h-5 w-5 text-emerald-600" aria-hidden />
          <h2
            id="carrier-integration-progress-heading"
            className="text-base font-semibold text-gray-900"
          >
            Carrier integrations
          </h2>
        </div>
        <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-medium text-emerald-800 ring-1 ring-emerald-200">
          {summary.liveCount} live · {summary.target} target
        </span>
      </header>
      <div className="mt-4">
        <div
          role="progressbar"
          aria-valuenow={summary.liveCount}
          aria-valuemin={0}
          aria-valuemax={summary.target}
          aria-label={`Carrier integrations live: ${summary.liveCount} of ${summary.target}`}
          className="h-2 w-full overflow-hidden rounded-full bg-gray-100"
        >
          <div
            className="h-full bg-emerald-500 transition-all"
            style={{ width: `${percent}%` }}
          />
        </div>
        <p className="mt-1 text-[10px] uppercase tracking-wider text-gray-400">
          {percent}% of top {summary.target} P&amp;C
        </p>
      </div>
      <dl className="mt-4 grid grid-cols-3 gap-2 text-xs">
        <Stat label="Pilot" value={summary.pilotCount} />
        <Stat label="Contracted" value={summary.contractedCount} />
        <Stat label="Deprecated" value={summary.deprecatedCount} />
      </dl>
      {next ? (
        <p className="mt-4 inline-flex items-center gap-1.5 text-xs text-gray-600">
          <Target className="h-3 w-3 text-amber-600" aria-hidden />
          Next milestone: <strong className="font-semibold">{next.label}</strong>
          <span className="text-gray-400">
            ({summary.liveCount}/{next.liveCount})
          </span>
        </p>
      ) : (
        <p className="mt-4 inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700">
          <Target className="h-3 w-3" aria-hidden />
          All spec milestones cleared
        </p>
      )}
    </section>
  )
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg bg-gray-50 px-3 py-2 ring-1 ring-gray-200">
      <dt className="text-[10px] font-medium uppercase tracking-wider text-gray-500">
        {label}
      </dt>
      <dd className="mt-0.5 text-base font-semibold text-gray-900 tabular-nums">
        {value}
      </dd>
    </div>
  )
}
