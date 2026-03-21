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
  firHazardSeverityZone: string | null // CA-specific
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
  liquidationPotential: RiskLevel | null
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
  generatedAt: string
  cacheTtlSeconds: number
}
