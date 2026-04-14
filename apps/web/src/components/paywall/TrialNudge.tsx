'use client'

import { useState } from 'react'
import { Zap } from 'lucide-react'
import { useSubscription } from '@/lib/hooks/useSubscription'
import { PaywallModal } from './PaywallModal'

interface TrialNudgeProps {
  /** Number of reports/searches the user has used this period */
  used: number
}

/**
 * A compact nudge banner that shows the user how many reports they have
 * remaining in their current plan, with an upgrade CTA.
 */
export function TrialNudge({ used }: TrialNudgeProps) {
  const { plan, limits } = useSubscription()
  const [showModal, setShowModal] = useState(false)

  // Don't show for unlimited plans
  if (limits.reportLimit === Infinity) return null
  // Don't show until at least one report has been used
  if (used === 0) return null

  const remaining = Math.max(0, limits.reportLimit - used)
  const isExhausted = remaining <= 0
  const isLow = remaining <= Math.ceil(limits.reportLimit * 0.2) // under 20%

  const getMessage = () => {
    if (isExhausted) return "You've used all your property reports this month"
    return `${remaining} of ${limits.reportLimit} reports remaining this month`
  }

  return (
    <>
      <div
        className={`overflow-hidden rounded-lg p-4 ${
          isExhausted
            ? 'bg-gradient-to-r from-red-600 to-red-700'
            : isLow
              ? 'bg-gradient-to-r from-amber-500 to-amber-600'
              : 'bg-gradient-to-r from-brand-600 to-brand-700'
        }`}
      >
        <div className="flex items-center justify-between gap-4">
          <div className="flex-1">
            <p className="text-sm font-medium text-white">{getMessage()}</p>
            <p className="mt-0.5 text-xs text-white/80">
              {isExhausted
                ? 'Upgrade your plan to continue generating reports'
                : 'Upgrade for more reports and advanced features'}
            </p>
          </div>
          <button
            onClick={() => setShowModal(true)}
            className="inline-flex shrink-0 items-center gap-2 rounded-lg bg-white px-4 py-2 text-sm font-semibold text-brand-600 shadow-sm transition hover:bg-gray-50"
          >
            <Zap className="h-4 w-4" />
            Upgrade
          </button>
        </div>
      </div>

      <PaywallModal
        open={showModal}
        onClose={() => setShowModal(false)}
        feature="search"
        currentPlan={plan}
      />
    </>
  )
}
