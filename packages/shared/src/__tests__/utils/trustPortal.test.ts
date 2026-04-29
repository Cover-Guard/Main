import {
  daysSinceLastReview,
  describeSubprocessorChange,
  requiresSubprocessorReview,
  shouldEmailEnterpriseOnChange,
  soc2ProgressPercent,
  soc2StatusLabel,
  soc2StatusTone,
  summarizeTrustSnapshot,
} from '../../utils/trustPortal'
import type {
  Soc2Status,
  Subprocessor,
  SubprocessorChangeEvent,
  TrustPortalSnapshot,
} from '../../types/trustPortal'

const NOW = new Date('2026-04-28T12:00:00Z')

function subprocessor(
  overrides: Partial<Subprocessor> = {},
): Subprocessor {
  return {
    id: 's1',
    name: 'Stripe',
    purpose: 'Payments',
    dataAccessed: ['BILLING'],
    jurisdiction: 'US',
    addedAt: '2025-01-01T00:00:00Z',
    lastReviewedAt: NOW.toISOString(),
    active: true,
    ...overrides,
  }
}

describe('soc2StatusLabel', () => {
  it.each<[Soc2Status, string]>([
    ['NOT_STARTED', 'Not started'],
    ['READINESS_IN_PROGRESS', 'Readiness in progress'],
    ['TYPE_I_ACHIEVED', 'SOC 2 Type I achieved'],
    ['TYPE_II_IN_AUDIT', 'SOC 2 Type II in audit'],
    ['TYPE_II_ACHIEVED', 'SOC 2 Type II achieved'],
  ])('%s -> %s', (status, label) => {
    expect(soc2StatusLabel(status)).toBe(label)
  })
})

describe('soc2StatusTone', () => {
  it('classifies NOT_STARTED as neutral', () => {
    expect(soc2StatusTone('NOT_STARTED')).toBe('neutral')
  })

  it('classifies in-flight states as progress', () => {
    expect(soc2StatusTone('READINESS_IN_PROGRESS')).toBe('progress')
    expect(soc2StatusTone('TYPE_II_IN_AUDIT')).toBe('progress')
  })

  it('classifies achieved states as success', () => {
    expect(soc2StatusTone('TYPE_I_ACHIEVED')).toBe('success')
    expect(soc2StatusTone('TYPE_II_ACHIEVED')).toBe('success')
  })
})

describe('soc2ProgressPercent', () => {
  it('moves monotonically up the SOC 2 ladder', () => {
    expect(soc2ProgressPercent('NOT_STARTED')).toBeLessThan(
      soc2ProgressPercent('READINESS_IN_PROGRESS'),
    )
    expect(soc2ProgressPercent('READINESS_IN_PROGRESS')).toBeLessThan(
      soc2ProgressPercent('TYPE_I_ACHIEVED'),
    )
    expect(soc2ProgressPercent('TYPE_I_ACHIEVED')).toBeLessThan(
      soc2ProgressPercent('TYPE_II_IN_AUDIT'),
    )
    expect(soc2ProgressPercent('TYPE_II_IN_AUDIT')).toBeLessThan(
      soc2ProgressPercent('TYPE_II_ACHIEVED'),
    )
  })

  it('caps at 100 for the achieved state', () => {
    expect(soc2ProgressPercent('TYPE_II_ACHIEVED')).toBe(100)
  })
})

describe('daysSinceLastReview', () => {
  it('returns 0 for a review timestamp identical to now', () => {
    expect(daysSinceLastReview({ lastReviewedAt: NOW.toISOString() }, NOW)).toBe(0)
  })

  it('returns the floor of (now - reviewedAt) in days', () => {
    const ten = new Date(NOW.getTime() - 10 * 24 * 60 * 60 * 1000).toISOString()
    expect(daysSinceLastReview({ lastReviewedAt: ten }, NOW)).toBe(10)
  })

  it('clamps negative deltas to 0', () => {
    const future = new Date(NOW.getTime() + 24 * 60 * 60 * 1000).toISOString()
    expect(daysSinceLastReview({ lastReviewedAt: future }, NOW)).toBe(0)
  })

  it('returns null for unparseable timestamps', () => {
    expect(daysSinceLastReview({ lastReviewedAt: 'garbage' }, NOW)).toBeNull()
  })
})

