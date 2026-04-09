/**
 * env.ts — Runtime environment variable normalisation
 *
 * The Supabase Vercel Integration names env vars with a project-specific prefix
 * (e.g. COVERGUARD_2_SUPABASE_URL instead of SUPABASE_URL).
 * This module mirrors the logic in scripts/normalize-env.sh so serverless
 * functions always see the canonical variable names, regardless of how the
 * integration named them.
 *
 * IMPORTANT: This file must be imported BEFORE any module that reads env vars
 * (including prisma, supabase client, etc). In apps/api/src/index.ts, import
 * this as the very first side-effectful import:
 *
 * import './config/env'
 * import 'dotenv/config'
 * // ... rest of imports
 */

const LABEL = process.env.SUPABASE_ENV_LABEL ?? 'COVERGUARD_2'

const MANAGED_VARS = [
  'DATABASE_URL',
  'POSTGRES_URL',
  'POSTGRES_PRISMA_URL',
  'POSTGRES_URL_NON_POOLED',
  'DIRECT_URL',
  'SUPABASE_URL',
  'SUPABASE_ANON_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
] as const

for (const name of MANAGED_VARS) {
  if (process.env[name]) continue

  // Convention 1 — prefix: LABEL_VARNAME (Vercel Supabase integration default)
  const prefixed = `${LABEL}_${name}`
  if (process.env[prefixed]) {
    process.env[name] = process.env[prefixed]
    continue
  }

  // Convention 2 — suffix: VARNAME_LABEL
  const suffixed = `${name}_${LABEL}`
  if (process.env[suffixed]) {
    process.env[name] = process.env[suffixed]
  }
}

// ─── Soft warnings for optional-but-important API keys ─────────────────────
// These keys have fallback behaviour (mock data / degraded scoring) but a
// missing key in production is almost always a misconfiguration. Log once at
// startup so it shows up in deployment logs.
//
// NOTE: Using console.debug instead of console.warn to reduce log noise on
// Vercel serverless where every cold start re-triggers these warnings.
const OPTIONAL_KEYS_WITH_FALLBACK: Array<{ key: string; feature: string }> = [
  { key: 'REPILERS_API_KEY', feature: 'property data via Repilers (mock fallback when not set)' },
  { key: 'FBI_UCR_API_KEY', feature: 'crime risk scoring (will use heuristic fallback)' },
]

for (const { key, feature } of OPTIONAL_KEYS_WITH_FALLBACK) {
  if (!process.env[key]) {
    console.debug(`[CoverGuard] ${key} is not set — ${feature}`)
  }
}

export {}
/**
 * env.ts — Runtime environment variable normalisation
 *
 * The Supabase Vercel Integration names env vars with a project-specific prefix
 * (e.g. COVERGUARD_2_SUPABASE_URL instead of SUPABASE_URL).
 * This module mirrors the logic in scripts/normalize-env.sh so serverless
 * functions always see the canonical variable names, regardless of how the
 * integration named them.
 *
 * IMPORTANT: This file must be imported BEFORE any module that reads env vars
 * (including prisma, supabase client, etc). In apps/api/src/index.ts, import
 * this as the very first side-effectful import:
 *
 * import './config/env'
 * import 'dotenv/config'
 * // ... rest of imports
 */

const LABEL = process.env.SUPABASE_ENV_LABEL ?? 'COVERGUARD_2'

const MANAGED_VARS = [
  'DATABASE_URL',
  'POSTGRES_URL',
  'POSTGRES_PRISMA_URL',
  'POSTGRES_URL_NON_POOLED',
  'DIRECT_URL',
  'SUPABASE_URL',
  'SUPABASE_ANON_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
] as const

for (const name of MANAGED_VARS) {
  if (process.env[name]) continue

  // Convention 1 — prefix: LABEL_VARNAME (Vercel Supabase integration default)
  const prefixed = `${LABEL}_${name}`
  if (process.env[prefixed]) {
    process.env[name] = process.env[prefixed]
    continue
  }

  // Convention 2 — suffix: VARNAME_LABEL
  const suffixed = `${name}_${LABEL}`
  if (process.env[suffixed]) {
    process.env[name] = process.env[suffixed]
  }
}

// ─── Soft warnings for optional-but-important API keys ─────────────────────
// These keys have fallback behaviour (mock data / degraded scoring) but a
// missing key in production is almost always a misconfiguration. Log once at
// startup so it shows up in deployment logs.
//
// NOTE: Using console.debug instead of console.warn to reduce log noise on
// Vercel serverless where every cold start re-triggers these warnings.
const OPTIONAL_KEYS_WITH_FALLBACK: Array<{ key: string; feature: string }> = [
  { key: 'RENTCAST_API_KEY', feature: 'property data via RentCast (mock fallback when not set)' },
  { key: 'FBI_UCR_API_KEY', feature: 'crime risk scoring (will use heuristic fallback)' },
]

for (const { key, feature } of OPTIONAL_KEYS_WITH_FALLBACK) {
  if (!process.env[key]) {
    console.debug(`[CoverGuard] ${key} is not set — ${feature}`)
  }
}

export {}
