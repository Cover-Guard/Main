'use client'

import { FeatureGate } from '@/components/paywall'
import { AnalyticsDashboard } from './AnalyticsDashboard'

/**
 * Client component that wraps the analytics dashboard with a FeatureGate.
 * Analytics requires the Professional plan or higher.
 */
export function AnalyticsWithGate() {
  return (
    <FeatureGate feature="analytics" mode="overlay">
      <AnalyticsDashboard />
    </FeatureGate>
  )
}
