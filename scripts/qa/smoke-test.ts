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
 * Unauthenticated checks (always run): root, /health, /robots.txt, search 401,
 * suggest, geocode 400, walkscore 404, /api/analytics 404, /api/totally-fake
 * 404, /api/auth/me 401, /api/auth/me/saved 401, /api/auth/me/reports 401,
 * /api/clients 401, /api/dashboard/ticker 401, /api/deals 401,
 * /api/deals/stats 401, /api/alerts/carrier-exits 401, /api/advisor/chat 401,
 * /api/push/subscribe 401, /api/notifications/dispatch 401,
 * /api/stripe/subscription 401, /api/stripe/checkout 401, /api/stripe/portal
 * 401, /api/auth/register 400, /api/push/vapid (200|503).
 *
 * Property-id-bound checks (--property-id <uuid>): property detail, risk,
 * insurance, insurability, carriers.
 *
 * Updated 2026-05-01 (evening - daily-smokeqa-testing run #2):
 *   - Repaired the truncated file (the morning run left section 6 cut off
 *     mid-statement, and the unauthenticated 401 probes promised by the
 *     header docblock were never written into the body - the file was
 *     syntactically invalid and would not have run at all).
 *   - Added unauth 401 probes for the full set of authed routes.
 *   - Added /api/auth/register validation probe (400 on empty body).
 *   - Added /api/totally-fake 404 to pin the express catch-all contract.
 *   - Finished the carriers (section 6) test that was truncated.
 *
 * Updated 2026-05-01 (morning):
 *   - Replaced /api/analytics 401 probe with a 404 contract.
 *   - Added /api/advisor/chat (401), /api/properties/geocode (400), and
 *     /api/properties/<bogus>/walkscore (404) probes.
 * Updated 2026-04-30:
 *   - /api/properties/search now requires auth -> expect 401 unauthenticated.
 *   - Added /health, /robots.txt, /api/properties/suggest, /api/dashboard/ticker,
 *     /api/deals, /api/alerts/carrier-exits, /api/push/vapid coverage.
 *
 * Exit codes:
 *   0 - all smoke tests passed
 *   1 - one or more tests failed
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

async function apiSend(
  path: string,
  method: 'POST' | 'PATCH' | 'PUT' | 'DELETE',
  payload: unknown = {},
): Promise<{ status: number; body: Json }> {
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(15_000),
  })
  let body: Json = {}
  try {
    body = (await res.json()) as Json
  } catch {
    body = {}
  }
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

async function probe401Get(path: string): Promise<void> {
  const { status, body } = await apiGet(path)
  assert(status === 401, `expected 401, got ${status}`)
  assert(body.success === false, 'body.success should be false')
}

async function probe401Post(path: string, payload: unknown): Promise<void> {
  const { status, body } = await apiSend(path, 'POST', payload)
  assert(status === 401, `expected 401, got ${status}`)
  assert(body.success === false, 'body.success should be false')
}

