import type { Request, Response, NextFunction } from 'express'
import { logger } from '../utils/logger'
import { ZodError } from 'zod'

/** Type guard for Prisma known request errors (avoids import issues with generated client). */
function isPrismaKnownError(err: unknown): err is Error & { code: string } {
  return err instanceof Error && err.name === 'PrismaClientKnownRequestError' && 'code' in err
}

function isPrismaValidationError(err: unknown): err is Error {
  return err instanceof Error && err.name === 'PrismaClientValidationError'
}

export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  // Zod validation errors → 400
  if (err instanceof ZodError) {
    res.status(400).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Request validation failed',
        details: err.flatten(),
      },
    })
    return
  }

  // Prisma: known request errors
  if (isPrismaKnownError(err)) {
    // Record not found → 404
    if (err.code === 'P2025') {
      logger.warn('Record not found: %s', err.message)
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'The requested resource was not found' },
      })
      return
    }

    // Unique constraint violation → 409
    if (err.code === 'P2002') {
      logger.warn('Unique constraint violation: %s', err.message)
      res.status(409).json({
        success: false,
        error: { code: 'CONFLICT', message: 'A record with that identifier already exists' },
      })
      return
    }

    // Foreign key constraint failure → 400
    if (err.code === 'P2003') {
      logger.warn('Foreign key constraint failed: %s', err.message)
      res.status(400).json({
        success: false,
        error: { code: 'INVALID_REFERENCE', message: 'Referenced record does not exist' },
      })
      return
    }

    // Table does not exist in the current database → 503.
    // This is an operational state (a migration has not been applied), not a
    // client bug. Return a service-unavailable so clients can back off and so
    // the error rate dashboard clearly flags the missing migration instead of
    // lumping it in with generic 500s.
    if (err.code === 'P2021') {
      logger.error('Missing database table — migration likely not applied: %s', err.message)
      res.status(503).json({
        success: false,
        error: {
          code: 'SERVICE_UNAVAILABLE',
          message: 'A required database object is missing. Please try again later.',
        },
      })
      return
    }

    // Column does not exist → 503. Same reasoning as P2021.
    if (err.code === 'P2022') {
      logger.error('Missing database column — migration likely not applied: %s', err.message)
      res.status(503).json({
        success: false,
        error: {
          code: 'SERVICE_UNAVAILABLE',
          message: 'A required database object is missing. Please try again later.',
        },
      })
      return
    }
  }

  // Prisma: validation error → 400
  if (isPrismaValidationError(err)) {
    logger.warn('Prisma validation error: %s', err.message)
    res.status(400).json({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: 'Invalid data provided' },
    })
    return
  }

  // Fetch timeout / abort errors (from AbortSignal.timeout in external API calls) → 504
  if (err instanceof Error && (err.name === 'AbortError' || err.name === 'TimeoutError')) {
    logger.warn('External API timeout: %s', err.message)
    res.status(504).json({
      success: false,
      error: {
        code: 'UPSTREAM_TIMEOUT',
        message: 'An upstream data source took too long to respond. Please try again.',
      },
    })
    return
  }

  // Fetch / network connection errors → 502
  if (err instanceof TypeError && (
    err.message.includes('fetch failed') ||
    err.message.includes('network') ||
    err.message.includes('ECONNREFUSED') ||
    err.message.includes('ENOTFOUND')
  )) {
    logger.warn('Upstream connection error: %s', err.message)
    res.status(502).json({
      success: false,
      error: {
        code: 'BAD_GATEWAY',
        message: 'Could not reach an upstream service. Please try again.',
      },
    })
    return
  }

  // Missing configuration (DB, Supabase, etc.) → 503
  if (err instanceof Error && (
    err.message.includes('connection string is not configured') ||
    err.message.includes('Missing SUPABASE_URL') ||
    err.message.includes('SUPABASE_SERVICE_ROLE_KEY') ||
    err.message.includes('DATABASE_URL') ||
    err.message.includes('POSTGRES_PRISMA_URL') ||
    err.message.includes('POSTGRES_URL')
  )) {
    logger.error('Service unavailable: %s', err.message)
    res.status(503).json({
      success: false,
      error: {
        code: 'SERVICE_UNAVAILABLE',
        message: 'Service temporarily unavailable. Please try again later.',
      },
    })
    return
  }

  // Prisma / pg "Invalid URL" — the DATABASE_URL is malformed → 503
  if (err instanceof Error && (
    err.message.includes('Invalid URL') ||
    err.message.includes('DATABASE_URL is not a valid URL')
  )) {
    logger.error('Invalid database connection URL: %s', err.message)
    res.status(503).json({
      success: false,
      error: {
        code: 'SERVICE_UNAVAILABLE',
        message: 'Database temporarily unavailable. Please try again later.',
      },
    })
    return
  }

  // Prisma connection errors (pool exhausted, DB unreachable) → 503
  if (err instanceof Error && (
    err.message.includes('Can\'t reach database server') ||
    err.message.includes('Connection pool timeout') ||
    err.message.includes('prepared statement') ||
    err.name === 'PrismaClientInitializationError'
  )) {
    logger.error('Database connection error: %s', err.message)
    res.status(503).json({
      success: false,
      error: {
        code: 'SERVICE_UNAVAILABLE',
        message: 'Database temporarily unavailable. Please try again later.',
      },
    })
    return
  }

  // Generic Error → 500
  if (err instanceof Error) {
    logger.error(err.message, { stack: err.stack })
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Internal server error',
      },
    })
    return
  }

  logger.error('Unknown error', { err })
  res.status(500).json({
    success: false,
    error: { code: 'INTERNAL_ERROR', message: 'Internal server error' },
  })
}
