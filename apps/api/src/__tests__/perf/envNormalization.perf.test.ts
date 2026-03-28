/**
 * Performance tests for environment variable normalization
 *
 * Ensures the normalization logic (prefix/suffix lookup) adds
 * negligible overhead to serverless function cold starts.
 */

describe('env normalization performance', () => {
  function normalize(
    env: Record<string, string | undefined>,
    label = 'COVERGUARD_2',
  ): Record<string, string | undefined> {
    const result = { ...env }
    const vars = [
      'DATABASE_URL', 'POSTGRES_URL', 'POSTGRES_PRISMA_URL', 'POSTGRES_URL_NON_POOLED',
      'DIRECT_URL', 'SUPABASE_URL', 'SUPABASE_ANON_KEY', 'SUPABASE_SERVICE_ROLE_KEY',
    ]
    for (const name of vars) {
      if (result[name]) continue
      const prefixed = `${label}_${name}`
      if (result[prefixed]) { result[name] = result[prefixed]; continue }
      const suffixed = `${name}_${label}`
      if (result[suffixed]) { result[name] = result[suffixed] }
    }
    return result
  }

  it('completes 10,000 normalizations in < 100ms', () => {
    const env = {
      COVERGUARD_2_POSTGRES_URL: 'pg://host/db',
      COVERGUARD_2_SUPABASE_URL: 'https://sb.co',
      COVERGUARD_2_SUPABASE_ANON_KEY: 'anon-key',
      COVERGUARD_2_SUPABASE_SERVICE_ROLE_KEY: 'srv-key',
      COVERGUARD_2_DATABASE_URL: 'pg://direct',
    }

    const start = performance.now()
    for (let i = 0; i < 10_000; i++) {
      normalize(env)
    }
    const elapsed = performance.now() - start

    expect(elapsed).toBeLessThan(100)
  })

  it('single normalization takes < 0.1ms', () => {
    const env = {
      COVERGUARD_2_POSTGRES_URL: 'pg://host/db',
      COVERGUARD_2_SUPABASE_URL: 'https://sb.co',
      COVERGUARD_2_SUPABASE_ANON_KEY: 'anon-key',
      COVERGUARD_2_SUPABASE_SERVICE_ROLE_KEY: 'srv-key',
    }

    // Warm up
    for (let i = 0; i < 100; i++) normalize(env)

    const iterations = 1000
    const start = performance.now()
    for (let i = 0; i < iterations; i++) {
      normalize(env)
    }
    const elapsed = performance.now() - start
    const avgMs = elapsed / iterations

    expect(avgMs).toBeLessThan(0.1)
  })

  it('no-op path (all vars already set) is even faster', () => {
    const env = {
      DATABASE_URL: 'pg://x',
      POSTGRES_URL: 'pg://y',
      POSTGRES_PRISMA_URL: 'pg://z',
      POSTGRES_URL_NON_POOLED: 'pg://w',
      DIRECT_URL: 'pg://d',
      SUPABASE_URL: 'https://sb',
      SUPABASE_ANON_KEY: 'anon',
      SUPABASE_SERVICE_ROLE_KEY: 'srv',
    }

    const iterations = 10_000
    const start = performance.now()
    for (let i = 0; i < iterations; i++) {
      normalize(env)
    }
    const elapsed = performance.now() - start

    expect(elapsed).toBeLessThan(50)
  })

  it('worst case (all fallback to suffix) still < 0.1ms per call', () => {
    const env = {
      POSTGRES_URL_COVERGUARD_2: 'pg://y',
      POSTGRES_PRISMA_URL_COVERGUARD_2: 'pg://z',
      POSTGRES_URL_NON_POOLED_COVERGUARD_2: 'pg://w',
      DIRECT_URL_COVERGUARD_2: 'pg://d',
      SUPABASE_URL_COVERGUARD_2: 'https://sb',
      SUPABASE_ANON_KEY_COVERGUARD_2: 'anon',
      SUPABASE_SERVICE_ROLE_KEY_COVERGUARD_2: 'srv',
      DATABASE_URL_COVERGUARD_2: 'pg://x',
    }

    // Warm up
    for (let i = 0; i < 100; i++) normalize(env)

    const iterations = 1000
    const start = performance.now()
    for (let i = 0; i < iterations; i++) {
      normalize(env)
    }
    const elapsed = performance.now() - start
    const avgMs = elapsed / iterations

    expect(avgMs).toBeLessThan(0.1)
  })
})
