/**
 * Dashboard panel endpoint payloads (P-B1.h).
 *
 * Three smaller endpoints in one PR — each backs one of the remaining
 * mock-backed enhanced panels. Closes the mock-imports ALLOWLIST.
 */

// ─── /api/dashboard/portfolio-mix ───────────────────────────────────────────

export interface PortfolioMixSegment {
  /** Category label, e.g. 'Commercial', 'Residential'. */
  name: string
  /** Percent share, 0-100. Computed from saved-property counts. */
  value: number
  /** Display color. */
  color: string
}

export interface PortfolioMixDetail {
  count: number
  avgRisk: number | null
  totalPremium: number | null
  topProperty: string | null
  growth: string | null
}

export interface DashboardPortfolioMixResponse {
  segments: PortfolioMixSegment[]
  details: Record<string, PortfolioMixDetail>
  generatedAt: string
}

// ─── /api/dashboard/insights ────────────────────────────────────────────────

export interface DashboardInsight {
  id: number
  type: 'alert' | 'opportunity' | 'trend'
  icon: string
  title: string
  body: string
  time: string
  priority: 'high' | 'medium' | 'low'
}

export interface DashboardInsightsResponse {
  insights: DashboardInsight[]
  generatedAt: string
}

// ─── /api/dashboard/active-carriers ─────────────────────────────────────────

export interface DashboardActiveCarrier {
  id: number
  name: string
  properties: string[]
  clients: string[]
  rating: string
  specialty: string
  quoteRange: string
  responseTime: string
  bindingReady: boolean
  appetite: 'Strong' | 'Moderate' | 'Weak'
}

export interface DashboardActiveCarriersResponse {
  carriers: DashboardActiveCarrier[]
  generatedAt: string
}
