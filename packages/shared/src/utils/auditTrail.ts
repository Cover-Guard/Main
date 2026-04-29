/**
 * Audit-trail + LOS-adapter helpers (P2 #14).
 *
 * Spec: docs/enhancements/P2-enhancements.md.
 *
 * The audit trail is the regulatory artifact in this PR â every action
 * touching the loan file is captured as a signed entry, and the
 * signatures form a hash chain so a verifier can detect any insertion
 * or edit. This file ships:
 *
 *   - LOS provider display copy + capability lookups (mirroring the
 *     P1 #6 amsAdapter helpers).
 *   - Pure functions for the audit chain: canonical encoding, chain
 *     verification, retention math, summarization for the timeline UI.
 *
 * Pure / I/O-free â the actual SHA-256 computation happens server-side
 * in `apps/api/src/integrations/audit/`. The web layer renders the
 * pre-computed digest and runs `verifyAuditChain` against the loaded
 * entries to render a "chain intact" badge.
 */
import {
  type AuditActor,
  type AuditEventType,
  type AuditTrailEntry,
  type LenderConnection,
  type LosCapabilities,
  type LosConnectionStatus,
  type LosProvider,
  AUDIT_RETENTION_YEARS,
  LOS_CAPABILITIES,
} from '../types/lenderIntegration'

// =============================================================================
// LOS provider helpers (mirror amsAdapter.ts)
// =============================================================================

export function losProviderLabel(provider: LosProvider): string {
  switch (provider) {
    case 'ENCOMPASS': return 'Encompass'
    case 'BYTEPRO':   return 'BytePro'
  }
}

export function getLosCapabilities(provider: LosProvider): LosCapabilities {
  return LOS_CAPABILITIES[provider]
}

/** Whether the LOS adapter is currently shipped + connectable. */
export function isLosProviderAvailable(
  provider: LosProvider,
  releaseFlags: { encompassEnabled: boolean; byteProEnabled: boolean },
): boolean {
  switch (provider) {
    case 'ENCOMPASS': return releaseFlags.encompassEnabled
    case 'BYTEPRO':   return releaseFlags.byteProEnabled
  }
}

export interface LosStatusCopy {
  label: string
  description: string
  variant: 'neutral' | 'progress' | 'success' | 'warning' | 'danger'
}

export function losStatusCopy(status: LosConnectionStatus): LosStatusCopy {
  switch (status) {
    case 'NOT_CONNECTED':
      return {
        label: 'Not connected',
        description: 'No active connection to this LOS.',
        variant: 'neutral',
      }
    case 'CONNECTING':
      return {
        label: 'Connecting',
        description: 'OAuth flow in progress.',
        variant: 'progress',
      }
    case 'CONNECTED':
      return {
        label: 'Connected',
        description: 'Reports will attach to the loan file automatically.',
        variant: 'success',
      }
    case 'DEGRADED':
      return {
        label: 'Issue detected',
        description: 'Most recent sync failed â re-authorize this LOS.',
        variant: 'warning',
      }
    case 'EXPIRED':
      return {
        label: 'Re-auth required',
        description: 'Token expired and could not refresh â reconnect to resume.',
        variant: 'danger',
      }
    case 'DISCONNECTED':
      return {
        label: 'Disconnected',
        description: 'Connection was disconnected.',
        variant: 'neutral',
      }
  }
}

/** Whether a connection is currently capable of receiving push events. */
export function isLenderConnectionPushable(connection: LenderConnection): boolean {
  return connection.status === 'CONNECTED'
}

// =============================================================================
// Audit-trail helpers
// =============================================================================

/**
 * Display copy for an event type. The text is what regulators read in
 * the export, so it's intentionally formal.
 */
export function auditEventLabel(eventType: AuditEventType): string {
  switch (eventType) {
    case 'REPORT_GENERATED':       return 'Report generated'
    case 'REPORT_ATTACHED_TO_LOAN': return 'Report attached to loan file'
    case 'REPORT_VIEWED':          return 'Report viewed'
    case 'REPORT_EXPORTED':        return 'Report exported'
    case 'CONNECTION_CREATED':     return 'LOS connection created'
    case 'CONNECTION_REVOKED':     return 'LOS connection revoked'
    case 'DATA_SOURCE_REFRESHED':  return 'Data source refreshed'
    case 'LEAD_OFFERED':           return 'Lead offered to producer'
    case 'LEAD_ACCEPTED':          return 'Producer accepted lead'
    case 'LEAD_DECLINED':          return 'Producer declined lead'
    case 'LEAD_EXPIRED':           return 'Lead expired without acceptance'
    case 'LEAD_REFUNDED':          return 'Producer refunded lead'
  }
}

/** Display string for the actor (used in the timeline). */
export function auditActorLabel(actor: AuditActor): string {
  switch (actor.kind) {
    case 'USER':        return actor.email
    case 'INTEGRATION': return `${losProviderLabel(actor.provider)} integration`
    case 'SYSTEM':      return `System (${actor.subsystem})`
  }
}

