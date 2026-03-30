import type { RiskLevel } from '../types/risk'
import type { CoverageType } from '../types/insurance'

export function formatCurrency(amount: number, options?: Intl.NumberFormatOptions): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
    ...options,
  }).format(amount)
}

export function formatAddress(parts: {
  address: string
  city: string
  state: string
  zip: string
}): string {
  return `${parts.address}, ${parts.city}, ${parts.state} ${parts.zip}`
}

export function riskLevelToLabel(level: RiskLevel): string {
  const labels: Record<RiskLevel, string> = {
    LOW: 'Low',
    MODERATE: 'Moderate',
    HIGH: 'High',
    VERY_HIGH: 'Very High',
    EXTREME: 'Extreme',
  }
  return labels[level]
}

export function riskLevelToColor(level: RiskLevel): string {
  const colors: Record<RiskLevel, string> = {
    LOW: 'green',
    MODERATE: 'yellow',
    HIGH: 'orange',
    VERY_HIGH: 'red',
    EXTREME: 'red',
  }
  return colors[level]
}

export function formatCoverageType(type: CoverageType): string {
  const labels: Record<CoverageType, string> = {
    HOMEOWNERS: 'Homeowners',
    FLOOD: 'Flood',
    EARTHQUAKE: 'Earthquake',
    WIND_HURRICANE: 'Wind/Hurricane',
    UMBRELLA: 'Umbrella',
    FIRE: 'Fire',
  }
  return labels[type]
}

export function formatSquareFeet(sqft: number | null): string {
  if (!sqft) return 'Unknown'
  return new Intl.NumberFormat('en-US').format(sqft) + ' sq ft'
}

export function formatAcres(sqft: number | null): string {
  if (!sqft) return 'Unknown'
  const acres = sqft / 43560
  return acres.toFixed(2) + ' acres'
}
