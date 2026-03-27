import type { Request, Response, NextFunction } from 'express'
import type { AuthenticatedRequest } from './auth'
import { featureFlags } from '../utils/featureFlags'
import { hasActiveSubscription } from '../services/stripeService'

/**
 * requireSubscription — enforces that the authenticated user has an active
 * Stripe subscription, but ONLY when the STRIPE_SUBSCRIPTION_REQUIRED feature
 * flag is enabled. When the flag is off (default), this middleware is a no-op.
 *
 * Must be placed AFTER requireAuth in the middleware chain.
 */
export async function requireSubscription(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  // Feature flag is off — skip subscription check entirely
  if (!featureFlags.stripeSubscriptionRequired) {
    next()
    return
  }

  const { userId } = req as AuthenticatedRequest

  // If the request is not authenticated (public endpoint), skip — the
  // individual route's requireAuth will handle access control.
  if (!userId) {
    next()
    return
  }

  const active = await hasActiveSubscription(userId)
  if (!active) {
    res.status(403).json({
      success: false,
      error: {
        code: 'SUBSCRIPTION_REQUIRED',
        message: 'An active subscription is required to access this resource. Please subscribe at /pricing.',
      },
    })
    return
  }

  next()
}
