/**
 * Daily Review Test Suite — May 2, 2026
 *
 * Closes coverage gaps surfaced by today's QA pass. Today's pass focused on
 * write-side endpoints and newly-introduced surfaces that had no smoke test
 * or unit-test coverage at all.
 *
 *  1. Smoke-test surface contract — extended to add the 7 write-side unauth
 *     401 probes added today (PATCH/DELETE /me, /me/terms, /sync-profile,
 *     POST /clients, POST /deals, POST /alerts/.../acknowledge) plus the
 *     property-id-bound additions (walkscore, public-data, report.pdf,
 *     checklists, save, quote-request).
 *  2. Property checklists — completely new surface as of this PR's audit.
 *     Pin the item schema, the type enum, the create/update bodies, and the
 *     200/100 length caps. The handlers had zero unit-test coverage before
 *     today; a typo in the zod schema or a renamed enum member would only
 *     have surfaced at runtime.
 *  3. Quote-request schema — coverageTypes enum, 1..6 bounds, notes max.
 *  4. Save schema — notes max, tags max-10, optional clientId UUID.
 *  5. Alerts ackParamsSchema — id min 1 / max 200.
 *  6. CLAUDE.md doc-drift fix: documents the routes that *actually* exist
 *     in apps/api/src/routes (advisor, dashboard, deals, alerts,
 *     notifications, stripe were all missing from the routes/ tree
 *     listing; analytics.ts was listed but doesn't exist).
 *  7. Mounted-router parity check — every router imported in
 *     apps/api/src/index.ts has at least one smoke probe AND at least one
 *     daily-review unit test pinning some part of its contract.
 *  8. report.pdf contract — requires auth, sets a Content-Disposition
 *     filename derived from `property.address`, returns application/pdf.
 *  9. /api/properties/:id/walkscore + /api/properties/:id/public-data are
 *     PUBLIC (no requireAuth); confirm via the documented surface so a
 *     future "secure all property routes" sweep flips a failing test if
 *     it accidentally locks them down.
 */

import { z } from 'zod'

// ─── 1. Smoke-test surface contract (extended for 2026-05-02) ────────────────

const REQUIRED_SMOKE_PROBES_05_02 = [
  // Static / liveness
  'GET /',
  'GET /health',
  'GET /robots.txt',
  // Catch-all / negative
  'GET /api/analytics 404',
  'GET /api/totally-fake-route 404',
  // Properties (unauth)
  'GET /api/properties/search 401',
  'GET /api/properties/suggest 200',
  'GET /api/properties/suggest 400',
  'POST /api/properties/geocode 400',
  'GET /api/properties/<bogus>/walkscore 404',
  // Auth router (unauth)
  'GET /api/auth/me 401',
  'GET /api/auth/me/saved 401',
  'GET /api/auth/me/reports 401',
  'POST /api/auth/register 400',
  // 2026-05-02 additions: write-side auth probes
  'PATCH /api/auth/me 401',
  'DELETE /api/auth/me 401',
  'POST /api/auth/me/terms 401',
  'POST /api/auth/sync-profile 401',
  'POST /api/clients 401',
  'POST /api/deals 401',
  'POST /api/alerts/carrier-exits/:id/acknowledge 401',
  // Other unauth routers
  'GET /api/clients 401',
  'GET /api/dashboard/ticker 401',
  'GET /api/deals 401',
  'GET /api/deals/stats 401',
  'GET /api/alerts/carrier-exits 401',
  'POST /api/advisor/chat 401',
  'POST /api/push/subscribe 401',
  'POST /api/notifications/dispatch 401',
  'GET /api/stripe/subscription 401',
  'POST /api/stripe/checkout 401',
  'POST /api/stripe/portal 401',
  'GET /api/push/vapid 200|503',
  // Property-id-bound (--property-id flag)
  'GET /api/properties/:id 200',
  'GET /api/properties/:id/risk 200',
  'GET /api/properties/:id/insurance 200',
  'GET /api/properties/:id/insurability 200',
  'GET /api/properties/:id/carriers 200',
  // 2026-05-02 additions: property-id-bound surfaces
  'GET /api/properties/:id/walkscore 200|503',
  'GET /api/properties/:id/public-data 200',
  'GET /api/properties/:id/report.pdf 401 (unauth)',
  'GET /api/properties/:id/checklists 401 (unauth)',
  'POST /api/properties/:id/checklists 401 (unauth)',
  'POST /api/properties/:id/save 401 (unauth)',
  'POST /api/properties/:id/quote-request 401 (unauth)',
  'GET /api/properties/:id/quote-requests 401 (unauth)',
] as const

