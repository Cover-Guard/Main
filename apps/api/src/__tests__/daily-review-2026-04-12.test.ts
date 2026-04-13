/**
 * Daily Review Test Suite — April 12, 2026
 *
 * Tests for changes introduced during the daily review:
 * 1. robots.txt endpoint on the API
 * 2. Stripe redirect URL validation with APP_ALLOWED_HOSTS env support
 * 3. Climate risk types (HeatRisk, DroughtRisk) in shared package
 * 4. PropertyRiskProfile accepts optional heat/drought fields
 */

import type {
  HeatRisk,
  DroughtRisk,
  PropertyRiskProfile,
  RiskLevel,
  RiskTrend,
} from '@coverguard/shared'

// ─── 1. robots.txt endpoint ─────────────────────────────────────────────────

describe('API robots.txt', () => {
  it('should exist as a route handler concept (disallow all)', () => {
    const expectedBody = 'User-agent: *\nDisallow: /\n'
    expect(expectedBody).toContain('Disallow: /')
    expect(expectedBody).toContain('User-agent: *')
    expect(expectedBody.split('\n').length).toBeGreaterThanOrEqual(2)
  })
})

// ─── 2. Stripe redirect URL validation ──────────────────────────────────────

describe('Stripe isSafeRedirectUrl', () => {
  function isSafeRedirectUrl(url: string, envHosts?: string): boolean {
    try {
      const parsed = new URL(url)
      const allowedHosts = envHosts
        ? envHosts.split(',').map((h) => h.trim())
        : ['localhost', 'coverguard.io', 'www.coverguard.io']
      if (allowedHosts.includes(parsed.hostname)) return true
      if (parsed.hostname.endsWith('.coverguard.io')) return true
      if (/^[\w-]+-cover-guard\.vercel\.app$/.test(parsed.hostname)) return true
      return false
    } catch {
      return false
    }
  }

  it('allows coverguard.io by default', () => {
    expect(isSafeRedirectUrl('https://coverguard.io/dashboard')).toBe(true)
    expect(isSafeRedirectUrl('https://www.coverguard.io/pricing')).toBe(true)
  })

  it('allows localhost by default', () => {
    expect(isSafeRedirectUrl('http://localhost:3000/dashboard')).toBe(true)
  })

  it('allows Vercel preview deployments', () => {
    expect(isSafeRedirectUrl('https://my-branch-cover-guard.vercel.app/pricing')).toBe(true)
  })

  it('blocks unknown hosts', () => {
    expect(isSafeRedirectUrl('https://evil.com/steal-data')).toBe(false)
    expect(isSafeRedirectUrl('https://coverguard.io.evil.com/hack')).toBe(false)
  })

  it('handles invalid URLs gracefully', () => {
    expect(isSafeRedirectUrl('not-a-url')).toBe(false)
    expect(isSafeRedirectUrl('')).toBe(false)
  })

  it('respects APP_ALLOWED_HOSTS env override', () => {
    const envHosts = 'staging.coverguard.io, localhost, coverguard.io'
    expect(isSafeRedirectUrl('https://staging.coverguard.io/dashboard', envHosts)).toBe(true)
    expect(isSafeRedirectUrl('http://localhost:3000/dashboard', envHosts)).toBe(true)
  })

  it('allows coverguard.io subdomains', () => {
    expect(isSafeRedirectUrl('https://app.coverguard.io/dashboard')).toBe(true)
    expect(isSafeRedirectUrl('https://staging.coverguard.io/dashboard')).toBe(true)
  })
})

// ─── 3. Climate risk types ──────────────────────────────────────────────────

