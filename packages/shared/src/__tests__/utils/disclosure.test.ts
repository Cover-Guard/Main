import {
  buildPropertyDisclosureLog,
  canTransitionDisclosure,
  classifyDisclosureSignTime,
  defaultDisclosureExpiry,
  disclosureDigestInput,
  disclosureSignDurationSeconds,
  disclosureStatusCopy,
  isDisclosureExpired,
  isDisclosureExportable,
  maskedSignaturePreview,
  renderDisclosureText,
  validateDisclosureSubmit,
} from '../../utils/disclosure'
import {
  type DisclosureRecord,
  type DisclosureSignature,
  type DisclosureStatus,
  DEFAULT_DISCLOSURE_TTL_DAYS,
  DISCLOSURE_SIGN_TARGET_SECONDS,
} from '../../types/disclosure'

const NOW = '2026-04-29T12:00:00Z'

function signature(overrides: Partial<DisclosureSignature> = {}): DisclosureSignature {
  return {
    typedName: 'Alice Buyer',
    typedInitials: 'AB',
    signedText: 'I acknowledge that I was shown a CoverGuard insurability report.',
    ipAddress: '203.0.113.42',
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
    digestSha256: 'abc123def4567890abcdef1234567890abcdef1234567890abcdef1234567890',
    ...overrides,
  }
}

function record(overrides: Partial<DisclosureRecord> = {}): DisclosureRecord {
  return {
    id: 'd-1',
    propertyId: 'prop-1',
    reportUrn: 'coverguard://report/r-1',
    realtorId: 'realtor-1',
    brokerageId: 'brokerage-1',
    buyer: { email: 'alice@example.com', fullName: 'Alice Buyer' },
    status: 'DRAFT',
    createdAt: NOW,
    sentAt: null,
    viewedAt: null,
    signedAt: null,
    expiresAt: '2026-05-13T12:00:00Z',
    signature: null,
    ...overrides,
  }
}

describe('canTransitionDisclosure', () => {
  it('honors the legal transitions from DRAFT', () => {
    expect(canTransitionDisclosure('DRAFT', 'SENT')).toBe(true)
    expect(canTransitionDisclosure('DRAFT', 'REVOKED')).toBe(true)
    expect(canTransitionDisclosure('DRAFT', 'SIGNED')).toBe(false)
    expect(canTransitionDisclosure('DRAFT', 'VIEWED')).toBe(false)
  })

  it('honors the legal transitions from SENT and VIEWED', () => {
    expect(canTransitionDisclosure('SENT', 'VIEWED')).toBe(true)
    expect(canTransitionDisclosure('SENT', 'EXPIRED')).toBe(true)
    expect(canTransitionDisclosure('SENT', 'REVOKED')).toBe(true)
    expect(canTransitionDisclosure('SENT', 'SIGNED')).toBe(false)
    expect(canTransitionDisclosure('VIEWED', 'SIGNED')).toBe(true)
  })

  it('treats SIGNED / EXPIRED / REVOKED as terminal', () => {
    const terminals: DisclosureStatus[] = ['SIGNED', 'EXPIRED', 'REVOKED']
    const all: DisclosureStatus[] = ['DRAFT', 'SENT', 'VIEWED', 'SIGNED', 'EXPIRED', 'REVOKED']
    for (const t of terminals) {
      for (const target of all) {
        expect(canTransitionDisclosure(t, target)).toBe(false)
      }
    }
  })
})

describe('disclosureStatusCopy', () => {
  it('returns a label + variant for every status', () => {
    const all: DisclosureStatus[] = ['DRAFT', 'SENT', 'VIEWED', 'SIGNED', 'EXPIRED', 'REVOKED']
    for (const s of all) {
      const copy = disclosureStatusCopy(s)
      expect(copy.label.length).toBeGreaterThan(0)
      expect(copy.variant).toBeTruthy()
    }
  })

  it('uses success variant for SIGNED', () => {
    expect(disclosureStatusCopy('SIGNED').variant).toBe('success')
  })
})

describe('renderDisclosureText', () => {
  it('substitutes address and date into the default template', () => {
    const text = renderDisclosureText({
      address: '123 Main St',
      date: new Date('2026-04-29T12:00:00Z'),
    })
    expect(text).toContain('123 Main St')
    expect(text).toContain('CoverGuard insurability report')
  })

  it('honors a custom template', () => {
    const text = renderDisclosureText({
      address: '456 Oak Ave',
      template: 'Custom: I saw {address} on {date}.',
      date: new Date('2026-04-29T12:00:00Z'),
    })
    expect(text).toMatch(/^Custom: I saw 456 Oak Ave on /)
  })
})