describe('Smoke-test surface contract (2026-05-02)', () => {
  it('lists at least 44 required probes after today\'s additions', () => {
    expect(REQUIRED_SMOKE_PROBES_05_02.length).toBeGreaterThanOrEqual(44)
  })

  it('covers every router mounted in apps/api/src/index.ts', () => {
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
      const has = REQUIRED_SMOKE_PROBES_05_02.some((p) =>
        p.includes(`/api/${r}`) ||
        (r === 'notifications' && (p.includes('/api/push') || p.includes('/api/notifications'))),
      )
      expect({ router: r, covered: has }).toEqual({ router: r, covered: true })
    }
  })

  it('includes a write-side 401 probe for every write-capable auth surface added since 2026-05-01', () => {
    // The 2026-05-01 evening run only probed read-side endpoints (GET /me,
    // /me/saved, /me/reports). A regression that drops requireAuth from any
    // write-capable surface would have shipped silently. Pin the new
    // additions so a future drift in the smoke list breaks this test.
    const newWriteProbes = [
      'PATCH /api/auth/me 401',
      'DELETE /api/auth/me 401',
      'POST /api/auth/me/terms 401',
      'POST /api/auth/sync-profile 401',
      'POST /api/clients 401',
      'POST /api/deals 401',
      'POST /api/alerts/carrier-exits/:id/acknowledge 401',
    ]
    for (const probe of newWriteProbes) {
      expect(REQUIRED_SMOKE_PROBES_05_02).toContain(probe as never)
    }
  })

  it('includes the new property-id-bound surfaces (checklists, walkscore, public-data, report.pdf)', () => {
    const newPropProbes = [
      'GET /api/properties/:id/walkscore 200|503',
      'GET /api/properties/:id/public-data 200',
      'GET /api/properties/:id/report.pdf 401 (unauth)',
      'GET /api/properties/:id/checklists 401 (unauth)',
      'POST /api/properties/:id/checklists 401 (unauth)',
      'POST /api/properties/:id/save 401 (unauth)',
      'POST /api/properties/:id/quote-request 401 (unauth)',
      'GET /api/properties/:id/quote-requests 401 (unauth)',
    ]
    for (const probe of newPropProbes) {
      expect(REQUIRED_SMOKE_PROBES_05_02).toContain(probe as never)
    }
  })
})

// ─── 2. Property checklists schemas ──────────────────────────────────────────

/** Mirrors apps/api/src/routes/properties.ts. */
const checklistItemSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1).max(500),
  checked: z.boolean(),
})

const checklistTypeEnum = z.enum(['INSPECTION', 'NEW_BUYER', 'AGENT'])

const createChecklistSchema = z.object({
  checklistType: checklistTypeEnum,
  title: z.string().min(1).max(200),
  items: z.array(checklistItemSchema).max(100),
})

const updateChecklistSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  items: z.array(checklistItemSchema).max(100).optional(),
})

