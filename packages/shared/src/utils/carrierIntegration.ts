/**
 * Pure helpers for the direct-carrier-API integration program (P2 #12).
 *
 * Drives the BD program tracker + the public trust portal's "live
 * carrier integrations" rollup + the appetite freshness chip on the
 * property report.
 */

import {
  CARRIER_MILESTONES,
  TARGET_TOP_25_P_AND_C,
  type AppetiteSource,
  type CarrierAppetiteUpdate,
  type CarrierIntegrationProgressSummary,
  type CarrierIntegrationRecord,
  type CarrierIntegrationStatus,
} from '../types/carrierIntegration'

/** Human-readable label for the BD ladder. */
export function integrationStatusLabel(status: CarrierIntegrationStatus): string {
  switch (status) {
    case 'PROSPECT':                return 'Prospect'
    case 'IN_DISCUSSION':           return 'In discussion'
    case 'CONTRACT_SIGNED':         return 'Contract signed'
    case 'INTEGRATION_IN_PROGRESS': return 'Integration in progress'
    case 'PILOT':                   return 'Pilot'
    case 'LIVE':                    return 'Live'
    case 'DEPRECATED':              return 'Deprecated'
  }
}

/**
 * Coarse percentage we surface on a single carrier row. Drives the
 * mini-progress-bar inside the BD tracker.
 */
export function integrationProgressForStatus(
  status: CarrierIntegrationStatus,
): number {
  switch (status) {
    case 'PROSPECT':                return 0
    case 'IN_DISCUSSION':           return 15
    case 'CONTRACT_SIGNED':         return 35
    case 'INTEGRATION_IN_PROGRESS': return 60
    case 'PILOT':                   return 85
    case 'LIVE':                    return 100
    case 'DEPRECATED':              return 0
  }
}

/**
 * UI tone for the status pill. Centralized so the BD tracker and the
 * trust portal can never drift on color.
 */
export function integrationStatusTone(
  status: CarrierIntegrationStatus,
): 'neutral' | 'progress' | 'success' | 'danger' {
  switch (status) {
    case 'DEPRECATED':
      return 'danger'
    case 'LIVE':
      return 'success'
    case 'PILOT':
    case 'INTEGRATION_IN_PROGRESS':
    case 'CONTRACT_SIGNED':
    case 'IN_DISCUSSION':
      return 'progress'
    case 'PROSPECT':
      return 'neutral'
  }
}

/**
 * Count records that match a given status. Stable so the BD tracker
 * doesn't reach for `.filter(...).length` on every render.
 */
export function countByStatus(
  records: readonly CarrierIntegrationRecord[],
  status: CarrierIntegrationStatus,
): number {
  let total = 0
  for (const r of records) if (r.status === status) total += 1
  return total
}

/** Convenience for the most common counter. */
export function countLiveIntegrations(
  records: readonly CarrierIntegrationRecord[],
): number {
  return countByStatus(records, 'LIVE')
}

/**
 * Build the {@link CarrierIntegrationProgressSummary} the BD dashboard
 * + the trust portal both render.
 */
export function summarizeIntegrationProgress(
  records: readonly CarrierIntegrationRecord[],
  target: number = TARGET_TOP_25_P_AND_C,
): CarrierIntegrationProgressSummary {
  const liveCount = countByStatus(records, 'LIVE')
  const pilotCount = countByStatus(records, 'PILOT')
  const contractedCount =
    countByStatus(records, 'CONTRACT_SIGNED') +
    countByStatus(records, 'INTEGRATION_IN_PROGRESS')
  const deprecatedCount = countByStatus(records, 'DEPRECATED')
  const progressToTarget = target <= 0 ? 0 : Math.min(1, liveCount / target)
  return {
    target,
    liveCount,
    pilotCount,
    contractedCount,
    deprecatedCount,
    progressToTarget,
  }
}

/**
 * Pick the next milestone (5 -> 15 -> 25 -> done). Returns `null` once
 * we've cleared the final spec milestone so the dashboard can switch
 * to "All milestones cleared".
 */
export function nextMilestone(
  liveCount: number,
):
  | { liveCount: number; label: string; byQuarterOffset: number }
  | null {
  for (const m of CARRIER_MILESTONES) {
    if (liveCount < m.liveCount) return m
  }
  return null
}

/**
 * Should we trust this appetite update enough to surface it on the
 * report? Returns true when:
 *  - It came from a DIRECT_API source, OR
 *  - confidence >= 0.7 from a PARTNER_FEED, OR
 *  - confidence >= 0.85 from any other source (INFERRED / MANUAL)
 *
 * The freshness chip (P0 #1) renders the source either way; this gate
 * decides whether a row actually appears in the carriers section.
 */
export function shouldRenderAppetiteUpdate(
  update: Pick<CarrierAppetiteUpdate, 'source' | 'confidence'>,
): boolean {
  switch (update.source) {
    case 'DIRECT_API':
      return true
    case 'PARTNER_FEED':
      return update.confidence >= 0.7
    case 'INFERRED_PUBLIC':
    case 'MANUAL':
      return update.confidence >= 0.85
  }
}

/**
 * Human-readable label for the freshness chip. Keeps the report and
 * the BD tracker aligned on terminology.
 */
export function appetiteSourceLabel(source: AppetiteSource): string {
  switch (source) {
    case 'DIRECT_API':      return 'Direct carrier API'
    case 'PARTNER_FEED':    return 'Partner feed'
    case 'INFERRED_PUBLIC': return 'Public sources'
    case 'MANUAL':          return 'Analyst review'
  }
}
