/**
 * DashboardPage tests
 *
 * Covers:
 *  - Redirect to /login when no user
 *  - Role-based rendering: AgentDashboard vs ConsumerDashboard
 *  - AGENT, LENDER, ADMIN → AgentDashboard
 *  - BUYER → ConsumerDashboard
 *  - Unknown role defaults to ConsumerDashboard
 */

import { render, screen } from '@testing-library/react'

// ─── Mocks ──────────────────────────────────────────────────────────────────

const mockRedirect = jest.fn()
jest.mock('next/navigation', () => ({
  redirect: (...args: unknown[]) => {
    mockRedirect(...args)
    throw new Error('NEXT_REDIRECT')
  },
}))

const mockCreateClient = jest.fn()
jest.mock('@/lib/supabase/server', () => ({
  createClient: (...args: unknown[]) => mockCreateClient(...args),
}))

jest.mock('@/components/dashboard/AgentDashboard', () => ({
  AgentDashboard: () => <div data-testid="agent-dashboard">AgentDashboard</div>,
}))

jest.mock('@/components/dashboard/ConsumerDashboard', () => ({
  ConsumerDashboard: () => <div data-testid="consumer-dashboard">ConsumerDashboard</div>,
}))

jest.mock('@/components/dashboard/DashboardWithTabs', () => ({
  DashboardWithTabs: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="dashboard-with-tabs">{children}</div>
  ),
}))

jest.mock('@/components/layout/SidebarLayout', () => ({
  SidebarLayout: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="sidebar-layout">{children}</div>
  ),
}))

// ─── Import after mocks ─────────────────────────────────────────────────────

import DashboardPage from '@/app/dashboard/page'

// ─── Helpers ────────────────────────────────────────────────────────────────

function mockSupabaseUser(user: Record<string, unknown> | null) {
  mockCreateClient.mockResolvedValue({
    auth: {
      getUser: jest.fn().mockResolvedValue({ data: { user } }),
    },
  })
}

async function renderPage() {
  const Page = await DashboardPage()
  return render(Page)
}

// ─── Tests ──────────────────────────────────────────────────────────────────

beforeEach(() => {
  jest.clearAllMocks()
})

describe('DashboardPage', () => {
  it('redirects to /login when no user', async () => {
    mockSupabaseUser(null)
    await expect(renderPage()).rejects.toThrow('NEXT_REDIRECT')
    expect(mockRedirect).toHaveBeenCalledWith('/login')
  })

  it('renders AgentDashboard for AGENT role', async () => {
    mockSupabaseUser({ id: '1', user_metadata: { role: 'AGENT' } })
    await renderPage()
    expect(screen.getByTestId('agent-dashboard')).toBeInTheDocument()
    expect(screen.queryByTestId('consumer-dashboard')).not.toBeInTheDocument()
  })

  it('renders ConsumerDashboard for BUYER role', async () => {
    mockSupabaseUser({ id: '2', user_metadata: { role: 'BUYER' } })
    await renderPage()
    expect(screen.getByTestId('consumer-dashboard')).toBeInTheDocument()
    expect(screen.queryByTestId('agent-dashboard')).not.toBeInTheDocument()
  })

  it('renders AgentDashboard for LENDER role', async () => {
    mockSupabaseUser({ id: '3', user_metadata: { role: 'LENDER' } })
    await renderPage()
    expect(screen.getByTestId('agent-dashboard')).toBeInTheDocument()
  })

  it('defaults to ConsumerDashboard for unknown role', async () => {
    mockSupabaseUser({ id: '4', user_metadata: { role: 'UNKNOWN' } })
    await renderPage()
    expect(screen.getByTestId('consumer-dashboard')).toBeInTheDocument()
    expect(screen.queryByTestId('agent-dashboard')).not.toBeInTheDocument()
  })

  it('renders AgentDashboard for ADMIN role', async () => {
    mockSupabaseUser({ id: '5', user_metadata: { role: 'ADMIN' } })
    await renderPage()
    expect(screen.getByTestId('agent-dashboard')).toBeInTheDocument()
  })
})
