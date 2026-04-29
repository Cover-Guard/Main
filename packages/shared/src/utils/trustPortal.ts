/**
 * Pure helpers for the public trust portal (P1 #11).
 *
 * Drives the SOC 2 progress bar, the subprocessor staleness chips, and
 * the change-feed copy. Storage / email dispatch live elsewhere.
 */

import {
  SOC2_PROGRESS_PERCENT,
  SUBPROCESSOR_REVIEW_INTERVAL_DAYS,
  type Soc2Status,
  type Subprocessor,
  type SubprocessorChangeEvent,
  type TrustPortalSnapshot,
} from '../types/trustPortal'

/**
 * Human-readable label for the SOC 2 badge.
 */
export function soc2StatusLabel(status: Soc2Status): string {
  switch (status) {
    case 'NOT_STARTED':           return 'Not started'
    case 'READINESS_IN_PROGRESS': return 'Readiness in progress'
    case 'TYPE_I_ACHIEVED':       return 'SOC 2 Type I achieved'
    case 'TYPE_II_IN_AUDIT':      return 'SOC 2 Type II in audit'
    case 'TYPE_II_ACHIEVED':      return 'SOC 2 Type II achieved'
  }
}

/**
 * UI tone for the SOC 2 badge. Kept here so the trust portal and the
 * marketing site can never drift on color choice.
 */
export function soc2StatusTone(
  status: Soc2Status,
): 'neutral' | 'progress' | 'success' {
  switch (status) {
    case 'NOT_STARTED':
      return 'neutral'
    case 'READINESS_IN_PROGRESS':
    case 'TYPE_II_IN_AUDIT':
      return 'progress'
    case 'TYPE_I_ACHIEVED':
    case 'TYPE_II_ACHIEVED':
      return 'success'
  }
}

/**
 * Pull the spec percentage out of {@link SOC2_PROGRESS_PERCENT}. Tiny
 * accessor so the UI doesn't reach into the constants object directly.
 */
export function soc2ProgressPercent(status: Soc2Status): number {
  return SOC2_PROGRESS_PERCENT[status]
}

/**
 * How many days have passed since the subprocessor was last reviewed.
 * Returns `null` for unparseable timestamps so the UI can show "—".
 */
export function daysSinceLastReview(
  subprocessor: Pick<Subprocessor, 'lastReviewedAt'>,
  now: Date,
): number | null {
  const t = new Date(subprocessor.lastReviewedAt).getTime()
  if (Number.isNaN(t)) return null
  const days = Math.floor((now.getTime() - t) / (24 * 60 * 60 * 1000))
  return Math.max(0, days)
}

/**
 * Is the subprocessor row past the review cadence? (Default 365 days.)
 *
 * The portal flags stale rows so the next Security review picks them
 * up first. Returns `false` for missing/unparseable timestamps so we
 * don't accidentally label a fresh row as stale.
 */
export function requiresSubprocessorReview(
  subprocessor: Pick<Subprocessor, 'lastReviewedAt'>,
  now: Date,
  intervalDays: number = SUBPROCESSOR_REVIEW_INTERVAL_DAYS,
): boolean {
  const days = daysSinceLastReview(subprocessor, now)
  if (days == null) return false
  return days > intervalDays
}

/**
 * Copy for one entry in the public change feed. Stable wording so the
 * portal + the email-to-enterprise notification stay aligned.
 */
export function describeSubprocessorChange(
  event: SubprocessorChangeEvent,
): string {
  switch (event.kind) {
    case 'ADDED':
      return `Added ${event.subprocessorName}`
    case 'REMOVED':
      return `Removed ${event.subprocessorName}`
    case 'PURPOSE_UPDATED':
      return `Updated ${event.subprocessorName} (purpose)`
    case 'JURISDICTION_CHANGED':
      return `Updated ${event.subprocessorName} (jurisdiction)`
  }
}

/**
 * Compact one-liner the portal renders under the hero. Pulls the SOC 2
 * label, the active-subprocessor count, and the policy version into one
 * scan-friendly summary.
 */
export function summarizeTrustSnapshot(snapshot: TrustPortalSnapshot): string {
  const soc2 = soc2StatusLabel(snapshot.soc2Status)
  const subproc = snapshot.activeSubprocessors.length
  const policyVersion = snapshot.dataHandlingPolicy.version
  return `${soc2} · ${subproc} active subprocessor${subproc === 1 ? '' : 's'} · policy ${policyVersion}`
}

/**
 * Decide whether a subprocessor change must trigger an enterprise
 * email. Spec calls for "Subprocessor changes auto-trigger a portal
 * update + email to enterprise customers".
 *
 * We email on ADDED + JURISDICTION_CHANGED (material) but not on
 * REMOVED or PURPOSE_UPDATED (housekeeping) - the portal still
 * reflects every change.
 */
export function shouldEmailEnterpriseOnChange(
  event: Pick<SubprocessorChangeEvent, 'kind'>,
): boolean {
  return event.kind === 'ADDED' || event.kind === 'JURISDICTION_CHANGED'
}
