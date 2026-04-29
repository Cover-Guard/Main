/**
 * Helpers for the agent-directory + referral-handoff feature (P2 #18).
 *
 * Spec: docs/enhancements/P2-enhancements.md.
 *
 * Pure / I/O-free — the actual matcher service + Stripe billing live
 * under `apps/api/src/integrations/agent-directory/`. This file is the
 * shared computation layer:
 *
 *   - Filter the producer pool down to eligibles for a given lead.
 *   - Score + rank eligibles to pick the matcher's next candidate.
 *   - Tier producers (TOP / GOOD / NEW / RISK) for both ranking and
 *     pricing.
 *   - Validate state transitions on the LeadHandoff state machine.
 *   - Compute refund-eligibility against the 7-day window.
 *   - Roll up producer-level lead summaries for the dashboard.
 */
import {
  type BuyerLead,
  type LeadHandoff,
  type LeadHandoffStatus,
  type Producer,
  type ProducerTier,
  DEFAULT_LEAD_PRICE_CENTS,
  LEAD_HANDOFF_TTL_HOURS,
  LEAD_MATCH_TARGET_SECONDS,
  MIN_ACCEPTANCE_FOR_GOOD,
  MIN_ACCEPTANCE_FOR_TOP,
  MIN_RATING_COUNT_FOR_SCORING,
  MIN_RATING_FOR_GOOD,
  MIN_RATING_FOR_TOP,
  REFUND_WINDOW_DAYS,
  TIER_PRICE_MULTIPLIER,
} from '../types/agentDirectory'

// ============================================================================
// Eligibility
// ============================================================================

/**
 * Whether a producer's opt-in coverage matrix matches a buyer lead.
 * Doesn't consider opt-in status or weekly cap — see `eligibleProducers`
 * for the full filter.
 */
export function producerMatchesLead(
  producer: Pick<Producer, 'licenseStates' | 'propertyTypes'>,
  lead: Pick<BuyerLead, 'propertyState' | 'propertyType'>,
): boolean {
  return (
    producer.licenseStates.includes(lead.propertyState.toUpperCase()) &&
    producer.propertyTypes.includes(lead.propertyType)
  )
}

/**
 * Filter the directory pool down to producers actually eligible for
 * this lead: opted in, coverage matches, not over their weekly cap,
 * and not in the RISK tier.
 */
export function eligibleProducers(
  producers: readonly Producer[],
  lead: Pick<BuyerLead, 'propertyState' | 'propertyType'>,
): Producer[] {
  return producers.filter(
    (p) =>
      p.optedIn &&
      producerMatchesLead(p, lead) &&
      p.leadCount7d < p.leadCapPerWeek &&
      producerTier(p) !== 'RISK',
  )
}

// ============================================================================
// Tier classification
// ============================================================================

/**
 * Bucket a producer into a tier. Tier drives both ranking weight and
 * handoff price (via `TIER_PRICE_MULTIPLIER`).
 *
 *   - RISK: low rating OR low acceptance (with a real sample size).
 *   - NEW: not enough leads scored yet (cold start).
 *   - TOP: high rating + high acceptance.
 *   - GOOD: anyone meeting the GOOD threshold.
 */
export function producerTier(
  producer: Pick<
    Producer,
    'rating1to5' | 'ratingCount' | 'leadAcceptanceRate'
  >,
): ProducerTier {
  if (producer.ratingCount < MIN_RATING_COUNT_FOR_SCORING) return 'NEW'
  if (
    producer.rating1to5 < MIN_RATING_FOR_GOOD ||
    producer.leadAcceptanceRate < MIN_ACCEPTANCE_FOR_GOOD
  ) {
    return 'RISK'
  }
  if (
    producer.rating1to5 >= MIN_RATING_FOR_TOP &&
    producer.leadAcceptanceRate >= MIN_ACCEPTANCE_FOR_TOP
  ) {
    return 'TOP'
  }
  return 'GOOD'
}

