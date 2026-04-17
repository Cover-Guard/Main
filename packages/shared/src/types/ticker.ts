/**
 * Live dashboard ticker — replaces the prior `useRealtimeValue` Math.random
 * stub. The values are derived from real user activity (saved properties,
 * search history, quote requests), portfolio aggregations, and the health of
 * upstream data integrations.
 */

export type TickerDirection = 'up' | 'down' | 'flat'

/** A single numeric KPI shown in the dashboard ticker. */
export interface TickerKpi {
  /** Stable machine-readable key — used by the UI for icons / formatting. */
  key:
    | 'portfolioValue'
    | 'savedCount'
    | 'searchesLast7d'
    | 'quoteRequests'
    | 'avgRiskScore'
    | 'avgInsuranceCost'
  label: string
  /** Current numeric value (already rounded). null = no data yet. */
  value: number | null
  /** Pre-formatted display string ($1.2M, "47", "58.2", etc.). */
  display: string
  /** Direction vs the prior 7-day window (or vs the previous fetch). */
  direction: TickerDirection
  /** Raw delta (current − prior); null when no prior data. */
  delta: number | null
  /** Percentage change vs prior window; null when no prior data or div-by-zero. */
  deltaPercent: number | null
}

export type DataSourceStatus = 'HEALTHY' | 'DEGRADED' | 'NOT_CONFIGURED' | 'UNKNOWN'

export interface DataSourceHealth {
  /** Stable identifier — `fema_nfhl`, `google_maps`, etc. */
  key: string
  /** Human-readable name — `FEMA National Flood Hazard Layer` */
  label: string
  /** Category bucket the UI groups by. */
  category: 'flood' | 'fire' | 'wind' | 'earthquake' | 'crime' | 'climate' | 'maps' | 'property'
  status: DataSourceStatus
  /** Optional one-line note shown in the UI tooltip. */
  note?: string
}

export interface PublicMarketMetric {
  /** Stable machine key — `case_shiller`, `mortgage_30y`, etc. */
  key: string
  label: string
  /** Numeric value, already rounded. */
  value: number | null
  display: string
  unit: string
  /** Source citation shown in the UI (e.g. "FRED: CSUSHPISA"). */
  source: string
  /** ISO timestamp of the underlying observation. */
  observedAt: string | null
}

/** Recently saved property card surfaced in the activity feed. */
export interface RecentSavedActivity {
  propertyId: string
  address: string
  city: string
  state: string
  estimatedValue: number | null
  riskScore: number | null
  savedAt: string
}

export interface DashboardTicker {
  kpis: TickerKpi[]
  dataSources: DataSourceHealth[]
  publicMetrics: PublicMarketMetric[]
  recentActivity: RecentSavedActivity[]
  /** ISO timestamp the payload was generated. */
  generatedAt: string
  /** Recommended client polling interval (seconds). */
  refreshIntervalSeconds: number
}
