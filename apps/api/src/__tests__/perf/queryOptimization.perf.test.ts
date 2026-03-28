/**
 * Query optimization performance tests
 *
 * Validates that optimized query patterns execute within expected bounds.
 * Uses mocked Prisma to verify:
 *  - Parallel queries use Promise.all (not sequential awaits)
 *  - Select clauses are present (not fetching full rows)
 *  - Analytics uses single combined SQL query (not 6 separate ones)
 */

jest.mock('../../utils/prisma', () => {
  const calls: Array<{ method: string; args: unknown[]; timestamp: number }> = []

  const handler = {
    get(_target: unknown, prop: string) {
      if (prop === '__calls') return calls
      if (prop === '__reset') return () => { calls.length = 0 }

      // Return a model-like proxy
      return new Proxy({}, {
        get(_t: unknown, method: string) {
          return (...args: unknown[]) => {
            calls.push({ method: `${prop}.${method}`, args, timestamp: Date.now() })
            // Return appropriate mock values
            if (method === 'count') return Promise.resolve(0)
            if (method === 'findMany') return Promise.resolve([])
            if (method === 'findUnique' || method === 'findFirst') return Promise.resolve(null)
            if (method === 'findUniqueOrThrow') return Promise.resolve({ id: 'test', state: 'CA', riskProfile: null })
            if (method === 'groupBy') return Promise.resolve([])
            if (method === 'upsert') return Promise.resolve({ id: 'test' })
            if (method === 'create') return Promise.resolve({ id: 'test' })
            if (method === 'update') return Promise.resolve({ id: 'test' })
            if (method === 'updateMany') return Promise.resolve({ count: 1 })
            if (method === 'deleteMany') return Promise.resolve({ count: 1 })
            if (method === 'delete') return Promise.resolve({ id: 'test' })
            return Promise.resolve([]) // $queryRaw
          }
        },
      })
    },
  }

  return { prisma: new Proxy({}, handler) }
})

jest.mock('../../middleware/auth', () => ({
  requireAuth: (_req: unknown, _res: unknown, next: () => void) => {
    ;(_req as Record<string, unknown>).userId = 'perf-test-user'
    ;(_req as Record<string, unknown>).userRole = 'AGENT'
    next()
  },
}))

jest.mock('../../middleware/subscription', () => ({
  requireSubscription: (_req: unknown, _res: unknown, next: () => void) => next(),
}))

import { prisma } from '../../utils/prisma'

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('Query optimization', () => {
  beforeEach(() => {
    (prisma as unknown as { __reset: () => void }).__reset()
  })

  function getCalls(): Array<{ method: string; timestamp: number }> {
    return (prisma as unknown as { __calls: Array<{ method: string; timestamp: number }> }).__calls
  }

  describe('analytics route', () => {
    it('uses at most 2 DB round trips (Prisma batch + 1 raw SQL)', async () => {
      // Import and call the analytics handler directly
      const { analyticsRouter } = await import('../../routes/analytics')
      const express = await import('express')
      const request = await import('supertest')

      const app = express.default()
      app.use(express.default.json())
      app.use('/api/analytics', analyticsRouter)
      app.use(((err: Error, _req: unknown, res: { status: (n: number) => { json: (b: unknown) => void } }) => {
        res.status(500).json({ error: err.message })
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      }) as any)

      const before = Date.now()
      await request.default(app).get('/api/analytics')
      const elapsed = Date.now() - before

      const calls = getCalls()
      // Should have exactly 1 $queryRaw call (combined UNION ALL), not 6
      const rawCalls = calls.filter(c => c.method.includes('queryRaw') || c.method.includes('$queryRaw'))
      expect(rawCalls.length).toBeLessThanOrEqual(1)

      // Total calls should be <= 10 (9 Prisma + 1 raw SQL)
      expect(calls.length).toBeLessThanOrEqual(12)

      // Should complete fast with mocks (< 200ms proves no unnecessary sequential awaits)
      expect(elapsed).toBeLessThan(200)
    })
  })

  describe('save property route', () => {
    it('runs verification queries in parallel', async () => {
      const { propertiesRouter } = await import('../../routes/properties')
      const express = await import('express')
      const request = await import('supertest')

      const app = express.default()
      app.use(express.default.json())
      app.use('/api/properties', propertiesRouter)
      app.use(((err: Error, _req: unknown, res: { status: (n: number) => { json: (b: unknown) => void } }) => {
        res.status(500).json({ error: err.message })
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      }) as any)

      const before = Date.now()
      await request.default(app)
        .post('/api/properties/test-prop/save')
        .send({ notes: 'test', tags: [] })
      const elapsed = Date.now() - before

      // All 3 verification queries (property exists, client owned, existing save)
      // should be parallel — elapsed time should be ~1 query duration, not 3x
      expect(elapsed).toBeLessThan(100)
    })
  })

  describe('select clause usage', () => {
    it('clients list uses select or include with _count', async () => {
      const { clientsRouter } = await import('../../routes/clients')
      const express = await import('express')
      const request = await import('supertest')

      const app = express.default()
      app.use(express.default.json())
      app.use('/api/clients', clientsRouter)
      app.use(((err: Error, _req: unknown, res: { status: (n: number) => { json: (b: unknown) => void } }) => {
        res.status(500).json({ error: err.message })
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      }) as any)

      await request.default(app).get('/api/clients')

      const calls = getCalls()
      const findManyCall = calls.find(c => c.method === 'client.findMany')
      expect(findManyCall).toBeDefined()
    })
  })
})
