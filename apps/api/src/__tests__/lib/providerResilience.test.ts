import {
  withResilience,
  getProviderStats,
  resetProviderResilience,
  TimeoutError,
} from '../../lib/providerResilience'

// Silence the resilience layer's logger; we are testing behaviour, not output.
jest.mock('../../utils/logger', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}))

const FALLBACK = '__fallback__'

beforeEach(() => {
  resetProviderResilience()
})

describe('withResilience', () => {
  it('returns the real value when the call succeeds on the first attempt', async () => {
    const fn = jest.fn().mockResolvedValue('ok')
    const result = await withResilience(fn, { name: 'p1', fallback: FALLBACK })

    expect(result).toBe('ok')
    expect(fn).toHaveBeenCalledTimes(1)
    expect(getProviderStats()['p1']?.successes).toBe(1)
    expect(getProviderStats()['p1']?.failures).toBe(0)
  })

  it('retries a transient failure and returns the eventual value', async () => {
    const fn = jest
      .fn()
      .mockRejectedValueOnce(new Error('fetch failed'))
      .mockResolvedValueOnce('ok')

    const result = await withResilience(fn, {
      name: 'p2',
      fallback: FALLBACK,
      retryBaseMs: 1, // keep the test fast
    })

    expect(result).toBe('ok')
    expect(fn).toHaveBeenCalledTimes(2)
    const stats = getProviderStats()['p2']
    expect(stats?.successes).toBe(1)
    expect(stats?.failures).toBe(1)
    expect(stats?.retriesAttempted).toBe(1)
    expect(stats?.retriesSucceeded).toBe(1)
  })

  it('returns the fallback when all attempts fail', async () => {
    const fn = jest.fn().mockRejectedValue(new Error('boom'))

    const result = await withResilience(fn, {
      name: 'p3',
      fallback: FALLBACK,
      retries: 2,
      retryBaseMs: 1,
    })

    expect(result).toBe(FALLBACK)
    expect(fn).toHaveBeenCalledTimes(3) // 1 + 2 retries
    const stats = getProviderStats()['p3']
    expect(stats?.failures).toBe(3)
    expect(stats?.successes).toBe(0)
  })

  it('does not retry a non-retryable error', async () => {
    const fn = jest.fn().mockRejectedValue(new Error('validation failed'))

    const result = await withResilience(fn, {
      name: 'p4',
      fallback: FALLBACK,
      retries: 3,
      retryBaseMs: 1,
      isRetryable: () => false,
    })

    expect(result).toBe(FALLBACK)
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it('times out a slow call and returns the fallback', async () => {
    // A promise that never resolves on its own — the wall-clock timeout has to
    // be what stops it.
    const fn = jest.fn().mockImplementation(() => new Promise(() => {}))

    const result = await withResilience(fn, {
      name: 'p5',
      fallback: FALLBACK,
      timeoutMs: 20,
      retries: 0,
    })

    expect(result).toBe(FALLBACK)
    expect(getProviderStats()['p5']?.timeouts).toBe(1)
  })

  it('classifies a wall-clock timeout as a TimeoutError', async () => {
    // Capture the rejection observed by isRetryable so the test can assert on it.
    let observedErr: unknown
    const fn = jest.fn().mockImplementation(() => new Promise(() => {}))

    await withResilience(fn, {
      name: 'p6',
      fallback: FALLBACK,
      timeoutMs: 20,
      retries: 0,
      isRetryable: (err) => {
        observedErr = err
        return false
      },
    })

    expect(observedErr).toBeInstanceOf(TimeoutError)
  })
})

describe('circuit breaker', () => {
  it('opens after sustained failures and short-circuits subsequent calls', async () => {
    const fn = jest.fn().mockRejectedValue(new Error('boom'))

    // 10 failing calls is past MIN_CALLS_FOR_OPEN (8) at 100% failure rate.
    for (let i = 0; i < 10; i++) {
      await withResilience(fn, {
        name: 'breaker',
        fallback: FALLBACK,
        retries: 0,
        retryBaseMs: 1,
      })
    }

    const callsBeforeBreakerCheck = fn.mock.calls.length

    // The next call should be skipped entirely.
    const result = await withResilience(fn, {
      name: 'breaker',
      fallback: FALLBACK,
      retries: 0,
    })

    expect(result).toBe(FALLBACK)
    expect(fn).toHaveBeenCalledTimes(callsBeforeBreakerCheck) // not incremented
    const stats = getProviderStats()['breaker']
    expect(stats?.breakerTrips).toBeGreaterThanOrEqual(1)
    expect(stats?.breakerSkips).toBeGreaterThanOrEqual(1)
  })

  it('does not open the breaker if the call volume is below the minimum', async () => {
    const fn = jest.fn().mockRejectedValue(new Error('boom'))

    // 5 failing calls — below MIN_CALLS_FOR_OPEN (8).
    for (let i = 0; i < 5; i++) {
      await withResilience(fn, {
        name: 'low-volume',
        fallback: FALLBACK,
        retries: 0,
        retryBaseMs: 1,
      })
    }

    const stats = getProviderStats()['low-volume']
    expect(stats?.breakerTrips ?? 0).toBe(0)
    expect(stats?.breakerSkips ?? 0).toBe(0)
  })

  it('keeps breakers isolated per provider name', async () => {
    const failing = jest.fn().mockRejectedValue(new Error('boom'))
    const healthy = jest.fn().mockResolvedValue('ok')

    for (let i = 0; i < 10; i++) {
      await withResilience(failing, { name: 'isolate-A', fallback: FALLBACK, retries: 0, retryBaseMs: 1 })
    }

    // Provider B is unaffected — calls still go through.
    const result = await withResilience(healthy, { name: 'isolate-B', fallback: FALLBACK, retries: 0 })
    expect(result).toBe('ok')
    expect(healthy).toHaveBeenCalledTimes(1)

    expect(getProviderStats()['isolate-A']?.breakerTrips ?? 0).toBeGreaterThanOrEqual(1)
    expect(getProviderStats()['isolate-B']?.breakerTrips ?? 0).toBe(0)
  })
})

describe('getProviderStats', () => {
  it('returns an independent snapshot that mutating does not affect internal state', async () => {
    const fn = jest.fn().mockResolvedValue('ok')
    await withResilience(fn, { name: 'snap', fallback: FALLBACK })

    const snap = getProviderStats()
    expect(snap['snap']?.successes).toBe(1)

    // Mutate the snapshot — internal counters must not move.
    snap['snap']!.successes = 999
    expect(getProviderStats()['snap']?.successes).toBe(1)
  })
})
