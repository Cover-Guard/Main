/**
 * Tests for apps/api/src/integrations/propertyData.ts
 */

jest.mock('../../utils/logger', () => ({
  logger: { error: jest.fn(), warn: jest.fn(), info: jest.fn(), debug: jest.fn() },
}))

const mockFetch = jest.fn() as jest.Mock
global.fetch = mockFetch

import { searchPropertiesByAddress, fetchPropertyById } from '../../integrations/propertyData'
import type { Property, PropertySearchResult } from '@coverguard/shared'

describe('propertyData integration', () => {
  const originalEnv = process.env

  beforeEach(() => {
    jest.resetModules()
    mockFetch.mockReset()
    process.env = { ...originalEnv }
    delete process.env.ATTOM_API_KEY
  })

  afterEach(() => {
    process.env = originalEnv
  })

  // ─── searchPropertiesByAddress (no ATTOM key - mock data path) ──────────────

  describe('searchPropertiesByAddress (mock data path)', () => {
    it('returns mock results for zip-code search matching Austin TX', async () => {
      const result = await searchPropertiesByAddress({ zip: '78701' })

      expect(result.properties.length).toBeGreaterThan(0)
      expect(result.total).toBeGreaterThan(0)
      // All returned properties matching zip 78701 should be Austin, TX
      const austinMatches = result.properties.filter(
        (p) => p.city === 'Austin' && p.state === 'TX',
      )
      expect(austinMatches.length).toBeGreaterThan(0)
    })

    it('returns mock results for city search (Miami)', async () => {
      const result = await searchPropertiesByAddress({ city: 'Miami' })

      expect(result.properties.length).toBeGreaterThan(0)
      const miamiProperties = result.properties.filter((p) => p.city === 'Miami')
      expect(miamiProperties.length).toBeGreaterThan(0)
    })

    it('returns mock results for state search (CA)', async () => {
      const result = await searchPropertiesByAddress({ state: 'CA' })

      expect(result.properties.length).toBeGreaterThan(0)
      const caProperties = result.properties.filter((p) => p.state === 'CA')
      expect(caProperties.length).toBeGreaterThan(0)
    })

    it('returns mock results for address search', async () => {
      const result = await searchPropertiesByAddress({ address: '123 Main Street' })

      expect(result.properties.length).toBeGreaterThan(0)
      const mainStreet = result.properties.find((p) => p.address === '123 Main Street')
      expect(mainStreet).toBeDefined()
    })

    it('returns diverse results when no match (hash-based fallback)', async () => {
      const result = await searchPropertiesByAddress({ address: 'zzzz no match nowhere' })

      // Should still return results via hash fallback
      expect(result.properties.length).toBeGreaterThan(0)
      expect(result.properties.length).toBeLessThanOrEqual(5)
    })

    it('respects pagination (page, limit)', async () => {
      // Get all results first
      const allResults = await searchPropertiesByAddress({ state: 'TX' })
      const totalTX = allResults.total

      // Page 1 with limit 2
      const page1 = await searchPropertiesByAddress({ state: 'TX', page: 1, limit: 2 })
      expect(page1.properties.length).toBeLessThanOrEqual(2)
      expect(page1.page).toBe(1)
      expect(page1.limit).toBe(2)
      expect(page1.total).toBe(totalTX)

      // Page 2 with limit 2
      const page2 = await searchPropertiesByAddress({ state: 'TX', page: 2, limit: 2 })
      expect(page2.page).toBe(2)

      // Pages should have different results if enough data
      if (totalTX > 2) {
        expect(page2.properties.length).toBeGreaterThan(0)
        expect(page2.properties[0]?.id).not.toBe(page1.properties[0]?.id)
      }
    })

    it('returns deterministic results (same query returns same results)', async () => {
      const result1 = await searchPropertiesByAddress({ zip: '78701' })
      const result2 = await searchPropertiesByAddress({ zip: '78701' })

      expect(result1.properties.map((p) => p.id)).toEqual(result2.properties.map((p) => p.id))
      expect(result1.total).toBe(result2.total)
    })
  })

  // ─── searchPropertiesByAddress (with ATTOM key) ─────────────────────────────

  describe('searchPropertiesByAddress (with ATTOM key)', () => {
    beforeEach(() => {
      process.env.ATTOM_API_KEY = 'test-attom-key'
    })

    it('calls ATTOM API with correct params', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          property: [
            {
              identifier: { attomId: 'att-1', apn: '123-456' },
              address: {
                line1: '100 Test Ave',
                locality: 'Austin',
                countrySubd: 'TX',
                postal1: '78701',
                oneLine: '100 Test Ave, Austin TX 78701',
              },
              location: { latitude: '30.2672', longitude: '-97.7431', county: 'Travis' },
              summary: { proptype: 'SFR', yearbuilt: 2005, propLandUse: 'SFR' },
              building: { size: { universalsize: 2000 }, rooms: { beds: 3, bathstotal: 2 } },
              lot: { lotsize1: 7000 },
              assessment: { assessed: { assdttlvalue: 500000 } },
              sale: { saleamt: 450000, salesearchdate: '2022-06-01' },
            },
          ],
        }),
      })

      const result = await searchPropertiesByAddress({ address: '100 Test Ave', city: 'Austin', state: 'TX' })

      expect(mockFetch).toHaveBeenCalledTimes(1)
      const calledUrl = mockFetch.mock.calls[0][0] as string
      expect(calledUrl).toContain('attomdata.com')
      expect(calledUrl).toContain('basicprofile')

      const fetchOptions = mockFetch.mock.calls[0][1] as RequestInit
      expect(fetchOptions.headers).toEqual(
        expect.objectContaining({ apikey: 'test-attom-key' }),
      )

      expect(result.properties.length).toBe(1)
      expect(result.properties[0].address).toBe('100 Test Ave')
      expect(result.properties[0].city).toBe('Austin')
    })

    it('returns empty result when API returns no properties', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ property: [] }),
      })

      const result = await searchPropertiesByAddress({ address: 'Nowhere' })

      expect(result.properties).toEqual([])
      expect(result.total).toBe(0)
    })

    it('returns empty result when fetchAttom returns null on HTTP error', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
      })

      const result = await searchPropertiesByAddress({ address: '100 Test Ave' })

      expect(result.properties).toEqual([])
      expect(result.total).toBe(0)
    })
  })

  // ─── fetchPropertyById ─────────────────────────────────────────────────────

  describe('fetchPropertyById', () => {
    it('returns null when no ATTOM key', async () => {
      const result = await fetchPropertyById('some-id')
      expect(result).toBeNull()
      expect(mockFetch).not.toHaveBeenCalled()
    })

    it('returns mapped property when ATTOM returns data', async () => {
      process.env.ATTOM_API_KEY = 'test-attom-key'

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          property: [
            {
              identifier: { attomId: 'att-99', apn: '999-000' },
              address: {
                line1: '500 Fetch Blvd',
                locality: 'Houston',
                countrySubd: 'TX',
                postal1: '77002',
                oneLine: '500 Fetch Blvd, Houston TX 77002',
              },
              location: { latitude: '29.7604', longitude: '-95.3698', county: 'Harris' },
              summary: { proptype: 'SFR', yearbuilt: 1990, propLandUse: 'SFR' },
              building: { size: { universalsize: 2200 }, rooms: { beds: 4, bathstotal: 2 } },
              lot: { lotsize1: 8000 },
              assessment: { assessed: { assdttlvalue: 400000 } },
              sale: { saleamt: 375000, salesearchdate: '2020-11-10' },
            },
          ],
        }),
      })

      const result = await fetchPropertyById('att-99')

      expect(result).not.toBeNull()
      expect(result!.id).toBe('att-99')
      expect(result!.address).toBe('500 Fetch Blvd')
      expect(result!.city).toBe('Houston')
      expect(result!.state).toBe('TX')
      expect(result!.zip).toBe('77002')
      expect(result!.county).toBe('Harris')
      expect(result!.lat).toBe(29.7604)
      expect(result!.lng).toBe(-95.3698)
      expect(result!.propertyType).toBe('SINGLE_FAMILY')
      expect(result!.yearBuilt).toBe(1990)
      expect(result!.squareFeet).toBe(2200)
      expect(result!.bedrooms).toBe(4)
      expect(result!.bathrooms).toBe(2)
      expect(result!.lotSize).toBe(8000)
      expect(result!.estimatedValue).toBe(400000)
      expect(result!.lastSalePrice).toBe(375000)
      expect(result!.lastSaleDate).toBe('2020-11-10')
      expect(result!.parcelId).toBe('999-000')
      expect(result!.createdAt).toBeDefined()
      expect(result!.updatedAt).toBeDefined()
    })
  })

  // ─── Mock data structure ──────────────────────────────────────────────────

  describe('mock data structure', () => {
    it('each mock property has all required Property fields', async () => {
      // Search broadly to get many mock results
      const result = await searchPropertiesByAddress({ state: 'TX' })

      for (const prop of result.properties) {
        expect(prop.id).toBeDefined()
        expect(typeof prop.address).toBe('string')
        expect(typeof prop.city).toBe('string')
        expect(typeof prop.state).toBe('string')
        expect(typeof prop.zip).toBe('string')
        expect(typeof prop.county).toBe('string')
        expect(typeof prop.lat).toBe('number')
        expect(typeof prop.lng).toBe('number')
        expect(prop.propertyType).toBeDefined()
        expect(prop.createdAt).toBeDefined()
        expect(prop.updatedAt).toBeDefined()
        // Nullable fields should be defined (even if null)
        expect(prop).toHaveProperty('yearBuilt')
        expect(prop).toHaveProperty('squareFeet')
        expect(prop).toHaveProperty('bedrooms')
        expect(prop).toHaveProperty('bathrooms')
        expect(prop).toHaveProperty('lotSize')
        expect(prop).toHaveProperty('estimatedValue')
        expect(prop).toHaveProperty('lastSalePrice')
        expect(prop).toHaveProperty('lastSaleDate')
        expect(prop).toHaveProperty('parcelId')
      }
    })

    it('mock property IDs follow "mock-N" pattern', async () => {
      const result = await searchPropertiesByAddress({ city: 'Austin' })

      for (const prop of result.properties) {
        expect(prop.id).toMatch(/^mock-\d+$/)
      }
    })
  })
})
