import type { Request, Response, NextFunction } from 'express'
import type { AuthenticatedRequest } from './auth'
import { featureFlags } from '../utils/featureFlags'
import { hasActiveSubscription } from '../services/stripeService'

/**
 * requireSubscription — enforces that the authenticated user has an active
 * Stripe subscription, but ONLY when the STRIPE_SUBSCRIPTION_REQUIRED feature
 * flag is enabled. When the flag is off (default), this middleware is a no-op.
 *
 * IMPORTANT: Must be placed AFTER requireAuth in the middleware chain so that
 * req.userId is already populated. Typically used as:
 *   router.get('/path', requireAuth, requireSubscription, handler)
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

  if (!userId) {
    // This should not happen if requireAuth ran first. If it does, reject.
    res.status(401).json({
      success: false,
      error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
    })
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
