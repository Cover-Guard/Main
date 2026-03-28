/**
 * carriersService tests
 *
 * We test the externally observable behaviour of getCarriersForProperty:
 *  - L1 in-memory cache hit (no DB call)
 *  - Force refresh bypasses cache
 *  - Market condition determination by state + risk
 *  - Carrier writing status logic (state-specific, FAIR plan, surplus, flood-only, etc.)
 *  - Sorting by writing status
 *  - Cache storage after computation
 *  - Default risk values when riskProfile is null
 *  - Result structure
 */

jest.mock('../../utils/prisma', () => ({
  prisma: {
    property: { findUniqueOrThrow: jest.fn() },
  },
}))
jest.mock('../../utils/cache', () => {
  const { LRUCache, RequestDeduplicator } = jest.requireActual('../../utils/cache')
  return {
    LRUCache,
    RequestDeduplicator,
    carriersCache: new LRUCache(100, 60_000),
    carriersDeduplicator: new RequestDeduplicator(),
    riskCache: new LRUCache(100, 60_000),
    riskDeduplicator: new RequestDeduplicator(),
    propertyCache: new LRUCache(100, 60_000),
    insurabilityCache: new LRUCache(100, 60_000),
    insuranceCache: new LRUCache(100, 60_000),
    insurabilityDeduplicator: new RequestDeduplicator(),
    insuranceDeduplicator: new RequestDeduplicator(),
    tokenCache: new LRUCache(100, 60_000),
  }
})

import { prisma } from '../../utils/prisma'
import { carriersCache } from '../../utils/cache'
import { getCarriersForProperty } from '../../services/carriersService'

const mockFindProperty = prisma.property.findUniqueOrThrow as jest.Mock

const PROP_ID = 'prop-carrier-test'

// ─── Factory ─────────────────────────────────────────────────────────────────

