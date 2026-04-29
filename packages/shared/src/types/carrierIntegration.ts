/**
 * Types for the direct-carrier-API integration program (P2 #12).
 *
 * Spec: docs/enhancements/P2-enhancements.md ("P2 #12 - Direct Carrier
 * API Integrations (Top 25 P&C)") - "BD-led: contract with the top 25
 * P&C carriers... Engineering-led: per-carrier integration adapters
 * following a shared interface."
 *
 * This is the multi-quarter moat-building program that compounds on the
 * P0 #1 freshness surface. Forward-compat scaffold ships the shared
 * adapter interface + the rollout-tracking shape so per-carrier impls
 * land later without touching shared types.
 */

/**
 * Where a carrier is on the integration ladder. The portal / internal
 * BD dashboard surfaces this as a horizontal progress strip.
 */
export type CarrierIntegrationStatus =
  | 'PROSPECT'                  // BD identified, no contact yet
  | 'IN_DISCUSSION'             // first BD call done
  | 'CONTRACT_SIGNED'           // BD done; engineering can start
  | 'INTEGRATION_IN_PROGRESS'   // adapter being built
  | 'PILOT'                     // live for a small set of agencies
  | 'LIVE'                      // generally available
  | 'DEPRECATED'                // we walked away

/**
 * Source of the appetite payload. Tagged on every appetite signal so
 * the report's freshness chip (P0 #1) shows the right provenance.
 */
export type AppetiteSource =
  | 'DIRECT_API'        // we called the carrier's API
  | 'PARTNER_FEED'      // contracted aggregator
  | 'INFERRED_PUBLIC'   // scraped / heuristic
  | 'MANUAL'            // analyst entered it

/**
 * One row on the carrier-integration program tracker. Covers BD
 * milestones (status, contract dates) and engineering milestones
 * (adapter version, last successful call) in one shape.
 */
export interface CarrierIntegrationRecord {
  /** Stable id (uuid). */
  id: string
  /** Carrier display name ("State Farm", "Travelers", "Liberty Mutual"). */
  carrierName: string
  /** NAIC code if known - the BD team uses this internally. */
  naicCode: string | null
  /** Where this row sits on the ladder. */
  status: CarrierIntegrationStatus
  /** ISO-8601 timestamp the contract was signed (null until signed). */
  contractSignedAt: string | null
  /** ISO-8601 timestamp the adapter went LIVE (null until live). */
  liveAt: string | null
  /** Adapter semver - drives breaking-change comms with downstream. */
  adapterVersion: string | null
  /** ISO-8601 timestamp of the last successful production call. */
  lastSuccessfulCallAt: string | null
  /** Owner inside BD (for the program tracker UI). */
  bdOwner: string | null
  /** Owner inside Engineering (for the program tracker UI). */
  engOwner: string | null
}

/**
 * One appetite update flowing in from a carrier integration. The
 * report renders one of these per (property, carrier) pair.
 */
export interface CarrierAppetiteUpdate {
  carrierName: string
  /** Source of the value - what the freshness chip on the report shows. */
  source: AppetiteSource
  /** 0..1 confidence that the value is currently correct. */
  confidence: number
  /** ISO-8601 timestamp the value was last refreshed at the source. */
  refreshedAt: string
  /** Snapshot of the appetite verdict. Stable enum so consumers can switch. */
  verdict: 'WRITING' | 'NON_WRITING' | 'UNKNOWN'
  /** Optional structured detail (line, sub-line, geography, etc). */
  detail?: Record<string, string | number | boolean | null>
}

/**
 * Adapter contract every per-carrier impl conforms to. Lives in shared
 * so the BD-tracker UI, the appetite ingest worker, and the freshness
 * chip can all see the same shape.
 */
export interface CarrierIntegrationAdapter {
  readonly carrierName: string
  readonly version: string
  /**
   * Pull the current appetite payload for a property. Returns `null`
   * for "no opinion" (carrier doesn't write in this geography, etc).
   */
  fetchAppetite(input: {
    propertyId: string
    addressLabel: string
  }): Promise<CarrierAppetiteUpdate | null>
}

/**
 * Aggregate program tracker - what a BD dashboard and the public trust
 * portal both render. Built from a flat list of {@link CarrierIntegrationRecord}.
 */
export interface CarrierIntegrationProgressSummary {
  /** Total target ("Top 25 P&C"). */
  target: number
  /** How many records are currently LIVE. */
  liveCount: number
  /** How many records are PILOT. */
  pilotCount: number
  /** How many records have a signed contract but no integration yet. */
  contractedCount: number
  /** How many records are deprecated (we walked away). */
  deprecatedCount: number
  /** 0..1 progress toward the target. */
  progressToTarget: number
}

/**
 * Spec milestones for the rollout. Q+2 / Q+4 / Q+6 in the spec - the
 * tracker UI surfaces the next one as a stretch goal. */
export const CARRIER_MILESTONES: ReadonlyArray<{
  liveCount: number
  label: string
  byQuarterOffset: number
}> = [
  { liveCount: 5,  label: '5 carriers live',  byQuarterOffset: 2 },
  { liveCount: 15, label: '15 carriers live', byQuarterOffset: 4 },
  { liveCount: 25, label: '25 carriers live', byQuarterOffset: 6 },
] as const

/** Spec target ("Top 25 P&C"). */
export const TARGET_TOP_25_P_AND_C = 25
