import { LRUCache, RequestDeduplicator } from '../../utils/cache'

describe('LRUCache', () => {
  beforeEach(() => {
    jest.useFakeTimers()
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  describe('get / set', () => {
    it('returns undefined for missing key', () => {
      const cache = new LRUCache<string>(10, 1000)
      expect(cache.get('missing')).toBeUndefined()
    })

    it('returns stored value', () => {
      const cache = new LRUCache<string>(10, 60_000)
      cache.set('key', 'value')
      expect(cache.get('key')).toBe('value')
    })

    it('returns undefined after TTL expires', () => {
      const cache = new LRUCache<string>(10, 1_000)
      cache.set('key', 'value')
      jest.advanceTimersByTime(1_001)
      expect(cache.get('key')).toBeUndefined()
    })

    it('uses per-entry TTL override when provided', () => {
      const cache = new LRUCache<string>(10, 60_000)
      cache.set('key', 'value', 500)
      jest.advanceTimersByTime(501)
      expect(cache.get('key')).toBeUndefined()
    })

    it('overwrites existing key on set', () => {
      const cache = new LRUCache<string>(10, 60_000)
      cache.set('key', 'v1')
      cache.set('key', 'v2')
      expect(cache.get('key')).toBe('v2')
      expect(cache.size).toBe(1)
    })
  })

  describe('has', () => {
    it('returns false for expired entry', () => {
      const cache = new LRUCache<number>(10, 500)
      cache.set('k', 1)
      jest.advanceTimersByTime(501)
      expect(cache.has('k')).toBe(false)
    })

    it('returns true for valid entry', () => {
      const cache = new LRUCache<number>(10, 60_000)
      cache.set('k', 42)
      expect(cache.has('k')).toBe(true)
    })
  })

  describe('delete', () => {
    it('removes an entry', () => {
      const cache = new LRUCache<string>(10, 60_000)
      cache.set('a', 'hello')
      cache.delete('a')
      expect(cache.get('a')).toBeUndefined()
    })
  })

  describe('LRU eviction', () => {
    it('evicts the oldest entry when capacity is reached', () => {
      const cache = new LRUCache<number>(3, 60_000)
      cache.set('a', 1)
      cache.set('b', 2)
      cache.set('c', 3)
      // Access 'a' to mark it as recently used
      cache.get('a')
      // Insert 'd' — should evict 'b' (oldest not recently accessed)
      cache.set('d', 4)
      expect(cache.get('b')).toBeUndefined()
      expect(cache.get('a')).toBe(1)
      expect(cache.get('c')).toBe(3)
      expect(cache.get('d')).toBe(4)
    })

    it('size reflects number of live entries', () => {
      const cache = new LRUCache<number>(5, 60_000)
      cache.set('x', 1)
      cache.set('y', 2)
      expect(cache.size).toBe(2)
      cache.delete('x')
      expect(cache.size).toBe(1)
    })
  })
})

describe('RequestDeduplicator', () => {
  it('returns the result of the function', async () => {
    const ded = new RequestDeduplicator<number>()
    const result = await ded.dedupe('key', async () => 42)
    expect(result).toBe(42)
  })

  it('deduplicates concurrent calls for the same key', async () => {
    const ded = new RequestDeduplicator<number>()
    let callCount = 0
    const fn = () =>
      new Promise<number>((resolve) => {
        callCount++
        setTimeout(() => resolve(callCount), 10)
      })

    const [r1, r2] = await Promise.all([ded.dedupe('k', fn), ded.dedupe('k', fn)])
    // Both calls should share the same underlying promise → callCount = 1
    expect(callCount).toBe(1)
    expect(r1).toBe(r2)
  })

  it('allows separate calls after the first resolves', async () => {
    const ded = new RequestDeduplicator<number>()
    let callCount = 0
    const fn = async () => {
      callCount++
      return callCount
    }
    const r1 = await ded.dedupe('k', fn)
    const r2 = await ded.dedupe('k', fn)
    expect(callCount).toBe(2)
    expect(r1).toBe(1)
    expect(r2).toBe(2)
  })

  it('cleans up in-flight entry after rejection', async () => {
    const ded = new RequestDeduplicator<number>()
    let callCount = 0
    const failFn = async () => {
      callCount++
      throw new Error('oops')
    }

    await expect(ded.dedupe('k', failFn)).rejects.toThrow('oops')
    // After rejection the entry is cleaned up, next call runs the fn again
    await expect(ded.dedupe('k', failFn)).rejects.toThrow('oops')
    expect(callCount).toBe(2)
  })
})
