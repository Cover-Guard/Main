/**
 * Dashboard forecast service (P-B1.f).
 */
import { prisma } from '../utils/prisma'
import { logger } from '../utils/logger'
import type { DashboardForecastResponse, ForecastDataPoint } from '@coverguard/shared'

const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const

function monthSlot(now: Date, offset: number): { month: string; periodKey: string } {
  const d = new Date(now.getFullYear(), now.getMonth() + offset, 1)
  const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
  return { month: MONTH_LABELS[d.getMonth()], periodKey: key }
}

async function currentMonthlyPremium(userId: string): Promise<number> {
  try {
    const rows = await prisma.savedProperty.findMany({
      where: { userId },
      select: { property: { select: { insuranceEstimate: { select: { annualPremium: true } } } } },
    })
    const total = rows.reduce((sum, r) => {
      const annual = r.property?.insuranceEstimate?.annualPremium ?? 0
      return sum + (typeof annual === 'number' ? annual : 0)
    }, 0)
    return Math.round(total / 12)
  } catch (err) {
    logger.warn('dashboardForecast: monthly premium baseline failed', { error: err instanceof Error ? err.message : err })
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
    if (isPast || isCurrent) premium = baseline > 0 ? baseline : null
    if (isFuture || isCurrent) {
      const i = Math.max(1, offset)
      projected = baseline > 0 ? Math.round(baseline * (1.0 + i * 0.005)) : null
    }
    series.push({ month, periodKey, premium, projected, claims: null, loss: null })
  }
  return { series, generatedAt: now.toISOString() }
}
