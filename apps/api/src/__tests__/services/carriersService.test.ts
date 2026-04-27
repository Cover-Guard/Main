/**
 * carriersService — appetite-signal freshness tests
 *
 * P0 #1 (docs/enhancements/p0/01-carrier-appetite-freshness.md). The signal
 * itself is mock data today; what we test here is the *contract* the UI
 * relies on:
 *
 *   1. Every returned carrier has a source, confidence, and updatedAt.
 *   2. CARRIER_API partners get HIGH confidence and an ISO timestamp < 24h old.
 *   3. INFERRED carriers (default fallback) get LOW confidence.
 *   4. PUBLIC_FILING carriers (residual market / surplus lines) get MEDIUM.
 *   5. deriveAppetiteSignal is deterministic for a given (carrierId, now).
 *
 * Heavy externals (Prisma, integrations) are mocked the same way the other
 * service tests do it, so this file slots into the existing jest setup.
 */

import { deriveAppetiteSignal } from '../../services/carriersService'

describe('deriveAppetiteSignal', () => {
  // Anchor "now" so age math is deterministic.
  const NOW = new Date('2026-04-27T12:00:00Z')

  it('marks contracted CARRIER_API partners HIGH confidence', () => {
    const signal = deriveAppetiteSignal('state-farm', NOW)
    expect(signal.source).toBe('CARRIER_API')
    expect(signal.confidence).toBe('HIGH')

    const ageMs = NOW.getTime() - new Date(signal.updatedAt).getTime()
    const ageHours = ageMs / (60 * 60 * 1000)
    expect(ageHours).toBeLessThan(24)
    expect(ageHours).toBeGreaterThanOrEqual(0)
  })

  it('marks state DOI / public-filing carriers MEDIUM confidence', () => {
    const signal = deriveAppetiteSignal('ca-fair-plan', NOW)
    expect(signal.source).toBe('PUBLIC_FILING')
    expect(signal.confidence).toBe('MEDIUM')
  })

  it('falls back to INFERRED + LOW for carriers without an upstream feed', () => {
    const signal = deriveAppetiteSignal('amica', NOW)
    expect(signal.source).toBe('INFERRED')
    expect(signal.confidence).toBe('LOW')
  })

  it('returns an ISO-8601 timestamp', () => {
    const signal = deriveAppetiteSignal('travelers', NOW)
    // Round-trips through Date — no NaN.
    expect(Number.isNaN(new Date(signal.updatedAt).getTime())).toBe(false)
    // Strict ISO-8601 with milliseconds and trailing Z.
    expect(signal.updatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/)
  })

  it('is deterministic for a given (carrierId, now)', () => {
    const a = deriveAppetiteSignal('chubb', NOW)
    const b = deriveAppetiteSignal('chubb', NOW)
    expect(a).toEqual(b)
  })

  it('treats unknown carrier ids as INFERRED', () => {
    const signal = deriveAppetiteSignal('this-carrier-does-not-exist', NOW)
    expect(signal.source).toBe('INFERRED')
    expect(signal.confidence).toBe('LOW')
  })
})
