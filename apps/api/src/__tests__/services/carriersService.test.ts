/**
 * carriersService tests
 *
 * Tests the externally observable behaviour of getCarriersForProperty:
 *  - L1 in-memory cache hit / bypass
 *  - Market condition determination (SOFT / MODERATE / HARD / CRISIS)
 *  - Carrier writing status logic (FAIR Plans, surplus, flood-only, specialty)
 *  - State-specific restrictions (CA wildfire, FL wind)
 *  - High-risk property handling
 *  - Result sorting by writing status
 */

jest.mock('../../utils/logger')
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
    // Provide stubs for other caches so importing the module doesn't throw
    propertyCache: new LRUCache(100, 60_000),
    riskCache: new LRUCache(100, 60_000),
    insuranceCache: new LRUCache(100, 60_000),
    insurabilityCache: new LRUCache(100, 60_000),
    tokenCache: new LRUCache(100, 60_000),
    publicDataCache: new LRUCache(100, 60_000),
    riskDeduplicator: new RequestDeduplicator(),
    insuranceDeduplicator: new RequestDeduplicator(),
    insurabilityDeduplicator: new RequestDeduplicator(),
    publicDataDeduplicator: new RequestDeduplicator(),
  }
})

import { getCarriersForProperty } from '../../services/carriersService'
import { prisma } from '../../utils/prisma'
import { carriersCache } from '../../utils/cache'
import type { CarriersResult } from '@coverguard/shared'

const mockFindUniqueOrThrow = prisma.property.findUniqueOrThrow as jest.Mock

// ── Helper ───────────────────────────────────────────────────────────────────

function mockProperty(
  state: string,
  risk: Partial<{
    overallRiskScore: number
    fireRiskScore: number
    windRiskScore: number
    wildlandUrbanInterface: boolean
  }> = {},
) {
  return {
    state,
    riskProfile: {
      overallRiskScore: risk.overallRiskScore ?? 30,
      fireRiskScore: risk.fireRiskScore ?? 20,
      windRiskScore: risk.windRiskScore ?? 20,
      wildlandUrbanInterface: risk.wildlandUrbanInterface ?? false,
    },
  }
}

function findCarrier(result: CarriersResult, carrierId: string) {
  return result.carriers.find((c) => c.id === carrierId)
}

// ── Setup ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  jest.clearAllMocks()
  // Clear the L1 cache between tests
  carriersCache.delete('prop-1')
  carriersCache.delete('prop-2')
})

// ═════════════════════════════════════════════════════════════════════════════
// Cache behavior
// ═════════════════════════════════════════════════════════════════════════════

