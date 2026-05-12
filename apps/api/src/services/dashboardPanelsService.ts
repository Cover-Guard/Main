/**
 * Dashboard panel services (P-B1.h).
 */
import { prisma } from '../utils/prisma'
import { logger } from '../utils/logger'
import type {
  DashboardActiveCarrier,
  DashboardActiveCarriersResponse,
  DashboardInsight,
  DashboardInsightsResponse,
  DashboardPortfolioMixResponse,
  PortfolioMixDetail,
  PortfolioMixSegment,
} from '@coverguard/shared'

const CATEGORY_COLORS: Record<string, string> = {
  Commercial: '#6366f1',
  Residential: '#8b5cf6',
  Industrial: '#a78bfa',
  'Mixed-Use': '#c4b5fd',
  Other: '#cbd5e1',
}

function categoryFor(propertyType: string | null | undefined): string {
  if (!propertyType) return 'Other'
  const t = propertyType.toLowerCase()
  if (t.includes('commercial') || t.includes('office') || t.includes('retail')) return 'Commercial'
  if (t.includes('residential') || t.includes('apartment') || t.includes('multi')) return 'Residential'
  if (t.includes('industrial') || t.includes('warehouse') || t.includes('distribution')) return 'Industrial'
  if (t.includes('mixed')) return 'Mixed-Use'
  return 'Other'
}

export async function getDashboardPortfolioMix(userId: string): Promise<DashboardPortfolioMixResponse> {
  const now = new Date()
  try {
    const rows = await prisma.savedProperty.findMany({
      where: { userId },
      select: { property: { select: { propertyType: true, displayAddress: true, riskProfile: { select: { overallScore: true } }, insuranceEstimate: { select: { annualPremium: true } } } } },
    })
    const byCategory = new Map<string, { count: number; risks: number[]; premiums: number[]; props: Array<{ address: string; premium: number }> }>()
    for (const r of rows) {
      const p = r.property
      if (!p) continue
      const cat = categoryFor(p.propertyType)
      const bucket = byCategory.get(cat) ?? { count: 0, risks: [], premiums: [], props: [] }
      bucket.count += 1
      const risk = p.riskProfile?.overallScore
      if (typeof risk === 'number') bucket.risks.push(risk)
      const premium = p.insuranceEstimate?.annualPremium
      if (typeof premium === 'number') {
        bucket.premiums.push(premium)
        bucket.props.push({ address: p.displayAddress ?? '', premium })
      } else if (p.displayAddress) {
        bucket.props.push({ address: p.displayAddress, premium: 0 })
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
      const avgRisk = b.risks.length > 0 ? Math.round(b.risks.reduce((a, x) => a + x, 0) / b.risks.length) : null
      const totalPremium = b.premiums.length > 0 ? Math.round(b.premiums.reduce((a, x) => a + x, 0)) : null
      const topProperty = b.props.slice().sort((a, x) => x.premium - a.premium)[0]?.address ?? null
      details[name] = { count: b.count, avgRisk, totalPremium, topProperty, growth: null }
    }
    return { segments, details, generatedAt: now.toISOString() }
  } catch (err) {
    logger.warn('dashboardPortfolioMix failed', { error: err instanceof Error ? err.message : err })
    return { segments: [], details: {}, generatedAt: now.toISOString() }
  }
}

export async function getDashboardInsights(_userId: string): Promise<DashboardInsightsResponse> {
  const insights: DashboardInsight[] = []
  return { insights, generatedAt: new Date().toISOString() }
}

export async function getDashboardActiveCarriers(userId: string): Promise<DashboardActiveCarriersResponse> {
  const now = new Date()
  try {
    const rows = await prisma.savedProperty.findMany({
      where: { userId },
      select: { property: { select: { displayAddress: true, carriers: { select: { id: true, name: true, rating: true, specialty: true } } } }, client: { select: { firstName: true, lastName: true } } },
    })
    const byCarrierId = new Map<number, DashboardActiveCarrier>()
    for (const r of rows) {
      const propAddr = r.property?.displayAddress ?? ''
      const clientName = r.client ? `${r.client.firstName ?? ''} ${r.client.lastName ?? ''}`.trim() : ''
      for (const c of r.property?.carriers ?? []) {
        const existing = byCarrierId.get(c.id) ?? {
          id: c.id, name: c.name, properties: [], clients: [],
          rating: c.rating ?? '—', specialty: c.specialty ?? '—',
          quoteRange: '—', responseTime: '—', bindingReady: false, appetite: 'Moderate' as const,
        }
        if (propAddr && !existing.properties.includes(propAddr)) existing.properties.push(propAddr)
        if (clientName && !existing.clients.includes(clientName)) existing.clients.push(clientName)
        byCarrierId.set(c.id, existing)
      }
    }
    return { carriers: Array.from(byCarrierId.values()), generatedAt: now.toISOString() }
  } catch (err) {
    logger.warn('dashboardActiveCarriers failed', { error: err instanceof Error ? err.message : err })
    return { carriers: [], generatedAt: now.toISOString() }
  }
}
