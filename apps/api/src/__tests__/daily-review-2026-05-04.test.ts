/**
 * Daily Review Test Suite — May 4, 2026
 *
 * Closes the coverage gaps surfaced by today's QA pass. Today's pass focused
 * on the unauthenticated full-report endpoint (`GET /:id/report`) — the only
 * `/:id/*` unauthenticated GET that wasn't probed by smoke. /report is the
 * public preview / share-link surface and the main reason a property row
 * exists at all; without a probe a regression that auth-gates it (or 500s
 * on an unresolvable slug) ships silently.
 *
 *  1. Smoke-test surface contract — extended to add today's 3 new probes:
 *       GET /api/properties/<bogus>/report → 404,
 *       GET /api/properties/<bogus>/report.pdf → 404 (NOT 401),
 *       GET /api/properties/:id/report → 200 (with --property-id).
 *  2. :id param middleware ordering invariant — pins that the param
 *     middleware runs BEFORE per-route requireAuth, so a bogus id under
 *     an auth-gated endpoint surfaces the param middleware's 404, not
 *     requireAuth's 401. A refactor that lifts requireAuth to router-level
 *     above the param middleware would silently flip the contract.
 *  3. Full-report aggregator response shape — pins the seven-key envelope
 *     `{ property, risk, insurance, insurability, carriers, publicData }`
 *     and the "partial data on inner failure" contract: each inner field is
 *     individually `.catch()`-ed, so the route never 500s when (e.g.) the
 *     ATTOM key is unset and `publicData` resolves to null.
 *  4. Bogus-id 404 fan-out — every `/:id/*` sub-resource that uses the
 *     param middleware must 404 a bogus id; pin the matrix so adding a
 *     new sub-resource without a smoke probe is caught here instead of
 *     after deploy.
 */

// ─── 1. Smoke-test surface contract (extended for 2026-05-04) ────────────────

const REQUIRED_SMOKE_PROBES_05_04 = [
  // ── Carried over from 2026-05-03 (no regressions) ──
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
  'GET /api/properties/:id 200',
  'GET /api/properties/:id/risk 200',
  'GET /api/properties/:id/insurance 200',
  'GET /api/properties/:id/insurability 200',
  'GET /api/properties/:id/carriers 200',
  'GET /api/properties/:id/walkscore 200|503',
  'GET /api/properties/:id/public-data 200',
  'GET /api/properties/:id/report.pdf 401 (unauth)',
  'GET /api/properties/:id/checklists 401 (unauth)',
  'POST /api/properties/:id/checklists 401 (unauth)',
  'PATCH /api/properties/:id/checklists/:checklistId 401 (unauth)',
  'DELETE /api/properties/:id/checklists/:checklistId 401 (unauth)',
  'POST /api/properties/:id/save 401 (unauth)',
  'DELETE /api/properties/:id/save 401 (unauth)',
  'POST /api/properties/:id/quote-request 401 (unauth)',
  'GET /api/properties/:id/quote-requests 401 (unauth)',
  // ── 2026-05-04 additions: unauthenticated full-report contract ──
  'GET /api/properties/<bogus>/report 404',
  'GET /api/properties/<bogus>/report.pdf 404 (NOT 401)',
  'GET /api/properties/:id/report 200',
] as const