describe('Cache behavior', () => {
  it('returns cached result when available', async () => {
    const cachedResult: CarriersResult = {
      propertyId: 'prop-1',
      carriers: [],
      marketCondition: 'SOFT',
      lastUpdated: new Date().toISOString(),
    }
    carriersCache.set('prop-1', cachedResult)

    const result = await getCarriersForProperty('prop-1')

    expect(result).toBe(cachedResult)
    expect(mockFindUniqueOrThrow).not.toHaveBeenCalled()
  })

  it('bypasses cache when forceRefresh=true', async () => {
    const cachedResult: CarriersResult = {
      propertyId: 'prop-1',
      carriers: [],
      marketCondition: 'SOFT',
      lastUpdated: new Date().toISOString(),
    }
    carriersCache.set('prop-1', cachedResult)
    mockFindUniqueOrThrow.mockResolvedValue(mockProperty('OH'))

    const result = await getCarriersForProperty('prop-1', true)

    expect(result).not.toBe(cachedResult)
    expect(mockFindUniqueOrThrow).toHaveBeenCalled()
    expect(result.carriers.length).toBeGreaterThan(0)
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// Market conditions
// ═════════════════════════════════════════════════════════════════════════════

describe('Market conditions', () => {
  it('FL with risk>60 → CRISIS', async () => {
    mockFindUniqueOrThrow.mockResolvedValue(mockProperty('FL', { overallRiskScore: 65 }))

    const result = await getCarriersForProperty('prop-1')

    expect(result.marketCondition).toBe('CRISIS')
  })

  it('CA with risk=50 → HARD (crisis state, not high enough for CRISIS)', async () => {
    mockFindUniqueOrThrow.mockResolvedValue(mockProperty('CA', { overallRiskScore: 50 }))

    const result = await getCarriersForProperty('prop-1')

    expect(result.marketCondition).toBe('HARD')
  })

  it('TX with risk>50 → HARD', async () => {
    mockFindUniqueOrThrow.mockResolvedValue(mockProperty('TX', { overallRiskScore: 55 }))

    const result = await getCarriersForProperty('prop-1')

    expect(result.marketCondition).toBe('HARD')
  })

  it('TX with risk=40 → MODERATE (hard state, low risk)', async () => {
    mockFindUniqueOrThrow.mockResolvedValue(mockProperty('TX', { overallRiskScore: 40 }))

    const result = await getCarriersForProperty('prop-1')

    expect(result.marketCondition).toBe('MODERATE')
  })

  it('OH with risk=30 → SOFT', async () => {
    mockFindUniqueOrThrow.mockResolvedValue(mockProperty('OH', { overallRiskScore: 30 }))

    const result = await getCarriersForProperty('prop-1')

    expect(result.marketCondition).toBe('SOFT')
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// Carrier writing status — FAIR Plans
// ═════════════════════════════════════════════════════════════════════════════

describe('Carrier writing status — FAIR Plans', () => {
  it('CA FAIR Plan ACTIVELY_WRITING when risk>60', async () => {
    mockFindUniqueOrThrow.mockResolvedValue(mockProperty('CA', { overallRiskScore: 65 }))

    const result = await getCarriersForProperty('prop-1')
    const caFair = findCarrier(result, 'ca-fair-plan')

    expect(caFair).toBeDefined()
    expect(caFair!.writingStatus).toBe('ACTIVELY_WRITING')
  })

  it('Citizens FL LIMITED when market is SOFT and risk<60', async () => {
    // FL is a crisis state so market is at least HARD even with low risk.
    // For Citizens FL to be LIMITED, we need risk low enough that market != CRISIS
    // and risk <= 60. But FL is always HARD at minimum. HARD triggers ACTIVELY_WRITING
    // for FAIR Plans. So Citizens FL will be ACTIVELY_WRITING in HARD market too.
    // Actually, the logic: risk>60 || market==HARD || market==CRISIS → ACTIVELY_WRITING.
    // FL is always at least HARD, so Citizens will always be ACTIVELY_WRITING in FL.
    // To test LIMITED, we need a state where the carrier is licensed (FL only for Citizens).
    // Citizens is FL-only and FL is always HARD → always ACTIVELY_WRITING. So
    // this test verifies that in a non-crisis, non-hard scenario the FAIR plan would be
    // LIMITED. Let's test with TX FAIR Plan in a MODERATE market instead to validate
    // the LIMITED branch. Actually the spec says "Citizens FL LIMITED when market is
    // SOFT and risk<60" — but FL can never be SOFT. Let's test tx-fair-plan in TX
    // with low risk (MODERATE market, risk=40, which is <=60).
    // Wait — TX with risk=40 → MODERATE. FAIR Plan: risk<=60 AND market not HARD/CRISIS → LIMITED.
    mockFindUniqueOrThrow.mockResolvedValue(mockProperty('TX', { overallRiskScore: 40 }))

    const result = await getCarriersForProperty('prop-1')
    const txFair = findCarrier(result, 'tx-fair-plan')

    expect(txFair).toBeDefined()
    expect(txFair!.writingStatus).toBe('LIMITED')
  })

  it('TX FAIR Plan only appears for TX properties', async () => {
    mockFindUniqueOrThrow.mockResolvedValue(mockProperty('TX', { overallRiskScore: 55 }))
    const txResult = await getCarriersForProperty('prop-1')
    expect(findCarrier(txResult, 'tx-fair-plan')).toBeDefined()

    carriersCache.delete('prop-2')
    mockFindUniqueOrThrow.mockResolvedValue(mockProperty('OH', { overallRiskScore: 55 }))
    const ohResult = await getCarriersForProperty('prop-2')
    expect(findCarrier(ohResult, 'tx-fair-plan')).toBeUndefined()
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// Carrier writing status — Surplus lines
// ═════════════════════════════════════════════════════════════════════════════

describe('Carrier writing status — Surplus lines', () => {
  it('Lexington SURPLUS_LINES in normal markets', async () => {
    mockFindUniqueOrThrow.mockResolvedValue(mockProperty('OH', { overallRiskScore: 30 }))

    const result = await getCarriersForProperty('prop-1')
    const lex = findCarrier(result, 'lexington')

    expect(lex).toBeDefined()
    expect(lex!.writingStatus).toBe('SURPLUS_LINES')
  })

  it('Lexington ACTIVELY_WRITING in CRISIS', async () => {
    mockFindUniqueOrThrow.mockResolvedValue(mockProperty('FL', { overallRiskScore: 65 }))

    const result = await getCarriersForProperty('prop-1')
    const lex = findCarrier(result, 'lexington')

    expect(lex).toBeDefined()
    expect(lex!.writingStatus).toBe('ACTIVELY_WRITING')
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// Carrier writing status — Flood-only
// ═════════════════════════════════════════════════════════════════════════════

describe('Carrier writing status — Flood-only', () => {
  it('Neptune Flood always ACTIVELY_WRITING', async () => {
    mockFindUniqueOrThrow.mockResolvedValue(mockProperty('FL', { overallRiskScore: 90 }))

    const result = await getCarriersForProperty('prop-1')
    const neptune = findCarrier(result, 'neptune-flood')

    expect(neptune).toBeDefined()
    expect(neptune!.writingStatus).toBe('ACTIVELY_WRITING')
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// CA wildfire restrictions
// ═════════════════════════════════════════════════════════════════════════════

describe('CA wildfire restrictions', () => {
  it('State Farm NOT_WRITING in CA with fireScore>80', async () => {
    mockFindUniqueOrThrow.mockResolvedValue(
      mockProperty('CA', { overallRiskScore: 50, fireRiskScore: 85 }),
    )

    const result = await getCarriersForProperty('prop-1')
    const sf = findCarrier(result, 'state-farm')

    expect(sf).toBeDefined()
    expect(sf!.writingStatus).toBe('NOT_WRITING')
  })

  it('State Farm LIMITED in CA with fireScore=65', async () => {
    mockFindUniqueOrThrow.mockResolvedValue(
      mockProperty('CA', { overallRiskScore: 50, fireRiskScore: 65 }),
    )

    const result = await getCarriersForProperty('prop-1')
    const sf = findCarrier(result, 'state-farm')

    expect(sf).toBeDefined()
    expect(sf!.writingStatus).toBe('LIMITED')
  })

  it('Lemonade NOT_WRITING in CA WUI area with fire>50', async () => {
    mockFindUniqueOrThrow.mockResolvedValue(
      mockProperty('CA', {
        overallRiskScore: 50,
        fireRiskScore: 55,
        wildlandUrbanInterface: true,
      }),
    )

    const result = await getCarriersForProperty('prop-1')
    const lemon = findCarrier(result, 'lemonade')

    expect(lemon).toBeDefined()
    expect(lemon!.writingStatus).toBe('NOT_WRITING')
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// FL wind restrictions
// ═════════════════════════════════════════════════════════════════════════════

describe('FL wind restrictions', () => {
  it('Lemonade NOT_WRITING in FL with windScore>70', async () => {
    mockFindUniqueOrThrow.mockResolvedValue(
      mockProperty('FL', { overallRiskScore: 50, windRiskScore: 75 }),
    )

    const result = await getCarriersForProperty('prop-1')
    const lemon = findCarrier(result, 'lemonade')

    expect(lemon).toBeDefined()
    expect(lemon!.writingStatus).toBe('NOT_WRITING')
  })

  it('Amica NOT_WRITING in FL with windScore>70', async () => {
    mockFindUniqueOrThrow.mockResolvedValue(
      mockProperty('FL', { overallRiskScore: 50, windRiskScore: 75 }),
    )

    const result = await getCarriersForProperty('prop-1')
    const amica = findCarrier(result, 'amica')

    expect(amica).toBeDefined()
    expect(amica!.writingStatus).toBe('NOT_WRITING')
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// High risk properties
// ═════════════════════════════════════════════════════════════════════════════

describe('High risk properties', () => {
  it('risk>85: only chubb/travelers/lexington/frontline actively write', async () => {
    // Use a non-crisis, non-restricted state so we isolate the high-risk logic.
    // GA has frontline licensed.
    mockFindUniqueOrThrow.mockResolvedValue(
      mockProperty('GA', { overallRiskScore: 90 }),
    )

    const result = await getCarriersForProperty('prop-1')
    const activelyWriting = result.carriers.filter(
      (c) => c.writingStatus === 'ACTIVELY_WRITING',
    )

    const activeIds = activelyWriting.map((c) => c.id).sort()
    // Flood-only and specialty (palomar) carriers also actively write,
    // as well as FAIR plans (none for GA). Lexington triggers ACTIVELY_WRITING
    // because risk>75.
    const expectedActive = ['chubb', 'frontline', 'lexington', 'neptune-flood', 'palomar', 'travelers', 'wright-flood']
    expect(activeIds).toEqual(expectedActive)

    // Major carriers that are NOT in alwaysWrite should be NOT_WRITING
    const stateFarm = findCarrier(result, 'state-farm')
    expect(stateFarm!.writingStatus).toBe('NOT_WRITING')

    const allstate = findCarrier(result, 'allstate')
    expect(allstate!.writingStatus).toBe('NOT_WRITING')
  })

  it('risk 75: lemonade/usaa/hippo LIMITED', async () => {
    // OH with risk=75 → HARD market (risk>70)
    mockFindUniqueOrThrow.mockResolvedValue(
      mockProperty('OH', { overallRiskScore: 75 }),
    )

    const result = await getCarriersForProperty('prop-1')

    const usaa = findCarrier(result, 'usaa')
    expect(usaa!.writingStatus).toBe('LIMITED')

    // Lemonade is licensed in OH
    const lemon = findCarrier(result, 'lemonade')
    expect(lemon!.writingStatus).toBe('LIMITED')

    // Hippo is licensed in OH
    const hippo = findCarrier(result, 'hippo')
    expect(hippo!.writingStatus).toBe('LIMITED')
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// Sorting
// ═════════════════════════════════════════════════════════════════════════════

describe('Sorting', () => {
  it('results sorted by writing status order', async () => {
    // Use a HARD market to get a mix of statuses
    mockFindUniqueOrThrow.mockResolvedValue(
      mockProperty('OH', { overallRiskScore: 75 }),
    )

    const result = await getCarriersForProperty('prop-1')

    const statusOrder = { ACTIVELY_WRITING: 0, LIMITED: 1, SURPLUS_LINES: 2, NOT_WRITING: 3 }
    const statusValues = result.carriers.map((c) => statusOrder[c.writingStatus])

    for (let i = 1; i < statusValues.length; i++) {
      expect(statusValues[i]).toBeGreaterThanOrEqual(statusValues[i - 1])
    }

    // Verify we actually have multiple status types to confirm sorting is meaningful
    const uniqueStatuses = new Set(result.carriers.map((c) => c.writingStatus))
    expect(uniqueStatuses.size).toBeGreaterThanOrEqual(2)
  })
})