function mockProperty(state: string, riskOverrides: Record<string, unknown> = {}) {
  return {
    id: PROP_ID,
    state,
    riskProfile: {
      overallRiskScore: 30,
      fireRiskScore: 20,
      windRiskScore: 20,
      wildlandUrbanInterface: false,
      ...riskOverrides,
    },
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function findCarrier(result: Awaited<ReturnType<typeof getCarriersForProperty>>, carrierId: string) {
  return result.carriers.find((c) => c.id === carrierId)
}

// ─── Tests ───────────────────────────────────────────────────────────────────

beforeEach(() => {
  jest.clearAllMocks()
  // Clear the L1 cache between tests
  ;(carriersCache as any).map?.clear?.()
  // Fallback: delete known keys
  carriersCache.delete(PROP_ID)
})

describe('carriersService – getCarriersForProperty', () => {
  // ── Cache behaviour ──────────────────────────────────────────────────────

  describe('caching', () => {
    it('returns cached value without DB call on L1 cache hit', async () => {
      const cached = {
        propertyId: PROP_ID,
        carriers: [],
        marketCondition: 'SOFT' as const,
        lastUpdated: new Date().toISOString(),
      }
      carriersCache.set(PROP_ID, cached)

      const result = await getCarriersForProperty(PROP_ID)

      expect(result).toBe(cached)
      expect(mockFindProperty).not.toHaveBeenCalled()
    })

    it('bypasses cache when forceRefresh is true', async () => {
      const cached = {
        propertyId: PROP_ID,
        carriers: [],
        marketCondition: 'SOFT' as const,
        lastUpdated: new Date().toISOString(),
      }
      carriersCache.set(PROP_ID, cached)
      mockFindProperty.mockResolvedValue(mockProperty('OH'))

      const result = await getCarriersForProperty(PROP_ID, true)

      expect(mockFindProperty).toHaveBeenCalled()
      expect(result.carriers.length).toBeGreaterThan(0)
    })

    it('stores result in carriersCache after computation', async () => {
      mockFindProperty.mockResolvedValue(mockProperty('OH'))

      await getCarriersForProperty(PROP_ID)

      expect(carriersCache.get(PROP_ID)).toBeDefined()
      expect(carriersCache.get(PROP_ID)!.propertyId).toBe(PROP_ID)
    })
  })

  // ── Result structure ─────────────────────────────────────────────────────

  describe('result structure', () => {
    it('returns propertyId, carriers array, marketCondition, and lastUpdated', async () => {
      mockFindProperty.mockResolvedValue(mockProperty('NY'))

      const result = await getCarriersForProperty(PROP_ID)

      expect(result).toHaveProperty('propertyId', PROP_ID)
      expect(Array.isArray(result.carriers)).toBe(true)
      expect(result).toHaveProperty('marketCondition')
      expect(result).toHaveProperty('lastUpdated')
      expect(typeof result.lastUpdated).toBe('string')
    })
  })

  // ── Default risk values ──────────────────────────────────────────────────

  describe('default risk values', () => {
    it('uses default scores when riskProfile is null', async () => {
      mockFindProperty.mockResolvedValue({ id: PROP_ID, state: 'OH', riskProfile: null })

      const result = await getCarriersForProperty(PROP_ID)

      // Default overallRiskScore=30 in OH → SOFT market
      expect(result.marketCondition).toBe('SOFT')
      expect(result.carriers.length).toBeGreaterThan(0)
    })
  })

  // ── Market conditions ────────────────────────────────────────────────────

  describe('market conditions', () => {
    it('FL with risk > 60 → CRISIS', async () => {
      mockFindProperty.mockResolvedValue(mockProperty('FL', { overallRiskScore: 65 }))
      const result = await getCarriersForProperty(PROP_ID)
      expect(result.marketCondition).toBe('CRISIS')
    })

    it('FL with risk ≤ 60 → HARD (crisis state)', async () => {
      mockFindProperty.mockResolvedValue(mockProperty('FL', { overallRiskScore: 50 }))
      const result = await getCarriersForProperty(PROP_ID)
      expect(result.marketCondition).toBe('HARD')
    })

    it('TX with risk > 50 → HARD', async () => {
      mockFindProperty.mockResolvedValue(mockProperty('TX', { overallRiskScore: 55 }))
      const result = await getCarriersForProperty(PROP_ID)
      expect(result.marketCondition).toBe('HARD')
    })

    it('TX with risk ≤ 50 → MODERATE (hard state)', async () => {
      mockFindProperty.mockResolvedValue(mockProperty('TX', { overallRiskScore: 40 }))
      const result = await getCarriersForProperty(PROP_ID)
      expect(result.marketCondition).toBe('MODERATE')
    })

    it('normal state with low risk → SOFT', async () => {
      mockFindProperty.mockResolvedValue(mockProperty('OH', { overallRiskScore: 25 }))
      const result = await getCarriersForProperty(PROP_ID)
      expect(result.marketCondition).toBe('SOFT')
    })

    it('any state with risk > 70 → HARD', async () => {
      mockFindProperty.mockResolvedValue(mockProperty('NY', { overallRiskScore: 75 }))
      const result = await getCarriersForProperty(PROP_ID)
      expect(result.marketCondition).toBe('HARD')
    })

    it('LA (crisis state) with risk > 60 → CRISIS', async () => {
      mockFindProperty.mockResolvedValue(mockProperty('LA', { overallRiskScore: 65 }))
      const result = await getCarriersForProperty(PROP_ID)
      expect(result.marketCondition).toBe('CRISIS')
    })

    it('normal state with moderate risk (51-70) → MODERATE', async () => {
      mockFindProperty.mockResolvedValue(mockProperty('NY', { overallRiskScore: 55 }))
      const result = await getCarriersForProperty(PROP_ID)
      expect(result.marketCondition).toBe('MODERATE')
    })
  })

  // ── Carrier writing status ───────────────────────────────────────────────

  describe('carrier writing status', () => {
    it('state-specific carrier (citizens-fl) is NOT_WRITING outside its state', async () => {
      mockFindProperty.mockResolvedValue(mockProperty('TX'))
      const result = await getCarriersForProperty(PROP_ID)
      // citizens-fl is FL-only, should not appear (filtered out) or be NOT_WRITING
      const citizen = findCarrier(result, 'citizens-fl')
      // It should be filtered out entirely since the code filters to licensed states
      expect(citizen).toBeUndefined()
    })

    it('FAIR Plan carrier ACTIVELY_WRITING when risk > 60', async () => {
      mockFindProperty.mockResolvedValue(mockProperty('FL', { overallRiskScore: 65 }))
      const result = await getCarriersForProperty(PROP_ID)
      const citizen = findCarrier(result, 'citizens-fl')
      expect(citizen).toBeDefined()
      expect(citizen!.writingStatus).toBe('ACTIVELY_WRITING')
    })

    it('FAIR Plan carrier ACTIVELY_WRITING when market is HARD', async () => {
      // FL with risk ≤ 60 → HARD market
      mockFindProperty.mockResolvedValue(mockProperty('FL', { overallRiskScore: 40 }))
      const result = await getCarriersForProperty(PROP_ID)
      const citizen = findCarrier(result, 'citizens-fl')
      expect(citizen).toBeDefined()
      expect(citizen!.writingStatus).toBe('ACTIVELY_WRITING')
    })

    it('FAIR Plan carrier LIMITED when risk ≤ 60 and market SOFT/MODERATE', async () => {
      // CA FAIR Plan in a non-crisis scenario — but CA is always at least HARD
      // Use TX FAIR Plan instead: TX with risk ≤ 50 → MODERATE
      mockFindProperty.mockResolvedValue(mockProperty('TX', { overallRiskScore: 30 }))
      const result = await getCarriersForProperty(PROP_ID)
      const txFair = findCarrier(result, 'tx-fair-plan')
      expect(txFair).toBeDefined()
      expect(txFair!.writingStatus).toBe('LIMITED')
    })

    it('Lexington (surplus) returns SURPLUS_LINES normally', async () => {
      mockFindProperty.mockResolvedValue(mockProperty('OH', { overallRiskScore: 30 }))
      const result = await getCarriersForProperty(PROP_ID)
      const lex = findCarrier(result, 'lexington')
      expect(lex).toBeDefined()
      expect(lex!.writingStatus).toBe('SURPLUS_LINES')
    })

    it('Lexington ACTIVELY_WRITING in crisis market', async () => {
      mockFindProperty.mockResolvedValue(mockProperty('FL', { overallRiskScore: 65 }))
      const result = await getCarriersForProperty(PROP_ID)
      const lex = findCarrier(result, 'lexington')
      expect(lex).toBeDefined()
      expect(lex!.writingStatus).toBe('ACTIVELY_WRITING')
    })

    it('Lexington ACTIVELY_WRITING when risk > 75', async () => {
      mockFindProperty.mockResolvedValue(mockProperty('NY', { overallRiskScore: 80 }))
      const result = await getCarriersForProperty(PROP_ID)
      const lex = findCarrier(result, 'lexington')
      expect(lex).toBeDefined()
      expect(lex!.writingStatus).toBe('ACTIVELY_WRITING')
    })

    it('flood-only carriers (neptune-flood, wright-flood) always ACTIVELY_WRITING', async () => {
      mockFindProperty.mockResolvedValue(mockProperty('FL', { overallRiskScore: 90 }))
      const result = await getCarriersForProperty(PROP_ID)
      const neptune = findCarrier(result, 'neptune-flood')
      const wright = findCarrier(result, 'wright-flood')
      expect(neptune!.writingStatus).toBe('ACTIVELY_WRITING')
      expect(wright!.writingStatus).toBe('ACTIVELY_WRITING')
    })

    it('palomar (specialty) always ACTIVELY_WRITING', async () => {
      mockFindProperty.mockResolvedValue(mockProperty('FL', { overallRiskScore: 90 }))
      const result = await getCarriersForProperty(PROP_ID)
      const palomar = findCarrier(result, 'palomar')
      expect(palomar!.writingStatus).toBe('ACTIVELY_WRITING')
    })

    it('major carriers LIMITED in crisis market with risk ≤ 80', async () => {
      mockFindProperty.mockResolvedValue(mockProperty('FL', { overallRiskScore: 65 }))
      const result = await getCarriersForProperty(PROP_ID)
      const sf = findCarrier(result, 'state-farm')
      const allstate = findCarrier(result, 'allstate')
      const nationwide = findCarrier(result, 'nationwide')
      expect(sf!.writingStatus).toBe('LIMITED')
      expect(allstate!.writingStatus).toBe('LIMITED')
      expect(nationwide!.writingStatus).toBe('LIMITED')
    })

    it('major carriers NOT_WRITING in crisis market with risk > 80', async () => {
      mockFindProperty.mockResolvedValue(mockProperty('FL', { overallRiskScore: 85 }))
      const result = await getCarriersForProperty(PROP_ID)
      const sf = findCarrier(result, 'state-farm')
      const allstate = findCarrier(result, 'allstate')
      const nationwide = findCarrier(result, 'nationwide')
      expect(sf!.writingStatus).toBe('NOT_WRITING')
      expect(allstate!.writingStatus).toBe('NOT_WRITING')
      expect(nationwide!.writingStatus).toBe('NOT_WRITING')
    })

    it('CA wildfire: state-farm NOT_WRITING when fire > 80 in CA', async () => {
      mockFindProperty.mockResolvedValue(mockProperty('CA', { overallRiskScore: 50, fireRiskScore: 85 }))
      const result = await getCarriersForProperty(PROP_ID)
      const sf = findCarrier(result, 'state-farm')
      expect(sf!.writingStatus).toBe('NOT_WRITING')
    })

    it('CA wildfire: state-farm LIMITED when fire 60-80 in CA', async () => {
      mockFindProperty.mockResolvedValue(mockProperty('CA', { overallRiskScore: 50, fireRiskScore: 70 }))
      const result = await getCarriersForProperty(PROP_ID)
      const sf = findCarrier(result, 'state-farm')
      expect(sf!.writingStatus).toBe('LIMITED')
    })

    it('FL wind: lemonade NOT_WRITING when wind > 70 in FL', async () => {
      mockFindProperty.mockResolvedValue(mockProperty('FL', { overallRiskScore: 50, windRiskScore: 75 }))
      const result = await getCarriersForProperty(PROP_ID)
      const lemonade = findCarrier(result, 'lemonade')
      expect(lemonade!.writingStatus).toBe('NOT_WRITING')
    })

    it('high risk (> 85): only chubb, travelers, lexington, frontline actively write', async () => {
      mockFindProperty.mockResolvedValue(mockProperty('NY', { overallRiskScore: 90 }))
      const result = await getCarriersForProperty(PROP_ID)

      const alwaysWriteIds = ['chubb', 'travelers', 'lexington', 'frontline']
      for (const carrier of result.carriers) {
        if (alwaysWriteIds.includes(carrier.id)) {
          expect(carrier.writingStatus).toBe('ACTIVELY_WRITING')
        } else if (['neptune-flood', 'wright-flood', 'palomar'].includes(carrier.id)) {
          // Flood-only and specialty carriers also actively write
          expect(carrier.writingStatus).toBe('ACTIVELY_WRITING')
        } else {
          expect(carrier.writingStatus).not.toBe('ACTIVELY_WRITING')
        }
      }
    })

    it('elevated risk (> 70): lemonade, amica, usaa, hippo → LIMITED', async () => {
      // Use NY with risk 75 → HARD market, but not crisis
      mockFindProperty.mockResolvedValue(mockProperty('NY', { overallRiskScore: 75 }))
      const result = await getCarriersForProperty(PROP_ID)

      const limitedIds = ['lemonade', 'amica', 'usaa', 'hippo']
      for (const id of limitedIds) {
        const carrier = findCarrier(result, id)
        // lemonade and hippo may not be licensed in NY — check if present
        if (carrier) {
          expect(carrier.writingStatus).toBe('LIMITED')
        }
      }
      // amica and usaa are ALL-states, so they must be present and LIMITED
      expect(findCarrier(result, 'amica')!.writingStatus).toBe('LIMITED')
      expect(findCarrier(result, 'usaa')!.writingStatus).toBe('LIMITED')
    })
  })

  // ── Sorting ──────────────────────────────────────────────────────────────

  describe('sorting', () => {
    it('carriers sorted by ACTIVELY_WRITING > LIMITED > SURPLUS_LINES > NOT_WRITING', async () => {
      // Use a scenario with mixed statuses: FL crisis with moderate risk
      mockFindProperty.mockResolvedValue(mockProperty('FL', { overallRiskScore: 65 }))
      const result = await getCarriersForProperty(PROP_ID)

      const statusOrder = {
        ACTIVELY_WRITING: 0,
        LIMITED: 1,
        SURPLUS_LINES: 2,
        NOT_WRITING: 3,
      } as const

      for (let i = 1; i < result.carriers.length; i++) {
        const prev = statusOrder[result.carriers[i - 1].writingStatus]
        const curr = statusOrder[result.carriers[i].writingStatus]
        expect(prev).toBeLessThanOrEqual(curr)
      }
    })
  })

  // ── CA wildfire WUI logic ────────────────────────────────────────────────

  describe('CA wildfire WUI', () => {
    it('CA WUI + fire > 50 → state-farm NOT_WRITING', async () => {
      mockFindProperty.mockResolvedValue(
        mockProperty('CA', { overallRiskScore: 50, fireRiskScore: 55, wildlandUrbanInterface: true }),
      )
      const result = await getCarriersForProperty(PROP_ID)
      const sf = findCarrier(result, 'state-farm')
      expect(sf!.writingStatus).toBe('NOT_WRITING')
    })
  })

  // ── State-specific carrier filtering ─────────────────────────────────────

  describe('state-specific carrier filtering', () => {
    it('only includes carriers licensed in the property state', async () => {
      mockFindProperty.mockResolvedValue(mockProperty('OH'))
      const result = await getCarriersForProperty(PROP_ID)

      // OH-specific carriers should not appear (citizens-fl, ca-fair-plan, etc.)
      expect(findCarrier(result, 'citizens-fl')).toBeUndefined()
      expect(findCarrier(result, 'ca-fair-plan')).toBeUndefined()
      expect(findCarrier(result, 'tx-fair-plan')).toBeUndefined()
      expect(findCarrier(result, 'la-citizens')).toBeUndefined()
      expect(findCarrier(result, 'twia')).toBeUndefined()
      expect(findCarrier(result, 'cea')).toBeUndefined()

      // ALL-state carriers should appear
      expect(findCarrier(result, 'state-farm')).toBeDefined()
      expect(findCarrier(result, 'chubb')).toBeDefined()
    })

    it('includes state-specific carrier in its own state', async () => {
      mockFindProperty.mockResolvedValue(mockProperty('FL'))
      const result = await getCarriersForProperty(PROP_ID)
      expect(findCarrier(result, 'citizens-fl')).toBeDefined()
      expect(findCarrier(result, 'frontline')).toBeDefined()
    })
  })
})
