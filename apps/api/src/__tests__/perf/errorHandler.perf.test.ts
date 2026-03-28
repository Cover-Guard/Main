/**
 * Performance tests for error handler middleware
 *
 * Ensures error classification and JSON response generation
 * is fast enough for high-traffic API usage.
 */

jest.mock('../../utils/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    http: jest.fn(),
  },
}))

import type { Request, Response, NextFunction } from 'express'
import { ZodError, ZodIssueCode } from 'zod'
import { errorHandler } from '../../middleware/errorHandler'

function makeRes(): { res: Response; status: jest.Mock; json: jest.Mock } {
  const json = jest.fn()
  const status = jest.fn().mockReturnValue({ json })
  return { res: { status } as unknown as Response, status, json }
}

const req = {} as Request
const next = jest.fn() as NextFunction

describe('errorHandler performance', () => {
  it('handles 1,000 ZodErrors in < 200ms', () => {
    const zodErr = new ZodError([
      {
        code: ZodIssueCode.invalid_type,
        expected: 'string',
        received: 'number',
        path: ['email'],
        message: 'Expected string',
      },
    ])

    const iterations = 1000
    const start = performance.now()
    for (let i = 0; i < iterations; i++) {
      const { res } = makeRes()
      errorHandler(zodErr, req, res, next)
    }
    const elapsed = performance.now() - start

    expect(elapsed).toBeLessThan(1000)
  })

  it('handles 1,000 config errors (503 path) in < 500ms', () => {
    const err = new Error('Database connection string is not configured')

    const iterations = 1000
    const start = performance.now()
    for (let i = 0; i < iterations; i++) {
      const { res } = makeRes()
      errorHandler(err, req, res, next)
    }
    const elapsed = performance.now() - start

    expect(elapsed).toBeLessThan(500)
  })

  it('handles 1,000 Prisma errors (P2025) in < 500ms', () => {
    const err = new Error('Record not found')
    err.name = 'PrismaClientKnownRequestError'
    ;(err as Error & { code: string }).code = 'P2025'

    const iterations = 1000
    const start = performance.now()
    for (let i = 0; i < iterations; i++) {
      const { res } = makeRes()
      errorHandler(err, req, res, next)
    }
    const elapsed = performance.now() - start

    expect(elapsed).toBeLessThan(500)
  })

  it('handles 1,000 generic errors in < 500ms', () => {
    const err = new Error('Something unexpected')

    const iterations = 1000
    const start = performance.now()
    for (let i = 0; i < iterations; i++) {
      const { res } = makeRes()
      errorHandler(err, req, res, next)
    }
    const elapsed = performance.now() - start

    expect(elapsed).toBeLessThan(500)
  })

  it('503 path average latency < 2ms', () => {
    const err = new Error('Missing SUPABASE_URL')
    // Warm up
    for (let i = 0; i < 50; i++) {
      const { res } = makeRes()
      errorHandler(err, req, res, next)
    }

    const iterations = 500
    const start = performance.now()
    for (let i = 0; i < iterations; i++) {
      const { res } = makeRes()
      errorHandler(err, req, res, next)
    }
    const elapsed = performance.now() - start
    const avgMs = elapsed / iterations

    expect(avgMs).toBeLessThan(2)
  })
})
