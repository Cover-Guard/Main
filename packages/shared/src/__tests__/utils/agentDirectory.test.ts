import {
  canTransitionHandoff,
  classifyMatchTime,
  defaultHandoffExpiry,
  eligibleProducers,
  handoffPriceCents,
  isHandoffExpired,
  producerMatchesLead,
  producerTier,
  rankProducersForLead,
  refundEligibility,
  scoreProducer,
  selectMatchForLead,
  summarizeProducerLeads,
} from '../../utils/agentDirectory'
import {
  type BuyerLead,
  type LeadHandoff,
  type LeadHandoffStatus,
  type Producer,
  DEFAULT_LEAD_PRICE_CENTS,
  LEAD_HANDOFF_TTL_HOURS,
  LEAD_MATCH_TARGET_SECONDS,
  TIER_PRICE_MULTIPLIER,
} from '../../types/agentDirectory'

const NOW = '2026-04-29T12:00:00Z'

function producer(overrides: Partial<Producer> = {}): Producer {
  return {
    id: 'p-1',
    name: 'Alice Agent',
    brokerageId: 'b-1',
    brokerageName: 'CoverGuard Realty',
    licenseStates: ['TX', 'OK'],
    propertyTypes: ['SINGLE_FAMILY', 'CONDO'],
    avgResponseHours: 4,
    leadAcceptanceRate: 0.9,
    rating1to5: 4.7,
    ratingCount: 25,
    leadCapPerWeek: 10,
    leadCount7d: 2,
    optedIn: true,
    ...overrides,
  }
}

function lead(overrides: Partial<BuyerLead> = {}): BuyerLead {
  return {
    id: 'lead-1',
    propertyId: 'prop-1',
    propertyState: 'TX',
    propertyType: 'SINGLE_FAMILY',
    buyerEmail: 'buyer@example.com',
    buyerFullName: 'Buyer Name',
    requestedAt: NOW,
    reportUrn: 'coverguard://report/r-1',
    ...overrides,
  }
}

function handoff(overrides: Partial<LeadHandoff> = {}): LeadHandoff {
  return {
    id: 'h-1',
    leadId: 'lead-1',
    producerId: 'p-1',
    status: 'PENDING',
    priceCents: DEFAULT_LEAD_PRICE_CENTS,
    createdAt: NOW,
    acceptedAt: null,
    declinedAt: null,
    expiresAt: '2026-04-30T12:00:00Z',
    refundedAt: null,
    refundReason: null,
    ...overrides,
  }
}

describe('producerMatchesLead', () => {
  it('matches when state + property type are both covered', () => {
    expect(producerMatchesLead(producer(), lead())).toBe(true)
  })

  it('rejects on uncovered state', () => {
    expect(producerMatchesLead(producer({ licenseStates: ['CA'] }), lead())).toBe(false)
  })

  it('rejects on uncovered property type', () => {
    expect(
      producerMatchesLead(producer({ propertyTypes: ['COMMERCIAL'] }), lead()),
    ).toBe(false)
  })

  it('uppercases the lead state before comparing', () => {
    expect(producerMatchesLead(producer(), lead({ propertyState: 'tx' }))).toBe(true)
  })
})

describe('eligibleProducers', () => {
  it('includes opted-in matching producers under their cap', () => {
    const ok = producer({ id: 'ok', leadCount7d: 1, leadCapPerWeek: 5 })
    expect(eligibleProducers([ok], lead())).toEqual([ok])
  })

  it('excludes opted-out producers', () => {
    expect(eligibleProducers([producer({ optedIn: false })], lead())).toEqual([])
  })

  it('excludes producers who have hit their weekly cap', () => {
    expect(
      eligibleProducers(
        [producer({ leadCount7d: 5, leadCapPerWeek: 5 })],
        lead(),
      ),
    ).toEqual([])
  })

  it('excludes producers in RISK tier', () => {
    const risky = producer({
      rating1to5: 2.5,
      ratingCount: 50,
      leadAcceptanceRate: 0.4,
    })
    expect(eligibleProducers([risky], lead())).toEqual([])
  })

  it('excludes producers without state coverage', () => {
    expect(
      eligibleProducers([producer({ licenseStates: ['CA'] })], lead()),
    ).toEqual([])
  })
})

describe('producerTier', () => {
  it('returns NEW when not enough rating data', () => {
    expect(producerTier(producer({ ratingCount: 2 }))).toBe('NEW')
  })

  it('returns RISK when rating drops below the GOOD threshold', () => {
    expect(
      producerTier(producer({ rating1to5: 3.0, ratingCount: 50, leadAcceptanceRate: 0.9 })),
    ).toBe('RISK')
  })

  it('returns RISK when acceptance drops below the GOOD threshold', () => {
    expect(
      producerTier(producer({ rating1to5: 4.8, ratingCount: 50, leadAcceptanceRate: 0.4 })),
    ).toBe('RISK')
  })

  it('returns TOP when both thresholds clear the TOP bar', () => {
    expect(
      producerTier(producer({ rating1to5: 4.8, ratingCount: 50, leadAcceptanceRate: 0.9 })),
    ).toBe('TOP')
  })

  it('returns GOOD for the in-between band', () => {
    expect(
      producerTier(producer({ rating1to5: 4.0, ratingCount: 50, leadAcceptanceRate: 0.7 })),
    ).toBe('GOOD')
  })
})

