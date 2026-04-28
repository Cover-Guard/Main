/**
 * LLM provider adapter contract for the plain-language risk narrative
 * pipeline (P1 #9 follow-up A).
 *
 * Lets the model layer change (Anthropic / OpenAI / Vertex / on-prem)
 * without touching the helpers, the report UI, or the eval runner. Any
 * code that wants to ask for a narrative talks to {@link LlmAdapter}.
 *
 * Forward-compat: this PR ships the contract + a per-peril prompt
 * builder. The actual `AnthropicAdapter` / `OpenAIAdapter` impls land in
 * a follow-up infra PR.
 */

import type { PerilType } from './perilNarrative'

/** Which provider is fielding the call. */
export type LlmProvider = 'ANTHROPIC' | 'OPENAI' | 'VERTEX' | 'STUB'

/**
 * Versioned model coordinates. We keep the version explicit so the eval
 * runner can pin the model under test and so production deploys can
 * tag (provider, model, promptVersion) on every narrative.
 */
export interface ModelCoordinates {
  provider: LlmProvider
  /** e.g. "claude-sonnet-4-6", "gpt-4.1-mini". Provider-specific. */
  model: string
  /** Internal version of the prompt template family. */
  promptVersion: string
}

/**
 * Tunable knobs applied to one call. Defaults live in
 * {@link DEFAULT_LLM_CALL_OPTIONS}.
 */
export interface LlmCallOptions {
  /** 0..1 sampling temperature. */
  temperature: number
  /** Hard cap on output tokens. */
  maxOutputTokens: number
  /** Wall-clock timeout in ms before the adapter must reject. */
  timeoutMs: number
}

/**
 * One narrative generation request - everything the prompt builder needs
 * to produce a high-quality paragraph for a peril.
 *
 * The adapter is responsible for:
 *  - Building the prompt via {@link buildNarrativePrompt}
 *  - Calling the model
 *  - Mapping the response into a {@link NarrativeGenerationResponse}
 *  - Honoring `options.timeoutMs`
 */
export interface NarrativeGenerationRequest {
  peril: PerilType
  /** 0-100 peril score. */
  score: number
  /** Free-form structured inputs: zone codes, distances, model versions. */
  inputs: Record<string, string | number | boolean | null>
  /** Optional address label - reserved for future address-aware copy. */
  addressLabel?: string
  /** Override defaults if the caller wants. */
  options?: Partial<LlmCallOptions>
}

/**
 * What the adapter returns. `narrative` is the body string; `confidence`
 * is the model's self-assessed score, used by `narrativeRequiresReview`.
 */
export interface NarrativeGenerationResponse {
  narrative: string
  /** 0..1 model confidence. */
  confidence: number
  /** Coordinates the model was called with - tagged on every output. */
  modelCoordinates: ModelCoordinates
  /** Wall-clock ms the call took. */
  latencyMs: number
  /** Tokens consumed; null if the provider didn't report usage. */
  tokensIn: number | null
  tokensOut: number | null
}

/**
 * The LLM adapter interface. One concrete impl per provider.
 *
 * Adapters MUST:
 *  - Return TEMPLATE-equivalent narratives via the `generateTemplateNarrative`
 *    fallback when they internally fail or time out (callers should not
 *    have to wrap each call in a try/catch + fallback - that's the
 *    adapter's job).
 *  - Surface real errors only when the call is unrecoverable.
 */
export interface LlmAdapter {
  readonly coordinates: ModelCoordinates
  generateNarrative(req: NarrativeGenerationRequest): Promise<NarrativeGenerationResponse>
}

/** Default call options - matches our SLA budgets. */
export const DEFAULT_LLM_CALL_OPTIONS: LlmCallOptions = {
  temperature: 0.3,
  maxOutputTokens: 220,
  timeoutMs: 8_000,
}

/** Stub coordinates - used in tests + the eval-runner dry-run mode. */
export const STUB_MODEL_COORDINATES: ModelCoordinates = {
  provider: 'STUB',
  model: 'narrative-stub-v0',
  promptVersion: 'narrative-prompt-v0',
}
