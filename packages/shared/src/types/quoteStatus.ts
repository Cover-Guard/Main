/**
 * Quote-request status state machine — types shared between API and web.
 *
 * Spec: docs/enhancements/p0/04-quote-request-status-feedback.md (PR #311 P0 #4).
 *
 * Today's `QuoteRequestStatus` enum in Prisma has only four states
 * (PENDING / SENT / RESPONDED / DECLINED). The spec calls for six, with
 * meaningful transitions between them: REQUESTED → RECEIVED → QUOTING →
 * (QUOTED → BOUND) | DECLINED. The richer model lets producers see exactly
 * where a binding-quote request is stuck and unlocks the per-state
 * notification copy + decline-reason capture from the spec.
 *
 * For now this lives in shared without changing the DB enum — the
 * production schema migration is a follow-up. The web layer can render
 * legacy 4-state data through the canonical 6-state badge via
 * `mapLegacyToCanonicalStatus()` in `quoteStatusMachine.ts`.
 */

/**
 * The full quote-request lifecycle. Order matches the typical happy path,
 * with `DECLINED` and `CANCELLED` as terminal off-ramps.
 *
 *   REQUESTED → producer submitted the quote request inside CoverGuard
 *   RECEIVED  → carrier has acknowledged receipt (webhook or manual confirm)
 *   QUOTING   → carrier is actively underwriting / preparing a quote
 *   QUOTED    → carrier has returned a quote; producer can review premium
 *   BOUND     → policy has been bound — terminal happy state
 *   DECLINED  → carrier declined to write — terminal sad state
 *   CANCELLED → producer cancelled before completion — terminal off-ramp
 */
export type CanonicalQuoteStatus =
  | 'REQUESTED'
  | 'RECEIVED'
  | 'QUOTING'
  | 'QUOTED'
  | 'BOUND'
  | 'DECLINED'
  | 'CANCELLED'

/**
 * Where a status update came from. Determines confidence and whether to
 * surface a decline reason; also feeds the appetite-freshness signal as
 * ground truth (per spec).
 */
export type QuoteStatusSource =
  | 'CARRIER_WEBHOOK'  // carrier pushed the update via webhook (most authoritative)
  | 'CARRIER_API_POLL' // we polled the carrier's API
  | 'EMAIL_PARSE'      // we parsed an inbound email reply
  | 'AGENT_MANUAL'     // the producer manually marked it (e.g. heard back via phone)
  | 'SYSTEM'           // CoverGuard generated this transition (e.g. initial REQUESTED)

/**
 * One row in the per-quote audit log. The UI's `QuoteStatusTimeline`
 * renders these chronologically; the appetite-freshness service consumes
 * them as ground-truth signals for individual carriers.
 */
export interface QuoteStatusEvent {
  /** Stable ID for de-duplication when the same event arrives twice. */
  id: string
  /** Which quote-request this event belongs to. */
  quoteRequestId: string
  /** The status the quote moved into. */
  status: CanonicalQuoteStatus
  /** Where the update came from. */
  source: QuoteStatusSource
  /** ISO timestamp of when the transition happened. */
  occurredAt: string
  /** Free-form one-sentence explainer surfaced in the UI tooltip. */
  message?: string | null
  /** Populated only for DECLINED — the carrier's stated reason. */
  declineReason?: string | null
}

/**
 * The per-state copy bundle used by the badge / timeline. Keep here (not in
 * the React component) so the API can return the same human strings for
 * email + SMS notifications.
 */
export interface QuoteStatusCopy {
  /** Short label for badges and table cells. */
  label: string
  /** One-sentence description for tooltips. */
  description: string
  /**
   * UI variant. Maps to a known set of color tokens consumed by the badge
   * component — string-typed so the shared package doesn't depend on
   * Tailwind class names.
   */
  variant: 'neutral' | 'pending' | 'progress' | 'success' | 'warning' | 'danger'
}
