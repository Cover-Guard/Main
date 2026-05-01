const insertCalls: Array<{ table: string; row: Record<string, unknown> }> = []
let pendingInsertError: { message: string } | null = null

jest.mock('../../utils/supabaseAdmin', () => {
  const supabaseAdmin = {
    from: (table: string) => ({
      insert: (row: Record<string, unknown>) => {
        insertCalls.push({ table, row })
        return Promise.resolve({ error: pendingInsertError })
      },
      select: () => ({
        eq: () => ({
          eq: () => ({
            gte: () => ({
              filter: () => ({ limit: () => Promise.resolve({ data: [], error: null }) }),
            }),
          }),
        }),
      }),
    }),
  }
  return { supabaseAdmin }
})

jest.mock('../../utils/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}))

import { runDetectorsForUser } from '../../detectors/runner'
import type { Detector } from '../../detectors/types'

beforeEach(() => {
  insertCalls.length = 0
  pendingInsertError = null
})

const makeDetector = (over: Partial<Detector> & { name: string }): Detector => ({
  evaluate: async () => [],
  ...over,
})

describe('runner: detector_runs logging', () => {
  it('records a success row when the detector evaluates cleanly', async () => {
    const detector = makeDetector({ name: 'd1', evaluate: async () => [] })
    const results = await runDetectorsForUser([detector], 'u1', new Date())

    const runRows = insertCalls.filter((c) => c.table === 'detector_runs')
    expect(runRows).toHaveLength(1)
    expect(runRows[0].row).toMatchObject({
      detectorName: 'd1',
      userId: 'u1',
      status: 'success',
      emitted: 0,
      inserted: 0,
      skipped: 0,
      errorMessage: null,
    })
    expect(typeof runRows[0].row.durationMs).toBe('number')
    expect(results[0].status).toBe('success')
  })

  it('records an error row when evaluate throws', async () => {
    const detector = makeDetector({
      name: 'broken',
      evaluate: async () => { throw new Error('kaboom') },
    })
    const results = await runDetectorsForUser([detector], 'u1', new Date())

    const runRows = insertCalls.filter((c) => c.table === 'detector_runs')
    expect(runRows).toHaveLength(1)
    expect(runRows[0].row).toMatchObject({
      detectorName: 'broken',
      status: 'error',
      errorMessage: 'kaboom',
    })
    expect(results[0].status).toBe('error')
    expect(results[0].errorMessage).toBe('kaboom')
  })

  it('records a skipped row when enabled() returns false', async () => {
    const detector = makeDetector({
      name: 'gated',
      enabled: () => false,
      evaluate: async () => { throw new Error('should not run') },
    })
    const results = await runDetectorsForUser([detector], 'u1', new Date())
    const runRows = insertCalls.filter((c) => c.table === 'detector_runs')
    expect(runRows).toHaveLength(1)
    expect(runRows[0].row).toMatchObject({ status: 'skipped', emitted: 0 })
    expect(results[0].status).toBe('skipped')
  })

  it("doesn't break when the detector_runs insert itself fails", async () => {
    pendingInsertError = { message: 'log table down' }
    const detector = makeDetector({ name: 'd1' })
    const results = await runDetectorsForUser([detector], 'u1', new Date())
    expect(results[0].status).toBe('success')
  })

  it('iterates multiple detectors and records one row per detector', async () => {
    const detectors: Detector[] = [
      makeDetector({ name: 'a' }),
      makeDetector({ name: 'b' }),
      makeDetector({
        name: 'c',
        evaluate: async () => { throw new Error('c-failed') },
      }),
    ]
    const results = await runDetectorsForUser(detectors, 'u1', new Date())
    expect(results.map((r) => r.detector)).toEqual(['a', 'b', 'c'])
    expect(results.map((r) => r.status)).toEqual(['success', 'success', 'error'])
    const runRows = insertCalls.filter((c) => c.table === 'detector_runs')
    expect(runRows.map((r) => r.row.detectorName)).toEqual(['a', 'b', 'c'])
  })
})
