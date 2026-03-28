/**
 * Stripe route tests
 *
 * Tests the stripeRouter (/subscription, /checkout, /portal) and
 * stripeWebhookRouter (/webhook) endpoints covering:
 *  - Authentication enforcement (401 without token)
 *  - Subscription status with required flag and active state
 *  - Checkout session creation with URL validation
 *  - Portal session creation with URL validation
 *  - Webhook signature verification and event dispatch
 *  - Graceful error handling in webhook (200 on handler failure)
 *  - Missing STRIPE_WEBHOOK_SECRET handling
 */

jest.mock('../../utils/logger', () => ({
  logger: {
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
    debug: jest.fn(),
  },
}))

jest.mock('../../utils/supabaseAdmin', () => ({
  supabaseAdmin: { auth: { getUser: jest.fn() } },
}))

jest.mock('../../utils/cache', () => {
  const { LRUCache, RequestDeduplicator } = jest.requireActual('../../utils/cache')
  return {
    LRUCache,
    RequestDeduplicator,
    tokenCache: new LRUCache(100, 60_000),
    propertyCache: new LRUCache(100, 60_000),
    riskCache: new LRUCache(100, 60_000),
    insurabilityCache: new LRUCache(100, 60_000),
    insuranceCache: new LRUCache(100, 60_000),
    carriersCache: new LRUCache(100, 60_000),
    riskDeduplicator: new RequestDeduplicator(),
    insurabilityDeduplicator: new RequestDeduplicator(),
    insuranceDeduplicator: new RequestDeduplicator(),
    carriersDeduplicator: new RequestDeduplicator(),
  }
})

jest.mock('../../utils/prisma', () => ({
  prisma: {
    subscription: { findFirst: jest.fn() },
    user: { findUnique: jest.fn() },
  },
}))

jest.mock('../../services/stripeService', () => ({
  stripe: {
    webhooks: { constructEvent: jest.fn() },
  },
  createCheckoutSession: jest.fn(),
  createPortalSession: jest.fn(),
  handleSubscriptionCreatedOrUpdated: jest.fn(),
  handleSubscriptionDeleted: jest.fn(),
  hasActiveSubscription: jest.fn().mockResolvedValue(true),
}))

jest.mock('../../utils/featureFlags', () => ({
  featureFlags: { stripeSubscriptionRequired: false },
}))

import express from 'express'
import request from 'supertest'
import { stripeRouter, stripeWebhookRouter } from '../../routes/stripe'
import { errorHandler } from '../../middleware/errorHandler'
import { supabaseAdmin } from '../../utils/supabaseAdmin'
import { prisma } from '../../utils/prisma'
import { featureFlags } from '../../utils/featureFlags'
import {
  stripe,
  createCheckoutSession,
  createPortalSession,
  handleSubscriptionCreatedOrUpdated,
  handleSubscriptionDeleted,
} from '../../services/stripeService'

// ─── App setup ──────────────────────────────────────────────────────────────

const app = express()
app.use(express.json())
app.use('/stripe', stripeRouter)
app.use(errorHandler)

const webhookApp = express()
webhookApp.use('/stripe', stripeWebhookRouter)
webhookApp.use(errorHandler)

// ─── Helpers ────────────────────────────────────────────────────────────────

const TOKEN = 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ1c2VyLTEiLCJleHAiOjk5OTk5OTk5OTl9.sig'

function mockAuth(userId = 'user-1') {
  ;(supabaseAdmin.auth.getUser as jest.Mock).mockResolvedValue({
    data: { user: { id: userId, role: 'authenticated' } },
    error: null,
  })
  ;(prisma.user.findUnique as jest.Mock).mockResolvedValue({
    id: userId,
    role: 'CONSUMER',
  })
}

// ─── Cleanup ────────────────────────────────────────────────────────────────

beforeEach(() => {
  jest.clearAllMocks()
})

const originalWebhookSecret = process.env.STRIPE_WEBHOOK_SECRET

afterEach(() => {
  if (originalWebhookSecret !== undefined) {
    process.env.STRIPE_WEBHOOK_SECRET = originalWebhookSecret
  } else {
    delete process.env.STRIPE_WEBHOOK_SECRET
  }
})

// ─── GET /subscription ─────────────────────────────────────────────────────

