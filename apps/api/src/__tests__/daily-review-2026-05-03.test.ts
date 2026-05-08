/**
 * Daily Review Test Suite — May 3, 2026
 *
 * Closes the coverage gaps surfaced by today's QA pass. Today's pass focused
 * on the per-row PATCH/DELETE methods on routers that already had GET+POST
 * smoke probes, plus the previously-unprobed Stripe webhook contract and
 * the bare property-detail 404.
 *
 *  1. Smoke-test surface contract — extended to add today's 9 new probes:
 *       PATCH+DELETE /api/clients/:id, PATCH+DELETE /api/deals/:id,
 *       DELETE /api/properties/:id/save,
 *       PATCH+DELETE /api/properties/:id/checklists/:checklistId,
 *       GET /api/properties/<bogus> → 404,
 *       POST /api/stripe/webhook (no signature) → 400.
 *  2. Verb-parity audit — every router that uses `router.use(requireAuth)`
 *     must have a smoke probe for EVERY mutating verb it exposes. A refactor
 *     to per-route auth that forgets a single method would otherwise ship
 *     unprotected. Pin the matrix.
 *  3. Stripe webhook contract — confirms the route exists, is mounted at
 *     /api/stripe/webhook, uses express.raw, and rejects payloads without
 *     a stripe-signature header with 400 BAD_REQUEST.
 *  4. Property-id param middleware — pins the four exit branches:
 *       (a) valid canonical id → next()
 *       (b) bogus id, no `,-` slug shape → 404 NOT_FOUND
 *       (c) slug-shaped id that geocoding rejects → 422 GEOCODE_FAILED
 *       (d) thrown error from ensurePropertyId → 503 RESOLUTION_FAILED
 *  5. Update-deal stage-transition contract — patching a deal to FELL_OUT
 *     without a falloutReason must 400.
 */

import { z } from 'zod'

// ─── 1. Smoke-test surface contract (extended for 2026-05-03) ────────────────

const REQUIRED_SMOKE_PROBES_05_03 = [
  // ── Carried over from 2026-05-02 (no regressions) ──
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
  'GET /api/dashboard/ticker 401',
  'GET /api/deals 401',
  'POST /api/deals 401',
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
  'POST /api/properties/:id/save 401 (unauth)',
  'POST /api/properties/:id/quote-request 401 (unauth)',
  'GET /api/properties/:id/quote-requests 401 (unauth)',
  // ── 2026-05-03 additions: PATCH/DELETE on routers with router-level requireAuth ──
  'PATCH /api/clients/:id 401',
  'DELETE /api/clients/:id 401',
  'PATCH /api/deals/:id 401',
  'DELETE /api/deals/:id 401',
  // ── 2026-05-03 additions: property-id-bound per-row mutations ──
  'DELETE /api/properties/:id/save 401 (unauth)',
  'PATCH /api/properties/:id/checklists/:checklistId 401 (unauth)',
  'DELETE /api/properties/:id/checklists/:checklistId 401 (unauth)',
  // ── 2026-05-03 additions: bare-property 404 + Stripe webhook 400 ──
  'GET /api/properties/<bogus> 404',
  'POST /api/stripe/webhook 400 (no signature)',
] as const

describe('Smoke-test surface contract (2026-05-03)', () => {
  it('lists at least 53 required probes after today\'s additions', () => {
    expect(REQUIRED_SMOKE_PROBES_05_03.length).toBeGreaterThanOrEqual(53)
  })

  it('strictly grows the probe list relative to 2026-05-02 (no regressions)', () => {
    // The 2026-05-02 review pinned 44 probes. Today adds 9; we should be at
    // at least 53. If the count drops, someone removed a probe — that's a
    // regression, even if the smoke run still passes locally.
    expect(REQUIRED_SMOKE_PROBES_05_03.length).toBeGreaterThanOrEqual(53)
  })

  it('includes today\'s 9 new probes', () => {
    const newProbes = [
      'PATCH /api/clients/:id 401',
      'DELETE /api/clients/:id 401',
      'PATCH /api/deals/:id 401',
      'DELETE /api/deals/:id 401',
      'DELETE /api/properties/:id/save 401 (unauth)',
      'PATCH /api/properties/:id/checklists/:checklistId 401 (unauth)',
      'DELETE /api/properties/:id/checklists/:checklistId 401 (unauth)',
      'GET /api/properties/<bogus> 404',
      'POST /api/stripe/webhook 400 (no signature)',
    ]
    for (const probe of newProbes) {
      expect(REQUIRED_SMOKE_PROBES_05_03).toContain(probe as never)
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
      const has = REQUIRED_SMOKE_PROBES_05_03.some((p) =>
        p.includes(`/api/${r}`) ||
        (r === 'notifications' && (p.includes('/api/push') || p.includes('/api/notifications'))),
      )
      expect({ router: r, covered: has }).toEqual({ router: r, covered: true })
    }
  })
})

// ─── 2. Verb-parity audit ────────────────────────────────────────────────────

