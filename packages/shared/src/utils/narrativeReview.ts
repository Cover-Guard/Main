/**
 * Pure helpers for the narrative review queue (P1 #9 follow-up C).
 *
 * Decisions live here so the inbox UI is dumb (just renders + dispatches
 * intents) and the same rules can be reused by an API endpoint or a
 * future bulk-tools script.
 */

import type {
  NarrativeReviewStatus,
  RiskNarrative,
} from '../types/perilNarrative'
import { narrativeRequiresReview } from './perilNarrative'

/**
 * Filter a flat narrative list down to the ones an analyst should look
 * at right now: LLM-source, low-confidence, and not yet decided.
 *
 * Sort newest-first by `generatedAt` so freshly-generated work bubbles
 * to the top of the queue.
 */
export function pendingReviewNarratives(
  narratives: readonly RiskNarrative[],
): RiskNarrative[] {
  const filtered = narratives.filter(
    (n) =>
      narrativeRequiresReview(n) &&
      (n.reviewStatus === undefined || n.reviewStatus === 'PENDING'),
  )
  return [...filtered].sort((a, b) => {
    const at = new Date(a.generatedAt).getTime()
    const bt = new Date(b.generatedAt).getTime()
    return bt - at
  })
}

/**
 * Aggregate counts for the queue header chip-strip. Reviewer dashboards
 * use this to show "3 pending · 14 approved · 1 rejected".
 */
export function reviewQueueCounts(
  narratives: readonly RiskNarrative[],
): {
  pending: number
  approved: number
  rejected: number
} {
  let pending = 0
  let approved = 0
  let rejected = 0
  for (const n of narratives) {
    if (narrativeRequiresReview(n)) {
      const s = n.reviewStatus
      if (s === 'APPROVED') approved += 1
      else if (s === 'REJECTED') rejected += 1
      else pending += 1
    }
  }
  return { pending, approved, rejected }
}

/**
 * Validate a status transition. The review queue only allows:
 *
 *   undefined / PENDING -> APPROVED
 *   undefined / PENDING -> REJECTED
 *
 * Once a narrative is APPROVED or REJECTED the analyst must use the
 * "send back to queue" intent (which lands in a follow-up infra PR) to
 * flip back to PENDING.
 */
export function canTransitionReviewStatus(
  current: NarrativeReviewStatus | undefined,
  next: NarrativeReviewStatus,
): boolean {
  if (next === 'PENDING') return false // re-queue is a separate intent
  if (current === undefined || current === 'PENDING') {
    return next === 'APPROVED' || next === 'REJECTED'
  }
  return false
}

/**
 * Default keyboard shortcut hint for a review-queue row. Centralizes
 * the binding so the row component and the help tooltip never drift.
 */
export const REVIEW_KEYBOARD_HINTS = {
  approve: 'A',
  reject: 'R',
  next: '↓ / J',
  prev: '↑ / K',
} as const

/**
 * Human-readable status label for the queue pill.
 */
export function reviewStatusLabel(
  status: NarrativeReviewStatus | undefined,
): string {
  switch (status) {
    case 'APPROVED':
      return 'Approved'
    case 'REJECTED':
      return 'Rejected'
    case 'PENDING':
    case undefined:
      return 'Pending review'
  }
}

/**
 * Reviewer attribution string. Returns 'unassigned' when no reviewer is
 * tagged yet. Used by the inbox metadata strip.
 */
export function reviewerAttribution(
  narrative: Pick<RiskNarrative, 'reviewerId' | 'reviewStatus'>,
): string {
  if (narrative.reviewStatus === 'PENDING' || narrative.reviewStatus === undefined) {
    return 'unassigned'
  }
  return narrative.reviewerId ?? 'unattributed'
}
