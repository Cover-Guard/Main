import type { Request, Response, NextFunction } from 'express'
import type { AuthenticatedRequest } from './auth'
import { supabaseAdmin } from '../utils/supabaseAdmin'
import { logger } from '../utils/logger'

/**
 * enforceFreeUsageLimit — atomic check-and-increment for free-tier capabilities.
 *
 * For paid users (any active subscription), this is a no-op. For free users,
 * it calls the `enforce_free_usage_limit` Postgres RPC which atomically
 * increments the counter and rejects with ERRCODE 'P0001' once the cap is hit.
 *
 * Free-tier caps (mirrored from apps/web/src/lib/plans.ts):
 *   property_search → 1 lifetime
 *   ai_interaction  → 5 lifetime
 *
 * IMPORTANT: Must be placed AFTER requireAuth in the middleware chain.
 * Returns 402 PAYMENT_REQUIRED with structured detail so the client can render
 * an upgrade CTA.
 */

export type Capability = 'property_search' | 'ai_interaction'

const FREE_LIMITS: Record<Capability, number> = {
  property_search: 1,
  ai_interaction: 5,
}

const FRIENDLY_LABEL: Record<Capability, string> = {
  property_search: 'property search',
  ai_interaction: 'AI Agent interaction',
}

export function enforceFreeUsageLimit(capability: Capability) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const authReq = req as AuthenticatedRequest

    if (!authReq.userId) {
      res.status(401).json({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
      })
      return
    }

    // Paid plans bypass the gate entirely.
    if (authReq.hasActiveSubscription) {
      next()
      return
    }

    const limit = FREE_LIMITS[capability]
    const label = FRIENDLY_LABEL[capability]

    try {
      const { data, error } = await supabaseAdmin.rpc('enforce_free_usage_limit', {
        p_user_id: authReq.userId,
        p_capability: capability,
        p_limit: limit,
      })

      if (error) {
        // Postgres throws ERRCODE 'P0001' (raise_exception) when the cap is hit.
        // The supabase-js client surfaces this in error.code.
        if (error.code === 'P0001') {
          res.status(402).json({
            success: false,
            error: {
              code: 'FREE_LIMIT_REACHED',
              message: `You've reached your Free plan limit of ${limit} ${label}${limit === 1 ? '' : 's'}. Upgrade to continue.`,
              details: {
                capability,
                limit,
                upgradeUrl: '/pricing',
              },
            },
          })
          return
        }

        logger.error('enforce_free_usage_limit RPC failed', {
          userId: authReq.userId,
          capability,
          error: error.message,
        })
        res.status(500).json({
          success: false,
          error: { code: 'USAGE_CHECK_FAILED', message: 'Could not verify usage limits. Please try again.' },
        })
        return
      }

      // Success — `data` is the post-increment count. Surface it on the request
      // so the route handler can echo it back in the response payload (useful
      // for UIs that show "1 of 5 used").
      ;(authReq as unknown as { usageCount?: number }).usageCount = typeof data === 'number' ? data : undefined
      next()
    } catch (err) {
      logger.error('enforce_free_usage_limit unexpected error', {
        userId: authReq.userId,
        capability,
        error: err instanceof Error ? err.message : err,
      })
      next(err)
    }
  }
}

/**
 * Convenience helper — returns the current free-tier limits so other parts of
 * the API (e.g. /api/auth/me) can include them in the user payload.
 */
export function getFreeLimits(): Readonly<Record<Capability, number>> {
  return FREE_LIMITS
}
