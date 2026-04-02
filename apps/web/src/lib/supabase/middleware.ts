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
  const publicPrefixes = ['/login', '/register', '/agents/login', '/agents/register', '/forgot-password', '/reset-password', '/terms', '/privacy', '/nda', '/pricing', '/search', '/get-started', '/careers', '/docs', '/api-reference', '/blog', '/contact', '/security']
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
