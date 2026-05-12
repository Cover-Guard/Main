/**
 * Per-month premium / claims forecast returned by GET /api/dashboard/forecast
 * (P-B1.f). Powers the ForecastPanel area chart on the agent dashboard.
 *
 * Foundation contract: `claims` is `null` for periods we don't have claim
 * data on (everything, for now — there's no claims table yet). The UI is
 * expected to render gracefully when claims is null. Subsequent PRs
 * (B1.f2) wire real claims data once it lands.
 *
 * `projected` is a forward-looking estimate; `premium` is the realized /
 * current-snapshot value. For past months we have premium and no
 * projected; for future months we have projected and no premium.
 */

export interface ForecastDataPoint {
  /** Short display label, e.g. 'Jan', 'Feb'. */
  month: string
  /** ISO yyyy-mm so the UI can sort / compute deltas reliably. */
  periodKey: string
  /** Realized / current-snapshot premium (USD). null for future periods. */
  premium: number | null
  /** Forward projection (USD). null for past periods. */
  projected: number | null
  /** Claims paid (USD). null when no data. */
  claims: number | null
  /** Loss ratio = claims / premium × 100. null when either input is null. */
  loss: number | null
}

export interface DashboardForecastResponse {
  /** 12 months centered on the current month — 6 past + current + 5 forward. */
  series: ForecastDataPoint[]
  generatedAt: string
}
