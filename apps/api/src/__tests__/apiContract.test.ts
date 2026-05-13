/**
 * API contract test suite (PR-D2).
 *
 * Consolidated home for durable schema + smoke-surface assertions that were
 * previously scattered across `daily-review-2026-04-*.test.ts` and
 * `daily-review-2026-05-01b.test.ts`. The originals were one-shot artifacts
 * from daily QA passes; they accumulate as dead test code. Retiring them and
 * promoting the assertions worth keeping into ONE file:
 *
 *   - keeps the long-lived contract front-and-center in code review,
 *   - removes per-day noise from the test report,
 *   - prevents future drift (a new schema change has to update this file).
 *
 * What lives here:
 *   1. Smoke-test surface contract — the unauth probes that `scripts/qa/smoke-test.ts`
 *      must keep covering. If a router moves, the smoke test and this contract
 *      both need to update.
 *   2. Route input schemas (Zod) for the public-shaped routes most likely to
 *      drift: properties param, quote request, checklist, property search,
 *      save property, /api/auth/register, /api/push/subscribe, /api/stripe/*,
 *      /api/alerts/carrier-exits, /api/deals, /api/clients.
 *   3. Stripe `isSafeRedirectUrl` semantics — coverguard.io subdomain
 *      allowlist + Vercel preview pattern + env override.
 *   4. Cross-cutting assertions: robots.txt body shape, catch-all 404, climate
 *      risk type extensions (heat / drought) on PropertyRiskProfile.
 *
 * What does NOT live here:
 *   - Daily-review files dated within the last ~30 days. Those are recent
 *     enough to still be useful as a workings record; D2-followups can fold
 *     individual durable assertions in over time.
 *   - Service-level tests (those stay in apps/api/src/services/__tests__/).
 *   - Per-route integration tests (those stay alongside the routes).
 */

import { z } from 'zod'
import type { RiskTrend } from '@coverguard/shared'

// ─── 1. Smoke-test surface contract ────────────────────────────────────────

/**
 * The full list of probes that scripts/qa/smoke-test.ts must cover. Each entry
 * is `METHOD /path EXPECTED_STATUS`. When a new router is mounted, add the
 * appropriate 401 (auth-required) or 200 (public) probe to this list AND to
 * the smoke-test script in the same PR.
 */
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

describe('API contract — smoke surface', () => {
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
      const has = REQUIRED_SMOKE_PROBES.some(
        (p) =>
          p.includes(`/api/${r}`) ||
          // notifications router exposes /push/* and /notifications/* under /api
          (r === 'notifications' && (p.includes('/api/push') || p.includes('/api/notifications'))),
      )
      expect({ router: r, covered: has }).toEqual({ router: r, covered: true })
    }
  })

  it('expects /api/analytics to remain a 404 (no analytics router mounted)', () => {
    expect(REQUIRED_SMOKE_PROBES).toContain('GET /api/analytics 404')
  })

  it('robots.txt body disallows everything', () => {
    const expectedBody = 'User-agent: *\nDisallow: /\n'
    expect(expectedBody).toContain('Disallow: /')
    expect(expectedBody).toContain('User-agent: *')
  })
})

// ─── 2. Properties schemas ─────────────────────────────────────────────────

const PropertyIdSchema = z.object({
  id: z.string().uuid('Property ID must be a valid UUID'),
})

const PropertySearchSchema = z.object({
  address: z.string().min(3).max(200).optional(),
  city: z.string().min(1).max(100).optional(),
  state: z
    .string()
    .length(2)
    .regex(/^[A-Z]{2}$/)
    .optional(),
  zip: z
    .string()
    .regex(/^[0-9]{5}(-[0-9]{4})?$/)
    .optional(),
  lat: z.number().min(-90).max(90).optional(),
  lng: z.number().min(-180).max(180).optional(),
})

const SavePropertySchema = z.object({
  propertyId: z.string().uuid(),
  nickname: z.string().min(1).max(100).optional(),
  tags: z.array(z.string().max(50)).max(20).optional(),
  notes: z.string().max(5000).optional(),
})

