import {
  NARRATIVE_PROMPT_VERSION,
  NARRATIVE_SYSTEM_PROMPT,
  buildNarrativePrompt,
  withPromptVersion,
} from '../../utils/narrativePrompt'
import type { NarrativeGenerationRequest } from '../../types/llmAdapter'
import type { PerilType } from '../../types/perilNarrative'
import { StubLlmAdapter } from '../../utils/StubLlmAdapter'
import { LOW_CONFIDENCE_THRESHOLD } from '../../types/perilNarrative'

function req(
  peril: PerilType,
  score: number,
  extra: Partial<NarrativeGenerationRequest> = {},
): NarrativeGenerationRequest {
  return {
    peril,
    score,
    inputs: { femaZone: 'AE', distanceToCoastMi: 12.4 },
    ...extra,
  }
}

describe('buildNarrativePrompt', () => {
  it('returns both a system prompt and a user prompt', () => {
    const out = buildNarrativePrompt(req('flood', 80))
    expect(out.system).toBe(NARRATIVE_SYSTEM_PROMPT)
    expect(out.user.length).toBeGreaterThan(20)
  })

  it('includes the peril-specific framing line', () => {
    expect(buildNarrativePrompt(req('fire', 80)).user).toMatch(/wildfire/i)
    expect(buildNarrativePrompt(req('crime', 80)).user).toMatch(/crime/i)
    expect(buildNarrativePrompt(req('heat', 80)).user).toMatch(/extreme-heat|heat/i)
  })

  it('includes the rounded score and the score band', () => {
    const out = buildNarrativePrompt(req('flood', 80.7))
    expect(out.user).toMatch(/Score: 81 \/ 100/)
    expect(out.user).toMatch(/extreme/)
  })

  it('renders inputs as sorted key: value lines', () => {
    const out = buildNarrativePrompt(
      req('flood', 50, { inputs: { z: 1, a: 'x', m: null } }),
    )
    // Sorted: a, m, z
    const idxA = out.user.indexOf('- a:')
    const idxM = out.user.indexOf('- m:')
    const idxZ = out.user.indexOf('- z:')
    expect(idxA).toBeGreaterThan(0)
    expect(idxA).toBeLessThan(idxM)
    expect(idxM).toBeLessThan(idxZ)
    expect(out.user).toMatch(/- m: unknown/) // null -> "unknown"
  })

  it('omits the address line when addressLabel is missing', () => {
    expect(buildNarrativePrompt(req('flood', 50)).user).not.toMatch(/^Address:/m)
  })

  it('includes the address line when addressLabel is supplied', () => {
    const out = buildNarrativePrompt(
      req('flood', 50, { addressLabel: '123 Main St, Springfield, IL' }),
    )
    expect(out.user).toMatch(/Address: 123 Main St/)
  })

  it('produces a byte-identical prompt for the same inputs (deterministic)', () => {
    const a = buildNarrativePrompt(req('flood', 80))
    const b = buildNarrativePrompt(req('flood', 80))
    expect(a.user).toBe(b.user)
    expect(a.system).toBe(b.system)
  })

  it('handles no structured inputs gracefully', () => {
    const out = buildNarrativePrompt(req('flood', 50, { inputs: {} }))
    expect(out.user).toMatch(/no structured inputs/)
  })
})

describe('withPromptVersion', () => {
  it('stamps the current NARRATIVE_PROMPT_VERSION onto coordinates', () => {
    const out = withPromptVersion({ provider: 'ANTHROPIC', model: 'claude-sonnet-4-6' })
    expect(out.promptVersion).toBe(NARRATIVE_PROMPT_VERSION)
    expect(out.provider).toBe('ANTHROPIC')
    expect(out.model).toBe('claude-sonnet-4-6')
  })

  it('uses a non-empty version string', () => {
    expect(NARRATIVE_PROMPT_VERSION.length).toBeGreaterThan(0)
  })
})

describe('StubLlmAdapter', () => {
  it('returns a TEMPLATE-equivalent narrative for the requested peril', async () => {
    const adapter = new StubLlmAdapter()
    const out = await adapter.generateNarrative({
      peril: 'flood',
      score: 80,
      inputs: {},
    })
    expect(out.narrative).toMatch(/flood/i)
    expect(out.narrative.length).toBeGreaterThan(10)
  })

  it('reports confidence below the review threshold', async () => {
    const adapter = new StubLlmAdapter()
    const out = await adapter.generateNarrative({ peril: 'fire', score: 50, inputs: {} })
    expect(out.confidence).toBeLessThan(LOW_CONFIDENCE_THRESHOLD)
  })

  it('stamps the current prompt version on every response', async () => {
    const adapter = new StubLlmAdapter()
    const out = await adapter.generateNarrative({ peril: 'wind', score: 30, inputs: {} })
    expect(out.modelCoordinates.promptVersion).toBe(NARRATIVE_PROMPT_VERSION)
  })

  it('honors provider/model overrides on the coordinates', () => {
    const adapter = new StubLlmAdapter({ provider: 'ANTHROPIC', model: 'claude-sonnet-4-6' })
    expect(adapter.coordinates.provider).toBe('ANTHROPIC')
    expect(adapter.coordinates.model).toBe('claude-sonnet-4-6')
  })

  it('reports a non-negative latency in ms', async () => {
    const adapter = new StubLlmAdapter()
    const out = await adapter.generateNarrative({ peril: 'crime', score: 60, inputs: {} })
    expect(out.latencyMs).toBeGreaterThanOrEqual(0)
  })
})
