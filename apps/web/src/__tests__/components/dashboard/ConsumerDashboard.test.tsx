import { render, screen, waitFor } from '@testing-library/react'
import { ConsumerDashboard } from '@/components/dashboard/ConsumerDashboard'
import { getAnalytics } from '@/lib/api'

// Mock lucide-react icons to avoid ESM import issues
jest.mock('lucide-react', () => {
  const icon = (name: string) => (props: Record<string, unknown>) => <svg data-testid={`icon-${name}`} {...props} />
  return {
    GitCompare: icon('git-compare'),
    Bookmark: icon('bookmark'),
    Search: icon('search'),
    Clock: icon('clock'),
    FileText: icon('file-text'),
    Shield: icon('shield'),
    Activity: icon('activity'),
    AlertTriangle: icon('alert-triangle'),
  }
})

jest.mock('@/lib/api', () => ({
  getAnalytics: jest.fn(),
}))

jest.mock('@/lib/useCompare', () => ({
  useCompare: () => ({
    ids: [],
    canAdd: true,
    compareUrl: null,
    clear: jest.fn(),
    toggle: jest.fn(),
  }),
}))

jest.mock('next/link', () => ({
  __esModule: true,
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}))

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn() }),
}))

jest.mock('@/components/search/SearchBar', () => ({
  SearchBar: (props: any) => <div data-testid="search-bar" className={props.className} />,
}))

jest.mock('@/components/dashboard/SavedPropertiesPanel', () => ({
  __esModule: true,
  SavedPropertiesPanel: () => <div data-testid="saved-properties-panel" />,
}))

const mockGetAnalytics = getAnalytics as jest.MockedFunction<typeof getAnalytics>

const mockAnalytics = {
  totalSearches: 15,
  totalSavedProperties: 4,
  totalReports: 2,
  riskDistribution: [],
  recentActivity: [],
}

describe('ConsumerDashboard', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('renders search hero section', async () => {
    mockGetAnalytics.mockResolvedValue(mockAnalytics as any)

    render(<ConsumerDashboard />)

    expect(screen.getByText('Search a Property')).toBeInTheDocument()
    expect(
      screen.getByText(/Enter an address to get a full risk, insurability/)
    ).toBeInTheDocument()
    expect(screen.getByTestId('search-bar')).toBeInTheDocument()
  })

  it('renders quick stats section', async () => {
    mockGetAnalytics.mockResolvedValue(mockAnalytics as any)

    render(<ConsumerDashboard />)

    await waitFor(() => {
      expect(screen.getByText('15')).toBeInTheDocument()
    })

    expect(screen.getByText('Searches')).toBeInTheDocument()
    expect(screen.getByText('Saved')).toBeInTheDocument()
    expect(screen.getByText('Reports')).toBeInTheDocument()
    expect(screen.getByText('4')).toBeInTheDocument()
    expect(screen.getByText('2')).toBeInTheDocument()
  })

  it('shows empty state CTA when no searches', async () => {
    mockGetAnalytics.mockResolvedValue({
      ...mockAnalytics,
      totalSearches: 0,
    } as any)

    render(<ConsumerDashboard />)

    await waitFor(() => {
      expect(screen.getByText('Ready to check a property?')).toBeInTheDocument()
    })

    expect(screen.getByText('Check a Property')).toBeInTheDocument()
  })

  it('renders quick links (Compare, Reports, Account)', async () => {
    mockGetAnalytics.mockResolvedValue(mockAnalytics as any)

    render(<ConsumerDashboard />)

    expect(screen.getByText('Compare Properties')).toBeInTheDocument()
    expect(screen.getByText('My Reports')).toBeInTheDocument()
    expect(screen.getByText('Account Settings')).toBeInTheDocument()

    // Verify link destinations
    const compareLink = screen.getByText('Compare Properties').closest('a')
    expect(compareLink).toHaveAttribute('href', '/dashboard?tab=compare')

    const reportsLink = screen.getByText('My Reports').closest('a')
    expect(reportsLink).toHaveAttribute('href', '/reports')

    const accountLink = screen.getByText('Account Settings').closest('a')
    expect(accountLink).toHaveAttribute('href', '/account')
  })
})