// ============================================================================
// Scoring + ranking
// ============================================================================

/**
 * Composite score in [0, 1] used to rank eligibles. Weighted blend of:
 *
 *   - normalized rating (60%)
 *   - acceptance rate (25%)
 *   - response-time freshness (15%) — faster is better, capped at 24h
 *
 * NEW producers (no sample size) get a flat 0.5 floor so they still
 * appear in the queue and start accruing data.
 */
export function scoreProducer(
  producer: Pick<
    Producer,
    'rating1to5' | 'ratingCount' | 'leadAcceptanceRate' | 'avgResponseHours'
  >,
): number {
  if (producer.ratingCount < MIN_RATING_COUNT_FOR_SCORING) return 0.5
  const ratingNorm = clamp01((producer.rating1to5 - 1) / 4) // 1..5 → 0..1
  const acceptanceNorm = clamp01(producer.leadAcceptanceRate)
  // Faster response is better. Cap at 24h (anything slower scores 0).
  const responseNorm = clamp01(1 - producer.avgResponseHours / 24)
  return ratingNorm * 0.6 + acceptanceNorm * 0.25 + responseNorm * 0.15
}

/**
 * Rank eligibles by composite score, descending. Stable on ties via
 * `producer.id` so the matcher is deterministic for tests.
 */
export function rankProducersForLead(
  eligibles: readonly Producer[],
): Producer[] {
  return [...eligibles].sort((a, b) => {
    const sa = scoreProducer(a)
    const sb = scoreProducer(b)
    if (sa === sb) return a.id < b.id ? -1 : a.id > b.id ? 1 : 0
    return sb - sa
  })
}

/**
 * Select the matcher's next candidate for a lead. Returns `null` if no
 * eligibles exist (the caller surfaces a "no producers available"
 * message to the buyer).
 */
export function selectMatchForLead(
  producers: readonly Producer[],
  lead: Pick<BuyerLead, 'propertyState' | 'propertyType'>,
): Producer | null {
  const eligibles = eligibleProducers(producers, lead)
  const ranked = rankProducersForLead(eligibles)
  return ranked[0] ?? null
}

// ============================================================================
// Pricing
// ============================================================================

/**
 * Per-handoff price the producer is billed on accept. Tier multiplier
 * is applied on top of the base sticker price.
 */
export function handoffPriceCents(producer: Pick<Producer, 'rating1to5' | 'ratingCount' | 'leadAcceptanceRate'>): number {
  const tier = producerTier(producer)
  return Math.round(DEFAULT_LEAD_PRICE_CENTS * TIER_PRICE_MULTIPLIER[tier])
}

// ============================================================================
// State machine
// ============================================================================

/**
 * Adjacency table for legal handoff transitions. Centralized so the
 * matcher service, the producer dashboard, and the API guard all read
 * identically.
 *
 *   PENDING   -> ACCEPTED, DECLINED, EXPIRED
 *   ACCEPTED  -> REFUNDED
 *   DECLINED  -> (terminal)
 *   EXPIRED   -> (terminal)
 *   REFUNDED  -> (terminal)
 */
const TRANSITIONS: Record<LeadHandoffStatus, LeadHandoffStatus[]> = {
  PENDING:  ['ACCEPTED', 'DECLINED', 'EXPIRED'],
  ACCEPTED: ['REFUNDED'],
  DECLINED: [],
  EXPIRED:  [],
  REFUNDED: [],
}

export function canTransitionHandoff(
  from: LeadHandoffStatus,
  to: LeadHandoffStatus,
): boolean {
  return TRANSITIONS[from].includes(to)
}

// ============================================================================
// Match-time bucketing (against the 5s spec target)
// ============================================================================

export type MatchBucket = 'FAST' | 'OK' | 'SLOW'

/**
 * Bucket how long the matcher took (in seconds). Spec target is <= 5s.
 *
 *   <= 5s   => FAST
 *   <= 10s  => OK
 *   > 10s   => SLOW
 */
