export type RiskLevel = 'LOW' | 'MODERATE' | 'HIGH' | 'VERY_HIGH' | 'EXTREME'

export type RiskTrend = 'IMPROVING' | 'STABLE' | 'WORSENING'

export interface RiskFactor {
  level: RiskLevel
  score: number // 0–100
  trend: RiskTrend
  description: string
  details: string[]
  dataSource: string
  lastUpdated: string
}

export interface FloodRisk extends RiskFactor {
  floodZone: string // e.g. 'AE', 'X', 'VE'
  firmPanelId: string | null
  baseFloodElevation: number | null // feet
  inSpecialFloodHazardArea: boolean
  annualChanceOfFlooding: number | null // percentage
}

export interface FireRisk extends RiskFactor {
  fireHazardSeverityZone: string | null // CA-specific
  wildlandUrbanInterface: boolean
  nearestFireStation: number | null // miles
  vegetationDensity: string | null
}

export interface WindRisk extends RiskFactor {
  designWindSpeed: number | null // mph
  hurricaneRisk: boolean
  tornadoRisk: boolean
  hailRisk: boolean
}

export interface EarthquakeRisk extends RiskFactor {
  seismicZone: string | null
  nearestFaultLine: number | null // miles
  soilType: string | null
  liquefactionPotential: RiskLevel | null
}

export interface CrimeRisk extends RiskFactor {
  violentCrimeIndex: number
  propertyCrimeIndex: number
  nationalAverageDiff: number // percentage diff from national avg
}

export interface PropertyRiskProfile {
  propertyId: string
  overallRiskLevel: RiskLevel
  overallRiskScore: number // 0–100
  flood: FloodRisk
  fire: FireRisk
  wind: WindRisk
  earthquake: EarthquakeRisk
  crime: CrimeRisk
  stateContext?: StateRiskContext
  generatedAt: string
  cacheTtlSeconds: number
}

// ─── State Risk Context Types ─────────────────────────────────────────────────

export type StateMarketCondition = 'STABLE' | 'STRESSED' | 'HARD' | 'CRISIS'
export type RateRegulationType = 'PRIOR_APPROVAL' | 'FILE_AND_USE' | 'USE_AND_FILE' | 'NO_FILE'
export type BuildingCodeStrength = 'STRONG' | 'MODERATE' | 'WEAK' | 'NONE'

export interface StatePerilModifier {
  /** Minimum score floor for this peril in this state */
  floor?: number
  /** Multiplier applied to raw score (e.g. 1.15 = 15% boost) */
  multiplier?: number
  /** Human-readable explanation of why this modifier exists */
  reason: string
  /** Whether this modifier actually changed the property's score */
  applied?: boolean
}

export interface ResidualMarketProgram {
  name: string
  type: 'FAIR_PLAN' | 'WIND_POOL' | 'STATE_INSURER' | 'BEACH_PLAN'
  coverageTypes: string[]
  notes: string
}

export interface StateMarketProfile {
  condition: StateMarketCondition
  carriersExiting: boolean
  residualMarketGrowth: boolean
  notes: string[]
}

export interface StateRegulatoryProfile {
  rateRegulation: RateRegulationType
  rateRegulationNotes: string
  buildingCodeStrength: BuildingCodeStrength
  buildingCodeNotes: string
  residualMarketPrograms: ResidualMarketProgram[]
  requiredDisclosures: string[]
  mandatedCoverages: string[]
  complianceNotes: string[]
}

export interface StateRiskContext {
  stateCode: string
  stateName: string
  flood?: StatePerilModifier
  fire?: StatePerilModifier
  wind?: StatePerilModifier
  earthquake?: StatePerilModifier
  market: StateMarketProfile
  regulatory: StateRegulatoryProfile
  knownCatastrophicExposures: string[]
  notes: string[]
}
