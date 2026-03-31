/**
 * stripeService tests
 *
 * Tests all exported functions:
 *  - getOrCreateStripeCustomer (including race condition handling)
 *  - createCheckoutSession
 *  - createPortalSession
 *  - hasActiveSubscription
 *  - handleSubscriptionCreatedOrUpdated
 *  - handleSubscriptionDeleted
 */

jest.mock('../../utils/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), http: jest.fn() },
}))

jest.mock('../../utils/prisma', () => ({
  prisma: {
    user: { findUniqueOrThrow: jest.fn(), findUnique: jest.fn(), updateMany: jest.fn(), update: jest.fn() },
    subscription: { findFirst: jest.fn(), upsert: jest.fn(), updateMany: jest.fn() },
  },
}))

// Mock Stripe constructor
const mockStripe = {
  customers: { create: jest.fn(), del: jest.fn() },
  checkout: { sessions: { create: jest.fn() } },
  billingPortal: { sessions: { create: jest.fn() } },
  webhooks: { constructEvent: jest.fn() },
}
jest.mock('stripe', () => {
  return jest.fn().mockImplementation(() => mockStripe)
})

// Set env before importing the service
process.env.STRIPE_SECRET_KEY = 'sk_test_123'

import {
  getOrCreateStripeCustomer,
  createCheckoutSession,
  createPortalSession,
  hasActiveSubscription,
  handleSubscriptionCreatedOrUpdated,
  handleSubscriptionDeleted,
} from '../../services/stripeService'
import { prisma } from '../../utils/prisma'
import { logger } from '../../utils/logger'
import type Stripe from 'stripe'

const mockPrisma = prisma as jest.Mocked<typeof prisma>

beforeEach(() => {
  jest.clearAllMocks()
})

// ─── getOrCreateStripeCustomer ──────────────────────────────────────────────

describe('getOrCreateStripeCustomer', () => {
  it('returns existing stripeCustomerId from DB', async () => {
    ;(mockPrisma.user.findUniqueOrThrow as jest.Mock).mockResolvedValue({
      id: 'user-1',
      email: 'test@example.com',
      stripeCustomerId: 'cus_existing',
      firstName: 'Jane',
      lastName: 'Doe',
    })

    const result = await getOrCreateStripeCustomer('user-1')

    expect(result).toBe('cus_existing')
    expect(mockStripe.customers.create).not.toHaveBeenCalled()
  })

  it('creates new Stripe customer when stripeCustomerId is null', async () => {
    ;(mockPrisma.user.findUniqueOrThrow as jest.Mock).mockResolvedValue({
      id: 'user-2',
      email: 'new@example.com',
      stripeCustomerId: null,
      firstName: 'John',
      lastName: 'Smith',
    })
    mockStripe.customers.create.mockResolvedValue({ id: 'cus_new' })
    ;(mockPrisma.user.updateMany as jest.Mock).mockResolvedValue({ count: 1 })

    const result = await getOrCreateStripeCustomer('user-2')

    expect(result).toBe('cus_new')
    expect(mockStripe.customers.create).toHaveBeenCalledWith({
      email: 'new@example.com',
      name: 'John Smith',
      metadata: { userId: 'user-2' },
    })
    expect(mockPrisma.user.updateMany).toHaveBeenCalledWith({
      where: { id: 'user-2', stripeCustomerId: null },
      data: { stripeCustomerId: 'cus_new' },
    })
  })

  it('handles race condition when another request already set stripeCustomerId', async () => {
    ;(mockPrisma.user.findUniqueOrThrow as jest.Mock)
      .mockResolvedValueOnce({
        id: 'user-3',
        email: 'race@example.com',
        stripeCustomerId: null,
        firstName: null,
        lastName: null,
      })
      .mockResolvedValueOnce({
        stripeCustomerId: 'cus_winner',
      })
    mockStripe.customers.create.mockResolvedValue({ id: 'cus_loser' })
    ;(mockPrisma.user.updateMany as jest.Mock).mockResolvedValue({ count: 0 })
    mockStripe.customers.del.mockResolvedValue({ id: 'cus_loser', deleted: true })

    const result = await getOrCreateStripeCustomer('user-3')

    expect(result).toBe('cus_winner')
    expect(mockStripe.customers.del).toHaveBeenCalledWith('cus_loser')
  })

  it('cleans up duplicate Stripe customer on race and logs warning on delete failure', async () => {
    ;(mockPrisma.user.findUniqueOrThrow as jest.Mock)
      .mockResolvedValueOnce({
        id: 'user-4',
        email: 'race2@example.com',
        stripeCustomerId: null,
        firstName: 'A',
        lastName: 'B',
      })
      .mockResolvedValueOnce({
        stripeCustomerId: 'cus_winner2',
      })
    mockStripe.customers.create.mockResolvedValue({ id: 'cus_duplicate' })
    ;(mockPrisma.user.updateMany as jest.Mock).mockResolvedValue({ count: 0 })
    mockStripe.customers.del.mockRejectedValue(new Error('Stripe delete failed'))

    const result = await getOrCreateStripeCustomer('user-4')

    expect(result).toBe('cus_winner2')
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('Failed to clean up duplicate Stripe customer cus_duplicate'),
    )
  })

  it('throws if stripeCustomerId still null after concurrent update', async () => {
    ;(mockPrisma.user.findUniqueOrThrow as jest.Mock)
      .mockResolvedValueOnce({
        id: 'user-5',
        email: 'null@example.com',
        stripeCustomerId: null,
        firstName: null,
        lastName: null,
      })
      .mockResolvedValueOnce({
        stripeCustomerId: null,
      })
    mockStripe.customers.create.mockResolvedValue({ id: 'cus_orphan' })
    ;(mockPrisma.user.updateMany as jest.Mock).mockResolvedValue({ count: 0 })
    mockStripe.customers.del.mockResolvedValue({ id: 'cus_orphan', deleted: true })

    await expect(getOrCreateStripeCustomer('user-5')).rejects.toThrow(
      'Stripe customer ID unexpectedly null for user user-5 after concurrent update',
    )
  })
})

