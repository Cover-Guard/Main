/**
 * Detector framework — types (PR 7).
 *
 * Detectors evaluate per-user signals and emit zero or more Insights. The
 * runner persists insights as `notifications` rows with category='insight',
 * de-duplicating on the detector-supplied `dedupeKey` so we don't spam users
 * when the same condition holds across runs.
 *
 * PR 7 ships the framework + 1 trivial smoke detector. PR 8 wires the
 * production set: deal-stuck, quote-returned, property-listing-near-saved,
 * trial-conversion-milestone, checklist-overdue.
 */

import type {
  NotificationCategory,
  NotificationSeverity,
} from '@coverguard/shared'
import type { SupabaseClient } from '@supabase/supabase-js'

export interface DetectorContext {
  /** The user the detector is evaluating against. Detectors run per-user. */
  userId: string
  /** Service-role Supabase client. Detectors may read any table they need. */
  supabase: SupabaseClient
  /**
   * "Now" reference for time-sensitive evaluators. Always pass the runner's
   * single `now` instance so a batch of detectors agrees on the timestamp,
   * which makes dedup windows + tests deterministic.
   */
  now: Date
}

/**
 * What a detector emits. Maps directly to a `notifications` row but adds
 * `dedupeKey` (used by the runner, never persisted to the row itself).
 */
export interface Insight {
  /** Always 'insight' for this surface. Kept on the type for clarity. */
  category: Extract<NotificationCategory, 'insight'>
  severity: NotificationSeverity
  title: string
  body: string | null
  linkUrl: string | null
  payload: Record<string, unknown>
  /**
   * Optional entity reference. Most insights tie to one — a deal, a saved
   * property, a quote. Used for mute-by-entity (PR 5) and as the natural
   * dedupe key when present.
   */
  entityType: string | null
  entityId: string | null
  /**
   * Stable identifier the runner uses to skip duplicate inserts. Convention:
   * `<detector-name>:<entityId-or-singleton-key>`. The runner queries the
   * last 30 days of insights for this user and skips when an identical
   * dedupeKey exists in `payload.dedupeKey`.
   */
  dedupeKey: string
}

/**
 * A detector is a pure function over a context. Implementations should be
 * idempotent — the runner relies on dedupe to avoid duplicate inserts, but
 * a well-behaved detector also avoids re-emitting identical insights when
 * conditions haven't changed.
 */
export interface Detector {
  /** Stable name. Used as the dedupeKey prefix and in logs. */
  readonly name: string
  /**
   * Optional gate. The runner skips the detector when this returns false.
   * Useful for env-flagged detectors and per-user feature flags.
   */
  enabled?(ctx: DetectorContext): boolean | Promise<boolean>
  /** Evaluate and return zero or more insights. */
  evaluate(ctx: DetectorContext): Promise<Insight[]>
}