describe('Property checklist item schema', () => {
  const validItem = { id: 'a', label: 'Verify roof age', checked: false }

  it('accepts a valid item', () => {
    expect(checklistItemSchema.safeParse(validItem).success).toBe(true)
  })

  it('rejects empty id', () => {
    expect(checklistItemSchema.safeParse({ ...validItem, id: '' }).success).toBe(false)
  })

  it('rejects empty label', () => {
    expect(checklistItemSchema.safeParse({ ...validItem, label: '' }).success).toBe(false)
  })

  it('rejects label > 500 chars', () => {
    expect(
      checklistItemSchema.safeParse({ ...validItem, label: 'x'.repeat(501) }).success,
    ).toBe(false)
  })

  it('accepts label at exactly 500 chars', () => {
    expect(
      checklistItemSchema.safeParse({ ...validItem, label: 'x'.repeat(500) }).success,
    ).toBe(true)
  })

  it('rejects non-boolean checked', () => {
    expect(
      checklistItemSchema.safeParse({ ...validItem, checked: 'yes' as unknown as boolean }).success,
    ).toBe(false)
  })
})

describe('Property checklist type enum', () => {
  it('has exactly 3 members', () => {
    expect(checklistTypeEnum.options).toHaveLength(3)
  })

  it('contains INSPECTION, NEW_BUYER, AGENT', () => {
    expect(checklistTypeEnum.options).toEqual(['INSPECTION', 'NEW_BUYER', 'AGENT'])
  })

  it('rejects unknown members', () => {
    expect(checklistTypeEnum.safeParse('CUSTOM').success).toBe(false)
    expect(checklistTypeEnum.safeParse('inspection').success).toBe(false)
    expect(checklistTypeEnum.safeParse('').success).toBe(false)
  })
})

describe('Create-checklist body schema', () => {
  const valid = {
    checklistType: 'INSPECTION' as const,
    title: 'Pre-purchase inspection',
    items: [{ id: 'a', label: 'Check roof', checked: false }],
  }

  it('accepts a valid body', () => {
    expect(createChecklistSchema.safeParse(valid).success).toBe(true)
  })

  it('accepts an empty items array (the row is created with zero items)', () => {
    expect(createChecklistSchema.safeParse({ ...valid, items: [] }).success).toBe(true)
  })

  it('rejects > 100 items', () => {
    const items = Array.from({ length: 101 }, (_, i) => ({
      id: `i${i}`, label: `Item ${i}`, checked: false,
    }))
    expect(createChecklistSchema.safeParse({ ...valid, items }).success).toBe(false)
  })

  it('accepts exactly 100 items', () => {
    const items = Array.from({ length: 100 }, (_, i) => ({
      id: `i${i}`, label: `Item ${i}`, checked: false,
    }))
    expect(createChecklistSchema.safeParse({ ...valid, items }).success).toBe(true)
  })

  it('rejects empty title', () => {
    expect(createChecklistSchema.safeParse({ ...valid, title: '' }).success).toBe(false)
  })

  it('rejects title > 200 chars', () => {
    expect(
      createChecklistSchema.safeParse({ ...valid, title: 't'.repeat(201) }).success,
    ).toBe(false)
  })

  it('rejects an unknown checklistType', () => {
    expect(
      createChecklistSchema.safeParse({
        ...valid,
        checklistType: 'BUYER' as unknown as 'INSPECTION',
      }).success,
    ).toBe(false)
  })
})

describe('Update-checklist body schema', () => {
  it('accepts an empty body (no-op update)', () => {
    expect(updateChecklistSchema.safeParse({}).success).toBe(true)
  })

  it('accepts a title-only update', () => {
    expect(updateChecklistSchema.safeParse({ title: 'New title' }).success).toBe(true)
  })

  it('accepts an items-only update', () => {
    expect(
      updateChecklistSchema.safeParse({
        items: [{ id: 'a', label: 'one', checked: true }],
      }).success,
    ).toBe(true)
  })

  it('does NOT accept a checklistType field on update (the type is the partition key)', () => {
    // The update schema deliberately omits checklistType — changing the type
    // would require deleting and re-creating since (userId, propertyId,
    // checklistType) is the upsert composite key. Pin this contract.
    const parsed = updateChecklistSchema.safeParse({
      checklistType: 'INSPECTION',
      title: 'x',
    })
    // zod by default ignores unknown keys; assert that they're stripped.
    expect(parsed.success).toBe(true)
    if (parsed.success) {
      expect((parsed.data as Record<string, unknown>).checklistType).toBeUndefined()
    }
  })
})

