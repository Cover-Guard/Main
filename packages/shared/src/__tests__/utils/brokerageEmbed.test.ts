import {
  brokeragePlatformLabel,
  buildDeepLinkUrl,
  buildEmbedRenderResult,
  classifyEmbedPerformance,
  embedHeadlineForScore,
  embedSizeClasses,
  getEmbedCapabilities,
  isEmbedFullyCapable,
  isResultWithinBudget,
  normalizeEmbedTheme,
  validateEmbedConfig,
} from '../../utils/brokerageEmbed'
import {
  type EmbedConfig,
  type EmbedRenderResult,
  EMBED_LOAD_BUDGET_MS,
  EMBED_SLOW_THRESHOLD_MS,
  DEFAULT_EMBED_THEME,
} from '../../types/brokerageEmbed'

const NOW = new Date('2026-04-29T12:00:00Z')

function baseConfig(overrides: Partial<EmbedConfig> = {}): EmbedConfig {
  return {
    platform: 'KVCORE',
    property: {
      addressLine1: '123 Main St',
      city: 'Austin',
      state: 'TX',
      postalCode: '78701',
    },
    size: 'STANDARD',
    theme: DEFAULT_EMBED_THEME,
    deepLinkView: 'BUYER_FRIENDLY',
    channelId: 'channel-abc-123',
    requestedAt: NOW.toISOString(),
    ...overrides,
  }
}

describe('platform helpers', () => {
  it('brokeragePlatformLabel renders the human label', () => {
    expect(brokeragePlatformLabel('KVCORE')).toBe('kvCORE')
    expect(brokeragePlatformLabel('COMPASS')).toBe('Compass')
    expect(brokeragePlatformLabel('FOLLOW_UP_BOSS')).toBe('Follow Up Boss')
  })

  it('getEmbedCapabilities returns vendor capability flags', () => {
    expect(getEmbedCapabilities('KVCORE').themeable).toBe(true)
    expect(getEmbedCapabilities('COMPASS').deepLinkParentNav).toBe(false)
    expect(getEmbedCapabilities('FOLLOW_UP_BOSS').inlineRender).toBe(false)
  })

  it('isEmbedFullyCapable is only true for kvCORE', () => {
    expect(isEmbedFullyCapable('KVCORE')).toBe(true)
    expect(isEmbedFullyCapable('COMPASS')).toBe(false)
    expect(isEmbedFullyCapable('FOLLOW_UP_BOSS')).toBe(false)
  })
})

describe('normalizeEmbedTheme', () => {
  it('returns defaults when no theme is supplied', () => {
    expect(normalizeEmbedTheme(undefined)).toEqual(DEFAULT_EMBED_THEME)
  })

  it('preserves explicit values and fills only missing fields', () => {
    const t = normalizeEmbedTheme({ primaryColor: '#FF0000' })
    expect(t.primaryColor).toBe('#FF0000')
    expect(t.fontFamily).toBe(DEFAULT_EMBED_THEME.fontFamily)
    expect(t.darkMode).toBe(false)
  })

  it('honors darkMode = true', () => {
    expect(normalizeEmbedTheme({ darkMode: true }).darkMode).toBe(true)
  })
})

describe('buildDeepLinkUrl', () => {
  it('encodes the address into the path', () => {
    const url = buildDeepLinkUrl('https://app.coverguard.com', baseConfig())
    expect(url).toContain('https://app.coverguard.com/property/')
    expect(url).toContain('123%20Main%20St')
    expect(url).toContain('Austin')
  })

  it('defaults to the buyer-friendly view (P0 #2 dependency)', () => {
    const url = buildDeepLinkUrl('https://app.coverguard.com', baseConfig())
    expect(url).toContain('view=buyer')
  })

  it('honors agent-full view when requested', () => {
    const url = buildDeepLinkUrl(
      'https://app.coverguard.com',
      baseConfig({ deepLinkView: 'AGENT_FULL' }),
    )
    expect(url).toContain('view=agent')
  })

  it('appends per-platform source param for analytics', () => {
    expect(buildDeepLinkUrl('https://x', baseConfig({ platform: 'KVCORE' }))).toContain(
      'source=embed-kvcore',
    )
    expect(buildDeepLinkUrl('https://x', baseConfig({ platform: 'COMPASS' }))).toContain(
      'source=embed-compass',
    )
    expect(
      buildDeepLinkUrl('https://x', baseConfig({ platform: 'FOLLOW_UP_BOSS' })),
    ).toContain('source=embed-follow-up-boss')
  })
})

