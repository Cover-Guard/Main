import {
  DEFAULT_CASE_SIMILARITY_THRESHOLD,
  formatCaseLine,
  jaccardWordSimilarity,
  runEvalBatch,
  runEvalCase,
} from '../../utils/narrativeEvalRunner'
import { StubLlmAdapter } from '../../utils/StubLlmAdapter'
import type { NarrativeEvalCase } from '../../types/perilNarrative'

function caseFixture(
  id: string,
  peril: NarrativeEvalCase['peril'],
  score: number,
  expected: string,
): NarrativeEvalCase {
  return {
    id,
    peril,
    fixture: { score, notes: { femaZone: 'AE' } },
    expected,
  }
}

describe('jaccardWordSimilarity', () => {
  it('returns 1 for identical strings', () => {
    expect(jaccardWordSimilarity('the quick brown fox', 'the quick brown fox')).toBe(1)
  })

  it('returns 0 for fully disjoint vocabularies', () => {
    expect(jaccardWordSimilarity('alpha bravo charlie', 'delta echo foxtrot')).toBe(0)
  })

  it('returns a fraction in (0,1) for partial overlap', () => {
    const sim = jaccardWordSimilarity(
      'flood risk is high near coast',
      'flood risk is severe near shore',
    )
    expect(sim).toBeGreaterThan(0)
    expect(sim).toBeLessThan(1)
  })

  it('is case-insensitive and ignores punctuation', () => {
    expect(
      jaccardWordSimilarity('Flood, FLOOD! flood.', 'flood flood flood'),
    ).toBe(1)
  })

  it('drops short words (a, of, in) so signal-bearing terms dominate', () => {
    // 1-2 char words get filtered; only "flood" survives on both sides.
    const sim = jaccardWordSimilarity('a of in flood', 'flood')
    expect(sim).toBe(1)
  })

  it('returns 0 when both inputs are empty', () => {
    expect(jaccardWordSimilarity('', '')).toBe(0)
  })
})

describe('runEvalCase', () => {
  it('passes when similarity meets the threshold', async () => {
    // The stub returns the deterministic flood TEMPLATE for a high score.
    // We pin the expected narrative to the same template so similarity = 1.
    const c = caseFixture(
      'flood-extreme',
      'flood',
      90,
      'High flood hazard zone. Flood insurance is almost certainly required and pricing reflects it.',
    )
    const r = await runEvalCase(c, new StubLlmAdapter())
    expect(r.passed).toBe(true)
    expect(r.similarity).toBeGreaterThan(0.5)
    expect(r.actualPreview.length).toBeLessThanOrEqual(160)
  })

  it('fails when the actual narrative is far from expected', async () => {
    const c = caseFixture(
      'flood-extreme',
      'flood',
      90,
      'completely unrelated tokens about earthquakes seismic faults soil',
    )
    const r = await runEvalCase(c, new StubLlmAdapter())
    expect(r.passed).toBe(false)
    expect(r.similarity).toBeLessThan(DEFAULT_CASE_SIMILARITY_THRESHOLD)
  })

  it('respects a custom threshold', async () => {
    // High threshold -> fail even good output
    const c = caseFixture('flood-low', 'flood', 10, 'flood standard policies cover')
    const r = await runEvalCase(c, new StubLlmAdapter(), 0.99)
    expect(r.passed).toBe(false)
  })
})

describe('runEvalBatch', () => {
  it('aggregates a per-peril summary', async () => {
    const cases: NarrativeEvalCase[] = [
      caseFixture('f1', 'flood', 90, 'High flood hazard zone. Flood insurance is almost certainly required and pricing reflects it.'),
      caseFixture('f2', 'flood', 10, 'Flood risk is low at this address.'),
      caseFixture('w1', 'wind', 90, 'unrelated text that will not match'),
    ]
    const { results, summary } = await runEvalBatch(cases, new StubLlmAdapter())
    expect(results).toHaveLength(3)
    expect(summary.totalCases).toBe(3)
    expect(summary.perPeril.flood).toBeGreaterThan(0)
    expect(summary.perPeril.wind).toBe(0)
  })
})

describe('formatCaseLine', () => {
  it('prefixes a check mark for passes and an x for fails', () => {
    const c = caseFixture('c1', 'flood', 50, 'x')
    expect(
      formatCaseLine(c, { caseId: 'c1', passed: true, similarity: 0.8, actualPreview: '' }),
    ).toMatch(/^✓/)
    expect(
      formatCaseLine(c, { caseId: 'c1', passed: false, similarity: 0.2, actualPreview: '' }),
    ).toMatch(/^✗/)
  })

  it('includes peril label and case id', () => {
    const c = caseFixture('case-42', 'fire', 50, 'x')
    const line = formatCaseLine(c, {
      caseId: 'case-42',
      passed: true,
      similarity: 0.7,
      actualPreview: '',
    })
    expect(line).toMatch(/fire/)
    expect(line).toMatch(/case-42/)
    expect(line).toMatch(/0\.70/)
  })
})