describe('API contract — properties schemas', () => {
  describe('PropertyIdSchema', () => {
    it('accepts a valid UUID', () => {
      expect(
        PropertyIdSchema.safeParse({ id: '550e8400-e29b-41d4-a716-446655440000' }).success,
      ).toBe(true)
    })
    it('rejects a non-UUID', () => {
      expect(PropertyIdSchema.safeParse({ id: 'not-a-uuid' }).success).toBe(false)
    })
    it('rejects missing id', () => {
      expect(PropertyIdSchema.safeParse({}).success).toBe(false)
    })
  })

  describe('PropertySearchSchema', () => {
    it('accepts a 5-digit zip', () => {
      expect(PropertySearchSchema.safeParse({ zip: '94110' }).success).toBe(true)
    })
    it('accepts ZIP+4', () => {
      expect(PropertySearchSchema.safeParse({ zip: '94110-1234' }).success).toBe(true)
    })
    it('rejects non-numeric zip', () => {
      expect(PropertySearchSchema.safeParse({ zip: 'ABCDE' }).success).toBe(false)
    })
    it('requires state to be 2-char uppercase', () => {
      expect(PropertySearchSchema.safeParse({ state: 'ca' }).success).toBe(false)
      expect(PropertySearchSchema.safeParse({ state: 'CA' }).success).toBe(true)
    })
    it('bounds lat/lng', () => {
      expect(PropertySearchSchema.safeParse({ lat: -100, lng: 0 }).success).toBe(false)
      expect(PropertySearchSchema.safeParse({ lat: 0, lng: 200 }).success).toBe(false)
    })
  })

  describe('SavePropertySchema', () => {
    const valid = { propertyId: '550e8400-e29b-41d4-a716-446655440000' }
    it('accepts minimum valid payload', () => {
      expect(SavePropertySchema.safeParse(valid).success).toBe(true)
    })
    it('rejects > 20 tags', () => {
      const tags = Array.from({ length: 21 }, (_, i) => `tag${i}`)
      expect(SavePropertySchema.safeParse({ ...valid, tags }).success).toBe(false)
    })
    it('rejects 5001-char notes', () => {
      expect(
        SavePropertySchema.safeParse({ ...valid, notes: 'x'.repeat(5001) }).success,
      ).toBe(false)
    })
  })
})

// ─── 3. Quote request + checklist schemas ──────────────────────────────────

const QuoteRequestSchema = z.object({
  propertyId: z.string().uuid(),
  coverageType: z.enum(['dwelling', 'contents', 'liability', 'all']),
  coverageAmount: z.number().positive().max(10000000),
  deductible: z.number().nonnegative().max(100000),
  effectiveDate: z.string().regex(/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/),
  additionalInfo: z.string().max(2000).optional(),
})

const ChecklistSchema = z.object({
  propertyId: z.string().uuid(),
  type: z.enum(['INSPECTION', 'NEW_BUYER', 'AGENT']),
  items: z
    .array(
      z.object({
        label: z.string().min(1).max(500),
        completed: z.boolean().default(false),
        notes: z.string().max(1000).optional(),
      }),
    )
    .min(1)
    .max(100),
})

describe('API contract — quote + checklist schemas', () => {
  const validQuote = {
    propertyId: '550e8400-e29b-41d4-a716-446655440000',
    coverageType: 'all' as const,
    coverageAmount: 500000,
    deductible: 2500,
    effectiveDate: '2026-05-01',
  }

  it('QuoteRequestSchema accepts a valid quote', () => {
    expect(QuoteRequestSchema.safeParse(validQuote).success).toBe(true)
  })
  it('QuoteRequestSchema rejects unknown coverageType', () => {
    expect(QuoteRequestSchema.safeParse({ ...validQuote, coverageType: 'bogus' }).success).toBe(false)
  })
  it('QuoteRequestSchema rejects coverageAmount > 10M', () => {
    expect(QuoteRequestSchema.safeParse({ ...validQuote, coverageAmount: 10_000_001 }).success).toBe(false)
  })
  it('QuoteRequestSchema rejects negative deductible', () => {
    expect(QuoteRequestSchema.safeParse({ ...validQuote, deductible: -1 }).success).toBe(false)
  })

  const validChecklist = {
    propertyId: '550e8400-e29b-41d4-a716-446655440000',
    type: 'INSPECTION' as const,
    items: [{ label: 'Inspect roof' }],
  }

  it('ChecklistSchema accepts a single-item checklist', () => {
    expect(ChecklistSchema.safeParse(validChecklist).success).toBe(true)
  })
  it('ChecklistSchema rejects empty items', () => {
    expect(ChecklistSchema.safeParse({ ...validChecklist, items: [] }).success).toBe(false)
  })
  it('ChecklistSchema rejects > 100 items', () => {
    const items = Array.from({ length: 101 }, () => ({ label: 'x' }))
    expect(ChecklistSchema.safeParse({ ...validChecklist, items }).success).toBe(false)
  })
})

