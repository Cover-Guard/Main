/**
 * advisor route tests
 *
 * Tests the POST /chat handler covering:
 *  - Missing Anthropic API key → 503
 *  - Invalid request body (Zod validation) → 400
 *  - Successful chat response
 *  - Conversation history trimming
 *  - Anthropic SDK error handling (auth, rate limit, not found, connection, generic API)
 *  - Unexpected errors → 500
 *  - Empty text content block handling
 */

// Save original env
const ORIG_ENV = process.env.ANTHROPIC_API_KEY

// --- Mock Anthropic SDK error classes ---
class MockAuthenticationError extends Error {
  status = 401
  constructor(m: string) { super(m); this.name = 'AuthenticationError' }
}
class MockRateLimitError extends Error {
  status = 429
  constructor(m: string) { super(m); this.name = 'RateLimitError' }
}
class MockNotFoundError extends Error {
  status = 404
  constructor(m: string) { super(m); this.name = 'NotFoundError' }
}
class MockAPIConnectionError extends Error {
  constructor(m: string) { super(m); this.name = 'APIConnectionError' }
}
class MockAPIError extends Error {
  status: number
  constructor(status: number, m: string) { super(m); this.name = 'APIError'; this.status = status }
}

const mockCreate = jest.fn()

jest.mock('@anthropic-ai/sdk', () => {
  const Cls = jest.fn().mockImplementation(() => ({
    messages: { create: mockCreate },
  }))
  Object.assign(Cls, {
    AuthenticationError: MockAuthenticationError,
    RateLimitError: MockRateLimitError,
    NotFoundError: MockNotFoundError,
    APIConnectionError: MockAPIConnectionError,
    APIError: MockAPIError,
  })
  return { __esModule: true, default: Cls }
})

jest.mock('../../middleware/auth', () => ({
  requireAuth: (_req: unknown, _res: unknown, next: () => void) => next(),
}))
jest.mock('../../middleware/subscription', () => ({
  requireSubscription: (_req: unknown, _res: unknown, next: () => void) => next(),
}))
jest.mock('../../utils/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), http: jest.fn() },
}))

import type { Request, Response } from 'express'
import { advisorRouter } from '../../routes/advisor'

// Extract the actual handler (3rd middleware in stack — after requireAuth + requireSubscription)
// The router stores layers; the POST /chat handler is the last layer's route.
function getHandler() {
  const stack = (advisorRouter as any).stack as Array<{
    route?: { path: string; stack: Array<{ handle: (req: Request, res: Response) => Promise<void> }> }
  }>
  for (const layer of stack) {
    if (layer.route?.path === '/chat') {
      const routeStack = layer.route.stack
      return routeStack[routeStack.length - 1].handle
    }
  }
  throw new Error('Could not find /chat handler')
}

function makeReq(body: unknown): Request {
  return { body, userId: 'test-user' } as unknown as Request
}

function makeRes(): { res: Response; status: jest.Mock; json: jest.Mock } {
  const json = jest.fn()
  const status = jest.fn().mockReturnValue({ json })
  return { res: { status, json } as unknown as Response, status, json }
}

