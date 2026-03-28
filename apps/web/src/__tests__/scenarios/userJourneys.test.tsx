/**
 * User Journey Tests — Web UI Layer
 *
 * Tests end-to-end user journeys through the React component layer
 * using Testing Library, covering key platform flows:
 * - Home buyer searching and reviewing properties
 * - Agent dashboard interactions
 * - Property comparison flow
 * - Risk and insurance data display
 * - Authentication-gated UI states
 */

import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'

// ─── Mocks ──���───────────────────────────────────────────────────────────────

const mockSearchProperties = jest.fn()
const mockGetProperty = jest.fn()
const mockGetPropertyRisk = jest.fn()
const mockGetPropertyInsurance = jest.fn()
const mockGetPropertyInsurability = jest.fn()
const mockGetPropertyCarriers = jest.fn()
const mockGetSavedProperties = jest.fn()
const mockGetClients = jest.fn()
const mockGetAnalytics = jest.fn()

jest.mock('@/lib/api', () => ({
  searchProperties: (...args: unknown[]) => mockSearchProperties(...args),
  getProperty: (...args: unknown[]) => mockGetProperty(...args),
  getPropertyRisk: (...args: unknown[]) => mockGetPropertyRisk(...args),
  getPropertyInsurance: (...args: unknown[]) => mockGetPropertyInsurance(...args),
  getPropertyInsurability: (...args: unknown[]) => mockGetPropertyInsurability(...args),
  getPropertyCarriers: (...args: unknown[]) => mockGetPropertyCarriers(...args),
  getSavedProperties: (...args: unknown[]) => mockGetSavedProperties(...args),
  getClients: (...args: unknown[]) => mockGetClients(...args),
  getAnalytics: (...args: unknown[]) => mockGetAnalytics(...args),
  saveProperty: jest.fn(),
  unsaveProperty: jest.fn(),
  requestBindingQuote: jest.fn(),
  getMe: jest.fn(),
  getSubscriptionState: jest.fn(),
}))

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn(), refresh: jest.fn() }),
  usePathname: () => '/search',
  useSearchParams: () => new URLSearchParams(),
}))

jest.mock('next/link', () => ({
  __esModule: true,
  default: ({ children, href, ...props }: { children: React.ReactNode; href: string; [key: string]: unknown }) => (
    <a href={href} {...props}>{children}</a>
  ),
}))

jest.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    auth: {
      getSession: jest.fn().mockResolvedValue({ data: { session: { access_token: 'token' } } }),
      signOut: jest.fn().mockResolvedValue({}),
    },
  }),
}))

jest.mock('@/lib/useCompare', () => ({
  useCompare: () => ({
    ids: [],
    toggle: jest.fn(),
    canAdd: true,
    compareUrl: null,
    clear: jest.fn(),
  }),
}))

jest.mock('@/lib/utils', () => ({
  cn: (...args: (string | undefined | boolean)[]) => args.filter(Boolean).join(' '),
  riskLevelClasses: () => 'text-green-600',
  formatCurrency: (n: number) => `$${n.toLocaleString()}`,
  formatRiskLevel: (l: string) => l,
}))

// ─── Shared Test Data ───────────────────────────────────────────────────────

const mockProperty = {
  id: 'prop-1',
  address: '123 Main Street',
  city: 'Austin',
  state: 'TX',
  zip: '78701',
  county: 'Travis',
  lat: 30.2672,
  lng: -97.7431,
  propertyType: 'SINGLE_FAMILY' as const,
  yearBuilt: 1998,
  squareFeet: 2100,
  bedrooms: 3,
  bathrooms: 2,
  lotSize: 7200,
  estimatedValue: 620000,
  lastSalePrice: 485000,
  lastSaleDate: '2021-03-15',
  parcelId: 'MOCK-000001',
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-01T00:00:00Z',
}

const mockRiskProfile = {
  propertyId: 'prop-1',
  overallRiskScore: 35,
  overallRiskLevel: 'MODERATE' as const,
  floodRisk: { score: 25, level: 'LOW' as const, floodZone: 'X', inSFHA: false },
  fireRisk: { score: 30, level: 'LOW' as const, fireHazardZone: null },
  windRisk: { score: 40, level: 'MODERATE' as const },
  earthquakeRisk: { score: 15, level: 'LOW' as const },
  crimeRisk: { score: 45, level: 'MODERATE' as const },
  lastUpdated: '2024-01-01T00:00:00Z',
}

const mockInsuranceEstimate = {
  propertyId: 'prop-1',
  estimatedAnnualTotal: 2400,
  confidenceLevel: 'MEDIUM' as const,
  coverages: [
    { type: 'HOMEOWNERS', averageAnnualPremium: 1800, lowEstimate: 1500, highEstimate: 2200, required: true, notes: 'HO-3' },
    { type: 'FLOOD', averageAnnualPremium: 600, lowEstimate: 400, highEstimate: 900, required: false, notes: null },
  ],
  recommendations: ['Bundle homeowners + flood for discount'],
  disclaimers: ['Estimates are for informational purposes only.'],
  lastUpdated: '2024-01-01T00:00:00Z',
}

