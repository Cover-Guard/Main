'use client'

import { useEffect, useState } from 'react'
import { getSubscriptionState } from '@/lib/api'
import { canAccessFeature, isFeatureLocked, PlanTier, Feature } from '@/lib/plans'
import type { SubscriptionPlan } from '@coverguard/shared'

function subscriptionPlanToTier(plan: SubscriptionPlan): PlanTier {
  switch (plan) {
    case 'INDIVIDUAL': return 'individual'
    case 'PROFESSIONAL': return 'professional'
    case 'TEAM': return 'team'
    default: return 'free'
  }
}

export interface UseSubscriptionResult {
  /** The user's current plan tier. 'free' when no active subscription. */
  planTier: PlanTier
  /** Whether the STRIPE_SUBSCRIPTION_REQUIRED feature flag is on. When false, nothing is gated. */
  subscriptionRequired: boolean
  /** True while the subscription state is being fetched from the API. */
  loading: boolean
  /** Whether the user's plan includes the given feature. */
  hasFeature: (feature: Feature) => boolean
  /**
   * Whether this feature is actively gated for this user.
   * Always false when subscriptionRequired is false (feature flag off).
   */
  isGated: (feature: Feature) => boolean
  /**
   * Whether the user's plan is below a specific tier.
   * Useful for role-aware gating (e.g. agents need Professional for compare).
   * Always false when subscriptionRequired is false.
   */
  isBelowPlan: (requiredPlan: PlanTier) => boolean
}

/**
 * Fetches the user's subscription state from the API and returns helpers
 * for feature gating on the dashboard.
 *
 * Usage:
 *   const { isGated, isBelowPlan, loading } = useSubscription()
 *   if (isGated('analytics')) return <UpgradePrompt ... />
 */
export function useSubscription(): UseSubscriptionResult {
  const [planTier, setPlanTier] = useState<PlanTier>('free')
  const [subscriptionRequired, setSubscriptionRequired] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getSubscriptionState()
      .then((state) => {
        setSubscriptionRequired(state.required)
        if (state.active && state.subscription) {
          setPlanTier(subscriptionPlanToTier(state.subscription.plan))
        } else {
          setPlanTier('free')
        }
      })
      .catch(() => {
        // Network error — degrade gracefully: free tier, no gating
        setPlanTier('free')
        setSubscriptionRequired(false)
      })
      .finally(() => setLoading(false))
  }, [])

  const hasFeature = (feature: Feature) => canAccessFeature(planTier, feature)

  const isGated = (feature: Feature) => {
    if (!subscriptionRequired) return false
    return !canAccessFeature(planTier, feature)
  }

  const isBelowPlan = (requiredPlan: PlanTier) => {
    if (!subscriptionRequired) return false
    return isFeatureLocked(planTier, requiredPlan)
  }

  return {
    planTier,
    subscriptionRequired,
    loading,
    hasFeature,
    isGated,
    isBelowPlan,
  }
}