// ─── createCheckoutSession ──────────────────────────────────────────────────

describe('createCheckoutSession', () => {
  it('creates checkout session and returns URL', async () => {
    ;(mockPrisma.user.findUniqueOrThrow as jest.Mock).mockResolvedValue({
      id: 'user-cs',
      email: 'checkout@example.com',
      stripeCustomerId: 'cus_checkout',
      firstName: 'Check',
      lastName: 'Out',
    })
    mockStripe.checkout.sessions.create.mockResolvedValue({
      url: 'https://checkout.stripe.com/session_abc',
    })

    const result = await createCheckoutSession(
      'user-cs',
      'price_123',
      'https://app.com/success',
      'https://app.com/cancel',
    )

    expect(result).toBe('https://checkout.stripe.com/session_abc')
    expect(mockStripe.checkout.sessions.create).toHaveBeenCalledWith({
      customer: 'cus_checkout',
      mode: 'subscription',
      line_items: [{ price: 'price_123', quantity: 1 }],
      success_url: 'https://app.com/success',
      cancel_url: 'https://app.com/cancel',
      metadata: { userId: 'user-cs' },
      subscription_data: { metadata: { userId: 'user-cs' } },
    })
  })

  it('throws when session.url is missing', async () => {
    ;(mockPrisma.user.findUniqueOrThrow as jest.Mock).mockResolvedValue({
      id: 'user-cs2',
      email: 'nourl@example.com',
      stripeCustomerId: 'cus_nourl',
      firstName: 'No',
      lastName: 'Url',
    })
    mockStripe.checkout.sessions.create.mockResolvedValue({ url: null })

    await expect(
      createCheckoutSession('user-cs2', 'price_456', 'https://app.com/success', 'https://app.com/cancel'),
    ).rejects.toThrow('Stripe checkout session did not return a URL')
  })
})

// ─── createPortalSession ────────────────────────────────────────────────────

describe('createPortalSession', () => {
  it('creates portal session and returns URL', async () => {
    ;(mockPrisma.user.findUniqueOrThrow as jest.Mock).mockResolvedValue({
      id: 'user-portal',
      email: 'portal@example.com',
      stripeCustomerId: 'cus_portal',
      firstName: 'Portal',
      lastName: 'User',
    })
    mockStripe.billingPortal.sessions.create.mockResolvedValue({
      url: 'https://billing.stripe.com/portal_xyz',
    })

    const result = await createPortalSession('user-portal', 'https://app.com/account')

    expect(result).toBe('https://billing.stripe.com/portal_xyz')
    expect(mockStripe.billingPortal.sessions.create).toHaveBeenCalledWith({
      customer: 'cus_portal',
      return_url: 'https://app.com/account',
    })
  })
})

// ─── hasActiveSubscription ──────────────────────────────────────────────────

describe('hasActiveSubscription', () => {
  it('returns true when ACTIVE subscription exists', async () => {
    ;(mockPrisma.subscription.findFirst as jest.Mock).mockResolvedValue({ id: 'sub-1' })

    const result = await hasActiveSubscription('user-active')

    expect(result).toBe(true)
    expect(mockPrisma.subscription.findFirst).toHaveBeenCalledWith({
      where: {
        userId: 'user-active',
        status: { in: ['ACTIVE', 'TRIALING'] },
      },
      select: { id: true },
    })
  })

  it('returns false when no active subscription', async () => {
    ;(mockPrisma.subscription.findFirst as jest.Mock).mockResolvedValue(null)

    const result = await hasActiveSubscription('user-inactive')

    expect(result).toBe(false)
  })
})

// ─── handleSubscriptionCreatedOrUpdated ─────────────────────────────────────

