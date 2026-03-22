#!/usr/bin/env tsx
/**
 * env-validate.ts
 *
 * Validates that all required environment variables are present and
 * non-empty before starting the application or running tests.
 *
 * Usage:
 *   npx tsx scripts/qa/env-validate.ts [--context api|web|all]
 *
 * Exit codes:
 *   0 – all required vars are set
 *   1 – one or more required vars are missing
 */

import { config } from 'dotenv'
import * as path from 'path'
import * as process from 'process'

config({ path: path.resolve(__dirname, '../../.env') })

interface VarSpec {
  name: string
  context: 'api' | 'web' | 'all'
  required: boolean
  description: string
}

const VAR_SPECS: VarSpec[] = [
  // Shared / Supabase
  { name: 'SUPABASE_URL',               context: 'api', required: true,  description: 'Supabase project URL (API)' },
  { name: 'SUPABASE_ANON_KEY',          context: 'api', required: true,  description: 'Supabase anon key (API)' },
  { name: 'SUPABASE_SERVICE_ROLE_KEY',  context: 'api', required: true,  description: 'Supabase service role key — server-only' },
  { name: 'DATABASE_URL',               context: 'api', required: true,  description: 'PostgreSQL direct connection URL (Prisma)' },
  // Web
  { name: 'NEXT_PUBLIC_SUPABASE_URL',   context: 'web', required: true,  description: 'Supabase project URL (Next.js)' },
  { name: 'NEXT_PUBLIC_SUPABASE_ANON_KEY', context: 'web', required: true, description: 'Supabase anon key (Next.js)' },
  { name: 'NEXT_PUBLIC_MAPBOX_TOKEN',   context: 'web', required: true,  description: 'Mapbox GL access token' },
  // Optional
  { name: 'ATTOM_API_KEY',              context: 'api', required: false, description: 'ATTOM property data API key (mock used if absent)' },
  { name: 'FBI_CDE_KEY',                context: 'api', required: false, description: 'FBI Crime Data Explorer API key (optional)' },
]

function parseContext(): 'api' | 'web' | 'all' {
  const idx = process.argv.indexOf('--context')
  if (idx !== -1) {
    const val = process.argv[idx + 1]
    if (val === 'api' || val === 'web' || val === 'all') return val
  }
  return 'all'
}

function validate(): boolean {
  const context = parseContext()
  const relevant = VAR_SPECS.filter(
    (v) => context === 'all' || v.context === context || v.context === 'all',
  )

  let allOk = true
  const missing: VarSpec[] = []
  const optional: VarSpec[] = []
  const present: VarSpec[] = []

  for (const spec of relevant) {
    const val = process.env[spec.name]
    if (!val) {
      if (spec.required) {
        missing.push(spec)
        allOk = false
      } else {
        optional.push(spec)
      }
    } else {
      present.push(spec)
    }
  }

  console.log('\n=== CoverGuard Environment Validation ===\n')
  console.log(`Context: ${context.toUpperCase()}`)
  console.log(`Checked: ${relevant.length} variable(s)\n`)

  if (present.length > 0) {
    console.log(`✅  Present (${present.length}):`)
    for (const v of present) {
      const preview = (process.env[v.name] ?? '').slice(0, 8) + '...'
      console.log(`    ${v.name.padEnd(40)} ${preview}`)
    }
    console.log()
  }

  if (optional.length > 0) {
    console.log(`⚠️   Optional / Missing (${optional.length}):`)
    for (const v of optional) {
      console.log(`    ${v.name.padEnd(40)} ${v.description}`)
    }
    console.log()
  }

  if (missing.length > 0) {
    console.log(`❌  Required but missing (${missing.length}):`)
    for (const v of missing) {
      console.log(`    ${v.name.padEnd(40)} ${v.description}`)
    }
    console.log()
    console.log('Fix: copy .env.example → .env and fill in the missing values.\n')
  } else {
    console.log('✅  All required variables are set.\n')
  }

  return allOk
}

const ok = validate()
process.exit(ok ? 0 : 1)
