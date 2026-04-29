/**
 * Helpers for the MLS / brokerage embed program (P2 #15).
 *
 * Spec: docs/enhancements/P2-enhancements.md.
 *
 * Pure / I/O-free â the actual host-side iframe + postMessage plumbing
 * lives under `apps/api/src/integrations/embed/`. This file is the
 * shared layer:
 *
 *   - display copy + capability lookup per platform;
 *   - normalize the host's `EmbedTheme` (filling defaults);
 *   - format the property address into the URL slug we deep-link to;
 *   - validate the host's `EmbedConfig` so the iframe doesn't render
 *     something nonsensical;
 *   - measure performance against the spec's 1s budget.
 */
import {
  type BrokeragePlatform,
  type EmbedCapabilities,
  type EmbedConfig,
  type EmbedDeepLinkView,
  type EmbedRenderResult,
  type EmbedSize,
  type EmbedTheme,
  DEFAULT_EMBED_THEME,
  EMBED_CAPABILITIES,
  EMBED_LOAD_BUDGET_MS,
  EMBED_SLOW_THRESHOLD_MS,
} from '../types/brokerageEmbed'

/** Display label per platform. Used on the marketing page + docs. */
export function brokeragePlatformLabel(platform: BrokeragePlatform): string {
  switch (platform) {
    case 'KVCORE':         return 'kvCORE'
    case 'COMPASS':        return 'Compass'
    case 'FOLLOW_UP_BOSS': return 'Follow Up Boss'
  }
}

/** Capability lookup. */
export function getEmbedCapabilities(platform: BrokeragePlatform): EmbedCapabilities {
  return EMBED_CAPABILITIES[platform]
}

/**
 * Whether the host iframe can do *all* the things this embed wants. If
 * any capability is missing, the host adapter degrades gracefully â
 * e.g. FUB skips the theme tokens and opens the deep-link in a new tab.
 */
export function isEmbedFullyCapable(platform: BrokeragePlatform): boolean {
  const caps = EMBED_CAPABILITIES[platform]
  return caps.themeable && caps.inlineRender && caps.deepLinkParentNav
}

/**
 * Normalize a partial theme by filling missing fields with defaults.
 * Hosts often pass only some tokens.
 */
export function normalizeEmbedTheme(theme: Partial<EmbedTheme> | undefined): EmbedTheme {
  return {
    primaryColor: theme?.primaryColor ?? DEFAULT_EMBED_THEME.primaryColor,
    fontFamily: theme?.fontFamily ?? DEFAULT_EMBED_THEME.fontFamily,
    darkMode: theme?.darkMode ?? DEFAULT_EMBED_THEME.darkMode,
  }
}

/**
 * Build the deep-link URL pointing at the full report. The acceptance
 * criterion requires the deep-link to default to the buyer-friendly
 * view (P0 #2).
 */
export function buildDeepLinkUrl(
  origin: string,
  config: Pick<EmbedConfig, 'property' | 'deepLinkView' | 'platform'>,
): string {
  const slug = encodeURIComponent(
    `${config.property.addressLine1}, ${config.property.city}, ${config.property.state} ${config.property.postalCode}`,
  )
  const view: EmbedDeepLinkView = config.deepLinkView ?? 'BUYER_FRIENDLY'
  const viewParam = view === 'BUYER_FRIENDLY' ? 'buyer' : 'agent'
  // Source param lets us track which platform produced the click in analytics.
  const source = `embed-${config.platform.toLowerCase().replace(/_/g, '-')}`
  return `${origin}/property/${slug}?view=${viewParam}&source=${source}`
}

/** Discriminated validation result for the host's EmbedConfig. */
export type EmbedConfigValidation =
  | { ok: true }
  | {
      ok: false
      reason:
        | 'MISSING_ADDRESS'
        | 'MISSING_CITY'
        | 'MISSING_STATE'
        | 'MISSING_POSTAL_CODE'
        | 'INVALID_SIZE'
        | 'INVALID_CHANNEL_ID'
    }