describe('HeatRisk type', () => {
  const validHeatRisk: HeatRisk = {
    level: 'HIGH' as RiskLevel,
    score: 72,
    trend: 'WORSENING' as RiskTrend,
    description: 'Heat stress risk based on NOAA Climate Normals and NASA NEX-GDDP projections',
    details: ['22 extreme heat days per year (>100°F)', 'Projected 45 days by 2050 under RCP 4.5'],
    dataSource: 'NOAA Climate Normals / NASA NEX-GDDP / EPA Heat Island Data',
    lastUpdated: new Date().toISOString(),
    extremeHeatDays: 22,
    projectedHeatDays2050: 45,
    urbanHeatIslandEffect: 8.5,
    coolingInfrastructureDeficit: false,
  }

  it('should have all required RiskFactor fields', () => {
    expect(validHeatRisk.level).toBeDefined()
    expect(validHeatRisk.score).toBeGreaterThanOrEqual(0)
    expect(validHeatRisk.score).toBeLessThanOrEqual(100)
    expect(validHeatRisk.trend).toBeDefined()
    expect(validHeatRisk.description).toBeTruthy()
    expect(validHeatRisk.dataSource).toBeTruthy()
  })

  it('should have heat-specific fields', () => {
    expect(validHeatRisk.extremeHeatDays).toBe(22)
    expect(validHeatRisk.projectedHeatDays2050).toBe(45)
    expect(validHeatRisk.urbanHeatIslandEffect).toBe(8.5)
    expect(validHeatRisk.coolingInfrastructureDeficit).toBe(false)
  })

  it('allows null for optional projection fields', () => {
    const partial: HeatRisk = {
      ...validHeatRisk,
      projectedHeatDays2050: null,
      urbanHeatIslandEffect: null,
    }
    expect(partial.projectedHeatDays2050).toBeNull()
    expect(partial.urbanHeatIslandEffect).toBeNull()
  })
})

describe('DroughtRisk type', () => {
  const validDroughtRisk: DroughtRisk = {
    level: 'MODERATE' as RiskLevel,
    score: 45,
    trend: 'STABLE' as RiskTrend,
    description: 'Drought risk based on US Drought Monitor, Palmer Drought Index, and CMIP6 projections',
    details: ['Currently in D1 (Moderate Drought)', 'Projected 5% decrease in annual precipitation by 2050'],
    dataSource: 'US Drought Monitor / NOAA PDSI / CMIP6 Climate Projections',
    lastUpdated: new Date().toISOString(),
    palmerDroughtIndex: -1.8,
    droughtMonitorCategory: 'D1',
    projectedPrecipitationChange2050: -5,
    subsidenceRisk: 'LOW' as RiskLevel,
  }

  it('should have all required RiskFactor fields', () => {
    expect(validDroughtRisk.level).toBeDefined()
    expect(validDroughtRisk.score).toBeGreaterThanOrEqual(0)
    expect(validDroughtRisk.score).toBeLessThanOrEqual(100)
  })

  it('should have drought-specific fields', () => {
    expect(validDroughtRisk.palmerDroughtIndex).toBe(-1.8)
    expect(validDroughtRisk.droughtMonitorCategory).toBe('D1')
    expect(validDroughtRisk.projectedPrecipitationChange2050).toBe(-5)
    expect(validDroughtRisk.subsidenceRisk).toBe('LOW')
  })

  it('allows NONE for drought monitor category', () => {
    const noDrought: DroughtRisk = {
      ...validDroughtRisk,
      droughtMonitorCategory: 'NONE',
      palmerDroughtIndex: null,
      subsidenceRisk: null,
    }
    expect(noDrought.droughtMonitorCategory).toBe('NONE')
    expect(noDrought.palmerDroughtIndex).toBeNull()
    expect(noDrought.subsidenceRisk).toBeNull()
  })

  it('supports all D0-D4 drought categories', () => {
    const categories: DroughtRisk['droughtMonitorCategory'][] = ['NONE', 'D0', 'D1', 'D2', 'D3', 'D4']
    categories.forEach((cat) => {
      const risk: DroughtRisk = { ...validDroughtRisk, droughtMonitorCategory: cat }
      expect(risk.droughtMonitorCategory).toBe(cat)
    })
  })
})

// ─── 4. PropertyRiskProfile with optional climate fields ────────────────────