describe('scoreProducer', () => {
  it('returns 0.5 cold-start floor for NEW producers', () => {
    expect(scoreProducer(producer({ ratingCount: 2 }))).toBe(0.5)
  })

  it('weights rating heaviest', () => {
    const high = scoreProducer(producer({ rating1to5: 5.0, leadAcceptanceRate: 0.5, avgResponseHours: 12 }))
    const low = scoreProducer(producer({ rating1to5: 2.0, leadAcceptanceRate: 1.0, avgResponseHours: 0 }))
    expect(high).toBeGreaterThan(low)
  })

  it('clamps abnormal inputs to [0,1]', () => {
    const score = scoreProducer(
      producer({
        rating1to5: 5.0,
        ratingCount: 50,
        leadAcceptanceRate: 1.5, // bad input
        avgResponseHours: -1, // bad input
      }),
    )
    expect(score).toBeGreaterThanOrEqual(0)
    expect(score).toBeLessThanOrEqual(1)
  })
})

describe('rankProducersForLead', () => {
  it('sorts by score descending', () => {
    const high = producer({ id: 'high', rating1to5: 5.0, ratingCount: 50, leadAcceptanceRate: 0.95, avgResponseHours: 1 })
    const low = producer({ id: 'low', rating1to5: 4.0, ratingCount: 50, leadAcceptanceRate: 0.7, avgResponseHours: 12 })
    expect(rankProducersForLead([low, high]).map((p) => p.id)).toEqual(['high', 'low'])
  })

  it('breaks ties deterministically by id', () => {
    const a = producer({ id: 'a' })
    const b = producer({ id: 'b' })
    expect(rankProducersForLead([b, a]).map((p) => p.id)).toEqual(['a', 'b'])
  })
})

describe('selectMatchForLead', () => {
  it('returns the highest-ranked eligible producer', () => {
    const top = producer({
      id: 'top',
      rating1to5: 4.9,
      ratingCount: 50,
      leadAcceptanceRate: 0.95,
      avgResponseHours: 1,
    })
    const middling = producer({ id: 'mid', rating1to5: 4.0, ratingCount: 50, leadAcceptanceRate: 0.7, avgResponseHours: 12 })
    expect(selectMatchForLead([middling, top], lead())?.id).toBe('top')
  })

  it('returns null when no producers are eligible', () => {
    expect(selectMatchForLead([producer({ optedIn: false })], lead())).toBeNull()
  })
})

describe('handoffPriceCents', () => {
  it('uses TOP multiplier for TOP-tier producers', () => {
    const price = handoffPriceCents(
      producer({ rating1to5: 4.8, ratingCount: 50, leadAcceptanceRate: 0.95 }),
    )
    expect(price).toBe(Math.round(DEFAULT_LEAD_PRICE_CENTS * TIER_PRICE_MULTIPLIER.TOP))
  })

  it('uses NEW (cold-start) multiplier for unscored producers', () => {
    const price = handoffPriceCents(producer({ ratingCount: 2 }))
    expect(price).toBe(Math.round(DEFAULT_LEAD_PRICE_CENTS * TIER_PRICE_MULTIPLIER.NEW))
  })

  it('returns 0 for RISK producers (excluded from matching anyway)', () => {
    const price = handoffPriceCents(
      producer({ rating1to5: 2.5, ratingCount: 50, leadAcceptanceRate: 0.3 }),
    )
    expect(price).toBe(0)
  })
})

describe('canTransitionHandoff', () => {
  it('honors PENDING transitions', () => {
    expect(canTransitionHandoff('PENDING', 'ACCEPTED')).toBe(true)
    expect(canTransitionHandoff('PENDING', 'DECLINED')).toBe(true)
    expect(canTransitionHandoff('PENDING', 'EXPIRED')).toBe(true)
    expect(canTransitionHandoff('PENDING', 'REFUNDED')).toBe(false)
  })

  it('only allows ACCEPTED -> REFUNDED', () => {
    expect(canTransitionHandoff('ACCEPTED', 'REFUNDED')).toBe(true)
    expect(canTransitionHandoff('ACCEPTED', 'DECLINED')).toBe(false)
    expect(canTransitionHandoff('ACCEPTED', 'EXPIRED')).toBe(false)
  })

  it('treats DECLINED / EXPIRED / REFUNDED as terminal', () => {
    const terminals: LeadHandoffStatus[] = ['DECLINED', 'EXPIRED', 'REFUNDED']
    const all: LeadHandoffStatus[] = ['PENDING', 'ACCEPTED', 'DECLINED', 'EXPIRED', 'REFUNDED']
    for (const t of terminals) {
      for (const target of all) {
        expect(canTransitionHandoff(t, target)).toBe(false)
      }
    }
  })
})

