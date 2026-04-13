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

// ─── Climate Projection Risk Types ──────────────────────────────────────────

export interface HeatRisk extends RiskFactor {
  /** Average number of days/year exceeding 100°F (current) */
  extremeHeatDays: number
  /** Projected extreme heat days in 2050 under RCP 4.5 (moderate warming) */
  projectedHeatDays2050: number | null
  /** Urban heat island intensity (°F above surrounding rural areas) */
  urbanHeatIslandEffect: number | null
  /** Whether cooling infrastructure is below regional average */
  coolingInfrastructureDeficit: boolean
}

export interface DroughtRisk extends RiskFactor {
  /** Palmer Drought Severity Index (−4 extreme drought to +4 extreme wet) */
  palmerDroughtIndex: number | null
  /** Current drought monitor category: D0–D4 or 'NONE' */
  droughtMonitorCategory: 'NONE' | 'D0' | 'D1' | 'D2' | 'D3' | 'D4'
  /** Projected change in annual precipitation by 2050 (percentage) */
  projectedPrecipitationChange2050: number | null
  /** Risk of foundation damage from soil shrink/swell cycles */
  subsidenceRisk: RiskLevel | null
}

// ─── State Risk Profile Types ─────────────────────────────────────────────────

export type BuildingCodeLevel = 'CURRENT' | 'PARTIAL' | 'OUTDATED' | 'NONE'
export type RateRegulationType = 'PRIOR_APPROVAL' | 'FILE_AND_USE' | 'USE_AND_FILE' | 'NO_FILE'
export type CarrierCountTrend = 'STABLE' | 'DECLINING' | 'EXITING'
export type ResidualMarketUsage = 'NONE' | 'LOW' | 'MODERATE' | 'HIGH'
export type ResidualProgramType = 'FAIR_PLAN' | 'BEACH_WIND_POOL' | 'STATE_BACKED' | 'JOINT_UNDERWRITING'

export interface ResidualMarketProgram {
  name: string
  type: ResidualProgramType
  usageLevel: ResidualMarketUsage
}

export interface PerilProfile {
  /** Multiplier vs national average loss ratio. 1.0 = average, 2.0 = twice the losses */
  lossRatioMultiplier: number
  /** True if this peril has caused catastrophic, market-disrupting losses in the state */
  catastrophicRisk: boolean
  /** Minimum score applied in this state regardless of property-level data */
  floorScore?: number
}

export interface StateComplianceInfo {
  buildingCodeLevel: BuildingCodeLevel
  /** 1 (very weak) to 5 (rigorous) enforcement of building codes */
  buildingCodeEnforcement: number
  rateRegulation: RateRegulationType
  mandatoryFloodZones?: boolean
  mandatoryWindstorm?: boolean
  earthquakeDisclosureRequired?: boolean
  naturalHazardDisclosure?: boolean
  sinkholeDisclosure?: boolean
  residualMarketPrograms: ResidualMarketProgram[]
}

export interface StateRiskProfile {
  stateCode: string
  stateName: string
  flood: PerilProfile
  fire: PerilProfile
  wind: PerilProfile
  earthquake: PerilProfile
  crime: PerilProfile
  carrierCountTrend: CarrierCountTrend
  residualMarketUsage: ResidualMarketUsage
  compliance: StateComplianceInfo
  /** Human-readable notable risks for this state */
  knownRisks: string[]
}

/** Runtime context included in the PropertyRiskProfile DTO */
export interface StateRiskContext {
  stateCode: string
  stateName: string
  knownRisks: string[]
  carrierCountTrend: CarrierCountTrend
  residualMarketUsage: ResidualMarketUsage
  compliance: StateComplianceInfo
  /** Points added to each raw score by the state profile modifier (positive = higher risk) */
  scoreModifiers: {
    flood: number
    fire: number
    wind: number
    earthquake: number
    compliance: number
  }
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
  /** Climate projection risk dimensions (optional — populated when climate data is available) */
  heat?: HeatRisk
  drought?: DroughtRisk
  /** Compliance / regulatory risk dimension (weighted 8% in overall score) */
  complianceScore?: number
  /** State-level context and market information */
  stateContext?: StateRiskContext
  generatedAt: string
  cacheTtlSeconds: number
}
