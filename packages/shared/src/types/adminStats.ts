/**
 * Admin portal types (P-B5.a foundation).
 *
 * Shape of GET /api/admin/stats. Read-only system overview surfaced on
 * the admin home page. Write-action types (suspend user, refund sub,
 * etc.) land in later P-B5 follow-ups so each gets its own audit shape.
 */

export interface AdminStats {
  users: {
    total: number
    addedLast30Days: number
    /** Keyed by UserRole enum value (BUYER/AGENT/LENDER/INSURANCE/ADMIN). */
    byRole: Record<string, number>
  }
  subscriptions: {
    active: number
    canceledLast30Days: number
  }
  reports: {
    last30Days: number
  }
  generatedAt: string
}
