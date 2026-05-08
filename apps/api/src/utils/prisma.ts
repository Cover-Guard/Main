import { PrismaPg } from '@prisma/adapter-pg'
import { Pool } from 'pg'
import { PrismaClient } from '../generated/prisma/client'
import { logger } from './logger'

declare global {
  var __prisma: PrismaClient | undefined
  var __prismaShutdownRegistered: boolean | undefined
}

const isProduction = process.env.NODE_ENV === 'production'

/**
 * Prisma error codes that the app handles gracefully and that should NOT be
 * forwarded to logger.error. P2021 = table missing, P2022 = column missing —
 * both indicate the migration hasn't run on the target database, and the
 * service-layer catches them and degrades to empty data. Without this filter
 * the Prisma client emits a noisy `prisma:error  Invalid prisma...` line on
 * every request that hits an unmigrated table (e.g. `/api/deals` when the
 * deals migration hasn't been applied).
 */
const HANDLED_PRISMA_CODES = new Set(['P2021', 'P2022'])

/**
 * Connection configuration:
 * - DATABASE_URL should point to the Supabase pgBouncer (Transaction Mode, port 6543)
 *   with ?pgbouncer=true in the URL.
 * - DIRECT_URL should point to the direct PostgreSQL connection (port 5432).
 *   Prisma CLI uses DIRECT_URL for schema introspection (via prisma.config.ts)
 *   while the app uses DATABASE_URL for all runtime queries through the pg adapter.
 *
 * The Supabase Vercel Integration syncs env vars under POSTGRES_PRISMA_URL /
 * POSTGRES_URL rather than DATABASE_URL. We accept all three so the API works
 * regardless of how the hosting environment names the variable.
 */
function createPrismaClient(): PrismaClient {
  const connectionString =
    process.env.DATABASE_URL ??
    process.env.POSTGRES_PRISMA_URL ??
    process.env.POSTGRES_URL

  if (!connectionString) {
    throw new Error(
      'Database connection string is not configured. ' +
        'Set DATABASE_URL, POSTGRES_PRISMA_URL, or POSTGRES_URL environment variable.',
    )
  }

  // Validate the connection string with the WHATWG URL API before passing it
  // to the pg driver. This catches malformed URLs early with a clear error
  // message instead of surfacing a cryptic "Invalid URL" from deep inside
  // Prisma at query time (which also triggers the deprecated url.parse()
  // fallback path in older pg versions).
  try {
    new URL(connectionString)
  } catch {
    throw new Error(
      `DATABASE_URL is not a valid URL. Ensure it follows the format ` +
        `postgresql://user:password@host:port/database and that special ` +
        `characters in the password are percent-encoded.`,
    )
  }

  // Supabase pooler requires SSL but uses certs that need rejectUnauthorized: false.
  // pg-connection-string parses sslmode=require from the URL and overrides the ssl option,
  // treating it as verify-full in pg 8.13+. Strip it so our explicit ssl config takes effect.
  const dbUrl = new URL(connectionString)
  dbUrl.searchParams.delete('sslmode')

  const pool = new Pool({
    connectionString: dbUrl.toString(),
    ssl: { rejectUnauthorized: false },
  })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const adapter = new PrismaPg(pool as any)

  // Route Prisma's error/warn streams through our logger via `emit: 'event'`
  // (instead of `emit: 'stdout'`, which prints to stderr unconditionally).
  // This lets us drop known-handled error codes (P2021, P2022) so they don't
  // surface as `error` lines in Vercel logs while leaving genuine DB errors
  // intact.
  const client = new PrismaClient({
    adapter,
    log: isProduction
      ? [
          { level: 'error', emit: 'event' },
          { level: 'warn', emit: 'event' },
        ]
      : [
          { level: 'query', emit: 'event' },
          { level: 'error', emit: 'event' },
          { level: 'warn', emit: 'event' },
        ],
  })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ;(client as any).$on('error', (e: { message: string; target?: string }) => {
    // Suppress the two schema-drift codes the service layer handles gracefully.
    // Prisma surfaces the code as part of the message text (e.g. "...code: 'P2021'...").
    const msg = e.message ?? ''
    for (const code of HANDLED_PRISMA_CODES) {
      if (msg.includes(code)) return
    }
    logger.error('Prisma error', { message: msg, target: e.target })
  })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ;(client as any).$on('warn', (e: { message: string }) => {
    logger.warn('Prisma warn', { message: e.message })
  })

  return client
}

/**
 * Lazy-initialized Prisma client singleton.
 *
 * The client is created on first access rather than at module-load time so that
 * the Express app can boot even when DATABASE_URL is missing (e.g. a Vercel
 * misconfiguration). This lets the error handler return a proper JSON 500
 * instead of crashing the entire serverless function with an unhandled import
 * error.
 */
function getPrismaClient(): PrismaClient {
  if (global.__prisma) return global.__prisma

  const client = createPrismaClient()

  if (!isProduction) {
    global.__prisma = client
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(client as any).$on('query', (e: { query: string; duration: number }) => {
      if (process.env.LOG_LEVEL === 'debug') {
        logger.debug(`Query: ${e.query} (${e.duration}ms)`)
      }
    })
  } else {
    global.__prisma = client
  }

  return client
}

export const prisma = new Proxy({} as PrismaClient, {
  get(_target, prop, receiver) {
    const client = getPrismaClient()
    const value = Reflect.get(client, prop, receiver)
    return typeof value === 'function' ? value.bind(client) : value
  },
})

// Graceful shutdown — close pool on process signals.
// Guard with a flag so re-evaluation (e.g. in tests using jest.resetModules)
// does not keep adding duplicate listeners.
if (!(global as Record<string, unknown>).__prismaShutdownRegistered) {
  ;(global as Record<string, unknown>).__prismaShutdownRegistered = true
  process.once('SIGTERM', async () => {
    await prisma.$disconnect()
  })
  process.once('SIGINT', async () => {
    await prisma.$disconnect()
  })
}