describe('classifyMatchTime', () => {
  it('returns FAST under or at the spec target', () => {
    expect(classifyMatchTime(LEAD_MATCH_TARGET_SECONDS)).toBe('FAST')
    expect(classifyMatchTime(2)).toBe('FAST')
  })

  it('returns OK in the 5..10s band', () => {
    expect(classifyMatchTime(7)).toBe('OK')
    expect(classifyMatchTime(10)).toBe('OK')
  })

  it('returns SLOW above 10s', () => {
    expect(classifyMatchTime(12)).toBe('SLOW')
  })
})

describe('handoff expiry helpers', () => {
  it('defaultHandoffExpiry adds the TTL window', () => {
    const exp = defaultHandoffExpiry(NOW)
    const ms = new Date(exp).getTime() - new Date(NOW).getTime()
    expect(ms).toBe(LEAD_HANDOFF_TTL_HOURS * 60 * 60 * 1000)
  })

  it('isHandoffExpired only fires for PENDING past expiry', () => {
    const past = handoff({
      status: 'PENDING',
      expiresAt: '2026-04-28T12:00:00Z',
    })
    expect(isHandoffExpired(past, new Date(NOW))).toBe(true)
  })

  it('isHandoffExpired leaves ACCEPTED handoffs alone', () => {
    const past = handoff({
      status: 'ACCEPTED',
      expiresAt: '2026-04-28T12:00:00Z',
    })
    expect(isHandoffExpired(past, new Date(NOW))).toBe(false)
  })
})

describe('refundEligibility', () => {
  it('rejects non-ACCEPTED handoffs', () => {
    expect(refundEligibility(handoff({ status: 'PENDING' }), new Date(NOW))).toEqual({
      eligible: false,
      reason: 'NOT_ACCEPTED',
    })
  })

  it('accepts inside the 7-day window', () => {
    expect(
      refundEligibility(
        handoff({ status: 'ACCEPTED', acceptedAt: '2026-04-28T12:00:00Z' }),
        new Date(NOW),
      ),
    ).toEqual({ eligible: true })
  })

  it('rejects past the 7-day window', () => {
    expect(
      refundEligibility(
        handoff({ status: 'ACCEPTED', acceptedAt: '2026-04-15T12:00:00Z' }),
        new Date(NOW),
      ),
    ).toEqual({ eligible: false, reason: 'WINDOW_CLOSED' })
  })
})

describe('summarizeProducerLeads', () => {
  it('rolls up counts + acceptance + net revenue', () => {
    const handoffs: LeadHandoff[] = [
      handoff({ id: 'h1', status: 'ACCEPTED', priceCents: 2500 }),
      handoff({ id: 'h2', status: 'ACCEPTED', priceCents: 3750 }),
      handoff({ id: 'h3', status: 'DECLINED', priceCents: 2500 }),
      handoff({ id: 'h4', status: 'EXPIRED', priceCents: 2500 }),
      handoff({ id: 'h5', status: 'REFUNDED', priceCents: 2500 }),
    ]
    const summary = summarizeProducerLeads('p-1', handoffs)
    expect(summary.accepted).toBe(2)
    expect(summary.declined).toBe(1)
    expect(summary.expired).toBe(1)
    expect(summary.refunded).toBe(1)
    // (2 + 1) / (2 + 1 + 1) = 0.75. EXPIRED excluded from denominator.
    expect(summary.acceptanceRate).toBeCloseTo(0.75, 5)
    // 2500 + 3750 - 2500 (refund) = 3750
    expect(summary.netRevenueCents).toBe(3750)
  })

  it('returns 0 acceptance + 0 revenue for an empty book', () => {
    const summary = summarizeProducerLeads('p-1', [])
    expect(summary.acceptanceRate).toBe(0)
    expect(summary.netRevenueCents).toBe(0)
  })

  it('clamps net revenue at 0 (refund spike defense)', () => {
    const handoffs: LeadHandoff[] = [
      handoff({ id: 'h1', status: 'ACCEPTED', priceCents: 1000 }),
      handoff({ id: 'h2', status: 'REFUNDED', priceCents: 5000 }),
    ]
    const summary = summarizeProducerLeads('p-1', handoffs)
    expect(summary.netRevenueCents).toBe(0)
  })

  it('ignores handoffs from other producers', () => {
    const handoffs: LeadHandoff[] = [
      handoff({ id: 'h1', producerId: 'other', status: 'ACCEPTED' }),
    ]
    const summary = summarizeProducerLeads('p-1', handoffs)
    expect(summary.accepted).toBe(0)
    expect(summary.netRevenueCents).toBe(0)
  })
})
