import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/'
  // Role hint forwarded from the agent register page via the redirectTo URL.
  // Only 'AGENT' and 'LENDER' are accepted; everything else defaults to BUYER.
  const roleParam = searchParams.get('role')
  const agentRole = roleParam === 'AGENT' || roleParam === 'LENDER' ? roleParam : null

  if (code) {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.exchangeCodeForSession(code)

    if (user) {
      // If a role was forwarded from the agent registration page, write it
      // into the user's auth metadata.  The handle_user_updated trigger will
      // then propagate it to public.users automatically.
      if (agentRole) {
        // Preserve any existing metadata fields and override role.
        // The handle_user_updated trigger will sync this to public.users.
        await supabase.auth.updateUser({
          data: { ...user.user_metadata, role: agentRole },
        })
      }

      // Guard: if the handle_new_user trigger failed (extremely rare), ensure
      // the public.users profile exists so downstream API calls don't 404.
      const { data: profile } = await supabase
        .from('users')
        .select('id')
        .eq('id', user.id)
        .maybeSingle()

      if (!profile) {
        // Profile missing — create it via the authenticated API so the service-
        // role key is used (bypasses RLS) and all required columns are set.
        const { data: sessionData } = await supabase.auth.getSession()
        if (sessionData.session?.access_token) {
          await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/auth/sync-profile`, {
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
        return NextResponse.redirect(`${origin}/onboarding`)
      }
    }
  }

  return NextResponse.redirect(`${origin}${next}`)
}
