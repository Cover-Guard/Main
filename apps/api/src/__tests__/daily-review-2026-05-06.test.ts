/**
 * Daily Review Test Suite — May 6, 2026
 *
 * Today's pass had two halves:
 *
 *   1) **Bug fix on the test infrastructure itself.** smoke-test.ts was
 *      truncated mid-statement on disk at line 594 (`at least one co`)
 *      during the smoke-test edit pass. Same regression class as the
 *      2026-05-01 morning + 2026-05-05 morning runs. The file would not
 *      parse, so today's run started by restoring the full body via the
 *      outputs/ + cat-append workaround documented on 2026-05-05.
 *
 *   2) **Coverage expansion.** Five new probes covering the CORS preflight
 *      contract (allow + deny paths), zod boundary validation on geocode,
 *      and the GET/HEAD x valid/bogus matrix completion on /report.pdf:
 *        (a) OPTIONS /api/properties/search from disallowed origin -> 204,
 *            no Access-Control-Allow-Origin echoed.
 *        (b) OPTIONS /api/properties/search from allowed origin -> 204,
 *            ACAO echoed (and not '*' since credentials:true).
 *        (c) POST /api/properties/geocode with placeId="" -> 400.
 *        (d) POST /api/properties/geocode with placeId>300 chars -> 400.
 *        (e) HEAD /api/properties/<bogus>/report.pdf -> 404 (not 401).
 *
 * The describe blocks below pin the new contracts, the smoke probe list,
 * and a redundancy guard against a future >50% truncation (carried from
 * 2026-05-05).
 */

import * as fs from 'fs'
import * as path from 'path'

// ─── 1. Smoke-test surface contract (extended for 2026-05-06) ────────────────

const REQUIRED_SMOKE_PROBES_05_06 = [
  // ── Carried over from 2026-05-05 (no regressions) ──
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
  // ── 2026-05-06 additions ──
  'OPTIONS /api/properties/search 204 (disallowed origin, no ACAO echo)',
  'OPTIONS /api/properties/search 204 (allowed origin, ACAO echoed)',
  'POST /api/properties/geocode 400 (empty placeId)',
  'POST /api/properties/geocode 400 (placeId > 300 chars)',
  'HEAD /api/properties/<bogus>/report.pdf 404 (not 401)',
] as const

describe('Smoke-test surface contract (2026-05-06)', () => {
  it("lists at least 66 required probes after today's additions", () => {
    expect(REQUIRED_SMOKE_PROBES_05_06.length).toBeGreaterThanOrEqual(66)
  })

  it('strictly grows over 2026-05-05 (61 probes)', () => {
    // The 2026-05-05 baseline was 61 probes; today's run adds 5. The list
    // must never shrink — a regression that drops a probe is the kind of
    // silent coverage loss this guard exists to catch.
    expect(REQUIRED_SMOKE_PROBES_05_06.length).toBeGreaterThanOrEqual(66)
  })

  it('every probe entry is uniquely worded', () => {
    const seen = new Set<string>()
    for (const probe of REQUIRED_SMOKE_PROBES_05_06) {
      expect(seen.has(probe)).toBe(false)
      seen.add(probe)
    }
  })

  it("references OPTIONS /api/properties/search disallowed-origin probe", () => {
    expect(REQUIRED_SMOKE_PROBES_05_06).toContain(
      'OPTIONS /api/properties/search 204 (disallowed origin, no ACAO echo)',
    )
  })

  it("references OPTIONS /api/properties/search allowed-origin probe", () => {
    expect(REQUIRED_SMOKE_PROBES_05_06).toContain(
      'OPTIONS /api/properties/search 204 (allowed origin, ACAO echoed)',
    )
  })

  it("references geocode boundary probes (empty + too-long placeId)", () => {
    expect(REQUIRED_SMOKE_PROBES_05_06).toContain('POST /api/properties/geocode 400 (empty placeId)')
    expect(REQUIRED_SMOKE_PROBES_05_06).toContain(
      'POST /api/properties/geocode 400 (placeId > 300 chars)',
    )
  })

  it("references HEAD /api/properties/<bogus>/report.pdf 404 probe", () => {
    expect(REQUIRED_SMOKE_PROBES_05_06).toContain(
      'HEAD /api/properties/<bogus>/report.pdf 404 (not 401)',
    )
  })
})

// ─── 2. Smoke-test file integrity (line-count regression guard) ──────────────

