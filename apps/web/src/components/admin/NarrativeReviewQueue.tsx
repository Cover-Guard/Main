'use client'

import type { RiskNarrative } from '@coverguard/shared'
import {
  pendingReviewNarratives,
  reviewQueueCounts,
} from '@coverguard/shared'
import { Inbox } from 'lucide-react'

import { NarrativeReviewRow } from './NarrativeReviewRow'

/**
 * Analyst inbox for the narrative review queue (P1 #9 follow-up C).
 *
 * Stateless container that:
 *  - Filters a flat narrative list down to pending-review entries
 *    (LLM-source, low-confidence, undecided)
 *  - Renders an empty state when the queue is clear
 *  - Renders one NarrativeReviewRow per item
 *  - Surfaces an at-a-glance count strip (pending / approved / rejected)
 *
 * The data layer (fetch + mutate) lives on the parent page so this
 * component stays test-friendly.
 *
 * Spec: docs/enhancements/P1-enhancements.md ("P1 #9 - Plain-Language
 * Risk Narrative") - "Human review queue for narratives flagged
 * low-confidence."
 */
export interface NarrativeReviewQueueProps {
  narratives: readonly RiskNarrative[]
  /** Set of narrative ids currently mid-mutation. */
  pendingIds?: ReadonlySet<string>
  onApprove: (narrative: RiskNarrative) => void
  onReject: (narrative: RiskNarrative) => void
}

export function NarrativeReviewQueue({
  narratives,
  pendingIds,
  onApprove,
  onReject,
}: NarrativeReviewQueueProps) {
  const queue = pendingReviewNarratives(narratives)
  const counts = reviewQueueCounts(narratives)

  return (
    <section
      aria-labelledby="narrative-review-queue-heading"
      className="rounded-2xl border border-gray-200 bg-gray-50 p-4"
    >
      <header className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h2
            id="narrative-review-queue-heading"
            className="text-base font-semibold text-gray-900"
          >
            Narrative review queue
          </h2>
          <p className="mt-0.5 text-xs text-gray-500">
            Low-confidence model output that has not been published yet.
          </p>
        </div>
        <div className="flex items-center gap-2 text-[11px]">
          <CountChip label="pending" value={counts.pending} tone="amber" />
          <CountChip label="approved" value={counts.approved} tone="emerald" />
          <CountChip label="rejected" value={counts.rejected} tone="red" />
        </div>
      </header>

      {queue.length === 0 ? (
        <EmptyState />
      ) : (
        <ul className="flex flex-col gap-3">
          {queue.map((n) => (
            <NarrativeReviewRow
              key={n.id}
              narrative={n}
              pending={pendingIds?.has(n.id)}
              onApprove={onApprove}
              onReject={onReject}
            />
          ))}
        </ul>
      )}
    </section>
  )
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-gray-200 bg-white px-4 py-8 text-center">
      <Inbox className="h-5 w-5 text-gray-400" aria-hidden />
      <p className="text-sm font-semibold text-gray-900">Queue is clear</p>
      <p className="max-w-xs text-xs text-gray-500">
        Newly-generated low-confidence narratives will land here for review.
        Until then, the report falls back to template copy.
      </p>
    </div>
  )
}

function CountChip({
  label,
  value,
  tone,
}: {
  label: string
  value: number
  tone: 'amber' | 'emerald' | 'red'
}) {
  const variant =
    tone === 'amber'
      ? 'bg-amber-50 text-amber-800 ring-amber-200'
      : tone === 'emerald'
        ? 'bg-emerald-50 text-emerald-800 ring-emerald-200'
        : 'bg-red-50 text-red-700 ring-red-200'
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-medium ring-1 ${variant}`}
    >
      <strong className="font-semibold">{value}</strong>
      <span className="opacity-90">{label}</span>
    </span>
  )
}
