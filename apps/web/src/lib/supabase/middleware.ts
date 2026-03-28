import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function updateSession(request: NextRequest) {
  // If Supabase env vars are not configured (e.g. missing in Vercel production
  // environment), skip auth processing rather than crashing every request.
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return NextResponse.next({ request })
  }

  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookieOptions: {
        maxAge: 60 * 60 * 24, // 24 hours
      },
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet: { name: string; value: string; options?: Record<string, unknown> }[]) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // Refresh session — do not add any code between createServerClient and getUser
  const { data: { user } } = await supabase.auth.getUser()

  const pathname = request.nextUrl.pathname

  // Routes that are always publicly accessible (no login required).
  // Note: /api/* routes are excluded from the middleware matcher entirely,
  // so /api/auth/callback does not need to be listed here.
  // /onboarding is NOT public — it requires authentication. The onboarding gate
  // (below) redirects authenticated users without termsAcceptedAt to /onboarding.
  const publicPrefixes = ['/login', '/register', '/agents/login', '/agents/register', '/forgot-password', '/reset-password', '/terms', '/privacy', '/pricing', '/search', '/get-started']
  const isPublic = pathname === '/' || publicPrefixes.some((r) => pathname === r || pathname.startsWith(r + '/'))

  const SUB_COOKIE = 'cg_sub_active'
  const SUB_COOKIE_TTL = 5 * 60 // 5 minutes

  // If authenticated user visits login/register, redirect to dashboard
  const authRoutes = ['/login', '/register', '/agents/login', '/agents/register']
  if (user && authRoutes.some((r) => pathname === r || pathname.startsWith(r + '/'))) {
    const url = request.nextUrl.clone()
    url.pathname = '/dashboard'
    return NextResponse.redirect(url)
  }

  // Clear subscription cache cookie when visiting auth routes (login/register)
  // so a new user session doesn't inherit a stale value from a prior user.
  if (!user && authRoutes.some((r) => pathname === r || pathname.startsWith(r + '/'))) {
    supabaseResponse.cookies.delete(SUB_COOKIE)
  }

  // Clear subscription cache cookie when arriving at dashboard after a fresh
  // checkout so the middleware re-checks subscription status immediately.
  if (user && pathname === '/dashboard' && request.nextUrl.searchParams.get('subscription') === 'success') {
    supabaseResponse.cookies.delete(SUB_COOKIE)
  }

  // Require login for all non-public routes
  if (!isPublic && !user) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    if (pathname !== '/') {
      const search = request.nextUrl.search
      url.searchParams.set('redirectTo', pathname + search)
    }
    return NextResponse.redirect(url)
  }

  // ─── Onboarding gate ──────────────────────────────────────────────────────
  // Both email-registered and OAuth users must complete onboarding (NDA + terms
  // + privacy) before accessing protected routes. Check user_metadata for the
  // termsAcceptedAt flag set by POST /me/terms during onboarding.
  const termsAccepted = user?.user_metadata?.termsAcceptedAt

  // Redirect users who haven't accepted terms to onboarding
  if (user && !isPublic && pathname !== '/onboarding' && !termsAccepted) {
    const url = request.nextUrl.clone()
    url.pathname = '/onboarding'
    return NextResponse.redirect(url)
  }

  // Redirect already-onboarded users away from /onboarding to prevent confusion
  if (user && pathname === '/onboarding' && termsAccepted) {
    const url = request.nextUrl.clone()
    url.pathname = '/dashboard'
    return NextResponse.redirect(url)
  }

  // ─── Subscription gate (feature flag) ──────────────────────────────────────
  // When STRIPE_SUBSCRIPTION_REQUIRED=true, authenticated users without an
  // active subscription are redirected to /pricing for all protected routes.
  // A short-lived cookie (cg_sub_active, 5 min TTL) caches the result so the
  // API isn't called on every single navigation.
  const subscriptionExemptRoutes = ['/pricing', '/account', '/onboarding']
  const isSubscriptionExempt = isPublic || subscriptionExemptRoutes.some((r) => pathname === r || pathname.startsWith(r + '/'))

  if (
    process.env.STRIPE_SUBSCRIPTION_REQUIRED?.toLowerCase() === 'true' &&
    user &&
    !isSubscriptionExempt
  ) {
    // Fast path: check cookie cache first
    const cached = request.cookies.get(SUB_COOKIE)?.value
    if (cached === '1') {
      // Subscription is active (cached) — allow through
      return supabaseResponse
    }

    if (cached === '0') {
      // Subscription is inactive (cached) — redirect to pricing
      const url = request.nextUrl.clone()
      url.pathname = '/pricing'
      url.searchParams.set('reason', 'subscription_required')
      return NextResponse.redirect(url)
    }

    // Slow path: no cache — check subscription status via API
    try {
      const session = await supabase.auth.getSession()
      const token = session.data.session?.access_token
      if (token) {
        const apiUrl = process.env.API_REWRITE_URL || 'http://localhost:4000'
        const subRes = await fetch(`${apiUrl}/api/stripe/subscription`, {
          headers: { Authorization: `Bearer ${token}` },
        })
        if (subRes.ok) {
          const subData = await subRes.json()
          const isActive = !subData.data.required || subData.data.active
          // Cache the result in a cookie so subsequent navigations skip the API call
          supabaseResponse.cookies.set(SUB_COOKIE, isActive ? '1' : '0', {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            maxAge: SUB_COOKIE_TTL,
            path: '/',
          })
          if (!isActive) {
            const pricingUrl = request.nextUrl.clone()
            pricingUrl.pathname = '/pricing'
            pricingUrl.searchParams.set('reason', 'subscription_required')
            const redirectRes = NextResponse.redirect(pricingUrl)
            redirectRes.cookies.set(SUB_COOKIE, '0', {
              httpOnly: true,
              secure: process.env.NODE_ENV === 'production',
              sameSite: 'lax',
              maxAge: SUB_COOKIE_TTL,
              path: '/',
            })
            return redirectRes
          }
        }
      }
    } catch {
      // If subscription check fails, allow access rather than blocking
    }
  }

  return supabaseResponse
}