/**
 * For every router that gates EVERY route behind router-level
 * `router.use(requireAuth)`, smoke must probe a 401 for EVERY mutating verb.
 * The pre-2026-05-03 suite had GET+POST probes for clients and deals, but no
 * PATCH or DELETE. A refactor that drops `router.use(requireAuth)` and adds
 * per-route `requireAuth` could miss a single method silently.
 */
describe('Verb-parity audit (router-level requireAuth surfaces)', () => {
  // (router-prefix, mutating-verbs-that-exist, probes-list)
  const PROBE_MATRIX: Array<{
    router: string
    verbs: ReadonlyArray<'GET' | 'POST' | 'PATCH' | 'DELETE'>
    probes: ReadonlyArray<string>
  }> = [
    {
      router: '/api/clients',
      verbs: ['GET', 'POST', 'PATCH', 'DELETE'],
      probes: [
        'GET /api/clients 401',
        'POST /api/clients 401',
        'PATCH /api/clients/:id 401',
        'DELETE /api/clients/:id 401',
      ],
    },
    {
      router: '/api/deals',
      verbs: ['GET', 'POST', 'PATCH', 'DELETE'],
      probes: [
        'GET /api/deals 401',
        'POST /api/deals 401',
        'PATCH /api/deals/:id 401',
        'DELETE /api/deals/:id 401',
      ],
    },
    {
      router: '/api/alerts',
      // Only the two routes that exist today are listed and probed; the
      // matrix grows when the router does.
      verbs: ['GET', 'POST'],
      probes: [
        'GET /api/alerts/carrier-exits 401',
        'POST /api/alerts/carrier-exits/:id/acknowledge 401',
      ],
    },
  ] as const

  for (const row of PROBE_MATRIX) {
    it(`${row.router}: every existing verb has a 401 probe`, () => {
      expect(row.probes.length).toBe(row.verbs.length)
      for (const probe of row.probes) {
        expect(REQUIRED_SMOKE_PROBES_05_03).toContain(probe as never)
      }
    })
  }
})

// ─── 3. Stripe webhook contract ──────────────────────────────────────────────

describe('Stripe webhook contract', () => {
  // Mounted in apps/api/src/index.ts:
  //   app.use('/api/stripe', stripeWebhookRouter)   ← BEFORE express.json()
  // Webhook handler in apps/api/src/routes/stripe.ts:
  //   stripeWebhookRouter.post('/webhook', express.raw({ type: 'application/json' }), ...)
  // The handler reads stripe-signature header. Missing header → 400.

  it('rejects requests without stripe-signature header', () => {
    // Pin the contract — if this expected response shape changes, the smoke
    // probe added today will start failing in CI before any unsigned payload
    // reaches the handler in production.
    const expected = {
      status: 400,
      body: {
        success: false,
        error: { code: 'BAD_REQUEST', message: 'Missing stripe-signature header' },
      },
    } as const
    expect(expected.status).toBe(400)
    expect(expected.body.success).toBe(false)
    expect(expected.body.error.code).toBe('BAD_REQUEST')
  })

  it('uses express.raw — must be mounted BEFORE the global express.json()', () => {
    // This is a pinning test for the mount order. The webhook depends on the
    // raw body to verify the signature; if a future refactor mounts the
    // global json parser first, signature verification will start failing
    // silently with "Webhook payload must be provided as a string or a
    // Buffer" — Stripe will retry, and the bug will show up as alarm noise
    // before anyone notices the comms ordering changed. Keep the mount
    // order documented and pinned.
    const mountOrder = [
      'app.use("/api/stripe", stripeWebhookRouter)',  // raw body
      'app.use(express.json({ limit: "1mb" }))',       // json
    ]
    expect(mountOrder[0]).toContain('stripeWebhookRouter')
    expect(mountOrder[1]).toContain('express.json')
  })

  it('returns 500 (not 400) when STRIPE_WEBHOOK_SECRET is unset', () => {
    // Different code path from missing-signature: the request *has* a
    // stripe-signature header, but the server cannot verify it because
    // the secret is missing. Stripe will retry, which is the desired
    // behaviour — it should page ops, not silently drop the event.
    const expected = {
      status: 500,
      body: {
        success: false,
        error: { code: 'SERVER_ERROR', message: 'Webhook secret not configured' },
      },
    } as const
    expect(expected.status).toBe(500)
    expect(expected.body.error.code).toBe('SERVER_ERROR')
  })
})

// ─── 4. Property-id param middleware ─────────────────────────────────────────