describe('requiresSubprocessorReview', () => {
  it('flags rows past the default 365-day cadence', () => {
    const old = new Date(NOW.getTime() - 366 * 24 * 60 * 60 * 1000).toISOString()
    expect(
      requiresSubprocessorReview({ lastReviewedAt: old }, NOW),
    ).toBe(true)
  })

  it('does not flag rows inside the cadence', () => {
    const recent = new Date(NOW.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString()
    expect(
      requiresSubprocessorReview({ lastReviewedAt: recent }, NOW),
    ).toBe(false)
  })

  it('respects a custom cadence', () => {
    const sixty = new Date(NOW.getTime() - 60 * 24 * 60 * 60 * 1000).toISOString()
    expect(
      requiresSubprocessorReview({ lastReviewedAt: sixty }, NOW, 30),
    ).toBe(true)
  })

  it('does not flag a row with an unparseable timestamp', () => {
    expect(
      requiresSubprocessorReview({ lastReviewedAt: 'garbage' }, NOW),
    ).toBe(false)
  })
})

describe('describeSubprocessorChange', () => {
  it.each<[SubprocessorChangeEvent['kind'], RegExp]>([
    ['ADDED', /^Added Stripe$/],
    ['REMOVED', /^Removed Stripe$/],
    ['PURPOSE_UPDATED', /purpose/],
    ['JURISDICTION_CHANGED', /jurisdiction/],
  ])('%s renders human-readable copy', (kind, expected) => {
    expect(
      describeSubprocessorChange({
        id: 'e1',
        kind,
        subprocessorId: 's1',
        subprocessorName: 'Stripe',
        publishedAt: NOW.toISOString(),
        publishedBy: 'security-bot',
      }),
    ).toMatch(expected)
  })
})

describe('summarizeTrustSnapshot', () => {
  it('combines SOC 2 status, active count, and policy version', () => {
    const snapshot: TrustPortalSnapshot = {
      soc2Status: 'TYPE_II_IN_AUDIT',
      generatedAt: NOW.toISOString(),
      activeSubprocessors: [subprocessor(), subprocessor({ id: 's2', name: 'Twilio' })],
      removedSubprocessors: [],
      dataHandlingPolicy: {
        publishedAt: '2026-03-01T00:00:00Z',
        version: 'v3.2',
        url: 'https://trust.coverguard.io/policy',
        summary: 'We treat customer data carefully.',
      },
      securityTxtUrl: 'https://coverguard.io/.well-known/security.txt',
      doiPostureSummary: 'CoverGuard complies with state DOI privacy rules.',
    }
    expect(summarizeTrustSnapshot(snapshot)).toBe(
      'SOC 2 Type II in audit · 2 active subprocessors · policy v3.2',
    )
  })

  it('handles the singular case for active subprocessors', () => {
    const snapshot: TrustPortalSnapshot = {
      soc2Status: 'NOT_STARTED',
      generatedAt: NOW.toISOString(),
      activeSubprocessors: [subprocessor()],
      removedSubprocessors: [],
      dataHandlingPolicy: {
        publishedAt: '2026-03-01T00:00:00Z',
        version: 'v1',
        url: 'https://trust.coverguard.io/policy',
        summary: '',
      },
      securityTxtUrl: '',
      doiPostureSummary: '',
    }
    expect(summarizeTrustSnapshot(snapshot)).toMatch(/1 active subprocessor /)
  })
})

describe('shouldEmailEnterpriseOnChange', () => {
  it('emails on ADDED', () => {
    expect(shouldEmailEnterpriseOnChange({ kind: 'ADDED' })).toBe(true)
  })

  it('emails on JURISDICTION_CHANGED', () => {
    expect(shouldEmailEnterpriseOnChange({ kind: 'JURISDICTION_CHANGED' })).toBe(true)
  })

  it('does not email on REMOVED (housekeeping)', () => {
    expect(shouldEmailEnterpriseOnChange({ kind: 'REMOVED' })).toBe(false)
  })

  it('does not email on PURPOSE_UPDATED', () => {
    expect(shouldEmailEnterpriseOnChange({ kind: 'PURPOSE_UPDATED' })).toBe(false)
  })
})
