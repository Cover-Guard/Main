import { PrismaClient } from '@prisma/client'
import { logger } from './logger'

declare global {
  var __prisma: PrismaClient | undefined
}

const isProduction = process.env.NODE_ENV === 'production'

/**
 * Connection configuration:
 * - DATABASE_URL should point to the Supabase pgBouncer (Transaction Mode, port 6543)
 *   for all runtime queries. Use ?pgbouncer=true&connection_limit=1 in the URL.
 * - DIRECT_URL should point to the direct PostgreSQL connection (port 5432).
 *   Prisma uses DIRECT_URL for migrations and schema introspection (via directUrl in
 *   schema.prisma) while using DATABASE_URL for all application queries.
 *
 * Set DATABASE_URL to the pgBouncer URL for all production deployments.
 */
export const prisma =
  global.__prisma ??
  new PrismaClient({
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
