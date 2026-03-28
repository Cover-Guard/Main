/**
 * stripeService tests
 *
 * Covers all exported functions:
 *  - getOrCreateStripeCustomer (including race-condition handling)
 *  - createCheckoutSession
 *  - createPortalSession
 *  - hasActiveSubscription
 *  - handleSubscriptionCreatedOrUpdated
 *  - handleSubscriptionDeleted
 */

// ─── Mocks ──────────────────────────────────────────────────────────────────

jest.mock('../../utils/logger', () => ({
  logger: { error: jest.fn(), warn: jest.fn(), info: jest.fn(), debug: jest.fn() },
}))

const mockStripeCustomersCreate = jest.fn()
const mockStripeCustomersDel = jest.fn()
const mockStripeCheckoutSessionsCreate = jest.fn()
const mockStripeBillingPortalSessionsCreate = jest.fn()

jest.mock('stripe', () => {
  return jest.fn().mockImplementation(() => ({
    customers: { create: mockStripeCustomersCreate, del: mockStripeCustomersDel },
    checkout: { sessions: { create: mockStripeCheckoutSessionsCreate } },
    billingPortal: { sessions: { create: mockStripeBillingPortalSessionsCreate } },
    webhooks: { constructEvent: jest.fn() },
  }))
})

jest.mock('../../utils/prisma', () => ({
  prisma: {
    user: {
      findUniqueOrThrow: jest.fn(),
      updateMany: jest.fn(),
      update: jest.fn(),
    },
    subscription: {
      upsert: jest.fn(),
      updateMany: jest.fn(),
      findFirst: jest.fn(),
    },
  },
}))

// ─── Imports (after mocks) ──────────────────────────────────────────────────

import { prisma } from '../../utils/prisma'
import { logger } from '../../utils/logger'
import {
  getOrCreateStripeCustomer,
  createCheckoutSession,
  createPortalSession,
  hasActiveSubscription,
  handleSubscriptionCreatedOrUpdated,
  handleSubscriptionDeleted,
} from '../../services/stripeService'
import type Stripe from 'stripe'

// ─── Helpers ────────────────────────────────────────────────────────────────

const mockPrismaUser = prisma.user as unknown as {
  findUniqueOrThrow: jest.Mock
  updateMany: jest.Mock
  update: jest.Mock
}

const mockPrismaSubscription = prisma.subscription as unknown as {
  upsert: jest.Mock
  updateMany: jest.Mock
  findFirst: jest.Mock
}

function makeStripeSubscription(overrides: Record<string, unknown> = {}): Stripe.Subscription {
  return {
    id: 'sub_123',
    metadata: { userId: 'user-1' },
    status: 'active',
    customer: 'cus_abc',
    cancel_at_period_end: false,
    current_period_start: 1700000000,
    current_period_end: 1702600000,
    items: {
      data: [{ price: { id: 'price_individual' } }],
    },
    ...overrides,
  } as unknown as Stripe.Subscription
}

// ─── Test suites ────────────────────────────────────────────────────────────

beforeEach(() => {
  jest.clearAllMocks()
})

