/**
 * Stub LLM adapter (P1 #9 follow-up A).
 *
 * A deterministic, dependency-free implementation of {@link LlmAdapter}
 * that returns a TEMPLATE-style narrative wrapped in the same response
 * envelope a real provider returns. We use this in:
 *
 *  - Local dev (no API key needed)
 *  - The eval-runner's --dry-run mode
 *  - Unit tests of downstream consumers (review-queue, report wiring)
 *
 * It always succeeds, never times out, and reports a fixed confidence
 * just below {@link LOW_CONFIDENCE_THRESHOLD} so consumers can exercise
 * the review-queue branch without needing a real model.
 *
 * Real provider adapters land in a follow-up infra PR.
 */

import type {
  LlmAdapter,
  ModelCoordinates,
  NarrativeGenerationRequest,
  NarrativeGenerationResponse,
} from '../types/llmAdapter'
import { STUB_MODEL_COORDINATES } from '../types/llmAdapter'
import { LOW_CONFIDENCE_THRESHOLD } from '../types/perilNarrative'
import { generateTemplateNarrative } from './perilNarrative'
import { withPromptVersion } from './narrativePrompt'

/**
 * Drop-in stub. Resolves synchronously-ish (one microtask) so callers
 * still get a Promise-shaped API but tests stay fast.
 */
export class StubLlmAdapter implements LlmAdapter {
  readonly coordinates: ModelCoordinates

  constructor(overrides?: Partial<ModelCoordinates>) {
    this.coordinates = withPromptVersion({
      provider: overrides?.provider ?? STUB_MODEL_COORDINATES.provider,
      model: overrides?.model ?? STUB_MODEL_COORDINATES.model,
    })
  }

  async generateNarrative(
    req: NarrativeGenerationRequest,
  ): Promise<NarrativeGenerationResponse> {
    const start = Date.now()
    const narrative = generateTemplateNarrative(req.peril, req.score)
    // Slightly below threshold so this drops into the review queue when
    // consumers exercise the queue branch.
    const confidence = LOW_CONFIDENCE_THRESHOLD - 0.05
    return {
      narrative,
      confidence,
      modelCoordinates: this.coordinates,
      latencyMs: Date.now() - start,
      tokensIn: null,
      tokensOut: null,
    }
  }
}
