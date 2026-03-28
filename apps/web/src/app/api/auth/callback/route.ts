import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const rawNext = searchParams.get('next') ?? '/dashboard'
  // Validate redirect is a safe relative path to prevent open redirect attacks
  const next = rawNext.startsWith('/') && !rawNext.startsWith('//') ? rawNext : '/dashboard'
  // Role hint forwarded from the agent register page via the redirectTo URL.
  // Only 'AGENT' and 'LENDER' are accepted; everything else defaults to BUYER.
  const roleParam = searchParams.get('role')
  const agentRole = roleParam === 'AGENT' || roleParam === 'LENDER' ? roleParam : null

  // Collect cookies that the Supabase client wants to set so we can forward
  // them onto the final redirect response (NextResponse.redirect drops cookies
  // set via the next/headers cookies() helper).
  const cookieStore = await cookies()
  const cookiesToForward: { name: string; value: string; options?: Record<string, unknown> }[] = []

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookieOptions: {
        maxAge: 60 * 60 * 24, // 24 hours
      },
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet: { name: string; value: string; options?: Record<string, unknown> }[]) {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options as Record<string, string>)
            cookiesToForward.push({ name, value, options })
          })
        },
      },
    }
  )

  let redirectPath = next

  if (code) {
    const {
      data: { user },
      error: exchangeError,
    } = await supabase.auth.exchangeCodeForSession(code)

    if (exchangeError) {
      console.error('OAuth code exchange failed:', exchangeError.message)
      const errorUrl = new URL('/login', origin)
      errorUrl.searchParams.set('error', 'OAuth sign-in failed. Please try again.')
      return NextResponse.redirect(errorUrl.toString())
    }

    if (user) {
      // Run role update + profile check in parallel — they operate on
      // independent tables (auth.users metadata vs public.users).
      const profileCheck = supabase
        .from('users')
        .select('id')
        .eq('id', user.id)
        .maybeSingle()

      const roleUpdate = agentRole
        ? supabase.auth.updateUser({
            data: { ...user.user_metadata, role: agentRole },
          })
        : Promise.resolve(null)

      const [{ data: profile }] = await Promise.all([profileCheck, roleUpdate])

      if (!profile) {
        // Profile missing — create it via the authenticated API so the service-
        // role key is used (bypasses RLS) and all required columns are set.
        const { data: sessionData } = await supabase.auth.getSession()
        if (sessionData.session?.access_token) {
          await fetch(`${process.env.API_REWRITE_URL ?? process.env.NEXT_PUBLIC_API_URL ?? ''}/api/auth/sync-profile`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${sessionData.session.access_token}`,
            },
          })
        }
      }

      // First-time user: redirect to onboarding if terms not yet accepted.
      const termsAccepted = user.user_metadata?.termsAcceptedAt
      if (!termsAccepted && next !== '/onboarding') {
        redirectPath = '/onboarding'
      }
    }
  }

  // Build the redirect response and attach all session cookies so the
  // browser stores them before following the redirect.
  const redirectResponse = NextResponse.redirect(`${origin}${redirectPath}`)
  for (const { name, value, options } of cookiesToForward) {
    redirectResponse.cookies.set(name, value, options as Record<string, string>)
  }
  return redirectResponse
}
