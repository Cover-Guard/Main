/**
 * Quote-request status state machine + display copy.
 *
 * Spec: docs/enhancements/p0/04-quote-request-status-feedback.md.
 *
 * Two responsibilities:
 *   1. Validate that a transition is legal (you can go RECEIVED → QUOTING,
 *      not RECEIVED → BOUND). The API enforces this on every webhook /
 *      manual update; the UI uses `getNextValidStatuses` to drive the
 *      "Mark as…" dropdown for manual updates.
 *   2. Provide one human-readable copy bundle per state, so the badge,
 *      timeline, email, and SMS all read the same.
 */

import type { CanonicalQuoteStatus, QuoteStatusCopy } from '../types/quoteStatus'

/**
 * Allowed transitions, keyed by source state. Each state lists every
 * status you're allowed to move to next. Terminal states (BOUND / DECLINED
 * / CANCELLED) have empty arrays.
 *
 * The graph is intentionally tight — the goal is to catch carrier-side
 * bugs and fat-fingered manual updates, not to be permissive. Add an edge
 * here when a real workflow requires it.
 */
const TRANSITIONS: Record<CanonicalQuoteStatus, readonly CanonicalQuoteStatus[]> = {
  REQUESTED: ['RECEIVED', 'DECLINED', 'CANCELLED'],
  RECEIVED:  ['QUOTING', 'DECLINED', 'CANCELLED'],
  QUOTING:   ['QUOTED', 'DECLINED', 'CANCELLED'],
  QUOTED:    ['BOUND', 'DECLINED', 'CANCELLED'],
  BOUND:     [],
  DECLINED:  [],
  CANCELLED: [],
}

/**
 * Whether moving a quote from `from` to `to` is allowed by the state
 * machine. Used by the API on every status-update call and by the UI to
 * decide which menu items to show in the "Update status" dropdown.
 */
export function isValidQuoteStatusTransition(
  from: CanonicalQuoteStatus,
  to: CanonicalQuoteStatus,
): boolean {
  return TRANSITIONS[from].includes(to)
}

/** Statuses the quote can legally move to from the given state. */
export function getNextValidQuoteStatuses(
  from: CanonicalQuoteStatus,
): readonly CanonicalQuoteStatus[] {
  return TRANSITIONS[from]
}

/** Whether a status is a terminal state (no outgoing transitions). */
export function isTerminalQuoteStatus(status: CanonicalQuoteStatus): boolean {
  return TRANSITIONS[status].length === 0
}

/**
 * Translate a status into the copy bundle used everywhere — badge label,
 * tooltip description, and UI variant. Centralized so email + SMS + the
 * web UI never drift.
 */
export function quoteStatusCopy(status: CanonicalQuoteStatus): QuoteStatusCopy {
  switch (status) {
    case 'REQUESTED':
      return {
        label: 'Requested',
        description: 'You submitted the request — waiting for the carrier to receive it.',
        variant: 'pending',
      }
    case 'RECEIVED':
      return {
        label: 'Received',
        description: 'The carrier has acknowledged receipt and added it to their queue.',
        variant: 'progress',
      }
    case 'QUOTING':
      return {
        label: 'Quoting',
        description: 'The carrier is actively underwriting — a quote should arrive soon.',
        variant: 'progress',
      }
    case 'QUOTED':
      return {
        label: 'Quoted',
        description: 'The carrier returned a quote — review premium and bind to finalize.',
        variant: 'success',
      }
    case 'BOUND':
      return {
        label: 'Bound',
        description: 'Policy is bound — the customer is covered.',
        variant: 'success',
      }
    case 'DECLINED':
      return {
        label: 'Declined',
        description: 'The carrier declined to write this property.',
        variant: 'danger',
      }
    case 'CANCELLED':
      return {
        label: 'Cancelled',
        description: 'You cancelled this request before it completed.',
        variant: 'neutral',
      }
  }
}

/**
 * Map the legacy four-state Prisma enum onto the canonical six-state
 * model so the new badge / timeline renders today's data while the schema
 * migration to the canonical model is a follow-up PR.
 *
 * Mapping rationale:
 *   PENDING   → REQUESTED (we created the row but haven't confirmed receipt)
 *   SENT      → RECEIVED  (we successfully forwarded to the carrier)
 *   RESPONDED → QUOTED    (a generic response — assume best-case quoted)
 *   DECLINED  → DECLINED  (1:1)
 */
export function mapLegacyToCanonicalStatus(
  legacy: 'PENDING' | 'SENT' | 'RESPONDED' | 'DECLINED',
): CanonicalQuoteStatus {
  switch (legacy) {
    case 'PENDING':   return 'REQUESTED'
    case 'SENT':      return 'RECEIVED'
    case 'RESPONDED': return 'QUOTED'
    case 'DECLINED':  return 'DECLINED'
  }
}

/** All canonical statuses, in their typical-display order. */
export const CANONICAL_QUOTE_STATUSES: readonly CanonicalQuoteStatus[] = [
  'REQUESTED',
  'RECEIVED',
  'QUOTING',
  'QUOTED',
  'BOUND',
  'DECLINED',
  'CANCELLED',
]
