/**
 * Helpers for the disclosure-trail compliance feature (P2 #17).
 *
 * Spec: docs/enhancements/P2-enhancements.md.
 *
 * Pure / I/O-free â the actual signing flow + storage live under
 * `apps/api/src/integrations/disclosure/`. This file is the shared
 * computation layer:
 *
 *   - Render the disclosure-acknowledgment text from the template.
 *   - Validate transitions through the disclosure status state machine.
 *   - Build the canonical input for the SHA-256 signature digest.
 *   - Validate buyer-typed name / initials before submit.
 *   - Bucket how long the buyer took to sign (against the 30s spec
 *     target) so the compliance dashboard can render a perf chip.
 *   - Group disclosure records into per-property log rows.
 */
import {
  type DisclosureBuyer,
  type DisclosureRecord,
  type DisclosureSignature,
  type DisclosureStatus,
  type PropertyDisclosureLogRow,
  DEFAULT_DISCLOSURE_TEXT_TEMPLATE,
  DEFAULT_DISCLOSURE_TTL_DAYS,
  DISCLOSURE_SIGN_TARGET_SECONDS,
} from '../types/disclosure'

// =============================================================================
// State machine
// =============================================================================

/**
 * Adjacency table for legal disclosure transitions. Centralized so
 * the realtor UI, the buyer signing UI, and the API guard all read
 * identically.
 *
 *   DRAFT    -> SENT, REVOKED
 *   SENT     -> VIEWED, EXPIRED, REVOKED
 *   VIEWED   -> SIGNED, EXPIRED, REVOKED
 *   SIGNED   -> (terminal)
 *   EXPIRED  -> (terminal)
 *   REVOKED  -> (terminal)
 */
const TRANSITIONS: Record<DisclosureStatus, DisclosureStatus[]> = {
  DRAFT:   ['SENT', 'REVOKED'],
  SENT:    ['VIEWED', 'EXPIRED', 'REVOKED'],
  VIEWED:  ['SIGNED', 'EXPIRED', 'REVOKED'],
  SIGNED:  [],
  EXPIRED: [],
  REVOKED: [],
}

export function canTransitionDisclosure(
  from: DisclosureStatus,
  to: DisclosureStatus,
): boolean {
  return TRANSITIONS[from].includes(to)
}

/**
 * Display copy + variant for the status badge. Used on the realtor
 * dashboard and in the brokerage compliance log.
 */
export function disclosureStatusCopy(status: DisclosureStatus): {
  label: string
  variant: 'neutral' | 'progress' | 'success' | 'warning' | 'danger'
} {
  switch (status) {
    case 'DRAFT':   return { label: 'Draft',           variant: 'neutral' }
    case 'SENT':    return { label: 'Sent',            variant: 'progress' }
    case 'VIEWED':  return { label: 'Viewed',          variant: 'progress' }
    case 'SIGNED':  return { label: 'Signed',          variant: 'success' }
    case 'EXPIRED': return { label: 'Expired',         variant: 'warning' }
    case 'REVOKED': return { label: 'Revoked',         variant: 'danger' }
  }
}

// =============================================================================
// Template rendering
// =============================================================================

/**
 * Render the acknowledgment language with the property address +
 * today's date filled in. Brokerages may pass a custom template; we
 * default to {@link DEFAULT_DISCLOSURE_TEXT_TEMPLATE}.
 *
 * `dateOverride` is for tests + deterministic snapshot behavior.
 */
export function renderDisclosureText(args: {
  address: string
  template?: string
  date?: Date
}): string {
  const template = args.template ?? DEFAULT_DISCLOSURE_TEXT_TEMPLATE
  const d = args.date ?? new Date()
  const formatted = d.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
  return template
    .replace('{address}', args.address)
    .replace('{date}', formatted)
}

// =============================================================================
// Signature digest
// =============================================================================