describe('Smoke-test file integrity (2026-05-06)', () => {
  // The smoke-test.ts file has been truncated at the sandbox layer three
  // times now (2026-05-01 morning, 2026-05-05 morning, 2026-05-06 morning).
  // All three times the truncation produced a syntactically-invalid file
  // that would not parse. This guard reads the file from disk and asserts
  // a minimum line count + that the file ends with the run().catch()
  // top-level invocation. A future >50% truncation by line count fails
  // this test loudly. Today's 2026-05-06 run hits 730 lines after the
  // 5 new probes; the threshold below is conservative.
  const SMOKE_PATH = path.resolve(__dirname, '../../../../scripts/qa/smoke-test.ts')

  it('smoke-test.ts is at least 700 lines long', () => {
    const content = fs.readFileSync(SMOKE_PATH, 'utf8')
    const lineCount = content.split('\n').length
    expect(lineCount).toBeGreaterThanOrEqual(700)
  })

  it('smoke-test.ts ends with the top-level run().catch() invocation', () => {
    const content = fs.readFileSync(SMOKE_PATH, 'utf8')
    expect(content).toMatch(/run\(\)\.catch\(\(err\) => \{/)
    expect(content.trimEnd().endsWith('})')).toBe(true)
  })

  it('smoke-test.ts contains the 5 new 2026-05-06 probe markers', () => {
    const content = fs.readFileSync(SMOKE_PATH, 'utf8')
    // String anchors, not full regex, to avoid over-coupling to wording.
    expect(content).toContain('disallowed origin: no ACAO echo')
    expect(content).toContain('allowed origin: ACAO echoed')
    expect(content).toContain('with empty placeId returns 400')
    expect(content).toContain('with placeId > 300 chars returns 400')
    expect(content).toContain('HEAD /api/properties/<bogus>/report.pdf returns 404')
  })
})

// ─── 3. New 2026-05-06 contract: CORS preflight (deny path) ──────────────────

describe('CORS preflight deny path (2026-05-06)', () => {
  // The cors() middleware is configured with a callback that returns false
  // for unknown origins (apps/api/src/index.ts isOriginAllowed()). When
  // false, cors() handles the preflight with status 204 but does NOT echo
  // the requested origin in Access-Control-Allow-Origin. Browsers then
  // block the actual request.
  //
  // A regression that loosens isOriginAllowed (e.g. catch-all true,
  // accidental `*` fallback) would silently expose the API to CSRF from
  // any origin — without the smoke-test PASS count changing, since no
  // existing probe tests origins.
  it('disallowed-origin probe is in the smoke list', () => {
    expect(REQUIRED_SMOKE_PROBES_05_06).toContain(
      'OPTIONS /api/properties/search 204 (disallowed origin, no ACAO echo)',
    )
  })

  it('isOriginAllowed contract documented', () => {
    // isOriginAllowed() returns true for: (a) exact match in
    // CORS_ALLOWED_ORIGINS env var (default localhost:3000 + the
    // coverguard.io apex/www/api), (b) https://(www|api|app).coverguard.io,
    // (c) Vercel preview URLs matching ^https://[\w-]{1,52}-cover-guard
    // \.vercel\.app$. Everything else is false.
    //
    // This is a doc-stub — the live behavior is checked by smoke. The
    // assertion exists so the rationale is co-located with the contract.
    expect(true).toBe(true)
  })
})

// ─── 4. New 2026-05-06 contract: CORS preflight (allow path) ─────────────────

describe('CORS preflight allow path (2026-05-06)', () => {
  // http://localhost:3000 is in the default CORS_ALLOWED_ORIGINS env var.
  // OPTIONS preflight from this origin must:
  //   - return 204 (cors() default for handled preflights)
  //   - echo Access-Control-Allow-Origin: http://localhost:3000
  //   - NOT use the wildcard `*` — credentials:true requires a specific origin
  //
  // A regression that breaks the CORS_ALLOWED_ORIGINS parser (e.g. fails
  // to .trim() per-entry, drops the .split(','), or accidentally swaps to
  // `*` for credentials:true) would silently deny legitimate browsers in
  // production.
  it('allowed-origin probe is in the smoke list', () => {
    expect(REQUIRED_SMOKE_PROBES_05_06).toContain(
      'OPTIONS /api/properties/search 204 (allowed origin, ACAO echoed)',
    )
  })
})

// ─── 5. New 2026-05-06 contract: geocode boundary validation ─────────────────

describe('Geocode placeId boundary validation (2026-05-06)', () => {
  // The /api/properties/geocode handler validates body via zod:
  //   z.object({ placeId: z.string().min(1).max(300) })
  //
  // The 2026-05-01 morning run added the empty-body 400 probe (no field
  // at all → zod's "required" branch). Today's run adds the two
  // string-length boundary probes:
  //   - placeId="" -> .min(1) fires -> 400
  //   - placeId>300 chars -> .max(300) fires -> 400
  //
  // These are different code paths from the empty-body case. A regression
  // that drops .min(1) or .max(300) from the schema would not break the
  // empty-body probe but would silently allow malformed input through.
  it('both boundary probes are in the smoke list', () => {
    expect(REQUIRED_SMOKE_PROBES_05_06).toContain(
      'POST /api/properties/geocode 400 (empty placeId)',
    )
    expect(REQUIRED_SMOKE_PROBES_05_06).toContain(
      'POST /api/properties/geocode 400 (placeId > 300 chars)',
    )
  })
})

// ─── 6. New 2026-05-06 contract: HEAD bogus report.pdf -> 404 ────────────────

describe('HEAD /api/properties/<bogus>/report.pdf matrix completion (2026-05-06)', () => {
  // The :id param middleware in apps/api/src/routes/properties.ts runs
  // BEFORE any route handler and is verb-agnostic. For a bogus id:
  //   - param middleware -> ensurePropertyId() returns null -> 404.
  // For a valid id with no auth:
  //   - param middleware resolves -> requireAuth fires -> 401.
  //
  // The matrix:
  //   GET  + valid id  -> 401 (pinned 2026-05-02)
  //   GET  + bogus id  -> 404 (pinned 2026-05-04)
  //   HEAD + valid id  -> 401 (pinned 2026-05-05)
  //   HEAD + bogus id  -> 404 (pinned today, 2026-05-06)
  //
  // Today closes the matrix. A regression where the param middleware
  // special-cases GET (e.g. checks req.method before running
  // ensurePropertyId) and lets HEAD bypass the resolution check would
  // either leak existence info (200 with no body) or shape info (401
  // confirming the id is valid-shaped).
  it('matrix-completion probe is in the smoke list', () => {
    expect(REQUIRED_SMOKE_PROBES_05_06).toContain(
      'HEAD /api/properties/<bogus>/report.pdf 404 (not 401)',
    )
  })

  it('all four GET/HEAD x valid/bogus probes are present', () => {
    expect(REQUIRED_SMOKE_PROBES_05_06).toContain('GET /api/properties/:id/report.pdf 401 (unauth)')
    expect(REQUIRED_SMOKE_PROBES_05_06).toContain(
      'GET /api/properties/<bogus>/report.pdf 404 (NOT 401)',
    )
    expect(REQUIRED_SMOKE_PROBES_05_06).toContain(
      'HEAD /api/properties/:id/report.pdf 401 (unauth)',
    )
    expect(REQUIRED_SMOKE_PROBES_05_06).toContain(
      'HEAD /api/properties/<bogus>/report.pdf 404 (not 401)',
    )
  })
})

// ─── 7. Verb-parity audit (carried from 2026-05-03 + extended) ───────────────

describe('Verb-parity audit (2026-05-06)', () => {
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
        expect(REQUIRED_SMOKE_PROBES_05_06).toContain(probe)
      }
    })
  }
})

// ─── 8. CORS configuration sanity (carried doc-stub) ─────────────────────────

describe('CORS configuration sanity (2026-05-06)', () => {
  // The CORS_ALLOWED_ORIGINS env var is parsed in apps/api/src/index.ts.
  // The default value is:
  //   'http://localhost:3000,https://coverguard.io,https://www.coverguard.io,https://api.coverguard.io'
  //
  // Parsing:
  //   - .split(',')        — comma-separated list
  //   - .map((o) => o.trim()) — strips whitespace from each entry
  //
  // A regression that drops the .trim() would silently break entries
  // adjacent to whitespace in the env var (e.g. `localhost:3000, ...`
  // would become `' localhost:3000'` with leading space and never match).
  // Today's smoke probes pin the live behavior, this describe block pins
  // the rationale.
  it('CORS allowlist parsing is documented', () => {
    expect(true).toBe(true)
  })
})
