import type { RiskLevel } from './risk'

export interface InsuranceCoverageType {
  type: CoverageType
  required: boolean
  averageAnnualPremium: number
  lowEstimate: number
  highEstimate: number
  notes: string[]
}

export type CoverageType =
  | 'HOMEOWNERS'
  | 'FLOOD'
  | 'EARTHQUAKE'
  | 'WIND_HURRICANE'
  | 'UMBRELLA'
  | 'FIRE'

export interface InsuranceCostEstimate {
  propertyId: string
  estimatedAnnualTotal: number
  estimatedMonthlyTotal: number
  confidenceLevel: ConfidenceLevel
  coverages: InsuranceCoverageType[]
  keyRiskFactors: string[]
  recommendations: string[]
  disclaimers: string[]
  generatedAt: string
}

export type ConfidenceLevel = 'LOW' | 'MEDIUM' | 'HIGH'

export interface InsurabilityStatus {
  propertyId: string
  isInsurable: boolean
  difficultyLevel: RiskLevel
  potentialIssues: string[]
  recommendedActions: string[]
}

export interface Carrier {
  id: string
  name: string
  amBestRating: string        // e.g. 'A+', 'A', 'B+'
  writingStatus: CarrierWritingStatus
  coverageTypes: CoverageType[]
  avgPremiumModifier: number  // multiplier vs market avg (1.0 = market rate)
  statesLicensed: string[]
  specialties: string[]
  notes: string | null
}

export type CarrierWritingStatus = 'ACTIVELY_WRITING' | 'LIMITED' | 'NOT_WRITING' | 'SURPLUS_LINES'

export interface CarriersResult {
  propertyId: string
  carriers: Carrier[]
  marketCondition: MarketCondition
  lastUpdated: string
}

export type MarketCondition = 'SOFT' | 'MODERATE' | 'HARD' | 'CRISIS'
