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

  // Routes that are always publicly accessible (no login required)
  const publicRoutes = ['/login', '/register', '/agents/login', '/agents/register', '/onboarding']
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
      url.searchParams.set('redirectTo', pathname)
    }
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}