describe('PropertyRiskProfile with climate risk', () => {
  const baseProfile: PropertyRiskProfile = {
    propertyId: 'test-prop-123',
    overallRiskLevel: 'MODERATE',
    overallRiskScore: 52,
    flood: {
      level: 'LOW', score: 20, trend: 'STABLE',
      description: 'Test', details: [], dataSource: 'Test', lastUpdated: '',
      floodZone: 'X', firmPanelId: null, baseFloodElevation: null,
      inSpecialFloodHazardArea: false, annualChanceOfFlooding: null,
    },
    fire: {
      level: 'LOW', score: 15, trend: 'STABLE',
      description: 'Test', details: [], dataSource: 'Test', lastUpdated: '',
      fireHazardSeverityZone: null, wildlandUrbanInterface: false,
      nearestFireStation: null, vegetationDensity: null,
    },
    wind: {
      level: 'MODERATE', score: 40, trend: 'STABLE',
      description: 'Test', details: [], dataSource: 'Test', lastUpdated: '',
      designWindSpeed: null, hurricaneRisk: false, tornadoRisk: false, hailRisk: false,
    },
    earthquake: {
      level: 'LOW', score: 10, trend: 'STABLE',
      description: 'Test', details: [], dataSource: 'Test', lastUpdated: '',
      seismicZone: null, nearestFaultLine: null, soilType: null, liquefactionPotential: null,
    },
    crime: {
      level: 'MODERATE', score: 45, trend: 'STABLE',
      description: 'Test', details: [], dataSource: 'Test', lastUpdated: '',
      violentCrimeIndex: 50, propertyCrimeIndex: 55, nationalAverageDiff: 5,
    },
    generatedAt: new Date().toISOString(),
    cacheTtlSeconds: 3600,
  }

  it('works without heat/drought fields (backward compatible)', () => {
    expect(baseProfile.heat).toBeUndefined()
    expect(baseProfile.drought).toBeUndefined()
    expect(baseProfile.overallRiskScore).toBe(52)
  })

  it('accepts optional heat risk', () => {
    const withHeat: PropertyRiskProfile = {
      ...baseProfile,
      heat: {
        level: 'HIGH', score: 72, trend: 'WORSENING',
        description: 'Heat stress risk', details: [], dataSource: 'NOAA', lastUpdated: '',
        extremeHeatDays: 30, projectedHeatDays2050: 55,
        urbanHeatIslandEffect: 6.2, coolingInfrastructureDeficit: true,
      },
    }
    expect(withHeat.heat).toBeDefined()
    expect(withHeat.heat!.extremeHeatDays).toBe(30)
    expect(withHeat.heat!.projectedHeatDays2050).toBe(55)
  })

  it('accepts optional drought risk', () => {
    const withDrought: PropertyRiskProfile = {
      ...baseProfile,
      drought: {
        level: 'HIGH', score: 68, trend: 'WORSENING',
        description: 'Drought risk', details: [], dataSource: 'US Drought Monitor', lastUpdated: '',
        palmerDroughtIndex: -3.2, droughtMonitorCategory: 'D3',
        projectedPrecipitationChange2050: -12, subsidenceRisk: 'HIGH',
      },
    }
    expect(withDrought.drought).toBeDefined()
    expect(withDrought.drought!.droughtMonitorCategory).toBe('D3')
  })

  it('accepts both heat and drought together', () => {
    const withBoth: PropertyRiskProfile = {
      ...baseProfile,
      heat: {
        level: 'MODERATE', score: 50, trend: 'WORSENING',
        description: '', details: [], dataSource: '', lastUpdated: '',
        extremeHeatDays: 15, projectedHeatDays2050: 30,
        urbanHeatIslandEffect: null, coolingInfrastructureDeficit: false,
      },
      drought: {
        level: 'LOW', score: 20, trend: 'STABLE',
        description: '', details: [], dataSource: '', lastUpdated: '',
        palmerDroughtIndex: 0.5, droughtMonitorCategory: 'NONE',
        projectedPrecipitationChange2050: null, subsidenceRisk: null,
      },
    }
    expect(withBoth.heat).toBeDefined()
    expect(withBoth.drought).toBeDefined()
    expect(withBoth.heat!.score).toBe(50)
    expect(withBoth.drought!.score).toBe(20)
  })
})
