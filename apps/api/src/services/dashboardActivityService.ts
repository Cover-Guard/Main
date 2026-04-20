/**
 * Dashboard activity ticker — aggregates live, real-data signals for the
 * dashboard KPI strip:
 *   - End-user activity from `SavedProperty`, `SearchHistory`, `QuoteRequest`.
 *   - Portfolio aggregations (sum of estimated value, mean risk score).
 *   - Public market context (Federal Reserve / FRED time series, opportunistic
 *     — gracefully degrades to null when no API key is configured).
 *   - Health badges for each upstream integration we depend on.
 *
 * Replaces the prior client-side `useRealtimeValue` Math.random ticker.
 */

import { prisma } from '../utils/prisma'
import { logger } from '../utils/logger'
import type {
  DashboardTicker,
  DataSourceHealth,
  PublicMarketMetric,
  RecentSavedActivity,
  TickerDirection,
  TickerKpi,
} from '@coverguard/shared'

const REFRESH_INTERVAL_SECONDS = 60

/** Round to nearest integer, treating null as null. */
function r0(v: number | null | undefined): number | null {
  if (v == null || !Number.isFinite(v)) return null
  return Math.round(v)
}

function fmtCurrency(v: number | null): string {
  if (v == null) return '—'
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`
  if (v >= 1_000) return `$${(v / 1_000).toFixed(1)}K`
  return `$${Math.round(v).toLocaleString()}`
}

function fmtNumber(v: number | null, decimals = 0): string {
  if (v == null) return '—'
  return v.toLocaleString(undefined, { maximumFractionDigits: decimals })
}

function direction(curr: number | null, prior: number | null): TickerDirection {
  if (curr == null || prior == null) return 'flat'
  if (curr > prior) return 'up'
  if (curr < prior) return 'down'
  return 'flat'
}

function delta(curr: number | null, prior: number | null): { delta: number | null; deltaPercent: number | null } {
  if (curr == null || prior == null) return { delta: null, deltaPercent: null }
  const d = curr - prior
  if (prior === 0) return { delta: d, deltaPercent: null }
  return { delta: d, deltaPercent: (d / prior) * 100 }
}

// ─── Activity aggregation ───────────────────────────────────────────────────

interface UserActivity {
  savedCount: number
  priorSavedCount: number
  searchesLast7d: number
  searchesPrior7d: number
  quoteRequests: number
  priorQuoteRequests: number
  portfolioValue: number | null
  priorPortfolioValue: number | null
  avgRiskScore: number | null
  avgInsuranceCost: number | null
  recent: RecentSavedActivity[]
}

// NOTE: `marketValue` is NOT selected here because it is not a persisted
// Property column — it is enriched at read time by propertyService via the
// AVM (Automated Valuation Model) fetch. Selecting it via Prisma triggers a
// PrismaClientValidationError ("Unknown field marketValue on Property") which
// the errorHandler maps to HTTP 400 — previously breaking /api/dashboard/ticker.
const PROPERTY_FIELDS = {
  id: true,
  address: true,
  city: true,
  state: true,
  estimatedValue: true,
} as const

async function loadUserActivity(userId: string): Promise<UserActivity> {
  const now = new Date()
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
  const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000)

  const [
    saved,
    priorSavedCount,
    searchesLast7d,
    searchesPrior7d,
    quoteRequests,
    priorQuoteRequests,
    avgInsurance,
  ] = await Promise.all([
    prisma.savedProperty.findMany({
      where: { userId },
      select: {
        id: true,
        savedAt: true,
        property: {
          select: {
            ...PROPERTY_FIELDS,
            riskProfile: { select: { overallRiskScore: true } },
          },
        },
      },
      orderBy: { savedAt: 'desc' },
    }),
    prisma.savedProperty.count({ where: { userId, savedAt: { lt: sevenDaysAgo } } }),
    prisma.searchHistory.count({ where: { userId, searchedAt: { gte: sevenDaysAgo } } }),
    prisma.searchHistory.count({
      where: { userId, searchedAt: { gte: fourteenDaysAgo, lt: sevenDaysAgo } },
    }),
    prisma.quoteRequest.count({ where: { userId } }),
    prisma.quoteRequest.count({ where: { userId, submittedAt: { lt: sevenDaysAgo } } }),
    prisma.insuranceEstimate
      .aggregate({
        _avg: { estimatedAnnualTotal: true },
        where: {
          property: { savedBy: { some: { userId } } },
        },
      })
      .catch(() => ({ _avg: { estimatedAnnualTotal: null } })),
  ])

  const portfolioValue = saved.reduce((sum, s) => {
    const val = s.property?.estimatedValue ?? 0
    return sum + val
  }, 0)

  // Prior portfolio value = sum of estimated value for properties saved at
  // least 7 days ago. Approximation — we don't snapshot historical values.
  const priorSavedRecords = saved.filter((s) => s.savedAt < sevenDaysAgo)
  const priorPortfolioValue = priorSavedRecords.reduce((sum, s) => {
    const val = s.property?.estimatedValue ?? 0
    return sum + val
  }, 0)

  const riskScores = saved
    .map((s) => s.property?.riskProfile?.overallRiskScore ?? null)
    .filter((v): v is number => v != null)
  const avgRiskScore =
    riskScores.length > 0
      ? riskScores.reduce((a, b) => a + b, 0) / riskScores.length
      : null

  const recent: RecentSavedActivity[] = saved.slice(0, 5).map((s) => ({
    propertyId: s.property?.id ?? '',
    address: s.property?.address ?? '',
    city: s.property?.city ?? '',
    state: s.property?.state ?? '',
    estimatedValue: s.property?.estimatedValue ?? null,
    riskScore: s.property?.riskProfile?.overallRiskScore ?? null,
    savedAt: s.savedAt.toISOString(),
  }))

  return {
    savedCount: saved.length,
    priorSavedCount,
    searchesLast7d,
    searchesPrior7d,
    quoteRequests,
    priorQuoteRequests,
    portfolioValue: portfolioValue > 0 ? portfolioValue : null,
    priorPortfolioValue: priorPortfolioValue > 0 ? priorPortfolioValue : null,
    avgRiskScore,
    avgInsuranceCost: avgInsurance._avg.estimatedAnnualTotal ?? null,
    recent,
  }
}

function buildKpis(a: UserActivity): TickerKpi[] {
  const portfolio = r0(a.portfolioValue)
  const priorPortfolio = r0(a.priorPortfolioValue)
  const portfolioDelta = delta(portfolio, priorPortfolio)

  const savedDelta = delta(a.savedCount, a.priorSavedCount)
  const searchesDelta = delta(a.searchesLast7d, a.searchesPrior7d)
  const quotesDelta = delta(a.quoteRequests, a.priorQuoteRequests)

  const avgRisk = a.avgRiskScore != null ? Math.round(a.avgRiskScore * 10) / 10 : null
  const avgInsurance = r0(a.avgInsuranceCost)

  return [
    {
      key: 'portfolioValue',
      label: 'Portfolio Value',
      value: portfolio,
      display: fmtCurrency(portfolio),
      direction: direction(portfolio, priorPortfolio),
      ...portfolioDelta,
    },
    {
      key: 'savedCount',
      label: 'Saved Properties',
      value: a.savedCount,
      display: fmtNumber(a.savedCount),
      direction: direction(a.savedCount, a.priorSavedCount),
      ...savedDelta,
    },
    {
      key: 'searchesLast7d',
      label: 'Searches (7d)',
      value: a.searchesLast7d,
      display: fmtNumber(a.searchesLast7d),
      direction: direction(a.searchesLast7d, a.searchesPrior7d),
      ...searchesDelta,
    },
    {
      key: 'quoteRequests',
      label: 'Quote Requests',
      value: a.quoteRequests,
      display: fmtNumber(a.quoteRequests),
      direction: direction(a.quoteRequests, a.priorQuoteRequests),
      ...quotesDelta,
    },
    {
      key: 'avgRiskScore',
      label: 'Avg Risk Score',
      value: avgRisk,
      display: avgRisk != null ? avgRisk.toFixed(1) : '—',
      direction: 'flat',
      delta: null,
      deltaPercent: null,
    },
    {
      key: 'avgInsuranceCost',
      label: 'Avg Annual Premium',
      value: avgInsurance,
      display: fmtCurrency(avgInsurance),
      direction: 'flat',
      delta: null,
      deltaPercent: null,
    },
  ]
}

// ─── Data source health ─────────────────────────────────────────────────────

interface SourceDef {
  key: string
  label: string
  category: DataSourceHealth['category']
  /** Env var(s) that, when set, indicate the integration is configured. */
  envKeys?: string[]
  /** Static healthy = always reachable public endpoint. */
  staticHealthy?: boolean
  note?: string
}

const SOURCES: SourceDef[] = [
  { key: 'fema_nfhl', label: 'FEMA NFHL (flood zones)', category: 'flood', staticHealthy: true },
  { key: 'openfema_claims', label: 'OpenFEMA Claims', category: 'flood', staticHealthy: true },
  { key: 'esri_flood', label: 'Esri USA Flood Hazard', category: 'flood', staticHealthy: true },
  { key: 'noaa_slosh', label: 'NOAA Coastal Flood Composite', category: 'wind', staticHealthy: true },
  { key: 'usfs_wui', label: 'USFS Wildland-Urban Interface', category: 'fire', staticHealthy: true },
  { key: 'usda_wildfire', label: 'USDA Wildfire Risk (Esri)', category: 'fire', staticHealthy: true },
  { key: 'usgs_seismic', label: 'USGS National Seismic Hazard', category: 'earthquake', staticHealthy: true },
  { key: 'usgs_landslide', label: 'USGS Landslide (Esri)', category: 'earthquake', staticHealthy: true },
  { key: 'us_drought_monitor', label: 'US Drought Monitor (Esri)', category: 'climate', staticHealthy: true },
  { key: 'cdc_svi', label: 'CDC Social Vulnerability Index (Esri)', category: 'crime', staticHealthy: true },
  {
    key: 'fbi_cde',
    label: 'FBI Crime Data Explorer',
    category: 'crime',
    envKeys: ['FBI_CDE_KEY', 'FBI_UCR_API_KEY'],
    note: 'Optional — falls back to Census ACS estimates when key is absent.',
  },
  {
    key: 'google_maps',
    label: 'Google Maps / Places',
    category: 'maps',
    envKeys: ['GOOGLE_MAPS_API_KEY', 'NEXT_PUBLIC_GOOGLE_MAPS_API_KEY'],
  },
  {
    key: 'attom',
    label: 'ATTOM Property Data',
    category: 'property',
    envKeys: ['ATTOM_API_KEY', 'RENTCAST_API_KEY'],
    note: 'Optional — mock data is used if absent.',
  },
  {
    key: 'walk_score',
    label: 'Walk Score',
    category: 'property',
    envKeys: ['WALK_SCORE_API_KEY'],
    note: 'Optional — neighborhood walkability omitted if absent.',
  },
]

function buildDataSources(): DataSourceHealth[] {
  return SOURCES.map<DataSourceHealth>((s) => {
    if (s.staticHealthy) return { key: s.key, label: s.label, category: s.category, status: 'HEALTHY', note: s.note }
    const configured = (s.envKeys ?? []).some((k) => !!process.env[k])
    return {
      key: s.key,
      label: s.label,
      category: s.category,
      status: configured ? 'HEALTHY' : 'NOT_CONFIGURED',
      note: s.note,
    }
  })
}

// ─── Public real-estate market context ──────────────────────────────────────
// FRED is free with an API key. When `FRED_API_KEY` is absent we silently
// return an empty list — the UI hides the section.

interface FredObservation {
  date: string
  value: string
}

interface FredResponse {
  observations?: FredObservation[]
}

const FRED_SERIES = [
  { id: 'CSUSHPISA', label: 'Case-Shiller Home Price Index', unit: 'index', source: 'FRED: CSUSHPISA' },
  { id: 'MSPUS', label: 'US Median Sale Price', unit: 'USD', source: 'FRED: MSPUS' },
  { id: 'MORTGAGE30US', label: '30-yr Fixed Mortgage Rate', unit: '%', source: 'FRED: MORTGAGE30US' },
  { id: 'CSUSHPINSA', label: 'Case-Shiller (Non-Seasonally Adjusted)', unit: 'index', source: 'FRED: CSUSHPINSA' },
] as const

async function fetchFredSeries(seriesId: string, apiKey: string): Promise<FredObservation | null> {
  try {
    const url =
      `https://api.stlouisfed.org/fred/series/observations?series_id=${seriesId}` +
      `&api_key=${apiKey}&file_type=json&sort_order=desc&limit=1`
    const res = await fetch(url, { signal: AbortSignal.timeout(5_000) })
    if (!res.ok) return null
    const data = (await res.json()) as FredResponse
    return data.observations?.[0] ?? null
  } catch (err) {
    logger.warn('FRED fetch failed', { seriesId, err: err instanceof Error ? err.message : err })
    return null
  }
}