describe('getOrCreateStripeCustomer', () => {
  it('returns existing stripeCustomerId if user already has one', async () => {
    mockPrismaUser.findUniqueOrThrow.mockResolvedValue({
      id: 'user-1',
      email: 'alice@example.com',
      stripeCustomerId: 'cus_existing',
      firstName: 'Alice',
      lastName: 'Smith',
    })

    const result = await getOrCreateStripeCustomer('user-1')

    expect(result).toBe('cus_existing')
    expect(mockStripeCustomersCreate).not.toHaveBeenCalled()
  })

  it('creates new Stripe customer when user has no stripeCustomerId', async () => {
    mockPrismaUser.findUniqueOrThrow.mockResolvedValue({
      id: 'user-1',
      email: 'bob@example.com',
      stripeCustomerId: null,
      firstName: 'Bob',
      lastName: 'Jones',
    })
    mockStripeCustomersCreate.mockResolvedValue({ id: 'cus_new' })
    mockPrismaUser.updateMany.mockResolvedValue({ count: 1 })

    const result = await getOrCreateStripeCustomer('user-1')

    expect(result).toBe('cus_new')
    expect(mockStripeCustomersCreate).toHaveBeenCalledWith({
      email: 'bob@example.com',
      name: 'Bob Jones',
      metadata: { userId: 'user-1' },
    })
    expect(mockPrismaUser.updateMany).toHaveBeenCalledWith({
      where: { id: 'user-1', stripeCustomerId: null },
      data: { stripeCustomerId: 'cus_new' },
    })
  })

  it('uses email as name fallback when firstName/lastName are empty', async () => {
    mockPrismaUser.findUniqueOrThrow.mockResolvedValue({
      id: 'user-1',
      email: 'noname@example.com',
      stripeCustomerId: null,
      firstName: null,
      lastName: null,
    })
    mockStripeCustomersCreate.mockResolvedValue({ id: 'cus_noname' })
    mockPrismaUser.updateMany.mockResolvedValue({ count: 1 })

    await getOrCreateStripeCustomer('user-1')

    expect(mockStripeCustomersCreate).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'noname@example.com' }),
    )
  })

  it('handles race condition: re-reads after updateMany returns count=0', async () => {
    mockPrismaUser.findUniqueOrThrow
      .mockResolvedValueOnce({
        id: 'user-1',
        email: 'race@example.com',
        stripeCustomerId: null,
        firstName: 'Race',
        lastName: 'Runner',
      })
      .mockResolvedValueOnce({
        stripeCustomerId: 'cus_winner',
      })
    mockStripeCustomersCreate.mockResolvedValue({ id: 'cus_loser' })
    mockPrismaUser.updateMany.mockResolvedValue({ count: 0 })
    mockStripeCustomersDel.mockResolvedValue({})

    const result = await getOrCreateStripeCustomer('user-1')

    expect(result).toBe('cus_winner')
  })

  it('cleans up duplicate Stripe customer on race condition', async () => {
    mockPrismaUser.findUniqueOrThrow
      .mockResolvedValueOnce({
        id: 'user-1',
        email: 'dup@example.com',
        stripeCustomerId: null,
        firstName: 'Dup',
        lastName: 'User',
      })
      .mockResolvedValueOnce({
        stripeCustomerId: 'cus_winner',
      })
    mockStripeCustomersCreate.mockResolvedValue({ id: 'cus_duplicate' })
    mockPrismaUser.updateMany.mockResolvedValue({ count: 0 })
    mockStripeCustomersDel.mockResolvedValue({})

    await getOrCreateStripeCustomer('user-1')

    expect(mockStripeCustomersDel).toHaveBeenCalledWith('cus_duplicate')
  })

  it('throws when stripeCustomerId unexpectedly null after concurrent update', async () => {
    mockPrismaUser.findUniqueOrThrow
      .mockResolvedValueOnce({
        id: 'user-1',
        email: 'null@example.com',
        stripeCustomerId: null,
        firstName: null,
        lastName: null,
      })
      .mockResolvedValueOnce({
        stripeCustomerId: null,
      })
    mockStripeCustomersCreate.mockResolvedValue({ id: 'cus_orphan' })
    mockPrismaUser.updateMany.mockResolvedValue({ count: 0 })
    mockStripeCustomersDel.mockResolvedValue({})

    await expect(getOrCreateStripeCustomer('user-1')).rejects.toThrow(
      'Stripe customer ID unexpectedly null for user user-1 after concurrent update',
    )
  })
})

