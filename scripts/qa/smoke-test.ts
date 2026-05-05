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
 * Unauthenticated checks (always run): root, /health, HEAD /health,
 * /robots.txt, search 401, suggest, geocode 400, walkscore 404,
 * /api/analytics 404, /api/totally-fake 404, /api/properties 404 (collection
 * root), POST /api/properties/search 404 (wrong verb), GET /api/stripe/webhook
 * 404 (POST-only), /api/auth/me 401, /api/auth/me/saved 401,
 * /api/auth/me/reports 401, PATCH/DELETE /api/auth/me 401,
 * POST /api/auth/me/terms 401, POST /api/auth/sync-profile 401,
 * /api/clients 401 (GET+POST+PATCH+DELETE), /api/dashboard/ticker 401,
 * /api/deals 401 (GET+POST+PATCH+DELETE), /api/deals/stats 401,
 * /api/alerts/carrier-exits 401, POST /api/alerts/carrier-exits/:id/acknowledge
 * 401, /api/advisor/chat 401, /api/push/subscribe 401,
 * /api/notifications/dispatch 401, /api/stripe/subscription 401,
 * /api/stripe/checkout 401, /api/stripe/portal 401,
 * POST /api/stripe/webhook 400 (no signature), /api/auth/register 400,
 * /api/push/vapid (200|503).
 *
 * Property-id-bound checks (--property-id <uuid>): property detail, risk,
 * insurance, insurability, carriers, walkscore (200|503), public-data, full
 * report (200), plus 401 probes against the auth-gated /:id/{report.pdf,
 * checklists,save,quote-request,quote-requests} surfaces (param middleware
 * resolves the id first, so requireAuth fires before the handler).
 *
 * Updated 2026-05-05 (daily-smokeqa-testing):
 *   - Bug fix: smoke-test.ts was truncated mid-statement on disk (same
 *     regression class as the 2026-05-01 morning run). The file would not
 *     parse, so today's run started by restoring the full body. A jest
 *     guard (`smoke-test-line-count.test.ts`) was added to fail loudly on a
 *     future >50% truncation by line count.
 *   - Added new always-on probes:
 *       (a) GET /api/properties (no /search, no /suggest, no /:id) -> 404 --
 *           pins the catch-all behavior on the bare collection root.
 *       (b) GET /api/stripe/webhook -> 404 -- the webhook is POST-only;
 *           a GET should hit the catch-all. The 2026-05-03 run pinned the
 *           POST contract (no signature -> 400), but a GET regression that
 *           registers a debug handler at the same path would silently 200.
 *       (c) POST /api/properties/search (wrong verb) -> 404 -- search is
 *           GET-only; pin the catch-all on the wrong-verb branch.
 *       (d) HEAD /health -> 200 -- pins that helmet/compression/morgan don't
 *           accidentally drop HEAD support (which monitoring services use).
 *   - Added property-id-bound probe:
 *       (e) HEAD /api/properties/:id/report.pdf -> 401 -- pins that the
 *           verb-agnostic param middleware + requireAuth chain handles HEAD
 *           the same as GET. A regression that special-cases GET in
 *           requireAuth would let HEAD probes leak resource existence.
 *
 * Updated 2026-05-04 (daily-smokeqa-testing):
 *   - Added the unauthenticated full-report contract probes -- the only
 *     /:id/* unauthenticated GET that wasn't covered:
 *       (a) GET /api/properties/<bogus>/report -> 404
 *       (b) GET /api/properties/<bogus>/report.pdf -> 404 (NOT 401)
 *       (c) GET /api/properties/:id/report -> 200 (with --property-id)
 *
 * Updated 2026-05-03 (daily-smokeqa-testing):
 *   - PATCH+DELETE /api/clients/:id (401), PATCH+DELETE /api/deals/:id (401)
 *   - GET /api/properties/<bogus> -> 404 (bare detail handler)
 *   - POST /api/stripe/webhook with no signature -> 400
 *   - DELETE /:id/save, PATCH+DELETE /:id/checklists/:checklistId (401)
 *
 * Updated 2026-05-02 (daily-smokeqa-testing):
 *   - PATCH/DELETE /api/auth/me, POST /api/auth/me/terms,
 *     POST /api/auth/sync-profile, POST /api/clients, POST /api/deals,
 *     POST /api/alerts/carrier-exits/:id/acknowledge -- all 401 unauth.
 *   - /:id/walkscore (200|503), /:id/public-data (200), /:id/report.pdf
 *     (401), /:id/checklists GET+POST (401), /:id/save (401),
 *     /:id/quote-request (401), /:id/quote-requests (401).
 *
 * Updated 2026-05-01 (evening): repaired truncated file, added unauth 401
 *   probes for the full set of authed routes, /api/auth/register 400 probe,
 *   /api/totally-fake 404 catch-all, finished section 6 carriers test.
 *
 * Updated 2026-05-01 (morning): /api/analytics 404, /api/advisor/chat 401,
 *   /api/properties/geocode 400, /api/properties/<bogus>/walkscore 404.
 *
 * Updated 2026-04-30: search now requires auth -> 401 unauthenticated.
 *   Added /health, /robots.txt, /api/properties/suggest, dashboard/ticker,
 *   /api/deals, /api/alerts/carrier-exits, /api/push/vapid coverage.
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

async function probe401Send(
  method: 'PATCH' | 'DELETE',
  path: string,
  payload: unknown = {},
): Promise<void> {
  const { status, body } = await apiSend(path, method, payload)
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

  // 0a. HEAD /health (added 2026-05-05).
  await runTest('HEAD /health returns 200', async () => {
    const res = await fetch(`${API_BASE}/health`, {
      method: 'HEAD',
      signal: AbortSignal.timeout(8_000),
    })
    assert(res.status === 200, `expected 200, got ${res.status}`)
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

  // 0c. Catch-all sub-cases (added 2026-05-05).
  await runTest('GET /api/properties returns 404 (collection root not mounted)', async () => {
    const { status, body } = await apiGet('/api/properties')
    assert(status === 404, `expected 404, got ${status}`)
    const error = body.error as { code?: string } | undefined
    assert(error?.code === 'NOT_FOUND', `expected NOT_FOUND, got ${error?.code}`)
  })

  await runTest('GET /api/stripe/webhook returns 404 (POST-only)', async () => {
    const { status, body } = await apiGet('/api/stripe/webhook')
    assert(status === 404, `expected 404, got ${status}`)
    const error = body.error as { code?: string } | undefined
    assert(error?.code === 'NOT_FOUND', `expected NOT_FOUND, got ${error?.code}`)
  })

  await runTest('POST /api/properties/search returns 404 (GET-only)', async () => {
    const { status, body } = await apiSend('/api/properties/search', 'POST', { address: 'x' })
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

  // 1c2. Report on bogus id -> 404 [added 2026-05-04]
  await runTest('GET /api/properties/<bogus>/report returns 404', async () => {
    const { status, body } = await apiGet('/api/properties/totally-bogus-id-zzz/report')
    assert(status === 404, `expected 404, got ${status}`)
    assert(body.success === false, 'body.success should be false')
    const error = body.error as { code?: string } | undefined
    assert(error?.code === 'NOT_FOUND', `expected NOT_FOUND, got ${error?.code}`)
  })

  // 1c3. Report.pdf on bogus id -> 404 NOT 401 [added 2026-05-04]
  await runTest('GET /api/properties/<bogus>/report.pdf returns 404 (not 401)', async () => {
    const res = await fetch(`${API_BASE}/api/properties/totally-bogus-id-zzz/report.pdf`, {
      signal: AbortSignal.timeout(15_000),
    })
    assert(res.status === 404, `expected 404, got ${res.status}`)
    const ct = res.headers.get('content-type') ?? ''
    assert(/application\/json/i.test(ct), `expected JSON content-type, got ${ct}`)
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

  // 1e2. Write-side auth probes added 2026-05-02
  await runTest('PATCH /api/auth/me without token returns 401', async () => {
    const { status, body } = await apiSend('/api/auth/me', 'PATCH', { firstName: 'Anon' })
    assert(status === 401, `expected 401, got ${status}`)
    assert(body.success === false, 'body.success should be false')
  })
  await runTest('DELETE /api/auth/me without token returns 401', async () => {
    const { status, body } = await apiSend('/api/auth/me', 'DELETE', {})
    assert(status === 401, `expected 401, got ${status}`)
    assert(body.success === false, 'body.success should be false')
  })
  await runTest('POST /api/auth/me/terms without token returns 401', async () => {
    await probe401Post('/api/auth/me/terms', {})
  })
  await runTest('POST /api/auth/sync-profile without token returns 401', async () => {
    await probe401Post('/api/auth/sync-profile', {})
  })
  await runTest('POST /api/clients without token returns 401', async () => {
    await probe401Post('/api/clients', {
      firstName: 'Anon',
      lastName: 'Anon',
      email: 'anon@example.com',
    })
  })
  await runTest('POST /api/deals without token returns 401', async () => {
    await probe401Post('/api/deals', { title: 'Anon deal' })
  })
  await runTest('POST /api/alerts/carrier-exits/:id/acknowledge without token returns 401', async () => {
    await probe401Post('/api/alerts/carrier-exits/some-alert-id/acknowledge', {})
  })

  // 1e3. Write-side auth probes added 2026-05-03
  await runTest('PATCH /api/clients/:id without token returns 401', async () => {
    await probe401Send('PATCH', '/api/clients/some-client-id', { firstName: 'Anon' })
  })
  await runTest('DELETE /api/clients/:id without token returns 401', async () => {
    await probe401Send('DELETE', '/api/clients/some-client-id')
  })
  await runTest('PATCH /api/deals/:id without token returns 401', async () => {
    await probe401Send('PATCH', '/api/deals/some-deal-id', { title: 'Anon' })
  })
  await runTest('DELETE /api/deals/:id without token returns 401', async () => {
    await probe401Send('DELETE', '/api/deals/some-deal-id')
  })

  // 1e4. Bare property-detail 404 (added 2026-05-03)
  await runTest('GET /api/properties/<bogus> returns 404', async () => {
    const { status, body } = await apiGet('/api/properties/totally-bogus-id-zzz')
    assert(status === 404, `expected 404, got ${status}`)
    assert(body.success === false, 'body.success should be false')
    const error = body.error as { code?: string } | undefined
    assert(error?.code === 'NOT_FOUND', `expected NOT_FOUND, got ${error?.code}`)
  })

  // 1e5. Stripe webhook 400 no-signature (added 2026-05-03)
  await runTest('POST /api/stripe/webhook without signature returns 400', async () => {
    const { status, body } = await apiSend('/api/stripe/webhook', 'POST', {
      type: 'customer.subscription.updated',
    })
    assert(status === 400, `expected 400, got ${status}`)
    assert(body.success === false, 'body.success should be false')
    const error = body.error as { code?: string } | undefined
    assert(error?.code === 'BAD_REQUEST', `expected BAD_REQUEST, got ${error?.code}`)
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

    await runTest(`GET /api/properties/${firstPropertyId}/report returns full bundle`, async () => {
      const { status, body } = await apiGet(`/api/properties/${firstPropertyId}/report`)
      assert(status === 200, `expected 200, got ${status}`)
      assert(body.success === true, 'body.success should be true')
      const data = body.data as Json
      assert(typeof data.property === 'object' && data.property !== null, 'data.property should be an object')
      assert('risk' in data, 'data.risk should be present (object or null)')
      assert('insurance' in data, 'data.insurance should be present (object or null)')
      assert('insurability' in data, 'data.insurability should be present (object or null)')
      assert('carriers' in data, 'data.carriers should be present (object or null)')
      assert('publicData' in data, 'data.publicData should be present (object or null)')
      const prop = data.property as Json
      assert(typeof prop.id === 'string', 'property.id should be a string')
      assert(typeof prop.address === 'string', 'property.address should be a string')
    })

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

    await runTest(`GET /api/properties/${firstPropertyId}/walkscore returns scores`, async () => {
      const { status, body } = await apiGet(`/api/properties/${firstPropertyId}/walkscore`)
      assert(status === 200 || status === 503, `expected 200 or 503, got ${status}`)
      if (status === 200) {
        assert(body.success === true, 'body.success should be true on 200')
      }
    })

    await runTest(`GET /api/properties/${firstPropertyId}/public-data returns data`, async () => {
      const { status, body } = await apiGet(`/api/properties/${firstPropertyId}/public-data`)
      assert(status === 200, `expected 200, got ${status}`)
      assert(body.success === true, 'body.success should be true')
    })

    await runTest(`GET /api/properties/${firstPropertyId}/report.pdf without token returns 401`, async () => {
      const res = await fetch(`${API_BASE}/api/properties/${firstPropertyId}/report.pdf`, {
        signal: AbortSignal.timeout(15_000),
      })
      assert(res.status === 401, `expected 401, got ${res.status}`)
    })

    // HEAD on report.pdf without token (added 2026-05-05).
    await runTest(`HEAD /api/properties/${firstPropertyId}/report.pdf without token returns 401`, async () => {
      const res = await fetch(`${API_BASE}/api/properties/${firstPropertyId}/report.pdf`, {
        method: 'HEAD',
        signal: AbortSignal.timeout(15_000),
      })
      assert(res.status === 401, `expected 401, got ${res.status}`)
    })

    await runTest(`GET /api/properties/${firstPropertyId}/checklists without token returns 401`, async () => {
      await probe401Get(`/api/properties/${firstPropertyId}/checklists`)
    })
    await runTest(`POST /api/properties/${firstPropertyId}/checklists without token returns 401`, async () => {
      await probe401Post(`/api/properties/${firstPropertyId}/checklists`, {
        checklistType: 'INSPECTION',
        title: 'Test',
        items: [],
      })
    })

    await runTest(`POST /api/properties/${firstPropertyId}/save without token returns 401`, async () => {
      await probe401Post(`/api/properties/${firstPropertyId}/save`, {
        notes: '',
        tags: [],
      })
    })
    await runTest(`DELETE /api/properties/${firstPropertyId}/save without token returns 401`, async () => {
      await probe401Send('DELETE', `/api/properties/${firstPropertyId}/save`)
    })
    await runTest(`PATCH /api/properties/${firstPropertyId}/checklists/:checklistId without token returns 401`, async () => {
      await probe401Send(
        'PATCH',
        `/api/properties/${firstPropertyId}/checklists/some-checklist-id`,
        { title: 'Anon' },
      )
    })
    await runTest(`DELETE /api/properties/${firstPropertyId}/checklists/:checklistId without token returns 401`, async () => {
      await probe401Send(
        'DELETE',
        `/api/properties/${firstPropertyId}/checklists/some-checklist-id`,
      )
    })
    await runTest(`POST /api/properties/${firstPropertyId}/quote-request without token returns 401`, async () => {
      await probe401Post(`/api/properties/${firstPropertyId}/quote-request`, {
        carrierId: 'test-carrier',
        coverageTypes: ['HOMEOWNERS'],
      })
    })
    await runTest(`GET /api/properties/${firstPropertyId}/quote-requests without token returns 401`, async () => {
      await probe401Get(`/api/properties/${firstPropertyId}/quote-requests`)
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