describe('handleSubscriptionCreatedOrUpdated', () => {
  const makeSubscription = (overrides: Partial<Stripe.Subscription> = {}): Stripe.Subscription =>
    ({
      id: 'sub_test',
      customer: 'cus_test',
      status: 'active',
      metadata: { userId: 'user-sub' },
      items: { data: [{ price: { id: 'price_known' } }] },
      current_period_start: 1700000000,
      current_period_end: 1702592000,
      cancel_at_period_end: false,
      ...overrides,
    }) as unknown as Stripe.Subscription

  it('upserts subscription and updates user stripeCustomerId', async () => {
    ;(mockPrisma.subscription.upsert as jest.Mock).mockResolvedValue({})
    ;(mockPrisma.user.update as jest.Mock).mockResolvedValue({})

    await handleSubscriptionCreatedOrUpdated(makeSubscription())

    expect(mockPrisma.subscription.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { stripeSubscriptionId: 'sub_test' },
        update: expect.objectContaining({
          stripePriceId: 'price_known',
          status: 'ACTIVE',
          cancelAtPeriodEnd: false,
        }),
        create: expect.objectContaining({
          userId: 'user-sub',
          stripeSubscriptionId: 'sub_test',
          stripePriceId: 'price_known',
          status: 'ACTIVE',
        }),
      }),
    )
    expect(mockPrisma.user.update).toHaveBeenCalledWith({
      where: { id: 'user-sub' },
      data: { stripeCustomerId: 'cus_test' },
    })
    expect(logger.info).toHaveBeenCalledWith(
      expect.stringContaining('Subscription sub_test synced for user user-sub'),
    )
  })

  it('skips when no userId in metadata and logs warning', async () => {
    const sub = makeSubscription({ metadata: {} as Stripe.Metadata })

    await handleSubscriptionCreatedOrUpdated(sub)

    expect(mockPrisma.subscription.upsert).not.toHaveBeenCalled()
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('has no userId in metadata — skipping'),
    )
  })

  it('maps Stripe status correctly', async () => {
    ;(mockPrisma.subscription.upsert as jest.Mock).mockResolvedValue({})
    ;(mockPrisma.user.update as jest.Mock).mockResolvedValue({})

    const statusMappings: Array<[string, string]> = [
      ['active', 'ACTIVE'],
      ['trialing', 'TRIALING'],
      ['past_due', 'PAST_DUE'],
      ['canceled', 'CANCELED'],
      ['unpaid', 'UNPAID'],
      ['incomplete', 'INCOMPLETE'],
      ['incomplete_expired', 'INCOMPLETE_EXPIRED'],
      ['paused', 'PAUSED'],
    ]

    for (const [stripeStatus, dbStatus] of statusMappings) {
      jest.clearAllMocks()
      ;(mockPrisma.subscription.upsert as jest.Mock).mockResolvedValue({})
      ;(mockPrisma.user.update as jest.Mock).mockResolvedValue({})

      await handleSubscriptionCreatedOrUpdated(
        makeSubscription({ status: stripeStatus as Stripe.Subscription.Status }),
      )

      expect(mockPrisma.subscription.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          update: expect.objectContaining({ status: dbStatus }),
          create: expect.objectContaining({ status: dbStatus }),
        }),
      )
    }
  })

  it('defaults unknown price ID to INDIVIDUAL plan', async () => {
    ;(mockPrisma.subscription.upsert as jest.Mock).mockResolvedValue({})
    ;(mockPrisma.user.update as jest.Mock).mockResolvedValue({})

    await handleSubscriptionCreatedOrUpdated(
      makeSubscription({
        items: { data: [{ price: { id: 'price_unknown_xyz' } }] } as unknown as Stripe.ApiList<Stripe.SubscriptionItem>,
      }),
    )

    expect(mockPrisma.subscription.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: expect.objectContaining({ plan: 'INDIVIDUAL' }),
        create: expect.objectContaining({ plan: 'INDIVIDUAL' }),
      }),
    )
    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining('Unknown Stripe price ID'),
    )
  })
})

// ─── handleSubscriptionDeleted ──────────────────────────────────────────────

describe('handleSubscriptionDeleted', () => {
  it('marks subscription as CANCELED via updateMany', async () => {
    ;(mockPrisma.subscription.updateMany as jest.Mock).mockResolvedValue({ count: 1 })

    const sub = {
      id: 'sub_deleted',
      metadata: {},
    } as unknown as Stripe.Subscription

    await handleSubscriptionDeleted(sub)

    expect(mockPrisma.subscription.updateMany).toHaveBeenCalledWith({
      where: { stripeSubscriptionId: 'sub_deleted' },
      data: { status: 'CANCELED' },
    })
    expect(logger.info).toHaveBeenCalledWith(
      expect.stringContaining('Subscription sub_deleted marked as canceled'),
    )
  })
})