/** Validate the host's config before doing any work. */
export function validateEmbedConfig(config: EmbedConfig): EmbedConfigValidation {
  if (!config.property.addressLine1.trim()) return { ok: false, reason: 'MISSING_ADDRESS' }
  if (!config.property.city.trim()) return { ok: false, reason: 'MISSING_CITY' }
  if (!config.property.state.trim()) return { ok: false, reason: 'MISSING_STATE' }
  if (!config.property.postalCode.trim()) return { ok: false, reason: 'MISSING_POSTAL_CODE' }
  const validSizes: EmbedSize[] = ['COMPACT', 'STANDARD', 'EXPANDED']
  if (!validSizes.includes(config.size)) return { ok: false, reason: 'INVALID_SIZE' }
  if (!/^[a-zA-Z0-9_-]{6,64}$/.test(config.channelId)) {
    return { ok: false, reason: 'INVALID_CHANNEL_ID' }
  }
  return { ok: true }
}

/**
 * Headline copy used in the embed. Centralized so kvCORE, Compass,
 * Follow Up Boss all read the same string for the same score band.
 *
 * Score bands:
 *   80-100 = exceptional, "well-protected"
 *   60-79  = strong, "above-average protection"
 *   40-59  = fair, "average protection"
 *   20-39  = elevated risk, "below-average protection"
 *    0-19  = high risk, "significant exposure"
 */
export function embedHeadlineForScore(score: number): { headline: string; subline: string } {
  if (score >= 80) {
    return {
      headline: `Well-protected (${score}/100)`,
      subline: 'Comparable risk to top-tier homes nearby.',
    }
  }
  if (score >= 60) {
    return {
      headline: `Above-average protection (${score}/100)`,
      subline: 'Most perils are well-mitigated; one or two open items.',
    }
  }
  if (score >= 40) {
    return {
      headline: `Average protection (${score}/100)`,
      subline: 'Several open items â see the full report for details.',
    }
  }
  if (score >= 20) {
    return {
      headline: `Below-average protection (${score}/100)`,
      subline: 'Multiple open items materially affect insurability.',
    }
  }
  return {
    headline: `Significant exposure (${score}/100)`,
    subline: 'Major mitigations are required before bind.',
  }
}

/**
 * Compute the embed render result given a (possibly partial) score and
 * the deep-link the host should open. Pure helper that the iframe
 * server uses to assemble its postMessage response.
 */
export function buildEmbedRenderResult(args: {
  score: number | null
  origin: string
  config: EmbedConfig
  computedInMs: number
  now: Date
}): EmbedRenderResult {
  const { score, origin, config, computedInMs, now } = args
  const deepLinkUrl = buildDeepLinkUrl(origin, config)
  if (score === null) {
    return {
      status: 'NO_COVERAGE',
      riskScore: null,
      headline: 'No coverage data',
      subline: 'CoverGuard does not yet have data for this address.',
      deepLinkUrl,
      computedInMs,
      computedAt: now.toISOString(),
    }
  }
  const { headline, subline } = embedHeadlineForScore(score)
  return {
    status: 'OK',
    riskScore: Math.round(score),
    headline,
    subline,
    deepLinkUrl,
    computedInMs,
    computedAt: now.toISOString(),
  }
}

/** Bucket the elapsed time against the spec's 1s budget. */
export type EmbedPerformanceBucket = 'FAST' | 'SLOW' | 'OVER_BUDGET'

export function classifyEmbedPerformance(elapsedMs: number): EmbedPerformanceBucket {
  if (elapsedMs > EMBED_LOAD_BUDGET_MS) return 'OVER_BUDGET'
  if (elapsedMs > EMBED_SLOW_THRESHOLD_MS) return 'SLOW'
  return 'FAST'
}

/**
 * Whether the embed result still met the host's hard deadline. The
 * adapter uses this to decide whether to drop the result on the floor
 * (host already showed its fallback) or send it through.
 */
export function isResultWithinBudget(result: EmbedRenderResult): boolean {
  return result.computedInMs <= EMBED_LOAD_BUDGET_MS
}

/** Card classes per size variant. Centralized so each adapter renders identically. */
export function embedSizeClasses(size: EmbedSize): {
  rootMaxWidth: string
  showSubline: boolean
  showCallToAction: boolean
} {
  switch (size) {
    case 'COMPACT':
      return { rootMaxWidth: '240px', showSubline: false, showCallToAction: false }
    case 'STANDARD':
      return { rootMaxWidth: '360px', showSubline: true, showCallToAction: true }
    case 'EXPANDED':
      return { rootMaxWidth: '520px', showSubline: true, showCallToAction: true }
  }
}
