import Stripe from 'stripe'
import { prisma } from '../utils/prisma'
import { logger } from '../utils/logger'

if (!process.env.STRIPE_SECRET_KEY) {
  logger.warn('STRIPE_SECRET_KEY is not set — Stripe features will be unavailable')
}

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY ?? '', {
  apiVersion: '2025-02-24.acacia',
})

const PRICE_TO_PLAN: Record<string, 'INDIVIDUAL' | 'PROFESSIONAL' | 'TEAM'> = {
  [process.env.STRIPE_PRICE_INDIVIDUAL ?? '']: 'INDIVIDUAL',
  [process.env.STRIPE_PRICE_PROFESSIONAL ?? '']: 'PROFESSIONAL',
  [process.env.STRIPE_PRICE_TEAM ?? '']: 'TEAM',
}

function planFromPriceId(priceId: string): 'INDIVIDUAL' | 'PROFESSIONAL' | 'TEAM' {
  return PRICE_TO_PLAN[priceId] ?? 'INDIVIDUAL'
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

  const customer = await stripe.customers.create({
    email: user.email,
    name: `${user.firstName} ${user.lastName}`.trim(),
    metadata: { userId: user.id },
  })

  await prisma.user.update({
    where: { id: userId },
    data: { stripeCustomerId: customer.id },
  })

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

  return session.url!
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

  await prisma.subscription.upsert({
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
  })

  // Ensure the user has the Stripe customer ID stored
  const customerId =
    typeof subscription.customer === 'string' ? subscription.customer : subscription.customer.id
  await prisma.user.update({
    where: { id: userId },
    data: { stripeCustomerId: customerId },
  })

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
