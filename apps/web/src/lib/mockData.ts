/**
 * Demo / mock data for first-run and marketing views.
 *
 * This module lets any page render realistic content before a user has
 * saved properties, created clients, or run searches. The demo toggle is
 * persisted to localStorage under `coverguard-demo-mode` so a user can
 * flip in/out without a backend change.
 *
 * Mock properties are anchored to real high-risk markets (Miami Beach,
 * Pacific Palisades, Houston, etc.) so carrier counts, premium bands,
 * and risk levels line up with what the Hard Market Lookup would show.
 */

import type { AnalyticsSummary } from '@coverguard/shared'

// ─── Demo mode persistence ───────────────────────────────────────────────────

const DEMO_MODE_KEY = 'coverguard-demo-mode'

export function isDemoMode(): boolean {
  if (typeof window === 'undefined') return false
  try {
    return window.localStorage.getItem(DEMO_MODE_KEY) === '1'
  } catch {
    return false
  }
}

export function setDemoMode(on: boolean): void {
  if (typeof window === 'undefined') return
  try {
    if (on) window.localStorage.setItem(DEMO_MODE_KEY, '1')
    else window.localStorage.removeItem(DEMO_MODE_KEY)
  } catch {
    // no-op if storage is blocked
  }
}

// ─── Mock property dataset ──────────────────────────────────────────────────

export type MockMarketStatus = 'crisis' | 'hard' | 'moderate' | 'soft'

export interface MockProperty {
  id: string
  address: string
  city: string
  state: string
  zip: string
  marketStatus: MockMarketStatus
  overallRiskScore: number // 0-100 (higher = riskier)
  dominantRisk: 'flood' | 'wildfire' | 'hurricane' | 'tornado' | 'earthquake' | 'crime'
  carrierCount: number
  estimatedPremium: number // USD/year
  savedAt: string // ISO
  clientId?: string
  clientName?: string
}

export const MOCK_PROPERTIES: MockProperty[] = [
  {
    id: 'mock-prop-001',
    address: '1420 Ocean Dr',
    city: 'Miami Beach',
    state: 'FL',
    zip: '33139',
    marketStatus: 'crisis',
    overallRiskScore: 92,
    dominantRisk: 'hurricane',
    carrierCount: 2,
    estimatedPremium: 14200,
    savedAt: '2026-04-08T14:12:00Z',
    clientId: 'mock-client-001',
    clientName: 'The Harrington Family Trust',
  },
  {
    id: 'mock-prop-002',
    address: '825 Palisades Ave',
    city: 'Pacific Palisades',
    state: 'CA',
    zip: '90272',
    marketStatus: 'crisis',
    overallRiskScore: 89,
    dominantRisk: 'wildfire',
    carrierCount: 1,
    estimatedPremium: 18700,
    savedAt: '2026-04-08T10:31:00Z',
    clientId: 'mock-client-002',
    clientName: 'Elena Vasquez',
  },
  {
    id: 'mock-prop-003',
    address: '3101 Kirby Dr',
    city: 'Houston',
    state: 'TX',
    zip: '77098',
    marketStatus: 'hard',
    overallRiskScore: 74,
    dominantRisk: 'flood',
    carrierCount: 4,
    estimatedPremium: 6800,
    savedAt: '2026-04-07T16:02:00Z',
    clientName: 'Michael Brennan',
  },
  {
    id: 'mock-prop-004',
    address: '44 Sunset Mountain Rd',
    city: 'Asheville',
    state: 'NC',
    zip: '28803',
    marketStatus: 'moderate',
    overallRiskScore: 52,
    dominantRisk: 'wildfire',
    carrierCount: 7,
    estimatedPremium: 2950,
    savedAt: '2026-04-07T11:45:00Z',
    clientId: 'mock-client-003',
    clientName: 'Priya Shah',
  },
  {
    id: 'mock-prop-005',
    address: '1210 Bethel Rd',
    city: 'Columbus',
    state: 'OH',
    zip: '43220',
    marketStatus: 'soft',
    overallRiskScore: 28,
    dominantRisk: 'tornado',
    carrierCount: 12,
    estimatedPremium: 1620,
    savedAt: '2026-04-06T09:10:00Z',
  },
  {
    id: 'mock-prop-006',
    address: '2530 St Charles Ave',
    city: 'New Orleans',
    state: 'LA',
    zip: '70130',
    marketStatus: 'crisis',
    overallRiskScore: 88,
    dominantRisk: 'hurricane',
    carrierCount: 2,
    estimatedPremium: 11400,
    savedAt: '2026-04-05T15:22:00Z',
    clientId: 'mock-client-004',
    clientName: 'Daniel & Rachel Okafor',
  },
  {
    id: 'mock-prop-007',
    address: '4400 Canyon Blvd',
    city: 'Boulder',
    state: 'CO',
    zip: '80301',
    marketStatus: 'hard',
    overallRiskScore: 68,
    dominantRisk: 'wildfire',
    carrierCount: 5,
    estimatedPremium: 4850,
    savedAt: '2026-04-05T08:40:00Z',
  },
  {
    id: 'mock-prop-008',
    address: '7130 E Sahuaro Dr',
    city: 'Scottsdale',
    state: 'AZ',
    zip: '85258',
    marketStatus: 'soft',
    overallRiskScore: 31,
    dominantRisk: 'wildfire',
    carrierCount: 11,
    estimatedPremium: 1780,
    savedAt: '2026-04-04T13:18:00Z',
    clientName: 'Patterson Holdings LLC',
  },
  {
    id: 'mock-prop-009',
    address: '12 Dune Rd',
    city: 'East Quogue',
    state: 'NY',
    zip: '11942',
    marketStatus: 'moderate',
    overallRiskScore: 58,
    dominantRisk: 'hurricane',
    carrierCount: 6,
    estimatedPremium: 5200,
    savedAt: '2026-04-03T17:55:00Z',
  },
  {
    id: 'mock-prop-010',
    address: '88 Meeting St',
    city: 'Charleston',
    state: 'SC',
    zip: '29401',
    marketStatus: 'moderate',
    overallRiskScore: 61,
    dominantRisk: 'flood',
    carrierCount: 6,
    estimatedPremium: 4100,
    savedAt: '2026-04-02T12:07:00Z',
    clientId: 'mock-client-005',
    clientName: 'Savannah Holdings',
  },
]

