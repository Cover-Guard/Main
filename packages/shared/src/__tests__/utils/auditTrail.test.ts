import {
  auditActorLabel,
  auditEntryDigestInput,
  auditEventLabel,
  getLosCapabilities,
  groupAuditEntriesByDay,
  isAuditEntryFresh,
  isLenderConnectionPushable,
  isLosProviderAvailable,
  losProviderLabel,
  losStatusCopy,
  summarizeAuditTrail,
  verifyAuditChain,
} from '../../utils/auditTrail'
import {
  type AuditActor,
  type AuditEventType,
  type AuditTrailEntry,
  type LenderConnection,
} from '../../types/lenderIntegration'

const NOW = new Date('2026-04-28T12:00:00Z')

function userActor(overrides: Partial<{ userId: string; email: string }> = {}): AuditActor {
  return {
    kind: 'USER',
    userId: overrides.userId ?? 'usr_1',
    email: overrides.email ?? 'alice@example.com',
  }
}

function entry(
  id: string,
  occurredAt: string,
  prevDigest: string | null,
  digest: string,
  eventType: AuditEventType = 'REPORT_GENERATED',
): AuditTrailEntry {
  return {
    id,
    occurredAt,
    actor: userActor(),
    eventType,
    resourceUrn: `coverguard://report/${id}`,
    metadata: { propertyId: 'prop_1' },
    signature: {
      algorithm: 'SHA-256',
      digest,
      prevDigest,
      signedAt: occurredAt,
    },
  }
}

describe('LOS provider helpers', () => {
  it('losProviderLabel renders the human label', () => {
    expect(losProviderLabel('ENCOMPASS')).toBe('Encompass')
    expect(losProviderLabel('BYTEPRO')).toBe('BytePro')
  })

  it('getLosCapabilities returns vendor capability flags', () => {
    expect(getLosCapabilities('ENCOMPASS').webhooksAvailable).toBe(true)
    expect(getLosCapabilities('BYTEPRO').webhooksAvailable).toBe(false)
    expect(getLosCapabilities('BYTEPRO').loanFileAttachments).toBe(true)
  })

  it('isLosProviderAvailable honors the release flags', () => {
    const flags = { encompassEnabled: true, byteProEnabled: false }
    expect(isLosProviderAvailable('ENCOMPASS', flags)).toBe(true)
    expect(isLosProviderAvailable('BYTEPRO', flags)).toBe(false)
  })

  describe('losStatusCopy', () => {
    it('returns success copy for CONNECTED', () => {
      const copy = losStatusCopy('CONNECTED')
      expect(copy.variant).toBe('success')
      expect(copy.label).toBe('Connected')
    })

    it('returns danger copy for EXPIRED', () => {
      expect(losStatusCopy('EXPIRED').variant).toBe('danger')
    })

    it('returns warning copy for DEGRADED', () => {
      expect(losStatusCopy('DEGRADED').variant).toBe('warning')
    })

    it('returns neutral copy for NOT_CONNECTED and DISCONNECTED', () => {
      expect(losStatusCopy('NOT_CONNECTED').variant).toBe('neutral')
      expect(losStatusCopy('DISCONNECTED').variant).toBe('neutral')
    })
  })

  it('isLenderConnectionPushable is true only for CONNECTED', () => {
    const base: LenderConnection = {
      id: 'c1',
      organizationId: 'org_1',
      provider: 'ENCOMPASS',
      status: 'CONNECTED',
      providerTenantId: 't1',
      lastSyncAt: '2026-04-28T00:00:00Z',
      createdAt: '2026-01-01T00:00:00Z',
    }
    expect(isLenderConnectionPushable(base)).toBe(true)
    expect(isLenderConnectionPushable({ ...base, status: 'DEGRADED' })).toBe(false)
    expect(isLenderConnectionPushable({ ...base, status: 'EXPIRED' })).toBe(false)
  })
})

describe('Audit-trail label helpers', () => {
  it('auditEventLabel covers every event type', () => {
    const events: AuditEventType[] = [
      'REPORT_GENERATED',
      'REPORT_ATTACHED_TO_LOAN',
      'REPORT_VIEWED',
      'REPORT_EXPORTED',
      'CONNECTION_CREATED',
      'CONNECTION_REVOKED',
      'DATA_SOURCE_REFRESHED',
    ]
    for (const e of events) {
      expect(auditEventLabel(e)).toBeTruthy()
    }
  })

  it('auditActorLabel renders user / integration / system actors', () => {
    expect(auditActorLabel({ kind: 'USER', userId: 'u', email: 'a@b.com' })).toBe('a@b.com')
    expect(
      auditActorLabel({ kind: 'INTEGRATION', provider: 'ENCOMPASS', connectionId: 'c1' }),
    ).toBe('Encompass integration')
    expect(auditActorLabel({ kind: 'SYSTEM', subsystem: 'cron' })).toBe('System (cron)')
  })
})

