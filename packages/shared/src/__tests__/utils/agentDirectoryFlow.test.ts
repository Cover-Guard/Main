import {
  acceptHandoff,
  auditEventForHandoff,
  auditEventTypeForHandoff,
  claimRefund,
  createLeadHandoff,
  declineHandoff,
  expirePendingHandoff,
  IllegalHandoffTransition,
  RefundIneligibleError,
} from '../../utils/agentDirectoryFlow'
import {
  type BuyerLead,
  type LeadHandoff,
  type Producer,
  DEFAULT_LEAD_PRICE_CENTS,
  LEAD_HANDOFF_TTL_HOURS,
  TIER_PRICE_MULTIPLIER,
} from '../../types/agentDirectory'

const NOW = '2026-04-29T12:00:00Z'

function producer(overrides: Partial<Producer> = {}): Producer {
  return {
    id: 'p-1',
    name: 'Alice Agent',
    brokerageId: 'b-1',
    brokerageName: 'CoverGuard Realty',
    licenseStates: ['TX'],
    propertyTypes: ['SINGLE_FAMILY'],
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

describe('createLeadHandoff', () => {
  it('produces a PENDING handoff priced by the producer tier', () => {
    const top = producer({ rating1to5: 4.9, ratingCount: 50, leadAcceptanceRate: 0.95 })
    const result = createLeadHandoff({ producer: top, lead: lead(), now: NOW })
    expect(result.status).toBe('PENDING')
    expect(result.priceCents).toBe(
      Math.round(DEFAULT_LEAD_PRICE_CENTS * TIER_PRICE_MULTIPLIER.TOP),
    )
    expect(result.acceptedAt).toBeNull()
    expect(result.declinedAt).toBeNull()
    expect(result.refundedAt).toBeNull()
  })

  it('sets expiresAt to createdAt + TTL', () => {
    const result = createLeadHandoff({ producer: producer(), lead: lead(), now: NOW })
    const ms = new Date(result.expiresAt).getTime() - new Date(NOW).getTime()
    expect(ms).toBe(LEAD_HANDOFF_TTL_HOURS * 60 * 60 * 1000)
  })

  it('uses the injected idGenerator when provided', () => {
    const result = createLeadHandoff({
      producer: producer(),
      lead: lead(),
      now: NOW,
      idGenerator: () => 'deterministic-id',
    })
    expect(result.id).toBe('deterministic-id')
  })

  it('falls back to a deterministic id derived from producer + lead', () => {
    const result = createLeadHandoff({
      producer: producer({ id: 'pX' }),
      lead: lead({ id: 'lY' }),
      now: NOW,
    })
    expect(result.id).toBe('handoff_pX_lY')
  })
})

describe('acceptHandoff', () => {
  it('moves PENDING -> ACCEPTED and stamps acceptedAt', () => {
    const result = acceptHandoff(handoff(), NOW)
    expect(result.status).toBe('ACCEPTED')
    expect(result.acceptedAt).toBe(NOW)
  })

  it('throws on illegal transitions', () => {
    expect(() => acceptHandoff(handoff({ status: 'EXPIRED' }), NOW)).toThrow(
      IllegalHandoffTransition,
    )
  })
})

describe('declineHandoff', () => {
  it('moves PENDING -> DECLINED and stamps declinedAt', () => {
    const result = declineHandoff(handoff(), NOW)
    expect(result.status).toBe('DECLINED')
    expect(result.declinedAt).toBe(NOW)
  })

  it('throws when the handoff is already terminal', () => {
    expect(() => declineHandoff(handoff({ status: 'REFUNDED' }), NOW)).toThrow(
      IllegalHandoffTransition,
    )
  })
})

describe('expirePendingHandoff', () => {
  it('moves PENDING -> EXPIRED', () => {
    const result = expirePendingHandoff(handoff())
    expect(result.status).toBe('EXPIRED')
  })

  it('refuses to expire ACCEPTED handoffs', () => {
    expect(() =>
      expirePendingHandoff(handoff({ status: 'ACCEPTED', acceptedAt: NOW })),
    ).toThrow(IllegalHandoffTransition)
  })
})

describe('claimRefund', () => {
  it('moves ACCEPTED -> REFUNDED inside the 7-day window', () => {
    const result = claimRefund({
      handoff: handoff({
        status: 'ACCEPTED',
        acceptedAt: '2026-04-28T12:00:00Z',
      }),
      now: new Date(NOW),
      reason: 'Wrong state',
    })
    expect(result.status).toBe('REFUNDED')
    expect(result.refundReason).toBe('Wrong state')
    expect(result.refundedAt).toBe(new Date(NOW).toISOString())
  })

  it('throws RefundIneligibleError past the 7-day window', () => {
    expect(() =>
      claimRefund({
        handoff: handoff({
          status: 'ACCEPTED',
          acceptedAt: '2026-04-15T12:00:00Z',
        }),
        now: new Date(NOW),
        reason: 'Window closed',
      }),
    ).toThrow(RefundIneligibleError)
  })

  it('throws RefundIneligibleError when the handoff was never ACCEPTED', () => {
    let captured: unknown = null
    try {
      claimRefund({
        handoff: handoff({ status: 'ACCEPTED', acceptedAt: null }),
        now: new Date(NOW),
        reason: 'whatever',
      })
    } catch (err) {
      captured = err
    }
    expect(captured).toBeInstanceOf(RefundIneligibleError)
    expect((captured as RefundIneligibleError).reason).toBe('NOT_ACCEPTED')
  })

  it('throws IllegalHandoffTransition for terminal handoffs', () => {
    expect(() =>
      claimRefund({
        handoff: handoff({ status: 'EXPIRED' }),
        now: new Date(NOW),
        reason: 'whatever',
      }),
    ).toThrow(IllegalHandoffTransition)
  })
})

describe('auditEventTypeForHandoff', () => {
  it('maps each lifecycle status to the expected audit event', () => {
    expect(auditEventTypeForHandoff('PENDING')).toBe('LEAD_OFFERED')
    expect(auditEventTypeForHandoff('ACCEPTED')).toBe('LEAD_ACCEPTED')
    expect(auditEventTypeForHandoff('DECLINED')).toBe('LEAD_DECLINED')
    expect(auditEventTypeForHandoff('EXPIRED')).toBe('LEAD_EXPIRED')
    expect(auditEventTypeForHandoff('REFUNDED')).toBe('LEAD_REFUNDED')
  })
})

describe('auditEventForHandoff', () => {
  it('builds a chainable audit entry shell with metadata + payload', () => {
    const result = auditEventForHandoff({
      entryId: 'audit-1',
      occurredAt: NOW,
      handoff: handoff({ status: 'ACCEPTED', acceptedAt: NOW }),
      actorUserId: 'user-7',
      actorEmail: 'agent@example.com',
      prevDigest: 'abcd1234',
    })
    expect(result.entry.eventType).toBe('LEAD_ACCEPTED')
    expect(result.entry.resourceUrn).toBe('coverguard://lead-handoff/h-1')
    expect(result.entry.actor).toEqual({
      kind: 'USER',
      userId: 'user-7',
      email: 'agent@example.com',
    })
    expect(result.entry.metadata.leadId).toBe('lead-1')
    expect(result.entry.metadata.producerId).toBe('p-1')
    expect(result.entry.metadata.priceCents).toBe(String(DEFAULT_LEAD_PRICE_CENTS))
    expect(result.entry.metadata.handoffStatus).toBe('ACCEPTED')
  })

  it('produces a stable, pipe-separated signable payload', () => {
    const result = auditEventForHandoff({
      entryId: 'audit-1',
      occurredAt: NOW,
      handoff: handoff({ status: 'ACCEPTED' }),
      actorUserId: 'user-7',
      actorEmail: 'agent@example.com',
      prevDigest: 'abcd1234',
    })
    expect(result.signablePayload.split('|').length).toBe(11)
    expect(result.signablePayload).toContain('audit-1')
    expect(result.signablePayload).toContain('LEAD_ACCEPTED')
    expect(result.signablePayload).toContain('coverguard://lead-handoff/h-1')
    expect(result.signablePayload).toContain('abcd1234')
  })

  it('strips newlines from values to prevent payload injection', () => {
    const result = auditEventForHandoff({
      entryId: 'audit-1',
      occurredAt: NOW,
      handoff: handoff({ status: 'ACCEPTED' }),
      actorUserId: 'user-7',
      actorEmail: 'agent\nattacker@example.com',
      prevDigest: null,
    })
    expect(result.signablePayload).not.toContain('\n')
  })

  it('emits prevDigest as the empty string when chaining the first row', () => {
    const result = auditEventForHandoff({
      entryId: 'audit-1',
      occurredAt: NOW,
      handoff: handoff(),
      actorUserId: 'user-7',
      actorEmail: 'agent@example.com',
      prevDigest: null,
    })
    expect(result.signablePayload.endsWith('|')).toBe(true)
  })

  it('includes refundReason in metadata for REFUNDED handoffs only', () => {
    const refunded = auditEventForHandoff({
      entryId: 'audit-1',
      occurredAt: NOW,
      handoff: handoff({
        status: 'REFUNDED',
        acceptedAt: '2026-04-28T12:00:00Z',
        refundedAt: NOW,
        refundReason: 'Wrong state',
      }),
      actorUserId: 'user-7',
      actorEmail: 'agent@example.com',
      prevDigest: null,
    })
    expect(refunded.entry.metadata.refundReason).toBe('Wrong state')

    const accepted = auditEventForHandoff({
      entryId: 'audit-2',
      occurredAt: NOW,
      handoff: handoff({ status: 'ACCEPTED', acceptedAt: NOW }),
      actorUserId: 'user-7',
      actorEmail: 'agent@example.com',
      prevDigest: null,
    })
    expect(accepted.entry.metadata.refundReason).toBeUndefined()
  })
})