export interface MockClient {
  id: string
  name: string
  status: 'ACTIVE' | 'PROSPECT' | 'CLOSED' | 'INACTIVE'
  savedPropertyCount: number
}

export const MOCK_CLIENTS: MockClient[] = [
  { id: 'mock-client-001', name: 'The Harrington Family Trust', status: 'ACTIVE', savedPropertyCount: 1 },
  { id: 'mock-client-002', name: 'Elena Vasquez',               status: 'ACTIVE', savedPropertyCount: 1 },
  { id: 'mock-client-003', name: 'Priya Shah',                  status: 'PROSPECT', savedPropertyCount: 1 },
  { id: 'mock-client-004', name: 'Daniel & Rachel Okafor',      status: 'ACTIVE', savedPropertyCount: 1 },
  { id: 'mock-client-005', name: 'Savannah Holdings',           status: 'PROSPECT', savedPropertyCount: 1 },
]

// ─── Analytics series helpers ────────────────────────────────────────────────

/**
 * Produce a realistic daily-searches series ending on `endDate`. Weekdays get
 * higher baseline traffic than weekends, with small random jitter so the line
 * chart isn't flat.
 */
export function generateSearchesByDay(
  days = 30,
  endDate: Date = new Date('2026-04-10T00:00:00Z'),
): Array<{ date: string; count: number }> {
  const out: Array<{ date: string; count: number }> = []
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(endDate)
    d.setUTCDate(d.getUTCDate() - i)
    const dow = d.getUTCDay() // 0=Sun, 6=Sat
    const isWeekend = dow === 0 || dow === 6
    const base = isWeekend ? 4 : 11
    // Deterministic pseudo-random for stable rendering
    const jitter = ((i * 9301 + 49297) % 233280) / 233280
    const count = Math.round(base + jitter * (isWeekend ? 3 : 7))
    out.push({ date: d.toISOString().slice(0, 10), count })
  }
  return out
}

/**
 * Monthly searches with a soft seasonal pattern — higher in hurricane
 * season (Aug–Oct) and after wildfire coverage news. Returns 12 points
 * ending on the month of `endDate`.
 */
export function generateSearchesByMonth(
  endDate: Date = new Date('2026-04-10T00:00:00Z'),
): Array<{ month: string; count: number }> {
  const seasonal = [180, 165, 195, 220, 240, 260, 285, 320, 355, 330, 260, 210]
  const out: Array<{ month: string; count: number }> = []
  for (let i = 11; i >= 0; i--) {
    const d = new Date(endDate)
    d.setUTCMonth(d.getUTCMonth() - i)
    const month = d.toISOString().slice(0, 7)
    const mi = d.getUTCMonth() // 0-11
    out.push({ month, count: seasonal[mi] })
  }
  return out
}

