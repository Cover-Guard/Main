/**
 * Types for the Lender / LOS integration program (P2 #14).
 *
 * Spec: docs/enhancements/P2-enhancements.md ("P2 #14 â Lender / LOS
 * Integration + Audit Trail").
 *
 * The lender wedge is structurally similar to the AMS integration (P1
 * #6) â a per-tenant connection plus a per-vendor capability table â
 * but with one big addition: every action that touches the loan file
 * has to be captured in a tamper-evident **audit trail** that can pass
 * a regulatory examination (immutable storage, signed timestamps,
 * exportable).
 *
 * This file ships the contract for both halves:
 *
 *   1. `LenderConnection` + `LosProvider` â the connection lifecycle.
 *   2. `AuditTrailEntry` + `AuditSignature` â the tamper-evident log.
 *
 * The signature uses a hash chain (each entry includes the digest of
 * the previous entry) so a verifier can detect any insertion or edit
 * by walking the chain. Real-world deployment will pair this with
 * append-only storage + signed timestamps from a third-party TSA.
 */

/** Which LOS / lender platform the connection talks to. */
export type LosProvider =
  | 'ENCOMPASS' // Phase 1 (ICE Mortgage Technology)
  | 'BYTEPRO'   // Phase 2 (Byte Software)

/** Lifecycle of a connection between CoverGuard and a lender's LOS tenant. */
export type LosConnectionStatus =
  | 'NOT_CONNECTED'
  | 'CONNECTING'
  | 'CONNECTED'
  | 'DEGRADED'
  | 'EXPIRED'
  | 'DISCONNECTED'

/** Per-vendor capability flags. */
export interface LosCapabilities {
  /** Vendor lets us attach a PDF to the loan file. */
  loanFileAttachments: boolean
  /** Vendor exposes loan metadata (LOS data fields) via API. */
  loanMetadataRead: boolean
  /** Vendor supports webhook events when loan state changes. */
  webhooksAvailable: boolean
}

/** Persisted connection between a CoverGuard tenant and an LOS tenant. */
export interface LenderConnection {
  id: string
  organizationId: string
  provider: LosProvider
  status: LosConnectionStatus
  /** Vendor's tenant id (e.g. Encompass instance id). */
  providerTenantId: string
  /** ISO-8601 timestamp of the most recent successful API call. */
  lastSyncAt: string | null
  /** ISO-8601 timestamp of the connection-creation. */
  createdAt: string
}

// =============================================================================
// Audit trail
// =============================================================================

/**
 * Event classes recorded in the audit trail. Names are stable â
 * downstream regulators search on them in exports.
 */
export type AuditEventType =
  | 'REPORT_GENERATED'
  | 'REPORT_ATTACHED_TO_LOAN'
  | 'REPORT_VIEWED'
  | 'REPORT_EXPORTED'
  | 'CONNECTION_CREATED'
  | 'CONNECTION_REVOKED'
  | 'DATA_SOURCE_REFRESHED'
  | 'LEAD_OFFERED'
  | 'LEAD_ACCEPTED'
  | 'LEAD_DECLINED'
  | 'LEAD_EXPIRED'
  | 'LEAD_REFUNDED'

/**
 * The cryptographic envelope around each entry. We chain the digests
 * (`prevDigest` points at the prior entry's `digest`) so the chain can
 * be verified end-to-end without trusting the database.
 */
export interface AuditSignature {
  /** Hash algorithm used to compute `digest`. */
  algorithm: 'SHA-256'
  /** Hex-encoded digest of `auditEntryDigestInput(entry)`. */
  digest: string
  /** Hex-encoded digest of the previous entry, or `null` for the first. */
  prevDigest: string | null
  /** ISO-8601 timestamp at which the digest was computed. */
  signedAt: string
}

/**
 * One row in the audit trail. Fields that name a *resource* live as
 * URN-style strings (`coverguard://report/{id}`) so the trail stays
 * portable across schema migrations.
 */
export interface AuditTrailEntry {
  id: string
  /** ISO-8601 timestamp at which the underlying action happened. */
  occurredAt: string
  /** Who triggered the action (user, integration, system). */
  actor: AuditActor
  /** What kind of action this was. */
  eventType: AuditEventType
  /** URN of the resource the action touched (`coverguard://...`). */
  resourceUrn: string
  /**
   * Free-form metadata. Kept opaque on purpose â schema lives in the
   * event-type registry and is enforced at write time, not in this
   * shared type.
   */
  metadata: Record<string, string>
  /** Tamper-evident envelope. */
  signature: AuditSignature
}

/** Actor in an audit entry. */
export type AuditActor =
  | { kind: 'USER'; userId: string; email: string }
  | { kind: 'INTEGRATION'; provider: LosProvider; connectionId: string }
  | { kind: 'SYSTEM'; subsystem: string }

/**
 * Default retention window. Mortgage regulators expect at least 3
 * years; we ship 7 to cover the most conservative reading of state
 * lender-record-retention statutes.
 */
export const AUDIT_RETENTION_YEARS = 7

/** Hash algorithm used for the signature chain. */
export const AUDIT_DIGEST_ALGORITHM = 'SHA-256' as const

/** Per-vendor capability table. */
export const LOS_CAPABILITIES: Record<LosProvider, LosCapabilities> = {
  ENCOMPASS: {
    loanFileAttachments: true,
    loanMetadataRead:    true,
    webhooksAvailable:   true,
  },
  BYTEPRO: {
    loanFileAttachments: true,
    loanMetadataRead:    true,
    webhooksAvailable:   false, // BytePro is poll-only
  },
}
