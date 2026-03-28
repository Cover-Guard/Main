import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '../generated/prisma/client'
import { logger } from './logger'

declare global {
  var __prisma: PrismaClient | undefined
}

const isProduction = process.env.NODE_ENV === 'production'

/**
 * Connection configuration:
 * - DATABASE_URL should point to the Supabase pgBouncer (Transaction Mode, port 6543)
 *   with ?pgbouncer=true in the URL.
 * - DIRECT_URL should point to the direct PostgreSQL connection (port 5432).
 *   Prisma CLI uses DIRECT_URL for schema introspection (via prisma.config.ts)
 *   while the app uses DATABASE_URL for all runtime queries through the pg adapter.
 */
function createPrismaClient(): PrismaClient {
  const connectionString = process.env.DATABASE_URL
  if (!connectionString) {
    throw new Error('DATABASE_URL environment variable is not set')
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

// Graceful shutdown — close pool on process signals
process.once('SIGTERM', async () => {
  await prisma.$disconnect()
})

process.once('SIGINT', async () => {
  await prisma.$disconnect()
})
