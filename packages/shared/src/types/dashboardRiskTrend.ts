/**
 * Risk-trend dashboard payload (P-B1.g).
 *
 * Backs the RiskTrendPanel chart on the agent dashboard.
 *
 * Foundation behavior: in the absence of a RiskProfile snapshot history,
 * every point in `series` carries the current saved-portfolio average
 * risk score. The shape is in place so B1.g2 (snapshot table) can fill
 * in real per-month values without any UI / type changes.
 *
 * `annotations` mark significant portfolio events (mitigation upgrades,
 * claims). Foundation: empty array. B1.g2 wires events from the
 * SearchHistory / QuoteRequest / AuditTrail tables.
 */

export interface RiskTrendDataPoint {
  /** Short display label, e.g. 'Jan'. */
  month: string
  /** ISO yyyy-mm for sorting / deltas. */
  periodKey: string
  /** Average risk score 0-100. null if no saved properties yet. */
  score: number | null
}

export interface RiskTrendAnnotation {
  /** Display label matching some series point's `month`. */
  month: string
  /** Short human-readable note (≤120 chars). */
  note: string
}

export interface DashboardRiskTrendResponse {
  /** 12 months centered on the current month (6 past + current + 5 forward). */
  series: RiskTrendDataPoint[]
  /** Significant portfolio events overlaid on the line chart. */
  annotations: RiskTrendAnnotation[]
  generatedAt: string
}
