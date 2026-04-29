import {
  REVIEW_KEYBOARD_HINTS,
  canTransitionReviewStatus,
  pendingReviewNarratives,
  reviewQueueCounts,
  reviewStatusLabel,
  reviewerAttribution,
} from '../../utils/narrativeReview'
import type {
  NarrativeReviewStatus,
  RiskNarrative,
} from '../../types/perilNarrative'

function n(
  overrides: Partial<RiskNarrative> & {
    id: string
    confidence: number
    source: RiskNarrative['source']
  },
): RiskNarrative {
  return {
    propertyId: 'p1',
    peril: 'flood',
    score: 50,
    body: 'body',
    generatedAt: '2026-04-28T12:00:00Z',
    ...overrides,
  }
}

describe('pendingReviewNarratives', () => {
  it('keeps only LLM, low-confidence, undecided narratives', () => {
    const narratives: RiskNarrative[] = [
      n({ id: 'a', source: 'LLM', confidence: 0.4 }), // pending - keep
      n({ id: 'b', source: 'LLM', confidence: 0.95 }), // high-conf - drop
      n({ id: 'c', source: 'TEMPLATE', confidence: 0.0 }), // template - drop
      n({ id: 'd', source: 'LLM', confidence: 0.3, reviewStatus: 'APPROVED' }), // decided - drop
      n({ id: 'e', source: 'LLM', confidence: 0.5, reviewStatus: 'PENDING' }), // pending - keep
    ]
    const out = pendingReviewNarratives(narratives)
    expect(out.map((x) => x.id).sort()).toEqual(['a', 'e'])
  })

  it('sorts newest-first by generatedAt', () => {
    const narratives: RiskNarrative[] = [
      n({ id: 'older', source: 'LLM', confidence: 0.4, generatedAt: '2026-04-28T08:00:00Z' }),
      n({ id: 'newer', source: 'LLM', confidence: 0.4, generatedAt: '2026-04-28T15:00:00Z' }),
      n({ id: 'mid',   source: 'LLM', confidence: 0.4, generatedAt: '2026-04-28T11:00:00Z' }),
    ]
    expect(pendingReviewNarratives(narratives).map((x) => x.id)).toEqual([
      'newer',
      'mid',
      'older',
    ])
  })

  it('returns an empty array when given an empty array', () => {
    expect(pendingReviewNarratives([])).toEqual([])
  })
})

describe('reviewQueueCounts', () => {
  it('aggregates pending / approved / rejected only over review-eligible narratives', () => {
    const narratives: RiskNarrative[] = [
      n({ id: 'a', source: 'LLM', confidence: 0.4 }), // pending
      n({ id: 'b', source: 'LLM', confidence: 0.4, reviewStatus: 'PENDING' }), // pending
      n({ id: 'c', source: 'LLM', confidence: 0.4, reviewStatus: 'APPROVED' }), // approved
      n({ id: 'd', source: 'LLM', confidence: 0.4, reviewStatus: 'REJECTED' }), // rejected
      n({ id: 'e', source: 'TEMPLATE', confidence: 0 }), // ineligible
      n({ id: 'f', source: 'REVIEWED', confidence: 0.4 }), // ineligible
    ]
    expect(reviewQueueCounts(narratives)).toEqual({ pending: 2, approved: 1, rejected: 1 })
  })

  it('returns zeros for an empty input', () => {
    expect(reviewQueueCounts([])).toEqual({ pending: 0, approved: 0, rejected: 0 })
  })
})

describe('canTransitionReviewStatus', () => {
  it.each<[NarrativeReviewStatus | undefined, NarrativeReviewStatus, boolean]>([
    [undefined, 'APPROVED', true],
    [undefined, 'REJECTED', true],
    ['PENDING', 'APPROVED', true],
    ['PENDING', 'REJECTED', true],
    ['APPROVED', 'REJECTED', false],
    ['REJECTED', 'APPROVED', false],
    ['APPROVED', 'PENDING', false],
    ['PENDING', 'PENDING', false],
  ])('current=%s next=%s -> %s', (current, next, expected) => {
    expect(canTransitionReviewStatus(current, next)).toBe(expected)
  })
})

describe('reviewStatusLabel', () => {
  it('maps each status to its label', () => {
    expect(reviewStatusLabel('APPROVED')).toBe('Approved')
    expect(reviewStatusLabel('REJECTED')).toBe('Rejected')
    expect(reviewStatusLabel('PENDING')).toBe('Pending review')
    expect(reviewStatusLabel(undefined)).toBe('Pending review')
  })
})

describe('reviewerAttribution', () => {
  it('returns "unassigned" while pending', () => {
    expect(
      reviewerAttribution({ reviewStatus: 'PENDING', reviewerId: 'analyst-1' }),
    ).toBe('unassigned')
    expect(
      reviewerAttribution({ reviewStatus: undefined, reviewerId: 'analyst-1' }),
    ).toBe('unassigned')
  })

  it('returns the reviewer id once decided', () => {
    expect(
      reviewerAttribution({ reviewStatus: 'APPROVED', reviewerId: 'analyst-1' }),
    ).toBe('analyst-1')
    expect(
      reviewerAttribution({ reviewStatus: 'REJECTED', reviewerId: 'analyst-2' }),
    ).toBe('analyst-2')
  })

  it('returns "unattributed" when decided without a reviewer', () => {
    expect(
      reviewerAttribution({ reviewStatus: 'APPROVED', reviewerId: null }),
    ).toBe('unattributed')
  })
})

describe('REVIEW_KEYBOARD_HINTS', () => {
  it('exports stable bindings used by the row + help tooltip', () => {
    expect(REVIEW_KEYBOARD_HINTS.approve).toBe('A')
    expect(REVIEW_KEYBOARD_HINTS.reject).toBe('R')
  })
})
