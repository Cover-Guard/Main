import type { Request, Response, NextFunction } from 'express'
import type { AuthenticatedRequest } from './auth'
import { featureFlags } from '../utils/featureFlags'

// ─── Plan tier ordering (mirrors packages/shared & apps/web/src/lib/plans.ts) ─

type PlanTier = 'free' | 'individual' | 'professional' | 'team'

const PLAN_ORDER: PlanTier[] = ['free', 'individual', 'professional', 'team']

function planIndex(tier: PlanTier): number {
  return PLAN_ORDER.indexOf(tier)
}

/** Convert a DB SubscriptionPlan (uppercase) to a PlanTier (lowercase). */
function dbPlanToTier(
  dbPlan: 'INDIVIDUAL' | 'PROFESSIONAL' | 'TEAM' | null | undefined,
): PlanTier {
  if (!dbPlan) return 'free'
  const map: Record<string, PlanTier> = {
    INDIVIDUAL: 'individual',
    PROFESSIONAL: 'professional',
    TEAM: 'team',
  }
  return map[dbPlan] ?? 'free'
}

// ─── Feature → minimum plan requirement ─────────────────────────────────────
// Keep in sync with apps/web/src/lib/plans.ts FEATURE_PLAN_REQUIREMENTS

type FeatureKey =
  | 'search'
  | 'save'
  | 'risk_profiles'
  | 'carrier_availability'
  | 'insurance_estimates'
  | 'client_management'
  | 'quote_requests'
  | 'property_comparison'
  | 'analytics'
  | 'report_pdfs'
  | 'priority_support'
  | 'team_members'
  | 'api_access'

const FEATURE_PLAN_REQUIREMENTS: Record<FeatureKey, PlanTier> = {
  search: 'free',
  save: 'free',
  risk_profiles: 'free',
  carrier_availability: 'free',
  insurance_estimates: 'individual',
  client_management: 'individual',
  quote_requests: 'professional',
  property_comparison: 'professional',
  analytics: 'professional',
  report_pdfs: 'professional',
  priority_support: 'professional',
  team_members: 'team',
  api_access: 'team',
}

const FEATURE_DISPLAY_NAMES: Record<FeatureKey, string> = {
  search: 'Property Search',
  save: 'Saved Properties',
  risk_profiles: 'Risk Profiles',
  carrier_availability: 'Carrier Availability',
  insurance_estimates: 'Insurance Cost Estimates',
  client_management: 'Client Management',
  quote_requests: 'Binding Quote Requests',
  property_comparison: 'Property Comparison',
  analytics: 'Analytics & Search History',
  report_pdfs: 'Professional Risk Reports',
  priority_support: 'Priority Support',
  team_members: 'Team Members',
  api_access: 'API Access',
}

// ─── Middleware: requireSubscription (simple active-sub check) ──────────────

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
        message:
          'An active subscription is required to access this resource. Please subscribe at /pricing.',
      },
    })
    return
  }

  next()
}

// ─── Middleware: requireFeature (per-feature plan-tier check) ────────────────

/**
 * requireFeature — enforces that the authenticated user's subscription plan
 * meets the minimum tier for the specified feature.
 *
 * Uses the `subscriptionPlan` field populated by requireAuth, so this
 * middleware does NOT make any additional DB queries.
 *
 * When the STRIPE_SUBSCRIPTION_REQUIRED feature flag is off, this middleware
 * is a no-op — all features are accessible regardless of plan.
 *
 * IMPORTANT: Must be placed AFTER requireAuth in the middleware chain.
 *
 * @example
 *   router.post('/quote-request', requireAuth, requireFeature('quote_requests'), handler)
 */
export function requireFeature(feature: FeatureKey) {
  return (req: Request, res: Response, next: NextFunction): void => {
    // Feature flag is off — skip plan check
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

    const userTier = dbPlanToTier(authReq.subscriptionPlan)
    const requiredTier = FEATURE_PLAN_REQUIREMENTS[feature]

    if (planIndex(userTier) < planIndex(requiredTier)) {
      const featureName = FEATURE_DISPLAY_NAMES[feature]
      const requiredPlanName = requiredTier.charAt(0).toUpperCase() + requiredTier.slice(1)

      res.status(403).json({
        success: false,
        error: {
          code: 'PLAN_UPGRADE_REQUIRED',
          message: `${featureName} requires the ${requiredPlanName} plan or higher. Visit /pricing to upgrade.`,
          details: {
            feature,
            currentPlan: userTier,
            requiredPlan: requiredTier,
          },
        },
      })
      return
    }

    next()
  }
}
