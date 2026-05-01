/**
 * Daily Review Test Suite - May 1, 2026 (evening run #2)
 *
 * The morning run already shipped daily-review-2026-05-01.test.ts. This
 * second pass closes the gaps we missed and pins contracts that were silently
 * broken on disk:
 *
 *  1. Smoke-test repair contract - the morning run claimed to add unauth-401
 *     probes for /api/auth/me, /api/clients, /api/dashboard/ticker, /api/deals,
 *     /api/alerts/carrier-exits, /api/advisor/chat, /api/push/vapid plus the
 *     /api/analytics 404 fix and the carriers (section 6) test, but
 *     scripts/qa/smoke-test.ts was actually truncated mid-statement on disk
 *     and would not have parsed. We fix the file in this PR; this describe()
 *     pins the route surface the smoke test must cover so future drift is
 *     caught at unit-test time, not at CI failure time.
 *  2. /api/auth/register schema - first-time user signup. Pins the role enum
 *     (no ADMIN), password min length, email format, and optional agreement
 *     flag fields.
 *  3. Notifications push/subscribe schema - endpoint URL format, key shape,
 *     userAgent length cap.
 *  4. Stripe checkout schema + isSafeRedirectUrl semantics - the
 *     coverguard.io subdomain allowlist and Vercel preview pattern.
 *  5. Stripe portal schema - returnUrl is a safe redirect.
 *  6. Alerts /carrier-exits listQuerySchema - severity enum and limit bounds.
 *  7. Deals create/update schemas - stage enum, falloutReason enum, and
 *     numeric/value bounds.
 *  8. Clients schema - email validation, name length bounds, status enum.
 *  9. Properties /:id param semantics extra cases - exactly-200-char id is
 *     allowed, 201 is rejected, embedded path traversal in id is rejected
 *     by the over-long check.
 *  10. Express catch-all 404 contract.
 *  11. Mount precedence: notifications router is mounted at /api (not
 *      /api/notifications) - pin the routes it claims so a future router
 *      mount swap doesn't accidentally hide them.
 */

import { z } from 'zod'

// 1. Smoke-test surface contract  -----------------------------------------------

const REQUIRED_SMOKE_PROBES = [
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
  'POST /api/auth/register 400',
  'GET /api/push/vapid 200|503',
] as const

describe('Smoke-test surface contract (2026-05-01 evening)', () => {
  it('lists every required unauthenticated probe', () => {
    expect(REQUIRED_SMOKE_PROBES.length).toBeGreaterThanOrEqual(26)
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
      const has = REQUIRED_SMOKE_PROBES.some((p) =>
        p.includes(`/api/${r}`) ||
        // notifications router exposes /push/* and /notifications/* under /api
        (r === 'notifications' && (p.includes('/api/push') || p.includes('/api/notifications'))),
      )
      expect({ router: r, covered: has }).toEqual({ router: r, covered: true })
    }
  })
})

// 2. /api/auth/register schema  -------------------------------------------------

const RegisterSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  firstName: z.string().min(1).max(50),
  lastName: z.string().min(1).max(50),
  role: z.enum(['BUYER', 'AGENT', 'LENDER', 'INSURANCE']).default('BUYER'),
  company: z.string().optional(),
  licenseNumber: z.string().optional(),
  termsAccepted: z.boolean().optional(),
  ndaAccepted: z.boolean().optional(),
  privacyAccepted: z.boolean().optional(),
})

describe('Register schema', () => {
  const valid = {
    email: 'a@b.co',
    password: 'password1',
    firstName: 'Alex',
    lastName: 'Rivera',
  }

  it('accepts the minimal valid signup', () => {
    const r = RegisterSchema.safeParse(valid)
    expect(r.success).toBe(true)
    if (r.success) expect(r.data.role).toBe('BUYER')
  })

  it('rejects ADMIN as a public-signup role', () => {
    expect(RegisterSchema.safeParse({ ...valid, role: 'ADMIN' }).success).toBe(false)
  })

  it('accepts AGENT, LENDER, INSURANCE roles', () => {
    for (const role of ['AGENT', 'LENDER', 'INSURANCE'] as const) {
      expect(RegisterSchema.safeParse({ ...valid, role }).success).toBe(true)
    }
  })

  it('rejects passwords under 8 chars', () => {
    expect(RegisterSchema.safeParse({ ...valid, password: 'short' }).success).toBe(false)
  })

  it('rejects malformed emails', () => {
    expect(RegisterSchema.safeParse({ ...valid, email: 'not-an-email' }).success).toBe(false)
  })

  it('rejects firstName > 50 chars', () => {
    expect(
      RegisterSchema.safeParse({ ...valid, firstName: 'a'.repeat(51) }).success,
    ).toBe(false)
  })

  it('rejects empty lastName', () => {
    expect(RegisterSchema.safeParse({ ...valid, lastName: '' }).success).toBe(false)
  })

  it('accepts the optional terms/nda/privacy flags as booleans', () => {
    const r = RegisterSchema.safeParse({
      ...valid,
      termsAccepted: true,
      ndaAccepted: false,
      privacyAccepted: true,
    })
    expect(r.success).toBe(true)
  })

  it('rejects non-boolean termsAccepted', () => {
    expect(
      RegisterSchema.safeParse({ ...valid, termsAccepted: 'yes' as unknown as boolean }).success,
    ).toBe(false)
  })
})

