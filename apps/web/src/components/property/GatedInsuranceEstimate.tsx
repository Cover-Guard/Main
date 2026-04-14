'use client'

import { FeatureGate } from '@/components/paywall'
import type { InsuranceCostEstimate as IInsuranceCostEstimate } from '@coverguard/shared'
import { InsuranceCostEstimate } from './InsuranceCostEstimate'

interface GatedInsuranceEstimateProps {
  estimate: IInsuranceCostEstimate
}

/**
 * Wraps InsuranceCostEstimate with a FeatureGate.
 * Insurance cost estimates require Individual plan or higher.
 * The estimate data is shown blurred with a lock overlay for free users.
 */
export function GatedInsuranceEstimate({ estimate }: GatedInsuranceEstimateProps) {
  return (
    <FeatureGate feature="insurance_estimates" mode="overlay">
      <InsuranceCostEstimate estimate={estimate} />
    </FeatureGate>
  )
}
