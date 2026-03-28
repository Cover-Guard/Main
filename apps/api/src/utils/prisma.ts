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

export const prisma = global.__prisma ?? createPrismaClient()

if (!isProduction) {
  global.__prisma = prisma

  prisma.$on('query' as never, (e: { query: string; duration: number }) => {
    if (process.env.LOG_LEVEL === 'debug') {
      logger.debug(`Query: ${e.query} (${e.duration}ms)`)
    }
  })
}

// Graceful shutdown — close pool on process signals
process.once('SIGTERM', async () => {
  await prisma.$disconnect()
})

process.once('SIGINT', async () => {
  await prisma.$disconnect()
})