describe('validateEmbedConfig', () => {
  it('passes a clean config', () => {
    expect(validateEmbedConfig(baseConfig())).toEqual({ ok: true })
  })

  it('rejects empty address fields', () => {
    expect(
      validateEmbedConfig(
        baseConfig({ property: { addressLine1: '', city: 'A', state: 'A', postalCode: '1' } }),
      ),
    ).toEqual({ ok: false, reason: 'MISSING_ADDRESS' })
    expect(
      validateEmbedConfig(
        baseConfig({ property: { addressLine1: '1', city: '', state: 'A', postalCode: '1' } }),
      ),
    ).toEqual({ ok: false, reason: 'MISSING_CITY' })
  })

  it('rejects invalid sizes', () => {
    expect(
      validateEmbedConfig(baseConfig({ size: 'WHATEVER' as 'COMPACT' })),
    ).toEqual({ ok: false, reason: 'INVALID_SIZE' })
  })

  it('rejects malformed channel ids', () => {
    expect(validateEmbedConfig(baseConfig({ channelId: 'short' }))).toEqual({
      ok: false,
      reason: 'INVALID_CHANNEL_ID',
    })
    expect(
      validateEmbedConfig(baseConfig({ channelId: 'has spaces!' })),
    ).toEqual({ ok: false, reason: 'INVALID_CHANNEL_ID' })
  })
})

describe('embedHeadlineForScore', () => {
  it('renders the right band per score', () => {
    expect(embedHeadlineForScore(95).headline).toMatch(/well-protected/i)
    expect(embedHeadlineForScore(70).headline).toMatch(/above-average/i)
    expect(embedHeadlineForScore(50).headline).toMatch(/average protection/i)
    expect(embedHeadlineForScore(30).headline).toMatch(/below-average/i)
    expect(embedHeadlineForScore(10).headline).toMatch(/significant exposure/i)
  })

  it('embeds the score in the headline', () => {
    expect(embedHeadlineForScore(72).headline).toContain('72/100')
  })

  it('boundary scores fall into the higher band', () => {
    expect(embedHeadlineForScore(80).headline).toMatch(/well-protected/i)
    expect(embedHeadlineForScore(60).headline).toMatch(/above-average/i)
  })
})

describe('buildEmbedRenderResult', () => {
  it('returns OK with a rounded score and headline', () => {
    const result = buildEmbedRenderResult({
      score: 72.6,
      origin: 'https://app.coverguard.com',
      config: baseConfig(),
      computedInMs: 250,
      now: NOW,
    })
    expect(result.status).toBe('OK')
    expect(result.riskScore).toBe(73)
    expect(result.headline).toMatch(/above-average/i)
    expect(result.deepLinkUrl).toContain('view=buyer')
    expect(result.computedInMs).toBe(250)
    expect(result.computedAt).toBe(NOW.toISOString())
  })

  it('returns NO_COVERAGE with a null score', () => {
    const result = buildEmbedRenderResult({
      score: null,
      origin: 'https://app.coverguard.com',
      config: baseConfig(),
      computedInMs: 50,
      now: NOW,
    })
    expect(result.status).toBe('NO_COVERAGE')
    expect(result.riskScore).toBeNull()
    expect(result.headline).toMatch(/no coverage/i)
  })
})

describe('classifyEmbedPerformance', () => {
  it('classifies under the slow threshold as FAST', () => {
    expect(classifyEmbedPerformance(EMBED_SLOW_THRESHOLD_MS - 1)).toBe('FAST')
  })

  it('classifies between slow threshold and budget as SLOW', () => {
    expect(classifyEmbedPerformance(EMBED_SLOW_THRESHOLD_MS + 1)).toBe('SLOW')
    expect(classifyEmbedPerformance(EMBED_LOAD_BUDGET_MS)).toBe('SLOW')
  })

  it('classifies above budget as OVER_BUDGET', () => {
    expect(classifyEmbedPerformance(EMBED_LOAD_BUDGET_MS + 1)).toBe('OVER_BUDGET')
  })
})

describe('isResultWithinBudget', () => {
  function result(computedInMs: number): EmbedRenderResult {
    return {
      status: 'OK',
      riskScore: 70,
      headline: 'h',
      subline: 's',
      deepLinkUrl: 'https://x',
      computedInMs,
      computedAt: NOW.toISOString(),
    }
  }
  it('is true when at or below the budget', () => {
    expect(isResultWithinBudget(result(EMBED_LOAD_BUDGET_MS))).toBe(true)
    expect(isResultWithinBudget(result(EMBED_LOAD_BUDGET_MS - 1))).toBe(true)
  })
  it('is false when over the budget', () => {
    expect(isResultWithinBudget(result(EMBED_LOAD_BUDGET_MS + 1))).toBe(false)
  })
})

describe('embedSizeClasses', () => {
  it('hides subline + CTA in COMPACT', () => {
    const c = embedSizeClasses('COMPACT')
    expect(c.showSubline).toBe(false)
    expect(c.showCallToAction).toBe(false)
  })
  it('shows everything in STANDARD and EXPANDED', () => {
    expect(embedSizeClasses('STANDARD').showSubline).toBe(true)
    expect(embedSizeClasses('STANDARD').showCallToAction).toBe(true)
    expect(embedSizeClasses('EXPANDED').showSubline).toBe(true)
    expect(embedSizeClasses('EXPANDED').showCallToAction).toBe(true)
  })
  it('produces wider max widths as size increases', () => {
    const compact = parseInt(embedSizeClasses('COMPACT').rootMaxWidth)
    const standard = parseInt(embedSizeClasses('STANDARD').rootMaxWidth)
    const expanded = parseInt(embedSizeClasses('EXPANDED').rootMaxWidth)
    expect(standard).toBeGreaterThan(compact)
    expect(expanded).toBeGreaterThan(standard)
  })
})
