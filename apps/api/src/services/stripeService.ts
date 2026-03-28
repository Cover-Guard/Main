import Stripe from 'stripe'
import { prisma } from '../utils/prisma'
import { logger } from '../utils/logger'

let _stripeInstance: Stripe | null = null

function getStripe(): Stripe {
  if (_stripeInstance) return _stripeInstance
  const key = process.env.STRIPE_SECRET_KEY
  if (!key) {
    throw new Error('STRIPE_SECRET_KEY is not set — Stripe features are unavailable')
  }
  _stripeInstance = new Stripe(key, {
    apiVersion: '2025-02-24.acacia',
    maxNetworkRetries: 0,
  })
  return _stripeInstance
}

/** Lazily initialized Stripe client. Throws if STRIPE_SECRET_KEY is missing. */
export const stripe = new Proxy({} as Stripe, {
  get(_target, prop) {
    const instance = getStripe()
    const value = (instance as unknown as Record<string | symbol, unknown>)[prop]
    if (typeof value === 'function') return value.bind(instance)
    return value
  },
})

const PRICE_TO_PLAN: Record<string, 'INDIVIDUAL' | 'PROFESSIONAL' | 'TEAM'> = {}
if (process.env.STRIPE_PRICE_INDIVIDUAL) PRICE_TO_PLAN[process.env.STRIPE_PRICE_INDIVIDUAL] = 'INDIVIDUAL'
if (process.env.STRIPE_PRICE_PROFESSIONAL) PRICE_TO_PLAN[process.env.STRIPE_PRICE_PROFESSIONAL] = 'PROFESSIONAL'
if (process.env.STRIPE_PRICE_TEAM) PRICE_TO_PLAN[process.env.STRIPE_PRICE_TEAM] = 'TEAM'

function planFromPriceId(priceId: string): 'INDIVIDUAL' | 'PROFESSIONAL' | 'TEAM' {
  const plan = PRICE_TO_PLAN[priceId]
  if (!plan) {
    // Log as error for investigation, but default to INDIVIDUAL so the
    // subscription is still recorded in the DB. A missing subscription is
    // worse than a wrong plan — plan can be corrected manually.
    logger.error(`Unknown Stripe price ID "${priceId}" — defaulting to INDIVIDUAL. Configure STRIPE_PRICE_* env vars.`)
  }
  return plan ?? 'INDIVIDUAL'
}

function toDbStatus(
  stripeStatus: Stripe.Subscription.Status,
): 'ACTIVE' | 'TRIALING' | 'PAST_DUE' | 'CANCELED' | 'UNPAID' | 'INCOMPLETE' | 'INCOMPLETE_EXPIRED' | 'PAUSED' {
  const map: Record<string, string> = {
    active: 'ACTIVE',
    trialing: 'TRIALING',
    past_due: 'PAST_DUE',
    canceled: 'CANCELED',
    unpaid: 'UNPAID',
    incomplete: 'INCOMPLETE',
    incomplete_expired: 'INCOMPLETE_EXPIRED',
    paused: 'PAUSED',
  }
  return (map[stripeStatus] ?? 'INCOMPLETE') as ReturnType<typeof toDbStatus>
}

// ─── Customer management ─────────────────────────────────────────────────────