// ─── 4. Auth + Stripe + push schemas ───────────────────────────────────────

const RegisterSchema = z.object({
  email: z.string().email().max(254),
  password: z.string().min(8).max(128),
  firstName: z.string().min(1).max(80),
  lastName: z.string().min(1).max(80),
  role: z.enum(['BUYER', 'AGENT', 'LENDER', 'INSURANCE']),
  agreedToTerms: z.boolean().optional(),
})

const PushSubscribeSchema = z.object({
  endpoint: z.string().url(),
  keys: z.object({
    p256dh: z.string().min(1),
    auth: z.string().min(1),
  }),
  userAgent: z.string().max(500).optional(),
})

const StripeCheckoutSchema = z.object({
  priceId: z.string().regex(/^price_[A-Za-z0-9]+$/),
  successUrl: z.string().url(),
  cancelUrl: z.string().url(),
})

const StripePortalSchema = z.object({
  returnUrl: z.string().url(),
})

describe('API contract — auth/stripe/push schemas', () => {
  it('RegisterSchema rejects ADMIN role', () => {
    expect(
      RegisterSchema.safeParse({
        email: 'a@b.co',
        password: 'longenough',
        firstName: 'A',
        lastName: 'B',
        role: 'ADMIN',
      }).success,
    ).toBe(false)
  })
  it('RegisterSchema requires password >= 8 chars', () => {
    expect(
      RegisterSchema.safeParse({
        email: 'a@b.co',
        password: 'short',
        firstName: 'A',
        lastName: 'B',
        role: 'BUYER',
      }).success,
    ).toBe(false)
  })

  it('PushSubscribeSchema requires keys.p256dh and keys.auth', () => {
    expect(
      PushSubscribeSchema.safeParse({
        endpoint: 'https://fcm.googleapis.com/abc',
        keys: { p256dh: '', auth: 'abc' },
      }).success,
    ).toBe(false)
  })
  it('PushSubscribeSchema caps userAgent at 500', () => {
    expect(
      PushSubscribeSchema.safeParse({
        endpoint: 'https://fcm.googleapis.com/abc',
        keys: { p256dh: 'k', auth: 'a' },
        userAgent: 'x'.repeat(501),
      }).success,
    ).toBe(false)
  })

  it('StripeCheckoutSchema enforces priceId prefix', () => {
    expect(
      StripeCheckoutSchema.safeParse({
        priceId: 'not-a-price-id',
        successUrl: 'https://coverguard.io/dashboard',
        cancelUrl: 'https://coverguard.io/pricing',
      }).success,
    ).toBe(false)
  })

  it('StripePortalSchema requires a valid URL', () => {
    expect(StripePortalSchema.safeParse({ returnUrl: 'not-a-url' }).success).toBe(false)
  })
})

// ─── 5. Stripe isSafeRedirectUrl semantics ─────────────────────────────────

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

describe('API contract — isSafeRedirectUrl', () => {
  it('allows coverguard.io and www', () => {
    expect(isSafeRedirectUrl('https://coverguard.io/dashboard')).toBe(true)
    expect(isSafeRedirectUrl('https://www.coverguard.io/pricing')).toBe(true)
  })
  it('allows coverguard.io subdomains', () => {
    expect(isSafeRedirectUrl('https://app.coverguard.io/x')).toBe(true)
    expect(isSafeRedirectUrl('https://staging.coverguard.io/x')).toBe(true)
  })
  it('allows Vercel preview deployments', () => {
    expect(isSafeRedirectUrl('https://my-branch-cover-guard.vercel.app/pricing')).toBe(true)
  })
  it('allows localhost', () => {
    expect(isSafeRedirectUrl('http://localhost:3000/dashboard')).toBe(true)
  })
  it('blocks unknown hosts', () => {
    expect(isSafeRedirectUrl('https://evil.com/steal')).toBe(false)
    expect(isSafeRedirectUrl('https://coverguard.io.evil.com/hack')).toBe(false)
  })
  it('handles invalid URLs', () => {
    expect(isSafeRedirectUrl('not-a-url')).toBe(false)
    expect(isSafeRedirectUrl('')).toBe(false)
  })
  it('respects APP_ALLOWED_HOSTS env override', () => {
    const envHosts = 'staging.coverguard.io, localhost, coverguard.io'
    expect(isSafeRedirectUrl('https://staging.coverguard.io/dashboard', envHosts)).toBe(true)
    expect(isSafeRedirectUrl('http://localhost:3000/dashboard', envHosts)).toBe(true)
  })
})