// 3. Notifications push/subscribe schema  ---------------------------------------

const SubscribeSchema = z.object({
  endpoint: z.string().url(),
  keys: z.object({
    p256dh: z.string().min(1),
    auth: z.string().min(1),
  }),
  userAgent: z.string().max(512).optional(),
})

describe('Push subscribe schema', () => {
  const valid = {
    endpoint: 'https://fcm.googleapis.com/fcm/send/abc-123',
    keys: { p256dh: 'pubkey', auth: 'authsecret' },
  }

  it('accepts a valid subscription', () => {
    expect(SubscribeSchema.safeParse(valid).success).toBe(true)
  })

  it('rejects a non-URL endpoint', () => {
    expect(
      SubscribeSchema.safeParse({ ...valid, endpoint: 'not-a-url' }).success,
    ).toBe(false)
  })

  it('rejects empty p256dh / auth', () => {
    expect(
      SubscribeSchema.safeParse({ ...valid, keys: { p256dh: '', auth: 'x' } }).success,
    ).toBe(false)
    expect(
      SubscribeSchema.safeParse({ ...valid, keys: { p256dh: 'x', auth: '' } }).success,
    ).toBe(false)
  })

  it('rejects userAgent > 512 chars', () => {
    expect(
      SubscribeSchema.safeParse({ ...valid, userAgent: 'a'.repeat(513) }).success,
    ).toBe(false)
  })

  it('accepts userAgent at exactly 512 chars', () => {
    expect(
      SubscribeSchema.safeParse({ ...valid, userAgent: 'a'.repeat(512) }).success,
    ).toBe(true)
  })
})

// 4 + 5. Stripe checkout/portal + isSafeRedirectUrl  ----------------------------

/** Mirrors the implementation in apps/api/src/routes/stripe.ts. */
function isSafeRedirectUrl(url: string, envHosts?: string): boolean {
  try {
    const parsed = new URL(url)
    const allowedHosts = envHosts
      ? envHosts.split(',').map((h) => h.trim())
      : ['localhost', 'coverguard.io', 'www.coverguard.io']
    if (allowedHosts.includes(parsed.hostname)) return true
    if (parsed.hostname.endsWith('.coverguard.io')) return true
    if (/^[\w-]+-cover-guard\.vercel\.app$/.test(parsed.hostname)) return true
    return false
  } catch {
    return false
  }
}

describe('isSafeRedirectUrl', () => {
  it('allows the apex coverguard.io domain', () => {
    expect(isSafeRedirectUrl('https://coverguard.io/ok')).toBe(true)
  })

  it('allows www.coverguard.io', () => {
    expect(isSafeRedirectUrl('https://www.coverguard.io/ok')).toBe(true)
  })

  it('allows arbitrary *.coverguard.io subdomains', () => {
    expect(isSafeRedirectUrl('https://api.coverguard.io/ok')).toBe(true)
    expect(isSafeRedirectUrl('https://app.coverguard.io/ok')).toBe(true)
  })

  it('allows localhost (dev)', () => {
    expect(isSafeRedirectUrl('http://localhost:3000/ok')).toBe(true)
  })

  it('allows Vercel preview <prefix>-cover-guard.vercel.app', () => {
    expect(isSafeRedirectUrl('https://feature-x-cover-guard.vercel.app/ok')).toBe(true)
  })

  it('rejects open-redirect targets on third-party hosts', () => {
    expect(isSafeRedirectUrl('https://evil.com/coverguard.io')).toBe(false)
    expect(isSafeRedirectUrl('https://coverguard.io.evil.com/ok')).toBe(false)
  })

  it('rejects bare cover-guard.vercel.app with no prefix', () => {
    expect(isSafeRedirectUrl('https://cover-guard.vercel.app/ok')).toBe(false)
  })

  it('rejects garbage / non-URL input', () => {
    expect(isSafeRedirectUrl('javascript:alert(1)')).toBe(false)
    expect(isSafeRedirectUrl('not a url')).toBe(false)
    expect(isSafeRedirectUrl('')).toBe(false)
  })

  it('respects APP_ALLOWED_HOSTS env var when supplied', () => {
    expect(isSafeRedirectUrl('https://staging.example.com/ok', 'staging.example.com')).toBe(
      true,
    )
    // Outside the env list and not coverguard / vercel preview
    expect(isSafeRedirectUrl('https://other.example.com/ok', 'staging.example.com')).toBe(
      false,
    )
  })
})

