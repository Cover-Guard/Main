import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { Navbar } from '@/components/layout/Navbar'

// Mock lucide-react icons to avoid ESM import issues
jest.mock('lucide-react', () => {
  const icon = (name: string) => (props: Record<string, unknown>) => <svg data-testid={`icon-${name}`} {...props} />
  return {
    Search: icon('search'),
    LayoutDashboard: icon('layout-dashboard'),
    BarChart2: icon('bar-chart-2'),
    User: icon('user'),
    LogOut: icon('log-out'),
    ChevronDown: icon('chevron-down'),
  }
})

const mockPush = jest.fn()
const mockRefresh = jest.fn()
const mockSignOut = jest.fn().mockResolvedValue({})

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush, refresh: mockRefresh }),
  usePathname: () => '/dashboard',
}))

jest.mock('next/link', () => ({
  __esModule: true,
  default: ({ children, href, ...props }: any) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}))

jest.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    auth: { signOut: mockSignOut },
  }),
}))

jest.mock('@/components/icons/CoverGuardShield', () => ({
  CoverGuardShield: (props: any) => <svg data-testid="coverguard-shield" {...props} />,
}))

jest.mock('@/lib/utils', () => ({
  cn: (...args: any[]) => args.filter(Boolean).join(' '),
}))

describe('Navbar', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('renders CoverGuard logo/brand', () => {
    render(<Navbar />)

    expect(screen.getByText('CoverGuard')).toBeInTheDocument()
    expect(screen.getByTestId('coverguard-shield')).toBeInTheDocument()
  })

  it('renders desktop nav links (Search, Dashboard, Analytics)', () => {
    render(<Navbar />)

    // Desktop nav links appear in the desktop nav and also mobile nav
    const searchLinks = screen.getAllByText('Search')
    expect(searchLinks.length).toBeGreaterThanOrEqual(1)

    const dashboardLinks = screen.getAllByText('Dashboard')
    expect(dashboardLinks.length).toBeGreaterThanOrEqual(1)

    const analyticsLinks = screen.getAllByText('Analytics')
    expect(analyticsLinks.length).toBeGreaterThanOrEqual(1)
  })

  it('highlights active nav link based on pathname', () => {
    render(<Navbar />)

    // The pathname is /dashboard, so Dashboard links should have the active class
    const dashboardLinks = screen.getAllByText('Dashboard')
    const activeDashboardLink = dashboardLinks.find((el) =>
      el.closest('a')?.className.includes('bg-brand-50')
    )
    expect(activeDashboardLink).toBeTruthy()

    // Search should not be active
    const searchLinks = screen.getAllByText('Search')
    const activeSearchLink = searchLinks.find((el) =>
      el.closest('a')?.className.includes('bg-brand-50')
    )
    expect(activeSearchLink).toBeFalsy()
  })

  it('renders user menu button', () => {
    render(<Navbar />)

    // The user menu button contains a User icon inside a circle
    const menuButton = screen.getByRole('button')
    expect(menuButton).toBeInTheDocument()
  })

  it('sign out button calls supabase.auth.signOut', async () => {
    render(<Navbar />)

    // Open the user menu
    const menuButton = screen.getByRole('button')
    fireEvent.click(menuButton)

    // Click sign out
    const signOutButton = screen.getByText('Sign out')
    fireEvent.click(signOutButton)

    await waitFor(() => {
      expect(mockSignOut).toHaveBeenCalledTimes(1)
    })

    expect(mockPush).toHaveBeenCalledWith('/login')
  })
})
