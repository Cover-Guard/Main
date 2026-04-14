'use client'

import { useState } from 'react'
import { Crown, Check, X, ArrowRight } from 'lucide-react'
import {
  type PlanTier,
  type Feature,
  PLANS,
  PLAN_ORDER,
  getPlanDisplayName,
  getFeatureDisplayName,
  getFeatureDescription,
  getFeaturePlanRequirement,
  getStripePriceId,
} from '@/lib/plans'
import { createCheckoutSession } from '@/lib/api'

interface PaywallModalProps {
  open: boolean
  onClose: () => void
  /** The feature the user tried to access */
  feature: Feature
  /** The user's current plan */
  currentPlan: PlanTier
}

export function PaywallModal({
  open,
  onClose,
  feature,
  currentPlan,
}: PaywallModalProps) {
  const [isLoading, setIsLoading] = useState<PlanTier | null>(null)
  const [error, setError] = useState<string | null>(null)

  if (!open) return null

  const requiredPlan = getFeaturePlanRequirement(feature)
  const featureName = getFeatureDisplayName(feature)
  const featureDesc = getFeatureDescription(feature)

  // Show upgrade options: plans higher than currentPlan that include this feature
  const upgradePlans = PLAN_ORDER.filter((tier) => {
    const tierIndex = PLAN_ORDER.indexOf(tier)
    const currentIndex = PLAN_ORDER.indexOf(currentPlan)
    const requiredIndex = PLAN_ORDER.indexOf(requiredPlan)
    return tierIndex > currentIndex && tierIndex >= requiredIndex
  })

  async function handleUpgrade(targetPlan: PlanTier) {
    setError(null)

    if (targetPlan === 'team') {
      // Team plan requires contacting sales
      window.location.assign('mailto:sales@coverguard.io?subject=CoverGuard Team Plan Inquiry')
      return
    }

    const priceId = getStripePriceId(targetPlan)
    if (!priceId) {
      setError('This plan is not yet available. Please contact sales@coverguard.io.')
      return
    }

    setIsLoading(targetPlan)
    try {
      const { url } = await createCheckoutSession(priceId)
      window.location.assign(url)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start checkout.')
      setIsLoading(null)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="relative w-full max-w-lg rounded-2xl bg-white p-8 shadow-xl">
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute right-4 top-4 rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
          disabled={isLoading !== null}
        >
          <X className="h-5 w-5" />
        </button>

        {/* Header */}
        <div className="mb-6 flex items-start gap-4">
          <div className="rounded-full bg-brand-100 p-3">
            <Crown className="h-6 w-6 text-brand-600" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-900">
              Upgrade to unlock {featureName}
            </h2>
            <p className="mt-1 text-sm text-gray-600">{featureDesc}</p>
          </div>
        </div>

        {/* Current plan badge */}
        <div className="mb-6 rounded-lg bg-gray-50 px-4 py-3">
          <p className="text-sm text-gray-500">
            Your current plan:{' '}
            <span className="font-semibold text-gray-900">
              {getPlanDisplayName(currentPlan)}
            </span>
          </p>
        </div>

        {error && (
          <div className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {/* Upgrade options */}
        <div className="space-y-3">
          {upgradePlans.map((tier) => {
            const plan = PLANS[tier]
            const isRecommended = tier === requiredPlan
            const isTeam = tier === 'team'

            return (
              <button
                key={tier}
                onClick={() => handleUpgrade(tier)}
                disabled={isLoading !== null}
                className={`relative w-full rounded-xl border-2 p-5 text-left transition-all ${
                  isRecommended
                    ? 'border-brand-600 bg-brand-50 shadow-md'
                    : 'border-gray-200 hover:border-gray-300 hover:shadow-sm'
                } disabled:opacity-50`}
              >
                {isRecommended && (
                  <span className="absolute -top-2.5 right-4 inline-flex items-center rounded-full bg-brand-600 px-3 py-0.5 text-xs font-semibold text-white">
                    Recommended
                  </span>
                )}

                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">
                      {plan.name}
                    </h3>
                    <p className="mt-1 text-sm text-gray-600">
                      {isTeam ? 'Custom pricing' : `$${plan.price}/month`}
                      {' · '}
                      {plan.limits.reportLimit === Infinity
                        ? 'Unlimited reports'
                        : `${plan.limits.reportLimit} reports/mo`}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {isLoading === tier ? (
                      <span className="text-sm text-gray-500">Redirecting...</span>
                    ) : (
                      <>
                        <span className="text-sm font-medium text-brand-600">
                          {isTeam ? 'Contact Sales' : 'Upgrade'}
                        </span>
                        <ArrowRight className="h-4 w-4 text-brand-600" />
                      </>
                    )}
                  </div>
                </div>

                {/* Key features for this plan */}
                <div className="mt-3 flex flex-wrap gap-2">
                  {plan.features.slice(0, 5).map((f) => (
                    <span
                      key={f}
                      className="inline-flex items-center gap-1 rounded-full bg-white px-2.5 py-1 text-xs text-gray-600"
                    >
                      <Check className="h-3 w-3 text-brand-600" />
                      {getFeatureDisplayName(f)}
                    </span>
                  ))}
                  {plan.features.length > 5 && (
                    <span className="inline-flex items-center rounded-full bg-white px-2.5 py-1 text-xs text-gray-500">
                      +{plan.features.length - 5} more
                    </span>
                  )}
                </div>
              </button>
            )
          })}
        </div>

        {/* View all plans link */}
        <div className="mt-6 text-center">
          <a
            href="/pricing"
            className="text-sm font-medium text-brand-600 hover:underline"
          >
            View all plans & features
          </a>
        </div>

        <button
          onClick={onClose}
          className="mt-4 w-full text-center text-sm text-gray-500 transition hover:text-gray-700"
          disabled={isLoading !== null}
        >
          Maybe later
        </button>
      </div>
    </div>
  )
}
