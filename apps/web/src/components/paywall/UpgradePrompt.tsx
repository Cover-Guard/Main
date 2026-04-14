'use client'

import { useState } from 'react'
import { Lock, Zap } from 'lucide-react'
import {
  type Feature,
  getFeatureDisplayName,
  getFeatureDescription,
  getFeaturePlanRequirement,
  getPlanDisplayName,
} from '@/lib/plans'
import { useSubscription } from '@/lib/hooks/useSubscription'
import { PaywallModal } from './PaywallModal'

interface UpgradePromptProps {
  /** The feature to prompt an upgrade for */
  feature: Feature
}

/**
 * A standalone upgrade prompt banner for a specific feature.
 * Use this inside sections where you want to show an inline
 * "upgrade to unlock X" callout.
 */
export function UpgradePrompt({ feature }: UpgradePromptProps) {
  const { plan } = useSubscription()
  const [showModal, setShowModal] = useState(false)

  const featureName = getFeatureDisplayName(feature)
  const featureDesc = getFeatureDescription(feature)
  const requiredPlan = getFeaturePlanRequirement(feature)
  const requiredPlanName = getPlanDisplayName(requiredPlan)

  return (
    <>
      <div className="overflow-hidden rounded-xl border-2 border-brand-200 bg-gradient-to-br from-brand-50 to-brand-100 p-6">
        <div className="flex gap-4">
          <div className="shrink-0">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-200">
              <Lock className="h-5 w-5 text-brand-700" />
            </div>
          </div>
          <div className="flex-1">
            <h3 className="font-semibold text-gray-900">
              Unlock {featureName}
            </h3>
            <p className="mt-1 text-sm text-gray-700">{featureDesc}</p>
            <p className="mt-1 text-xs text-gray-500">
              Available on {requiredPlanName} and above
            </p>
            <button
              onClick={() => setShowModal(true)}
              className="mt-3 inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-700"
            >
              <Zap className="h-4 w-4" />
              Upgrade to {requiredPlanName}
            </button>
          </div>
        </div>
      </div>

      <PaywallModal
        open={showModal}
        onClose={() => setShowModal(false)}
        feature={feature}
        currentPlan={plan}
      />
    </>
  )
}