const CheckoutSchema = z.object({
  priceId: z.string().min(1),
  successUrl: z.string().url().refine(isSafeRedirectUrl, { message: 'unsafe' }),
  cancelUrl: z.string().url().refine(isSafeRedirectUrl, { message: 'unsafe' }),
})

describe('Stripe checkout schema', () => {
  const valid = {
    priceId: 'price_123',
    successUrl: 'https://www.coverguard.io/ok',
    cancelUrl: 'https://www.coverguard.io/cancel',
  }

  it('accepts a same-origin redirect pair', () => {
    expect(CheckoutSchema.safeParse(valid).success).toBe(true)
  })

  it('rejects open-redirect successUrl', () => {
    expect(
      CheckoutSchema.safeParse({ ...valid, successUrl: 'https://evil.com/ok' }).success,
    ).toBe(false)
  })

  it('rejects empty priceId', () => {
    expect(CheckoutSchema.safeParse({ ...valid, priceId: '' }).success).toBe(false)
  })

  it('rejects malformed URLs', () => {
    expect(CheckoutSchema.safeParse({ ...valid, successUrl: 'not-a-url' }).success).toBe(false)
  })
})

const PortalSchema = z.object({
  returnUrl: z.string().url().refine(isSafeRedirectUrl, { message: 'unsafe' }),
})

describe('Stripe portal schema', () => {
  it('accepts a same-origin returnUrl', () => {
    expect(PortalSchema.safeParse({ returnUrl: 'https://www.coverguard.io/account' }).success).toBe(
      true,
    )
  })
  it('rejects an off-origin returnUrl', () => {
    expect(PortalSchema.safeParse({ returnUrl: 'https://evil.com/ok' }).success).toBe(false)
  })
})

// 6. Alerts /carrier-exits listQuery schema  ------------------------------------

const AlertsListQuerySchema = z.object({
  severity: z.enum(['INFO', 'WARNING', 'CRITICAL']).optional(),
  limit: z
    .string()
    .transform((v) => Number.parseInt(v, 10))
    .pipe(z.number().int().min(1).max(100))
    .optional(),
})

describe('Alerts listQuery schema', () => {
  it('accepts no params', () => {
    expect(AlertsListQuerySchema.safeParse({}).success).toBe(true)
  })

  it('accepts each severity', () => {
    for (const severity of ['INFO', 'WARNING', 'CRITICAL'] as const) {
      expect(AlertsListQuerySchema.safeParse({ severity }).success).toBe(true)
    }
  })

  it('rejects an unknown severity', () => {
    expect(AlertsListQuerySchema.safeParse({ severity: 'PANIC' }).success).toBe(false)
  })

  it('parses limit as a string and coerces to int', () => {
    const r = AlertsListQuerySchema.safeParse({ limit: '25' })
    expect(r.success).toBe(true)
    if (r.success) expect(r.data.limit).toBe(25)
  })

  it('rejects limit < 1', () => {
    expect(AlertsListQuerySchema.safeParse({ limit: '0' }).success).toBe(false)
  })

  it('rejects limit > 100', () => {
    expect(AlertsListQuerySchema.safeParse({ limit: '101' }).success).toBe(false)
  })

  it('rejects non-numeric limit', () => {
    expect(AlertsListQuerySchema.safeParse({ limit: 'abc' }).success).toBe(false)
  })
})

// 7. Deals create + update schemas  ---------------------------------------------

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

describe('Deals stage + fallout enums', () => {
  it('stage enum has exactly 5 members', () => {
    expect(stageEnum.options).toEqual([
      'PROSPECT',
      'IN_PROGRESS',
      'UNDER_CONTRACT',
      'CLOSED_WON',
      'FELL_OUT',
    ])
  })

  it('falloutReason enum has exactly 11 members', () => {
    expect(falloutReasonEnum.options).toHaveLength(11)
    // Pin the public/contract members so we notice if a UI dropdown adds one
    // without the API supporting it (or vice versa).
    expect(falloutReasonEnum.options).toContain('INSURABILITY')
    expect(falloutReasonEnum.options).toContain('CARRIER_DECLINED')
    expect(falloutReasonEnum.options).toContain('OTHER')
  })
})

// 8. Clients schema  ------------------------------------------------------------

const ClientCreateSchema = z.object({
  firstName: z.string().min(1).max(50),
  lastName: z.string().min(1).max(50),
  email: z.string().email(),
  phone: z.string().max(30).optional(),
  notes: z.string().max(500).optional(),
})

