#!/usr/bin/env tsx
/**
 * smoke-test.ts
 *
 * End-to-end smoke tests that hit the running API to verify key endpoints
 * return valid, well-shaped responses.
 *
 * Usage:
 *   npx tsx scripts/qa/smoke-test.ts [--api-url http://localhost:4000]
 *                                    [--property-id <canonical-uuid>]
 *
 * The unauthenticated checks (root, /health, /robots.txt, search 401, suggest,
 * unauthenticated 401s on /api/auth/me, /api/clients, /api/dashboard/ticker,
 * /api/deals, /api/alerts/carrier-exits, /api/advisor/chat, /api/push/vapid,
 * geocode 400, walkscore 404, /api/analytics 404) always run.
 *
 * The property-detail / risk / insurance / insurability / carriers chain is
 * only exercised when `--property-id` is passed (e.g. against a seeded
 * environment, with auth handled out-of-band).
 *
 * Updated 2026-05-01:
 *   - Replaced /api/analytics 401 probe with a 404 contract (route was
 *     never mounted on the API server; previous assertion was always failing).
 *   - Added /api/advisor/chat (401), /api/properties/geocode (400), and
 *     /api/properties/<bogus>/walkscore (404) probes.
 * Updated 2026-04-30:
 *   - /api/properties/search now requires auth → expect 401 unauthenticated.
 *   - Added /health, /robots.txt, /api/properties/suggest, /api/dashboard/ticker,
 *     /api/deals, /api/alerts/carrier-exits, /api/push/vapid coverage.
 *
 * Exit codes:
 *   0 – all smoke tests passed
 *   1 – one or more tests failed
 */

import * as process from 'process'

type Json = Record<string, unknown>

function getArg(flag: string, fallback: string): string {
  const idx = process.argv.indexOf(flag)
  return idx !== -1 && process.argv[idx + 1] ? process.argv[idx + 1] : fallback
}

const API_BASE = getArg('--api-url', 'http://localhost:4000')

interface TestResult {
  name: string
  ok: boolean
  durationMs: number
  error?: string
}

const results: TestResult[] = []

async function apiGet(path: string): Promise<{ status: number; body: Json }> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    signal: AbortSignal.timeout(15_000),
  })
  const body = (await res.json()) as Json
  return { status: res.status, body }
}

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(`Assertion failed: ${message}`)
}

async function runTest(name: string, fn: () => Promise<void>): Promise<void> {
  const start = Date.now()
  try {
    await fn()
    results.push({ name, ok: true, durationMs: Date.now() - start })
  } catch (err: unknown) {
    results.push({
      name,
      ok: false,
      durationMs: Date.now() - start,
      error: err instanceof Error ? err.message : String(err),
    })
  }
}