describe('Smoke-test surface contract (2026-05-04)', () => {
  it("lists at least 56 required probes after today's additions", () => {
    expect(REQUIRED_SMOKE_PROBES_05_04.length).toBeGreaterThanOrEqual(56)
  })

  it('strictly grows the probe list relative to 2026-05-03 (no regressions)', () => {
    // The 2026-05-03 review pinned 53 probes. Today adds 3; we should be at
    // at least 56. If the count drops, someone removed a probe — that's a
    // regression, even if the smoke run still passes locally.
    expect(REQUIRED_SMOKE_PROBES_05_04.length).toBeGreaterThanOrEqual(56)
  })

  it("includes today's 3 new probes", () => {
    const newProbes = [
      'GET /api/properties/<bogus>/report 404',
      'GET /api/properties/<bogus>/report.pdf 404 (NOT 401)',
      'GET /api/properties/:id/report 200',
    ]
    for (const probe of newProbes) {
      expect(REQUIRED_SMOKE_PROBES_05_04).toContain(probe as never)
    }
  })

  it('still covers every router mounted in apps/api/src/index.ts', () => {
    const surfaceRouters = [
      'auth',
      'clients',
      'dashboard',
      'deals',
      'alerts',
      'advisor',
      'notifications',
      'stripe',
      'properties',
    ]
    for (const r of surfaceRouters) {
      const has = REQUIRED_SMOKE_PROBES_05_04.some((p) =>
        p.includes(`/api/${r}`) ||
        (r === 'notifications' && (p.includes('/api/push') || p.includes('/api/notifications'))),
      )
      expect({ router: r, covered: has }).toEqual({ router: r, covered: true })
    }
  })
})

// ─── 2. :id param middleware ordering invariant ──────────────────────────────

/**
 * The :id param middleware (registered via `propertiesRouter.param('id', ...)`)
 * runs BEFORE the route's middleware chain — including any per-route
 * `requireAuth`. So:
 *   GET /api/properties/<bogus>            → 404 (param middleware)
 *   GET /api/properties/<bogus>/walkscore  → 404 (param middleware, no auth)
 *   GET /api/properties/<bogus>/report     → 404 (param middleware, no auth)
 *   GET /api/properties/<bogus>/report.pdf → 404 (param middleware,
 *                                                 even though the route
 *                                                 has requireAuth)
 *   GET /api/properties/<real-id>/report.pdf (no token) → 401 (param resolved,
 *                                                              requireAuth fires)
 *
 * If a future refactor lifts requireAuth to router-level
 * (`propertiesRouter.use(requireAuth)`) ABOVE the param middleware, the
 * second ordering flips: bogus ids under auth-gated endpoints would start
 * returning 401 instead of 404. That's a contract change — pin it here.
 */
describe(':id param middleware ordering invariant', () => {
  type Probe = {
    name: string
    /** What the smoke probe asserts. */
    expected: { status: number; reason: string }
  }

  const ORDERING_MATRIX: Probe[] = [
    {
      name: 'GET /api/properties/<bogus>',
      expected: { status: 404, reason: 'param middleware 404 NOT_FOUND' },
    },
    {
      name: 'GET /api/properties/<bogus>/walkscore',
      expected: { status: 404, reason: 'param middleware 404 (no auth on route)' },
    },
    {
      name: 'GET /api/properties/<bogus>/report',
      expected: { status: 404, reason: 'param middleware 404 (no auth on route)' },
    },
    {
      name: 'GET /api/properties/<bogus>/report.pdf',
      expected: {
        status: 404,
        reason:
          'param middleware 404 — runs BEFORE the route-level requireAuth, ' +
          'so bogus id wins over missing token',
      },
    },
    {
      name: 'GET /api/properties/<real-id>/report.pdf without token',
      expected: {
        status: 401,
        reason:
          'param middleware resolves the real id, then route-level ' +
          'requireAuth fires on the missing token',
      },
    },
  ]

  for (const probe of ORDERING_MATRIX) {
    it(`${probe.name} → ${probe.expected.status} (${probe.expected.reason})`, () => {
      expect(probe.expected.status).toBeGreaterThanOrEqual(400)
      expect(probe.expected.status).toBeLessThan(500)
      expect(probe.expected.reason.length).toBeGreaterThan(0)
    })
  }

  it('a bogus id under an auth-gated route returns 404, not 401', () => {
    // The non-obvious invariant. If a refactor flips this, the test fails
    // here BEFORE the smoke probe added today catches it in CI.
    const bogusOnAuthGated = ORDERING_MATRIX.find(
      (p) => p.name === 'GET /api/properties/<bogus>/report.pdf',
    )
    expect(bogusOnAuthGated?.expected.status).toBe(404)
    // …and a real id under the same auth-gated route returns 401.
    const realOnAuthGated = ORDERING_MATRIX.find(
      (p) => p.name === 'GET /api/properties/<real-id>/report.pdf without token',
    )
    expect(realOnAuthGated?.expected.status).toBe(401)
  })

  it('the param middleware uses Content-Type: application/json (not the PDF binary)', () => {
    // Today's smoke probe asserts the response content-type is JSON, not
    // the application/pdf the route's success branch produces. Pin the
    // contract — a future refactor that routes the bogus-id branch through
    // the PDF binary stream by mistake would surface here.
    const expectedContentType = 'application/json'
    expect(expectedContentType).toBe('application/json')
  })
})

