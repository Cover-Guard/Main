'use client'

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
  type ReactNode,
} from 'react'
import {
  type PlanTier,
  type Feature,
  type PlanLimits,
  canAccessFeature,
  isFeatureLocked,
  getFeaturePlanRequirement,
  getFeatureDisplayName,
  getFeatureDescription,
  subscriptionPlanToTier,
  getPlanLimits,
  getUpgradeTarget,
} from '@/lib/plans'
import { getSubscriptionState } from '@/lib/api'

// ─── Types ──────────────────────────────────────────────────────────────────

interface SubscriptionContextType {
  /** Current plan tier (derived from active Stripe subscription) */
  plan: PlanTier
  /** Whether the subscription data has been loaded from the API */
  loaded: boolean
  /** Whether the subscription data is currently loading */
  loading: boolean
  /** Plan limits for the current tier */
  limits: PlanLimits

  /** Check if the user can access a specific feature */
  canAccess: (feature: Feature) => boolean
  /** Check if a feature is locked (requires a higher plan) */
  isLocked: (feature: Feature) => boolean
  /** Get the minimum plan required for a feature */
  getRequiredPlan: (feature: Feature) => PlanTier
  /** Get the upgrade target plan for a locked feature */
  getUpgradeTarget: (feature: Feature) => PlanTier
  /** Get a human-readable name for a feature */
  getFeatureName: (feature: Feature) => string
  /** Get a description of a feature (for upgrade prompts) */
  getFeatureDesc: (feature: Feature) => string

  /** Trigger a refetch of subscription state (e.g. after checkout) */
  refresh: () => Promise<void>
}

const SubscriptionContext = createContext<SubscriptionContextType | undefined>(
  undefined,
)

// ─── Provider ───────────────────────────────────────────────────────────────

interface SubscriptionProviderProps {
  children: ReactNode
  /** Override for testing / Storybook — skip the API call and use this tier */
  overridePlan?: PlanTier
}

export function SubscriptionProvider({
  children,
  overridePlan,
}: SubscriptionProviderProps) {
  const [plan, setPlan] = useState<PlanTier>(overridePlan ?? 'free')
  const [loaded, setLoaded] = useState(!!overridePlan)
  const [loading, setLoading] = useState(!overridePlan)

  const fetchSubscription = useCallback(async () => {
    if (overridePlan) return // skip API when overridden
    setLoading(true)
    try {
      const state = await getSubscriptionState()
      if (state.active && state.subscription) {
        const tier = subscriptionPlanToTier(
          state.subscription.plan as 'INDIVIDUAL' | 'PROFESSIONAL' | 'TEAM',
        )
        setPlan(tier)
      } else {
        setPlan('free')
      }
    } catch {
      // If the API call fails (e.g. user not logged in), default to free.
      // This is intentional — unauthenticated users see the free tier UI
      // and gated features prompt them to register/upgrade.
      setPlan('free')
    } finally {
      setLoaded(true)
      setLoading(false)
    }
  }, [overridePlan])

  useEffect(() => {
    fetchSubscription()
  }, [fetchSubscription])

  const limits = useMemo(() => getPlanLimits(plan), [plan])

  const canAccess = useCallback(
    (feature: Feature) => canAccessFeature(plan, feature),
    [plan],
  )

  const isLocked = useCallback(
    (feature: Feature) => {
      const required = getFeaturePlanRequirement(feature)
      return isFeatureLocked(plan, required)
    },
    [plan],
  )

  const getRequiredPlan = useCallback(
    (feature: Feature) => getFeaturePlanRequirement(feature),
    [],
  )

  const getUpgradeTargetFn = useCallback(
    (feature: Feature) => getUpgradeTarget(feature),
    [],
  )

  const getFeatureName = useCallback(
    (feature: Feature) => getFeatureDisplayName(feature),
    [],
  )

  const getFeatureDesc = useCallback(
    (feature: Feature) => getFeatureDescription(feature),
    [],
  )

  const value = useMemo<SubscriptionContextType>(
    () => ({
      plan,
      loaded,
      loading,
      limits,
      canAccess,
      isLocked,
      getRequiredPlan,
      getUpgradeTarget: getUpgradeTargetFn,
      getFeatureName,
      getFeatureDesc,
      refresh: fetchSubscription,
    }),
    [
      plan,
      loaded,
      loading,
      limits,
      canAccess,
      isLocked,
      getRequiredPlan,
      getUpgradeTargetFn,
      getFeatureName,
      getFeatureDesc,
      fetchSubscription,
    ],
  )

  return (
    <SubscriptionContext.Provider value={value}>
      {children}
    </SubscriptionContext.Provider>
  )
}

// ─── Hook ───────────────────────────────────────────────────────────────────

export function useSubscription(): SubscriptionContextType {
  const context = useContext(SubscriptionContext)
  if (!context) {
    throw new Error(
      'useSubscription must be used within a SubscriptionProvider',
    )
  }
  return context
}