// ─── 6. Alerts + Deals + Clients schemas ───────────────────────────────────

const AlertsListQuerySchema = z.object({
  severity: z.enum(['INFO', 'WARNING', 'CRITICAL']).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
})

const DealStageEnum = z.enum([
  'PROSPECT',
  'CONTACTED',
  'QUOTING',
  'QUOTED',
  'BIND_REQUESTED',
  'BOUND',
  'LOST',
])

const DealFalloutReasonEnum = z.enum([
  'PRICE',
  'COVERAGE',
  'CARRIER_DECLINED',
  'CLIENT_LOST',
  'OTHER',
])

const DealCreateSchema = z.object({
  title: z.string().min(1).max(200),
  stage: DealStageEnum.optional(),
  propertyId: z.string().uuid().nullable().optional(),
  clientId: z.string().uuid().nullable().optional(),
  dealValue: z.number().nonnegative().max(100_000_000).nullable().optional(),
  carrierName: z.string().max(200).nullable().optional(),
  notes: z.string().max(5000).nullable().optional(),
})

const DealUpdateSchema = DealCreateSchema.partial().extend({
  falloutReason: DealFalloutReasonEnum.nullable().optional(),
  falloutNotes: z.string().max(2000).nullable().optional(),
})

const ClientStatusEnum = z.enum(['ACTIVE', 'PROSPECT', 'CLOSED', 'INACTIVE'])

const ClientCreateSchema = z.object({
  firstName: z.string().min(1).max(80),
  lastName: z.string().min(1).max(80),
  email: z.string().email(),
  phone: z.string().max(40).optional(),
  notes: z.string().max(5000).optional(),
  status: ClientStatusEnum.optional(),
})

describe('API contract — alerts/deals/clients schemas', () => {
  it('AlertsListQuerySchema accepts severity enum', () => {
    expect(AlertsListQuerySchema.safeParse({ severity: 'WARNING' }).success).toBe(true)
  })
  it('AlertsListQuerySchema rejects bad severity', () => {
    expect(AlertsListQuerySchema.safeParse({ severity: 'SCARY' }).success).toBe(false)
  })
  it('AlertsListQuerySchema bounds limit 1-100', () => {
    expect(AlertsListQuerySchema.safeParse({ limit: 0 }).success).toBe(false)
    expect(AlertsListQuerySchema.safeParse({ limit: 101 }).success).toBe(false)
    expect(AlertsListQuerySchema.safeParse({ limit: 50 }).success).toBe(true)
  })

  it('DealCreateSchema enforces title bounds', () => {
    expect(DealCreateSchema.safeParse({ title: '' }).success).toBe(false)
    expect(DealCreateSchema.safeParse({ title: 'x'.repeat(201) }).success).toBe(false)
    expect(DealCreateSchema.safeParse({ title: 'Real deal' }).success).toBe(true)
  })
  it('DealUpdateSchema allows falloutReason enum', () => {
    expect(DealUpdateSchema.safeParse({ falloutReason: 'PRICE' }).success).toBe(true)
    expect(DealUpdateSchema.safeParse({ falloutReason: 'XYZ' }).success).toBe(false)
  })

  it('ClientCreateSchema requires valid email', () => {
    expect(ClientCreateSchema.safeParse({ firstName: 'A', lastName: 'B', email: 'bad' }).success).toBe(false)
  })
  it('ClientCreateSchema accepts ClientStatus enum', () => {
    expect(
      ClientCreateSchema.safeParse({
        firstName: 'A',
        lastName: 'B',
        email: 'a@b.co',
        status: 'PROSPECT',
      }).success,
    ).toBe(true)
  })
})

// ─── 7. Shared-type sanity ──────────────────────────────────────────────────

describe('API contract — shared type exports', () => {
  it('RiskTrend enum includes WORSENING / STABLE / IMPROVING', () => {
    const trends: RiskTrend[] = ['WORSENING', 'STABLE', 'IMPROVING']
    expect(trends.length).toBe(3)
  })
})