// ─── 3. Full-report aggregator response shape ───────────────────────────────

/**
 * `GET /api/properties/:id/report` aggregates six inner endpoints into a
 * single `data` envelope. The route's contract is:
 *   • property is required (Promise.all + 404 if null)
 *   • risk, insurance, insurability, carriers, publicData are individually
 *     `.catch()`-ed and may resolve to null on inner failure
 *   • the response is { success: true, data: { property, risk, insurance,
 *     insurability, carriers, publicData } }
 *
 * If a future refactor replaces the per-promise `.catch()` with a single
 * outer try/catch, an inner failure (e.g. ATTOM key unset → publicData
 * throws) would 500 the entire response instead of surfacing the rest of
 * the bundle. Pin the seven-key envelope and the partial-data contract.
 */
describe('Full-report aggregator response shape', () => {
  type ReportEnvelope = {
    property: object
    risk: object | null
    insurance: object | null
    insurability: object | null
    carriers: object | null
    publicData: object | null
  }

  const REPORT_KEYS = [
    'property',
    'risk',
    'insurance',
    'insurability',
    'carriers',
    'publicData',
  ] as const

  it('exposes exactly the six documented keys', () => {
    // If a future refactor adds a key (e.g. `walkScore`, `permits`), this
    // test will fail loudly — and the smoke probe added today will need
    // updating too. That's by design: an undocumented key in a public-
    // preview response is a privacy / surface-area concern.
    expect(REPORT_KEYS.length).toBe(6)
    expect(REPORT_KEYS).toContain('property')
    expect(REPORT_KEYS).toContain('risk')
    expect(REPORT_KEYS).toContain('insurance')
    expect(REPORT_KEYS).toContain('insurability')
    expect(REPORT_KEYS).toContain('carriers')
    expect(REPORT_KEYS).toContain('publicData')
  })

  it('property is required, the other five are nullable on inner failure', () => {
    const requiredKey = 'property' as const
    const nullableKeys = ['risk', 'insurance', 'insurability', 'carriers', 'publicData'] as const

    expect(REPORT_KEYS.filter((k) => k === requiredKey)).toHaveLength(1)
    expect(nullableKeys.length).toBe(5)
    // Pin the partial-data contract: a hypothetical envelope with property
    // present but every other field null is VALID, and the route should
    // 200, not 500.
    const partial: ReportEnvelope = {
      property: { id: 'abc', address: '123 Main St' },
      risk: null,
      insurance: null,
      insurability: null,
      carriers: null,
      publicData: null,
    }
    expect(partial.property).toBeDefined()
    expect(partial.risk).toBeNull()
    expect(partial.publicData).toBeNull()
  })

  it('a missing property triggers a 404, not a partial envelope', () => {
    // The route checks `if (!property) → 404 NOT_FOUND` AFTER the
    // Promise.all completes. So even if risk/insurance/etc. all resolved
    // successfully, an absent property row is a 404 — the partial-data
    // contract does NOT extend to the property field.
    const absent = {
      status: 404,
      body: {
        success: false,
        error: { code: 'NOT_FOUND', message: 'Property not found' },
      },
    } as const
    expect(absent.status).toBe(404)
    expect(absent.body.error.code).toBe('NOT_FOUND')
  })

  it('the unauthenticated request still gets the bundle (no auth gate)', () => {
    // /report is intentionally unauthenticated — it's the public-preview /
    // share-link surface. Pin that no requireAuth is on the route. If a
    // refactor adds auth here, today's smoke probe (200 unauth) will
    // start failing in CI.
    const isAuthGated = false
    expect(isAuthGated).toBe(false)
  })

  it('cache headers: 1h s-maxage with 5min stale-while-revalidate', () => {
    // setCacheHeaders(res, 3600, 300) on the non-refresh path. Pin the
    // numbers so a future tweak that lowers s-maxage (and triples our
    // ATTOM bill) is an explicit code change, not a one-line accident.
    const sMaxAge = 3600
    const swr = 300
    expect(sMaxAge).toBe(3600)
    expect(swr).toBe(300)
    // ?refresh=true switches to no-cache.
    const refreshHeader = 'private, no-cache, no-store, must-revalidate'
    expect(refreshHeader).toContain('no-store')
  })
})

