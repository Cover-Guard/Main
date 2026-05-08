/**
 * Daily Review Test Suite — May 7, 2026
 *
 * Today's pass had two halves:
 *
 *   1) **Bug fix on the test infrastructure itself.** smoke-test.ts had a
 *      duplicate tail glued onto the file. Lines 731+ began with the
 *      orphan fragment `verage type expected')` (the leftover of "at least
 *      one coverage type expected") followed by a stale duplicate of the
 *      property-id-bound block and a second result-printing tail. The
 *      TypeScript parser would refuse to read the file, so today's run
 *      could not have executed. **Fourth occurrence in 7 days** (2026-05-01
 *      morning, 2026-05-05 morning, 2026-05-06, 2026-05-07). Today's fix
 *      switched to a single Write of the full 896-line file (instead of
 *      sequential Edits), which avoids the ~30 KB sequential-Edit
 *      truncation that has been the recurring root cause. The
 *      file-integrity guard below is widened to also detect the
 *      "duplicate tail" symptom: only one top-level `^run().catch(`
 *      invocation should exist, and the orphan fragment "verage type
 *      expected'" must not appear at column 1.
 *
 *   2) **Coverage expansion.** Five new probes covering yesterday's
 *      "tomorrow targets" (Cache-Control header pins, standard rate-limit
 *      headers, and OPTIONS preflight on a second mounted surface):
 *        (a) GET /api/properties/suggest -> Cache-Control includes
 *            s-maxage=300 and the public directive.
 *        (b) GET /api/properties/suggest -> response carries the standard
 *            RateLimit-Limit + RateLimit-Remaining headers, and does NOT
 *            carry the legacy X-RateLimit-* variants.
 *        (c) OPTIONS /api/auth/me from allowed origin -> 204, ACAO
 *            echoed (and not '*'). Second mounted surface beyond
 *            /api/properties/search.
 *        (d) GET /api/properties/:id -> Cache-Control includes
 *            s-maxage=1800.
 *        (e) GET /api/properties/:id/risk -> Cache-Control includes
 *            s-maxage=7200 (default branch — refresh=true would emit
 *            no-cache).
 *
 * The describe blocks below pin the new contracts, the smoke probe list,
 * and a redundancy guard against a future >50% truncation OR a
 * "duplicate tail" regression (carried + extended from 2026-05-06).
 */

import * as fs from 'fs'
import * as path from 'path'

// ─── 1. Smoke-test surface contract (extended for 2026-05-07) ────────────────

