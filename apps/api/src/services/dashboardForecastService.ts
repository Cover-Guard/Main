/**
 * Dashboard forecast service (P-B1.f).
 *
 * Returns a 12-month premium / claims series for the user's saved
 * portfolio. The 6 past months use the current snapshot of estimated
 * insurance cost (no historical premium table yet); the 6 future months
 * use a naive forward projection.
 *
 * Foundation behavior — placeholder math that can be refined as snapshot
 * data accrues:
 *   - premium = sum(InsuranceEstimate.estimatedAnnualTotal for saved
 *     properties) / 12, applied to every past month. Once we have
 *     monthly snapshots this varies per month.
 *   - projected = premium x seasonality, where seasonality is 1.0 + (i * 0.005)
 *     for the i-th forward month. Slow-and-steady growth placeholder.
 *   - claims / loss: null. No claims table yet — UI degrades gracefully.
 *
 * `B1.f2` adds a monthly snapshot job (`prisma.premiumSnapshot`) so past
 * months get real numbers, and adds a `Claim` model so claims and loss
 * stop being null.
 */

import { prisma } from '../utils/prisma'
import { logger } from '../utils/logger'
import type {
  DashboardForecastResponse,
  ForecastDataPoint,
} from '@coverguard/shared'

const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const

/** Build a `{ label, key }` pair for the month offset by `offset` from now. */
function monthSlot(now: Date, offset: number): { month: string; periodKey: string } {
  const d = new Date(now.getFullYear(), now.getMonth() + offset, 1)
  const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
  return { month: MONTH_LABELS[d.getMonth()], periodKey: key }
}

/**
 * Pull the current monthly premium baseline from saved-properties'
 * insurance estimates. Returns 0 if the user has no saved properties or
 * no estimates have been computed yet (UI should degrade).
 */
async function currentMonthlyPremium(userId: string): Promise<number> {
  try {
    const rows = await prisma.savedProperty.findMany({
      where: { userId },
      select: {
        property: {
          select: {
            insuranceEstimate: {
              select: { estimatedAnnualTotal: true },
            },
          },
        },
      },
    })
    const total = rows.reduce((sum, r) => {
      const annual = r.property?.insuranceEstimate?.estimatedAnnualTotal ?? 0
      return sum + (typeof annual === 'number' ? annual : 0)
    }, 0)
    return Math.round(total / 12)
  } catch (err) {
    logger.warn('dashboardForecast: monthly premium baseline failed', {
      error: err instanceof Error ? err.message : err,
    })
    return 0
  }
}

export async function getDashboardForecast(userId: string): Promise<DashboardForecastResponse> {
  const now = new Date()
  const baseline = await currentMonthlyPremium(userId)

  const series: ForecastDataPoint[] = []
  for (let offset = -6; offset <= 5; offset++) {
    const { month, periodKey } = monthSlot(now, offset)
    const isPast = offset < 0
    const isCurrent = offset === 0
    const isFuture = offset > 0

    let premium: number | null = null
    let projected: number | null = null

    if (isPast || isCurrent) {
      premium = baseline > 0 ? baseline : null
    }
    if (isFuture || isCurrent) {
      const i = Math.max(1, offset)
      const seasonality = 1.0 + i * 0.005
      projected = baseline > 0 ? Math.round(baseline * seasonality) : null
    }

    series.push({
      month,
      periodKey,
      premium,
      projected,
      claims: null,
      loss: null,
    })
  }

  return {
    series,
    generatedAt: now.toISOString(),
  }
}