describe('auditEntryDigestInput', () => {
  it('produces a stable, pipe-separated string', () => {
    const e = entry('a1', '2026-04-28T12:00:00Z', null, 'd1')
    const input = auditEntryDigestInput(e)
    expect(input).toContain('a1')
    expect(input).toContain('2026-04-28T12:00:00Z')
    expect(input).toContain('REPORT_GENERATED')
    expect(input).toContain('coverguard://report/a1')
  })

  it('orders metadata keys alphabetically (collision resistance)', () => {
    const a = {
      ...entry('a1', '2026-04-28T12:00:00Z', null, 'd1'),
      metadata: { z: '1', a: '2' },
    }
    const b = {
      ...entry('a1', '2026-04-28T12:00:00Z', null, 'd1'),
      metadata: { a: '2', z: '1' },
    }
    expect(auditEntryDigestInput(a)).toBe(auditEntryDigestInput(b))
  })

  it('strips newlines from values to prevent format-injection', () => {
    const e = {
      ...entry('a1', '2026-04-28T12:00:00Z', null, 'd1'),
      metadata: { note: 'line1\nline2' },
    }
    const input = auditEntryDigestInput(e)
    expect(input).not.toContain('\n')
  })

  it('changes when prevDigest changes', () => {
    const a = entry('a1', '2026-04-28T12:00:00Z', null, 'd1')
    const b = entry('a1', '2026-04-28T12:00:00Z', 'prev', 'd1')
    expect(auditEntryDigestInput(a)).not.toBe(auditEntryDigestInput(b))
  })
})

describe('verifyAuditChain', () => {
  /** Hash that just echoes the input (deterministic test fixture). */
  const echo = (input: string) => `H(${input})`

  it('returns -1 for an intact chain', () => {
    const e1 = entry('1', '2026-04-28T10:00:00Z', null, '')
    e1.signature.digest = echo(auditEntryDigestInput(e1))
    const e2 = entry('2', '2026-04-28T11:00:00Z', e1.signature.digest, '')
    e2.signature.digest = echo(auditEntryDigestInput(e2))
    const e3 = entry('3', '2026-04-28T12:00:00Z', e2.signature.digest, '')
    e3.signature.digest = echo(auditEntryDigestInput(e3))
    expect(verifyAuditChain([e1, e2, e3], echo)).toBe(-1)
  })

  it('returns the broken index when prevDigest is wrong', () => {
    const e1 = entry('1', '2026-04-28T10:00:00Z', null, '')
    e1.signature.digest = echo(auditEntryDigestInput(e1))
    const e2 = entry('2', '2026-04-28T11:00:00Z', 'WRONG', '')
    e2.signature.digest = echo(auditEntryDigestInput(e2))
    expect(verifyAuditChain([e1, e2], echo)).toBe(1)
  })

  it('returns the broken index when digest is wrong', () => {
    const e1 = entry('1', '2026-04-28T10:00:00Z', null, 'WRONG')
    expect(verifyAuditChain([e1], echo)).toBe(0)
  })

  it('rejects when the first entry has a non-null prevDigest', () => {
    const e1 = entry('1', '2026-04-28T10:00:00Z', 'prev', '')
    e1.signature.digest = echo(auditEntryDigestInput(e1))
    expect(verifyAuditChain([e1], echo)).toBe(0)
  })

  it('returns -1 for an empty chain', () => {
    expect(verifyAuditChain([], echo)).toBe(-1)
  })
})

describe('isAuditEntryFresh', () => {
  it('keeps entries inside the retention window fresh', () => {
    const recent = entry('a', '2025-01-01T00:00:00Z', null, 'd')
    expect(isAuditEntryFresh(recent, NOW, 7)).toBe(true)
  })

  it('rejects entries past the retention window', () => {
    const old = entry('a', '2018-01-01T00:00:00Z', null, 'd')
    expect(isAuditEntryFresh(old, NOW, 7)).toBe(false)
  })

  it('uses the default retention of 7 years', () => {
    const old = entry('a', '2018-01-01T00:00:00Z', null, 'd')
    expect(isAuditEntryFresh(old, NOW)).toBe(false)
  })
})

describe('groupAuditEntriesByDay', () => {
  it('buckets entries by ISO date and preserves intra-bucket order', () => {
    const e1 = entry('1', '2026-04-27T08:00:00Z', null, 'd1')
    const e2 = entry('2', '2026-04-27T15:00:00Z', null, 'd2')
    const e3 = entry('3', '2026-04-28T01:00:00Z', null, 'd3')
    const grouped = groupAuditEntriesByDay([e1, e2, e3])
    expect(grouped).toEqual([
      { date: '2026-04-27', entries: [e1, e2] },
      { date: '2026-04-28', entries: [e3] },
    ])
  })

  it('returns an empty array for no entries', () => {
    expect(groupAuditEntriesByDay([])).toEqual([])
  })
})

describe('summarizeAuditTrail', () => {
  it('counts events by type and tracks the time range', () => {
    const e1 = entry('1', '2026-04-27T08:00:00Z', null, 'd1', 'REPORT_GENERATED')
    const e2 = entry('2', '2026-04-27T15:00:00Z', null, 'd2', 'REPORT_VIEWED')
    const e3 = entry('3', '2026-04-28T01:00:00Z', null, 'd3', 'REPORT_VIEWED')
    const sum = summarizeAuditTrail([e1, e2, e3])
    expect(sum.totalEntries).toBe(3)
    expect(sum.byEventType.REPORT_GENERATED).toBe(1)
    expect(sum.byEventType.REPORT_VIEWED).toBe(2)
    expect(sum.earliest).toBe('2026-04-27T08:00:00Z')
    expect(sum.latest).toBe('2026-04-28T01:00:00Z')
  })

  it('returns zeros + nulls for an empty trail', () => {
    const sum = summarizeAuditTrail([])
    expect(sum.totalEntries).toBe(0)
    expect(sum.earliest).toBeNull()
    expect(sum.latest).toBeNull()
    for (const v of Object.values(sum.byEventType)) expect(v).toBe(0)
  })
})