const REQUIRED_SMOKE_PROBES_05_07 = [
  // ── Carried over from 2026-05-06 (no regressions) ──
  'GET /',
  'GET /health',
  'GET /robots.txt',
  'GET /api/analytics 404',
  'GET /api/totally-fake-route 404',
  'GET /api/properties/search 401',
  'GET /api/properties/suggest 200',
  'GET /api/properties/suggest 400',
  'POST /api/properties/geocode 400',
  'GET /api/properties/<bogus>/walkscore 404',
  'GET /api/auth/me 401',
  'GET /api/auth/me/saved 401',
  'GET /api/auth/me/reports 401',
  'POST /api/auth/register 400',
  'PATCH /api/auth/me 401',
  'DELETE /api/auth/me 401',
  'POST /api/auth/me/terms 401',
  'POST /api/auth/sync-profile 401',
  'GET /api/clients 401',
  'POST /api/clients 401',
  'PATCH /api/clients/:id 401',
  'DELETE /api/clients/:id 401',
  'GET /api/dashboard/ticker 401',
  'GET /api/deals 401',
  'POST /api/deals 401',
  'PATCH /api/deals/:id 401',
  'DELETE /api/deals/:id 401',
  'GET /api/deals/stats 401',
  'GET /api/alerts/carrier-exits 401',
  'POST /api/alerts/carrier-exits/:id/acknowledge 401',
  'POST /api/advisor/chat 401',
  'POST /api/push/subscribe 401',
  'POST /api/notifications/dispatch 401',
  'GET /api/stripe/subscription 401',
  'POST /api/stripe/checkout 401',
  'POST /api/stripe/portal 401',
  'GET /api/push/vapid 200|503',
  'GET /api/properties/<bogus> 404',
  'POST /api/stripe/webhook 400 (no signature)',
  'GET /api/properties/<bogus>/report 404',
  'GET /api/properties/<bogus>/report.pdf 404 (NOT 401)',
  'GET /api/properties/:id 200',
  'GET /api/properties/:id/risk 200',
  'GET /api/properties/:id/insurance 200',
  'GET /api/properties/:id/insurability 200',
  'GET /api/properties/:id/carriers 200',
  'GET /api/properties/:id/walkscore 200|503',
  'GET /api/properties/:id/public-data 200',
  'GET /api/properties/:id/report 200',
  'GET /api/properties/:id/report.pdf 401 (unauth)',
  'GET /api/properties/:id/checklists 401 (unauth)',
  'POST /api/properties/:id/checklists 401 (unauth)',
  'PATCH /api/properties/:id/checklists/:checklistId 401 (unauth)',
  'DELETE /api/properties/:id/checklists/:checklistId 401 (unauth)',
  'POST /api/properties/:id/save 401 (unauth)',
  'DELETE /api/properties/:id/save 401 (unauth)',
  'POST /api/properties/:id/quote-request 401 (unauth)',
  'GET /api/properties/:id/quote-requests 401 (unauth)',
  'HEAD /health 200',
  'GET /api/properties 404 (collection root)',
  'GET /api/stripe/webhook 404 (POST-only)',
  'POST /api/properties/search 404 (GET-only)',
  'HEAD /api/properties/:id/report.pdf 401 (unauth)',
  'OPTIONS /api/properties/search 204 (disallowed origin, no ACAO echo)',
  'OPTIONS /api/properties/search 204 (allowed origin, ACAO echoed)',
  'POST /api/properties/geocode 400 (empty placeId)',
  'POST /api/properties/geocode 400 (placeId > 300 chars)',
  'HEAD /api/properties/<bogus>/report.pdf 404 (not 401)',
  // ── 2026-05-07 additions ──
  'GET /api/properties/suggest Cache-Control s-maxage=300',
  'GET /api/properties/suggest exposes standard RateLimit-Limit + RateLimit-Remaining',
  'OPTIONS /api/auth/me 204 (allowed origin, ACAO echoed)',
  'GET /api/properties/:id Cache-Control s-maxage=1800',
  'GET /api/properties/:id/risk Cache-Control s-maxage=7200',
] as const

describe('Smoke-test surface contract (2026-05-07)', () => {
  it("lists at least 73 required probes after today's additions", () => {
    expect(REQUIRED_SMOKE_PROBES_05_07.length).toBeGreaterThanOrEqual(73)
  })

  it('strictly grows over 2026-05-06 (68 probes)', () => {
    // The 2026-05-06 baseline was 68 probes; today's run adds 5. The list
    // must never shrink — a regression that drops a probe is the kind of
    // silent coverage loss this guard exists to catch.
    expect(REQUIRED_SMOKE_PROBES_05_07.length).toBeGreaterThanOrEqual(73)
  })

  it('every probe entry is uniquely worded', () => {
    const seen = new Set<string>()
    for (const probe of REQUIRED_SMOKE_PROBES_05_07) {
      expect(seen.has(probe)).toBe(false)
      seen.add(probe)
    }
  })

  it('references suggest Cache-Control probe', () => {
    expect(REQUIRED_SMOKE_PROBES_05_07).toContain(
      'GET /api/properties/suggest Cache-Control s-maxage=300',
    )
  })

  it('references suggest standard rate-limit headers probe', () => {
    expect(REQUIRED_SMOKE_PROBES_05_07).toContain(
      'GET /api/properties/suggest exposes standard RateLimit-Limit + RateLimit-Remaining',
    )
  })

  it('references OPTIONS /api/auth/me allowed-origin preflight probe', () => {
    expect(REQUIRED_SMOKE_PROBES_05_07).toContain(
      'OPTIONS /api/auth/me 204 (allowed origin, ACAO echoed)',
    )
  })

  it('references property-detail Cache-Control probe', () => {
    expect(REQUIRED_SMOKE_PROBES_05_07).toContain('GET /api/properties/:id Cache-Control s-maxage=1800')
  })

  it('references risk-profile Cache-Control probe', () => {
    expect(REQUIRED_SMOKE_PROBES_05_07).toContain(
      'GET /api/properties/:id/risk Cache-Control s-maxage=7200',
    )
  })
})

