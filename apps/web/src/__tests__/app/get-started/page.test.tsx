/**
 * GetStartedPage tests
 *
 * Covers:
 *  - Rendering when Supabase is unavailable (env vars missing / throws)
 *  - Rendering when user is not authenticated
 *  - Redirect to /dashboard when user is authenticated
 *  - Correct links and content in the rendered page
 *  - Error handling for various Supabase failure modes
 */

import { render, screen } from '@testing-library/react'

// ─── Mocks ──────────────────────────────────────────────────────────────────

const mockRedirect = jest.fn()
jest.mock('next/navigation', () => ({
  redirect: (...args: unknown[]) => {
    mockRedirect(...args)
    // Next.js redirect throws to halt execution; simulate that
    throw new Error('NEXT_REDIRECT')
  },
}))

const mockCreateClient = jest.fn()
jest.mock('@/lib/supabase/server', () => ({
  createClient: (...args: unknown[]) => mockCreateClient(...args),
}))

// Mock lucide-react icons as simple spans
jest.mock('lucide-react', () => ({
  Building2: (props: Record<string, unknown>) => <span data-testid="icon-building2" {...props} />,
  User: (props: Record<string, unknown>) => <span data-testid="icon-user" {...props} />,
  ArrowRight: (props: Record<string, unknown>) => <span data-testid="icon-arrow-right" {...props} />,
}))

jest.mock('@/components/icons/CoverGuardShield', () => ({
  CoverGuardShield: (props: Record<string, unknown>) => <span data-testid="coverguard-shield" {...props} />,
}))

// ─── Import after mocks ─────────────────────────────────────────────────────

import GetStartedPage from '@/app/get-started/page'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function mockSupabaseClient(user: Record<string, unknown> | null) {
  mockCreateClient.mockResolvedValue({
    auth: {
      getUser: jest.fn().mockResolvedValue({
        data: { user },
      }),
    },
  })
}

function mockSupabaseThrows(error: Error = new Error('Missing Supabase env vars')) {
  mockCreateClient.mockRejectedValue(error)
}

async function renderPage() {
  const Page = await GetStartedPage()
  return render(Page)
}

// ─── Tests ───────────────────────────────────────────────────────────────────

beforeEach(() => {
  jest.clearAllMocks()
})

