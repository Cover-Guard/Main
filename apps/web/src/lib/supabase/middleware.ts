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
  const publicRoutes = ['/', '/login', '/register', '/agents/login', '/agents/register', '/forgot-password', '/reset-password', '/terms', '/privacy', '/pricing', '/search', '/onboarding']
  const isPublic = publicRoutes.some((r) => pathname === r || pathname.startsWith(r + '/'))

  // If authenticated user visits login/register, redirect to dashboard
  const authRoutes = ['/login', '/register', '/agents/login', '/agents/register']
  if (user && authRoutes.some((r) => pathname === r || pathname.startsWith(r + '/'))) {
    const url = request.nextUrl.clone()
    url.pathname = '/dashboard'
    return NextResponse.redirect(url)
  }

  // Require login for all non-public routes
  if (!isPublic && !user) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    if (pathname !== '/') {
      // Preserve the full path + query so the user lands back on the same
      // page (e.g. /search?q=123+Main) after signing in.
      const search = request.nextUrl.search
      url.searchParams.set('redirectTo', pathname + search)
    }
    return NextResponse.redirect(url)
  }

  // ─── Subscription gate (feature flag) ──────────────────────────────────────
  // When STRIPE_SUBSCRIPTION_REQUIRED=true, authenticated users without an
  // active subscription are redirected to /pricing for all protected routes.
  // Routes that should remain accessible without a subscription:
  const subscriptionExemptRoutes = ['/pricing', '/account', '/onboarding']
  const isSubscriptionExempt = isPublic || subscriptionExemptRoutes.some((r) => pathname === r || pathname.startsWith(r + '/'))

  if (
    process.env.STRIPE_SUBSCRIPTION_REQUIRED === 'true' &&
    user &&
    !isSubscriptionExempt
  ) {
    // Check subscription status via API
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
          if (subData.success && subData.data.required && !subData.data.active) {
            const url = request.nextUrl.clone()
            url.pathname = '/pricing'
            url.searchParams.set('reason', 'subscription_required')
            return NextResponse.redirect(url)
          }
        }
      }
    } catch {
      // If subscription check fails, allow access rather than blocking
    }
  }

  return supabaseResponse
}
