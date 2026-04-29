/**
 * Types for the disclosure-trail compliance feature (P2 #17).
 *
 * Spec: docs/enhancements/P2-enhancements.md ("P2 #17 â Disclosure-Trail
 * Compliance Feature for Realtors").
 *
 * A brokerage's compliance team needs proof that the realtor disclosed
 * insurability risk to the buyer at offer time. This reduces E&O
 * exposure on high-peril-state transactions.
 *
 * The flow is:
 *
 *   1. Realtor sends a CoverGuard share-link (P0 #2 dependency) to the
 *      buyer.
 *   2. The share-link includes a "I was shown this report on {date}"
 *      acknowledgment block.
 *   3. The buyer signs it (lightweight DocuSign-style â name + typed
 *      initials + IP/user-agent capture).
 *   4. The signed disclosure persists into the trust-portal storage
 *      bucket (P1 #11 dependency) and surfaces in the brokerage's
 *      compliance log.
 *
 * This module ships the contract for that flow plus the helpers that
 * compute the disclosure-log query + status transitions.
 */

/**
 * Lifecycle of a single disclosure between (realtor, buyer, property).
 *
 *   DRAFT    â realtor authored, not yet sent
 *   SENT     â share-link emailed
 *   VIEWED   â buyer opened the share-link (records `viewedAt`)
 *   SIGNED   â buyer typed name + initials and submitted
 *   EXPIRED  â share-link expired before signature
 *   REVOKED  â realtor revoked before signature (renegotiated, etc.)
 */
export type DisclosureStatus =
  | 'DRAFT'
  | 'SENT'
  | 'VIEWED'
  | 'SIGNED'
  | 'EXPIRED'
  | 'REVOKED'

/**
 * A single disclosure record. The `signature` field is null until the
 * buyer actually signs.
 */
export interface DisclosureRecord {
  id: string
  /** Property the report was generated for. */
  propertyId: string
  /** URN of the report version disclosed (`coverguard://report/{id}`). */
  reportUrn: string
  /** Realtor who initiated the disclosure. */
  realtorId: string
  /** Brokerage the realtor belongs to. */
  brokerageId: string
  /** Buyer-side identifying info captured at send time. */
  buyer: DisclosureBuyer
  /** Lifecycle state (see {@link DisclosureStatus}). */
  status: DisclosureStatus
  /** ISO-8601 timestamp when the realtor authored the disclosure. */
  createdAt: string
  /** ISO-8601 timestamp the share-link was emailed (null while DRAFT). */
  sentAt: string | null
  /** ISO-8601 timestamp the buyer first opened the link. */
  viewedAt: string | null
  /** ISO-8601 timestamp the buyer signed (null until SIGNED). */
  signedAt: string | null
  /** ISO-8601 timestamp the link expires. */
  expiresAt: string
  /** Cryptographic signature envelope (null until SIGNED). */
  signature: DisclosureSignature | null
}

/** Buyer-facing identifying info captured for the audit log. */
export interface DisclosureBuyer {
  email: string
  /** Optional friendly name shown on the signing screen. */
  fullName: string | null
}

/**
 * Cryptographic signature captured at sign time. The `signedText` is
 * the exact acknowledgment language the buyer agreed to â the spec
 * acceptance criterion requires it be in the audit log so the
 * brokerage's compliance team can defend the disclosure later.
 */
export interface DisclosureSignature {
  /** Buyer's typed name (verbatim, used to prove identity claim). */
  typedName: string
  /** Buyer's typed initials (often a 2-3 char shorthand). */
  typedInitials: string
  /** Acknowledgment language the buyer signed under. */
  signedText: string
  /** Buyer's IPv4/IPv6 address at sign time. */
  ipAddress: string
  /** Buyer's user-agent string at sign time. */
  userAgent: string
  /** SHA-256 digest binding all of the above + signedAt. */
  digestSha256: string
}

/**
 * Per-property log row used by the brokerage compliance dashboard.
 *
 * Includes the most recent disclosure plus a count of historical ones
 * for that property â most brokerages care about the latest signed
 * disclosure but want a count for the audit summary.
 */
export interface PropertyDisclosureLogRow {
  propertyId: string
  propertyAddressLine1: string
  propertyCity: string
  propertyState: string
  /** The most recent disclosure for this property (any status). */
  latest: DisclosureRecord
  /** Total disclosures across the property's history. */
  totalCount: number
  /** Number of those that reached SIGNED. */
  signedCount: number
}

/**
 * Spec acceptance criterion: the buyer must be able to sign in under
 * 30 seconds from the share-link email. `30s` is the soft target â
 * the actual measurement happens in the realtor compliance dashboard.
 */
export const DISCLOSURE_SIGN_TARGET_SECONDS = 30

/**
 * Default share-link lifetime. Brokerages can override per-org but the
 * out-of-the-box value is 14 days, which matches the most common
 * residential offer window.
 */
export const DEFAULT_DISCLOSURE_TTL_DAYS = 14

/**
 * Acknowledgment language template used in the signing card. The
 * brokerage's compliance team can override this from the trust-portal
 * settings (P1 #11 dependency); this is the default.
 *
 * The `{address}` and `{date}` tokens get replaced before render â
 * see `renderDisclosureText` in the utils file.
 */
export const DEFAULT_DISCLOSURE_TEXT_TEMPLATE =
  'I acknowledge that I was shown a CoverGuard insurability report ' +
  'for {address} on {date}, and I confirm that I have read it.'

/** Hash algorithm used for {@link DisclosureSignature.digestSha256}. */
export const DISCLOSURE_DIGEST_ALGORITHM = 'SHA-256' as const