async function run(): Promise<void> {
  console.log('\n=== CoverGuard API Smoke Tests ===')
  console.log(`Target: ${API_BASE}\n`)

  // 0. Static / liveness endpoints
  await runTest('GET / returns API metadata', async () => {
    const { status, body } = await apiGet('/')
    assert(status === 200, `expected 200, got ${status}`)
    assert(typeof body.name === 'string', 'body.name should be a string')
    assert(body.status === 'ok', 'body.status should be ok')
  })

  await runTest('GET /health returns ok', async () => {
    const { status, body } = await apiGet('/health')
    assert(status === 200, `expected 200, got ${status}`)
    assert(body.status === 'ok', 'body.status should be ok')
    assert(typeof body.timestamp === 'string', 'body.timestamp should be a string')
  })

  await runTest('GET /robots.txt disallows crawlers', async () => {
    const res = await fetch(`${API_BASE}/robots.txt`, { signal: AbortSignal.timeout(8_000) })
    const text = await res.text()
    assert(res.status === 200, `expected 200, got ${res.status}`)
    assert(/User-agent:\s*\*/i.test(text), 'body should declare User-agent: *')
    assert(/Disallow:\s*\//.test(text), 'body should disallow crawl')
  })

  // 0b. 404 catch-all contract
  await runTest('GET /api/analytics returns 404 (not mounted)', async () => {
    const { status, body } = await apiGet('/api/analytics')
    assert(status === 404, `expected 404, got ${status}`)
    const error = body.error as { code?: string } | undefined
    assert(error?.code === 'NOT_FOUND', `expected NOT_FOUND, got ${error?.code}`)
  })

  await runTest('GET /api/totally-fake-route-xyz returns 404', async () => {
    const { status, body } = await apiGet('/api/totally-fake-route-xyz')
    assert(status === 404, `expected 404, got ${status}`)
    const error = body.error as { code?: string } | undefined
    assert(error?.code === 'NOT_FOUND', `expected NOT_FOUND, got ${error?.code}`)
  })

  // 1. Search is authenticated
  const firstPropertyId: string | undefined =
    process.argv.indexOf('--property-id') !== -1
      ? process.argv[process.argv.indexOf('--property-id') + 1]
      : undefined

  await runTest('GET /api/properties/search without token returns 401', async () => {
    await probe401Get('/api/properties/search?address=123%20Main%20St')
  })

  await runTest('GET /api/properties/search with no params returns 401', async () => {
    await probe401Get('/api/properties/search')
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

  // 1b. Geocode validation
  await runTest('POST /api/properties/geocode with empty body returns 400', async () => {
    const { status, body } = await apiSend('/api/properties/geocode', 'POST', {})
    assert(status === 400, `expected 400, got ${status}`)
    assert(body.success === false, 'body.success should be false')
  })

  // 1c. Walkscore on bogus id -> 404 (param middleware)
  await runTest('GET /api/properties/<bogus>/walkscore returns 404', async () => {
    const { status, body } = await apiGet('/api/properties/totally-bogus-id-zzz/walkscore')
    assert(status === 404, `expected 404, got ${status}`)
    assert(body.success === false, 'body.success should be false')
  })

  // 1d. Unauthenticated 401 probes
  await runTest('GET /api/auth/me without token returns 401', async () => {
    await probe401Get('/api/auth/me')
  })
  await runTest('GET /api/auth/me/saved without token returns 401', async () => {
    await probe401Get('/api/auth/me/saved')
  })
  await runTest('GET /api/auth/me/reports without token returns 401', async () => {
    await probe401Get('/api/auth/me/reports')
  })
  await runTest('GET /api/clients without token returns 401', async () => {
    await probe401Get('/api/clients')
  })
  await runTest('GET /api/dashboard/ticker without token returns 401', async () => {
    await probe401Get('/api/dashboard/ticker')
  })
  await runTest('GET /api/deals without token returns 401', async () => {
    await probe401Get('/api/deals')
  })
  await runTest('GET /api/deals/stats without token returns 401', async () => {
    await probe401Get('/api/deals/stats')
  })
  await runTest('GET /api/alerts/carrier-exits without token returns 401', async () => {
    await probe401Get('/api/alerts/carrier-exits')
  })
  await runTest('POST /api/advisor/chat without token returns 401', async () => {
    await probe401Post('/api/advisor/chat', {
      messages: [{ role: 'user', content: 'hi' }],
    })
  })
  await runTest('POST /api/push/subscribe without token returns 401', async () => {
    await probe401Post('/api/push/subscribe', {
      endpoint: 'https://fcm.googleapis.com/fcm/send/abc',
      keys: { p256dh: 'x', auth: 'y' },
    })
  })
  await runTest('POST /api/notifications/dispatch without token returns 401', async () => {
    await probe401Post('/api/notifications/dispatch', { messageId: 'msg-123' })
  })
  await runTest('GET /api/stripe/subscription without token returns 401', async () => {
    await probe401Get('/api/stripe/subscription')
  })
  await runTest('POST /api/stripe/checkout without token returns 401', async () => {
    await probe401Post('/api/stripe/checkout', {
      priceId: 'price_test',
      successUrl: 'https://www.coverguard.io/ok',
      cancelUrl: 'https://www.coverguard.io/cancel',
    })
  })
  await runTest('POST /api/stripe/portal without token returns 401', async () => {
    await probe401Post('/api/stripe/portal', {
      returnUrl: 'https://www.coverguard.io/account',
    })
  })

  // 1e. Auth register validates input shape
  await runTest('POST /api/auth/register with empty body returns 400', async () => {
    const { status } = await apiSend('/api/auth/register', 'POST', {})
    assert(status === 400, `expected 400, got ${status}`)
  })

  // 1f. VAPID public key
  await runTest('GET /api/push/vapid returns 200 or 503', async () => {
    const { status } = await apiGet('/api/push/vapid')
    assert(status === 200 || status === 503, `expected 200 or 503, got ${status}`)
  })

  // 2. Property detail (only with --property-id)
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
      assert(typeof risk.flood === 'object', 'flood should be an object')
      assert(typeof risk.fire === 'object', 'fire should be an object')
      assert(typeof risk.wind === 'object', 'wind should be an object')
      assert(typeof risk.earthquake === 'object', 'earthquake should be an object')
      assert(typeof risk.crime === 'object', 'crime should be an object')
    })

    await runTest(`GET /api/properties/${firstPropertyId}/insurance returns estimate`, async () => {
      const { status, body } = await apiGet(`/api/properties/${firstPropertyId}/insurance`)
      assert(status === 200, `expected 200, got ${status}`)
      const est = body.data as Json
      assert(typeof est.estimatedAnnualTotal === 'number', 'estimatedAnnualTotal should be a number')
      assert(Array.isArray(est.coverages), 'coverages should be an array')
      assert((est.coverages as unknown[]).length > 0, 'at least one coverage type expected')
    })

    await runTest(`GET /api/properties/${firstPropertyId}/insurability returns status`, async () => {
      const { status, body } = await apiGet(`/api/properties/${firstPropertyId}/insurability`)
      assert(status === 200, `expected 200, got ${status}`)
      const ins = body.data as Json
      assert(typeof ins.isInsurable === 'boolean', 'isInsurable should be a boolean')
      assert(typeof ins.difficultyLevel === 'string', 'difficultyLevel should be a string')
      assert(Array.isArray(ins.recommendedActions), 'recommendedActions should be an array')
    })

    // 6. Carriers (finished 2026-05-01 evening)
    await runTest(`GET /api/properties/${firstPropertyId}/carriers returns carriers list`, async () => {
      const { status, body } = await apiGet(`/api/properties/${firstPropertyId}/carriers`)
      assert(status === 200, `expected 200, got ${status}`)
      assert(body.success === true, 'body.success should be true')
      const data = body.data as unknown
      const list = Array.isArray(data)
        ? (data as unknown[])
        : Array.isArray((data as { carriers?: unknown[] })?.carriers)
          ? ((data as { carriers: unknown[] }).carriers as unknown[])
          : null
      assert(list !== null, 'carriers payload should be an array or { carriers: [...] }')
    })
  } else {
    console.log('  (skipping property-id-bound tests - pass --property-id to run them)\n')
  }

  // Report
  const passed = results.filter((r) => r.ok).length
  const failed = results.length - passed

  console.log(`\n=== Results ===`)
  for (const r of results) {
    const icon = r.ok ? 'PASS' : 'FAIL'
    console.log(`[${icon}] ${r.name} (${r.durationMs}ms)`)
    if (!r.ok && r.error) console.log(`        ${r.error}`)
  }
  console.log(`\n${passed}/${results.length} passed${failed > 0 ? `, ${failed} failed` : ''}\n`)

  process.exit(failed > 0 ? 1 : 0)
}

run().catch((err) => {
  console.error('Smoke test runner crashed:', err)
  process.exit(1)
})