export async function getOrCreateStripeCustomer(userId: string): Promise<string> {
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: { id: true, email: true, stripeCustomerId: true, firstName: true, lastName: true },
  })

  if (user.stripeCustomerId) return user.stripeCustomerId

  const customerName = `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim() || user.email
  const customer = await stripe.customers.create({
    email: user.email,
    name: customerName,
    metadata: { userId: user.id },
  })

  // Use a conditional update to avoid a race condition where two concurrent
  // requests both see stripeCustomerId as null. Only the first one wins;
  // the second re-reads the now-populated value.
  const updated = await prisma.user.updateMany({
    where: { id: userId, stripeCustomerId: null },
    data: { stripeCustomerId: customer.id },
  })

  if (updated.count === 0) {
    // Another request already set the customer ID — re-read and use that one.
    // Clean up the duplicate Stripe customer we just created.
    const existing = await prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { stripeCustomerId: true },
    })
    await stripe.customers.del(customer.id).catch((err) =>
      logger.warn(`Failed to clean up duplicate Stripe customer ${customer.id}: ${(err as Error).message}`),
    )
    if (!existing.stripeCustomerId) {
      throw new Error(`Stripe customer ID unexpectedly null for user ${userId} after concurrent update`)
    }
    return existing.stripeCustomerId
  }

  return customer.id
}

// ─── Checkout ────────────────────────────────────────────────────────────────

export async function createCheckoutSession(
  userId: string,
  priceId: string,
  successUrl: string,
  cancelUrl: string,
): Promise<string> {
  const customerId = await getOrCreateStripeCustomer(userId)

  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: 'subscription',
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: successUrl,
    cancel_url: cancelUrl,
    metadata: { userId },
    subscription_data: { metadata: { userId } },
  })

  if (!session.url) {
    throw new Error('Stripe checkout session did not return a URL')
  }
  return session.url
}

// ─── Customer Portal ─────────────────────────────────────────────────────────

export async function createPortalSession(userId: string, returnUrl: string): Promise<string> {
  const customerId = await getOrCreateStripeCustomer(userId)

  const session = await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: returnUrl,
  })

  return session.url
}

// ─── Subscription status check ───────────────────────────────────────────────

export async function hasActiveSubscription(userId: string): Promise<boolean> {
  const sub = await prisma.subscription.findFirst({
    where: {
      userId,
      status: { in: ['ACTIVE', 'TRIALING'] },
    },
    select: { id: true },
  })
  return sub !== null
}

// ─── Webhook handlers ────────────────────────────────────────────────────────

export async function handleSubscriptionCreatedOrUpdated(
  subscription: Stripe.Subscription,
): Promise<void> {
  const userId = subscription.metadata.userId
  if (!userId) {
    logger.warn(`Stripe subscription ${subscription.id} has no userId in metadata — skipping`)
    return
  }

  const priceId = subscription.items.data[0]?.price.id ?? ''

  // Run subscription upsert + user customer ID update in parallel (independent writes)
  const customerId =
    typeof subscription.customer === 'string' ? subscription.customer : subscription.customer.id

  await Promise.all([
    prisma.subscription.upsert({
      where: { stripeSubscriptionId: subscription.id },
      update: {
        stripePriceId: priceId,
        plan: planFromPriceId(priceId),
        status: toDbStatus(subscription.status),
        currentPeriodStart: new Date(subscription.current_period_start * 1000),
        currentPeriodEnd: new Date(subscription.current_period_end * 1000),
        cancelAtPeriodEnd: subscription.cancel_at_period_end,
      },
      create: {
        userId,
        stripeSubscriptionId: subscription.id,
        stripePriceId: priceId,
        plan: planFromPriceId(priceId),
        status: toDbStatus(subscription.status),
        currentPeriodStart: new Date(subscription.current_period_start * 1000),
        currentPeriodEnd: new Date(subscription.current_period_end * 1000),
        cancelAtPeriodEnd: subscription.cancel_at_period_end,
      },
    }),
    prisma.user.update({
      where: { id: userId },
      data: { stripeCustomerId: customerId },
    }),
  ])

  logger.info(`Subscription ${subscription.id} synced for user ${userId} — status: ${subscription.status}`)
}

export async function handleSubscriptionDeleted(
  subscription: Stripe.Subscription,
): Promise<void> {
  await prisma.subscription.updateMany({
    where: { stripeSubscriptionId: subscription.id },
    data: { status: 'CANCELED' },
  })

  logger.info(`Subscription ${subscription.id} marked as canceled`)
}
