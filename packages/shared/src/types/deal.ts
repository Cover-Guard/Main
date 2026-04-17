/**
 * Pipeline deals — track each property opportunity from prospect through
 * close-won or fall-out, with the cause of any fallout for analysis.
 */

export type DealStage =
  | 'PROSPECT'
  | 'IN_PROGRESS'
  | 'UNDER_CONTRACT'
  | 'CLOSED_WON'
  | 'FELL_OUT'

export type DealFalloutReason =
  | 'INSURABILITY'
  | 'PRICING_TOO_HIGH'
  | 'CARRIER_DECLINED'
  | 'CLIENT_BACKED_OUT'
  | 'INSPECTION_ISSUES'
  | 'FINANCING_FELL_THROUGH'
  | 'APPRAISAL_LOW'
  | 'TITLE_ISSUES'
  | 'COMPETING_OFFER'
  | 'PROPERTY_CONDITION'
  | 'OTHER'

export const DEAL_STAGES: readonly DealStage[] = [
  'PROSPECT',
  'IN_PROGRESS',
  'UNDER_CONTRACT',
  'CLOSED_WON',
  'FELL_OUT',
]

export const DEAL_FALLOUT_REASONS: readonly DealFalloutReason[] = [
  'INSURABILITY',
  'PRICING_TOO_HIGH',
  'CARRIER_DECLINED',
  'CLIENT_BACKED_OUT',
  'INSPECTION_ISSUES',
  'FINANCING_FELL_THROUGH',
  'APPRAISAL_LOW',
  'TITLE_ISSUES',
  'COMPETING_OFFER',
  'PROPERTY_CONDITION',
  'OTHER',
]

/** Human-readable labels for the UI. */
export const DEAL_STAGE_LABELS: Record<DealStage, string> = {
  PROSPECT: 'Prospect',
  IN_PROGRESS: 'In Progress',
  UNDER_CONTRACT: 'Under Contract',
  CLOSED_WON: 'Closed Won',
  FELL_OUT: 'Fell Out',
}

export const DEAL_FALLOUT_REASON_LABELS: Record<DealFalloutReason, string> = {
  INSURABILITY: 'Insurability — could not get coverage',
  PRICING_TOO_HIGH: 'Premium too high',
  CARRIER_DECLINED: 'Carrier declined',
  CLIENT_BACKED_OUT: 'Client backed out',
  INSPECTION_ISSUES: 'Inspection issues',
  FINANCING_FELL_THROUGH: 'Financing fell through',
  APPRAISAL_LOW: 'Low appraisal',
  TITLE_ISSUES: 'Title issues',
  COMPETING_OFFER: 'Lost to competing offer',
  PROPERTY_CONDITION: 'Property condition',
  OTHER: 'Other',
}

export interface Deal {
  id: string
  userId: string
  propertyId: string | null
  clientId: string | null
  title: string
  stage: DealStage
  dealValue: number | null
  carrierName: string | null
  falloutReason: DealFalloutReason | null
  falloutNotes: string | null
  notes: string | null
  openedAt: string
  closedAt: string | null
  createdAt: string
  updatedAt: string
}

export interface DealWithRelations extends Deal {
  property: {
    id: string
    address: string
    city: string
    state: string
  } | null
  client: {
    id: string
    firstName: string
    lastName: string
  } | null
}

export interface DealStageCount {
  stage: DealStage
  count: number
  totalValue: number
}

export interface DealFalloutBreakdown {
  reason: DealFalloutReason
  count: number
  /** Sum of `dealValue` for fell-out deals with this reason. */
  lostValue: number
  percentage: number
}

export interface DealStats {
  /** Number of deals across all stages. */
  totalDeals: number
  /** Number of deals in CLOSED_WON. */
  closedWonCount: number
  /** Number of deals in FELL_OUT. */
  fellOutCount: number
  /** Number of deals still active (not CLOSED_WON or FELL_OUT). */
  activeCount: number
  /**
   * Close rate: closedWonCount / (closedWonCount + fellOutCount).
   * `null` when there are no settled deals yet.
   */
  closeRate: number | null
  /** Sum of `dealValue` for all CLOSED_WON deals. */
  closedWonValue: number
  /** Sum of `dealValue` for all FELL_OUT deals (revenue lost). */
  fellOutValue: number
  /** Average days from `openedAt` to `closedAt` for CLOSED_WON deals. */
  avgCloseTimeDays: number | null
  byStage: DealStageCount[]
  falloutBreakdown: DealFalloutBreakdown[]
  /** ISO timestamp the stats were generated. */
  generatedAt: string
}