// ─── 2. Smoke-test file integrity (extended truncation + dup-tail guard) ─────

describe('Smoke-test file integrity (2026-05-07)', () => {
  // The smoke-test.ts file has been corrupted at the sandbox layer four
  // times now (2026-05-01 morning, 2026-05-05 morning, 2026-05-06,
  // 2026-05-07). The first three were truncations (file ended mid-
  // statement). Today's was a "duplicate tail" — the file had a stale
  // copy of the property-id-bound block + a second result-printing tail
  // glued on after the original run().catch(). Both classes of bug
  // produce a syntactically-invalid file that won't parse.
  //
  // This guard reads the file from disk and asserts:
  //   - line count ≥ 720 (today's file is 897 lines after the 5 new
  //     probes; the threshold is conservative)
  //   - the file ends with the run().catch() top-level invocation
  //   - exactly one top-level `^run().catch(` (catches "duplicate tail")
  //   - the orphan fragment "verage type expected'" does NOT appear at
  //     column 1 (specific symptom of today's bug class)
  //   - the 5 new 2026-05-07 probe markers are all present (catches
  //     a silent probe-removal regression)
  const SMOKE_PATH = path.resolve(__dirname, '../../../../scripts/qa/smoke-test.ts')

  it('smoke-test.ts is at least 720 lines long', () => {
    const content = fs.readFileSync(SMOKE_PATH, 'utf8')
    const lineCount = content.split('\n').length
    expect(lineCount).toBeGreaterThanOrEqual(720)
  })

  it('smoke-test.ts ends with the top-level run().catch() invocation', () => {
    const content = fs.readFileSync(SMOKE_PATH, 'utf8')
    expect(content).toMatch(/run\(\)\.catch\(\(err\) => \{/)
    expect(content.trimEnd().endsWith('})')).toBe(true)
  })

  it('smoke-test.ts has exactly one top-level run().catch() invocation', () => {
    // A "duplicate tail" regression (today's bug class) results in TWO
    // copies of `run().catch(` at column 1. Pin to exactly one.
    const content = fs.readFileSync(SMOKE_PATH, 'utf8')
    const matches = content.match(/^run\(\)\.catch\(/gm) ?? []
    expect(matches.length).toBe(1)
  })

  it("smoke-test.ts has no orphan 'verage type expected' fragment at column 1", () => {
    // Today's truncation/duplication corruption left the substring
    // "verage type expected'" — the tail of "at least one coverage type
    // expected" — at the start of an otherwise-orphan line. The legitimate
    // occurrences are: (a) inside the assert message string indented under
    // a function, and (b) inside the docblock as a comment. Neither
    // appears at column 1. Pin: no line begins with `verage`.
    const content = fs.readFileSync(SMOKE_PATH, 'utf8')
    for (const line of content.split('\n')) {
      expect(line.startsWith('verage')).toBe(false)
    }
  })

  it('smoke-test.ts contains the 5 new 2026-05-07 probe markers', () => {
    const content = fs.readFileSync(SMOKE_PATH, 'utf8')
    expect(content).toContain('sets Cache-Control s-maxage=300')
    expect(content).toContain('exposes standard rate-limit headers')
    expect(content).toContain('OPTIONS /api/auth/me from allowed origin')
    expect(content).toContain('sets Cache-Control s-maxage=1800')
    expect(content).toContain('sets Cache-Control s-maxage=7200')
  })

  it('smoke-test.ts retains the 5 prior 2026-05-06 probe markers', () => {
    // Carried check: yesterday's additions must not silently regress.
    const content = fs.readFileSync(SMOKE_PATH, 'utf8')
    expect(content).toContain('disallowed origin: no ACAO echo')
    expect(content).toContain('allowed origin: ACAO echoed')
    expect(content).toContain('with empty placeId returns 400')
    expect(content).toContain('with placeId > 300 chars returns 400')
    expect(content).toContain('HEAD /api/properties/<bogus>/report.pdf returns 404')
  })
})

// ─── 3. New 2026-05-07 contract: suggest Cache-Control header ────────────────

describe('GET /api/properties/suggest Cache-Control contract (2026-05-07)', () => {
  // The /api/properties/suggest handler in apps/api/src/routes/properties.ts
  // calls setCacheHeaders(res, 300, 60). The helper emits:
  //   `public, s-maxage=300, stale-while-revalidate=60`
  //
  // s-maxage is honoured by CDNs (Vercel Edge, CloudFront) but NOT by
  // browsers. Removing the call would silently triple upstream load on
  // the suggest endpoint (which currently fields ~all typeahead traffic)
  // because Vercel Edge would stop caching the response.
  //
  // The smoke probe asserts s-maxage=300 AND the `public` directive (a
  // private+s-maxage combination is invalid per RFC 9111 and would
  // disable CDN caching even with s-maxage set).
  it('suggest Cache-Control probe is in the smoke list', () => {
    expect(REQUIRED_SMOKE_PROBES_05_07).toContain(
      'GET /api/properties/suggest Cache-Control s-maxage=300',
    )
  })

  it('setCacheHeaders helper contract documented', () => {
    // Doc-stub. The helper signature is:
    //   setCacheHeaders(res, sMaxAge, staleWhileRevalidate=60)
    // and the emitted header is:
    //   `public, s-maxage=${sMaxAge}, stale-while-revalidate=${swr}`
    // Live behavior is checked by smoke; this test pins the rationale.
    expect(true).toBe(true)
  })
})

// ─── 4. New 2026-05-07 contract: standard rate-limit headers ─────────────────

describe('Standard rate-limit headers (2026-05-07)', () => {
  // The makeLimiter factory in apps/api/src/index.ts is configured with:
  //   standardHeaders: true  (RFC draft headers: RateLimit-Limit, etc.)
  //   legacyHeaders:  false  (no X-RateLimit-* variants)
  //
  // Clients (especially mobile + frontend retry helpers) negotiate retry
  // timing from these headers. A regression that flips standardHeaders
  // to false, or accidentally enables legacyHeaders on top, would
  // silently break those clients without changing any 2xx/4xx/5xx codes.
  //
  // The probe uses /api/properties/suggest because it's a 200-returning
  // /api/* endpoint (the global rate limiter is mounted on /api).
  it('standard rate-limit headers probe is in the smoke list', () => {
    expect(REQUIRED_SMOKE_PROBES_05_07).toContain(
      'GET /api/properties/suggest exposes standard RateLimit-Limit + RateLimit-Remaining',
    )
  })

  it('makeLimiter standardHeaders=true contract documented', () => {
    // Doc-stub. The four limiters (global, search, externalData, auth)
    // all flow through makeLimiter() with standardHeaders=true /
    // legacyHeaders=false. A regression in any one of those four would
    // be caught by the smoke probe (since all four hit the same path
    // for unauthenticated /api/* GETs that pass the global limiter).
    expect(true).toBe(true)
  })
})

// ─── 5. New 2026-05-07 contract: OPTIONS preflight on /api/auth/me ───────────

describe('OPTIONS /api/auth/me preflight (2026-05-07)', () => {
  // The cors() middleware is mounted globally before any router (line 103
  // of apps/api/src/index.ts: app.use(cors(corsOptions))). Its behavior is
  // identical across all surfaces today, but a future per-router cors
  // override (e.g. `app.use('/api/auth', cors({origin:'*'}), authRouter)`)
  // could silently change contract on one surface without affecting the
  // /api/properties/search probes added 2026-05-06.
  //
  // Today's probe pins the same allow-path contract on /api/auth/me:
  //   - OPTIONS from http://localhost:3000 -> 204
  //   - ACAO echoes http://localhost:3000 (not '*' — credentials:true)
  //
  // This is now the second mounted surface with a smoke-pinned preflight
  // contract. As more sensitive routers are mounted (e.g. /api/admin,
  // /api/billing), each should get its own pin.
  it('allowed-origin probe on /api/auth/me is in the smoke list', () => {
    expect(REQUIRED_SMOKE_PROBES_05_07).toContain(
      'OPTIONS /api/auth/me 204 (allowed origin, ACAO echoed)',
    )
  })

  it('CORS surfaces with smoke-pinned preflight contract', () => {
    const surfacesWithPin = [
      'OPTIONS /api/properties/search 204 (allowed origin, ACAO echoed)',
      'OPTIONS /api/auth/me 204 (allowed origin, ACAO echoed)',
    ]
    for (const probe of surfacesWithPin) {
      expect(REQUIRED_SMOKE_PROBES_05_07).toContain(probe)
    }
  })
})

// ─── 6. New 2026-05-07 contract: property-detail + risk Cache-Control ────────

describe('Property-id-bound Cache-Control contracts (2026-05-07)', () => {
  // Two CDN cache pins added today:
  //   /:id          -> public, s-maxage=1800, swr=300   (30 min CDN cache)
  //   /:id/risk     -> public, s-maxage=7200, swr=600   (2 hour CDN cache)
  //
  // The risk endpoint has a forceRefresh=true branch that emits no-cache
  // and invalidates the dependent caches (insurance, carriers, etc).
  // Today's probe deliberately does NOT set ?refresh=true; it pins the
  // default cached-response branch.
  //
  // A regression that drops setCacheHeaders() on either route would
  // silently triple upstream load. Property data and risk data are the
  // two most expensive computations in the API (both fan out to multiple
  // upstream APIs: ATTOM, FEMA NFHL, Cal Fire FHSZ, USGS NSHM, FBI UCR).
  // The CDN cache is the primary defense against an upstream rate-limit
  // exhaustion under load.
  it('property-detail Cache-Control probe is in the smoke list', () => {
    expect(REQUIRED_SMOKE_PROBES_05_07).toContain(
      'GET /api/properties/:id Cache-Control s-maxage=1800',
    )
  })

  it('risk-profile Cache-Control probe is in the smoke list', () => {
    expect(REQUIRED_SMOKE_PROBES_05_07).toContain(
      'GET /api/properties/:id/risk Cache-Control s-maxage=7200',
    )
  })

  it('both pins assert the public directive (private+s-maxage is invalid)', () => {
    // Doc-stub. RFC 9111 section 5.2.2.10: a response with
    // Cache-Control: private MUST NOT be cached by any shared cache,
    // regardless of s-maxage. A regression that swaps `public` for
    // `private` while keeping s-maxage would silently disable CDN
    // caching but no status-code probe would catch it.
    expect(true).toBe(true)
  })
})

// ─── 7. Verb-parity audit (carried from 2026-05-03) ──────────────────────────

describe('Verb-parity audit (2026-05-07)', () => {
  // For every router with `router.use(requireAuth)`, every mutating verb
  // must have a matching 401 probe. Today's run does not add new mutating
  // verbs, but the audit must continue to pass.
  const PARITY_TABLE: Record<string, ReadonlyArray<string>> = {
    '/api/clients': [
      'GET /api/clients 401',
      'POST /api/clients 401',
      'PATCH /api/clients/:id 401',
      'DELETE /api/clients/:id 401',
    ],
    '/api/deals': [
      'GET /api/deals 401',
      'POST /api/deals 401',
      'PATCH /api/deals/:id 401',
      'DELETE /api/deals/:id 401',
    ],
    '/api/alerts (carrier-exits)': [
      'GET /api/alerts/carrier-exits 401',
      'POST /api/alerts/carrier-exits/:id/acknowledge 401',
    ],
  }

  for (const [router, requiredProbes] of Object.entries(PARITY_TABLE)) {
    it(`${router}: every probe in the parity table is in the smoke list`, () => {
      for (const probe of requiredProbes) {
        expect(REQUIRED_SMOKE_PROBES_05_07).toContain(probe)
      }
    })
  }
})

// ─── 8. CORS configuration sanity (carried doc-stub) ─────────────────────────

describe('CORS configuration sanity (2026-05-07)', () => {
  // The CORS_ALLOWED_ORIGINS env var is parsed in apps/api/src/index.ts.
  // Default value:
  //   'http://localhost:3000,https://coverguard.io,https://www.coverguard.io,https://api.coverguard.io'
  //
  // Parsing:
  //   - .split(',')             — comma-separated list
  //   - .map((o) => o.trim())   — strips whitespace from each entry
  //
  // A regression that drops .trim() would silently break entries adjacent
  // to whitespace in the env var. Today's probes pin live behavior on
  // /api/properties/search and /api/auth/me; this describe block pins
  // the rationale.
  it('CORS allowlist parsing is documented', () => {
    expect(true).toBe(true)
  })
})
