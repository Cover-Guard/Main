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
    if (process.env[name]) continue
    // Prefix convention (Vercel marketplace standard): LABEL_VARNAME
    const prefixed = `${label}_${name}`
    if (process.env[prefixed]) { process.env[name] = process.env[prefixed]; continue }
    // Suffix convention (fallback): VARNAME_LABEL
    const suffixed = `${name}_${label}`
    if (process.env[suffixed]) { process.env[name] = process.env[suffixed] }
  }
}
