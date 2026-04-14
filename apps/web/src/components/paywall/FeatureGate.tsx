'use client'

import { useState, type ReactNode } from 'react'
import { Lock, Zap } from 'lucide-react'
import {
  type Feature,
  getPlanDisplayName,
  getFeatureDisplayName,
  getFeaturePlanRequirement,
} from '@/lib/plans'
import { useSubscription } from '@/lib/hooks/useSubscription'
import { PaywallModal } from './PaywallModal'

interface FeatureGateProps {
  /** The feature being gated */
  feature: Feature
  /** Content to render when the feature is accessible */
  children: ReactNode
  /**
   * How to display the gated state:
   * - 'overlay' (default): Blurs the content with a lock overlay
   * - 'replace': Replaces the content entirely with an upgrade banner
   * - 'inline': Shows the children dimmed with a small inline badge
   */
  mode?: 'overlay' | 'replace' | 'inline'
}

/**
 * Wraps a feature section. If the user's current plan doesn't include the
 * feature, the content is shown in a locked/dimmed state with a prompt to
 * upgrade. Clicking the upgrade button opens the PaywallModal.
 *
 * Key design decision: we SHOW the feature (don't hide it) so users know
 * what's available if they upgrade.
 */
export function FeatureGate({
  feature,
  children,
  mode = 'overlay',
}: FeatureGateProps) {
  const { plan, isLocked, loaded } = useSubscription()
  const [showModal, setShowModal] = useState(false)

  // While loading or if the feature is accessible, render children normally
  if (!loaded || !isLocked(feature)) {
    return <>{children}</>
  }

  const requiredPlan = getFeaturePlanRequirement(feature)
  const featureName = getFeatureDisplayName(feature)
  const requiredPlanName = getPlanDisplayName(requiredPlan)

  if (mode === 'replace') {
    return (
      <>
        <div className="rounded-xl border-2 border-dashed border-gray-200 bg-gray-50 p-8 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-brand-100">
            <Lock className="h-6 w-6 text-brand-600" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900">{featureName}</h3>
          <p className="mt-2 text-sm text-gray-600">
            Available on the {requiredPlanName} plan and above.
          </p>
          <button
            onClick={() => setShowModal(true)}
            className="mt-4 inline-flex items-center gap-2 rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-700"
          >
            <Zap className="h-4 w-4" />
            Upgrade to {requiredPlanName}
          </button>
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

  if (mode === 'inline') {
    return (
      <>
        <div
          className="relative cursor-pointer"
          onClick={() => setShowModal(true)}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') setShowModal(true)
          }}
        >
          <div className="pointer-events-none opacity-40">{children}</div>
          <span className="absolute right-2 top-2 inline-flex items-center gap-1 rounded-full bg-brand-600 px-2.5 py-1 text-xs font-semibold text-white shadow-sm">
            <Lock className="h-3 w-3" />
            {requiredPlanName}
          </span>
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

  // Default: overlay mode
  return (
    <>
      <div
        className="relative cursor-pointer"
        onClick={() => setShowModal(true)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') setShowModal(true)
        }}
      >
        {/* Blurred content behind the overlay */}
        <div className="pointer-events-none select-none">
          <div className="rounded-lg opacity-30 blur-[2px]">{children}</div>
        </div>

        {/* Lock overlay */}
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 rounded-lg bg-white/60 backdrop-blur-[1px]">
          <div className="rounded-full bg-gray-900/80 p-3 shadow-lg">
            <Lock className="h-6 w-6 text-white" />
          </div>
          <div className="text-center">
            <p className="font-semibold text-gray-900">{featureName}</p>
            <p className="text-sm text-gray-600">
              Available on {requiredPlanName} and above
            </p>
          </div>
          <button
            onClick={(e) => {
              e.stopPropagation()
              setShowModal(true)
            }}
            className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white shadow-md transition hover:bg-brand-700"
          >
            <Zap className="h-4 w-4" />
            Upgrade to Unlock
          </button>
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