describe('disclosureDigestInput', () => {
  it('produces a stable, pipe-separated string', () => {
    const input = disclosureDigestInput({
      recordId: 'd-1',
      reportUrn: 'coverguard://report/r-1',
      buyer: { email: 'a@b.com', fullName: 'A B' },
      signedText: 'I agree',
      typedName: 'A B',
      typedInitials: 'AB',
      ipAddress: '203.0.113.42',
      userAgent: 'Mozilla',
      signedAt: NOW,
    })
    expect(input).toContain('d-1')
    expect(input).toContain('a@b.com')
    expect(input).toContain('203.0.113.42')
    expect(input).toContain(NOW)
    expect(input.split('|').length).toBe(10)
  })

  it('strips newlines from values to prevent format-injection', () => {
    const input = disclosureDigestInput({
      recordId: 'd-1',
      reportUrn: 'coverguard://report/r-1',
      buyer: { email: 'a@b.com', fullName: 'A B' },
      signedText: 'I agree',
      typedName: 'A B',
      typedInitials: 'AB',
      ipAddress: '203.0.113.42',
      userAgent: 'Mozilla\nlinebreak',
      signedAt: NOW,
    })
    expect(input).not.toContain('\n')
  })

  it('handles a null fullName as empty string', () => {
    const input = disclosureDigestInput({
      recordId: 'd-1',
      reportUrn: 'coverguard://report/r-1',
      buyer: { email: 'a@b.com', fullName: null },
      signedText: 'I agree',
      typedName: 'A B',
      typedInitials: 'AB',
      ipAddress: '203.0.113.42',
      userAgent: 'Mozilla',
      signedAt: NOW,
    })
    expect(input).toContain('|a@b.com||A B|')
  })
})

describe('validateDisclosureSubmit', () => {
  it('passes a clean signature', () => {
    expect(validateDisclosureSubmit({ typedName: 'Alice Buyer', typedInitials: 'AB' })).toEqual({
      ok: true,
    })
  })

  it('rejects an empty name', () => {
    expect(validateDisclosureSubmit({ typedName: '   ', typedInitials: 'AB' })).toEqual({
      ok: false,
      reason: 'EMPTY_NAME',
    })
  })

  it('rejects empty initials', () => {
    expect(validateDisclosureSubmit({ typedName: 'Alice Buyer', typedInitials: '' })).toEqual({
      ok: false,
      reason: 'EMPTY_INITIALS',
    })
  })

  it('rejects a too-short name', () => {
    expect(validateDisclosureSubmit({ typedName: 'A', typedInitials: 'A' })).toEqual({
      ok: false,
      reason: 'NAME_TOO_SHORT',
    })
  })

  it('rejects initials that do not appear in the typed name', () => {
    expect(
      validateDisclosureSubmit({ typedName: 'Alice Buyer', typedInitials: 'XQ' }),
    ).toEqual({ ok: false, reason: 'NAME_DOES_NOT_MATCH_INITIALS' })
  })

  it('accepts initials in any case / order so middle names work', () => {
    expect(
      validateDisclosureSubmit({ typedName: 'Mary Anne Smith', typedInitials: 'mas' }),
    ).toEqual({ ok: true })
    expect(
      validateDisclosureSubmit({ typedName: 'Mary Anne Smith', typedInitials: 'sma' }),
    ).toEqual({ ok: true })
  })
})

describe('classifyDisclosureSignTime', () => {
  it('returns FAST under or at the 30s target', () => {
    expect(classifyDisclosureSignTime(DISCLOSURE_SIGN_TARGET_SECONDS)).toBe('FAST')
    expect(classifyDisclosureSignTime(15)).toBe('FAST')
  })

  it('returns OK between 30s and 60s', () => {
    expect(classifyDisclosureSignTime(45)).toBe('OK')
    expect(classifyDisclosureSignTime(60)).toBe('OK')
  })

  it('returns SLOW above 60s', () => {
    expect(classifyDisclosureSignTime(61)).toBe('SLOW')
    expect(classifyDisclosureSignTime(300)).toBe('SLOW')
  })
})

describe('disclosureSignDurationSeconds', () => {
  it('returns null when never signed', () => {
    expect(
      disclosureSignDurationSeconds({ sentAt: NOW, signedAt: null }),
    ).toBeNull()
    expect(
      disclosureSignDurationSeconds({ sentAt: null, signedAt: NOW }),
    ).toBeNull()
  })

  it('computes the seconds between sentAt and signedAt', () => {
    expect(
      disclosureSignDurationSeconds({
        sentAt: '2026-04-29T12:00:00Z',
        signedAt: '2026-04-29T12:00:25Z',
      }),
    ).toBe(25)
  })

  it('clamps negative durations to 0 (clock skew defense)', () => {
    expect(
      disclosureSignDurationSeconds({
        sentAt: '2026-04-29T12:00:25Z',
        signedAt: '2026-04-29T12:00:00Z',
      }),
    ).toBe(0)
  })
})