describe('GET /stripe/subscription', () => {
  it('returns 401 without auth', async () => {
    const res = await request(app).get('/stripe/subscription')
    expect(res.status).toBe(401)
    expect(res.body.success).toBe(false)
  })

  it('returns subscription status with required flag', async () => {
    mockAuth()
    ;(prisma.subscription.findFirst as jest.Mock).mockResolvedValue(null)
    ;(featureFlags as { stripeSubscriptionRequired: boolean }).stripeSubscriptionRequired = true

    const res = await request(app)
      .get('/stripe/subscription')
      .set('Authorization', `Bearer ${TOKEN}`)

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(res.body.data.required).toBe(true)
    expect(res.body.data.active).toBe(false)
    expect(res.body.data.subscription).toBeNull()

    // Reset
    ;(featureFlags as { stripeSubscriptionRequired: boolean }).stripeSubscriptionRequired = false
  })

  it('returns active=true when subscription is ACTIVE', async () => {
    mockAuth()
    const mockSub = {
      id: 'sub-1',
      userId: 'user-1',
      status: 'ACTIVE',
      plan: 'PROFESSIONAL',
      createdAt: new Date(),
    }
    ;(prisma.subscription.findFirst as jest.Mock).mockResolvedValue(mockSub)

    const res = await request(app)
      .get('/stripe/subscription')
      .set('Authorization', `Bearer ${TOKEN}`)

    expect(res.status).toBe(200)
    expect(res.body.data.active).toBe(true)
    expect(res.body.data.subscription).toBeDefined()
  })

  it('returns active=false when no active subscription', async () => {
    mockAuth()
    ;(prisma.subscription.findFirst as jest.Mock).mockResolvedValue(null)

    const res = await request(app)
      .get('/stripe/subscription')
      .set('Authorization', `Bearer ${TOKEN}`)

    expect(res.status).toBe(200)
    expect(res.body.data.active).toBe(false)
    expect(res.body.data.subscription).toBeNull()
  })
})

// ─── POST /checkout ─────────────────────────────────────────────────────────

describe('POST /stripe/checkout', () => {
  const validBody = {
    priceId: 'price_123',
    successUrl: 'http://localhost:3000/dashboard?success=true',
    cancelUrl: 'http://localhost:3000/dashboard?canceled=true',
  }

  it('creates checkout session with valid body', async () => {
    mockAuth()
    ;(createCheckoutSession as jest.Mock).mockResolvedValue('https://checkout.stripe.com/session-1')

    const res = await request(app)
      .post('/stripe/checkout')
      .set('Authorization', `Bearer ${TOKEN}`)
      .send(validBody)

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(res.body.data.url).toBe('https://checkout.stripe.com/session-1')
    expect(createCheckoutSession).toHaveBeenCalledWith(
      'user-1',
      'price_123',
      validBody.successUrl,
      validBody.cancelUrl,
    )
  })

  it('returns validation error for missing priceId', async () => {
    mockAuth()

    const res = await request(app)
      .post('/stripe/checkout')
      .set('Authorization', `Bearer ${TOKEN}`)
      .send({
        successUrl: 'http://localhost:3000/dashboard',
        cancelUrl: 'http://localhost:3000/dashboard',
      })

    expect(res.status).toBe(400)
    expect(res.body.success).toBe(false)
    expect(res.body.error.code).toBe('VALIDATION_ERROR')
  })

  it('rejects unsafe redirect URLs', async () => {
    mockAuth()

    const res = await request(app)
      .post('/stripe/checkout')
      .set('Authorization', `Bearer ${TOKEN}`)
      .send({
        priceId: 'price_123',
        successUrl: 'https://evil.com/steal',
        cancelUrl: 'https://evil.com/steal',
      })

    expect(res.status).toBe(400)
    expect(res.body.success).toBe(false)
    expect(res.body.error.code).toBe('VALIDATION_ERROR')
  })

  it('accepts localhost URLs', async () => {
    mockAuth()
    ;(createCheckoutSession as jest.Mock).mockResolvedValue('https://checkout.stripe.com/s')

    const res = await request(app)
      .post('/stripe/checkout')
      .set('Authorization', `Bearer ${TOKEN}`)
      .send({
        priceId: 'price_123',
        successUrl: 'http://localhost:3000/success',
        cancelUrl: 'http://localhost:3000/cancel',
      })

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
  })

  it('accepts coverguard.io URLs', async () => {
    mockAuth()
    ;(createCheckoutSession as jest.Mock).mockResolvedValue('https://checkout.stripe.com/s')

    const res = await request(app)
      .post('/stripe/checkout')
      .set('Authorization', `Bearer ${TOKEN}`)
      .send({
        priceId: 'price_123',
        successUrl: 'https://coverguard.io/dashboard?success=true',
        cancelUrl: 'https://www.coverguard.io/dashboard?canceled=true',
      })

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
  })

  it('accepts Vercel preview URLs', async () => {
    mockAuth()
    ;(createCheckoutSession as jest.Mock).mockResolvedValue('https://checkout.stripe.com/s')

    const res = await request(app)
      .post('/stripe/checkout')
      .set('Authorization', `Bearer ${TOKEN}`)
      .send({
        priceId: 'price_123',
        successUrl: 'https://my-branch-cover-guard.vercel.app/dashboard',
        cancelUrl: 'https://my-branch-cover-guard.vercel.app/dashboard',
      })

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
  })
})

// ─── POST /portal ───────────────────────────────────────────────────────────