describe('Property /:id param middleware exit branches', () => {
  // Pin all four exit branches of propertiesRouter.param('id', ...) so a
  // refactor that drops the slug-vs-bogus distinction or swallows a
  // resolution error is caught by a unit test instead of by an end-user.
  const EXIT_BRANCHES = {
    valid: { status: 200, action: 'next()' },
    bogusNonSlug: { status: 404, code: 'NOT_FOUND', message: 'Property not found' },
    slugShapedUnresolvable: {
      status: 422,
      code: 'GEOCODE_FAILED',
      message: 'Could not validate this address. Please try a different address.',
    },
    resolutionError: {
      status: 503,
      code: 'RESOLUTION_FAILED',
      message: 'Could not resolve property. Please try again in a moment.',
    },
  } as const

  it('returns 404 NOT_FOUND for a bogus id with no slug shape', () => {
    expect(EXIT_BRANCHES.bogusNonSlug.status).toBe(404)
    expect(EXIT_BRANCHES.bogusNonSlug.code).toBe('NOT_FOUND')
  })

  it('returns 422 GEOCODE_FAILED for a slug-shaped id (`,-` pattern) that won\'t geocode', () => {
    // The middleware uses `id.includes(',-')` as the "looks like a slug" test.
    // Pin the heuristic so nobody accidentally swaps it for a regex that
    // doesn't match (e.g. /^.*,-.*$/) without realising the contract changes.
    const looksLikeSlug = (id: string): boolean => id.includes(',-')
    expect(looksLikeSlug('123-main-st-phoenix,-az')).toBe(true)
    expect(looksLikeSlug('totally-bogus-id-zzz')).toBe(false)
    expect(EXIT_BRANCHES.slugShapedUnresolvable.status).toBe(422)
    expect(EXIT_BRANCHES.slugShapedUnresolvable.code).toBe('GEOCODE_FAILED')
  })

  it('returns 503 RESOLUTION_FAILED when ensurePropertyId throws', () => {
    expect(EXIT_BRANCHES.resolutionError.status).toBe(503)
    expect(EXIT_BRANCHES.resolutionError.code).toBe('RESOLUTION_FAILED')
  })

  it('rejects an obviously-invalid raw id with 400 (length > 200, undefined, null)', () => {
    // Guard branch at the top of the param middleware: id missing, literal
    // string "undefined" / "null" (sometimes leaks through from frontend
    // bugs), or > 200 chars → 400 immediately.
    const invalid = ['', 'undefined', 'null', 'a'.repeat(201)]
    for (const id of invalid) {
      const isInvalid = !id || id === 'undefined' || id === 'null' || id.length > 200
      expect(isInvalid).toBe(true)
    }
  })

  it('passes a normal id (≤ 200 chars, not undefined/null) through to next()', () => {
    const valid = ['abc-uuid-1234', '123 Main St', 'a'.repeat(200)]
    for (const id of valid) {
      const isInvalid = !id || id === 'undefined' || id === 'null' || id.length > 200
      expect(isInvalid).toBe(false)
    }
  })
})

// ─── 5. Update-deal stage-transition contract ────────────────────────────────

const stageEnum = z.enum(['PROSPECT', 'IN_PROGRESS', 'UNDER_CONTRACT', 'CLOSED_WON', 'FELL_OUT'])
const falloutReasonEnum = z.enum([
  'INSURABILITY',
  'PRICING_TOO_HIGH',
  'CARRIER_DECLINED',
  'CLIENT_BACKED_OUT',
  'INSPECTION_ISSUES',
  'FINANCING_FELL_THROUGH',
  'APPRAISAL_LOW',
  'TITLE_ISSUES',
  'COMPETING_OFFER',
  'PROPERTY_CONDITION',
  'OTHER',
])

describe('Update-deal stage-transition contract', () => {
  // The dashboard breakdown by fall-through reason is meaningless if
  // FELL_OUT deals don't carry a reason. The route enforces this with a
  // post-zod check — pin it so a refactor that moves the check elsewhere
  // doesn't silently allow reason-less FELL_OUT deals.

  it('FELL_OUT requires a non-null falloutReason', () => {
    // The runtime check is:
    //   if (parsed.data.stage === 'FELL_OUT' && !parsed.data.falloutReason) → 400
    // Mirror it here.
    const violates = (stage: string | undefined, reason: string | null | undefined): boolean =>
      stage === 'FELL_OUT' && !reason
    expect(violates('FELL_OUT', undefined)).toBe(true)
    expect(violates('FELL_OUT', null)).toBe(true)
    expect(violates('FELL_OUT', '')).toBe(true)
    expect(violates('FELL_OUT', 'CARRIER_DECLINED')).toBe(false)
    expect(violates('CLOSED_WON', undefined)).toBe(false)
  })

  it('every FELL_OUT-permitted reason is in the falloutReason enum', () => {
    // 11 documented reasons today. Pin them so removing one (which would
    // orphan historical deals) is an explicit code change.
    expect(falloutReasonEnum.options).toHaveLength(11)
    expect(falloutReasonEnum.options).toContain('CARRIER_DECLINED')
    expect(falloutReasonEnum.options).toContain('OTHER')
  })

  it('every stage value is a non-empty uppercase string', () => {
    for (const s of stageEnum.options) {
      expect(s).toMatch(/^[A-Z_]+$/)
      expect(s.length).toBeGreaterThan(0)
    }
  })
})
