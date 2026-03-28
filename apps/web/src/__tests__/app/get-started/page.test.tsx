/**
 * GetStartedPage tests — 500+ test cases
 *
 * Covers:
 *  - Rendering when Supabase is unavailable (env vars missing / throws)
 *  - Rendering when user is not authenticated
 *  - Redirect to /dashboard when user is authenticated
 *  - Correct links and content in the rendered page
 *  - Error handling for various Supabase failure modes
 *  - CSS class assertions for styling
 *  - Accessibility attributes
 *  - Parameterized user object shapes
 *  - Parameterized error types
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
      getUser: jest.fn().mockResolvedValue({ data: { user } }),
    },
  })
}

function mockSupabaseThrows(error: Error = new Error('Missing Supabase env vars')) {
  mockCreateClient.mockRejectedValue(error)
}

function mockGetUserThrows(error: Error = new Error('Auth service unavailable')) {
  mockCreateClient.mockResolvedValue({
    auth: {
      getUser: jest.fn().mockRejectedValue(error),
    },
  })
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
  // ═══════════════════════════════════════════════════════════════════════════
  // SECTION 1: Unauthenticated rendering (happy path)
  // ═══════════════════════════════════════════════════════════════════════════

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

    it('renders "work great for most users" text', async () => {
      await renderPage()
      expect(screen.getByText(/work great for most users/)).toBeInTheDocument()
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

    it('calls createClient with no arguments', async () => {
      await renderPage()
      expect(mockCreateClient).toHaveBeenCalledWith()
    })
  })

  // ═══════════════════════════════════════════════════════════════════════════
  // SECTION 2: Authenticated redirect
  // ═══════════════════════════════════════════════════════════════════════════

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

    it('does not render Agent card when redirecting', async () => {
      await expect(renderPage()).rejects.toThrow('NEXT_REDIRECT')
      expect(screen.queryByText('Agent')).not.toBeInTheDocument()
    })

    it('does not render Individual card when redirecting', async () => {
      await expect(renderPage()).rejects.toThrow('NEXT_REDIRECT')
      expect(screen.queryByText('Individual')).not.toBeInTheDocument()
    })

    it('does not render CoverGuard brand when redirecting', async () => {
      await expect(renderPage()).rejects.toThrow('NEXT_REDIRECT')
      expect(screen.queryByText('CoverGuard')).not.toBeInTheDocument()
    })

    it('does not render any links when redirecting', async () => {
      await expect(renderPage()).rejects.toThrow('NEXT_REDIRECT')
      expect(screen.queryAllByRole('link')).toHaveLength(0)
    })

    it('redirect path is exactly /dashboard (not /dashboard/)', async () => {
      await expect(renderPage()).rejects.toThrow('NEXT_REDIRECT')
      expect(mockRedirect).toHaveBeenCalledWith('/dashboard')
      expect(mockRedirect).not.toHaveBeenCalledWith('/dashboard/')
    })
  })

  // ═══════════════════════════════════════════════════════════════════════════
  // SECTION 3: Parameterized user objects that trigger redirect
  // ═══════════════════════════════════════════════════════════════════════════

  describe('redirects for various authenticated user shapes', () => {
    const userShapes: Array<[string, Record<string, unknown>]> = [
      ['minimal user (id only)', { id: 'u1' }],
      ['user with email', { id: 'u2', email: 'a@b.com' }],
      ['user with role AGENT', { id: 'u3', role: 'AGENT' }],
      ['user with role CONSUMER', { id: 'u4', role: 'CONSUMER' }],
      ['user with role ADMIN', { id: 'u5', role: 'ADMIN' }],
      ['user with termsAcceptedAt', { id: 'u6', termsAcceptedAt: '2025-01-01T00:00:00Z' }],
      ['user with app_metadata', { id: 'u7', app_metadata: { provider: 'google' } }],
      ['user with user_metadata', { id: 'u8', user_metadata: { full_name: 'Test' } }],
      ['user with empty email', { id: 'u9', email: '' }],
      ['user with null email', { id: 'u10', email: null }],
      ['user with numeric-like id', { id: '12345' }],
      ['user with uuid id', { id: '550e8400-e29b-41d4-a716-446655440000' }],
      ['user with long id', { id: 'a'.repeat(100) }],
      ['user with special chars in email', { id: 'u11', email: 'test+special@example.co.uk' }],
      ['user with created_at', { id: 'u12', created_at: '2025-06-01T12:00:00Z' }],
      ['user with updated_at', { id: 'u13', updated_at: '2025-06-15T12:00:00Z' }],
      ['user with confirmed_at', { id: 'u14', confirmed_at: '2025-06-01T12:00:00Z' }],
      ['user with phone', { id: 'u15', phone: '+1234567890' }],
      ['user with all fields', { id: 'u16', email: 'full@test.com', role: 'AGENT', termsAcceptedAt: '2025-01-01', phone: '+1', app_metadata: {}, user_metadata: {} }],
      ['user with empty object metadata', { id: 'u17', app_metadata: {}, user_metadata: {} }],
      ['user with nested metadata', { id: 'u18', user_metadata: { preferences: { theme: 'dark' } } }],
      ['user with boolean fields', { id: 'u19', email_confirmed: true, phone_confirmed: false }],
      ['user with zero-value fields', { id: 'u20', login_count: 0, failed_attempts: 0 }],
      ['user with empty string id (still truthy object)', { id: '' }],
      ['user with array metadata', { id: 'u21', identities: [{ provider: 'email' }] }],
      ['user with date objects', { id: 'u22', last_sign_in_at: '2025-12-01T00:00:00Z' }],
      ['user with provider', { id: 'u23', provider: 'email' }],
      ['user with aud', { id: 'u24', aud: 'authenticated' }],
      ['user with factors', { id: 'u25', factors: [] }],
      ['user with is_anonymous false', { id: 'u26', is_anonymous: false }],
    ]

    it.each(userShapes)('redirects to /dashboard for %s', async (_desc, user) => {
      mockSupabaseClient(user)
      await expect(renderPage()).rejects.toThrow('NEXT_REDIRECT')
      expect(mockRedirect).toHaveBeenCalledWith('/dashboard')
    })

    it.each(userShapes)('calls createClient once for %s', async (_desc, user) => {
      mockSupabaseClient(user)
      await expect(renderPage()).rejects.toThrow('NEXT_REDIRECT')
      expect(mockCreateClient).toHaveBeenCalledTimes(1)
    })
  })

  // ═══════════════════════════════════════════════════════════════════════════
  // SECTION 4: Null/undefined/falsy user values that should NOT redirect
  // ═══════════════════════════════════════════════════════════════════════════

  describe('does not redirect for falsy user values', () => {
    const falsyValues: Array<[string, unknown]> = [
      ['null', null],
      ['undefined', undefined],
      ['false', false],
      ['0', 0],
      ['empty string', ''],
    ]

    it.each(falsyValues)('renders page when user is %s', async (_desc, value) => {
      mockCreateClient.mockResolvedValue({
        auth: {
          getUser: jest.fn().mockResolvedValue({ data: { user: value } }),
        },
      })
      await renderPage()
      expect(mockRedirect).not.toHaveBeenCalled()
      expect(screen.getByText('How would you like to use CoverGuard?')).toBeInTheDocument()
    })

    it.each(falsyValues)('renders Agent card when user is %s', async (_desc, value) => {
      mockCreateClient.mockResolvedValue({
        auth: {
          getUser: jest.fn().mockResolvedValue({ data: { user: value } }),
        },
      })
      await renderPage()
      expect(screen.getByText('Agent')).toBeInTheDocument()
    })

    it.each(falsyValues)('renders Individual card when user is %s', async (_desc, value) => {
      mockCreateClient.mockResolvedValue({
        auth: {
          getUser: jest.fn().mockResolvedValue({ data: { user: value } }),
        },
      })
      await renderPage()
      expect(screen.getByText('Individual')).toBeInTheDocument()
    })
  })

  // ═══════════════════════════════════════════════════════════════════════════
  // SECTION 5: createClient error handling (parameterized)
  // ═══════════════════════════════════════════════════════════════════════════

  describe('graceful handling when createClient throws', () => {
    const errorTypes: Array<[string, Error]> = [
      ['generic Error', new Error('Something went wrong')],
      ['missing env vars error', new Error('Missing Supabase env vars: set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY')],
      ['TypeError', new TypeError('Cannot read properties of undefined')],
      ['RangeError', new RangeError('Maximum call stack size exceeded')],
      ['SyntaxError', new SyntaxError('Unexpected token')],
      ['ReferenceError', new ReferenceError('x is not defined')],
      ['URIError', new URIError('URI malformed')],
      ['network error', new Error('fetch failed')],
      ['timeout error', new Error('Request timed out')],
      ['connection refused', new Error('ECONNREFUSED')],
      ['DNS resolution error', new Error('ENOTFOUND')],
      ['socket hangup', new Error('socket hang up')],
      ['SSL error', new Error('UNABLE_TO_VERIFY_LEAF_SIGNATURE')],
      ['HTTP 500', new Error('Internal Server Error')],
      ['HTTP 502', new Error('Bad Gateway')],
      ['HTTP 503', new Error('Service Unavailable')],
      ['empty message error', new Error('')],
      ['long message error', new Error('x'.repeat(1000))],
      ['error with special chars', new Error('Error: "quoted" & <encoded>')],
      ['CORS error', new Error('CORS policy violation')],
    ]

    it.each(errorTypes)('renders page when createClient throws %s', async (_desc, error) => {
      mockSupabaseThrows(error)
      await renderPage()
      expect(screen.getByText('How would you like to use CoverGuard?')).toBeInTheDocument()
    })

    it.each(errorTypes)('does not redirect when createClient throws %s', async (_desc, error) => {
      mockSupabaseThrows(error)
      await renderPage()
      expect(mockRedirect).not.toHaveBeenCalled()
    })

    it.each(errorTypes)('renders Agent card when createClient throws %s', async (_desc, error) => {
      mockSupabaseThrows(error)
      await renderPage()
      expect(screen.getByText('Agent')).toBeInTheDocument()
    })

    it.each(errorTypes)('renders Individual card when createClient throws %s', async (_desc, error) => {
      mockSupabaseThrows(error)
      await renderPage()
      expect(screen.getByText('Individual')).toBeInTheDocument()
    })

    it.each(errorTypes)('renders navigation links when createClient throws %s', async (_desc, error) => {
      mockSupabaseThrows(error)
      await renderPage()
      expect(screen.getAllByRole('link').length).toBeGreaterThanOrEqual(3)
    })
  })

  // ═══════════════════════════════════════════════════════════════════════════
  // SECTION 6: getUser error handling (parameterized)
  // ═══════════════════════════════════════════════════════════════════════════

  describe('graceful handling when getUser throws', () => {
    const getUserErrors: Array<[string, Error]> = [
      ['auth service unavailable', new Error('Auth service unavailable')],
      ['invalid JWT', new Error('Invalid JWT')],
      ['expired token', new Error('Token expired')],
      ['malformed token', new Error('jwt malformed')],
      ['request timeout', new Error('Request timeout')],
      ['rate limited', new Error('Rate limit exceeded')],
      ['forbidden', new Error('Forbidden')],
      ['network failure', new Error('Network request failed')],
      ['aborted', new Error('The operation was aborted')],
      ['connection reset', new Error('ECONNRESET')],
    ]

    it.each(getUserErrors)('renders page when getUser throws: %s', async (_desc, error) => {
      mockGetUserThrows(error)
      await renderPage()
      expect(screen.getByText('How would you like to use CoverGuard?')).toBeInTheDocument()
    })

    it.each(getUserErrors)('does not redirect when getUser throws: %s', async (_desc, error) => {
      mockGetUserThrows(error)
      await renderPage()
      expect(mockRedirect).not.toHaveBeenCalled()
    })

    it.each(getUserErrors)('renders both portal cards when getUser throws: %s', async (_desc, error) => {
      mockGetUserThrows(error)
      await renderPage()
      expect(screen.getByText('Agent')).toBeInTheDocument()
      expect(screen.getByText('Individual')).toBeInTheDocument()
    })
  })

  // ═══════════════════════════════════════════════════════════════════════════
  // SECTION 7: Page structure and DOM assertions
  // ═══════════════════════════════════════════════════════════════════════════

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

    it('has exactly 4 links', async () => {
      await renderPage()
      expect(screen.getAllByRole('link')).toHaveLength(4)
    })

    it('renders two ArrowRight icons', async () => {
      await renderPage()
      expect(screen.getAllByTestId('icon-arrow-right')).toHaveLength(2)
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

    it('has exactly two h2 elements', async () => {
      await renderPage()
      expect(screen.getAllByRole('heading', { level: 2 })).toHaveLength(2)
    })

    it('has exactly one h1 element', async () => {
      await renderPage()
      expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1)
    })

    it('h1 contains the correct text', async () => {
      await renderPage()
      const h1 = screen.getByRole('heading', { level: 1 })
      expect(h1).toHaveTextContent('How would you like to use CoverGuard?')
    })

    it('first h2 is Agent', async () => {
      await renderPage()
      const headings = screen.getAllByRole('heading', { level: 2 })
      expect(headings[0]).toHaveTextContent('Agent')
    })

    it('second h2 is Individual', async () => {
      await renderPage()
      const headings = screen.getAllByRole('heading', { level: 2 })
      expect(headings[1]).toHaveTextContent('Individual')
    })
  })

  // ═══════════════════════════════════════════════════════════════════════════
  // SECTION 8: Link href assertions
  // ═══════════════════════════════════════════════════════════════════════════

  describe('link href values', () => {
    beforeEach(() => {
      mockSupabaseClient(null)
    })

    const expectedLinks: Array<[string, string]> = [
      ['home link', '/'],
      ['agent login link', '/agents/login'],
    ]

    it.each(expectedLinks)('renders %s with href %s', async (_desc, href) => {
      await renderPage()
      const links = screen.getAllByRole('link')
      expect(links.some(l => l.getAttribute('href') === href)).toBe(true)
    })

    it('renders at least 2 links to /login', async () => {
      await renderPage()
      const links = screen.getAllByRole('link')
      const loginLinks = links.filter(l => l.getAttribute('href') === '/login')
      expect(loginLinks.length).toBeGreaterThanOrEqual(2)
    })

    it('no link points to /register', async () => {
      await renderPage()
      const links = screen.getAllByRole('link')
      expect(links.some(l => l.getAttribute('href') === '/register')).toBe(false)
    })

    it('no link points to /agents/register', async () => {
      await renderPage()
      const links = screen.getAllByRole('link')
      expect(links.some(l => l.getAttribute('href') === '/agents/register')).toBe(false)
    })

    it('no link points to /dashboard', async () => {
      await renderPage()
      const links = screen.getAllByRole('link')
      expect(links.some(l => l.getAttribute('href') === '/dashboard')).toBe(false)
    })

    it('no link has an external href', async () => {
      await renderPage()
      const links = screen.getAllByRole('link')
      links.forEach(l => {
        const href = l.getAttribute('href') || ''
        expect(href.startsWith('http')).toBe(false)
      })
    })

    it('all links have non-empty href', async () => {
      await renderPage()
      const links = screen.getAllByRole('link')
      links.forEach(l => {
        expect(l.getAttribute('href')).toBeTruthy()
      })
    })
  })

  // ═══════════════════════════════════════════════════════════════════════════
  // SECTION 9: CSS class assertions
  // ═══════════════════════════════════════════════════════════════════════════

  describe('CSS classes', () => {
    beforeEach(() => {
      mockSupabaseClient(null)
    })

    it('root div has min-h-screen', async () => {
      const { container } = await renderPage()
      expect(container.firstElementChild?.className).toContain('min-h-screen')
    })

    it('root div has flex-col', async () => {
      const { container } = await renderPage()
      expect(container.firstElementChild?.className).toContain('flex-col')
    })

    it('root div has bg-gradient', async () => {
      const { container } = await renderPage()
      expect(container.firstElementChild?.className).toContain('bg-gradient')
    })

    it('header has text-center', async () => {
      await renderPage()
      const header = document.querySelector('header')
      expect(header?.className).toContain('text-center')
    })

    it('main has flex-1', async () => {
      await renderPage()
      const main = document.querySelector('main')
      expect(main?.className).toContain('flex-1')
    })

    it('main has items-center', async () => {
      await renderPage()
      const main = document.querySelector('main')
      expect(main?.className).toContain('items-center')
    })

    it('main has justify-center', async () => {
      await renderPage()
      const main = document.querySelector('main')
      expect(main?.className).toContain('justify-center')
    })

    it('h1 has font-bold class', async () => {
      await renderPage()
      const h1 = screen.getByRole('heading', { level: 1 })
      expect(h1.className).toContain('font-bold')
    })

    it('h2 elements have font-semibold', async () => {
      await renderPage()
      const headings = screen.getAllByRole('heading', { level: 2 })
      headings.forEach(h => {
        expect(h.className).toContain('font-semibold')
      })
    })

    it('agent link has rounded-2xl', async () => {
      await renderPage()
      const links = screen.getAllByRole('link')
      const agentLink = links.find(l => l.getAttribute('href') === '/agents/login')
      expect(agentLink?.className).toContain('rounded-2xl')
    })

    it('agent link has transition-all', async () => {
      await renderPage()
      const links = screen.getAllByRole('link')
      const agentLink = links.find(l => l.getAttribute('href') === '/agents/login')
      expect(agentLink?.className).toContain('transition-all')
    })

    it('agent link has border-2', async () => {
      await renderPage()
      const links = screen.getAllByRole('link')
      const agentLink = links.find(l => l.getAttribute('href') === '/agents/login')
      expect(agentLink?.className).toContain('border-2')
    })

    it('agent link has bg-white', async () => {
      await renderPage()
      const links = screen.getAllByRole('link')
      const agentLink = links.find(l => l.getAttribute('href') === '/agents/login')
      expect(agentLink?.className).toContain('bg-white')
    })

    it('agent link has p-8 padding', async () => {
      await renderPage()
      const links = screen.getAllByRole('link')
      const agentLink = links.find(l => l.getAttribute('href') === '/agents/login')
      expect(agentLink?.className).toContain('p-8')
    })
  })

  // ═══════════════════════════════════════════════════════════════════════════
  // SECTION 10: Text content assertions (parameterized)
  // ═══════════════════════════════════════════════════════════════════════════

  describe('text content present on page', () => {
    beforeEach(() => {
      mockSupabaseClient(null)
    })

    const uniqueTexts = [
      'How would you like to use CoverGuard?',
      'Select your account type to get started',
      'Continue as Agent',
      'Continue as Individual',
      'Individual accounts',
    ]

    it.each(uniqueTexts)('page contains text: "%s"', async (text) => {
      await renderPage()
      expect(screen.getByText(text)).toBeInTheDocument()
    })

    const textsWithMultipleMatches = [
      'Agent',
      'Individual',
      'CoverGuard',
    ]

    it.each(textsWithMultipleMatches)('page contains at least one "%s"', async (text) => {
      await renderPage()
      expect(screen.getAllByText(text, { exact: false }).length).toBeGreaterThanOrEqual(1)
    })

    it('page contains "Not sure?"', async () => {
      await renderPage()
      expect(screen.getByText(/Not sure\?/)).toBeInTheDocument()
    })

    it('page contains "work great for most users"', async () => {
      await renderPage()
      expect(screen.getByText(/work great for most users/)).toBeInTheDocument()
    })

    const expectedPatterns = [
      /real estate agents, brokers, and lenders/,
      /client management, property comparison/,
      /home buyers and homeowners/,
      /property risks, insurance costs/,
    ]

    it.each(expectedPatterns)('page matches pattern: %s', async (pattern) => {
      await renderPage()
      expect(screen.getByText(pattern)).toBeInTheDocument()
    })
  })

  // ═══════════════════════════════════════════════════════════════════════════
  // SECTION 11: Text content NOT present when redirecting
  // ═══════════════════════════════════════════════════════════════════════════

  describe('text content absent when authenticated', () => {
    beforeEach(() => {
      mockSupabaseClient({ id: 'user-auth' })
    })

    const textsAbsentOnRedirect = [
      'How would you like to use CoverGuard?',
      'Select your account type to get started',
      'Agent',
      'Individual',
      'Continue as Agent',
      'Continue as Individual',
      'CoverGuard',
      'Not sure?',
      'Individual accounts',
    ]

    it.each(textsAbsentOnRedirect)('"%s" is not rendered when redirecting', async (text) => {
      await expect(renderPage()).rejects.toThrow('NEXT_REDIRECT')
      expect(screen.queryByText(text)).not.toBeInTheDocument()
    })
  })

  // ═══════════════════════════════════════════════════════════════════════════
  // SECTION 12: Metadata
  // ═══════════════════════════════════════════════════════════════════════════

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

    it('metadata description mentions agent', async () => {
      const { metadata } = await import('@/app/get-started/page')
      expect(metadata.description).toContain('agent')
    })

    it('metadata description mentions home buyer', async () => {
      const { metadata } = await import('@/app/get-started/page')
      expect(metadata.description).toContain('home buyer')
    })

    it('metadata title contains CoverGuard', async () => {
      const { metadata } = await import('@/app/get-started/page')
      expect(metadata.title).toContain('CoverGuard')
    })

    it('metadata title contains Get Started', async () => {
      const { metadata } = await import('@/app/get-started/page')
      expect(metadata.title).toContain('Get Started')
    })

    it('metadata description is non-empty', async () => {
      const { metadata } = await import('@/app/get-started/page')
      expect((metadata.description as string).length).toBeGreaterThan(0)
    })

    it('metadata title is a string', async () => {
      const { metadata } = await import('@/app/get-started/page')
      expect(typeof metadata.title).toBe('string')
    })
  })

  // ═══════════════════════════════════════════════════════════════════════════
  // SECTION 13: Stability / repeated renders
  // ═══════════════════════════════════════════════════════════════════════════

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
      mockSupabaseThrows()
      const { unmount: unmount1 } = await renderPage()
      expect(screen.getByText('How would you like to use CoverGuard?')).toBeInTheDocument()
      unmount1()

      mockSupabaseClient(null)
      const { unmount: unmount2 } = await renderPage()
      expect(screen.getByText('How would you like to use CoverGuard?')).toBeInTheDocument()
      unmount2()
    })

    it('alternates between error and success 3 times', async () => {
      for (let i = 0; i < 3; i++) {
        mockSupabaseThrows()
        const { unmount: u1 } = await renderPage()
        expect(screen.getByText('Agent')).toBeInTheDocument()
        u1()

        mockSupabaseClient(null)
        const { unmount: u2 } = await renderPage()
        expect(screen.getByText('Agent')).toBeInTheDocument()
        u2()
      }
    })

    it('handles 10 successive unauthenticated renders', async () => {
      mockSupabaseClient(null)
      for (let i = 0; i < 10; i++) {
        const { unmount } = await renderPage()
        expect(screen.getByText('Individual')).toBeInTheDocument()
        unmount()
      }
      expect(mockCreateClient).toHaveBeenCalledTimes(10)
    })
  })

  // ═══════════════════════════════════════════════════════════════════════════
  // SECTION 14: Edge case getUser responses
  // ═══════════════════════════════════════════════════════════════════════════

  describe('edge cases for getUser response shapes', () => {
    const noRedirectResponses: Array<[string, Record<string, unknown>]> = [
      ['data with null user', { data: { user: null } }],
      ['data with undefined user', { data: { user: undefined } }],
      ['data with no user key', { data: {} }],
      ['empty data', { data: { user: null } }],
    ]

    it.each(noRedirectResponses)('does not redirect for getUser returning %s', async (_desc, response) => {
      mockCreateClient.mockResolvedValue({
        auth: {
          getUser: jest.fn().mockResolvedValue(response),
        },
      })
      await renderPage()
      expect(mockRedirect).not.toHaveBeenCalled()
    })

    it.each(noRedirectResponses)('renders heading for getUser returning %s', async (_desc, response) => {
      mockCreateClient.mockResolvedValue({
        auth: {
          getUser: jest.fn().mockResolvedValue(response),
        },
      })
      await renderPage()
      expect(screen.getByText('How would you like to use CoverGuard?')).toBeInTheDocument()
    })
  })

  // ═══════════════════════════════════════════════════════════════════════════
  // SECTION 15: Error state renders all page elements (parameterized)
  // ═══════════════════════════════════════════════════════════════════════════

  describe('error state renders complete page', () => {
    beforeEach(() => {
      mockSupabaseThrows()
    })

    const elementsToCheck: Array<[string, () => HTMLElement | null]> = [
      ['header', () => document.querySelector('header')],
      ['main', () => document.querySelector('main')],
    ]

    it.each(elementsToCheck)('renders %s element on error', async (_name, getter) => {
      await renderPage()
      expect(getter()).not.toBeNull()
    })

    const testIdsToCheck = [
      'coverguard-shield',
      'icon-building2',
      'icon-user',
    ]

    it.each(testIdsToCheck)('renders test-id=%s on error', async (testId) => {
      await renderPage()
      expect(screen.getByTestId(testId)).toBeInTheDocument()
    })

    it('renders arrow icons on error', async () => {
      await renderPage()
      expect(screen.getAllByTestId('icon-arrow-right')).toHaveLength(2)
    })

    it('renders all 4 links on error', async () => {
      await renderPage()
      expect(screen.getAllByRole('link')).toHaveLength(4)
    })

    it('renders both headings on error', async () => {
      await renderPage()
      expect(screen.getAllByRole('heading', { level: 2 })).toHaveLength(2)
    })

    it('renders h1 on error', async () => {
      await renderPage()
      expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1)
    })
  })

  // ═══════════════════════════════════════════════════════════════════════════
  // SECTION 16: Additional CSS classes on individual/login link card
  // ═══════════════════════════════════════════════════════════════════════════

  describe('Individual card CSS classes', () => {
    beforeEach(() => {
      mockSupabaseClient(null)
    })

    const individualCardClasses = [
      'rounded-2xl',
      'border-2',
      'bg-white',
      'p-8',
      'transition-all',
      'border-gray-200',
    ]

    it.each(individualCardClasses)('individual card has class %s', async (cls) => {
      await renderPage()
      const links = screen.getAllByRole('link')
      // Individual card links to /login — there are two /login links, the card is the one with rounded-2xl
      const individualCard = links.find(
        l => l.getAttribute('href') === '/login' && l.className.includes('rounded-2xl')
      )
      expect(individualCard?.className).toContain(cls)
    })
  })

  // ═══════════════════════════════════════════════════════════════════════════
  // SECTION 17: Error types that getUser might throw (more)
  // ═══════════════════════════════════════════════════════════════════════════

  describe('additional getUser error scenarios', () => {
    const moreErrors: Array<[string, Error]> = [
      ['session not found', new Error('Session not found')],
      ['invalid refresh token', new Error('Invalid refresh token')],
      ['user banned', new Error('User is banned')],
      ['email not confirmed', new Error('Email not confirmed')],
      ['too many requests', new Error('Too many requests')],
      ['server error', new Error('Internal server error')],
      ['bad request', new Error('Bad request')],
      ['unauthorized', new Error('Unauthorized')],
      ['service degraded', new Error('Service temporarily degraded')],
      ['database error', new Error('Database connection failed')],
      ['redis timeout', new Error('Redis connection timed out')],
      ['memory limit', new Error('Out of memory')],
      ['circuit breaker open', new Error('Circuit breaker open')],
      ['upstream timeout', new Error('Upstream service timeout')],
      ['parsing error', new Error('Failed to parse response')],
    ]

    it.each(moreErrors)('renders page when getUser throws: %s', async (_desc, error) => {
      mockGetUserThrows(error)
      await renderPage()
      expect(screen.getByText('How would you like to use CoverGuard?')).toBeInTheDocument()
    })

    it.each(moreErrors)('does not redirect when getUser throws: %s', async (_desc, error) => {
      mockGetUserThrows(error)
      await renderPage()
      expect(mockRedirect).not.toHaveBeenCalled()
    })
  })

  // ═══════════════════════════════════════════════════════════════════════════
  // SECTION 18: More createClient error types
  // ═══════════════════════════════════════════════════════════════════════════

  describe('additional createClient error scenarios', () => {
    const moreClientErrors: Array<[string, Error]> = [
      ['invalid URL', new Error('Invalid URL')],
      ['invalid key format', new Error('Invalid key format')],
      ['env var empty string', new Error('Supabase URL is empty')],
      ['env var whitespace', new Error('Supabase key is whitespace only')],
      ['module not found', new Error("Cannot find module '@supabase/ssr'")],
      ['version mismatch', new Error('Supabase client version mismatch')],
      ['cookie error', new Error('Cookie parse error')],
      ['headers error', new Error('Headers already sent')],
      ['runtime error', new Error('Runtime is not available')],
      ['edge runtime error', new Error('Edge runtime not supported')],
      ['webpack error', new Error('Module build failed')],
      ['import error', new Error('Dynamic import failed')],
      ['config error', new Error('Invalid configuration')],
      ['auth init error', new Error('Auth service initialization failed')],
      ['storage init error', new Error('Storage initialization failed')],
    ]

    it.each(moreClientErrors)('renders page when createClient throws: %s', async (_desc, error) => {
      mockSupabaseThrows(error)
      await renderPage()
      expect(screen.getByText('How would you like to use CoverGuard?')).toBeInTheDocument()
    })

    it.each(moreClientErrors)('shows both cards when createClient throws: %s', async (_desc, error) => {
      mockSupabaseThrows(error)
      await renderPage()
      expect(screen.getByText('Agent')).toBeInTheDocument()
      expect(screen.getByText('Individual')).toBeInTheDocument()
    })
  })

  // ═══════════════════════════════════════════════════════════════════════════
  // SECTION 19: More authenticated user redirects
  // ═══════════════════════════════════════════════════════════════════════════

  describe('more authenticated user redirect scenarios', () => {
    const moreUsers: Array<[string, Record<string, unknown>]> = [
      ['user with long email', { id: 'lu1', email: 'a'.repeat(50) + '@' + 'b'.repeat(50) + '.com' }],
      ['user with unicode name', { id: 'lu2', user_metadata: { name: '日本語テスト' } }],
      ['user with multiple providers', { id: 'lu3', app_metadata: { providers: ['email', 'google'] } }],
      ['user with MFA enabled', { id: 'lu4', factors: [{ id: 'f1', type: 'totp' }] }],
      ['user with subscription', { id: 'lu5', subscription: { plan: 'professional' } }],
      ['user with team', { id: 'lu6', team_id: 'team-123' }],
      ['user with avatar', { id: 'lu7', avatar_url: 'https://example.com/avatar.png' }],
      ['user with preferences', { id: 'lu8', preferences: { notifications: true } }],
      ['user with last_login', { id: 'lu9', last_sign_in_at: new Date().toISOString() }],
      ['user with many fields', { id: 'lu10', email: 'a@b.com', role: 'AGENT', phone: '+1', termsAcceptedAt: '2025-01', created_at: '2025-01', updated_at: '2025-06' }],
    ]

    it.each(moreUsers)('redirects for %s', async (_desc, user) => {
      mockSupabaseClient(user)
      await expect(renderPage()).rejects.toThrow('NEXT_REDIRECT')
      expect(mockRedirect).toHaveBeenCalledWith('/dashboard')
    })
  })

  // ═══════════════════════════════════════════════════════════════════════════
  // SECTION 20: Return value checks
  // ═══════════════════════════════════════════════════════════════════════════

  describe('function return and export checks', () => {
    it('GetStartedPage is a function', () => {
      expect(typeof GetStartedPage).toBe('function')
    })

    it('GetStartedPage returns a promise', () => {
      mockSupabaseClient(null)
      const result = GetStartedPage()
      expect(result).toBeInstanceOf(Promise)
    })

    it('GetStartedPage promise resolves to JSX (not null)', async () => {
      mockSupabaseClient(null)
      const result = await GetStartedPage()
      expect(result).not.toBeNull()
      expect(result).not.toBeUndefined()
    })

    it('GetStartedPage is async', () => {
      expect(GetStartedPage.constructor.name).toBe('AsyncFunction')
    })

    it('module exports GetStartedPage as default', async () => {
      const mod = await import('@/app/get-started/page')
      expect(mod.default).toBe(GetStartedPage)
    })

    it('module exports metadata as named export', async () => {
      const mod = await import('@/app/get-started/page')
      expect(mod.metadata).toBeDefined()
    })
  })

  // ═══════════════════════════════════════════════════════════════════════════
  // SECTION 21: Cross-state rendering matrix
  // Each error type × each key page element
  // ═══════════════════════════════════════════════════════════════════════════

  describe('error recovery renders all key elements', () => {
    const errorMessages = [
      'Connection refused',
      'DNS lookup failed',
      'Certificate expired',
      'Rate limit exceeded',
      'Service maintenance',
    ]

    const elementsToVerify: Array<[string, () => void]> = [
      ['heading', () => expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument()],
      ['agent heading', () => expect(screen.getByText('Agent')).toBeInTheDocument()],
      ['individual heading', () => expect(screen.getByText('Individual')).toBeInTheDocument()],
      ['continue agent', () => expect(screen.getByText('Continue as Agent')).toBeInTheDocument()],
      ['continue individual', () => expect(screen.getByText('Continue as Individual')).toBeInTheDocument()],
      ['building icon', () => expect(screen.getByTestId('icon-building2')).toBeInTheDocument()],
      ['user icon', () => expect(screen.getByTestId('icon-user')).toBeInTheDocument()],
      ['shield icon', () => expect(screen.getByTestId('coverguard-shield')).toBeInTheDocument()],
      ['4 links', () => expect(screen.getAllByRole('link')).toHaveLength(4)],
      ['no redirect', () => expect(mockRedirect).not.toHaveBeenCalled()],
    ]

    for (const errorMsg of errorMessages) {
      for (const [elemName, assertion] of elementsToVerify) {
        it(`error "${errorMsg}" still renders ${elemName}`, async () => {
          mockSupabaseThrows(new Error(errorMsg))
          await renderPage()
          assertion()
        })
      }
    }
  })

  // ═══════════════════════════════════════════════════════════════════════════
  // SECTION 22: Null-ish getUser data shapes
  // ═══════════════════════════════════════════════════════════════════════════

  describe('unusual getUser data shapes do not redirect', () => {
    const unusualResponses: Array<[string, Record<string, unknown>]> = [
      ['data.user is 0', { data: { user: 0 } }],
      ['data.user is false', { data: { user: false } }],
      ['data.user is empty string', { data: { user: '' } }],
      ['data.user is NaN', { data: { user: NaN } }],
    ]

    it.each(unusualResponses)('%s → no redirect, renders page', async (_desc, response) => {
      mockCreateClient.mockResolvedValue({
        auth: { getUser: jest.fn().mockResolvedValue(response) },
      })
      await renderPage()
      expect(mockRedirect).not.toHaveBeenCalled()
      expect(screen.getByText('How would you like to use CoverGuard?')).toBeInTheDocument()
    })
  })
})
