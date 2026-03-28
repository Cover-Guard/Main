jest.mock('../../utils/logger', () => ({
  logger: {
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
    debug: jest.fn(),
  },
}))

const mockFetch = jest.fn() as jest.MockedFunction<typeof global.fetch>
global.fetch = mockFetch

import {
  fetchFloodRisk,
  fetchFireRisk,
  fetchEarthquakeRisk,
  fetchWindRisk,
  fetchCrimeRisk,
} from '../../integrations/riskData'

beforeEach(() => {
  mockFetch.mockReset()
})

// ─── fetchFloodRisk ──────────────────────────────────────────────────────────

describe('fetchFloodRisk', () => {
  it('returns flood zone data from FEMA NFHL', async () => {
    mockFetch.mockImplementation(async (url) => {
      const urlStr = typeof url === 'string' ? url : url instanceof URL ? url.toString() : ''

      if (urlStr.includes('nfhl') || urlStr.includes('NFHL')) {
        return {
          ok: true,
          json: async () => ({
            features: [
              {
                attributes: {
                  FLD_ZONE: 'AE',
                  STATIC_BFE: 12,
                  FIRM_PAN: '12345C0100J',
                },
              },
            ],
          }),
        } as Response
      }

      // Return empty/no-match for other flood enrichment APIs
      return {
        ok: true,
        json: async () => ({ features: [], NfipClaims: [] }),
      } as Response
    })

    const result = await fetchFloodRisk(29.76, -95.37, '77001')

    expect(result.floodZone).toBe('AE')
    expect(result.inSpecialFloodHazardArea).toBe(true)
    expect(result.baseFloodElevation).toBe(12)
    expect(result.firmPanelId).toBe('12345C0100J')
    expect(result.annualChanceOfFlooding).toBe(1.0)
  })

  it('returns defaults on API error', async () => {
    mockFetch.mockRejectedValue(new Error('Network error'))

    const result = await fetchFloodRisk(29.76, -95.37, '77001')

    expect(result.floodZone).toBe('UNKNOWN')
    expect(result.inSpecialFloodHazardArea).toBe(false)
  })

  it('returns defaults for invalid coordinates', async () => {
    const result = await fetchFloodRisk(NaN, -95.37, '77001')

    expect(result.floodZone).toBe('UNKNOWN')
    expect(result.inSpecialFloodHazardArea).toBe(false)
    expect(mockFetch).not.toHaveBeenCalled()
  })
})

// ─── fetchFireRisk ───────────────────────────────────────────────────────────

describe('fetchFireRisk', () => {
  it('returns fire risk data including Cal Fire FHSZ for CA', async () => {
    mockFetch.mockImplementation(async (url) => {
      const urlStr = typeof url === 'string' ? url : url instanceof URL ? url.toString() : ''

      if (urlStr.includes('FHSZ')) {
        return {
          ok: true,
          json: async () => ({
            features: [{ attributes: { HAZ_CLASS: 'VERY HIGH', AGENCY: 'CAL FIRE' } }],
          }),
        } as Response
      }

      // Default empty response for other fire data sources
      return {
        ok: true,
        json: async () => ({ features: [] }),
      } as Response
    })

    const result = await fetchFireRisk(34.05, -118.24, 'CA')

    expect(result.fireHazardSeverityZone).toBe('VERY HIGH')
    expect(result.wildlandUrbanInterface).toBe(true)
  })

  it('returns defaults on API error', async () => {
    mockFetch.mockRejectedValue(new Error('Network error'))

    const result = await fetchFireRisk(34.05, -118.24, 'CA')

    expect(result.fireHazardSeverityZone).toBeNull()
    expect(result.wildlandUrbanInterface).toBe(false)
  })
})

// ─── fetchEarthquakeRisk ─────────────────────────────────────────────────────

