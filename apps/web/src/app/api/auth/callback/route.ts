import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/dashboard'

  if (code) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.exchangeCodeForSession(code)

    if (user) {
      // For OAuth sign-ins, check if this is a first-time user.
      // If termsAcceptedAt is not in user metadata, redirect to onboarding.
      const termsAccepted = user.user_metadata?.termsAcceptedAt
      if (!termsAccepted && next !== '/onboarding') {
        return NextResponse.redirect(`${origin}/onboarding`)
      }
    }
  }

  return NextResponse.redirect(`${origin}${next}`)
}
