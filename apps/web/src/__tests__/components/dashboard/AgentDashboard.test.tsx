import { render, screen, waitFor } from '@testing-library/react'
import { AgentDashboard } from '@/components/dashboard/AgentDashboard'
import { getSavedProperties, getClients, getAnalytics } from '@/lib/api'

// Mock lucide-react icons to avoid ESM import issues
jest.mock('lucide-react', () => {
  const icon = (name: string) => (props: Record<string, unknown>) => <svg data-testid={`icon-${name}`} {...props} />
  return {
    Search: icon('search'),
    GitCompare: icon('git-compare'),
    Wrench: icon('wrench'),
    Shield: icon('shield'),
    AlertTriangle: icon('alert-triangle'),
    TrendingUp: icon('trending-up'),
    ArrowRight: icon('arrow-right'),
    Users: icon('users'),
    Clock: icon('clock'),
    Activity: icon('activity'),
    FileText: icon('file-text'),
    Bookmark: icon('bookmark'),
  }
})

jest.mock('@/lib/api', () => ({
  getSavedProperties: jest.fn(),
  getClients: jest.fn(),
  getAnalytics: jest.fn(),
}))

jest.mock('next/link', () => ({
  __esModule: true,
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}))

const mockGetSavedProperties = getSavedProperties as jest.MockedFunction<typeof getSavedProperties>
const mockGetClients = getClients as jest.MockedFunction<typeof getClients>
const mockGetAnalytics = getAnalytics as jest.MockedFunction<typeof getAnalytics>

const mockAnalytics = {
  totalSearches: 42,
  totalSavedProperties: 8,
  totalReports: 3,
  riskDistribution: [
    { level: 'LOW', count: 5 },
    { level: 'MODERATE', count: 10 },
    { level: 'HIGH', count: 3 },
    { level: 'VERY_HIGH', count: 1 },
  ],
  recentActivity: [
    { type: 'search' as const, description: 'Searched 123 Main St', timestamp: '2026-03-20T10:00:00Z' },
    { type: 'save' as const, description: 'Saved 456 Oak Ave', timestamp: '2026-03-19T14:30:00Z' },
  ],
}

const mockClients = [
  { id: 'c1', firstName: 'Alice', lastName: 'Smith', email: 'alice@test.com', status: 'ACTIVE', createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z' },
  { id: 'c2', firstName: 'Bob', lastName: 'Jones', email: 'bob@test.com', status: 'ACTIVE', createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z' },
]

const mockSavedProperties = [
  {
    id: 'sp1',
    propertyId: 'prop1',
    notes: null,
    tags: [],
    savedAt: '2026-03-15T00:00:00Z',
    property: {
      id: 'prop1',
      address: '123 Main St',
      city: 'Austin',
      state: 'TX',
      zip: '78701',
    },
  },
  {
    id: 'sp2',
    propertyId: 'prop2',
    notes: 'Great location',
    tags: ['favorite'],
    savedAt: '2026-03-14T00:00:00Z',
    property: {
      id: 'prop2',
      address: '456 Oak Ave',
      city: 'Denver',
      state: 'CO',
      zip: '80202',
    },
  },
]

function setupSuccessMocks() {
  mockGetSavedProperties.mockResolvedValue(mockSavedProperties as unknown[])
  mockGetClients.mockResolvedValue(mockClients as any)
  mockGetAnalytics.mockResolvedValue(mockAnalytics as any)
}

describe('AgentDashboard', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('shows loading state initially', () => {
    mockGetSavedProperties.mockReturnValue(new Promise(() => {}))
    mockGetClients.mockReturnValue(new Promise(() => {}))
    mockGetAnalytics.mockReturnValue(new Promise(() => {}))

    render(<AgentDashboard />)

    // Stat cards show "—" while loading
    const dashes = screen.getAllByText('—')
    expect(dashes.length).toBeGreaterThanOrEqual(4)
  })

  it('renders stat cards after data loads', async () => {
    setupSuccessMocks()

    render(<AgentDashboard />)

    // Wait for loading to complete - stat card values will no longer be dashes
    await waitFor(() => {
      expect(screen.queryAllByText('—').length).toBe(0)
    })

    expect(screen.getByText('TOTAL CHECKS')).toBeInTheDocument()
    expect(screen.getByText('HIGH / SEVERE RISK')).toBeInTheDocument()
    expect(screen.getByText('AVG. SCORE')).toBeInTheDocument()
    expect(screen.getByText('TOTAL CLIENTS')).toBeInTheDocument()
  })

  it('handles API errors gracefully and shows error banner', async () => {
    mockGetSavedProperties.mockRejectedValue(new Error('Network error'))
    mockGetClients.mockResolvedValue(mockClients as any)
    mockGetAnalytics.mockResolvedValue(mockAnalytics as any)

    render(<AgentDashboard />)

    await waitFor(() => {
      expect(screen.getByText('Some data failed to load')).toBeInTheDocument()
    })

    expect(screen.getByText(/Properties: Network error/)).toBeInTheDocument()
  })

  it('renders recent properties list', async () => {
    setupSuccessMocks()

    render(<AgentDashboard />)

    // Wait for actual property data to render (not just the heading)
    await waitFor(() => {
      expect(screen.getByText('123 Main St')).toBeInTheDocument()
    })

    expect(screen.getByText('Recent Properties')).toBeInTheDocument()
    expect(screen.getByText('456 Oak Ave')).toBeInTheDocument()
    expect(screen.getByText('Austin, TX')).toBeInTheDocument()
    expect(screen.getByText('Denver, CO')).toBeInTheDocument()
  })

  it('renders recent activity section', async () => {
    setupSuccessMocks()

    render(<AgentDashboard />)

    // Wait for activity data to appear (not just the heading which is shown during loading too)
    await waitFor(() => {
      expect(screen.getByText('Searched 123 Main St')).toBeInTheDocument()
    })

    expect(screen.getByText('Recent Activity')).toBeInTheDocument()
    expect(screen.getByText('Saved 456 Oak Ave')).toBeInTheDocument()
  })
})