/**
 * Canonical input the SHA-256 digest is computed over. The format is
 * **stable** â order-of-fields and separator must never change without
 * bumping `DISCLOSURE_DIGEST_ALGORITHM`, since the digest in already-
 * signed records depends on it.
 *
 * Newlines are stripped from values so an attacker can't smuggle them
 * in to construct collisions (mirrors the audit-trail digest helper
 * we shipped in P2 #14).
 */
export function disclosureDigestInput(args: {
  recordId: string
  reportUrn: string
  buyer: DisclosureBuyer
  signedText: string
  typedName: string
  typedInitials: string
  ipAddress: string
  userAgent: string
  signedAt: string
}): string {
  const stripNewlines = (v: string) => v.replace(/\r?\n/g, ' ')
  return [
    args.recordId,
    args.reportUrn,
    args.buyer.email,
    args.buyer.fullName ?? '',
    args.typedName,
    args.typedInitials,
    args.signedText,
    args.ipAddress,
    args.userAgent,
    args.signedAt,
  ]
    .map(stripNewlines)
    .join('|')
}

// =============================================================================
// Buyer input validation
// =============================================================================

export type DisclosureSubmitValidation =
  | { ok: true }
  | {
      ok: false
      reason:
        | 'EMPTY_NAME'
        | 'EMPTY_INITIALS'
        | 'NAME_DOES_NOT_MATCH_INITIALS'
        | 'NAME_TOO_SHORT'
    }

/**
 * Validate the buyer's typed-name + typed-initials before submit. The
 * signing UI calls this on the submit handler so we don't accept an
 * empty signature or initials that obviously don't match the typed
 * name (a common mistake).
 *
 * "Match" is permissive: we just require each initial character to
 * appear (in any case, in any order) in the typed name. This catches
 * typos without rejecting legitimate name styles like middle names.
 */
export function validateDisclosureSubmit(args: {
  typedName: string
  typedInitials: string
}): DisclosureSubmitValidation {
  const name = args.typedName.trim()
  const initials = args.typedInitials.trim()
  if (name.length === 0) return { ok: false, reason: 'EMPTY_NAME' }
  if (initials.length === 0) return { ok: false, reason: 'EMPTY_INITIALS' }
  if (name.length < 2) return { ok: false, reason: 'NAME_TOO_SHORT' }
  const nameLetters = new Set(
    name
      .toLowerCase()
      .split('')
      .filter((c) => /[a-z]/.test(c)),
  )
  for (const ch of initials.toLowerCase()) {
    if (!/[a-z]/.test(ch)) continue
    if (!nameLetters.has(ch)) {
      return { ok: false, reason: 'NAME_DOES_NOT_MATCH_INITIALS' }
    }
  }
  return { ok: true }
}

// =============================================================================
// Performance: sign-time bucketing
// =============================================================================

export type DisclosureSignBucket = 'FAST' | 'OK' | 'SLOW'

/**
 * Bucket how long the buyer took (in seconds) against the spec's 30s
 * target. The realtor dashboard renders a chip per disclosure so the
 * brokerage can see if their signing UX is slowing transactions.
 *
 *   <= 30s        => FAST
 *   31-60s        => OK
 *   > 60s         => SLOW
 */
export function classifyDisclosureSignTime(elapsedSeconds: number): DisclosureSignBucket {
  if (elapsedSeconds <= DISCLOSURE_SIGN_TARGET_SECONDS) return 'FAST'
  if (elapsedSeconds <= DISCLOSURE_SIGN_TARGET_SECONDS * 2) return 'OK'
  return 'SLOW'
}

/**
 * Compute the signing duration from the record's timestamps. Returns
 * `null` if the record never reached SIGNED (no signedAt timestamp).
 */