describe('POST /api/advisor/chat', () => {
  let handler: (req: Request, res: Response) => Promise<void>

  beforeAll(() => {
    process.env.ANTHROPIC_API_KEY = 'sk-test-key'
    handler = getHandler()
  })

  beforeEach(() => {
    jest.clearAllMocks()
    process.env.ANTHROPIC_API_KEY = 'sk-test-key'
  })

  afterAll(() => {
    if (ORIG_ENV) process.env.ANTHROPIC_API_KEY = ORIG_ENV
    else delete process.env.ANTHROPIC_API_KEY
  })

  describe('service unavailable (no API key)', () => {
    it('returns 503 when ANTHROPIC_API_KEY is not set', async () => {
      delete process.env.ANTHROPIC_API_KEY
      // Need to re-require to get a fresh module with no client
      jest.resetModules()
      jest.mock('@anthropic-ai/sdk', () => {
        const Cls = jest.fn().mockImplementation(() => ({
          messages: { create: mockCreate },
        }))
        Object.assign(Cls, {
          AuthenticationError: MockAuthenticationError,
          RateLimitError: MockRateLimitError,
          NotFoundError: MockNotFoundError,
          APIConnectionError: MockAPIConnectionError,
          APIError: MockAPIError,
        })
        return { __esModule: true, default: Cls }
      })
      jest.mock('../../middleware/auth', () => ({
        requireAuth: (_req: unknown, _res: unknown, next: () => void) => next(),
      }))
      jest.mock('../../middleware/subscription', () => ({
        requireSubscription: (_req: unknown, _res: unknown, next: () => void) => next(),
      }))
      jest.mock('../../utils/logger', () => ({
        logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), http: jest.fn() },
      }))

      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { advisorRouter: freshRouter } = require('../../routes/advisor')
      const stack = (freshRouter as Record<string, unknown[]>).stack as Array<{
        route?: { path: string; stack: Array<{ handle: (req: Request, res: Response) => Promise<void> }> }
      }>
      let freshHandler!: (req: Request, res: Response) => Promise<void>
      for (const layer of stack) {
        if (layer.route?.path === '/chat') {
          const routeStack = layer.route.stack
          freshHandler = routeStack[routeStack.length - 1].handle
          break
        }
      }

      const req = makeReq({ messages: [{ role: 'user', content: 'Hello' }] })
      const { res, status, json } = makeRes()

      await freshHandler(req, res)

      expect(status).toHaveBeenCalledWith(503)
      expect(json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({ code: 'SERVICE_UNAVAILABLE' }),
        }),
      )
    })
  })

  describe('request validation', () => {
    it('returns 400 when messages array is missing', async () => {
      const req = makeReq({})
      const { res, status } = makeRes()

      await handler(req, res)

      expect(status).toHaveBeenCalledWith(400)
    })

    it('returns 400 when messages is empty array', async () => {
      const req = makeReq({ messages: [] })
      const { res, status } = makeRes()

      await handler(req, res)

      expect(status).toHaveBeenCalledWith(400)
    })

    it('returns 400 when message role is invalid', async () => {
      const req = makeReq({ messages: [{ role: 'system', content: 'hello' }] })
      const { res, status } = makeRes()

      await handler(req, res)

      expect(status).toHaveBeenCalledWith(400)
    })

    it('returns 400 when message content is empty', async () => {
      const req = makeReq({ messages: [{ role: 'user', content: '' }] })
      const { res, status } = makeRes()

      await handler(req, res)

      expect(status).toHaveBeenCalledWith(400)
    })

    it('returns 400 when messages is not an array', async () => {
      const req = makeReq({ messages: 'not an array' })
      const { res, status } = makeRes()

      await handler(req, res)

      expect(status).toHaveBeenCalledWith(400)
    })
  })

  describe('successful response', () => {
    it('returns advisor text on valid request', async () => {
      mockCreate.mockResolvedValue({
        content: [{ type: 'text', text: 'Flood risk is measured by FEMA zones.' }],
        usage: { input_tokens: 100, output_tokens: 50 },
      })

      const req = makeReq({ messages: [{ role: 'user', content: 'What is flood risk?' }] })
      const { res, json } = makeRes()

      await handler(req, res)

      expect(json).toHaveBeenCalledWith({
        success: true,
        data: { text: 'Flood risk is measured by FEMA zones.' },
      })
    })

    it('handles response with no text block gracefully', async () => {
      mockCreate.mockResolvedValue({
        content: [],
        usage: { input_tokens: 10, output_tokens: 0 },
      })

      const req = makeReq({ messages: [{ role: 'user', content: 'test' }] })
      const { res, json } = makeRes()

      await handler(req, res)

      expect(json).toHaveBeenCalledWith({
        success: true,
        data: { text: 'Sorry, I could not generate a response.' },
      })
    })

    it('accepts assistant role in conversation history', async () => {
      mockCreate.mockResolvedValue({
        content: [{ type: 'text', text: 'Follow-up answer.' }],
        usage: { input_tokens: 150, output_tokens: 60 },
      })

      const req = makeReq({
        messages: [
          { role: 'user', content: 'What is flood risk?' },
          { role: 'assistant', content: 'Flood risk is...' },
          { role: 'user', content: 'Tell me more.' },
        ],
      })
      const { res, json } = makeRes()

      await handler(req, res)

      expect(json).toHaveBeenCalledWith(
        expect.objectContaining({ success: true }),
      )
    })

    it('trims messages to last 20', async () => {
      mockCreate.mockResolvedValue({
        content: [{ type: 'text', text: 'Response.' }],
        usage: { input_tokens: 500, output_tokens: 30 },
      })

      const messages = Array.from({ length: 30 }, (_, i) => ({
        role: i % 2 === 0 ? 'user' : 'assistant',
        content: `Message ${i}`,
      }))

      const req = makeReq({ messages })
      const { res } = makeRes()

      await handler(req, res)

      const calledMessages = mockCreate.mock.calls[0][0].messages
      expect(calledMessages).toHaveLength(20)
      expect(calledMessages[19].content).toBe('Message 29')
    })

    it('passes the system prompt to the API', async () => {
      mockCreate.mockResolvedValue({
        content: [{ type: 'text', text: 'Test.' }],
        usage: { input_tokens: 10, output_tokens: 5 },
      })

      const req = makeReq({ messages: [{ role: 'user', content: 'Hi' }] })
      const { res } = makeRes()

      await handler(req, res)

      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          system: expect.stringContaining('CoverGuard AI Advisor'),
          model: 'claude-sonnet-4-6',
          max_tokens: 512,
        }),
      )
    })
  })

  describe('Anthropic SDK errors', () => {
    it('returns 503 on AuthenticationError', async () => {
      mockCreate.mockRejectedValue(new MockAuthenticationError('Invalid API key'))

      const req = makeReq({ messages: [{ role: 'user', content: 'test' }] })
      const { res, status } = makeRes()

      await handler(req, res)

      expect(status).toHaveBeenCalledWith(503)
    })

    it('returns 429 on RateLimitError', async () => {
      mockCreate.mockRejectedValue(new MockRateLimitError('Rate limited'))

      const req = makeReq({ messages: [{ role: 'user', content: 'test' }] })
      const { res, status } = makeRes()

      await handler(req, res)

      expect(status).toHaveBeenCalledWith(429)
    })

    it('returns 503 on NotFoundError', async () => {
      mockCreate.mockRejectedValue(new MockNotFoundError('Model not found'))

      const req = makeReq({ messages: [{ role: 'user', content: 'test' }] })
      const { res, status } = makeRes()

      await handler(req, res)

      expect(status).toHaveBeenCalledWith(503)
    })

    it('returns 502 on APIConnectionError', async () => {
      mockCreate.mockRejectedValue(new MockAPIConnectionError('Connection failed'))

      const req = makeReq({ messages: [{ role: 'user', content: 'test' }] })
      const { res, status } = makeRes()

      await handler(req, res)

      expect(status).toHaveBeenCalledWith(502)
    })

    it('returns 502 for upstream 5xx APIError', async () => {
      mockCreate.mockRejectedValue(new MockAPIError(500, 'Internal server error'))

      const req = makeReq({ messages: [{ role: 'user', content: 'test' }] })
      const { res, status } = makeRes()

      await handler(req, res)

      expect(status).toHaveBeenCalledWith(502)
    })

    it('returns 500 for client-side 4xx APIError', async () => {
      mockCreate.mockRejectedValue(new MockAPIError(400, 'Bad request'))

      const req = makeReq({ messages: [{ role: 'user', content: 'test' }] })
      const { res, status } = makeRes()

      await handler(req, res)

      expect(status).toHaveBeenCalledWith(500)
    })
  })

  describe('unexpected errors', () => {
    it('returns 500 on unknown Error', async () => {
      mockCreate.mockRejectedValue(new Error('Something went wrong'))

      const req = makeReq({ messages: [{ role: 'user', content: 'test' }] })
      const { res, status } = makeRes()

      await handler(req, res)

      expect(status).toHaveBeenCalledWith(500)
    })
  })
})
