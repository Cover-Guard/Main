import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  // Note: do NOT pass `cookieOptions.maxAge` here. Capping the Supabase
  // cookie lifetime (previously at 24h) effectively kills the refresh
  // token after that window, forcing users to re-authenticate every day
  // — which is what made production releases feel like they "logged
  // everyone out." Let @supabase/ssr manage cookie lifetime using its
  // own refresh logic; configure session duration in the Supabase
  // project settings (Auth → Sessions) if you need to enforce one.
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  )
}