describe('fetchEarthquakeRisk', () => {
  it('returns seismic data from USGS Design Maps', async () => {
    mockFetch.mockImplementation(async (url) => {
      const urlStr = typeof url === 'string' ? url : url instanceof URL ? url.toString() : ''

      if (urlStr.includes('designmaps')) {
        return {
          ok: true,
          json: async () => ({
            response: {
              data: { ss: 1.8, s1: 0.6, pga: 0.7, sds: 1.2, sd1: 0.5 },
            },
          }),
        } as Response
      }

      return {
        ok: true,
        json: async () => ({ features: [] }),
      } as Response
    })

    const result = await fetchEarthquakeRisk(34.05, -118.24)

    expect(result.seismicZone).toBe('D')
    expect(result.ss).toBe(1.8)
    expect(result.pga).toBe(0.7)
    expect(result.s1).toBe(0.6)
    expect(result.liquidationPotential).toBe('HIGH')
  })

  it('returns defaults on API error', async () => {
    mockFetch.mockRejectedValue(new Error('Network error'))

    const result = await fetchEarthquakeRisk(34.05, -118.24)

    expect(result.seismicZone).toBeUndefined()
    expect(result.ss).toBeUndefined()
  })
})

// ─── fetchWindRisk ───────────────────────────────────────────────────────────

describe('fetchWindRisk', () => {
  it('returns wind risk data', async () => {
    mockFetch.mockImplementation(async (url) => {
      const urlStr = typeof url === 'string' ? url : url instanceof URL ? url.toString() : ''

      if (urlStr.includes('SLOSH')) {
        return {
          ok: true,
          json: async () => ({
            features: [{ attributes: { CATEG: 3 } }],
          }),
        } as Response
      }

      return {
        ok: true,
        json: async () => ({ features: [] }),
      } as Response
    })

    const result = await fetchWindRisk(25.76, -80.19, 'FL')

    expect(result.hurricaneRisk).toBe(true)
    expect(result.designWindSpeed).toBeGreaterThan(0)
    expect(result.sloshCategory).toBe(3)
  })

  it('returns defaults on API error', async () => {
    mockFetch.mockRejectedValue(new Error('Network error'))

    const result = await fetchWindRisk(25.76, -80.19, 'FL')

    // Even on fetch error, state-based defaults are set before fetching
    expect(result.hurricaneRisk).toBe(true)
    expect(result.designWindSpeed).toBeGreaterThan(0)
    expect(result.sloshCategory).toBeNull()
  })
})

// ─── fetchCrimeRisk ──────────────────────────────────────────────────────────

describe('fetchCrimeRisk', () => {
  it('returns crime data from FBI CDE when API key is set', async () => {
    process.env.FBI_CDE_KEY = 'test-key'

    mockFetch.mockImplementation(async (url) => {
      const urlStr = typeof url === 'string' ? url : url instanceof URL ? url.toString() : ''

      if (urlStr.includes('agencies')) {
        return {
          ok: true,
          json: async () => ({
            results: [{ ori: 'TX0010000' }],
          }),
        } as Response
      }

      if (urlStr.includes('summarized')) {
        return {
          ok: true,
          json: async () => ({
            data: [
              {
                summary: [
                  {
                    year: 2023,
                    violent_crime: 500,
                    property_crime: 3000,
                    population: 100000,
                  },
                ],
              },
            ],
          }),
        } as Response
      }

      return { ok: false } as Response
    })

    const result = await fetchCrimeRisk(29.76, -95.37, '77001')

    expect(result.violentCrimeIndex).toBe(500)
    expect(result.propertyCrimeIndex).toBe(3000)
    expect(result.dataSourceUsed).toBe('FBI_CDE')
    expect(result.nationalAverageDiff).toBeDefined()

    delete process.env.FBI_CDE_KEY
  })

  it('returns defaults on API error', async () => {
    delete process.env.FBI_CDE_KEY

    mockFetch.mockRejectedValue(new Error('Network error'))

    const result = await fetchCrimeRisk(29.76, -95.37, '77001')

    expect(result.dataSourceUsed).toBe('NONE')
  })
})