/**
 * Canonical string used as the SHA-256 input for the audit signature.
 *
 * Format is **stable** â order-of-fields and separator choice must
 * never change without bumping `AUDIT_DIGEST_ALGORITHM`, since the
 * digest in already-persisted entries depends on it.
 *
 * Pipe-separated, with a `metadata` block sorted by key. Newlines are
 * stripped from values (defense against an attacker constructing
 * collisions by smuggling them in).
 */
export function auditEntryDigestInput(
  entry: Pick<AuditTrailEntry, 'id' | 'occurredAt' | 'actor' | 'eventType' | 'resourceUrn' | 'metadata' | 'signature'>,
): string {
  const stripNewlines = (v: string) => v.replace(/\r?\n/g, ' ')
  const actorString =
    entry.actor.kind === 'USER'
      ? `USER:${entry.actor.userId}:${entry.actor.email}`
      : entry.actor.kind === 'INTEGRATION'
        ? `INTEGRATION:${entry.actor.provider}:${entry.actor.connectionId}`
        : `SYSTEM:${entry.actor.subsystem}`
  const metadataString = Object.keys(entry.metadata)
    .sort()
    .map((k) => `${k}=${stripNewlines(entry.metadata[k] ?? '')}`)
    .join('&')
  return [
    entry.id,
    entry.occurredAt,
    actorString,
    entry.eventType,
    entry.resourceUrn,
    metadataString,
    entry.signature.prevDigest ?? '',
  ].map(stripNewlines).join('|')
}

/**
 * Walk the chain forwards: every entry's `prevDigest` must match the
 * previous entry's `digest`, and every entry's `digest` must match the
 * value computed from {@link auditEntryDigestInput} (caller supplies
 * the hash function so the helper stays pure / sync).
 *
 * The first entry's `prevDigest` must be `null`.
 *
 * Returns the index of the first broken entry, or `-1` if the chain is
 * intact.
 */
export function verifyAuditChain(
  entries: AuditTrailEntry[],
  hashFn: (input: string) => string,
): number {
  let prev: string | null = null
  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i]!
    if (entry.signature.prevDigest !== prev) return i
    const expected = hashFn(auditEntryDigestInput(entry))
    if (entry.signature.digest !== expected) return i
    prev = entry.signature.digest
  }
  return -1
}

/**
 * Whether an entry is still inside the retention window. The settings
 * page uses this to render an "expiring soon" pill when the entry is
 * within 30 days of falling off the end of the window.
 */
export function isAuditEntryFresh(
  entry: Pick<AuditTrailEntry, 'occurredAt'>,
  now: Date = new Date(),
  retentionYears: number = AUDIT_RETENTION_YEARS,
): boolean {
  const occurred = new Date(entry.occurredAt).getTime()
  const cutoff = now.getTime() - retentionYears * 365 * 24 * 60 * 60 * 1000
  return occurred >= cutoff
}

/** Group entries into ISO-date buckets, preserving order within each day. */
export function groupAuditEntriesByDay(
  entries: AuditTrailEntry[],
): Array<{ date: string; entries: AuditTrailEntry[] }> {
  const buckets = new Map<string, AuditTrailEntry[]>()
  const order: string[] = []
  for (const entry of entries) {
    const date = entry.occurredAt.slice(0, 10) // ISO-8601 â YYYY-MM-DD
    if (!buckets.has(date)) {
      buckets.set(date, [])
      order.push(date)
    }
    buckets.get(date)!.push(entry)
  }
  return order.map((date) => ({ date, entries: buckets.get(date)! }))
}

/**
 * Roll-up of the trail used by the dashboard summary card.
 */
export interface AuditTrailSummary {
  totalEntries: number
  byEventType: Record<AuditEventType, number>
  earliest: string | null
  latest: string | null
}

export function summarizeAuditTrail(entries: AuditTrailEntry[]): AuditTrailSummary {
  const byEventType: Record<AuditEventType, number> = {
    REPORT_GENERATED: 0,
    REPORT_ATTACHED_TO_LOAN: 0,
    REPORT_VIEWED: 0,
    REPORT_EXPORTED: 0,
    CONNECTION_CREATED: 0,
    CONNECTION_REVOKED: 0,
    DATA_SOURCE_REFRESHED: 0,
    LEAD_OFFERED: 0,
    LEAD_ACCEPTED: 0,
    LEAD_DECLINED: 0,
    LEAD_EXPIRED: 0,
    LEAD_REFUNDED: 0,
  }
  let earliest: string | null = null
  let latest: string | null = null
  for (const entry of entries) {
    byEventType[entry.eventType]++
    if (!earliest || entry.occurredAt < earliest) earliest = entry.occurredAt
    if (!latest || entry.occurredAt > latest) latest = entry.occurredAt
  }
  return { totalEntries: entries.length, byEventType, earliest, latest }
}