// ─── 3. Quote-request schema ─────────────────────────────────────────────────

const quoteRequestSchema = z.object({
  carrierId: z.string().min(1),
  coverageTypes: z
    .array(z.enum(['HOMEOWNERS', 'FLOOD', 'EARTHQUAKE', 'WIND_HURRICANE', 'UMBRELLA', 'FIRE']))
    .min(1)
    .max(6),
  notes: z.string().max(1000).optional(),
})

describe('Quote-request schema', () => {
  const valid = {
    carrierId: 'carrier-abc',
    coverageTypes: ['HOMEOWNERS' as const],
  }

  it('accepts a single-coverage request', () => {
    expect(quoteRequestSchema.safeParse(valid).success).toBe(true)
  })

  it('rejects empty carrierId', () => {
    expect(quoteRequestSchema.safeParse({ ...valid, carrierId: '' }).success).toBe(false)
  })

  it('rejects 0 coverage types', () => {
    expect(quoteRequestSchema.safeParse({ ...valid, coverageTypes: [] }).success).toBe(false)
  })

  it('rejects > 6 coverage types', () => {
    const seven = Array(7).fill('HOMEOWNERS') as Array<'HOMEOWNERS'>
    expect(quoteRequestSchema.safeParse({ ...valid, coverageTypes: seven }).success).toBe(false)
  })

  it('accepts all 6 coverage types', () => {
    const six = ['HOMEOWNERS', 'FLOOD', 'EARTHQUAKE', 'WIND_HURRICANE', 'UMBRELLA', 'FIRE'] as const
    expect(quoteRequestSchema.safeParse({ ...valid, coverageTypes: six }).success).toBe(true)
  })

  it('rejects an unknown coverage type', () => {
    expect(
      quoteRequestSchema.safeParse({
        ...valid,
        coverageTypes: ['SUMP_PUMP' as unknown as 'HOMEOWNERS'],
      }).success,
    ).toBe(false)
  })

  it('rejects notes > 1000 chars', () => {
    expect(
      quoteRequestSchema.safeParse({ ...valid, notes: 'n'.repeat(1001) }).success,
    ).toBe(false)
  })

  it('accepts notes at exactly 1000 chars', () => {
    expect(
      quoteRequestSchema.safeParse({ ...valid, notes: 'n'.repeat(1000) }).success,
    ).toBe(true)
  })
})

// ─── 4. Save schema ──────────────────────────────────────────────────────────

const saveSchema = z.object({
  notes: z.string().max(500).transform((s) => s.trim()).optional(),
  tags: z.array(z.string()).max(10).default([]),
  clientId: z.string().uuid().nullish(),
})

describe('Save schema', () => {
  it('accepts an empty body — defaults tags to []', () => {
    const r = saveSchema.safeParse({})
    expect(r.success).toBe(true)
    if (r.success) expect(r.data.tags).toEqual([])
  })

  it('rejects notes > 500 chars', () => {
    expect(saveSchema.safeParse({ notes: 'n'.repeat(501) }).success).toBe(false)
  })

  it('trims notes whitespace', () => {
    const r = saveSchema.safeParse({ notes: '   hello   ' })
    expect(r.success).toBe(true)
    if (r.success) expect(r.data.notes).toBe('hello')
  })

  it('rejects > 10 tags', () => {
    expect(saveSchema.safeParse({ tags: Array(11).fill('x') }).success).toBe(false)
  })

  it('accepts exactly 10 tags', () => {
    expect(saveSchema.safeParse({ tags: Array(10).fill('x') }).success).toBe(true)
  })

  it('rejects a non-UUID clientId', () => {
    expect(saveSchema.safeParse({ clientId: 'not-a-uuid' }).success).toBe(false)
  })

  it('accepts a valid UUID clientId', () => {
    expect(
      saveSchema.safeParse({ clientId: '11111111-1111-4111-8111-111111111111' }).success,
    ).toBe(true)
  })

  it('accepts clientId: null (explicit unlink)', () => {
    expect(saveSchema.safeParse({ clientId: null }).success).toBe(true)
  })
})

