import {
  confidenceLabel,
  generateTemplateNarrative,
  meetsEvalThreshold,
  narrativeRequiresReview,
  perilScoreBand,
  selectNarrativeSource,
  summarizeEvalResults,
} from '../../utils/perilNarrative'
import {
  EVAL_PASS_THRESHOLD,
  LOW_CONFIDENCE_THRESHOLD,
  type NarrativeEvalResult,
  type PerilType,
} from '../../types/perilNarrative'

describe('selectNarrativeSource', () => {
  const base = {
    hasReviewed: false,
    llmAvailable: true,
    evalPassed: true,
    modelConfidence: 0.85,
  }

  it('prefers REVIEWED when available', () => {
    expect(selectNarrativeSource({ ...base, hasReviewed: true })).toBe('REVIEWED')
  })

  it('uses LLM when available, eval passed, and confidence is high enough', () => {
    expect(selectNarrativeSource(base)).toBe('LLM')
  })

  it('falls back to TEMPLATE when LLM is unavailable', () => {
    expect(selectNarrativeSource({ ...base, llmAvailable: false })).toBe('TEMPLATE')
  })

  it('falls back to TEMPLATE when eval is failing', () => {
    expect(selectNarrativeSource({ ...base, evalPassed: false })).toBe('TEMPLATE')
  })

  it('falls back to TEMPLATE when model confidence is below the threshold', () => {
    expect(
      selectNarrativeSource({ ...base, modelConfidence: 0.5 }),
    ).toBe('TEMPLATE')
  })
})

describe('narrativeRequiresReview', () => {
  it('queues low-confidence LLM narratives for review', () => {
    expect(
      narrativeRequiresReview({ source: 'LLM', confidence: 0.5 }),
    ).toBe(true)
  })

  it('does not queue high-confidence LLM narratives', () => {
    expect(
      narrativeRequiresReview({ source: 'LLM', confidence: 0.95 }),
    ).toBe(false)
  })

  it('never queues TEMPLATE narratives (deterministic)', () => {
    expect(
      narrativeRequiresReview({ source: 'TEMPLATE', confidence: 0.0 }),
    ).toBe(false)
  })

  it('never queues REVIEWED narratives (already approved)', () => {
    expect(
      narrativeRequiresReview({ source: 'REVIEWED', confidence: 0.5 }),
    ).toBe(false)
  })
})

describe('confidenceLabel', () => {
  it('returns "low" below the threshold', () => {
    expect(confidenceLabel(0.5)).toBe('low')
  })

  it('returns "medium" in the middle band', () => {
    expect(confidenceLabel(LOW_CONFIDENCE_THRESHOLD)).toBe('medium')
    expect(confidenceLabel(0.85)).toBe('medium')
  })

  it('returns "high" at or above 0.9', () => {
    expect(confidenceLabel(0.9)).toBe('high')
    expect(confidenceLabel(1)).toBe('high')
  })
})

describe('perilScoreBand', () => {
  it('buckets scores into the four bands', () => {
    expect(perilScoreBand(0)).toBe('low')
    expect(perilScoreBand(24.9)).toBe('low')
    expect(perilScoreBand(25)).toBe('moderate')
    expect(perilScoreBand(49)).toBe('moderate')
    expect(perilScoreBand(50)).toBe('high')
    expect(perilScoreBand(74)).toBe('high')
    expect(perilScoreBand(75)).toBe('extreme')
    expect(perilScoreBand(100)).toBe('extreme')
  })
})

describe('generateTemplateNarrative', () => {
  const perils: PerilType[] = ['flood', 'fire', 'wind', 'earthquake', 'crime', 'heat']

  it('returns a non-empty string for every peril at every band', () => {
    for (const p of perils) {
      for (const score of [10, 30, 60, 90]) {
        const out = generateTemplateNarrative(p, score)
        expect(out.length).toBeGreaterThan(10)
      }
    }
  })

  it('returns peril-specific copy', () => {
    expect(generateTemplateNarrative('flood', 90)).toMatch(/flood/i)
    expect(generateTemplateNarrative('fire', 90)).toMatch(/wildfire|fire/i)
    expect(generateTemplateNarrative('crime', 90)).toMatch(/crime/i)
  })

  it('returns score-band-specific copy (low vs extreme differ)', () => {
    expect(generateTemplateNarrative('flood', 10)).not.toBe(
      generateTemplateNarrative('flood', 90),
    )
  })
})

describe('summarizeEvalResults', () => {
  const idx = new Map<string, PerilType>([
    ['c1', 'flood'],
    ['c2', 'flood'],
    ['c3', 'fire'],
    ['c4', 'fire'],
  ])

  function r(caseId: string, passed: boolean): NarrativeEvalResult {
    return { caseId, passed, similarity: passed ? 0.9 : 0.4, actualPreview: '' }
  }

  it('computes the aggregate pass rate', () => {
    const out = summarizeEvalResults(
      [r('c1', true), r('c2', true), r('c3', false), r('c4', true)],
      idx,
    )
    expect(out.totalCases).toBe(4)
    expect(out.passedCases).toBe(3)
    expect(out.passRate).toBe(0.75)
  })

  it('computes per-peril slices', () => {
    const out = summarizeEvalResults(
      [r('c1', true), r('c2', false), r('c3', true), r('c4', true)],
      idx,
    )
    expect(out.perPeril.flood).toBe(0.5)
    expect(out.perPeril.fire).toBe(1)
  })

  it('returns 0 pass rate when there are no results', () => {
    const out = summarizeEvalResults([], new Map())
    expect(out.totalCases).toBe(0)
    expect(out.passedCases).toBe(0)
    expect(out.passRate).toBe(0)
  })
})

describe('meetsEvalThreshold', () => {
  it('passes when pass rate is at the spec threshold', () => {
    expect(
      meetsEvalThreshold({
        totalCases: 100,
        passedCases: 90,
        passRate: EVAL_PASS_THRESHOLD,
        perPeril: {},
      }),
    ).toBe(true)
  })

  it('fails when below the threshold', () => {
    expect(
      meetsEvalThreshold({
        totalCases: 100,
        passedCases: 89,
        passRate: 0.89,
        perPeril: {},
      }),
    ).toBe(false)
  })

  it('uses the spec default threshold (0.9)', () => {
    expect(EVAL_PASS_THRESHOLD).toBe(0.9)
  })
})
