/**
 * Environment variable normalization tests
 *
 * Validates the env normalization logic used in api/index.js and
 * scripts/normalize-env.sh to map Supabase Vercel Integration
 * prefixed/suffixed env var names to their standard equivalents.
 */

describe('env var normalization', () => {
  // Mirror the normalization logic from api/index.js
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
      // Prefix convention: LABEL_VARNAME
      const prefixed = `${label}_${name}`
      if (result[prefixed]) { result[name] = result[prefixed]; continue }
      // Suffix convention: VARNAME_LABEL
      const suffixed = `${name}_${label}`
      if (result[suffixed]) { result[name] = result[suffixed] }
    }
    return result
  }

  describe('prefix convention (LABEL_VARNAME)', () => {
    it('copies COVERGUARD_2_POSTGRES_URL to POSTGRES_URL', () => {
      const env = normalize({ COVERGUARD_2_POSTGRES_URL: 'pg://host/db' })
      expect(env.POSTGRES_URL).toBe('pg://host/db')
    })

    it('copies COVERGUARD_2_SUPABASE_URL to SUPABASE_URL', () => {
      const env = normalize({ COVERGUARD_2_SUPABASE_URL: 'https://test.supabase.co' })
      expect(env.SUPABASE_URL).toBe('https://test.supabase.co')
    })

    it('copies COVERGUARD_2_SUPABASE_SERVICE_ROLE_KEY to SUPABASE_SERVICE_ROLE_KEY', () => {
      const env = normalize({ COVERGUARD_2_SUPABASE_SERVICE_ROLE_KEY: 'srv-key' })
      expect(env.SUPABASE_SERVICE_ROLE_KEY).toBe('srv-key')
    })

    it('copies COVERGUARD_2_SUPABASE_ANON_KEY to SUPABASE_ANON_KEY', () => {
      const env = normalize({ COVERGUARD_2_SUPABASE_ANON_KEY: 'anon-key' })
      expect(env.SUPABASE_ANON_KEY).toBe('anon-key')
    })

    it('copies COVERGUARD_2_DATABASE_URL to DATABASE_URL', () => {
      const env = normalize({ COVERGUARD_2_DATABASE_URL: 'pg://direct' })
      expect(env.DATABASE_URL).toBe('pg://direct')
    })

    it('copies COVERGUARD_2_POSTGRES_PRISMA_URL to POSTGRES_PRISMA_URL', () => {
      const env = normalize({ COVERGUARD_2_POSTGRES_PRISMA_URL: 'pg://prisma' })
      expect(env.POSTGRES_PRISMA_URL).toBe('pg://prisma')
    })

    it('copies COVERGUARD_2_DIRECT_URL to DIRECT_URL', () => {
      const env = normalize({ COVERGUARD_2_DIRECT_URL: 'pg://direct' })
      expect(env.DIRECT_URL).toBe('pg://direct')
    })

    it('copies all prefixed vars in one pass', () => {
      const env = normalize({
        COVERGUARD_2_POSTGRES_URL: 'pg://pooled',
        COVERGUARD_2_SUPABASE_URL: 'https://sb.co',
        COVERGUARD_2_SUPABASE_ANON_KEY: 'anon',
        COVERGUARD_2_SUPABASE_SERVICE_ROLE_KEY: 'srv',
      })
      expect(env.POSTGRES_URL).toBe('pg://pooled')
      expect(env.SUPABASE_URL).toBe('https://sb.co')
      expect(env.SUPABASE_ANON_KEY).toBe('anon')
      expect(env.SUPABASE_SERVICE_ROLE_KEY).toBe('srv')
    })
  })

  describe('suffix convention (VARNAME_LABEL) as fallback', () => {
    it('copies POSTGRES_URL_COVERGUARD_2 to POSTGRES_URL', () => {
      const env = normalize({ POSTGRES_URL_COVERGUARD_2: 'pg://suffix' })
      expect(env.POSTGRES_URL).toBe('pg://suffix')
    })

    it('copies SUPABASE_URL_COVERGUARD_2 to SUPABASE_URL', () => {
      const env = normalize({ SUPABASE_URL_COVERGUARD_2: 'https://suffix.supabase.co' })
      expect(env.SUPABASE_URL).toBe('https://suffix.supabase.co')
    })
  })

  describe('precedence', () => {
    it('does not overwrite existing standard var', () => {
      const env = normalize({
        POSTGRES_URL: 'pg://existing',
        COVERGUARD_2_POSTGRES_URL: 'pg://prefixed',
      })
      expect(env.POSTGRES_URL).toBe('pg://existing')
    })

    it('prefix takes precedence over suffix', () => {
      const env = normalize({
        COVERGUARD_2_POSTGRES_URL: 'pg://prefixed',
        POSTGRES_URL_COVERGUARD_2: 'pg://suffixed',
      })
      expect(env.POSTGRES_URL).toBe('pg://prefixed')
    })

    it('falls back to suffix when prefix is absent', () => {
      const env = normalize({
        POSTGRES_URL_COVERGUARD_2: 'pg://suffixed',
      })
      expect(env.POSTGRES_URL).toBe('pg://suffixed')
    })
  })

  describe('custom label', () => {
    it('uses custom label for prefix lookup', () => {
      const env = normalize({ MY_DB_POSTGRES_URL: 'pg://custom' }, 'MY_DB')
      expect(env.POSTGRES_URL).toBe('pg://custom')
    })

    it('uses custom label for suffix lookup', () => {
      const env = normalize({ POSTGRES_URL_MY_DB: 'pg://custom-suf' }, 'MY_DB')
      expect(env.POSTGRES_URL).toBe('pg://custom-suf')
    })
  })

  describe('no-op when nothing to normalize', () => {
    it('leaves env unchanged when all standard vars are set', () => {
      const original = {
        DATABASE_URL: 'pg://x',
        POSTGRES_URL: 'pg://y',
        SUPABASE_URL: 'https://x',
        SUPABASE_ANON_KEY: 'anon',
        SUPABASE_SERVICE_ROLE_KEY: 'srv',
      }
      const env = normalize({ ...original })
      expect(env.DATABASE_URL).toBe('pg://x')
      expect(env.POSTGRES_URL).toBe('pg://y')
    })

    it('leaves env unchanged when no prefixed or suffixed vars exist', () => {
      const env = normalize({})
      expect(env.POSTGRES_URL).toBeUndefined()
      expect(env.SUPABASE_URL).toBeUndefined()
    })
  })
})
