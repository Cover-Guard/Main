/**
 * Per-peril prompt builder for the plain-language risk narrative
 * pipeline (P1 #9 follow-up A).
 *
 * Pure / deterministic / I/O-free: hand it a {@link NarrativeGenerationRequest}
 * and it returns the exact text the adapter sends to the model. That
 * means the eval runner can replay prompts byte-for-byte and the unit
 * tests can pin the prompt family.
 *
 * Prompt design notes:
 *  - One system prompt establishes the brand voice (~plainspoken,
 *    professional, never alarmist).
 *  - Per-peril user prompts include only the inputs the model needs to
 *    explain that peril (avoids the kitchen-sink prompt that hurts
 *    quality).
 *  - We always append a length cap + a tone reminder.
 */

import type {
  NarrativeGenerationRequest,
  ModelCoordinates,
} from '../types/llmAdapter'
import type { PerilType } from '../types/perilNarrative'
import { perilScoreBand } from './perilNarrative'

/**
 * Brand-voice system prompt. Kept short on purpose - the model gets
 * fresh attention budget for the user message.
 */
export const NARRATIVE_SYSTEM_PROMPT = `You are CoverGuard's risk-explainer assistant. You write one short, calm,
factual paragraph (45-90 words) explaining why a property scored the
way it did on a single peril. You are professional and plainspoken.
You never use marketing language, scare tactics, or absolutes like
"guaranteed". When a number is high, say so without drama. When a
number is low, say so without sounding dismissive. Never recommend a
specific carrier by name. Always end with one sentence on what the
buyer / agent should consider doing.`

/** Per-peril user-prompt prefix - a short framing sentence. */
const PERIL_FRAMING: Record<PerilType, string> = {
  flood:      'Explain the flood risk on this property.',
  fire:       'Explain the wildfire risk on this property.',
  wind:       'Explain the wind / hail risk on this property.',
  earthquake: 'Explain the earthquake risk on this property.',
  crime:      'Explain the crime exposure for this property.',
  heat:       'Explain the extreme-heat exposure for this property.',
}

/**
 * Build the full prompt for one narrative call.
 *
 * Returns `{ system, user }` so the adapter can hand them to whichever
 * shape the provider SDK expects (Anthropic uses `system` + `messages`,
 * OpenAI uses a `messages[]` array with role 'system' first, etc).
 */
export function buildNarrativePrompt(
  req: NarrativeGenerationRequest,
): { system: string; user: string } {
  const band = perilScoreBand(req.score)
  const framing = PERIL_FRAMING[req.peril]
  const inputsBlock = formatInputsBlock(req.inputs)
  const addressLine = req.addressLabel
    ? `Address: ${req.addressLabel}\n`
    : ''
  const user =
    `${framing}\n\n` +
    `${addressLine}` +
    `Score: ${Math.round(req.score)} / 100 (${band}).\n` +
    `Inputs:\n${inputsBlock}\n\n` +
    `Write 45-90 words. End with one sentence on what to consider doing.`
  return { system: NARRATIVE_SYSTEM_PROMPT, user }
}

/**
 * Render the structured inputs into a stable, deterministic block of
 * `key: value` lines (one per input, sorted by key so the prompt is
 * byte-identical across runs).
 */
function formatInputsBlock(
  inputs: NarrativeGenerationRequest['inputs'],
): string {
  const keys = Object.keys(inputs).sort()
  if (keys.length === 0) return '  (no structured inputs)'
  return keys
    .map((k) => {
      const v = inputs[k]
      const rendered = v === null ? 'unknown' : String(v)
      return `  - ${k}: ${rendered}`
    })
    .join('\n')
}

/**
 * Stable identifier for the prompt family currently shipped from this
 * file. Bumped whenever the prompt changes; tagged on every narrative so
 * we can correlate eval-set results with the prompt version that
 * produced them.
 */
export const NARRATIVE_PROMPT_VERSION = 'narrative-prompt-v1'

/**
 * Convenience: produce a {@link ModelCoordinates} that pins the prompt
 * version we just built with. The adapter passes this through to its
 * response so the audit trail is complete.
 */
export function withPromptVersion(
  coords: Omit<ModelCoordinates, 'promptVersion'>,
): ModelCoordinates {
  return { ...coords, promptVersion: NARRATIVE_PROMPT_VERSION }
}
