/**
 * Dashboard KPI detail service (P-B1.e).
 *
 * Produces per-KPI detail for the dashboard KPI panel: target, change,
 * breakdown, and sparkline history. Reuses primitives from
 * dashboardActivityService.loadUserActivity to share SQL with /ticker.
 *
 * Foundation behavior: where we don't yet have a snapshot table to
 * compute change/history (everything except savedCount), we return
 * empty arrays and null change. The UI is expected to degrade
 * gracefully. Subsequent PRs (B1.e2+) add proper snapshots.
 */

import { prisma } from '../utils/prisma'
import { logger } from '../utils/logger'
import type {
  DashboardKpisResponse,
  KpiBreakdownItem,
  KpiHistoryPoint,
  TickerKpi,
} from '@coverguard/shared'

async function savedCountHistory(userId: string): Promise<KpiHistoryPoint[]> {
  const since = new Date(Date.now() - 12 * 7 * 24 * 60 * 60 * 1000)
  const rows = await prisma.savedProperty.findMany({
    where: { userId, createdAt: { gte: since } },
    select: { createdAt: true },
  })
  const buckets = new Map<string, number>()
  for (const r of rows) {
    const k = isoWeekLabel(r.createdAt)
    buckets.set(k, (buckets.get(k) ?? 0) + 1)
  }
  const out: KpiHistoryPoint[] = []
  const cursor = new Date(since)
  while (cursor <= new Date()) {
    const k = isoWeekLabel(cursor)
    out.push({ period: shortWeekLabel(cursor), value: buckets.get(k) ?? 0 })
    cursor.setDate(cursor.getDate() + 7)
  }
  return out
}

function isoWeekLabel(d: Date): string {
  const year = d.getUTCFullYear()
  const start = new Date(Date.UTC(year, 0, 1))
  const diff = (d.getTime() - start.getTime()) / (24 * 60 * 60 * 1000)
  const week = Math.floor(diff / 7) + 1
  return `${year}-${String(week).padStart(2, '0')}`
}

function shortWeekLabel(d: Date): string {
  return `Wk ${isoWeekLabel(d).slice(-2)}`
}

async function savedCountBreakdown(userId: string): Promise<KpiBreakdownItem[]> {
  const rows = await prisma.savedProperty.findMany({
    where: { userId },
    select: { client: { select: { status: true } } },
  })
  const counts: Record<string, number> = { Unassigned: 0 }
  for (const r of rows) {
    const key = r.client?.status ?? 'Unassigned'
    counts[key] = (counts[key] ?? 0) + 1
  }
  return Object.entries(counts).filter(([, v]) => v > 0).map(([label, value]) => ({ label, value }))
}

export async function getDashboardKpis(userId: string): Promise<DashboardKpisResponse> {
  let savedHistory: KpiHistoryPoint[] = []
  let savedBreakdown: KpiBreakdownItem[] = []
  try {
    [savedHistory, savedBreakdown] = await Promise.all([
      savedCountHistory(userId),
      savedCountBreakdown(userId),
    ])
  } catch (err) {
    logger.warn('dashboardKpis: savedCount detail failed', { error: err instanceof Error ? err.message : err })
  }

  const totalSaved = savedBreakdown.reduce((sum, b) => sum + b.value, 0)
  const kpis: DashboardKpisResponse['kpis'] = {
    savedCount: { target: totalSaved > 0 ? Math.ceil(totalSaved * 1.5) : null, change: null, breakdown: savedBreakdown, history: savedHistory },
    portfolioValue: { target: null, change: null, breakdown: [], history: [] },
    searchesLast7d: { target: null, change: null, breakdown: [], history: [] },
    avgRiskScore: { target: null, change: null, breakdown: [], history: [] },
    quoteRequests: { target: null, change: null, breakdown: [], history: [] },
    avgInsuranceCost: { target: null, change: null, breakdown: [], history: [] },
  }
  return { kpis, generatedAt: new Date().toISOString() }
}

export type { TickerKpi }
