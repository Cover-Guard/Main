/**
 * Per-KPI detail surfaced by GET /api/dashboard/kpis (P-B1.e).
 *
 * Extends what's already available on /api/dashboard/ticker with the
 * per-KPI drill-down the dashboard's KPI modal needs: target, change,
 * breakdown, and a sparkline series.
 *
 * Keyed by TickerKpi['key'] so the panel can look up by the same id it
 * already uses for the ticker.
 *
 * Foundation contract: target / change / breakdown / history can be
 * empty for KPIs we haven't yet computed time-series data for — the UI
 * is expected to render gracefully when fields are empty. Later
 * follow-ups (B1.e2 / B1.e3) fill in real values as snapshots accrue.
 */

import type { TickerKpi } from './ticker'

export interface KpiBreakdownItem {
  label: string
  value: number
}

export interface KpiHistoryPoint {
  /** Display label for the X axis (e.g. 'Jan', 'Wk 12', '2026-01'). */
  period: string
  /** Numeric value for that period. */
  value: number
}

export interface KpiDetail {
  /** Optional target value the agent is trending toward. */
  target: number | null
  /** Human-readable change vs. the prior period (e.g. '+5.2%', '-12'). */
  change: string | null
  /** Per-category breakdown (rendered as a horizontal bar list). */
  breakdown: KpiBreakdownItem[]
  /** Time-series sparkline (rendered as an area chart). */
  history: KpiHistoryPoint[]
}

export interface DashboardKpisResponse {
  /** Keyed by TickerKpi.key — same ids as /api/dashboard/ticker uses. */
  kpis: Partial<Record<TickerKpi['key'], KpiDetail>>
  generatedAt: string
}
