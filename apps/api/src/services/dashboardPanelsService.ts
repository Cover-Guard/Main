/**
 * Dashboard panel services (P-B1.h).
 *
 * Three small endpoints in one file. Each retires one mock-backed panel:
 *
 *   - portfolio-mix: aggregates saved-property categories by count.
 *     `growth` is null in this PR (no historical aggregation).
 *
 *   - insights: returns an empty array in this PR. The Insight model is
 *     non-trivial — surfacing real alerts/opportunities/trends needs a
 *     dedicated pipeline (B1.h2). The endpoint shape is in place so the
 *     UI can switch off the mock now.
 *
 *   - active-carriers: returns an empty array. The schema does not yet
 *     model carriers per property (no Property.carriers relation). The
 *     endpoint shape is in place so the UI can switch off the mock; a
 *     dedicated Carrier ↔ Property model lands in B1.h2.
 */

import { prisma } from '../utils/prisma'
import { logger } from '../utils/logger'
import type {
  DashboardActiveCarriersResponse,
  DashboardInsight,
  DashboardInsightsResponse,
  DashboardPortfolioMixResponse,
  PortfolioMixDetail,
  PortfolioMixSegment,
} from '@coverguard/shared'

const CATEGORY_COLORS: Record<string, string> = {
  Commercial:   '#6366f1',
  Residential:  '#8b5cf6',
  Industrial:   '#a78bfa',
  'Mixed-Use':  '#c4b5fd',
  Other:        '#cbd5e1',
}

function categoryFor(propertyType: string | null | undefined): string {
  if (!propertyType) return 'Other'
  const t = propertyType.toLowerCase()
  if (t.includes('commercial') || t.includes('office') || t.includes('retail')) return 'Commercial'
  if (t.includes('residential') || t.includes('apartment') || t.includes('multi') || t.includes('single') || t.includes('family')) return 'Residential'
  if (t.includes('industrial') || t.includes('warehouse') || t.includes('distribution')) return 'Industrial'
  if (t.includes('mixed')) return 'Mixed-Use'
  return 'Other'
}

function formatAddress(p: { address: string; city: string; state: string; zip: string } | null | undefined): string {
  if (!p) return ''
  return `${p.address}, ${p.city}, ${p.state} ${p.zip}`.trim()
}

export async function getDashboardPortfolioMix(userId: string): Promise<DashboardPortfolioMixResponse> {
  const now = new Date()
  try {
    const rows = await prisma.savedProperty.findMany({
      where: { userId },
      select: {
        property: {
          select: {
            propertyType: true,
            address: true,
            city: true,
            state: true,
            zip: true,
            riskProfile: { select: { overallRiskScore: true } },
            insuranceEstimate: { select: { estimatedAnnualTotal: true } },
          },
        },
      },
    })

    // Bucket by category
    const byCategory = new Map<string, { count: number; risks: number[]; premiums: number[]; props: Array<{ address: string; premium: number }> }>()
    for (const r of rows) {
      const p = r.property
      if (!p) continue
      const cat = categoryFor(p.propertyType)
      const bucket = byCategory.get(cat) ?? { count: 0, risks: [], premiums: [], props: [] }
      bucket.count += 1
      const risk = p.riskProfile?.overallRiskScore
      if (typeof risk === 'number') bucket.risks.push(risk)
      const premium = p.insuranceEstimate?.estimatedAnnualTotal
      const addr = formatAddress(p)
      if (typeof premium === 'number') {
        bucket.premiums.push(premium)
        bucket.props.push({ address: addr, premium })
      } else if (addr) {
        bucket.props.push({ address: addr, premium: 0 })
      }
      byCategory.set(cat, bucket)
    }

    const total = Array.from(byCategory.values()).reduce((s, b) => s + b.count, 0)
    const segments: PortfolioMixSegment[] = []
    const details: Record<string, PortfolioMixDetail> = {}

    for (const [name, b] of byCategory) {
      if (b.count === 0) continue
      const value = total > 0 ? Math.round((b.count / total) * 100) : 0
      segments.push({ name, value, color: CATEGORY_COLORS[name] ?? '#cbd5e1' })

      const avgRisk = b.risks.length > 0
        ? Math.round(b.risks.reduce((a, x) => a + x, 0) / b.risks.length)
        : null
      const totalPremium = b.premiums.length > 0
        ? Math.round(b.premiums.reduce((a, x) => a + x, 0))
        : null
      const topProperty = b.props
        .slice()
        .sort((a, x) => x.premium - a.premium)[0]?.address ?? null

      details[name] = {
        count: b.count,
        avgRisk,
        totalPremium,
        topProperty,
        growth: null,
      }
    }

    return { segments, details, generatedAt: now.toISOString() }
  } catch (err) {
    logger.warn('dashboardPortfolioMix failed', { error: err instanceof Error ? err.message : err })
    return { segments: [], details: {}, generatedAt: now.toISOString() }
  }
}

export async function getDashboardInsights(_userId: string): Promise<DashboardInsightsResponse> {
  // Foundation: no insights yet. Real surface requires a dedicated
  // pipeline (B1.h2 will mine carrier-exit alerts, peril deltas,
  // quote-request follow-ups, etc.). Empty array unblocks the panel
  // wiring — the UI renders an "No insights yet" state.
  const insights: DashboardInsight[] = []
  return { insights, generatedAt: new Date().toISOString() }
}

export async function getDashboardActiveCarriers(_userId: string): Promise<DashboardActiveCarriersResponse> {
  // Foundation: the schema does not yet model carriers per property
  // (no Property.carriers relation). The endpoint returns an empty
  // array — the UI renders an "No carriers" state. B1.h2 will add
  // a Carrier ↔ Property model and re-aggregate here.
  return {
    carriers: [],
    generatedAt: new Date().toISOString(),
  }
}
