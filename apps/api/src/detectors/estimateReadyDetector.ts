/**
 * Detector: estimate-ready (PR 8).
 *
 * Fires when a saved property has a fresh `insurance_estimates` row (within
 * the last 24h). The user saves a property, the estimator backfills the
 * pricing, and this insight surfaces "Your estimate is ready" so they don't
 * have to remember to come back and look.
 *
 * Severity: info — pleasant news, not actionable on a deadline.
 * Dedupe: per-property over 30 days.
 */

import { type Detector, type DetectorContext, type Insight } from './types'

const RECENT_WINDOW_HOURS = 24

interface SavedRow {
  propertyId: string
}

interface EstimateRow {
  propertyId: string
  estimatedAnnualTotal: number
  generatedAt?: string
  // Fallback if generatedAt isn't selected — created at row-level via DB default.
  // We still match on the propertyId set, so the snapshot field is optional.
}

export const estimateReadyDetector: Detector = {
  name: 'estimate-ready',

  async evaluate(ctx: DetectorContext): Promise<Insight[]> {
    const { data: saved, error: savedErr } = await ctx.supabase
      .from('saved_properties')
      .select('propertyId')
      .eq('userId', ctx.userId)

    if (savedErr || !saved || saved.length === 0) return []

    const propertyIds = (saved as SavedRow[]).map((s) => s.propertyId)
    const since = new Date(
      ctx.now.getTime() - RECENT_WINDOW_HOURS * 3_600_000,
    ).toISOString()

    const { data: estimates, error: estErr } = await ctx.supabase
      .from('insurance_estimates')
      .select('propertyId,estimatedAnnualTotal,generatedAt')
      .in('propertyId', propertyIds)
      .gte('generatedAt', since)

    if (estErr || !estimates) return []

    return (estimates as EstimateRow[]).map((est) => ({
      category: 'insight' as const,
      severity: 'info' as const,
      title: 'Your insurance estimate is ready',
      body: `We estimate about $${est.estimatedAnnualTotal.toLocaleString()} a year for this property.`,
      linkUrl: `/dashboard?property=${est.propertyId}`,
      payload: {
        propertyId: est.propertyId,
        annualTotal: est.estimatedAnnualTotal,
      },
      entityType: 'property',
      entityId: est.propertyId,
      dedupeKey: `estimate-ready:${est.propertyId}`,
    }))
  },
}
