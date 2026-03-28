import { createClient, type SupabaseClient } from '@supabase/supabase-js'

let _instance: SupabaseClient | undefined

/**
 * Admin Supabase client that bypasses Row Level Security.
 * Use ONLY in trusted server-side code (API routes, background jobs).
 * Never expose this client or its key to the browser.
 *
 * Lazy-initialized to avoid crashing the serverless function at module
 * load time when environment variables are not yet available.
 */
function getSupabaseAdmin(): SupabaseClient {
  if (_instance) return _instance

  const supabaseUrl = process.env.SUPABASE_URL
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables')
  }

  _instance = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
  return _instance
}

// Export a proxy that lazily initializes the client on first access
export const supabaseAdmin: SupabaseClient = new Proxy({} as SupabaseClient, {
  get(_target, prop) {
    const instance = getSupabaseAdmin()
    const value = (instance as unknown as Record<string | symbol, unknown>)[prop]
    if (typeof value === 'function') {
      return value.bind(instance)
    }
    return value
  },
})
