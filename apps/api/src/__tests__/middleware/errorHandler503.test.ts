/**
 * Error handler — 503 SERVICE_UNAVAILABLE tests
 *
 * Validates that database/infrastructure configuration errors return
 * 503 instead of 500 so Vercel doesn't replace the JSON response
 * with an HTML error page.
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
import { errorHandler } from '../../middleware/errorHandler'

function makeRes(): { res: Response; status: jest.Mock; json: jest.Mock } {
  const json = jest.fn()
  const status = jest.fn().mockReturnValue({ json })
  return { res: { status } as unknown as Response, status, json }
}

const req = {} as Request
const next = jest.fn() as NextFunction

describe('errorHandler — 503 config errors', () => {
  beforeEach(() => jest.clearAllMocks())

  const configErrorMessages = [
    'Database connection string is not configured. Set DATABASE_URL, POSTGRES_PRISMA_URL, or POSTGRES_URL environment variable.',
    'Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables',
    'Missing SUPABASE_URL',
    'SUPABASE_SERVICE_ROLE_KEY is required',
    'DATABASE_URL must be set for database access',
    'POSTGRES_PRISMA_URL not found in environment',
    'POSTGRES_URL is missing',
  ]

  it.each(configErrorMessages)(
    'returns 503 for: "%s"',
    (message) => {
      const err = new Error(message)
      const { res, status, json } = makeRes()

      errorHandler(err, req, res, next)

      expect(status).toHaveBeenCalledWith(503)
      expect(json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({
            code: 'SERVICE_UNAVAILABLE',
          }),
        }),
      )
    },
  )

  it('returns 500 for unrelated errors', () => {
    const err = new Error('Cannot read property x of undefined')
    const { res, status } = makeRes()

    errorHandler(err, req, res, next)

    expect(status).toHaveBeenCalledWith(500)
  })

  it('503 response includes user-friendly message', () => {
    const err = new Error('Database connection string is not configured')
    const { res, json } = makeRes()

    errorHandler(err, req, res, next)

    const body = json.mock.calls[0][0]
    expect(body.error.message).toContain('temporarily unavailable')
  })

  it('does not leak internal error details to client', () => {
    const err = new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables')
    const { res, json } = makeRes()

    errorHandler(err, req, res, next)

    const body = json.mock.calls[0][0]
    expect(body.error.message).not.toContain('SUPABASE')
    expect(body.error.message).not.toContain('DATABASE_URL')
    expect(body.error.message).not.toContain('environment')
  })
})
