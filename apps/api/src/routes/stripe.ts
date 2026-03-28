import { Router } from 'express'
import express from 'express'
import { z } from 'zod'
import { requireAuth } from '../middleware/auth'
import { logger } from '../utils/logger'
import {
  stripe,
  createCheckoutSession,
  createPortalSession,
  handleSubscriptionCreatedOrUpdated,
  handleSubscriptionDeleted,
} from '../services/stripeService'
import { featureFlags } from '../utils/featureFlags'
import { prisma } from '../utils/prisma'
import type { Request } from 'express'
import type { AuthenticatedRequest } from '../middleware/auth'
import type Stripe from 'stripe'

export const stripeRouter = Router()

// ─── Subscription status ─────────────────────────────────────────────────────

stripeRouter.get('/subscription', requireAuth, async (req: Request, res, next) => {
  try {
    const { userId } = req as AuthenticatedRequest

    const subscription = await prisma.subscription.findFirst({
      where: {
        userId,
        status: { in: ['ACTIVE', 'TRIALING', 'PAST_DUE'] },
      },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true, plan: true, status: true, stripePriceId: true,
        currentPeriodStart: true, currentPeriodEnd: true,
        cancelAtPeriodEnd: true, createdAt: true,
      },
    })

    res.json({
      success: true,
      data: {
        required: featureFlags.stripeSubscriptionRequired,
        active: subscription?.status === 'ACTIVE' || subscription?.status === 'TRIALING',
        subscription,
      },
    })
  } catch (err) {
    next(err)
  }
})

// ─── Create checkout session ─────────────────────────────────────────────────

/** Validate that a URL belongs to the app's own origin to prevent open redirects. */
function isSafeRedirectUrl(url: string): boolean {
  try {
    const parsed = new URL(url)
    const allowedHosts = [
      'localhost',
      'coverguard.io',
      'www.coverguard.io',
    ]
    // Allow exact matches and *.coverguard.io subdomains (Vercel previews)
    if (allowedHosts.includes(parsed.hostname)) return true
    if (parsed.hostname.endsWith('.coverguard.io')) return true
    if (/^[\w-]+-cover-guard\.vercel\.app$/.test(parsed.hostname)) return true
    return false
  } catch {
    return false
  }
}

const checkoutSchema = z.object({
  priceId: z.string().min(1),
  successUrl: z.string().url().refine(isSafeRedirectUrl, { message: 'successUrl must point to the application origin' }),
  cancelUrl: z.string().url().refine(isSafeRedirectUrl, { message: 'cancelUrl must point to the application origin' }),
})

stripeRouter.post('/checkout', requireAuth, async (req: Request, res, next) => {
  try {
    const { userId } = req as AuthenticatedRequest
    const { priceId, successUrl, cancelUrl } = checkoutSchema.parse(req.body)

    const url = await createCheckoutSession(userId, priceId, successUrl, cancelUrl)
    res.json({ success: true, data: { url } })
  } catch (err) {
    next(err)
  }
})

// ─── Customer portal ─────────────────────────────────────────────────────────

const portalSchema = z.object({
  returnUrl: z.string().url().refine(isSafeRedirectUrl, { message: 'returnUrl must point to the application origin' }),
})

stripeRouter.post('/portal', requireAuth, async (req: Request, res, next) => {
  try {
    const { userId } = req as AuthenticatedRequest
    const { returnUrl } = portalSchema.parse(req.body)

    const url = await createPortalSession(userId, returnUrl)
    res.json({ success: true, data: { url } })
  } catch (err) {
    next(err)
  }
})

// ─── Webhook ─────────────────────────────────────────────────────────────────
// NOTE: This route uses express.raw() for body parsing — it must be mounted
// BEFORE the global express.json() middleware or with its own parser.

export const stripeWebhookRouter = Router()

stripeWebhookRouter.post(
  '/webhook',
  express.raw({ type: 'application/json' }),
  async (req: Request, res) => {
    const sig = req.headers['stripe-signature'] as string | undefined
    if (!sig) {
      res.status(400).json({ success: false, error: { code: 'BAD_REQUEST', message: 'Missing stripe-signature header' } })
      return
    }

    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET
    if (!webhookSecret) {
      logger.error('STRIPE_WEBHOOK_SECRET is not configured — rejecting webhook')
      res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: 'Webhook secret not configured' } })
      return
    }

    let event: Stripe.Event
    try {
      event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret)
    } catch (err) {
      logger.warn(`Stripe webhook signature verification failed: ${(err as Error).message}`)
      res.status(400).json({ success: false, error: { code: 'BAD_REQUEST', message: 'Invalid signature' } })
      return
    }

    try {
      switch (event.type) {
        case 'customer.subscription.created':
        case 'customer.subscription.updated':
          await handleSubscriptionCreatedOrUpdated(event.data.object as Stripe.Subscription)
          break
        case 'customer.subscription.deleted':
          await handleSubscriptionDeleted(event.data.object as Stripe.Subscription)
          break
        default:
          logger.debug(`Unhandled Stripe event type: ${event.type}`)
      }
    } catch (err) {
      logger.error(`Error handling Stripe event ${event.type} (${event.id}): ${(err as Error).message}`)
      // Return 200 to prevent Stripe from auto-retrying. The error is logged
      // and should be investigated manually. Users must confirm any retry.
      res.json({ received: true, error: true })
      return
    }

    res.json({ received: true })
  },
)