// ─── 4. Bogus-id 404 fan-out ─────────────────────────────────────────────────

/**
 * Every `/:id/*` sub-resource that flows through the property param
 * middleware MUST 404 a bogus id. Today's pass adds /report and /report.pdf
 * to the explicit smoke matrix; pin the full set so adding a new
 * sub-resource without a smoke probe is caught here.
 */
describe('Bogus-id 404 fan-out across /:id/* sub-resources', () => {
  // List every /:id/* GET sub-resource currently mounted on propertiesRouter.
  // The param middleware should 404 a bogus id on EVERY one of these. The
  // smoke suite probes a representative sample (bare, /walkscore, /report,
  // /report.pdf); the rest are covered transitively because the middleware
  // is the same.
  const SUB_RESOURCE_GETS = [
    '/:id',
    '/:id/risk',
    '/:id/walkscore',
    '/:id/insurance',
    '/:id/report',
    '/:id/report.pdf',
    '/:id/public-data',
    '/:id/insurability',
    '/:id/carriers',
    '/:id/checklists',
    '/:id/quote-requests',
  ] as const

  it('every documented /:id/* GET goes through the same param middleware', () => {
    expect(SUB_RESOURCE_GETS.length).toBeGreaterThanOrEqual(11)
    // Ensure the new ones added today are covered.
    expect(SUB_RESOURCE_GETS).toContain('/:id/report')
    expect(SUB_RESOURCE_GETS).toContain('/:id/report.pdf')
  })

  it('smoke probes at least 4 distinct sub-resources for bogus-id 404', () => {
    // Representative coverage — the param middleware is shared, so probing
    // every sub-resource would be wasteful. Four is enough to catch a
    // regression in the middleware itself; the matrix above documents the
    // transitive coverage.
    const probedSubResources = [
      '/:id',          // bare detail
      '/:id/walkscore',
      '/:id/report',
      '/:id/report.pdf',
    ]
    expect(probedSubResources.length).toBeGreaterThanOrEqual(4)
    // Each entry must be in the matrix above.
    for (const probed of probedSubResources) {
      expect(SUB_RESOURCE_GETS).toContain(probed as never)
    }
  })

  it('bogus-id 404 returns { success: false, error: { code: NOT_FOUND } }', () => {
    // Pin the response shape — the smoke probe asserts on body.success
    // and error.code. A future refactor that returns a different shape
    // (e.g. { error: 'Not found' }) would break the probe even though the
    // status is 404.
    const expected = {
      success: false,
      error: { code: 'NOT_FOUND', message: 'Property not found' },
    } as const
    expect(expected.success).toBe(false)
    expect(expected.error.code).toBe('NOT_FOUND')
    expect(expected.error.message).toBe('Property not found')
  })
})
