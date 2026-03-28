// Next.js instrumentation — runs once when the server starts.
// Normalizes Supabase Vercel Integration env vars so server-side code
// (middleware, server components, API routes) can use the standard names.
export function register() {
  const label = process.env.SUPABASE_ENV_LABEL || 'COVERGUARD_2'
  const vars = [
    'SUPABASE_URL',
    'SUPABASE_ANON_KEY',
    'SUPABASE_SERVICE_ROLE_KEY',
    'NEXT_PUBLIC_SUPABASE_URL',
    'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  ]
  for (const name of vars) {
    const suffixed = `${name}_${label}`
    if (!process.env[name] && process.env[suffixed]) {
      process.env[name] = process.env[suffixed]
    }
  }
}