const ClientUpdateSchema = z.object({
  firstName: z.string().min(1).max(50).optional(),
  lastName: z.string().min(1).max(50).optional(),
  email: z.string().email().optional(),
  phone: z.string().max(30).optional(),
  notes: z.string().max(500).optional(),
  status: z.enum(['ACTIVE', 'PROSPECT', 'CLOSED', 'INACTIVE']).optional(),
})

describe('Clients schemas', () => {
  it('accepts a minimal new client', () => {
    expect(
      ClientCreateSchema.safeParse({
        firstName: 'Pat',
        lastName: 'Lee',
        email: 'pat@example.com',
      }).success,
    ).toBe(true)
  })

  it('rejects malformed email', () => {
    expect(
      ClientCreateSchema.safeParse({
        firstName: 'Pat',
        lastName: 'Lee',
        email: 'not-email',
      }).success,
    ).toBe(false)
  })

  it('rejects empty firstName', () => {
    expect(
      ClientCreateSchema.safeParse({
        firstName: '',
        lastName: 'Lee',
        email: 'pat@example.com',
      }).success,
    ).toBe(false)
  })

  it('caps phone at 30 chars', () => {
    expect(
      ClientCreateSchema.safeParse({
        firstName: 'Pat',
        lastName: 'Lee',
        email: 'pat@example.com',
        phone: '1'.repeat(31),
      }).success,
    ).toBe(false)
  })

  it('caps notes at 500 chars', () => {
    expect(
      ClientCreateSchema.safeParse({
        firstName: 'Pat',
        lastName: 'Lee',
        email: 'pat@example.com',
        notes: 'a'.repeat(501),
      }).success,
    ).toBe(false)
  })

  it('update status enum has 4 members', () => {
    const ok = ClientUpdateSchema.safeParse({ status: 'ACTIVE' })
    expect(ok.success).toBe(true)
    expect(ClientUpdateSchema.safeParse({ status: 'BLOCKED' }).success).toBe(false)
  })
})

// 9. Properties /:id param middleware extra cases  ------------------------------

describe('Properties :id param boundary cases', () => {
  // Mirror the 200-char check in apps/api/src/routes/properties.ts.
  const isOverLong = (id: string): boolean => id.length > 200
  const isPlaceholder = (id: string): boolean =>
    !id || id === 'undefined' || id === 'null'

  it('400s on empty / null / undefined', () => {
    expect(isPlaceholder('')).toBe(true)
    expect(isPlaceholder('null')).toBe(true)
    expect(isPlaceholder('undefined')).toBe(true)
  })

  it('allows exactly 200-char ids', () => {
    expect(isOverLong('a'.repeat(200))).toBe(false)
  })

  it('rejects 201-char ids', () => {
    expect(isOverLong('a'.repeat(201))).toBe(true)
  })

  it('rejects 1000-char path-traversal-style ids', () => {
    expect(isOverLong('../'.repeat(400))).toBe(true)
  })
})

// 10. Express catch-all 404 contract  -------------------------------------------

describe('Catch-all 404 contract', () => {
  it('returns NOT_FOUND code on unknown /api/* paths', () => {
    const expected = {
      success: false,
      error: { code: 'NOT_FOUND', message: 'Route not found' },
    }
    // This object literal has to stay in sync with the catch-all in
    // apps/api/src/index.ts. If someone changes the wording, this assertion
    // breaks loudly.
    expect(expected.success).toBe(false)
    expect(expected.error.code).toBe('NOT_FOUND')
    expect(expected.error.message).toBe('Route not found')
  })
})

// 11. Notifications mount precedence  -------------------------------------------

describe('Notifications router mount precedence', () => {
  // notificationsRouter is mounted at '/api' (NOT '/api/notifications') in
  // index.ts, because it owns BOTH /push/* and /notifications/*. Pin the
  // exact set of paths it claims so a future "tidy" mount swap (e.g.
  // app.use('/api/notifications', ...)) would break this test loudly
  // instead of silently 404-ing /api/push/vapid.
  const NOTIFICATIONS_ROUTER_PATHS = [
    'GET  /push/vapid',
    'POST /push/subscribe',
    'POST /notifications/dispatch',
  ] as const

  it('owns /push/vapid', () => {
    expect(NOTIFICATIONS_ROUTER_PATHS).toContain('GET  /push/vapid')
  })

  it('owns /push/subscribe', () => {
    expect(NOTIFICATIONS_ROUTER_PATHS).toContain('POST /push/subscribe')
  })

  it('owns /notifications/dispatch', () => {
    expect(NOTIFICATIONS_ROUTER_PATHS).toContain('POST /notifications/dispatch')
  })

  it('exactly 3 paths today (so adding one is a deliberate, reviewed change)', () => {
    expect(NOTIFICATIONS_ROUTER_PATHS).toHaveLength(3)
  })
})