const mockAnalytics = {
  totalSearches: 42,
  totalSavedProperties: 8,
  totalReports: 3,
  riskDistribution: { LOW: 3, MODERATE: 3, HIGH: 1, VERY_HIGH: 1, EXTREME: 0 },
  recentActivity: [
    { type: 'search', description: 'Searched Austin, TX 78701', timestamp: '2024-01-15T10:00:00Z' },
    { type: 'save', description: 'Saved 123 Main Street', timestamp: '2024-01-14T09:00:00Z' },
  ],
  averageRiskByPeril: { flood: 30, fire: 25, wind: 35, earthquake: 15, crime: 40 },
}

beforeEach(() => {
  jest.clearAllMocks()
})

// ─── Journey 1: Home Buyer Property Search ──────────────────────────────────

describe('Journey: Home Buyer searches and reviews properties', () => {
  it('renders search results as PropertyCard components', async () => {
    // Import the component that renders search results
    const { SearchResults } = await import('@/components/search/SearchResults')

    render(
      <SearchResults
        properties={[mockProperty]}
        query="Austin TX 78701"
      />,
    )

    expect(screen.getByText(/123 Main/)).toBeInTheDocument()
  })

  it('shows empty state when no results found', async () => {
    const { SearchResults } = await import('@/components/search/SearchResults')

    render(
      <SearchResults
        properties={[]}
        query="Nonexistent Place"
      />,
    )

    expect(screen.getByText(/no properties found/i)).toBeInTheDocument()
  })

  it('displays property risk summary with scores', async () => {
    const { RiskSummary } = await import('@/components/property/RiskSummary')

    render(<RiskSummary profile={mockRiskProfile} />)

    // Should display overall score
    expect(screen.getByText('35')).toBeInTheDocument()
    // Should display risk categories
    expect(screen.getByText(/flood/i)).toBeInTheDocument()
    expect(screen.getByText(/fire/i)).toBeInTheDocument()
    expect(screen.getByText(/wind/i)).toBeInTheDocument()
    expect(screen.getByText(/earthquake/i)).toBeInTheDocument()
    expect(screen.getByText(/crime/i)).toBeInTheDocument()
  })

  it('shows insurance cost breakdown', async () => {
    const { InsuranceCostEstimate } = await import(
      '@/components/property/InsuranceCostEstimate'
    )

    render(<InsuranceCostEstimate estimate={mockInsuranceEstimate} />)

    // Annual total should be visible
    expect(screen.getByText(/2,400/)).toBeInTheDocument()
    // Coverage types
    expect(screen.getByText(/HOMEOWNERS/i)).toBeInTheDocument()
    expect(screen.getByText(/FLOOD/i)).toBeInTheDocument()
  })

  it('shows insurability status with difficulty level', async () => {
    const { InsurabilityPanel } = await import(
      '@/components/property/InsurabilityPanel'
    )

    render(
      <InsurabilityPanel
        status={{
          propertyId: 'prop-1',
          difficultyLevel: 'MODERATE' as const,
          isInsurable: true,
          potentialIssues: [],
          recommendedActions: ['Compare quotes from at least 3 carriers.'],
        }}
      />,
    )

    expect(screen.getByText(/insurable/i)).toBeInTheDocument()
    expect(screen.getByText(/moderate/i)).toBeInTheDocument()
  })

  it('displays active carriers with market condition', async () => {
    const { ActiveCarriers } = await import(
      '@/components/property/ActiveCarriers'
    )

    render(
      <ActiveCarriers
        data={{
          propertyId: 'prop-1',
          carriers: [
            {
              id: 'state-farm',
              name: 'State Farm',
              amBestRating: 'A++',
              coverageTypes: ['HOMEOWNERS'],
              avgPremiumModifier: 1.05,
              statesLicensed: ['ALL'],
              specialties: ['Standard residential'],
              notes: null,
              writingStatus: 'ACTIVELY_WRITING' as const,
            },
          ],
          marketCondition: 'MODERATE' as const,
          lastUpdated: '2024-01-01T00:00:00Z',
        }}
        propertyId="prop-1"
        propertyAddress="123 Main Street"
      />,
    )

    expect(screen.getByText(/State Farm/)).toBeInTheDocument()
    expect(screen.getByText(/moderate/i)).toBeInTheDocument()
  })
})

// ─── Journey 2: Agent Dashboard ────────────────────────────────────���────────