describe('POST /stripe/portal', () => {
  it('creates portal session with valid body', async () => {
    mockAuth()
    ;(createPortalSession as jest.Mock).mockResolvedValue('https://billing.stripe.com/portal-1')

    const res = await request(app)
      .post('/stripe/portal')
      .set('Authorization', `Bearer ${TOKEN}`)
      .send({ returnUrl: 'http://localhost:3000/account' })

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(res.body.data.url).toBe('https://billing.stripe.com/portal-1')
    expect(createPortalSession).toHaveBeenCalledWith('user-1', 'http://localhost:3000/account')
  })

  it('rejects unsafe return URL', async () => {
    mockAuth()

    const res = await request(app)
      .post('/stripe/portal')
      .set('Authorization', `Bearer ${TOKEN}`)
      .send({ returnUrl: 'https://evil.com/phish' })

    expect(res.status).toBe(400)
    expect(res.body.success).toBe(false)
    expect(res.body.error.code).toBe('VALIDATION_ERROR')
  })
})

// ─── POST /webhook ──────────────────────────────────────────────────────────

describe('POST /stripe/webhook', () => {
  const WEBHOOK_SECRET = 'whsec_test_secret'

  function makeEvent(type: string, data: Record<string, unknown> = {}) {
    return {
      id: 'evt_test',
      type,
      data: { object: data },
    }
  }

  beforeEach(() => {
    process.env.STRIPE_WEBHOOK_SECRET = WEBHOOK_SECRET
  })

  it('returns 400 when stripe-signature header is missing', async () => {
    const res = await request(webhookApp)
      .post('/stripe/webhook')
      .set('Content-Type', 'application/json')
      .send('{}')

    expect(res.status).toBe(400)
    expect(res.body.error.message).toBe('Missing stripe-signature header')
  })

  it('returns 400 when signature verification fails', async () => {
    ;(stripe.webhooks.constructEvent as jest.Mock).mockImplementation(() => {
      throw new Error('Invalid signature')
    })

    const res = await request(webhookApp)
      .post('/stripe/webhook')
      .set('Content-Type', 'application/json')
      .set('stripe-signature', 'bad_sig')
      .send('{}')

    expect(res.status).toBe(400)
    expect(res.body.error.message).toBe('Invalid signature')
  })

  it('processes customer.subscription.created event', async () => {
    const subObj = { id: 'sub_123', customer: 'cus_123', status: 'active' }
    const event = makeEvent('customer.subscription.created', subObj)
    ;(stripe.webhooks.constructEvent as jest.Mock).mockReturnValue(event)
    ;(handleSubscriptionCreatedOrUpdated as jest.Mock).mockResolvedValue(undefined)

    const res = await request(webhookApp)
      .post('/stripe/webhook')
      .set('Content-Type', 'application/json')
      .set('stripe-signature', 'valid_sig')
      .send(JSON.stringify(event))

    expect(res.status).toBe(200)
    expect(res.body.received).toBe(true)
    expect(handleSubscriptionCreatedOrUpdated).toHaveBeenCalledWith(subObj)
  })

  it('processes customer.subscription.deleted event', async () => {
    const subObj = { id: 'sub_123', customer: 'cus_123', status: 'canceled' }
    const event = makeEvent('customer.subscription.deleted', subObj)
    ;(stripe.webhooks.constructEvent as jest.Mock).mockReturnValue(event)
    ;(handleSubscriptionDeleted as jest.Mock).mockResolvedValue(undefined)

    const res = await request(webhookApp)
      .post('/stripe/webhook')
      .set('Content-Type', 'application/json')
      .set('stripe-signature', 'valid_sig')
      .send(JSON.stringify(event))

    expect(res.status).toBe(200)
    expect(res.body.received).toBe(true)
    expect(handleSubscriptionDeleted).toHaveBeenCalledWith(subObj)
  })

  it('returns 200 even when handler throws (prevents Stripe retries)', async () => {
    const subObj = { id: 'sub_123', customer: 'cus_123' }
    const event = makeEvent('customer.subscription.created', subObj)
    ;(stripe.webhooks.constructEvent as jest.Mock).mockReturnValue(event)
    ;(handleSubscriptionCreatedOrUpdated as jest.Mock).mockRejectedValue(
      new Error('DB write failed'),
    )

    const res = await request(webhookApp)
      .post('/stripe/webhook')
      .set('Content-Type', 'application/json')
      .set('stripe-signature', 'valid_sig')
      .send(JSON.stringify(event))

    expect(res.status).toBe(200)
    expect(res.body.received).toBe(true)
    expect(res.body.error).toBe(true)
  })

  it('returns 500 when STRIPE_WEBHOOK_SECRET is not configured', async () => {
    delete process.env.STRIPE_WEBHOOK_SECRET

    const res = await request(webhookApp)
      .post('/stripe/webhook')
      .set('Content-Type', 'application/json')
      .set('stripe-signature', 'some_sig')
      .send('{}')

    expect(res.status).toBe(500)
    expect(res.body.error.message).toBe('Webhook secret not configured')
  })
})
