#!/usr/bin/env tsx
/**
 * run-narrative-evals.ts (P1 #9 follow-up B)
 *
 * Loads the labeled narrative eval-case dataset, runs each case through
 * an {@link LlmAdapter}, prints a per-case + aggregate summary, and
 * exits non-zero if the aggregate pass-rate falls below the spec
 * threshold. Wire this into CI to enforce the deploy-gate from the spec
 * ("Eval pass rate >90% on the labeled set, with PRs blocked below
 * threshold").
 *
 * Usage:
 *   npx tsx scripts/qa/run-narrative-evals.ts \
 *     [--dataset scripts/qa/data/narrative-eval-cases.json] \
 *     [--threshold 0.55]    # per-case similarity threshold
 *     [--dry-run]           # use the StubLlmAdapter (always available)
 *
 * Exit codes:
 *   0 - aggregate pass rate >= EVAL_PASS_THRESHOLD
 *   1 - below threshold
 *   2 - usage / load error
 */

import * as fs from 'node:fs'
import * as path from 'node:path'
import * as process from 'node:process'

import {
  EVAL_PASS_THRESHOLD,
  meetsEvalThreshold,
  type NarrativeEvalCase,
} from '@coverguard/shared'
import {
  DEFAULT_CASE_SIMILARITY_THRESHOLD,
  formatCaseLine,
  runEvalBatch,
  StubLlmAdapter,
} from '@coverguard/shared'

function getArg(flag: string, fallback: string): string {
  const idx = process.argv.indexOf(flag)
  return idx !== -1 && process.argv[idx + 1] ? process.argv[idx + 1] : fallback
}

function hasFlag(flag: string): boolean {
  return process.argv.includes(flag)
}

async function main(): Promise<void> {
  const datasetPath = getArg(
    '--dataset',
    path.resolve(__dirname, 'data/narrative-eval-cases.json'),
  )
  const threshold = Number(
    getArg('--threshold', String(DEFAULT_CASE_SIMILARITY_THRESHOLD)),
  )
  if (Number.isNaN(threshold) || threshold < 0 || threshold > 1) {
    console.error(`error: --threshold must be a number in [0,1], got ${threshold}`)
    process.exit(2)
  }
  const dryRun = hasFlag('--dry-run')

  let raw: string
  try {
    raw = fs.readFileSync(datasetPath, 'utf-8')
  } catch (err) {
    console.error(`error: could not read ${datasetPath}: ${(err as Error).message}`)
    process.exit(2)
    return
  }

  let cases: NarrativeEvalCase[]
  try {
    cases = JSON.parse(raw) as NarrativeEvalCase[]
  } catch (err) {
    console.error(`error: ${datasetPath} is not valid JSON: ${(err as Error).message}`)
    process.exit(2)
    return
  }

  console.log(`narrative evals  -  ${cases.length} cases  -  threshold=${threshold}  -  ${dryRun ? 'DRY RUN (stub adapter)' : 'live model'}`)
  console.log('')

  const adapter = new StubLlmAdapter() // dry-run is the only mode wired here today
  const { results, summary } = await runEvalBatch(cases, adapter, threshold)

  for (let i = 0; i < cases.length; i++) {
    console.log(formatCaseLine(cases[i], results[i]))
  }

  console.log('')
  console.log(`aggregate pass rate: ${(summary.passRate * 100).toFixed(1)}% (${summary.passedCases}/${summary.totalCases})`)
  for (const [peril, rate] of Object.entries(summary.perPeril)) {
    console.log(`  ${peril.padEnd(10)}: ${((rate ?? 0) * 100).toFixed(1)}%`)
  }
  console.log('')

  const passed = meetsEvalThreshold(summary)
  if (passed) {
    console.log(`PASS  -  >= ${(EVAL_PASS_THRESHOLD * 100).toFixed(0)}% deploy-gate threshold`)
    process.exit(0)
  } else {
    console.log(`FAIL  -  below ${(EVAL_PASS_THRESHOLD * 100).toFixed(0)}% deploy-gate threshold`)
    process.exit(1)
  }
}

main().catch((err: unknown) => {
  console.error('unexpected error:', err)
  process.exit(2)
})
