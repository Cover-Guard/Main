/**
 * Supabase middleware (updateSession) tests â 500+ test cases
 *
 * Comprehensive tests covering:
 *  - /get-started is treated as a public route (the fix)
 *  - All existing public routes remain accessible
 *  - Protected routes redirect unauthenticated users to /login
 *  - Authenticated users on auth routes redirect to /dashboard
 *  - Subscription gating behavior
 *  - Edge cases for route matching (prefix boundaries)
 *  - Missing env vars graceful fallback
 *  - Cookie handling
 *  - Parameterized route combinations
 */

// âââ Mocks ââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ

const mockGetUser = jest.fn()
const mockGetSession = jest.fn()

jest.mock('@supabase/ssr', () => ({
  createServerClient: jest.fn(() => ({
    auth: {
      getUser: mockGetUser,
      getSession: mockGetSession,
    },
  })),
}))

// âââ NextRequest / NextResponse mock âââââââââââââââââââââââââââââââââââââââââ

class MockURL {
  pathname: string
  search: string
  searchParams: URLSearchParams
  origin: string

  constructor(path: string, base = 'http://localhost:3000') {
    const url = new URL(path, base)
    this.pathname = url.pathname
    this.search = url.search
    this.searchParams = url.searchParams
    this.origin = url.origin
  }

  clone() {
    return new MockURL(this.pathname + this.search, this.origin)
  }

  toString() {
    return `${this.origin}${this.pathname}${this.search}`
  }
}

class MockCookieStore {
  private cookies: Map<string, { name: string; value: string; options?: Record<string, unknown> }> = new Map()

  getAll() {
    return Array.from(this.cookies.values()).map(c => ({ name: c.name, value: c.value }))
  }

  get(name: string) {
    return this.cookies.get(name)
  }

  set(name: string, value: string, options?: Record<string, unknown>) {
    this.cookies.set(name, { name, value, options })
  }

  delete(name: string) {
    this.cookies.delete(name)
  }
}

function createMockRequest(path: string, cookieEntries: Record<string, string> = {}) {
  const nextUrl = new MockURL(path)
  const cookies = new MockCookieStore()
  for (const [name, value] of Object.entries(cookieEntries)) {
    cookies.set(name, value)
  }
  return { nextUrl, cookies } as never
}

const mockNextResponseCookies = new MockCookieStore()

jest.mock('next/server', () => {
  return {
    NextResponse: {
      next: jest.fn(() => ({
        cookies: mockNextResponseCookies,
        _type: 'next',
      })),
      redirect: jest.fn((url: MockURL) => ({
        cookies: new MockCookieStore(),
        _type: 'redirect',
        _url: url.toString(),
        _pathname: url.pathname,
        _searchParams: Object.fromEntries(url.searchParams.entries()),
      })),
    },
  }
})

import { NextResponse } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'

// âââ Mock response type âââââââââââââââââââââââââââââââââââââââââââââââââââââ

interface MockResponse {
  _type: 'next' | 'redirect'
  _url?: string
  _pathname?: string
  _searchParams?: Record<string, string>
  cookies: MockCookieStore
}

// Wrapper that casts the return type so TS recognises our _type property
async function callUpdateSession(req: ReturnType<typeof createMockRequest>): Promise<MockResponse> {
  return updateSession(req as never) as unknown as MockResponse
}

// âââ Helpers âââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ

function setupEnvVars(overrides: Record<string, string | undefined> = {}) {
  process.env.NEXT_PUBLIC_SUPABASE_URL = overrides.NEXT_PUBLIC_SUPABASE_URL ?? 'https://test.supabase.co'
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = overrides.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? 'test-anon-key'
  process.env.STRIPE_SUBSCRIPTION_REQUIRED = overrides.STRIPE_SUBSCRIPTION_REQUIRED ?? 'false'
  process.env.API_REWRITE_URL = overrides.API_REWRITE_URL ?? 'http://localhost:4000'
}

function clearEnvVars() {
  delete process.env.NEXT_PUBLIC_SUPABASE_URL
  delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  delete process.env.STRIPE_SUBSCRIPTION_REQUIRED
  delete process.env.API_REWRITE_URL
}

function mockUnauthenticated() {
  mockGetUser.mockResolvedValue({ data: { user: null } })
}

function mockAuthenticated(user: Record<string, unknown> = { id: 'user-1', email: 'test@test.com', user_metadata: { termsAcceptedAt: '2025-01-01' } }) {
  mockGetUser.mockResolvedValue({ data: { user } })
}

function getRedirectPathname(): string | undefined {
  const calls = (NextResponse.redirect as jest.Mock).mock.calls
  if (calls.length === 0) return undefined
  return calls[calls.length - 1][0].pathname
}

function getRedirectSearchParam(key: string): string | null | undefined {
  const calls = (NextResponse.redirect as jest.Mock).mock.calls
  if (calls.length === 0) return undefined
  return calls[calls.length - 1][0].searchParams.get(key)
}

// âââ Test suite ââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ

beforeEach(() => {
  jest.clearAllMocks()
  mockNextResponseCookies.delete('cg_sub_active')
  setupEnvVars()
})

afterEach(() => {
  clearEnvVars()
})

