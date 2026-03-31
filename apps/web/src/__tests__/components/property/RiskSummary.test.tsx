import React from 'react'
import { render, screen } from '@testing-library/react'
import type { PropertyRiskProfile, RiskLevel } from '@coverguard/shared'
import { RiskSummary } from '@/components/property/RiskSummary'

jest.mock('lucide-react', () =>
  new Proxy(
    {},
    {
      get: (_, name) =>
        (props: any) => <span data-testid={`icon-${String(name)}`} {...props} />,
    },
  ),
)

jest.mock('@/lib/utils', () => ({
  cn: (...args: any[]) => args.filter(Boolean).join(' '),
  riskLevelClasses: (level: string) => `risk-${level.toLowerCase()}`,
}))

jest.mock('@coverguard/shared', () => ({
  riskLevelToLabel: (level: string) => {
    const map: Record<string, string> = {
      LOW: 'Low',
      MODERATE: 'Moderate',
      HIGH: 'High',
      VERY_HIGH: 'Very High',
      EXTREME: 'Extreme',
    }
    return map[level] ?? level
  },
}))

function makeRiskFactor(overrides: Partial<{ score: number; level: RiskLevel }> = {}) {
  return {
    score: 30,
    level: 'LOW' as RiskLevel,
    trend: 'STABLE' as const,
    description: 'Test description',
    details: [],
    dataSource: 'test',
    lastUpdated: '2024-01-01',
    ...overrides,
  }
}

function mockProfile(overrides: Partial<PropertyRiskProfile> = {}): PropertyRiskProfile {
  return {
    propertyId: 'prop-1',
    overallRiskScore: 45,
    overallRiskLevel: 'MODERATE',
    flood: {
      ...makeRiskFactor({ score: 30, level: 'LOW' }),
      floodZone: 'X',
      firmPanelId: null,
      baseFloodElevation: null,
      inSpecialFloodHazardArea: false,
      annualChanceOfFlooding: null,
    },
    fire: {
      ...makeRiskFactor({ score: 20, level: 'LOW' }),
      fireHazardSeverityZone: null,
      wildlandUrbanInterface: false,
      nearestFireStation: null,
      vegetationDensity: null,
    },
    wind: {
      ...makeRiskFactor({ score: 50, level: 'MODERATE' }),
      designWindSpeed: null,
      hurricaneRisk: false,
      tornadoRisk: false,
      hailRisk: false,
    },
    earthquake: {
      ...makeRiskFactor({ score: 10, level: 'LOW' }),
      seismicZone: null,
      nearestFaultLine: null,
      soilType: null,
      liquefactionPotential: null,
    },
    crime: {
      ...makeRiskFactor({ score: 40, level: 'MODERATE' }),
      violentCrimeIndex: 30,
      propertyCrimeIndex: 40,
      nationalAverageDiff: -5,
    },
    generatedAt: '2024-01-01',
    cacheTtlSeconds: 3600,
    ...overrides,
  } as PropertyRiskProfile
}

describe('RiskSummary', () => {
  it('renders overall risk score', () => {
    const el = RiskSummary({ profile: mockProfile() })
    render(el)
    expect(screen.getByText('45')).toBeInTheDocument()
  })

  it('renders overall risk level text', () => {
    const el = RiskSummary({ profile: mockProfile() })
    render(el)
    expect(screen.getByText('Moderate Risk')).toBeInTheDocument()
  })

  it('renders all 5 risk category tiles', () => {
    const el = RiskSummary({ profile: mockProfile() })
    render(el)
    expect(screen.getByText('Flood')).toBeInTheDocument()
    expect(screen.getByText('Fire')).toBeInTheDocument()
    expect(screen.getByText('Wind')).toBeInTheDocument()
    expect(screen.getByText('Earthquake')).toBeInTheDocument()
    expect(screen.getByText('Crime')).toBeInTheDocument()
  })

  it('displays correct score for each category', () => {
    const el = RiskSummary({ profile: mockProfile() })
    render(el)
    expect(screen.getByText('30')).toBeInTheDocument()
    expect(screen.getByText('20')).toBeInTheDocument()
    expect(screen.getByText('50')).toBeInTheDocument()
    expect(screen.getByText('10')).toBeInTheDocument()
    expect(screen.getByText('40')).toBeInTheDocument()
  })

  it('renders with HIGH risk profile', () => {
    const profile = mockProfile({
      overallRiskScore: 75,
      overallRiskLevel: 'HIGH',
      flood: {
        ...mockProfile().flood,
        score: 80,
        level: 'HIGH',
      },
    })
    const el = RiskSummary({ profile })
    render(el)
    expect(screen.getByText('75')).toBeInTheDocument()
    expect(screen.getByText('High Risk')).toBeInTheDocument()
    expect(screen.getByText('80')).toBeInTheDocument()
  })

  it('renders with LOW risk profile', () => {
    const profile = mockProfile({
      overallRiskScore: 15,
      overallRiskLevel: 'LOW',
    })
    const el = RiskSummary({ profile })
    render(el)
    expect(screen.getByText('15')).toBeInTheDocument()
    expect(screen.getByText('Low Risk')).toBeInTheDocument()
  })

  it('renders with VERY_HIGH risk profile', () => {
    const profile = mockProfile({
      overallRiskScore: 90,
      overallRiskLevel: 'VERY_HIGH',
    })
    const el = RiskSummary({ profile })
    render(el)
    expect(screen.getByText('90')).toBeInTheDocument()
    expect(screen.getByText('Very High Risk')).toBeInTheDocument()
  })
})
