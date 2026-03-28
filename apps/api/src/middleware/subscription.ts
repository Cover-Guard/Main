import type { Request, Response, NextFunction } from 'express'
import type { AuthenticatedRequest } from './auth'
import { featureFlags } from '../utils/featureFlags'

/**
 * requireSubscription — enforces that the authenticated user has an active
 * Stripe subscription, but ONLY when the STRIPE_SUBSCRIPTION_REQUIRED feature
 * flag is enabled. When the flag is off (default), this middleware is a no-op.
 *
 * Uses the `hasActiveSubscription` flag populated by requireAuth (which queries
 * subscription status alongside the user profile in a single DB call), so this
 * middleware does NOT make any additional DB queries.
 *
 * IMPORTANT: Must be placed AFTER requireAuth in the middleware chain.
 */
export function requireSubscription(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  // Feature flag is off — skip subscription check entirely
  if (!featureFlags.stripeSubscriptionRequired) {
    next()
    return
  }

  const authReq = req as AuthenticatedRequest

  if (!authReq.userId) {
    res.status(401).json({
      success: false,
      error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
    })
    return
  }

  // Subscription status was already fetched by requireAuth — no DB call needed
  if (!authReq.hasActiveSubscription) {
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
