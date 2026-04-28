/**
 * Types for the public trust portal + SOC 2 readiness (P1 #11).
 *
 * Spec: docs/enhancements/P1-enhancements.md ("P1 #11 - Public Trust
 * Portal + SOC 2 Type II") - "trust.coverguard.io style page with:
 * current SOC 2 status, subprocessors list, data-handling policy,
 * state-DOI privacy posture..."
 *
 * Forward-compat scaffold: this PR ships the data shape so a CMS / DB
 * can populate the trust portal without changing the contract once
 * Vanta / Drata / Secureframe is wired up in a follow-up infra PR.
 */

/**
 * Where CoverGuard is on the SOC 2 readiness journey. Surfaced as the
 * top badge on the trust portal.
 */
export type Soc2Status =
  | 'NOT_STARTED'
  | 'READINESS_IN_PROGRESS'
  | 'TYPE_I_ACHIEVED'
  | 'TYPE_II_IN_AUDIT'
  | 'TYPE_II_ACHIEVED'

/**
 * A vendor we hand customer data to. Trust portal shows the full list,
 * filtered to "currently active" by default.
 */
export interface Subprocessor {
  id: string
  /** Display name ("Stripe", "Twilio", "AWS S3 / us-east-1"). */
  name: string
  /** Human-readable purpose. */
  purpose: string
  /**
   * What categories of customer data the subprocessor sees. Kept as a
   * stable enum so the trust portal can render iconography consistently.
   */
  dataAccessed: ReadonlyArray<SubprocessorDataCategory>
  /** Geographic jurisdiction the data lives in (e.g. 'US', 'EU'). */
  jurisdiction: string
  /** ISO-8601 timestamp the row was added to the public portal. */
  addedAt: string
  /** ISO-8601 timestamp the row was last reviewed by Security. */
  lastReviewedAt: string
  /** True if currently active. False rows render in a "Removed" tab. */
  active: boolean
  /** Optional vendor compliance docs (DPA URL, SOC 2 report, etc). */
  complianceDocsUrl?: string | null
}

/**
 * Coarse data-categories surfaced as icons on the subprocessor row.
 * Kept stable so a future portal redesign doesn't drift.
 */
export type SubprocessorDataCategory =
  | 'PROPERTY_ADDRESS'
  | 'CONTACT_INFO'
  | 'BILLING'
  | 'AUTH'
  | 'TELEMETRY'
  | 'DOCUMENTS'

/**
 * One-page data-handling summary surfaced on the trust portal. The
 * full text lives in the CMS; this shape carries just enough for the
 * portal cards / metadata.
 */
export interface DataHandlingPolicy {
  /** ISO-8601 timestamp the policy text was last published. */
  publishedAt: string
  /** Stable version label ("v3.2", "2026.04"). */
  version: string
  /** Public URL to the long-form policy document. */
  url: string
  /** Plain-language one-paragraph summary used as the card body. */
  summary: string
}

/**
 * Snapshot the trust portal renders at request time. The CMS / DB
 * builds it; the page consumes it.
 */
export interface TrustPortalSnapshot {
  /** Where SOC 2 is right now. */
  soc2Status: Soc2Status
  /** ISO-8601 timestamp of the snapshot - shown as "Last updated <time>". */
  generatedAt: string
  /** Active subprocessors (sorted alphabetically by display name). */
  activeSubprocessors: ReadonlyArray<Subprocessor>
  /** Removed (kept for ~12 months for transparency). */
  removedSubprocessors: ReadonlyArray<Subprocessor>
  /** Public data-handling policy summary. */
  dataHandlingPolicy: DataHandlingPolicy
  /** Public URL to security.txt + disclosure policy. */
  securityTxtUrl: string
  /** State-DOI privacy posture. */
  doiPostureSummary: string
}

/**
 * Audit event the portal emits on every subprocessor change. Drives
 * the email-to-enterprise-customers acceptance criterion.
 */
export interface SubprocessorChangeEvent {
  id: string
  kind: 'ADDED' | 'REMOVED' | 'PURPOSE_UPDATED' | 'JURISDICTION_CHANGED'
  subprocessorId: string
  subprocessorName: string
  /** ISO-8601 timestamp the change was published to the portal. */
  publishedAt: string
  /** Operator who made the change (audit trail). */
  publishedBy: string
  /** Optional human-readable note. */
  note?: string
}

/**
 * How frequently we expect a subprocessor row to be re-reviewed by
 * Security. Used by `requiresSubprocessorReview` to surface stale rows.
 */
export const SUBPROCESSOR_REVIEW_INTERVAL_DAYS = 365

/**
 * Approximate progress percentages we surface in the portal hero.
 * Tunable from the CMS; here so the UI has a stable default.
 */
export const SOC2_PROGRESS_PERCENT: Record<Soc2Status, number> = {
  NOT_STARTED:           0,
  READINESS_IN_PROGRESS: 35,
  TYPE_I_ACHIEVED:       60,
  TYPE_II_IN_AUDIT:      85,
  TYPE_II_ACHIEVED:      100,
}
