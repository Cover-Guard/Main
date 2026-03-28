import {
  RISK_SCORE_THRESHOLDS,
  DEFAULT_SEARCH_RADIUS_MILES,
  DEFAULT_PAGE_LIMIT,
  MAX_SAVED_PROPERTIES,
  RISK_CACHE_TTL_SECONDS,
  INSURANCE_ESTIMATE_CACHE_TTL_SECONDS,
  INSURABILITY_CACHE_TTL_SECONDS,
  CARRIERS_CACHE_TTL_SECONDS,
  US_STATES,
} from '../../constants'

describe('RISK_SCORE_THRESHOLDS', () => {
  it('has ascending thresholds', () => {
    expect(RISK_SCORE_THRESHOLDS.LOW).toBeLessThan(RISK_SCORE_THRESHOLDS.MODERATE)
    expect(RISK_SCORE_THRESHOLDS.MODERATE).toBeLessThan(RISK_SCORE_THRESHOLDS.HIGH)
    expect(RISK_SCORE_THRESHOLDS.HIGH).toBeLessThan(RISK_SCORE_THRESHOLDS.VERY_HIGH)
    expect(RISK_SCORE_THRESHOLDS.VERY_HIGH).toBeLessThan(RISK_SCORE_THRESHOLDS.EXTREME)
  })

  it('EXTREME threshold is 100', () => {
    expect(RISK_SCORE_THRESHOLDS.EXTREME).toBe(100)
  })

  it('LOW threshold is 25', () => {
    expect(RISK_SCORE_THRESHOLDS.LOW).toBe(25)
  })
})

describe('defaults', () => {
  it('DEFAULT_SEARCH_RADIUS_MILES is positive', () => {
    expect(DEFAULT_SEARCH_RADIUS_MILES).toBeGreaterThan(0)
  })

  it('DEFAULT_PAGE_LIMIT is reasonable', () => {
    expect(DEFAULT_PAGE_LIMIT).toBeGreaterThanOrEqual(1)
    expect(DEFAULT_PAGE_LIMIT).toBeLessThanOrEqual(100)
  })

  it('MAX_SAVED_PROPERTIES is 100', () => {
    expect(MAX_SAVED_PROPERTIES).toBe(100)
  })
})

describe('cache TTLs', () => {
  it('all TTLs are positive numbers in seconds', () => {
    expect(RISK_CACHE_TTL_SECONDS).toBeGreaterThan(0)
    expect(INSURANCE_ESTIMATE_CACHE_TTL_SECONDS).toBeGreaterThan(0)
    expect(INSURABILITY_CACHE_TTL_SECONDS).toBeGreaterThan(0)
    expect(CARRIERS_CACHE_TTL_SECONDS).toBeGreaterThan(0)
  })

  it('risk cache TTL is the longest (24h)', () => {
    expect(RISK_CACHE_TTL_SECONDS).toBeGreaterThanOrEqual(INSURANCE_ESTIMATE_CACHE_TTL_SECONDS)
    expect(RISK_CACHE_TTL_SECONDS).toBeGreaterThanOrEqual(CARRIERS_CACHE_TTL_SECONDS)
  })
})

describe('US_STATES', () => {
  it('contains all 50 states plus DC', () => {
    expect(US_STATES).toHaveLength(51)
  })

  it('each entry has code and name', () => {
    for (const state of US_STATES) {
      expect(state.code).toMatch(/^[A-Z]{2}$/)
      expect(state.name.length).toBeGreaterThan(0)
    }
  })

  it('includes California', () => {
    expect(US_STATES.find((s) => s.code === 'CA')).toEqual({ code: 'CA', name: 'California' })
  })

  it('includes DC', () => {
    expect(US_STATES.find((s) => s.code === 'DC')).toBeDefined()
  })

  it('has no duplicate codes', () => {
    const codes = US_STATES.map((s) => s.code)
    expect(new Set(codes).size).toBe(codes.length)
  })
})
