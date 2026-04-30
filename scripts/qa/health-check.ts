#!/usr/bin/env tsx
/**
 * health-check.ts
 *
 * Checks that the API and web servers are reachable and returning expected
 * responses.  Run this after `npm run dev` to verify the stack is healthy.
 *
 * Usage:
 *   npx tsx scripts/qa/health-check.ts [--api-url http://localhost:4000] [--web-url http://localhost:3000]
 *
 * Exit codes:
 *   0 – all services healthy
 *   1 – one or more services unreachable or returning errors
 */

import * as process from 'process'

interface CheckResult {
  name: string
  url: string
  ok: boolean
  status?: number
  durationMs: number
  error?: string
}

function getArg(flag: string, fallback: string): string {
  const idx = process.argv.indexOf(flag)
  return idx !== -1 && process.argv[idx + 1] ? process.argv[idx + 1] : fallback
}

const API_BASE = getArg('--api-url', 'http://localhost:4000')
const WEB_BASE = getArg('--web-url', 'http://localhost:3000')

async function check(name: string, url: string, expectedStatus = 200): Promise<CheckResult> {
  const start = Date.now()
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(8_000) })
    const durationMs = Date.now() - start
    const ok = res.status === expectedStatus
    return { name, url, ok, status: res.status, durationMs }
  } catch (err: unknown) {
    const durationMs = Date.now() - start
    return {
      name,
      url,
      ok: false,
      durationMs,
      error: err instanceof Error ? err.message : String(err),
    }
  }
}

async function run(): Promise<void> {
  console.log('\n=== CoverGuard Health Check ===\n')

  // /api/properties/search now requires auth; an unauthenticated probe is
  // expected to receive 401 (auth runs before zod schema validation).
  const checks: Array<[string, string, number?]> = [
    ['API root',                                 `${API_BASE}/`,                              200],
    ['API /health',                              `${API_BASE}/health`,                        200],
    ['API /robots.txt',                          `${API_BASE}/robots.txt`,                    200],
    ['API /api/properties/search (no token)',    `${API_BASE}/api/properties/search`,         401],
    ['API /api/properties/suggest?q=Mia',        `${API_BASE}/api/properties/suggest?q=Mia`,  200],
    ['Web root',                                 `${WEB_BASE}/`,                              200],
  ]

  const results: CheckResult[] = await Promise.all(
    checks.map(([name, url, status]) => check(name, url, status)),
  )

  let allOk = true
  for (const r of results) {
    const icon = r.ok ? '✅' : '❌'
    const statusStr = r.status !== undefined ? `HTTP ${r.status}` : 'no response'
    const errorStr = r.error ? `  error: ${r.error}` : ''
    console.log(`${icon}  ${r.name.padEnd(42)} ${statusStr.padEnd(12)} ${r.durationMs}ms${errorStr}`)
    if (!r.ok) allOk = false
  }

  console.log()
  if (allOk) {
    console.log('✅  All services healthy.\n')
  } else {
    console.log('❌  One or more services are not responding as expected.\n')
    console.log('    Make sure the dev servers are running: npm run dev\n')
  }

  process.exit(allOk ? 0 : 1)
}

run().catch((err) => {
  console.error('Health check failed unexpectedly:', err)
  process.exit(1)
})