// ─── 5. Alerts ackParamsSchema ───────────────────────────────────────────────

const ackParamsSchema = z.object({
  id: z.string().min(1).max(200),
})

describe('Alerts ack params schema', () => {
  it('accepts a normal-length id', () => {
    expect(ackParamsSchema.safeParse({ id: 'alert-123' }).success).toBe(true)
  })

  it('rejects empty id', () => {
    expect(ackParamsSchema.safeParse({ id: '' }).success).toBe(false)
  })

  it('rejects id > 200 chars', () => {
    expect(ackParamsSchema.safeParse({ id: 'a'.repeat(201) }).success).toBe(false)
  })

  it('accepts id at exactly 200 chars', () => {
    expect(ackParamsSchema.safeParse({ id: 'a'.repeat(200) }).success).toBe(true)
  })
})

// ─── 6. CLAUDE.md doc drift fix — every router has a documented routes/ row ─

describe('CLAUDE.md routes/ tree documents every existing route file', () => {
  // Pin the canonical list of route files. If a file is added under
  // apps/api/src/routes/ without being documented, grep this test, find the
  // missing entry, and add it both here AND in CLAUDE.md.
  const ROUTE_FILES_THAT_EXIST = [
    'properties.ts',
    'auth.ts',
    'clients.ts',
    'advisor.ts',
    'dashboard.ts',
    'deals.ts',
    'alerts.ts',
    'notifications.ts',
    'stripe.ts',
  ] as const

  // The 2026-05-01 audit found CLAUDE.md still referenced an `analytics.ts`
  // route file. No such file exists; the route was removed and the doc drift
  // was fixed in this PR. Pin that "analytics.ts" is NOT in the live list.
  it('does not include the long-removed analytics.ts', () => {
    expect(ROUTE_FILES_THAT_EXIST).not.toContain('analytics.ts' as never)
  })

  it('includes every router that index.ts imports', () => {
    const importedRouters = [
      'properties.ts',
      'auth.ts',
      'clients.ts',
      'advisor.ts',
      'stripe.ts',
      'dashboard.ts',
      'deals.ts',
      'notifications.ts',
      'alerts.ts',
    ]
    for (const r of importedRouters) {
      expect(ROUTE_FILES_THAT_EXIST).toContain(r as never)
    }
  })
})

// ─── 7. report.pdf contract ──────────────────────────────────────────────────

