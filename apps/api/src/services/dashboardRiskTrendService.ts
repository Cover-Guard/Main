/**
 * Dashboard risk-trend service (P-B1.g).
 *
 * Computes the 12-month average risk score across the user's saved
 * properties. The current month is computed from the latest cached
 * RiskProfile per property; past / future months use the current
 * baseline until B1.g2 adds a per-month snapshot table.
 *
 * Annotations are empty in this foundation PR — B1.g2 will surface
 * portfolio events (mitigation upgrades, claims) from existing tables.
 */

import { prisma } from '../utils/prisma'
import { logger } from '../utils/logger'
import type {
  DashboardRiskTrendResponse,
  RiskTrendAnnotation,
  RiskTrendDataPoint,
} from '@coverguard/shared'

const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const

function monthSlot(now: Date, offset: number): { month: string; periodKey: string } {
  const d = new Date(now.getFullYear(), now.getMonth() + offset, 1)
  const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
  return { month: MONTH_LABELS[d.getMonth()], periodKey: key }
}

/**
 * Average overall risk score across the user's saved properties' current
 * RiskProfile rows. Returns null if no saved properties or none have a
 * computed profile.
 */
async function currentAverageRiskScore(userId: string): Promise<number | null> {
  try {
    const rows = await prisma.savedProperty.findMany({
      where: { userId },
      select: {
        property: {
          select: {
            riskProfile: { select: { overallRiskScore: true } },
          },
        },
      },
    })
    const scores: number[] = []
    for (const r of rows) {
      const s = r.property?.riskProfile?.overallRiskScore
      if (typeof s === 'number' && Number.isFinite(s)) scores.push(s)
    }
    if (scores.length === 0) return null
    return Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
  } catch (err) {
    logger.warn('dashboardRiskTrend: avg risk score failed', {
      error: err instanceof Error ? err.message : err,
    })
    return null
  }
}

export async function getDashboardRiskTrend(userId: string): Promise<DashboardRiskTrendResponse> {
  const now = new Date()
  const baseline = await currentAverageRiskScore(userId)

  const series: RiskTrendDataPoint[] = []
  for (let offset = -6; offset <= 5; offset++) {
    const { month, periodKey } = monthSlot(now, offset)
    series.push({ month, periodKey, score: baseline })
  }

  // Foundation: empty annotations array. B1.g2 surfaces events from
  // SearchHistory / QuoteRequest / AuditTrail.
  const annotations: RiskTrendAnnotation[] = []

  return {
    series,
    annotations,
    generatedAt: now.toISOString(),
  }
}