// ─── Full AnalyticsSummary builder ──────────────────────────────────────────

/**
 * Build a complete `AnalyticsSummary` derived from the mock property set,
 * so the analytics dashboard looks populated in demo mode.
 */
export function buildMockAnalytics(): AnalyticsSummary {
  const totalSearches = generateSearchesByMonth().reduce((sum, m) => sum + m.count, 0)
  const totalSavedProperties = MOCK_PROPERTIES.length
  const totalClients = MOCK_CLIENTS.length
  const totalReports = 42

  const searchesByDay = generateSearchesByDay()
  const searchesByMonth = generateSearchesByMonth()

  // Risk distribution from mock properties
  const bucket = { 'Low': 0, 'Moderate': 0, 'High': 0, 'Very High': 0, 'Extreme': 0 }
  for (const p of MOCK_PROPERTIES) {
    if (p.overallRiskScore >= 85) bucket['Extreme']++
    else if (p.overallRiskScore >= 70) bucket['Very High']++
    else if (p.overallRiskScore >= 50) bucket['High']++
    else if (p.overallRiskScore >= 30) bucket['Moderate']++
    else bucket['Low']++
  }
  const riskDistribution = Object.entries(bucket).map(([level, count]) => ({ level, count }))

  // Top states by saved-property count
  const stateCounts = new Map<string, number>()
  for (const p of MOCK_PROPERTIES) {
    stateCounts.set(p.state, (stateCounts.get(p.state) ?? 0) + 1)
  }
  const topStates = [...stateCounts.entries()]
    .map(([state, count]) => ({ state, count }))
    .sort((a, b) => b.count - a.count)

  const recentActivity = [
    { type: 'search',   description: 'Searched 1420 Ocean Dr, Miami Beach FL',   timestamp: '2026-04-10T09:12:00Z' },
    { type: 'save',     description: 'Saved 825 Palisades Ave to Elena Vasquez', timestamp: '2026-04-10T08:44:00Z' },
    { type: 'quote',    description: 'Requested binding quote — The Harrington Family Trust', timestamp: '2026-04-10T07:55:00Z' },
    { type: 'report',   description: 'Generated insurability report — 3101 Kirby Dr, Houston TX', timestamp: '2026-04-09T17:03:00Z' },
    { type: 'client',   description: 'Added prospect — Priya Shah',               timestamp: '2026-04-09T14:28:00Z' },
    { type: 'search',   description: 'Searched 2530 St Charles Ave, New Orleans LA', timestamp: '2026-04-09T11:10:00Z' },
  ]

  const quoteRequests = {
    total: 18,
    pending: 5,
    sent: 4,
    responded: 7,
    declined: 2,
  }

  const clientPipeline = {
    active: 3,
    prospect: 2,
    closed: 0,
    inactive: 0,
  }

  const regionalRisk = topStates.map(({ state, count }) => {
    const props = MOCK_PROPERTIES.filter((p) => p.state === state)
    const avg = props.reduce((s, p) => s + p.overallRiskScore, 0) / props.length
    const dominantRiskLevel =
      avg >= 85 ? 'Extreme' : avg >= 70 ? 'Very High' : avg >= 50 ? 'High' : avg >= 30 ? 'Moderate' : 'Low'
    return {
      state,
      propertyCount: count,
      avgOverallScore: Math.round(avg),
      avgFloodScore:   Math.round(avg * 0.85),
      avgFireScore:    Math.round(avg * 0.90),
      avgWindScore:    Math.round(avg * 0.95),
      avgEarthquakeScore: Math.round(avg * 0.40),
      avgCrimeScore:   Math.round(avg * 0.55),
      dominantRiskLevel,
    }
  })

  const avgInsuranceCost =
    Math.round(
      MOCK_PROPERTIES.reduce((s, p) => s + p.estimatedPremium, 0) / MOCK_PROPERTIES.length,
    )

  return {
    totalSearches,
    totalSavedProperties,
    totalClients,
    totalReports,
    searchesByDay,
    riskDistribution,
    topStates,
    recentActivity,
    quoteRequests,
    clientPipeline,
    regionalRisk,
    searchesByMonth,
    avgInsuranceCost,
  }
}
