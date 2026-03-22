import { PrismaClient } from '@prisma/client'
import { logger } from './logger'

declare global {
  var __prisma: PrismaClient | undefined
}

const isProduction = process.env.NODE_ENV === 'production'

/**
 * Connection pool sizing:
 * - Supabase Session Mode (port 5432): supports real connections, use a modest pool.
 * - Supabase Transaction Mode / pgBouncer (port 6543): stateless pooling; keep pool_size=1
 *   per Prisma process and let pgBouncer multiplex.
 *
 * Set DATABASE_URL to the pgBouncer URL for production deployments.
 * Add ?connection_limit=5&pool_timeout=20 to the URL in Session Mode.
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

// Graceful shutdown — close pool on process exit
process.on('beforeExit', async () => {
  await prisma.$disconnect()
})