describe('createCheckoutSession', () => {
  beforeEach(() => {
    // Stub getOrCreateStripeCustomer path (user already has customerId)
    mockPrismaUser.findUniqueOrThrow.mockResolvedValue({
      id: 'user-1',
      email: 'checkout@example.com',
      stripeCustomerId: 'cus_checkout',
      firstName: 'Check',
      lastName: 'Out',
    })
  })

  it('creates checkout session with correct parameters', async () => {
    mockStripeCheckoutSessionsCreate.mockResolvedValue({
      url: 'https://checkout.stripe.com/session_abc',
    })

    const result = await createCheckoutSession(
      'user-1',
      'price_pro',
      'https://app.com/success',
      'https://app.com/cancel',
    )

    expect(result).toBe('https://checkout.stripe.com/session_abc')
    expect(mockStripeCheckoutSessionsCreate).toHaveBeenCalledWith({
      customer: 'cus_checkout',
      mode: 'subscription',
      line_items: [{ price: 'price_pro', quantity: 1 }],
      success_url: 'https://app.com/success',
      cancel_url: 'https://app.com/cancel',
      metadata: { userId: 'user-1' },
      subscription_data: { metadata: { userId: 'user-1' } },
    })
  })

  it('throws when Stripe returns no URL', async () => {
    mockStripeCheckoutSessionsCreate.mockResolvedValue({ url: null })

    await expect(
      createCheckoutSession('user-1', 'price_pro', 'https://app.com/success', 'https://app.com/cancel'),
    ).rejects.toThrow('Stripe checkout session did not return a URL')
  })
})

describe('createPortalSession', () => {
  it('creates portal session and returns URL', async () => {
    mockPrismaUser.findUniqueOrThrow.mockResolvedValue({
      id: 'user-1',
      email: 'portal@example.com',
      stripeCustomerId: 'cus_portal',
      firstName: 'Portal',
      lastName: 'User',
    })
    mockStripeBillingPortalSessionsCreate.mockResolvedValue({
      url: 'https://billing.stripe.com/portal_abc',
    })

    const result = await createPortalSession('user-1', 'https://app.com/account')

    expect(result).toBe('https://billing.stripe.com/portal_abc')
    expect(mockStripeBillingPortalSessionsCreate).toHaveBeenCalledWith({
      customer: 'cus_portal',
      return_url: 'https://app.com/account',
    })
  })
})

describe('hasActiveSubscription', () => {
  it('returns true when ACTIVE subscription exists', async () => {
    mockPrismaSubscription.findFirst.mockResolvedValue({ id: 'sub-1' })

    const result = await hasActiveSubscription('user-1')

    expect(result).toBe(true)
    expect(mockPrismaSubscription.findFirst).toHaveBeenCalledWith({
      where: {
        userId: 'user-1',
        status: { in: ['ACTIVE', 'TRIALING'] },
      },
      select: { id: true },
    })
  })

  it('returns true when TRIALING subscription exists', async () => {
    mockPrismaSubscription.findFirst.mockResolvedValue({ id: 'sub-trial' })

    const result = await hasActiveSubscription('user-1')

    expect(result).toBe(true)
  })

  it('returns false when no active/trialing subscription exists', async () => {
    mockPrismaSubscription.findFirst.mockResolvedValue(null)

    const result = await hasActiveSubscription('user-1')

    expect(result).toBe(false)
  })
})

