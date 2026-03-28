import { render, screen } from '@testing-library/react'
import { RiskSummary } from '@/components/property/RiskSummary'
import type { PropertyRiskProfile } from '@coverguard/shared'

jest.mock('lucide-react', () => ({
  Droplets: (props: Record<string, unknown>) => <svg data-testid="icon-droplets" {...props} />,
  Flame: (props: Record<string, unknown>) => <svg data-testid="icon-flame" {...props} />,
  Wind: (props: Record<string, unknown>) => <svg data-testid="icon-wind" {...props} />,
  Mountain: (props: Record<string, unknown>) => <svg data-testid="icon-mountain" {...props} />,
  ShieldAlert: (props: Record<string, unknown>) => <svg data-testid="icon-shield-alert" {...props} />,
}))

jest.mock('@/lib/utils', () => ({
  cn: (...args: string[]) => args.filter(Boolean).join(' '),
  riskLevelClasses: () => 'text-green-600',
}))

const baseRiskFactor = {
  trend: 'STABLE' as const,
  description: '',
  details: [],
  dataSource: 'mock',
  lastUpdated: '2024-01-01T00:00:00Z',
}

const mockProfile: PropertyRiskProfile = {
  propertyId: 'prop-1',
  overallRiskScore: 45,
  overallRiskLevel: 'MODERATE' as const,
  flood: {
    score: 30,
    level: 'LOW' as const,
    floodZone: 'X',
    inSpecialFloodHazardArea: false,
    firmPanelId: null,
    baseFloodElevation: null,
    annualChanceOfFlooding: null,
    ...baseRiskFactor,
  },
  fire: {
    score: 55,
    level: 'MODERATE' as const,
    fireHazardSeverityZone: null,
    wildlandUrbanInterface: false,
    nearestFireStation: null,
    vegetationDensity: null,
    ...baseRiskFactor,
  },
  wind: {
    score: 40,
    level: 'MODERATE' as const,
    designWindSpeed: null,
    hurricaneRisk: false,
    tornadoRisk: false,
    hailRisk: false,
    ...baseRiskFactor,
  },
  earthquake: {
    score: 20,
    level: 'LOW' as const,
    seismicZone: null,
    nearestFaultLine: null,
    soilType: null,
    liquidationPotential: null,
    ...baseRiskFactor,
  },
  crime: {
    score: 60,
    level: 'HIGH' as const,
    violentCrimeIndex: 50,
    propertyCrimeIndex: 60,
    nationalAverageDiff: 10,
    ...baseRiskFactor,
  },
  generatedAt: '2024-01-01T00:00:00Z',
  cacheTtlSeconds: 3600,
}

describe('RiskSummary', () => {
  it('renders overall risk score and level', () => {
    render(<RiskSummary profile={mockProfile} />)

    expect(screen.getByText('45')).toBeInTheDocument()
    expect(screen.getByText('Moderate Risk')).toBeInTheDocument()
  })

  it('renders all 5 risk tiles', () => {
    render(<RiskSummary profile={mockProfile} />)

    expect(screen.getByText('Flood')).toBeInTheDocument()
    expect(screen.getByText('Fire')).toBeInTheDocument()
    expect(screen.getByText('Wind')).toBeInTheDocument()
    expect(screen.getByText('Earthquake')).toBeInTheDocument()
    expect(screen.getByText('Crime')).toBeInTheDocument()
  })

  it('displays score for each risk category', () => {
    render(<RiskSummary profile={mockProfile} />)

    expect(screen.getByText('30')).toBeInTheDocument()
    expect(screen.getByText('55')).toBeInTheDocument()
    expect(screen.getByText('40')).toBeInTheDocument()
    expect(screen.getByText('20')).toBeInTheDocument()
    expect(screen.getByText('60')).toBeInTheDocument()
  })

  it('displays risk level label for each category', () => {
    render(<RiskSummary profile={mockProfile} />)

    // Low appears for flood and earthquake tiles
    const lowLabels = screen.getAllByText('Low')
    expect(lowLabels).toHaveLength(2)

    // Moderate appears for fire and wind tiles
    const moderateLabels = screen.getAllByText('Moderate')
    expect(moderateLabels).toHaveLength(2)

    // High appears for crime tile
    expect(screen.getByText('High')).toBeInTheDocument()
  })
})