async function run(): Promise<void> {
  console.log('\n=== CoverGuard API Smoke Tests ===')
  console.log(`Target: ${API_BASE}\n`)

  // ── 0. Static / liveness endpoints (added 2026-04-30) ───────────────────────
  await runTest('GET / returns API metadata', async () => {
    const { status, body } = await apiGet('/')
    assert(status === 200, `expected 200, got ${status}`)
    assert(typeof body.name === 'string', 'body.name should be a string')
    assert(body.status === 'ok', 'body.status should be "ok"')
  })

  await runTest('GET /health returns ok', async () => {
    const { status, body } = await apiGet('/health')
    assert(status === 200, `expected 200, got ${status}`)
    assert(body.status === 'ok', 'body.status should be "ok"')
    assert(typeof body.timestamp === 'string', 'body.timestamp should be a string')
  })

  await runTest('GET /robots.txt disallows crawlers', async () => {
    const res = await fetch(`${API_BASE}/robots.txt`, { signal: AbortSignal.timeout(8_000) })
    const text = await res.text()
    assert(res.status === 200, `expected 200, got ${res.status}`)
    assert(/User-agent:\s*\*/i.test(text), 'body should declare User-agent: *')
    assert(/Disallow:\s*\//.test(text), 'body should disallow crawl')
  })

  // ── 1. Search is an authenticated endpoint (gated by free-tier usage) ──────
  const firstPropertyId: string | undefined =
    process.argv.indexOf('--property-id') !== -1
      ? process.argv[process.argv.indexOf('--property-id') + 1]
      : undefined

  await runTest('GET /api/properties/search without token returns 401', async () => {
    const { status, body } = await apiGet('/api/properties/search?address=123%20Main%20St')
    assert(status === 401, `expected 401, got ${status}`)
    assert(body.success === false, 'body.success should be false')
  })

  await runTest('GET /api/properties/search with no params returns 401 (auth runs first)', async () => {
    const { status, body } = await apiGet('/api/properties/search')
    assert(status === 401, `expected 401, got ${status}`)
    assert(body.success === false, 'body.success should be false')
  })

  await runTest('GET /api/properties/suggest?q=Mia returns 200', async () => {
    const { status, body } = await apiGet('/api/properties/suggest?q=Mia')
    assert(status === 200, `expected 200, got ${status}`)
    assert(body.success === true, 'body.success should be true')
    assert(Array.isArray(body.data), 'body.data should be an array')
  })

  await runTest('GET /api/properties/suggest with too-short q returns 400', async () => {
    const { status } = await apiGet('/api/properties/suggest?q=a')
    assert(status === 400, `expected 400, got ${status}`)
  })

  // ── 2. Property detail (only when --property-id passed) ──────────────────────
  if (firstPropertyId) {
    await runTest(`GET /api/properties/${firstPropertyId} returns property`, async () => {
      const { status, body } = await apiGet(`/api/properties/${firstPropertyId}`)
      assert(status === 200, `expected 200, got ${status}`)
      assert(body.success === true, 'body.success should be true')
      const prop = body.data as Json
      assert(typeof prop.id === 'string', 'property.id should be a string')
      assert(typeof prop.address === 'string', 'property.address should be a string')
      assert(typeof prop.state === 'string', 'property.state should be a string')
    })

    await runTest(`GET /api/properties/${firstPropertyId}/risk returns risk profile`, async () => {
      const { status, body } = await apiGet(`/api/properties/${firstPropertyId}/risk`)
      assert(status === 200, `expected 200, got ${status}`)
      const risk = body.data as Json
      assert(typeof risk.overallRiskScore === 'number', 'overallRiskScore should be a number')
      assert(typeof risk.overallRiskLevel === 'string', 'overallRiskLevel should be a string')
    })

    await runTest(
      `GET /api/properties/${firstPropertyId}/insurance returns estimate`,
      async () => {
        const { status, body } = await apiGet(`/api/properties/${firstPropertyId}/insurance`)
        assert(status === 200, `expected 200, got ${status}`)
        const est = body.data as Json
        assert(typeof est.estimatedAnnualTotal === 'number', 'estimatedAnnualTotal should be a number')
      },
    )

    await runTest(
      `GET /api/properties/${firstPropertyId}/insurability returns status`,
      async () => {
        const { status, body } = await apiGet(`/api/properties/${firstPropertyId}/insurability`)
        assert(status === 200, `expected 200, got ${status}`)
        const ins = body.data as Json
        assert(typeof ins.isInsurable === 'boolean', 'isInsurable should be a boolean')
      },
    )

    await runTest(
      `GET /api/properties/${firstPropertyId}/carriers returns carrier list`,
      async () => {
        const { status, body } = await apiGet(`/api/properties/${firstPropertyId}/carriers`)
        assert(status === 200, `expected 200, got ${status}`)
        const carriers = body.data as Json
        assert(Array.isArray(carriers.carriers), 'carriers.carriers should be an array')
      },
    )
  } else {
    console.warn('  ⚠️  No --property-id passed — skipping property-specific tests.\n')
  }

  // ── 7. Auth: unauthenticated access is rejected ──────────────────────────────
  await runTest('GET /api/auth/me without token returns 401', async () => {
    const res = await fetch(`${API_BASE}/api/auth/me`, { signal: AbortSignal.timeout(8_000) })
    assert(res.status === 401, `expected 401, got ${res.status}`)
  })

  await runTest('GET /api/clients without token returns 401', async () => {
    const res = await fetch(`${API_BASE}/api/clients`, { signal: AbortSignal.timeout(8_000) })
    assert(res.status === 401, `expected 401, got ${res.status}`)
  })

  // 2026-05-01: /api/analytics was removed from the API server.
  await runTest('GET /api/analytics is gone (404, not 401)', async () => {
    const res = await fetch(`${API_BASE}/api/analytics`, { signal: AbortSignal.timeout(8_000) })
    assert(res.status === 404, `expected 404, got ${res.status}`)
  })

  await runTest('GET /api/dashboard/ticker without token returns 401', async () => {
    const res = await fetch(`${API_BASE}/api/dashboard/ticker`, { signal: AbortSignal.timeout(8_000) })
    assert(res.status === 401, `expected 401, got ${res.status}`)
  })

  await runTest('GET /api/deals without token returns 401', async () => {
    const res = await fetch(`${API_BASE}/api/deals`, { signal: AbortSignal.timeout(8_000) })
    assert(res.status === 401, `expected 401, got ${res.status}`)
  })

  await runTest('GET /api/alerts/carrier-exits without token returns 401', async () => {
    const res = await fetch(`${API_BASE}/api/alerts/carrier-exits`, { signal: AbortSignal.timeout(8_000) })
    assert(res.status === 401, `expected 401, got ${res.status}`)
  })

  // 2026-05-01: advisor chat is auth-gated + free-tier usage gated.
  await runTest('POST /api/advisor/chat without token returns 401', async () => {
    const res = await fetch(`${API_BASE}/api/advisor/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: [{ role: 'user', content: 'hi' }] }),
      signal: AbortSignal.timeout(8_000),
    })
    assert(res.status === 401, `expected 401, got ${res.status}`)
  })

  // 2026-05-01: geocode is unauthenticated but Zod-validated.
  await runTest('POST /api/properties/geocode with empty body returns 400', async () => {
    const res = await fetch(`${API_BASE}/api/properties/geocode`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
      signal: AbortSignal.timeout(8_000),
    })
    assert(res.status === 400, `expected 400, got ${res.status}`)
  })

  // 2026-05-01: a clearly-bogus :id should 404 from the param middleware.
  await runTest('GET /api/properties/<bogus>/walkscore returns 404', async () => {
    const res = await fetch(`${API_BASE}/api/properties/this-is-not-a-real-id/walkscore`, {
      signal: AbortSignal.timeout(8_000),
    })
    assert(res.status === 404, `expected 404, got ${res.status}`)
  })

  await runTest('GET /api/push/vapid is 200 or 503 (never 5xx-other)', async () => {
    const { status, body } = await apiGet('/api/push/vapid')
    assert(status === 200 || status === 503, `expected 200 or 503, got ${status}`)
    if (status === 200) {
      const data = body.data as Json | undefined
      const publicKey = (data?.publicKey ?? body.publicKey) as string | undefined
      assert(typeof publicKey === 'string' && publicKey.length > 0, 'publicKey should be a non-empty string')
    } else {
      assert(body.success === false, 'body.success should be false on 503')
    }
  })

  await runTest('GET /api/unknown returns 404', async () => {
    const { status } = await apiGet('/api/unknown-route-xyz')
    assert(status === 404, `expected 404, got ${status}`)
  })

  // ── Report ───────────────────────────────────────────────────────────────────
  console.log('\n--- Results ---\n')
  let allOk = true
  for (const r of results) {
    const icon = r.ok ? '✅' : '❌'
    const extra = r.error ? `\n      ${r.error}` : ''
    console.log(`${icon}  ${r.name.padEnd(68)} ${r.durationMs}ms${extra}`)
    if (!r.ok) allOk = false
  }

  const passed = results.filter((r) => r.ok).length
  const failed = results.filter((r) => !r.ok).length
  console.log(`\n${passed} passed, ${failed} failed out of ${results.length} tests\n`)

  process.exit(allOk ? 0 : 1)
}

run().catch((err) => {
  console.error('Smoke test runner failed:', err)
  process.exit(1)
})