export function disclosureSignDurationSeconds(
  record: Pick<DisclosureRecord, 'sentAt' | 'signedAt'>,
): number | null {
  if (!record.sentAt || !record.signedAt) return null
  const sent = new Date(record.sentAt).getTime()
  const signed = new Date(record.signedAt).getTime()
  return Math.max(0, Math.round((signed - sent) / 1000))
}

// =============================================================================
// Expiry helpers
// =============================================================================

/** Default expiry timestamp from a creation timestamp. */
export function defaultDisclosureExpiry(
  createdAt: string,
  ttlDays: number = DEFAULT_DISCLOSURE_TTL_DAYS,
): string {
  const created = new Date(createdAt).getTime()
  const ms = ttlDays * 24 * 60 * 60 * 1000
  return new Date(created + ms).toISOString()
}

/**
 * Whether a disclosure should be auto-expired on this tick. Used by
 * the cron that walks SENT/VIEWED rows once an hour.
 */
export function isDisclosureExpired(
  record: Pick<DisclosureRecord, 'status' | 'expiresAt'>,
  now: Date = new Date(),
): boolean {
  if (record.status === 'SIGNED' || record.status === 'REVOKED') return false
  return new Date(record.expiresAt).getTime() <= now.getTime()
}

// =============================================================================
// Compliance log roll-up
// =============================================================================

/**
 * Group records by property and produce one log row per property â
 * what the brokerage compliance dashboard renders.
 *
 * Within a property, the "latest" disclosure is the one with the
 * highest `createdAt`. Total + signed counts are computed in the same
 * pass (so the dashboard can render counts without a separate query).
 */
export function buildPropertyDisclosureLog(
  records: readonly DisclosureRecord[],
  propertyMeta: ReadonlyMap<
    string,
    { addressLine1: string; city: string; state: string }
  >,
): PropertyDisclosureLogRow[] {
  const byProperty = new Map<string, DisclosureRecord[]>()
  for (const r of records) {
    const arr = byProperty.get(r.propertyId)
    if (arr) {
      arr.push(r)
    } else {
      byProperty.set(r.propertyId, [r])
    }
  }
  const out: PropertyDisclosureLogRow[] = []
  for (const [propertyId, recs] of byProperty.entries()) {
    const meta = propertyMeta.get(propertyId)
    if (!meta) continue
    const sorted = [...recs].sort((a, b) =>
      a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0,
    )
    const latest = sorted[0]!
    const signedCount = recs.filter((r) => r.status === 'SIGNED').length
    out.push({
      propertyId,
      propertyAddressLine1: meta.addressLine1,
      propertyCity: meta.city,
      propertyState: meta.state,
      latest,
      totalCount: recs.length,
      signedCount,
    })
  }
  // Sort by latest.createdAt desc â most recent property activity first.
  out.sort((a, b) =>
    a.latest.createdAt < b.latest.createdAt
      ? 1
      : a.latest.createdAt > b.latest.createdAt
        ? -1
        : 0,
  )
  return out
}

/**
 * Whether a record is exportable as a PDF for the brokerage's audit
 * binder. We only export SIGNED disclosures â the rest are not legally
 * meaningful.
 */
export function isDisclosureExportable(
  record: Pick<DisclosureRecord, 'status' | 'signature'>,
): boolean {
  return record.status === 'SIGNED' && record.signature !== null
}

/**
 * Mirror of the SIGNED record's signature with the IP/user-agent
 * truncated for display. Used by the realtor's signature-preview UI.
 */
export function maskedSignaturePreview(
  signature: DisclosureSignature,
): { typedName: string; ipMasked: string; uaMasked: string; digestPrefix: string } {
  return {
    typedName: signature.typedName,
    ipMasked: signature.ipAddress
      .split('.')
      .map((segment, i) => (i >= 2 ? 'xxx' : segment))
      .join('.'),
    uaMasked: signature.userAgent.slice(0, 32) + (signature.userAgent.length > 32 ? 'â¦' : ''),
    digestPrefix: signature.digestSha256.slice(0, 12),
  }
}
