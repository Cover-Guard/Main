import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '../generated/prisma/client'
import { logger } from './logger'

declare global {
  var __prisma: PrismaClient | undefined
  var __prismaShutdownRegistered: boolean | undefined
}

const isProduction = process.env.NODE_ENV === 'production'

/**
 * Connection configuration:
 * - DATABASE_URL should point to the Supabase pgBouncer (Transaction Mode, port 6543)
 *   with ?pgbouncer=true in the URL.
 * - DIRECT_URL should point to the direct PostgreSQL connection (port 5432).
 *   Prisma CLI uses DIRECT_URL for schema introspection (via prisma.config.ts)
 *   while the app uses DATABASE_URL for all runtime queries through the pg adapter.
 *
 * The Supabase Vercel Integration syncs env vars under POSTGRES_PRISMA_URL /
 * POSTGRES_URL rather than DATABASE_URL.  We accept all three so the API works
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
  // to the pg driver.  This catches malformed URLs early with a clear error
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

  // Supabase uses SSL certificates that need rejectUnauthorized: false for the pooler
  const adapter = new PrismaPg({ connectionString, options: { ssl: { rejectUnauthorized: false } } })

  return new PrismaClient({
    adapter,
    log: isProduction
      ? [
          { level: 'error', emit: 'stdout' },
          { level: 'warn', emit: 'stdout' },
        ]
      : [
          { level: 'query', emit: 'event' },
          { level: 'error', emit: 'stdout' },
          { level: 'warn', emit: 'stdout' },
        ],
  })
}

/**
 * Lazy-initialized Prisma client singleton.
 *
 * The client is created on first access rather than at module-load time so that
 * the Express app can boot even when DATABASE_URL is missing (e.g. a Vercel
 * misconfiguration).  This lets the error handler return a proper JSON 500
 * instead of crashing the entire serverless function with an unhandled import
 * error.
 */
function getPrismaClient(): PrismaClient {
  if (global.__prisma) return global.__prisma

  const client = createPrismaClient()

  if (!isProduction) {
    global.__prisma = client

    client.$on('query' as never, (e: { query: string; duration: number }) => {
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