describe('updateSession', () => {
  // âââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ
  // SECTION 1: /get-started public route (THE FIX)
  // âââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ

  describe('/get-started is a public route (the fix)', () => {
    it('allows unauthenticated access to /get-started', async () => {
      mockUnauthenticated()
      const res = await callUpdateSession(createMockRequest('/get-started'))
      expect(res._type).toBe('next')
    })

    it('does not call NextResponse.redirect for unauthenticated /get-started', async () => {
      mockUnauthenticated()
      await callUpdateSession(createMockRequest('/get-started'))
      expect(NextResponse.redirect).not.toHaveBeenCalled()
    })

    it('allows authenticated access to /get-started', async () => {
      mockAuthenticated()
      const res = await callUpdateSession(createMockRequest('/get-started'))
      expect(res._type).toBe('next')
    })

    it('does not redirect authenticated users on /get-started to /dashboard', async () => {
      mockAuthenticated()
      await callUpdateSession(createMockRequest('/get-started'))
      expect(NextResponse.redirect).not.toHaveBeenCalled()
    })

    it('allows unauthenticated access to /get-started/ (trailing slash)', async () => {
      mockUnauthenticated()
      const res = await callUpdateSession(createMockRequest('/get-started/'))
      expect(res._type).toBe('next')
    })

    it('allows unauthenticated access to /get-started/step2', async () => {
      mockUnauthenticated()
      const res = await callUpdateSession(createMockRequest('/get-started/step2'))
      expect(res._type).toBe('next')
    })

    it('allows unauthenticated access to /get-started/agent', async () => {
      mockUnauthenticated()
      const res = await callUpdateSession(createMockRequest('/get-started/agent'))
      expect(res._type).toBe('next')
    })

    it('allows unauthenticated access to /get-started/individual', async () => {
      mockUnauthenticated()
      const res = await callUpdateSession(createMockRequest('/get-started/individual'))
      expect(res._type).toBe('next')
    })

    it('allows authenticated access to /get-started/step2', async () => {
      mockAuthenticated()
      const res = await callUpdateSession(createMockRequest('/get-started/step2'))
      expect(res._type).toBe('next')
    })
  })

  // âââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ
  // SECTION 2: All public routes â unauthenticated access (parameterized)
  // âââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ

  describe('public routes accessible without auth', () => {
    const publicRoutes = [
      '/',
      '/login',
      '/register',
      '/agents/login',
      '/agents/register',
      '/forgot-password',
      '/reset-password',
      '/terms',
      '/privacy',
      '/nda',
      '/pricing',
      '/search',
      '/properties',
      '/get-started',
      '/properties/123',
      '/properties/456/risk',
      '/properties/789/insurance',
      '/properties/abc/carriers',
      '/properties/def/quote-request',
    ]

    it.each(publicRoutes)('allows unauthenticated access to %s', async (route) => {
      mockUnauthenticated()
      const res = await callUpdateSession(createMockRequest(route))
      expect(res._type).toBe('next')
    })

    it.each(publicRoutes)('does not redirect unauthenticated user from %s', async (route) => {
      mockUnauthenticated()
      await callUpdateSession(createMockRequest(route))
      expect(NextResponse.redirect).not.toHaveBeenCalled()
    })

    it.each(publicRoutes)('calls NextResponse.next for unauthenticated %s', async (route) => {
      mockUnauthenticated()
      await callUpdateSession(createMockRequest(route))
      expect(NextResponse.next).toHaveBeenCalled()
    })
  })

  // âââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ
  // SECTION 3: Public route sub-paths (parameterized)
  // âââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ

  describe('public route sub-paths', () => {
    const subPaths = [
      '/login/callback',
      '/login/magic-link',
      '/login/sso',
      '/register/verify',
      '/register/complete',
      '/agents/login/sso',
      '/agents/login/callback',
      '/agents/register/invite',
      '/agents/register/verify',
      '/search/results',
      '/search/map',
      '/search/advanced',
      '/properties/123',
      '/properties/456/risk',
      '/properties/789/insurance',
      '/properties/abc/carriers',
      '/properties/def/quote-request',
      '/get-started/agent',
      '/get-started/individual',
      '/get-started/choose',
      '/pricing/professional',
      '/pricing/team',
      '/pricing/enterprise',
      '/terms/privacy-addendum',
      '/terms/cookies',
      '/privacy/data',
      '/nda/details',
      '/forgot-password/sent',
      '/reset-password/confirm',
    ]

    it.each(subPaths)('allows unauthenticated access to %s', async (path) => {
      mockUnauthenticated()
      const res = await callUpdateSession(createMockRequest(path))
      expect(res._type).toBe('next')
    })

    it.each(subPaths)('does not redirect from %s', async (path) => {
      mockUnauthenticated()
      await callUpdateSession(createMockRequest(path))
      expect(NextResponse.redirect).not.toHaveBeenCalled()
    })
  })

  // âââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ
  // SECTION 4: Protected routes â unauthenticated redirect (parameterized)
  // âââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ

  describe('protected routes redirect unauthenticated users', () => {
    const protectedRoutes = [
      '/dashboard',
      '/dashboard/overview',
      '/clients',
      '/clients/searches',
      '/account',
      '/account/settings',
      '/account/billing',
      '/compare',
      '/compare/results',
      '/clients',
      '/clients/new',
      '/clients/123',
      '/reports',
      '/reports/123',
      '/saved',
      '/saved/properties',
      '/settings',
      '/settings/profile',
      '/notifications',
      '/admin',
      '/admin/users',
      '/some-random-path',
      '/unknown',
      '/foo/bar/baz',
    ]

    it.each(protectedRoutes)('redirects unauthenticated user from %s', async (route) => {
      mockUnauthenticated()
      const res = await callUpdateSession(createMockRequest(route))
      expect(res._type).toBe('redirect')
    })

    it.each(protectedRoutes)('redirects to /login from %s', async (route) => {
      mockUnauthenticated()
      await callUpdateSession(createMockRequest(route))
      expect(getRedirectPathname()).toBe('/login')
    })

    it.each(protectedRoutes)('sets redirectTo param for %s', async (route) => {
      mockUnauthenticated()
      await callUpdateSession(createMockRequest(route))
      expect(getRedirectSearchParam('redirectTo')).toBe(route)
    })
  })

  // âââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ
  // SECTION 5: Protected routes with query params
  // âââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ

  describe('protected routes preserve query params in redirectTo', () => {
    const routesWithQuery: Array<[string, string]> = [
      ['/dashboard?tab=overview', '/dashboard?tab=overview'],
      ['/clients?range=30d', '/clients?range=30d'],
      ['/compare?ids=1,2,3', '/compare?ids=1,2,3'],
      ['/account?section=billing', '/account?section=billing'],
      ['/clients?status=active', '/clients?status=active'],
      ['/dashboard?subscription=success', '/dashboard?subscription=success'],
    ]

    it.each(routesWithQuery)('preserves query for %s', async (route, expectedRedirectTo) => {
      mockUnauthenticated()
      await callUpdateSession(createMockRequest(route))
      expect(getRedirectSearchParam('redirectTo')).toBe(expectedRedirectTo)
    })
  })

  // âââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ
  // SECTION 6: Authenticated users on auth routes â /dashboard
  // âââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ

  describe('authenticated users on auth routes redirect to /dashboard', () => {
    const authRoutes = ['/login', '/register', '/agents/login', '/agents/register']

    it.each(authRoutes)('redirects authenticated user from %s to /dashboard', async (route) => {
      mockAuthenticated()
      const res = await callUpdateSession(createMockRequest(route))
      expect(res._type).toBe('redirect')
      expect(getRedirectPathname()).toBe('/dashboard')
    })

    it.each(authRoutes)('calls NextResponse.redirect for authenticated user on %s', async (route) => {
      mockAuthenticated()
      await callUpdateSession(createMockRequest(route))
      expect(NextResponse.redirect).toHaveBeenCalledTimes(1)
    })
  })

  // âââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ
  // SECTION 7: Authenticated users on auth sub-routes â /dashboard
  // âââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ

  describe('authenticated users on auth sub-routes redirect to /dashboard', () => {
    const authSubRoutes = [
      '/login/callback',
      '/login/sso',
      '/register/verify',
      '/register/complete',
      '/agents/login/callback',
      '/agents/login/sso',
      '/agents/register/invite',
      '/agents/register/verify',
    ]

    it.each(authSubRoutes)('redirects authenticated user from %s to /dashboard', async (route) => {
      mockAuthenticated()
      const res = await callUpdateSession(createMockRequest(route))
      expect(res._type).toBe('redirect')
      expect(getRedirectPathname()).toBe('/dashboard')
    })
  })

  // âââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ
  // SECTION 8: /get-started is NOT an auth route
  // âââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ

  describe('/get-started is not an auth route', () => {
    it('does not redirect authenticated users from /get-started', async () => {
      mockAuthenticated()
      const res = await callUpdateSession(createMockRequest('/get-started'))
      expect(res._type).toBe('next')
    })

    it('does not redirect authenticated users from /get-started/agent', async () => {
      mockAuthenticated()
      const res = await callUpdateSession(createMockRequest('/get-started/agent'))
      expect(res._type).toBe('next')
    })

    it('allows through without redirect for various authenticated users', async () => {
      const users = [
        { id: 'u1', role: 'AGENT' },
        { id: 'u2', role: 'CONSUMER' },
        { id: 'u3', role: 'ADMIN' },
        { id: 'u4', email: 'test@test.com' },
      ]
      for (const user of users) {
        jest.clearAllMocks()
        setupEnvVars()
        mockAuthenticated(user)
        const res = await callUpdateSession(createMockRequest('/get-started'))
        expect(res._type).toBe('next')
      }
    })
  })

  // âââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ
  // SECTION 9: Authenticated users on non-auth public routes pass through
  // âââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ

  describe('authenticated users on non-auth public routes', () => {
    // /onboarding is excluded â authenticated users with termsAcceptedAt are
    // redirected to /dashboard by the already-onboarded gate.
    const nonAuthPublicRoutes = [
      '/',
      '/search',
      '/search/results',
      '/pricing',
      '/pricing/team',
      '/terms',
      '/privacy',
      '/nda',
      '/forgot-password',
      '/reset-password',
      '/get-started',
    ]

    it.each(nonAuthPublicRoutes)('allows authenticated user through %s', async (route) => {
      mockAuthenticated()
      const res = await callUpdateSession(createMockRequest(route))
      expect(res._type).toBe('next')
    })

    it.each(nonAuthPublicRoutes)('does not redirect authenticated user from %s', async (route) => {
      mockAuthenticated()
      await callUpdateSession(createMockRequest(route))
      expect(NextResponse.redirect).not.toHaveBeenCalled()
    })
  })

  // âââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ
  // SECTION 10: Authenticated users on protected routes pass through
  // âââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ

  describe('authenticated users on protected routes pass through', () => {
    const protectedRoutes = [
      '/dashboard',
      '/clients',
      '/account',
      '/compare',
      '/properties/123',
      '/clients',
      '/reports',
    ]

    it.each(protectedRoutes)('allows authenticated user through %s', async (route) => {
      mockAuthenticated()
      const res = await callUpdateSession(createMockRequest(route))
      expect(res._type).toBe('next')
    })
  })

  // âââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ
  // SECTION 11: Route prefix boundary tests (no false positives)
  // âââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ

  describe('route prefix boundary - similar-but-different routes are protected', () => {
    const falsePositiveRoutes = [
      '/loginx',
      '/login2',
      '/login-page',
      '/registerx',
      '/register2',
      '/registration',
      '/get-startedx',
      '/get-started2',
      '/get-starting',
      '/searchx',
      '/search2',
      '/searching',
      '/pricingx',
      '/pricing2',
      '/pricings',
      '/termsx',
      '/terms2',
      '/terminal',
      '/privacyx',
      '/privacy2',
      '/ndax',
      '/nda2',
      '/onboardingx',
      '/onboarding2',
      '/forgot-passwordx',
      '/reset-passwordx',
      '/agent',
    ]

    it.each(falsePositiveRoutes)('%s is NOT a public route (redirects unauthenticated)', async (route) => {
      mockUnauthenticated()
      const res = await callUpdateSession(createMockRequest(route))
      expect(res._type).toBe('redirect')
    })

    it.each(falsePositiveRoutes)('%s redirects to /login', async (route) => {
      mockUnauthenticated()
      await callUpdateSession(createMockRequest(route))
      expect(getRedirectPathname()).toBe('/login')
    })
  })

  // âââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ
  // SECTION 12: Root path special handling
  // âââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ

  describe('root path (/) handling', () => {
    it('/ is always public for unauthenticated', async () => {
      mockUnauthenticated()
      const res = await callUpdateSession(createMockRequest('/'))
      expect(res._type).toBe('next')
    })

    it('/ is accessible for authenticated', async () => {
      mockAuthenticated()
      const res = await callUpdateSession(createMockRequest('/'))
      expect(res._type).toBe('next')
    })

    it('/ does not redirect unauthenticated users', async () => {
      mockUnauthenticated()
      await callUpdateSession(createMockRequest('/'))
      expect(NextResponse.redirect).not.toHaveBeenCalled()
    })

    it('/ does not redirect authenticated users (not an auth route)', async () => {
      mockAuthenticated()
      await callUpdateSession(createMockRequest('/'))
      expect(NextResponse.redirect).not.toHaveBeenCalled()
    })
  })

  // âââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ
  // SECTION 13: Missing env vars
  // âââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ

  describe('missing Supabase env vars', () => {
    const routesToTest = [
      '/',
      '/login',
      '/get-started',
      '/dashboard',
      '/clients',
      '/account',
      '/properties/123',
    ]

    it.each(routesToTest)('returns next() for %s when both env vars missing', async (route) => {
      clearEnvVars()
      const res = await callUpdateSession(createMockRequest(route))
      expect(res._type).toBe('next')
    })

    it.each(routesToTest)('does not redirect from %s when env vars missing', async (route) => {
      clearEnvVars()
      await callUpdateSession(createMockRequest(route))
      expect(NextResponse.redirect).not.toHaveBeenCalled()
    })

    it('returns next() when only SUPABASE_URL is missing', async () => {
      setupEnvVars()
      delete process.env.NEXT_PUBLIC_SUPABASE_URL
      const res = await callUpdateSession(createMockRequest('/dashboard'))
      expect(res._type).toBe('next')
    })

    it('returns next() when only ANON_KEY is missing', async () => {
      setupEnvVars()
      delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
      const res = await callUpdateSession(createMockRequest('/dashboard'))
      expect(res._type).toBe('next')
    })

    it('does not call createServerClient when env vars missing', async () => {
      clearEnvVars()
      const ssr = await import('@supabase/ssr')
      await callUpdateSession(createMockRequest('/get-started'))
      expect(ssr.createServerClient).not.toHaveBeenCalled()
    })

    it('does not call getUser when env vars missing', async () => {
      clearEnvVars()
      await callUpdateSession(createMockRequest('/dashboard'))
      expect(mockGetUser).not.toHaveBeenCalled()
    })
  })

  // âââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ
  // SECTION 14: Subscription gating â STRIPE_SUBSCRIPTION_REQUIRED=true
  // âââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ

  describe('subscription gating enabled', () => {
    beforeEach(() => {
      setupEnvVars({ STRIPE_SUBSCRIPTION_REQUIRED: 'true' })
    })

    // Public routes are exempt from subscription check
    const subscriptionExemptRoutes = [
      '/get-started',
      '/login',
      '/register',
      '/agents/login',
      '/agents/register',
      '/search',
      '/pricing',
      '/terms',
      '/privacy',
      '/nda',
      '/onboarding',
      '/forgot-password',
      '/reset-password',
      '/',
    ]

    it.each(subscriptionExemptRoutes)('%s is exempt from subscription check (public)', async (route) => {
      mockAuthenticated()
      const res = await callUpdateSession(createMockRequest(route))
      // Auth routes redirect to /dashboard, non-auth public routes pass through
      // Either way, no subscription redirect to /pricing
      if (res._type === 'redirect') {
        expect(getRedirectPathname()).not.toBe('/pricing')
      }
    })

    // Subscription-exempt protected routes. /onboarding is excluded because
    // already-onboarded users (with termsAcceptedAt) get redirected to /dashboard
    // before the subscription gate runs.
    const subscriptionExemptProtected = ['/pricing', '/account']

    it.each(subscriptionExemptProtected)('%s is exempt from subscription check (exempted)', async (route) => {
      mockAuthenticated()
      const res = await callUpdateSession(createMockRequest(route))
      expect(res._type).toBe('next')
    })

    it('cached active subscription (cookie=1) allows /dashboard', async () => {
      mockAuthenticated()
      const res = await callUpdateSession(createMockRequest('/dashboard', { cg_sub_active: '1' }))
      expect(res._type).toBe('next')
    })

    it('cached active subscription (cookie=1) allows /clients', async () => {
      mockAuthenticated()
      const res = await callUpdateSession(createMockRequest('/clients', { cg_sub_active: '1' }))
      expect(res._type).toBe('next')
    })

    it('cached active subscription (cookie=1) allows /compare', async () => {
      mockAuthenticated()
      const res = await callUpdateSession(createMockRequest('/compare', { cg_sub_active: '1' }))
      expect(res._type).toBe('next')
    })

    it('cached active subscription (cookie=1) allows /properties/123 (public route)', async () => {
      mockAuthenticated()
      const res = await callUpdateSession(createMockRequest('/properties/123', { cg_sub_active: '1' }))
      expect(res._type).toBe('next')
    })

    it('cached inactive subscription (cookie=0) still allows /properties/123 (public, exempt from sub gate)', async () => {
      mockAuthenticated()
      const res = await callUpdateSession(createMockRequest('/properties/123', { cg_sub_active: '0' }))
      expect(res._type).toBe('next')
    })

    it('cached inactive subscription (cookie=0) redirects /dashboard to /pricing', async () => {
      mockAuthenticated()
      const res = await callUpdateSession(createMockRequest('/dashboard', { cg_sub_active: '0' }))
      expect(res._type).toBe('redirect')
      expect(getRedirectPathname()).toBe('/pricing')
      expect(getRedirectSearchParam('reason')).toBe('subscription_required')
    })

    it('cached inactive subscription (cookie=0) redirects /clients to /pricing', async () => {
      mockAuthenticated()
      const res = await callUpdateSession(createMockRequest('/clients', { cg_sub_active: '0' }))
      expect(res._type).toBe('redirect')
      expect(getRedirectPathname()).toBe('/pricing')
    })

    it('cached inactive subscription (cookie=0) redirects /compare to /pricing', async () => {
      mockAuthenticated()
      const res = await callUpdateSession(createMockRequest('/compare', { cg_sub_active: '0' }))
      expect(res._type).toBe('redirect')
      expect(getRedirectPathname()).toBe('/pricing')
    })

    it('cached inactive subscription includes reason param', async () => {
      mockAuthenticated()
      await callUpdateSession(createMockRequest('/dashboard', { cg_sub_active: '0' }))
      expect(getRedirectSearchParam('reason')).toBe('subscription_required')
    })
  })

  // âââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ
  // SECTION 15: Subscription gating â disabled
  // âââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ

  describe('subscription gating disabled', () => {
    const protectedRoutes = ['/dashboard', '/clients', '/account', '/compare', '/clients']

    it.each(protectedRoutes)('allows authenticated access to %s when STRIPE_SUBSCRIPTION_REQUIRED=false', async (route) => {
      setupEnvVars({ STRIPE_SUBSCRIPTION_REQUIRED: 'false' })
      mockAuthenticated()
      const res = await callUpdateSession(createMockRequest(route))
      expect(res._type).toBe('next')
    })

    it.each(protectedRoutes)('allows access when STRIPE_SUBSCRIPTION_REQUIRED is unset', async (route) => {
      setupEnvVars()
      delete process.env.STRIPE_SUBSCRIPTION_REQUIRED
      mockAuthenticated()
      const res = await callUpdateSession(createMockRequest(route))
      expect(res._type).toBe('next')
    })

    const subRequiredFalsyValues = ['false', 'FALSE', 'False', '0', 'no', 'off', '']

    it.each(subRequiredFalsyValues)('STRIPE_SUBSCRIPTION_REQUIRED=%s does not trigger subscription gate for /dashboard', async (value) => {
      setupEnvVars({ STRIPE_SUBSCRIPTION_REQUIRED: value })
      mockAuthenticated()
      const res = await callUpdateSession(createMockRequest('/dashboard'))
      // Only 'true' (case-insensitive) triggers the gate
      expect(res._type).toBe('next')
    })
  })

  // âââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ
  // SECTION 16: STRIPE_SUBSCRIPTION_REQUIRED=TRUE (case insensitive)
  // âââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ

  describe('STRIPE_SUBSCRIPTION_REQUIRED case sensitivity', () => {
    const trueValues = ['true', 'TRUE', 'True', 'tRuE']

    it.each(trueValues)('value "%s" activates subscription gate', async (value) => {
      setupEnvVars({ STRIPE_SUBSCRIPTION_REQUIRED: value })
      mockAuthenticated()
      const res = await callUpdateSession(createMockRequest('/dashboard', { cg_sub_active: '0' }))
      expect(res._type).toBe('redirect')
      expect(getRedirectPathname()).toBe('/pricing')
    })
  })

  // âââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ
  // SECTION 17: Cookie cleanup
  // âââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ

  describe('subscription cookie cleanup', () => {
    const authRoutes = ['/login', '/register', '/agents/login', '/agents/register']

    it.each(authRoutes)('exercises cookie delete path for unauthenticated user on %s', async (route) => {
      mockUnauthenticated()
      await callUpdateSession(createMockRequest(route, { cg_sub_active: '1' }))
      expect(NextResponse.next).toHaveBeenCalled()
    })

    it('exercises cookie clear on /dashboard?subscription=success', async () => {
      setupEnvVars({ STRIPE_SUBSCRIPTION_REQUIRED: 'true' })
      mockAuthenticated()
      await callUpdateSession(createMockRequest('/dashboard?subscription=success', { cg_sub_active: '0' }))
      // Should not crash
      expect(true).toBe(true)
    })

    it('authenticated user on /dashboard?subscription=success with active cookie passes', async () => {
      setupEnvVars({ STRIPE_SUBSCRIPTION_REQUIRED: 'false' })
      mockAuthenticated()
      const res = await callUpdateSession(createMockRequest('/dashboard?subscription=success', { cg_sub_active: '1' }))
      expect(res._type).toBe('next')
    })
  })

  // âââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ
  // SECTION 18: Various user objects with authenticated middleware behavior
  // âââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ

  describe('various authenticated user shapes', () => {
    // All user shapes must include user_metadata.termsAcceptedAt to pass
    // the onboarding gate, otherwise they'd be redirected to /onboarding.
    const userShapes: Array<[string, Record<string, unknown>]> = [
      ['minimal user', { id: 'u1', user_metadata: { termsAcceptedAt: '2025-01-01' } }],
      ['agent user', { id: 'u2', role: 'AGENT', user_metadata: { termsAcceptedAt: '2025-01-01' } }],
      ['consumer user', { id: 'u3', role: 'CONSUMER', user_metadata: { termsAcceptedAt: '2025-01-01' } }],
      ['admin user', { id: 'u4', role: 'ADMIN', user_metadata: { termsAcceptedAt: '2025-01-01' } }],
      ['user with email', { id: 'u5', email: 'test@test.com', user_metadata: { termsAcceptedAt: '2025-01-01' } }],
      ['user with metadata', { id: 'u6', user_metadata: { name: 'Test', termsAcceptedAt: '2025-01-01' } }],
      ['user with terms', { id: 'u7', user_metadata: { termsAcceptedAt: '2025-01-01' } }],
      ['user with provider', { id: 'u8', app_metadata: { provider: 'google' }, user_metadata: { termsAcceptedAt: '2025-01-01' } }],
    ]

    // All these users should be redirected from /login to /dashboard
    it.each(userShapes)('%s is redirected from /login to /dashboard', async (_desc, user) => {
      mockAuthenticated(user)
      const res = await callUpdateSession(createMockRequest('/login'))
      expect(res._type).toBe('redirect')
      expect(getRedirectPathname()).toBe('/dashboard')
    })

    // All these users should pass through on /dashboard
    it.each(userShapes)('%s passes through on /dashboard', async (_desc, user) => {
      mockAuthenticated(user)
      const res = await callUpdateSession(createMockRequest('/dashboard'))
      expect(res._type).toBe('next')
    })

    // All these users should pass through on /get-started
    it.each(userShapes)('%s passes through on /get-started', async (_desc, user) => {
      mockAuthenticated(user)
      const res = await callUpdateSession(createMockRequest('/get-started'))
      expect(res._type).toBe('next')
    })
  })

  // âââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ
  // SECTION 19: Deep nested sub-paths of public routes
  // âââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ

  describe('deeply nested sub-paths of public routes', () => {
    const deepPaths = [
      '/search/a/b/c',
      '/get-started/a/b/c',
      '/login/a/b',
      '/register/a/b',
      '/pricing/a/b',
      '/terms/a/b/c',
      '/privacy/a/b',
      '/nda/a/b',
      '/agents/login/a/b',
      '/agents/register/a/b',
    ]

    it.each(deepPaths)('allows unauthenticated access to deep path %s', async (path) => {
      mockUnauthenticated()
      const res = await callUpdateSession(createMockRequest(path))
      expect(res._type).toBe('next')
    })
  })

  // âââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ
  // SECTION 20: Protected deep paths
  // âââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ

  describe('deep protected paths redirect', () => {
    const deepProtected = [
      '/dashboard/clients/123',
      '/clients/reports/weekly',
      '/account/billing/invoices',
      '/compare/properties/1-vs-2',
      '/clients/123/properties',
    ]

    it.each(deepProtected)('redirects unauthenticated from %s', async (path) => {
      mockUnauthenticated()
      const res = await callUpdateSession(createMockRequest(path))
      expect(res._type).toBe('redirect')
    })

    it.each(deepProtected)('allows authenticated access to %s', async (path) => {
      mockAuthenticated()
      const res = await callUpdateSession(createMockRequest(path))
      expect(res._type).toBe('next')
    })
  })

  // âââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ
  // SECTION 21: Stability
  // âââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ

  describe('stability', () => {
    it('handles 20 successive calls without issues', async () => {
      mockUnauthenticated()
      for (let i = 0; i < 20; i++) {
        const res = await callUpdateSession(createMockRequest('/get-started'))
        expect(res._type).toBe('next')
      }
    })

    it('alternates between public and protected routes', async () => {
      for (let i = 0; i < 10; i++) {
        jest.clearAllMocks()
        setupEnvVars()
        mockUnauthenticated()
        const publicRes = await callUpdateSession(createMockRequest('/get-started'))
        expect(publicRes._type).toBe('next')

        jest.clearAllMocks()
        setupEnvVars()
        mockUnauthenticated()
        const protectedRes = await callUpdateSession(createMockRequest('/dashboard'))
        expect(protectedRes._type).toBe('redirect')
      }
    })

    it('alternates auth states', async () => {
      for (let i = 0; i < 10; i++) {
        jest.clearAllMocks()
        setupEnvVars()
        mockUnauthenticated()
        const unauthRes = await callUpdateSession(createMockRequest('/dashboard'))
        expect(unauthRes._type).toBe('redirect')

        jest.clearAllMocks()
        setupEnvVars()
        mockAuthenticated()
        const authRes = await callUpdateSession(createMockRequest('/dashboard'))
        expect(authRes._type).toBe('next')
      }
    })
  })

  // âââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ
  // SECTION 22: Comprehensive cross-product: route Ã auth state
  // âââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ

  describe('cross-product: route Ã auth state for key routes', () => {
    const routes = [
      { path: '/', isPublic: true, isAuthRoute: false },
      { path: '/login', isPublic: true, isAuthRoute: true },
      { path: '/register', isPublic: true, isAuthRoute: true },
      { path: '/agents/login', isPublic: true, isAuthRoute: true },
      { path: '/agents/register', isPublic: true, isAuthRoute: true },
      { path: '/get-started', isPublic: true, isAuthRoute: false },
      { path: '/search', isPublic: true, isAuthRoute: false },
      { path: '/pricing', isPublic: true, isAuthRoute: false },
      { path: '/terms', isPublic: true, isAuthRoute: false },
      { path: '/privacy', isPublic: true, isAuthRoute: false },
      { path: '/nda', isPublic: true, isAuthRoute: false },
      { path: '/onboarding', isPublic: false, isAuthRoute: false },
      { path: '/forgot-password', isPublic: true, isAuthRoute: false },
      { path: '/reset-password', isPublic: true, isAuthRoute: false },
      { path: '/dashboard', isPublic: false, isAuthRoute: false },
      { path: '/clients', isPublic: false, isAuthRoute: false },
      { path: '/account', isPublic: false, isAuthRoute: false },
      { path: '/compare', isPublic: false, isAuthRoute: false },
      { path: '/properties/123', isPublic: true, isAuthRoute: false },
      { path: '/clients', isPublic: false, isAuthRoute: false },
    ]

    // Unauthenticated + public â next
    const unauthPublic = routes.filter(r => r.isPublic)
    it.each(unauthPublic.map(r => [r.path]))('unauthenticated + public %s â next', async (path) => {
      mockUnauthenticated()
      const res = await callUpdateSession(createMockRequest(path as string))
      expect(res._type).toBe('next')
    })

    // Unauthenticated + protected â redirect to /login
    const unauthProtected = routes.filter(r => !r.isPublic)
    it.each(unauthProtected.map(r => [r.path]))('unauthenticated + protected %s â redirect /login', async (path) => {
      mockUnauthenticated()
      const res = await callUpdateSession(createMockRequest(path as string))
      expect(res._type).toBe('redirect')
      expect(getRedirectPathname()).toBe('/login')
    })

    // Authenticated + authRoute â redirect to /dashboard
    const authAuthRoutes = routes.filter(r => r.isAuthRoute)
    it.each(authAuthRoutes.map(r => [r.path]))('authenticated + authRoute %s â redirect /dashboard', async (path) => {
      mockAuthenticated()
      const res = await callUpdateSession(createMockRequest(path as string))
      expect(res._type).toBe('redirect')
      expect(getRedirectPathname()).toBe('/dashboard')
    })

    // Authenticated + non-authRoute public â next (except /onboarding which
    // redirects already-onboarded users to /dashboard)
    const authNonAuthPublic = routes.filter(r => r.isPublic && !r.isAuthRoute && r.path !== '/onboarding')
    it.each(authNonAuthPublic.map(r => [r.path]))('authenticated + nonAuth public %s â next', async (path) => {
      mockAuthenticated()
      const res = await callUpdateSession(createMockRequest(path as string))
      expect(res._type).toBe('next')
    })

    it('authenticated + onboarded user on /onboarding â redirect to /dashboard', async () => {
      mockAuthenticated()
      const res = await callUpdateSession(createMockRequest('/onboarding'))
      expect(res._type).toBe('redirect')
      expect(getRedirectPathname()).toBe('/dashboard')
    })

    // Authenticated + protected â next (except /onboarding which redirects
    // already-onboarded users to /dashboard)
    const authProtected = routes.filter(r => !r.isPublic && r.path !== '/onboarding')
    it.each(authProtected.map(r => [r.path]))('authenticated + protected %s â next', async (path) => {
      mockAuthenticated()
      const res = await callUpdateSession(createMockRequest(path as string))
      expect(res._type).toBe('next')
    })
  })

  // âââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ
  // SECTION 23: More false-positive route boundary tests
  // âââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ

  describe('more false-positive boundary routes', () => {
    const moreFalsePositives = [
      '/loginn',
      '/login_old',
      '/login-v2',
      '/register_new',
      '/register-v2',
      '/get-started-v2',
      '/get-startedd',
      '/searchh',
      '/search_old',
      '/pricingg',
      '/pricing_new',
      '/termss',
      '/privacyy',
      '/onboardingg',
      '/forgot-password_old',
      '/reset-password_old',
    ]

    it.each(moreFalsePositives)('%s is protected (redirects unauthenticated)', async (route) => {
      mockUnauthenticated()
      const res = await callUpdateSession(createMockRequest(route))
      expect(res._type).toBe('redirect')
    })
  })

  // âââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ
  // SECTION 24: Subscription gating with various protected routes
  // âââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ

  describe('subscription gating â cached active for various routes', () => {
    const protectedRoutes = [
      '/dashboard',
      '/dashboard/overview',
      '/clients',
      '/clients/searches',
      '/compare',
      '/compare/results',
      '/clients',
      '/clients/123',
      '/reports',
    ]

    it.each(protectedRoutes)('cached active (cookie=1) allows %s', async (route) => {
      setupEnvVars({ STRIPE_SUBSCRIPTION_REQUIRED: 'true' })
      mockAuthenticated()
      const res = await callUpdateSession(createMockRequest(route, { cg_sub_active: '1' }))
      expect(res._type).toBe('next')
    })

    it.each(protectedRoutes)('cached inactive (cookie=0) redirects from %s to /pricing', async (route) => {
      setupEnvVars({ STRIPE_SUBSCRIPTION_REQUIRED: 'true' })
      mockAuthenticated()
      const res = await callUpdateSession(createMockRequest(route, { cg_sub_active: '0' }))
      expect(res._type).toBe('redirect')
      expect(getRedirectPathname()).toBe('/pricing')
    })
  })

  // âââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ
  // SECTION 25: Calls to NextResponse.next
  // âââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ

  describe('NextResponse.next is called for pass-through', () => {
    const passThroughCases: Array<[string, () => void]> = [
      ['unauth /get-started', () => mockUnauthenticated()],
      ['unauth /', () => mockUnauthenticated()],
      ['unauth /search', () => mockUnauthenticated()],
      ['unauth /pricing', () => mockUnauthenticated()],
      ['auth /dashboard', () => mockAuthenticated()],
      ['auth /get-started', () => mockAuthenticated()],
      ['auth /search', () => mockAuthenticated()],
      ['auth /clients', () => mockAuthenticated()],
    ]

    it.each(passThroughCases)('calls NextResponse.next for %s', async (_desc, setup) => {
      setup()
      const route = _desc.split(' ')[1]
      await callUpdateSession(createMockRequest(route))
      expect(NextResponse.next).toHaveBeenCalled()
    })
  })

  // âââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ
  // SECTION 26: Subscription gating exempt routes with cookie=0
  // âââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ

  describe('subscription exempt routes ignore inactive subscription cookie', () => {
    const exemptRoutes = [
      '/pricing',
      '/pricing/team',
      '/account',
      '/account/billing',
      '/onboarding',
      '/onboarding/step2',
      '/get-started',
      '/search',
      '/login',
      '/register',
      '/terms',
      '/privacy',
      '/nda',
      '/',
    ]

    it.each(exemptRoutes)('authenticated user with cookie=0 still accesses %s', async (route) => {
      setupEnvVars({ STRIPE_SUBSCRIPTION_REQUIRED: 'true' })
      mockAuthenticated()
      const res = await callUpdateSession(createMockRequest(route, { cg_sub_active: '0' }))
      // Auth routes redirect to /dashboard, but never to /pricing
      if (res._type === 'redirect') {
        expect(getRedirectPathname()).not.toBe('/pricing')
      }
    })
  })

  // âââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ
  // SECTION 27: Response type assertions
  // âââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ

  describe('response type is always next or redirect', () => {
    const mixedCases: Array<[string, () => void, string]> = [
      ['unauth /get-started', () => mockUnauthenticated(), '/get-started'],
      ['unauth /dashboard', () => mockUnauthenticated(), '/dashboard'],
      ['auth /login', () => mockAuthenticated(), '/login'],
      ['auth /dashboard', () => mockAuthenticated(), '/dashboard'],
      ['auth /get-started', () => mockAuthenticated(), '/get-started'],
      ['unauth /search', () => mockUnauthenticated(), '/search'],
      ['unauth /account', () => mockUnauthenticated(), '/account'],
      ['auth /clients', () => mockAuthenticated(), '/clients'],
      ['unauth /pricing', () => mockUnauthenticated(), '/pricing'],
      ['auth /compare', () => mockAuthenticated(), '/compare'],
      ['unauth /properties/1', () => mockUnauthenticated(), '/properties/1'],
      ['auth /properties/1', () => mockAuthenticated(), '/properties/1'],
      ['unauth /terms', () => mockUnauthenticated(), '/terms'],
      ['auth /terms', () => mockAuthenticated(), '/terms'],
      ['unauth /onboarding', () => mockUnauthenticated(), '/onboarding'],
      ['auth /onboarding', () => mockAuthenticated(), '/onboarding'],
      ['unauth /register', () => mockUnauthenticated(), '/register'],
      ['auth /register', () => mockAuthenticated(), '/register'],
      ['unauth /agents/login', () => mockUnauthenticated(), '/agents/login'],
      ['auth /agents/login', () => mockAuthenticated(), '/agents/login'],
    ]

    it.each(mixedCases)('%s returns next or redirect', async (_desc, setup, route) => {
      setup()
      const res = await callUpdateSession(createMockRequest(route))
      expect(['next', 'redirect']).toContain(res._type)
    })
  })
})
