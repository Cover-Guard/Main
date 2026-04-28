'use client'

import type { NarrativeReviewStatus, RiskNarrative } from '@coverguard/shared'
import {
  REVIEW_KEYBOARD_HINTS,
  reviewStatusLabel,
  reviewerAttribution,
} from '@coverguard/shared'
import { Check, X } from 'lucide-react'

/**
 * One row in the narrative review queue (P1 #9 follow-up C).
 *
 * Stateless. Parent supplies the narrative + decision callbacks; this
 * component renders the side-by-side layout (peril context / model
 * output / queue metadata) plus the accept / reject affordances.
 *
 * Keyboard:
 *  - 'A' / Enter: approve
 *  - 'R' / Esc:   reject
 * (Bindings come from REVIEW_KEYBOARD_HINTS so the help tooltip never
 * drifts.)
 */
export interface NarrativeReviewRowProps {
  narrative: RiskNarrative
  /** Mutation in-flight - disables both buttons + hides actions briefly. */
  pending?: boolean
  /** Fired when the analyst clicks/keys "approve". */
  onApprove: (narrative: RiskNarrative) => void
  /** Fired when the analyst clicks/keys "reject". */
  onReject: (narrative: RiskNarrative) => void
}

const STATUS_VARIANT: Record<NarrativeReviewStatus | 'PENDING', string> = {
  PENDING:  'bg-amber-50 text-amber-800 ring-amber-200',
  APPROVED: 'bg-emerald-50 text-emerald-800 ring-emerald-200',
  REJECTED: 'bg-red-50 text-red-700 ring-red-200',
}

export function NarrativeReviewRow({
  narrative,
  pending = false,
  onApprove,
  onReject,
}: NarrativeReviewRowProps) {
  const status = narrative.reviewStatus ?? 'PENDING'
  const decided = status === 'APPROVED' || status === 'REJECTED'

  return (
    <li
      className="rounded-xl border border-gray-200 bg-white p-4"
      aria-labelledby={`review-${narrative.id}-heading`}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h3
            id={`review-${narrative.id}-heading`}
            className="text-sm font-semibold text-gray-900"
          >
            <span className="capitalize">{narrative.peril}</span>{' '}
            <span className="text-gray-500">
              · {Math.round(narrative.score)} / 100
            </span>
          </h3>
          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-gray-500">
            <StatusPill status={status} />
            <span>confidence {(narrative.confidence * 100).toFixed(0)}%</span>
            <span>·</span>
            <span>reviewer {reviewerAttribution(narrative)}</span>
            <span>·</span>
            <span>generated {formatRelative(narrative.generatedAt)}</span>
          </div>
        </div>
        {!decided && !pending && (
          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={() => onReject(narrative)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-white px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-50"
              title={`Reject (${REVIEW_KEYBOARD_HINTS.reject})`}
            >
              <X className="h-3 w-3" aria-hidden />
              Reject
            </button>
            <button
              type="button"
              onClick={() => onApprove(narrative)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-500"
              title={`Approve (${REVIEW_KEYBOARD_HINTS.approve})`}
            >
              <Check className="h-3 w-3" aria-hidden />
              Approve
            </button>
          </div>
        )}
      </div>
      <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-gray-700">
        {narrative.body}
      </p>
    </li>
  )
}

function StatusPill({
  status,
}: {
  status: NarrativeReviewStatus | 'PENDING'
}) {
  const variant = STATUS_VARIANT[status]
  return (
    <span
      className={`inline-flex items-center rounded-full px-1.5 py-0.5 font-medium ring-1 ${variant}`}
    >
      {reviewStatusLabel(status === 'PENDING' ? 'PENDING' : status)}
    </span>
  )
}

/**
 * Coarse "N min/hr/day ago" formatter, intentionally inlined so this
 * component has no extra deps. (formatLastUpdated lives in the offline
 * cache module - we don't want a one-shot import.)
 */
function formatRelative(iso: string): string {
  const t = new Date(iso).getTime()
  if (Number.isNaN(t)) return 'unknown'
  const delta = Date.now() - t
  if (delta < 60_000) return 'just now'
  const m = Math.floor(delta / 60_000)
  if (m < 60) return `${m} min ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h} hr ago`
  const d = Math.floor(h / 24)
  return d === 1 ? '1 day ago' : `${d} days ago`
}
