/**
 * Agent-directory flow orchestration (P2 #18 follow-up).
 *
 * Spec: docs/enhancements/P2-enhancements.md ("P2 #18 — Agent Directory /
 * Referral Handoff").
 *
 * Day 18 (PR #339) shipped the matching primitives (eligibility, ranking,
 * scoring, tier, pricing) and the buyer-facing card. This module is the
 * **composition layer**: pure I/O-free helpers that take the matcher output
 * and produce the side-effect-shaped values the API will persist.
 *
 *   - `createLeadHandoff` — turn a (producer, lead) pair into a PENDING
 *     `LeadHandoff` row with the right expiry + tier-priced billing.
 *   - `acceptHandoff` / `declineHandoff` / `expirePendingHandoff` /
 *     `claimRefund` — pure transitions on a `LeadHandoff`. Each one
 *     validates the transition through `canTransitionHandoff` and refuses
 *     to mutate if it's illegal (defense in depth — the API guards against
 *     this too).
 *   - `auditEventForHandoff` — build the `AuditTrailEntry` shell that the
 *     API signs + persists, re-using the PR #332 audit-trail digest
 *     pattern. Each handoff lifecycle event emits one row (LEAD_OFFERED on
 *     create, LEAD_ACCEPTED / LEAD_DECLINED / LEAD_EXPIRED / LEAD_REFUNDED
 *     on transition).
 *
 * Pure / I/O-free — Stripe billing + Prisma persistence + producer
 * notification land in `apps/api/src/integrations/agent-directory/`.
 */
import {
  type AuditEventType,
  type AuditTrailEntry,
} from '../types/lenderIntegration'
import {
  type BuyerLead,
  type LeadHandoff,
  type LeadHandoffStatus,
  type Producer,
  LEAD_HANDOFF_TTL_HOURS,
} from '../types/agentDirectory'
import {
  canTransitionHandoff,
  defaultHandoffExpiry,
  handoffPriceCents,
  refundEligibility,
} from './agentDirectory'

// ============================================================================
// Lifecycle constructors / mutators
// ============================================================================

/**
 * Build a PENDING `LeadHandoff` for a (producer, lead) pair. The
 * matcher service calls this after `selectMatchForLead` picks the
 * candidate.
 *
 * `idGenerator` is injectable so callers (route handler, test) can
 * supply a deterministic id. Defaults to a coverguard-prefixed string
 * shape so the row id is greppable in logs.
 */
export function createLeadHandoff(args: {
  producer: Producer
  lead: BuyerLead
  now: string
  idGenerator?: () => string
}): LeadHandoff {
  const id = args.idGenerator
    ? args.idGenerator()
    : `handoff_${args.producer.id}_${args.lead.id}`
  return {
    id,
    leadId: args.lead.id,
    producerId: args.producer.id,
    status: 'PENDING',
    priceCents: handoffPriceCents(args.producer),
    createdAt: args.now,
    acceptedAt: null,
    declinedAt: null,
    expiresAt: defaultHandoffExpiry(args.now, LEAD_HANDOFF_TTL_HOURS),
    refundedAt: null,
    refundReason: null,
  }
}

/**
 * Pure transition: PENDING → ACCEPTED. Returns the mutated handoff or
 * throws an `IllegalHandoffTransition` error if the current state
 * isn't PENDING.
 */
export function acceptHandoff(handoff: LeadHandoff, now: string): LeadHandoff {
  assertTransition(handoff.status, 'ACCEPTED')
  return { ...handoff, status: 'ACCEPTED', acceptedAt: now }
}

export function declineHandoff(handoff: LeadHandoff, now: string): LeadHandoff {
  assertTransition(handoff.status, 'DECLINED')
  return { ...handoff, status: 'DECLINED', declinedAt: now }
}

export function expirePendingHandoff(handoff: LeadHandoff): LeadHandoff {
  assertTransition(handoff.status, 'EXPIRED')
  return { ...handoff, status: 'EXPIRED' }
}

/**
 * Refund claim: ACCEPTED → REFUNDED, gated by `refundEligibility`.
 *
 * Returns the mutated handoff. Throws `IllegalHandoffTransition` if
 * the state machine forbids the move; throws `RefundIneligibleError`
 * if the 7-day refund window has closed (giving the API a structured
 * way to surface the right copy to the producer).
 */