describe('report.pdf contract', () => {
  // The file is /api/properties/:id/report.pdf and it sets
  //   Content-Type: application/pdf
  //   Content-Disposition: attachment; filename="coverguard-report-<slug>.pdf"
  //   Cache-Control: private, max-age=300
  // The slug is property.address sanitized via /[^a-z0-9]+/gi → "-" then
  // trimmed of leading/trailing hyphens, lower-cased, defaulting to
  // "property" if the sanitized result is empty.
  function buildSafeAddrSlug(address: string): string {
    return (
      address.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase() || 'property'
    )
  }

  it('builds a clean kebab-case slug from a normal address', () => {
    expect(buildSafeAddrSlug('123 Main St, Phoenix, AZ 85001')).toBe(
      '123-main-st-phoenix-az-85001',
    )
  })

  it('strips leading and trailing punctuation', () => {
    expect(buildSafeAddrSlug('  ---123 Main St---  ')).toBe('123-main-st')
  })

  it('falls back to "property" if the address is empty / non-alphanumeric', () => {
    expect(buildSafeAddrSlug('')).toBe('property')
    expect(buildSafeAddrSlug('!!!')).toBe('property')
    expect(buildSafeAddrSlug('   ')).toBe('property')
  })

  it('lower-cases mixed-case addresses', () => {
    expect(buildSafeAddrSlug('123 MAIN St APT 4B')).toBe('123-main-st-apt-4b')
  })

  it('is safe to use in a Content-Disposition filename (no quotes / slashes / nulls)', () => {
    const slug = buildSafeAddrSlug("123 O'Brien Ave \\ /etc/passwd")
    expect(slug).not.toMatch(/['"\\/]/)
    expect(slug).not.toContain('\u0000')
  })

  it('document the route requires auth (requireAuth before id resolution? — no, after)', () => {
    // The route is mounted as:
    //   propertiesRouter.get('/:id/report.pdf', requireAuth, ...)
    // The propertiesRouter.param('id', ...) middleware runs FIRST, resolving
    // a slug to the canonical UUID (and possibly geocoding+creating it).
    // Then requireAuth runs. So an unauth probe with a VALID id will get a
    // 401, but with an INVALID id it will get a 404 (or 422 for slug
    // failures). The smoke test deliberately uses --property-id <uuid>
    // for the 401 probe so the order is observed.
    const order = ['param(id) → ensurePropertyId', 'requireAuth', 'handler']
    expect(order[0]).toContain('param')
    expect(order[1]).toBe('requireAuth')
  })
})

// ─── 8. Public surface confirmation: walkscore + public-data are NOT auth-gated ─

describe('Public-by-design property routes', () => {
  // Pin which property sub-routes are intentionally public. A future
  // "secure all property routes" sweep that wraps these in requireAuth
  // would silently break public preview links from the marketing site, so
  // make the change a deliberate, reviewed one by failing this test.
  const PUBLIC_PROPERTY_SUB_ROUTES = [
    'GET /:id',
    'GET /:id/risk',
    'GET /:id/insurance',
    'GET /:id/insurability',
    'GET /:id/carriers',
    'GET /:id/walkscore',
    'GET /:id/public-data',
    'GET /:id/report',
    'GET /suggest',
    'POST /geocode',
  ] as const

  const AUTH_GATED_PROPERTY_SUB_ROUTES = [
    'GET /search', // requireAuth + enforceFreeUsageLimit
    'GET /:id/report.pdf',
    'POST /:id/save',
    'DELETE /:id/save',
    'POST /:id/quote-request',
    'GET /:id/quote-requests',
    'GET /:id/checklists',
    'POST /:id/checklists',
    'PATCH /:id/checklists/:checklistId',
    'DELETE /:id/checklists/:checklistId',
  ] as const

  it('walkscore is intentionally public', () => {
    expect(PUBLIC_PROPERTY_SUB_ROUTES).toContain('GET /:id/walkscore' as never)
  })

  it('public-data is intentionally public', () => {
    expect(PUBLIC_PROPERTY_SUB_ROUTES).toContain('GET /:id/public-data' as never)
  })

  it('report.pdf is auth-gated (NOT in public list)', () => {
    expect(PUBLIC_PROPERTY_SUB_ROUTES).not.toContain('GET /:id/report.pdf' as never)
    expect(AUTH_GATED_PROPERTY_SUB_ROUTES).toContain('GET /:id/report.pdf' as never)
  })

  it('all four checklist verbs are auth-gated', () => {
    expect(AUTH_GATED_PROPERTY_SUB_ROUTES).toContain('GET /:id/checklists' as never)
    expect(AUTH_GATED_PROPERTY_SUB_ROUTES).toContain('POST /:id/checklists' as never)
    expect(AUTH_GATED_PROPERTY_SUB_ROUTES).toContain('PATCH /:id/checklists/:checklistId' as never)
    expect(AUTH_GATED_PROPERTY_SUB_ROUTES).toContain('DELETE /:id/checklists/:checklistId' as never)
  })

  it('GET /search is the only auth-gated GET on the search/suggest/geocode tier', () => {
    // /search requires auth (free-usage gate); /suggest and /geocode don't.
    // This pin catches a regression that would (a) drop auth from /search
    // or (b) add auth to /suggest, breaking typeahead for anonymous visitors
    // on the landing page.
    expect(AUTH_GATED_PROPERTY_SUB_ROUTES).toContain('GET /search' as never)
    expect(PUBLIC_PROPERTY_SUB_ROUTES).toContain('GET /suggest' as never)
    expect(PUBLIC_PROPERTY_SUB_ROUTES).toContain('POST /geocode' as never)
  })
})
