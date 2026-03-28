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

  const adapter = new PrismaPg({ connectionString })

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
 * Lazy-initializing Prisma client proxy.
 *
 * In serverless environments (Vercel), modules are evaluated at cold-start.
 * If DATABASE_URL is missing at that point, eagerly creating PrismaClient
 * throws an unhandled error that crashes the entire function before Express
 * can boot — resulting in an HTML 500 page instead of a JSON error.
 *
 * This proxy defers client creation until the first actual usage, allowing
 * Express to start and return proper JSON error responses.
 */
function getLazyPrisma(): PrismaClient {
  let instance: PrismaClient | undefined = global.__prisma

  return new Proxy({} as PrismaClient, {
    get(_target, prop) {
      if (!instance) {
        instance = createPrismaClient()
        if (!isProduction) {
          global.__prisma = instance
          instance.$on('query' as never, (e: { query: string; duration: number }) => {
            if (process.env.LOG_LEVEL === 'debug') {
              logger.debug(`Query: ${e.query} (${e.duration}ms)`)
            }
          })
        }
      }
      const value = (instance as unknown as Record<string | symbol, unknown>)[prop]
      if (typeof value === 'function') {
        return value.bind(instance)
      }
      return value
    },
  })
}

export const prisma: PrismaClient = getLazyPrisma()

// Graceful shutdown — close pool on process signals
if (!global.__prismaShutdownRegistered) {
  global.__prismaShutdownRegistered = true
  process.once('SIGTERM', async () => {
    if (global.__prisma) await global.__prisma.$disconnect()
  })
  process.once('SIGINT', async () => {
    if (global.__prisma) await global.__prisma.$disconnect()
  })
}