export function classifyMatchTime(elapsedSeconds: number): MatchBucket {
  if (elapsedSeconds <= LEAD_MATCH_TARGET_SECONDS) return 'FAST'
  if (elapsedSeconds <= LEAD_MATCH_TARGET_SECONDS * 2) return 'OK'
  return 'SLOW'
}

// ============================================================================
// Expiry + refund windows
// ============================================================================

export function defaultHandoffExpiry(
  createdAt: string,
  ttlHours: number = LEAD_HANDOFF_TTL_HOURS,
): string {
  const created = new Date(createdAt).getTime()
  const ms = ttlHours * 60 * 60 * 1000
  return new Date(created + ms).toISOString()
}

export function isHandoffExpired(
  handoff: Pick<LeadHandoff, 'status' | 'expiresAt'>,
  now: Date = new Date(),
): boolean {
  if (handoff.status !== 'PENDING') return false
  return new Date(handoff.expiresAt).getTime() <= now.getTime()
}

/**
 * Whether a producer can still claim a refund on this handoff. Only
 * ACCEPTED handoffs inside the 7-day window are eligible.
 */
export function refundEligibility(
  handoff: Pick<LeadHandoff, 'status' | 'acceptedAt'>,
  now: Date = new Date(),
): { eligible: boolean; reason?: 'NOT_ACCEPTED' | 'WINDOW_CLOSED' } {
  if (handoff.status !== 'ACCEPTED' || !handoff.acceptedAt) {
    return { eligible: false, reason: 'NOT_ACCEPTED' }
  }
  const accepted = new Date(handoff.acceptedAt).getTime()
  const windowMs = REFUND_WINDOW_DAYS * 24 * 60 * 60 * 1000
  if (now.getTime() - accepted > windowMs) {
    return { eligible: false, reason: 'WINDOW_CLOSED' }
  }
  return { eligible: true }
}

// ============================================================================
// Producer dashboard summary
// ============================================================================

export interface ProducerLeadSummary {
  producerId: string
  pending: number
  accepted: number
  declined: number
  expired: number
  refunded: number
  /** Acceptance rate over the input window (excludes expired). */
  acceptanceRate: number
  /** Sum of priceCents for ACCEPTED handoffs minus refunds. */
  netRevenueCents: number
}

/**
 * Roll up a producer's handoffs into the dashboard summary row.
 * Excludes EXPIRED handoffs from acceptance-rate denominator since
 * they're not the producer's fault.
 */
export function summarizeProducerLeads(
  producerId: string,
  handoffs: readonly LeadHandoff[],
): ProducerLeadSummary {
  const own = handoffs.filter((h) => h.producerId === producerId)
  const counts = {
    PENDING: 0,
    ACCEPTED: 0,
    DECLINED: 0,
    EXPIRED: 0,
    REFUNDED: 0,
  } as Record<LeadHandoffStatus, number>
  let netRevenue = 0
  for (const h of own) {
    counts[h.status] += 1
    if (h.status === 'ACCEPTED') netRevenue += h.priceCents
    if (h.status === 'REFUNDED') netRevenue -= h.priceCents
  }
  const accDenom = counts.ACCEPTED + counts.DECLINED + counts.REFUNDED
  const acceptanceRate =
    accDenom === 0 ? 0 : (counts.ACCEPTED + counts.REFUNDED) / accDenom
  return {
    producerId,
    pending: counts.PENDING,
    accepted: counts.ACCEPTED,
    declined: counts.DECLINED,
    expired: counts.EXPIRED,
    refunded: counts.REFUNDED,
    acceptanceRate,
    netRevenueCents: Math.max(0, netRevenue),
  }
}

// ============================================================================
// Internal helpers
// ============================================================================

function clamp01(n: number): number {
  if (n < 0) return 0
  if (n > 1) return 1
  return n
}
