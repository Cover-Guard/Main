/**
 * Pure runner logic for the narrative eval suite (P1 #9 follow-up B).
 *
 * Decoupled from the file system / argv / process.exit so the unit
 * tests can drive it directly with in-memory fixtures + a stub adapter,
 * and the CLI can wrap it without re-implementing the scoring rules.
 *
 * Spec: docs/enhancements/P1-enhancements.md ("P1 #9 - Plain-Language
 * Risk Narrative") - "Eval suite: a labeled dataset of property × peril
 * × expected-narrative examples; CI eval threshold before deploys."
 */

import type {
  NarrativeEvalCase,
  NarrativeEvalResult,
  NarrativeEvalSummary,
  PerilType,
} from '../types/perilNarrative'
import type { LlmAdapter } from '../types/llmAdapter'
import { summarizeEvalResults } from './perilNarrative'

/**
 * Default per-case similarity threshold. Above this, the case "passes."
 * Tunable from the CLI for experimentation.
 */
export const DEFAULT_CASE_SIMILARITY_THRESHOLD = 0.55

/**
 * Cheap, dependency-free similarity score between two strings.
 *
 * Uses Jaccard similarity over lowercased word sets - good enough to
 * catch "the model emitted obvious nonsense" without pulling in an
 * embedding model. Real semantic similarity belongs in a separate eval
 * tool that runs less frequently than CI.
 *
 * Returns a number in `[0, 1]`. Both inputs empty -> 0.
 */
export function jaccardWordSimilarity(a: string, b: string): number {
  const aSet = new Set(tokenize(a))
  const bSet = new Set(tokenize(b))
  if (aSet.size === 0 && bSet.size === 0) return 0
  let intersection = 0
  for (const w of aSet) if (bSet.has(w)) intersection += 1
  const union = aSet.size + bSet.size - intersection
  return union === 0 ? 0 : intersection / union
}

function tokenize(s: string): string[] {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 2) // drop "a", "of", "in" - boost signal
}

/**
 * Run one eval case against an adapter. Returns the per-case result so
 * the CLI can print failures inline.
 */
export async function runEvalCase(
  c: NarrativeEvalCase,
  adapter: LlmAdapter,
  threshold: number = DEFAULT_CASE_SIMILARITY_THRESHOLD,
): Promise<NarrativeEvalResult> {
  const resp = await adapter.generateNarrative({
    peril: c.peril,
    score: c.fixture.score,
    inputs: c.fixture.notes,
  })
  const similarity = jaccardWordSimilarity(resp.narrative, c.expected)
  return {
    caseId: c.id,
    passed: similarity >= threshold,
    similarity,
    actualPreview: resp.narrative.slice(0, 160),
  }
}

/**
 * Run a whole batch and return a {@link NarrativeEvalSummary}. The CLI
 * uses `meetsEvalThreshold` on the result to decide its exit code.
 */
export async function runEvalBatch(
  cases: readonly NarrativeEvalCase[],
  adapter: LlmAdapter,
  threshold: number = DEFAULT_CASE_SIMILARITY_THRESHOLD,
): Promise<{
  results: NarrativeEvalResult[]
  summary: NarrativeEvalSummary
}> {
  const results: NarrativeEvalResult[] = []
  for (const c of cases) {
    results.push(await runEvalCase(c, adapter, threshold))
  }
  const idx = new Map<string, PerilType>(cases.map((c) => [c.id, c.peril]))
  const summary = summarizeEvalResults(results, idx)
  return { results, summary }
}

/**
 * Render a one-line CLI status for a per-case result. Used by the
 * runner script's pretty-print mode.
 */
export function formatCaseLine(
  c: NarrativeEvalCase,
  r: NarrativeEvalResult,
): string {
  const mark = r.passed ? '✓' : '✗'
  const sim = r.similarity.toFixed(2)
  return `${mark} [${c.peril.padEnd(10)}] ${c.id}  similarity=${sim}`
}