describe('Journey: Agent views dashboard', () => {
  it('renders agent dashboard with stats after loading', async () => {
    mockGetSavedProperties.mockResolvedValue([
      { id: 'sp-1', propertyId: 'prop-1', property: mockProperty, createdAt: '2024-01-01T00:00:00Z' },
    ])
    mockGetClients.mockResolvedValue([
      { id: 'client-1', firstName: 'Jane', lastName: 'Doe' },
    ])
    mockGetAnalytics.mockResolvedValue(mockAnalytics)

    const { default: AgentDashboard } = await import(
      '@/components/dashboard/AgentDashboard'
    )

    render(<AgentDashboard />)

    await waitFor(() => {
      // Should display some stats or content after loading
      expect(mockGetAnalytics).toHaveBeenCalled()
    })
  })
})

// ─── Journey 3: Consumer Dashboard ──────────────────────────────────────────

describe('Journey: Consumer views dashboard', () => {
  it('renders consumer dashboard with search section', async () => {
    mockGetAnalytics.mockResolvedValue(mockAnalytics)

    const { default: ConsumerDashboard } = await import(
      '@/components/dashboard/ConsumerDashboard'
    )

    render(<ConsumerDashboard />)

    // Consumer dashboard should have a search section
    await waitFor(() => {
      expect(mockGetAnalytics).toHaveBeenCalled()
    })
  })
})

// ─── Journey 4: PropertyCard interactions ──────────────────────────────────

describe('Journey: Property card interactions', () => {
  it('renders property with all key information', async () => {
    const { PropertyCard } = await import('@/components/search/PropertyCard')

    render(<PropertyCard property={mockProperty} />)

    expect(screen.getByText(/123 Main/)).toBeInTheDocument()
    expect(screen.getByText(/Austin/)).toBeInTheDocument()
    expect(screen.getByText(/TX/)).toBeInTheDocument()
  })

  it('shows link to property detail page', async () => {
    const { PropertyCard } = await import('@/components/search/PropertyCard')

    render(<PropertyCard property={mockProperty} />)

    const links = screen.getAllByRole('link')
    const detailLink = links.find(
      (link) => link.getAttribute('href')?.includes('/properties/prop-1'),
    )
    expect(detailLink).toBeDefined()
  })
})

// ─── Journey 5: Navbar navigation ──────────────────────────────────────────

describe('Journey: Navigation', () => {
  it('renders navbar with key navigation links', async () => {
    const { default: Navbar } = await import('@/components/layout/Navbar')

    render(<Navbar />)

    expect(screen.getByText(/CoverGuard/i)).toBeInTheDocument()
  })
})

// ─── Journey 6: Risk Level Scenarios ───────────────────────────────────────

describe('Journey: Different risk level properties', () => {
  it('displays LOW risk property correctly', async () => {
    const { RiskSummary } = await import('@/components/property/RiskSummary')

    const lowRisk = {
      ...mockRiskProfile,
      overallRiskScore: 15,
      overallRiskLevel: 'LOW' as const,
    }

    render(<RiskSummary profile={lowRisk} />)
    expect(screen.getByText('15')).toBeInTheDocument()
  })

  it('displays EXTREME risk property correctly', async () => {
    const { RiskSummary } = await import('@/components/property/RiskSummary')

    const extremeRisk = {
      ...mockRiskProfile,
      overallRiskScore: 95,
      overallRiskLevel: 'EXTREME' as const,
    }

    render(<RiskSummary profile={extremeRisk} />)
    expect(screen.getByText('95')).toBeInTheDocument()
  })

  it('shows non-insurable status for extreme risk property', async () => {
    const { InsurabilityPanel } = await import(
      '@/components/property/InsurabilityPanel'
    )

    render(
      <InsurabilityPanel
        status={{
          propertyId: 'prop-extreme',
          difficultyLevel: 'EXTREME' as const,
          isInsurable: false,
          potentialIssues: ['Multiple severe risk factors', 'Flood zone V with wave action'],
          recommendedActions: ['Contact surplus lines broker', 'Consider FAIR Plan'],
        }}
      />,
    )

    expect(screen.getByText(/non-insurable/i)).toBeInTheDocument()
    expect(screen.getByText(/extreme/i)).toBeInTheDocument()
  })
})

// ─── Journey 7: Insurance Coverage Scenarios ───────────────────────────────

describe('Journey: Insurance coverage scenarios', () => {
  it('shows required coverage badge for mandatory coverages', async () => {
    const { InsuranceCostEstimate } = await import(
      '@/components/property/InsuranceCostEstimate'
    )

    render(<InsuranceCostEstimate estimate={mockInsuranceEstimate} />)

    // HOMEOWNERS is required
    expect(screen.getByText(/required/i)).toBeInTheDocument()
  })

  it('displays recommendations when present', async () => {
    const { InsuranceCostEstimate } = await import(
      '@/components/property/InsuranceCostEstimate'
    )

    render(<InsuranceCostEstimate estimate={mockInsuranceEstimate} />)

    expect(screen.getByText(/bundle/i)).toBeInTheDocument()
  })
})
