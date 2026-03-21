import { PrismaClient } from '@prisma/client'
import { logger } from './logger'

declare global {
  // eslint-disable-next-line no-var
  var __prisma: PrismaClient | undefined
}

// Reuse the PrismaClient instance in development to avoid exhausting DB connections
export const prisma =
  global.__prisma ??
  new PrismaClient({
    log: [
      { level: 'query', emit: 'event' },
      { level: 'error', emit: 'stdout' },
      { level: 'warn', emit: 'stdout' },
    ],
  })

if (process.env.NODE_ENV !== 'production') {
  global.__prisma = prisma

  prisma.$on('query' as never, (e: { query: string; duration: number }) => {
    if (process.env.LOG_LEVEL === 'debug') {
      logger.debug(`Query: ${e.query} (${e.duration}ms)`)
    }
  })
}