async function buildPublicMetrics(): Promise<PublicMarketMetric[]> {
  const apiKey = process.env.FRED_API_KEY
  if (!apiKey) return []

  const observations = await Promise.all(
    FRED_SERIES.map((s) => fetchFredSeries(s.id, apiKey).then((obs) => ({ s, obs }))),
  )

  return observations
    .filter(({ obs }) => obs && obs.value && obs.value !== '.')
    .map<PublicMarketMetric>(({ s, obs }) => {
      const numericValue = obs ? parseFloat(obs.value) : NaN
      const value = Number.isFinite(numericValue) ? numericValue : null
      let display: string
      if (value == null) display = '—'
      else if (s.unit === 'USD') display = fmtCurrency(value)
      else if (s.unit === '%') display = `${value.toFixed(2)}%`
      else display = value.toFixed(1)
      return {
        key: s.id,
        label: s.label,
        value,
        display,
        unit: s.unit,
        source: s.source,
        observedAt: obs?.date ? `${obs.date}T00:00:00Z` : null,
      }
    })
}

// ─── Public entry point ─────────────────────────────────────────────────────

export async function getDashboardTicker(userId: string): Promise<DashboardTicker> {
  const [activity, publicMetrics] = await Promise.all([
    loadUserActivity(userId),
    buildPublicMetrics().catch((err) => {
      logger.warn('Public metrics fetch failed', { err: err instanceof Error ? err.message : err })
      return [] as PublicMarketMetric[]
    }),
  ])

  return {
    kpis: buildKpis(activity),
    dataSources: buildDataSources(),
    publicMetrics,
    recentActivity: activity.recent,
    generatedAt: new Date().toISOString(),
    refreshIntervalSeconds: REFRESH_INTERVAL_SECONDS,
  }
}
