import type { Request, Response, NextFunction } from 'express'
import { logger } from '../utils/logger'

/**
 * Adds a per-request timeout.  If the handler does not call res.end() within
 * the window, the middleware sends a 503 and logs the slow path so it can be
 * investigated.
 *
 * Default: 30 s for normal endpoints, 60 s for expensive external-API routes.
 */
export function requestTimeout(ms: number) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const start = Date.now()
    const timer = setTimeout(() => {
      if (!res.headersSent) {
        const elapsed = Date.now() - start
        logger.warn('Request timeout', {
          method: req.method,
          route: req.originalUrl ?? req.url,
          elapsedMs: elapsed,
          timeoutMs: ms,
        })
        res.status(503).json({
          success: false,
          error: { code: 'REQUEST_TIMEOUT', message: 'Request took too long. Please try again.' },
        })
      }
    }, ms)

    // Clear the timer once the response is finished (success or error)
    res.on('finish', () => clearTimeout(timer))
    res.on('close', () => clearTimeout(timer))

    next()
  }
}
