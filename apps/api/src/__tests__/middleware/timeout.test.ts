/**
 * requestTimeout middleware tests
 *
 * Covers:
 *  - Calls next() immediately
 *  - Sends 503 after timeout when response not yet sent
 *  - Does not send 503 if headers already sent
 *  - Clears timer on response finish
 *  - Clears timer on response close
 */

jest.mock('../../utils/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    http: jest.fn(),
  },
}))

import { EventEmitter } from 'events'
import type { Request, NextFunction } from 'express'
import { requestTimeout } from '../../middleware/timeout'

function makeReq(): Request {
  return {
    method: 'GET',
    originalUrl: '/api/test',
    url: '/test',
  } as unknown as Request
}

interface MockRes extends EventEmitter {
  headersSent: boolean
  status: jest.Mock
  json: jest.Mock
}

function makeRes(): MockRes {
  const res = new EventEmitter() as MockRes
  res.headersSent = false
  const json = jest.fn()
  res.json = json
  res.status = jest.fn().mockReturnValue({ json })
  return res
}

describe('requestTimeout', () => {
  beforeEach(() => jest.useFakeTimers())
  afterEach(() => jest.useRealTimers())

  it('calls next() immediately', () => {
    const middleware = requestTimeout(5000)
    const req = makeReq()
    const res = makeRes()
    const next = jest.fn() as NextFunction

    middleware(req, res as never, next)

    expect(next).toHaveBeenCalledTimes(1)
  })

  it('sends 503 after timeout when response not yet sent', () => {
    const middleware = requestTimeout(1000)
    const req = makeReq()
    const res = makeRes()
    const next = jest.fn() as NextFunction

    middleware(req, res as never, next)

    jest.advanceTimersByTime(1001)

    expect(res.status).toHaveBeenCalledWith(503)
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        error: expect.objectContaining({ code: 'REQUEST_TIMEOUT' }),
      }),
    )
  })

  it('does not send 503 if headers already sent', () => {
    const middleware = requestTimeout(1000)
    const req = makeReq()
    const res = makeRes()
    const next = jest.fn() as NextFunction

    middleware(req, res as never, next)
    res.headersSent = true
    jest.advanceTimersByTime(1001)

    expect(res.status).not.toHaveBeenCalled()
  })

  it('clears timer when response finishes before timeout', () => {
    const middleware = requestTimeout(1000)
    const req = makeReq()
    const res = makeRes()
    const next = jest.fn() as NextFunction

    middleware(req, res as never, next)
    res.emit('finish')
    jest.advanceTimersByTime(1001)

    expect(res.status).not.toHaveBeenCalled()
  })

  it('clears timer when connection closes before timeout', () => {
    const middleware = requestTimeout(1000)
    const req = makeReq()
    const res = makeRes()
    const next = jest.fn() as NextFunction

    middleware(req, res as never, next)
    res.emit('close')
    jest.advanceTimersByTime(1001)

    expect(res.status).not.toHaveBeenCalled()
  })
})