describe('handleSubscriptionCreatedOrUpdated', () => {
  it('upserts subscription with correct data mapping', async () => {
    const sub = makeStripeSubscription()
    mockPrismaSubscription.upsert.mockResolvedValue({})
    mockPrismaUser.update.mockResolvedValue({})

    await handleSubscriptionCreatedOrUpdated(sub)

    expect(mockPrismaSubscription.upsert).toHaveBeenCalledWith({
      where: { stripeSubscriptionId: 'sub_123' },
      update: expect.objectContaining({
        stripePriceId: 'price_individual',
        status: 'ACTIVE',
        cancelAtPeriodEnd: false,
        currentPeriodStart: new Date(1700000000 * 1000),
        currentPeriodEnd: new Date(1702600000 * 1000),
      }),
      create: expect.objectContaining({
        userId: 'user-1',
        stripeSubscriptionId: 'sub_123',
        stripePriceId: 'price_individual',
        status: 'ACTIVE',
      }),
    })
  })

  it('skips when subscription has no userId in metadata', async () => {
    const sub = makeStripeSubscription({ metadata: {} })

    await handleSubscriptionCreatedOrUpdated(sub)

    expect(mockPrismaSubscription.upsert).not.toHaveBeenCalled()
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('has no userId in metadata'),
    )
  })

  it('maps active status to ACTIVE', async () => {
    const sub = makeStripeSubscription({ status: 'active' })
    mockPrismaSubscription.upsert.mockResolvedValue({})
    mockPrismaUser.update.mockResolvedValue({})

    await handleSubscriptionCreatedOrUpdated(sub)

    expect(mockPrismaSubscription.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: expect.objectContaining({ status: 'ACTIVE' }),
      }),
    )
  })

  it('maps trialing status to TRIALING', async () => {
    const sub = makeStripeSubscription({ status: 'trialing' })
    mockPrismaSubscription.upsert.mockResolvedValue({})
    mockPrismaUser.update.mockResolvedValue({})

    await handleSubscriptionCreatedOrUpdated(sub)

    expect(mockPrismaSubscription.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: expect.objectContaining({ status: 'TRIALING' }),
      }),
    )
  })

  it('maps past_due status to PAST_DUE', async () => {
    const sub = makeStripeSubscription({ status: 'past_due' })
    mockPrismaSubscription.upsert.mockResolvedValue({})
    mockPrismaUser.update.mockResolvedValue({})

    await handleSubscriptionCreatedOrUpdated(sub)

    expect(mockPrismaSubscription.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: expect.objectContaining({ status: 'PAST_DUE' }),
      }),
    )
  })

  it('maps canceled status to CANCELED', async () => {
    const sub = makeStripeSubscription({ status: 'canceled' })
    mockPrismaSubscription.upsert.mockResolvedValue({})
    mockPrismaUser.update.mockResolvedValue({})

    await handleSubscriptionCreatedOrUpdated(sub)

    expect(mockPrismaSubscription.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: expect.objectContaining({ status: 'CANCELED' }),
      }),
    )
  })

  it('syncs stripeCustomerId to user', async () => {
    const sub = makeStripeSubscription({ customer: 'cus_synced' })
    mockPrismaSubscription.upsert.mockResolvedValue({})
    mockPrismaUser.update.mockResolvedValue({})

    await handleSubscriptionCreatedOrUpdated(sub)

    expect(mockPrismaUser.update).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      data: { stripeCustomerId: 'cus_synced' },
    })
  })

  it('syncs stripeCustomerId when customer is an object', async () => {
    const sub = makeStripeSubscription({ customer: { id: 'cus_obj' } })
    mockPrismaSubscription.upsert.mockResolvedValue({})
    mockPrismaUser.update.mockResolvedValue({})

    await handleSubscriptionCreatedOrUpdated(sub)

    expect(mockPrismaUser.update).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      data: { stripeCustomerId: 'cus_obj' },
    })
  })

  it('defaults to INDIVIDUAL plan when priceId is unknown', async () => {
    const sub = makeStripeSubscription({
      items: { data: [{ price: { id: 'price_unknown_xyz' } }] },
    })
    mockPrismaSubscription.upsert.mockResolvedValue({})
    mockPrismaUser.update.mockResolvedValue({})

    await handleSubscriptionCreatedOrUpdated(sub)

    expect(mockPrismaSubscription.upsert).toHaveBeenCalledWith(
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

describe('handleSubscriptionDeleted', () => {
  it('marks subscription as CANCELED', async () => {
    const sub = makeStripeSubscription()
    mockPrismaSubscription.updateMany.mockResolvedValue({ count: 1 })

    await handleSubscriptionDeleted(sub)

    expect(mockPrismaSubscription.updateMany).toHaveBeenCalledWith({
      where: { stripeSubscriptionId: 'sub_123' },
      data: { status: 'CANCELED' },
    })
    expect(logger.info).toHaveBeenCalledWith(
      expect.stringContaining('marked as canceled'),
    )
  })

  it('works when subscription not found (updateMany returns count 0)', async () => {
    const sub = makeStripeSubscription({ id: 'sub_nonexistent' })
    mockPrismaSubscription.updateMany.mockResolvedValue({ count: 0 })

    // Should not throw
    await handleSubscriptionDeleted(sub)

    expect(mockPrismaSubscription.updateMany).toHaveBeenCalledWith({
      where: { stripeSubscriptionId: 'sub_nonexistent' },
      data: { status: 'CANCELED' },
    })
  })
})
