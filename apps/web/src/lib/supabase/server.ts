import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

/**
 * Returns true if the Supabase env vars are configured.
 * Useful for pages that should degrade gracefully (e.g. the landing page)
 * rather than crash when env vars are absent.
 */
export function isSupabaseConfigured(): boolean {
  return !!(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
}

export async function createClient() {
  // cookies() MUST be called first — it signals to Next.js that this route is
  // dynamic (request-time only) and must not be statically pre-rendered at
  // build time. Moving this after any early throw would hide it from the
  // static-analysis pass, causing build failures when env vars are absent.
  const cookieStore = await cookies()

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseKey) {
    throw new Error(
      'Missing Supabase env vars: set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in your Vercel Production environment.'
    )
  }

  // NOTE: intentionally no `cookieOptions.maxAge` — see lib/supabase/client.ts
  // for the full rationale. Capping cookie lifetime broke refresh tokens and
  // made production deploys appear to log users out.
  return createServerClient(
    supabaseUrl,
    supabaseKey,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet: { name: string; value: string; options: Record<string, unknown> }[]) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // Called from a Server Component — cookies can't be set here.
            // Middleware handles session refresh.
          }
        },
      },
    }
  )
}