export function claimRefund(args: {
  handoff: LeadHandoff
  now: Date
  reason: string
}): LeadHandoff {
  assertTransition(args.handoff.status, 'REFUNDED')
  const eligibility = refundEligibility(args.handoff, args.now)
  if (!eligibility.eligible) {
    throw new RefundIneligibleError(eligibility.reason ?? 'NOT_ACCEPTED')
  }
  return {
    ...args.handoff,
    status: 'REFUNDED',
    refundedAt: args.now.toISOString(),
    refundReason: args.reason,
  }
}

// ============================================================================
// Audit-trail row emission (re-uses the PR #332 digest pattern)
// ============================================================================

/**
 * Map a `LeadHandoffStatus` mutation into the audit-event type the
 * trail row will carry. The `LEAD_OFFERED` event is emitted by the
 * matcher when the handoff is *created*; the rest mirror the handoff
 * lifecycle.
 */
export function auditEventTypeForHandoff(
  status: LeadHandoffStatus,
): AuditEventType {
  switch (status) {
    case 'PENDING':  return 'LEAD_OFFERED'
    case 'ACCEPTED': return 'LEAD_ACCEPTED'
    case 'DECLINED': return 'LEAD_DECLINED'
    case 'EXPIRED':  return 'LEAD_EXPIRED'
    case 'REFUNDED': return 'LEAD_REFUNDED'
  }
}

/**
 * Build the `AuditTrailEntry` shell for a handoff transition, plus
 * the canonical signable payload the API will hash.
 *
 * The service layer signs it (computes `digest`) and persists it; this
 * helper just packages the deterministic, signable parts.
 *
 * `prevDigest` chains the entry to the previous audit row (or `null`
 * for the first row in a brokerage's trail).
 *
 * Returns the entry **minus the signature** plus a `signablePayload`
 * string — the canonical pipe-separated canonical input the API hashes
 * to produce `signature.digest`. Newlines are stripped from each value
 * so an attacker can't smuggle them in to construct collisions.
 */
export function auditEventForHandoff(args: {
  entryId: string
  occurredAt: string
  handoff: LeadHandoff
  actorUserId: string
  actorEmail: string
  prevDigest: string | null
}): {
  entry: Omit<AuditTrailEntry, 'signature'>
  signablePayload: string
} {
  const eventType = auditEventTypeForHandoff(args.handoff.status)
  const resourceUrn = `coverguard://lead-handoff/${args.handoff.id}`
  const metadata: Record<string, string> = {
    leadId: args.handoff.leadId,
    producerId: args.handoff.producerId,
    priceCents: String(args.handoff.priceCents),
    handoffStatus: args.handoff.status,
  }
  if (eventType === 'LEAD_REFUNDED' && args.handoff.refundReason) {
    metadata.refundReason = args.handoff.refundReason
  }
  const signablePayload = [
    args.entryId,
    args.occurredAt,
    eventType,
    resourceUrn,
    args.actorUserId,
    args.actorEmail,
    args.handoff.producerId,
    args.handoff.leadId,
    String(args.handoff.priceCents),
    args.handoff.status,
    args.prevDigest ?? '',
  ]
    .map((s) => s.replace(/\r?\n/g, ' '))
    .join('|')
  return {
    entry: {
      id: args.entryId,
      occurredAt: args.occurredAt,
      eventType,
      resourceUrn,
      actor: {
        kind: 'USER',
        userId: args.actorUserId,
        email: args.actorEmail,
      },
      metadata,
    },
    signablePayload,
  }
}

// ============================================================================
// Errors
// ============================================================================

export class IllegalHandoffTransition extends Error {
  readonly from: LeadHandoffStatus
  readonly to: LeadHandoffStatus
  constructor(from: LeadHandoffStatus, to: LeadHandoffStatus) {
    super(`Illegal handoff transition: ${from} -> ${to}`)
    this.name = 'IllegalHandoffTransition'
    this.from = from
    this.to = to
  }
}

export class RefundIneligibleError extends Error {
  readonly reason: 'NOT_ACCEPTED' | 'WINDOW_CLOSED'
  constructor(reason: 'NOT_ACCEPTED' | 'WINDOW_CLOSED') {
    super(`Refund ineligible: ${reason}`)
    this.name = 'RefundIneligibleError'
    this.reason = reason
  }
}

// ============================================================================
// Internal helpers
// ============================================================================

function assertTransition(from: LeadHandoffStatus, to: LeadHandoffStatus): void {
  if (!canTransitionHandoff(from, to)) {
    throw new IllegalHandoffTransition(from, to)
  }
}
