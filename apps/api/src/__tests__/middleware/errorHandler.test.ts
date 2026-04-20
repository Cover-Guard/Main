/**
 * errorHandler middleware tests
 *
 * Covers:
 *  - ZodError → 400 with validation details
 *  - Prisma P2025 (not found) → 404
 *  - Prisma P2002 (unique constraint) → 409
 *  - Prisma P2003 (foreign key) → 400
 *  - Prisma validation error → 400
 *  - Generic Error → 500
 *  - Non-Error thrown → 500
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

describe('errorHandler', () => {
  beforeEach(() => jest.clearAllMocks())

  describe('ZodError', () => {
    it('returns 400 with VALIDATION_ERROR code', () => {
      const zodErr = new ZodError([
        {
          code: ZodIssueCode.invalid_type,
          expected: 'string',
          received: 'number',
          path: ['name'],
          message: 'Expected string, received number',
        },
      ])
      const { res, status, json } = makeRes()

      errorHandler(zodErr, req, res, next)

      expect(status).toHaveBeenCalledWith(400)
      expect(json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({
            code: 'VALIDATION_ERROR',
            message: 'Request validation failed',
          }),
        }),
      )
    })

    it('includes flattened error details', () => {
      const zodErr = new ZodError([
        {
          code: ZodIssueCode.invalid_type,
          expected: 'string',
          received: 'undefined',
          path: ['email'],
          message: 'Required',
        },
      ])
      const { res, json } = makeRes()

      errorHandler(zodErr, req, res, next)

      const body = json.mock.calls[0][0]
      expect(body.error.details).toBeDefined()
    })
  })

  describe('Prisma known request errors', () => {
    function makePrismaError(code: string, message: string): Error {
      const err = new Error(message)
      err.name = 'PrismaClientKnownRequestError'
      ;(err as Error & { code: string }).code = code
      return err
    }

    it('returns 404 for P2025 (record not found)', () => {
      const err = makePrismaError('P2025', 'Record to update not found')
      const { res, status, json } = makeRes()

      errorHandler(err, req, res, next)

      expect(status).toHaveBeenCalledWith(404)
      expect(json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({ code: 'NOT_FOUND' }),
        }),
      )
    })

    it('returns 409 for P2002 (unique constraint violation)', () => {
      const err = makePrismaError('P2002', 'Unique constraint failed on the fields: (`email`)')
      const { res, status, json } = makeRes()

      errorHandler(err, req, res, next)

      expect(status).toHaveBeenCalledWith(409)
      expect(json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({ code: 'CONFLICT' }),
        }),
      )
    })

    it('returns 400 for P2003 (foreign key constraint failure)', () => {
      const err = makePrismaError('P2003', 'Foreign key constraint failed')
      const { res, status, json } = makeRes()

      errorHandler(err, req, res, next)

      expect(status).toHaveBeenCalledWith(400)
      expect(json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({ code: 'INVALID_REFERENCE' }),
        }),
      )
    })

    // P2021 / P2022 surface when a migration has not been applied (table or
    // column missing). They are operational states, not client bugs — map to
    // 503 so retries back off and monitoring clearly flags schema drift.
    it('returns 503 for P2021 (table does not exist)', () => {
      const err = makePrismaError(
        'P2021',
        "The table `public.deals` does not exist in the current database.",
      )
      const { res, status, json } = makeRes()

      errorHandler(err, req, res, next)

      expect(status).toHaveBeenCalledWith(503)
      expect(json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({ code: 'SERVICE_UNAVAILABLE' }),
        }),
      )
    })

    it('returns 503 for P2022 (column does not exist)', () => {
      const err = makePrismaError(
        'P2022',
        "The column `Property.marketValue` does not exist in the current database.",
      )
      const { res, status, json } = makeRes()

      errorHandler(err, req, res, next)

      expect(status).toHaveBeenCalledWith(503)
      expect(json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({ code: 'SERVICE_UNAVAILABLE' }),
        }),
      )
    })
  })

  describe('Prisma validation error', () => {
    it('returns 400 for PrismaClientValidationError', () => {
      const err = new Error('Invalid `prisma.user.create()` invocation')
      err.name = 'PrismaClientValidationError'
      const { res, status, json } = makeRes()

      errorHandler(err, req, res, next)

      expect(status).toHaveBeenCalledWith(400)
      expect(json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({ code: 'VALIDATION_ERROR' }),
        }),
      )
    })
  })

  describe('generic Error', () => {
    it('returns 500 with INTERNAL_ERROR code', () => {
      const err = new Error('Something broke')
      const { res, status, json } = makeRes()

      errorHandler(err, req, res, next)

      expect(status).toHaveBeenCalledWith(500)
      expect(json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({
            code: 'INTERNAL_ERROR',
            message: 'Internal server error',
          }),
        }),
      )
    })
  })

  describe('non-Error thrown', () => {
    it('returns 500 for string thrown', () => {
      const { res, status, json } = makeRes()

      errorHandler('unexpected string error', req, res, next)

      expect(status).toHaveBeenCalledWith(500)
      expect(json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({ code: 'INTERNAL_ERROR' }),
        }),
      )
    })

    it('returns 500 for null thrown', () => {
      const { res, status } = makeRes()

      errorHandler(null, req, res, next)

      expect(status).toHaveBeenCalledWith(500)
    })
  })
})