describe('expiry helpers', () => {
  it('defaultDisclosureExpiry adds the TTL window to createdAt', () => {
    const exp = defaultDisclosureExpiry(NOW, DEFAULT_DISCLOSURE_TTL_DAYS)
    const expMs = new Date(exp).getTime()
    const nowMs = new Date(NOW).getTime()
    expect(expMs - nowMs).toBe(DEFAULT_DISCLOSURE_TTL_DAYS * 24 * 60 * 60 * 1000)
  })

  it('isDisclosureExpired marks SENT/VIEWED past expiry as expired', () => {
    const past = record({
      status: 'SENT',
      expiresAt: '2026-04-28T00:00:00Z',
    })
    expect(isDisclosureExpired(past, new Date(NOW))).toBe(true)
  })

  it('isDisclosureExpired keeps SIGNED records untouched even past expiry', () => {
    const past = record({
      status: 'SIGNED',
      expiresAt: '2026-04-28T00:00:00Z',
    })
    expect(isDisclosureExpired(past, new Date(NOW))).toBe(false)
  })

  it('isDisclosureExpired keeps REVOKED records untouched', () => {
    const past = record({
      status: 'REVOKED',
      expiresAt: '2026-04-28T00:00:00Z',
    })
    expect(isDisclosureExpired(past, new Date(NOW))).toBe(false)
  })
})

describe('buildPropertyDisclosureLog', () => {
  const propertyMeta = new Map([
    ['prop-1', { addressLine1: '123 Main', city: 'Austin', state: 'TX' }],
    ['prop-2', { addressLine1: '456 Oak', city: 'Miami', state: 'FL' }],
  ])

  it('groups by property and ranks by latest createdAt', () => {
    const r1 = record({ id: 'd-1', propertyId: 'prop-1', createdAt: '2026-04-27T00:00:00Z' })
    const r2 = record({
      id: 'd-2',
      propertyId: 'prop-1',
      createdAt: '2026-04-28T00:00:00Z',
      status: 'SIGNED',
    })
    const r3 = record({ id: 'd-3', propertyId: 'prop-2', createdAt: '2026-04-29T00:00:00Z' })
    const log = buildPropertyDisclosureLog([r1, r2, r3], propertyMeta)
    expect(log.length).toBe(2)
    expect(log[0]?.propertyId).toBe('prop-2') // most recent activity
    const prop1 = log.find((l) => l.propertyId === 'prop-1')!
    expect(prop1.latest.id).toBe('d-2') // newer of the two
    expect(prop1.totalCount).toBe(2)
    expect(prop1.signedCount).toBe(1)
  })

  it('drops properties without metadata', () => {
    const r = record({ propertyId: 'unknown' })
    const log = buildPropertyDisclosureLog([r], propertyMeta)
    expect(log.length).toBe(0)
  })

  it('returns an empty array for no records', () => {
    expect(buildPropertyDisclosureLog([], propertyMeta)).toEqual([])
  })
})

describe('isDisclosureExportable', () => {
  it('is true only for SIGNED with a signature', () => {
    const signed = record({ status: 'SIGNED', signature: signature() })
    expect(isDisclosureExportable(signed)).toBe(true)
  })

  it('is false for SIGNED without a signature (data corruption guard)', () => {
    const broken = record({ status: 'SIGNED', signature: null })
    expect(isDisclosureExportable(broken)).toBe(false)
  })

  it('is false for non-SIGNED states', () => {
    expect(isDisclosureExportable(record({ status: 'DRAFT' }))).toBe(false)
    expect(isDisclosureExportable(record({ status: 'EXPIRED' }))).toBe(false)
    expect(isDisclosureExportable(record({ status: 'REVOKED' }))).toBe(false)
  })
})

describe('maskedSignaturePreview', () => {
  it('masks the trailing IP segments', () => {
    const preview = maskedSignaturePreview(signature({ ipAddress: '203.0.113.42' }))
    expect(preview.ipMasked).toBe('203.0.xxx.xxx')
  })

  it('truncates long user agents', () => {
    const longUa = 'A'.repeat(200)
    const preview = maskedSignaturePreview(signature({ userAgent: longUa }))
    expect(preview.uaMasked.endsWith('…')).toBe(true)
    expect(preview.uaMasked.length).toBe(33)
  })

  it('returns the digest prefix (12 chars)', () => {
    const preview = maskedSignaturePreview(
      signature({ digestSha256: 'abcdef0123456789longerdigest' }),
    )
    expect(preview.digestPrefix).toBe('abcdef012345')
  })

  it('preserves the typed name verbatim', () => {
    const preview = maskedSignaturePreview(signature({ typedName: 'Alice Buyer' }))
    expect(preview.typedName).toBe('Alice Buyer')
  })
})
