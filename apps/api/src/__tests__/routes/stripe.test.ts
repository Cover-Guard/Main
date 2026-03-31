/**
 * Stripe route tests
 *
 * Tests the Stripe router covering:
 *  - GET /subscription — returns subscription status and required flag
 *  - POST /checkout — creates checkout session with URL validation
 *  - POST /portal — creates portal session with URL validation
 *  - POST /webhook — signature verification, event dispatch, error handling
 */

jest.mock('../../utils/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}))

jest.mock('../../utils/prisma', () => ({
  prisma: {
    subscription: {
      findFirst: jest.fn(),
    },
  },
}))

jest.mock('../../middleware/auth', () => ({
  requireAuth: (req: unknown, _res: unknown, next: () => void) => {
    ;(req as Record<string, unknown>).userId = 'user-1'
    next()
  },
}))

jest.mock('../../utils/featureFlags', () => ({
  featureFlags: {
    stripeSubscriptionRequired: false,
  },
}))

jest.mock('../../services/stripeService', () => ({
  stripe: {
    webhooks: {
      constructEvent: jest.fn(),
    },
  },
  createCheckoutSession: jest.fn(),
  createPortalSession: jest.fn(),
  handleSubscriptionCreatedOrUpdated: jest.fn(),
  handleSubscriptionDeleted: jest.fn(),
}))

import express from 'express'
import request from 'supertest'
import { stripeRouter, stripeWebhookRouter } from '../../routes/stripe'
import { errorHandler } from '../../middleware/errorHandler'
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
app.use('/api/stripe', stripeRouter)
app.use(errorHandler)

const webhookApp = express()
webhookApp.use('/api/stripe', stripeWebhookRouter)
webhookApp.use(errorHandler)

// ─── Helpers ────────────────────────────────────────────────────────────────

const mockPrisma = prisma as unknown as {
  subscription: { findFirst: jest.Mock }
}
const mockStripe = stripe as unknown as {
  webhooks: { constructEvent: jest.Mock }
}
const mockCreateCheckoutSession = createCheckoutSession as jest.Mock
const mockCreatePortalSession = createPortalSession as jest.Mock
const mockHandleCreatedOrUpdated = handleSubscriptionCreatedOrUpdated as jest.Mock
const mockHandleDeleted = handleSubscriptionDeleted as jest.Mock
const mockFeatureFlags = featureFlags as { stripeSubscriptionRequired: boolean }

beforeEach(() => {
  jest.clearAllMocks()
})

// ─── GET /subscription ─────────────────────────────────────────────────────

describe('GET /api/stripe/subscription', () => {
  it('returns subscription status when active subscription exists', async () => {
    const sub = {
      id: 'sub-1',
      plan: 'PROFESSIONAL',
      status: 'ACTIVE',
      stripePriceId: 'price_123',
      currentPeriodStart: new Date('2026-01-01'),
      currentPeriodEnd: new Date('2026-02-01'),
      cancelAtPeriodEnd: false,
      createdAt: new Date('2026-01-01'),
    }
    mockPrisma.subscription.findFirst.mockResolvedValue(sub)

    const res = await request(app).get('/api/stripe/subscription')

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(res.body.data.active).toBe(true)
    expect(res.body.data.subscription).toMatchObject({ id: 'sub-1', plan: 'PROFESSIONAL', status: 'ACTIVE' })
  })

  it('returns null subscription when none found', async () => {
    mockPrisma.subscription.findFirst.mockResolvedValue(null)

    const res = await request(app).get('/api/stripe/subscription')

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(res.body.data.active).toBe(false)
    expect(res.body.data.subscription).toBeNull()
  })

  it('returns required flag from feature flags', async () => {
    mockPrisma.subscription.findFirst.mockResolvedValue(null)
    mockFeatureFlags.stripeSubscriptionRequired = true

    const res = await request(app).get('/api/stripe/subscription')

    expect(res.status).toBe(200)
    expect(res.body.data.required).toBe(true)

    // Reset
    mockFeatureFlags.stripeSubscriptionRequired = false
  })
})

// ─── POST /checkout ────────────────────────────────────────────────────────

describe('POST /api/stripe/checkout', () => {
  it('creates checkout session with valid URLs', async () => {
    mockCreateCheckoutSession.mockResolvedValue('https://checkout.stripe.com/session-1')

    const res = await request(app)
      .post('/api/stripe/checkout')
      .send({
        priceId: 'price_123',
        successUrl: 'http://localhost:3000/success',
        cancelUrl: 'http://localhost:3000/cancel',
      })

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(res.body.data.url).toBe('https://checkout.stripe.com/session-1')
    expect(mockCreateCheckoutSession).toHaveBeenCalledWith(
      'user-1',
      'price_123',
      'http://localhost:3000/success',
      'http://localhost:3000/cancel',
    )
  })

  it('rejects invalid redirect URLs', async () => {
    const res = await request(app)
      .post('/api/stripe/checkout')
      .send({
        priceId: 'price_123',
        successUrl: 'http://evil.com/callback',
        cancelUrl: 'http://localhost:3000/cancel',
      })

    expect(res.status).toBe(400)
    expect(res.body.success).toBe(false)
  })

  it('rejects missing priceId', async () => {
    const res = await request(app)
      .post('/api/stripe/checkout')
      .send({
        successUrl: 'http://localhost:3000/success',
        cancelUrl: 'http://localhost:3000/cancel',
      })

    expect(res.status).toBe(400)
    expect(res.body.success).toBe(false)
  })
})

// ─── POST /portal ──────────────────────────────────────────────────────────

describe('POST /api/stripe/portal', () => {
  it('creates portal session with valid returnUrl', async () => {
    mockCreatePortalSession.mockResolvedValue('https://billing.stripe.com/portal-1')

    const res = await request(app)
      .post('/api/stripe/portal')
      .send({ returnUrl: 'http://localhost:3000/account' })

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(res.body.data.url).toBe('https://billing.stripe.com/portal-1')
    expect(mockCreatePortalSession).toHaveBeenCalledWith('user-1', 'http://localhost:3000/account')
  })

  it('rejects unsafe returnUrl', async () => {
    const res = await request(app)
      .post('/api/stripe/portal')
      .send({ returnUrl: 'http://evil.com/callback' })

    expect(res.status).toBe(400)
    expect(res.body.success).toBe(false)
  })
})

// ─── POST /webhook ─────────────────────────────────────────────────────────

describe('POST /api/stripe/webhook', () => {
  const originalEnv = process.env.STRIPE_WEBHOOK_SECRET

  beforeEach(() => {
    process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test_secret'
  })

  afterEach(() => {
    if (originalEnv !== undefined) {
      process.env.STRIPE_WEBHOOK_SECRET = originalEnv
    } else {
      delete process.env.STRIPE_WEBHOOK_SECRET
    }
  })

  it('returns 400 when stripe-signature header is missing', async () => {
    const res = await request(webhookApp)
      .post('/api/stripe/webhook')
      .set('Content-Type', 'application/json')
      .send(Buffer.from('{}'))

    expect(res.status).toBe(400)
    expect(res.body.error.message).toBe('Missing stripe-signature header')
  })

  it('returns 500 when STRIPE_WEBHOOK_SECRET is not configured', async () => {
    delete process.env.STRIPE_WEBHOOK_SECRET

    const res = await request(webhookApp)
      .post('/api/stripe/webhook')
      .set('Content-Type', 'application/json')
      .set('stripe-signature', 'sig_test')
      .send(Buffer.from('{}'))

    expect(res.status).toBe(500)
    expect(res.body.error.message).toBe('Webhook secret not configured')
  })

  it('returns 400 when signature is invalid (constructEvent throws)', async () => {
    mockStripe.webhooks.constructEvent.mockImplementation(() => {
      throw new Error('Invalid signature')
    })

    const res = await request(webhookApp)
      .post('/api/stripe/webhook')
      .set('Content-Type', 'application/json')
      .set('stripe-signature', 'sig_bad')
      .send(Buffer.from('{}'))

    expect(res.status).toBe(400)
    expect(res.body.error.message).toBe('Invalid signature')
  })

  it('handles customer.subscription.created event', async () => {
    const subscriptionObj = { id: 'sub_123', customer: 'cus_1' }
    mockStripe.webhooks.constructEvent.mockReturnValue({
      type: 'customer.subscription.created',
      id: 'evt_1',
      data: { object: subscriptionObj },
    })
    mockHandleCreatedOrUpdated.mockResolvedValue(undefined)

    const res = await request(webhookApp)
      .post('/api/stripe/webhook')
      .set('Content-Type', 'application/json')
      .set('stripe-signature', 'sig_valid')
      .send(Buffer.from(JSON.stringify({ type: 'customer.subscription.created' })))

    expect(res.status).toBe(200)
    expect(res.body).toEqual({ received: true })
    expect(mockHandleCreatedOrUpdated).toHaveBeenCalledWith(subscriptionObj)
  })

  it('handles customer.subscription.deleted event', async () => {
    const subscriptionObj = { id: 'sub_456', customer: 'cus_2' }
    mockStripe.webhooks.constructEvent.mockReturnValue({
      type: 'customer.subscription.deleted',
      id: 'evt_2',
      data: { object: subscriptionObj },
    })
    mockHandleDeleted.mockResolvedValue(undefined)

    const res = await request(webhookApp)
      .post('/api/stripe/webhook')
      .set('Content-Type', 'application/json')
      .set('stripe-signature', 'sig_valid')
      .send(Buffer.from(JSON.stringify({ type: 'customer.subscription.deleted' })))

    expect(res.status).toBe(200)
    expect(res.body).toEqual({ received: true })
    expect(mockHandleDeleted).toHaveBeenCalledWith(subscriptionObj)
  })

  it('returns { received: true } for unhandled event types', async () => {
    mockStripe.webhooks.constructEvent.mockReturnValue({
      type: 'invoice.paid',
      id: 'evt_3',
      data: { object: {} },
    })

    const res = await request(webhookApp)
      .post('/api/stripe/webhook')
      .set('Content-Type', 'application/json')
      .set('stripe-signature', 'sig_valid')
      .send(Buffer.from(JSON.stringify({ type: 'invoice.paid' })))

    expect(res.status).toBe(200)
    expect(res.body).toEqual({ received: true })
    expect(mockHandleCreatedOrUpdated).not.toHaveBeenCalled()
    expect(mockHandleDeleted).not.toHaveBeenCalled()
  })

  it('returns { received: true, error: true } when handler throws (200 status)', async () => {
    mockStripe.webhooks.constructEvent.mockReturnValue({
      type: 'customer.subscription.updated',
      id: 'evt_4',
      data: { object: { id: 'sub_err' } },
    })
    mockHandleCreatedOrUpdated.mockRejectedValue(new Error('DB write failed'))

    const res = await request(webhookApp)
      .post('/api/stripe/webhook')
      .set('Content-Type', 'application/json')
      .set('stripe-signature', 'sig_valid')
      .send(Buffer.from(JSON.stringify({ type: 'customer.subscription.updated' })))

    expect(res.status).toBe(200)
    expect(res.body).toEqual({ received: true, error: true })
  })
})