describe('GetStartedPage', () => {
  // ── Rendering without auth (happy path) ─────────────────────────────────

  describe('when user is not authenticated', () => {
    beforeEach(() => {
      mockSupabaseClient(null)
    })

    it('renders the page without redirecting', async () => {
      await renderPage()
      expect(mockRedirect).not.toHaveBeenCalled()
    })

    it('displays the main heading', async () => {
      await renderPage()
      expect(screen.getByText('How would you like to use CoverGuard?')).toBeInTheDocument()
    })

    it('displays the subtitle', async () => {
      await renderPage()
      expect(screen.getByText('Select your account type to get started')).toBeInTheDocument()
    })

    it('renders the Agent card heading', async () => {
      await renderPage()
      expect(screen.getByText('Agent')).toBeInTheDocument()
    })

    it('renders the Individual card heading', async () => {
      await renderPage()
      expect(screen.getByText('Individual')).toBeInTheDocument()
    })

    it('renders the Agent card description', async () => {
      await renderPage()
      expect(screen.getByText(/real estate agents, brokers, and lenders/)).toBeInTheDocument()
    })

    it('renders the Individual card description', async () => {
      await renderPage()
      expect(screen.getByText(/home buyers and homeowners/)).toBeInTheDocument()
    })

    it('renders "Continue as Agent" link text', async () => {
      await renderPage()
      expect(screen.getByText('Continue as Agent')).toBeInTheDocument()
    })

    it('renders "Continue as Individual" link text', async () => {
      await renderPage()
      expect(screen.getByText('Continue as Individual')).toBeInTheDocument()
    })

    it('renders a link to /agents/login', async () => {
      await renderPage()
      const links = screen.getAllByRole('link')
      const agentLink = links.find(l => l.getAttribute('href') === '/agents/login')
      expect(agentLink).toBeDefined()
    })

    it('renders a link to /login for individual', async () => {
      await renderPage()
      const links = screen.getAllByRole('link')
      const individualLinks = links.filter(l => l.getAttribute('href') === '/login')
      expect(individualLinks.length).toBeGreaterThanOrEqual(1)
    })

    it('renders the CoverGuard logo/shield', async () => {
      await renderPage()
      expect(screen.getByTestId('coverguard-shield')).toBeInTheDocument()
    })

    it('renders the CoverGuard brand name', async () => {
      await renderPage()
      expect(screen.getByText('CoverGuard')).toBeInTheDocument()
    })

    it('renders a link back to home page', async () => {
      await renderPage()
      const links = screen.getAllByRole('link')
      const homeLink = links.find(l => l.getAttribute('href') === '/')
      expect(homeLink).toBeDefined()
    })

    it('renders the "Not sure?" helper text', async () => {
      await renderPage()
      expect(screen.getByText(/Not sure\?/)).toBeInTheDocument()
    })

    it('renders the "Individual accounts" fallback link', async () => {
      await renderPage()
      expect(screen.getByText('Individual accounts')).toBeInTheDocument()
    })

    it('renders the Building2 icon', async () => {
      await renderPage()
      expect(screen.getByTestId('icon-building2')).toBeInTheDocument()
    })

    it('renders the User icon', async () => {
      await renderPage()
      expect(screen.getByTestId('icon-user')).toBeInTheDocument()
    })

    it('calls createClient exactly once', async () => {
      await renderPage()
      expect(mockCreateClient).toHaveBeenCalledTimes(1)
    })

    it('does not redirect to any path', async () => {
      await renderPage()
      expect(mockRedirect).not.toHaveBeenCalled()
    })
  })

  // ── Redirect when authenticated ─────────────────────────────────────────

  describe('when user is authenticated', () => {
    const mockUser = { id: 'user-123', email: 'test@example.com' }

    beforeEach(() => {
      mockSupabaseClient(mockUser)
    })

    it('calls redirect with /dashboard', async () => {
      await expect(renderPage()).rejects.toThrow('NEXT_REDIRECT')
      expect(mockRedirect).toHaveBeenCalledWith('/dashboard')
    })

    it('redirects exactly once', async () => {
      await expect(renderPage()).rejects.toThrow('NEXT_REDIRECT')
      expect(mockRedirect).toHaveBeenCalledTimes(1)
    })

    it('does not render page content when redirecting', async () => {
      await expect(renderPage()).rejects.toThrow('NEXT_REDIRECT')
      expect(screen.queryByText('How would you like to use CoverGuard?')).not.toBeInTheDocument()
    })

    it('redirects for user with minimal fields', async () => {
      mockSupabaseClient({ id: 'user-minimal' })
      await expect(renderPage()).rejects.toThrow('NEXT_REDIRECT')
      expect(mockRedirect).toHaveBeenCalledWith('/dashboard')
    })

    it('redirects for agent user', async () => {
      mockSupabaseClient({ id: 'agent-1', role: 'AGENT', email: 'agent@brokerage.com' })
      await expect(renderPage()).rejects.toThrow('NEXT_REDIRECT')
      expect(mockRedirect).toHaveBeenCalledWith('/dashboard')
    })

    it('redirects for consumer user', async () => {
      mockSupabaseClient({ id: 'consumer-1', role: 'CONSUMER', email: 'buyer@gmail.com' })
      await expect(renderPage()).rejects.toThrow('NEXT_REDIRECT')
      expect(mockRedirect).toHaveBeenCalledWith('/dashboard')
    })

    it('redirects for user with termsAcceptedAt set', async () => {
      mockSupabaseClient({ id: 'user-terms', termsAcceptedAt: '2025-01-01T00:00:00Z' })
      await expect(renderPage()).rejects.toThrow('NEXT_REDIRECT')
      expect(mockRedirect).toHaveBeenCalledWith('/dashboard')
    })
  })

  // ── Error handling (Supabase unavailable) ───────────────────────────────

  describe('when createClient throws (Supabase unavailable)', () => {
    it('renders the page gracefully when env vars are missing', async () => {
      mockSupabaseThrows(new Error('Missing Supabase env vars: set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY'))
      await renderPage()
      expect(screen.getByText('How would you like to use CoverGuard?')).toBeInTheDocument()
    })

    it('does not redirect when createClient fails', async () => {
      mockSupabaseThrows()
      await renderPage()
      expect(mockRedirect).not.toHaveBeenCalled()
    })

    it('renders both portal cards when createClient fails', async () => {
      mockSupabaseThrows()
      await renderPage()
      expect(screen.getByText('Agent')).toBeInTheDocument()
      expect(screen.getByText('Individual')).toBeInTheDocument()
    })

    it('handles generic Error gracefully', async () => {
      mockSupabaseThrows(new Error('Something went wrong'))
      await renderPage()
      expect(screen.getByText('How would you like to use CoverGuard?')).toBeInTheDocument()
    })

    it('handles TypeError gracefully', async () => {
      mockSupabaseThrows(new TypeError('Cannot read properties of undefined'))
      await renderPage()
      expect(mockRedirect).not.toHaveBeenCalled()
    })

    it('handles network errors gracefully', async () => {
      mockSupabaseThrows(new Error('fetch failed'))
      await renderPage()
      expect(screen.getByText('How would you like to use CoverGuard?')).toBeInTheDocument()
    })

    it('handles timeout errors gracefully', async () => {
      mockSupabaseThrows(new Error('Request timed out'))
      await renderPage()
      expect(screen.getByText('Agent')).toBeInTheDocument()
    })

    it('renders all navigation links when Supabase is down', async () => {
      mockSupabaseThrows()
      await renderPage()
      const links = screen.getAllByRole('link')
      expect(links.length).toBeGreaterThanOrEqual(3)
    })
  })

  // ── Error handling (getUser fails) ──────────────────────────────────────

  describe('when getUser throws after successful client creation', () => {
    it('renders the page when getUser rejects', async () => {
      mockCreateClient.mockResolvedValue({
        auth: {
          getUser: jest.fn().mockRejectedValue(new Error('Auth service unavailable')),
        },
      })
      await renderPage()
      expect(screen.getByText('How would you like to use CoverGuard?')).toBeInTheDocument()
    })

    it('does not redirect when getUser fails', async () => {
      mockCreateClient.mockResolvedValue({
        auth: {
          getUser: jest.fn().mockRejectedValue(new Error('Invalid JWT')),
        },
      })
      await renderPage()
      expect(mockRedirect).not.toHaveBeenCalled()
    })

    it('renders both cards when getUser times out', async () => {
      mockCreateClient.mockResolvedValue({
        auth: {
          getUser: jest.fn().mockRejectedValue(new Error('Request timeout')),
        },
      })
      await renderPage()
      expect(screen.getByText('Agent')).toBeInTheDocument()
      expect(screen.getByText('Individual')).toBeInTheDocument()
    })
  })

  // ── Edge cases for getUser response ─────────────────────────────────────

  describe('edge cases for getUser response', () => {
    it('handles getUser returning data with null user', async () => {
      mockCreateClient.mockResolvedValue({
        auth: {
          getUser: jest.fn().mockResolvedValue({ data: { user: null } }),
        },
      })
      await renderPage()
      expect(screen.getByText('How would you like to use CoverGuard?')).toBeInTheDocument()
      expect(mockRedirect).not.toHaveBeenCalled()
    })

    it('handles getUser returning data with undefined user', async () => {
      mockCreateClient.mockResolvedValue({
        auth: {
          getUser: jest.fn().mockResolvedValue({ data: { user: undefined } }),
        },
      })
      await renderPage()
      expect(mockRedirect).not.toHaveBeenCalled()
    })

    it('handles getUser returning empty data object', async () => {
      mockCreateClient.mockResolvedValue({
        auth: {
          getUser: jest.fn().mockResolvedValue({ data: {} }),
        },
      })
      await renderPage()
      expect(mockRedirect).not.toHaveBeenCalled()
    })

    it('handles user object with empty id (still truthy)', async () => {
      mockSupabaseClient({ id: '' })
      // Empty string id — still an object so !!user is true
      await expect(renderPage()).rejects.toThrow('NEXT_REDIRECT')
      expect(mockRedirect).toHaveBeenCalledWith('/dashboard')
    })

    it('redirects for user object with extra fields', async () => {
      mockSupabaseClient({ id: 'u1', email: 'x@y.com', app_metadata: {}, user_metadata: {} })
      await expect(renderPage()).rejects.toThrow('NEXT_REDIRECT')
      expect(mockRedirect).toHaveBeenCalledWith('/dashboard')
    })
  })

  // ── Page structure tests ────────────────────────────────────────────────

  describe('page structure', () => {
    beforeEach(() => {
      mockSupabaseClient(null)
    })

    it('contains a header element', async () => {
      await renderPage()
      expect(document.querySelector('header')).not.toBeNull()
    })

    it('contains a main element', async () => {
      await renderPage()
      expect(document.querySelector('main')).not.toBeNull()
    })

    it('has exactly 4 links (home, agent, individual card, individual footer)', async () => {
      await renderPage()
      const links = screen.getAllByRole('link')
      expect(links).toHaveLength(4)
    })

    it('renders two ArrowRight icons (one per card)', async () => {
      await renderPage()
      const arrows = screen.getAllByTestId('icon-arrow-right')
      expect(arrows).toHaveLength(2)
    })

    it('renders exactly one Building2 icon', async () => {
      await renderPage()
      expect(screen.getAllByTestId('icon-building2')).toHaveLength(1)
    })

    it('renders exactly one User icon', async () => {
      await renderPage()
      expect(screen.getAllByTestId('icon-user')).toHaveLength(1)
    })

    it('renders exactly one CoverGuard shield', async () => {
      await renderPage()
      expect(screen.getAllByTestId('coverguard-shield')).toHaveLength(1)
    })
  })

  // ── Metadata export ─────────────────────────────────────────────────────

  describe('metadata', () => {
    it('exports metadata with correct title', async () => {
      const { metadata } = await import('@/app/get-started/page')
      expect(metadata.title).toBe('Get Started — CoverGuard')
    })

    it('exports metadata with a description', async () => {
      const { metadata } = await import('@/app/get-started/page')
      expect(metadata.description).toBeDefined()
      expect(typeof metadata.description).toBe('string')
    })

    it('metadata description mentions agent and home buyer', async () => {
      const { metadata } = await import('@/app/get-started/page')
      expect(metadata.description).toContain('agent')
      expect(metadata.description).toContain('home buyer')
    })
  })

  // ── Multiple sequential renders (stability) ─────────────────────────────

  describe('stability across multiple renders', () => {
    it('renders consistently 5 times in a row (unauthenticated)', async () => {
      mockSupabaseClient(null)
      for (let i = 0; i < 5; i++) {
        const { unmount } = await renderPage()
        expect(screen.getByText('How would you like to use CoverGuard?')).toBeInTheDocument()
        unmount()
      }
    })

    it('redirects consistently 5 times in a row (authenticated)', async () => {
      mockSupabaseClient({ id: 'user-stable' })
      for (let i = 0; i < 5; i++) {
        await expect(renderPage()).rejects.toThrow('NEXT_REDIRECT')
      }
      expect(mockRedirect).toHaveBeenCalledTimes(5)
    })

    it('recovers after error then succeeds', async () => {
      // First call: error
      mockSupabaseThrows()
      const { unmount: unmount1 } = await renderPage()
      expect(screen.getByText('How would you like to use CoverGuard?')).toBeInTheDocument()
      unmount1()

      // Second call: success with no user
      mockSupabaseClient(null)
      const { unmount: unmount2 } = await renderPage()
      expect(screen.getByText('How would you like to use CoverGuard?')).toBeInTheDocument()
      unmount2()
    })
  })
})
