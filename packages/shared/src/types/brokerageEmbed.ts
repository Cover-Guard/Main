/**
 * Types for the MLS / brokerage embed program (P2 #15).
 *
 * Spec: docs/enhancements/P2-enhancements.md ("P2 #15 â MLS / Brokerage
 * Embeds (kvCORE, Compass, Follow Up Boss)").
 *
 * Realtors live inside their MLS or CRM. Rather than asking them to
 * leave for CoverGuard, we ship a small embeddable component that
 * renders on the property card alongside square footage and HOA dues.
 *
 * The contract has three pieces:
 *
 *   1. `BrokeragePlatform` â which host platform the embed is loaded into.
 *   2. `EmbedConfig` â what the host iframe / widget passes to us.
 *   3. `EmbedRenderResult` â what we render back, including a deep-link
 *      to the full report (which defaults to the P0 #2 buyer-friendly
 *      view, per spec dependency).
 *
 * The platforms have different distribution mechanisms:
 *
 *   - kvCORE: app/widget on the property card.
 *   - Compass: partner-program plugin.
 *   - Follow Up Boss: native or zap-style integration depending on
 *     API maturity at integration time.
 *
 * This shared type set abstracts over those â every adapter ships an
 * `EmbedConfig` in and an `EmbedRenderResult` out.
 */

/** Host platform the embed is loaded into. */
export type BrokeragePlatform =
  | 'KVCORE'           // kvCORE app/widget
  | 'COMPASS'          // Compass partner plugin
  | 'FOLLOW_UP_BOSS'   // FUB native / zap

/** Per-platform capability flags (host iframe constraints). */
export interface EmbedCapabilities {
  /** Host honors theme tokens passed by the embed. */
  themeable: boolean
  /** Host renders the embed inline (vs. modal/dialog). */
  inlineRender: boolean
  /** Host allows deep-link clicks to navigate the parent window. */
  deepLinkParentNav: boolean
}

/** Layout variant the host requested (the host card has limited width). */
export type EmbedSize = 'COMPACT' | 'STANDARD' | 'EXPANDED'

/**
 * Theme tokens the host can pass to keep the embed consistent with the
 * surrounding card. Defaults applied if missing.
 */
export interface EmbedTheme {
  /** Primary brand color (CSS color string). */
  primaryColor: string | null
  /** Body font family. */
  fontFamily: string | null
  /** Whether dark mode is requested. */
  darkMode: boolean
}

/**
 * Which view the deep-link should open. Defaults to the P0 #2
 * buyer-friendly view (spec acceptance criterion).
 */
export type EmbedDeepLinkView = 'BUYER_FRIENDLY' | 'AGENT_FULL'

/** Config the host iframe sends in. */
export interface EmbedConfig {
  /** Which platform is hosting the embed. */
  platform: BrokeragePlatform
  /** The property the host card is showing. */
  property: {
    addressLine1: string
    city: string
    state: string
    postalCode: string
  }
  /** Layout variant (host card has limited horizontal space). */
  size: EmbedSize
  /** Theme tokens (the host card may pass these for consistency). */
  theme: EmbedTheme
  /** Which view the deep-link should target. */
  deepLinkView: EmbedDeepLinkView
  /** Iframe-side message-channel id, used for postMessage handshake. */
  channelId: string
  /** ISO-8601 timestamp at which the host requested the embed. */
  requestedAt: string
}

/**
 * What we render back to the host.
 *
 * `loadDeadlineMs` is the budget the spec acceptance criterion sets:
 * the embed must paint inside this window or the host shows its
 * fallback (square footage / HOA dues without our score).
 */
export interface EmbedRenderResult {
  status: 'OK' | 'NO_COVERAGE' | 'ERROR' | 'TIMEOUT'
  /** Composite risk score, 0-100. Null when status !== 'OK'. */
  riskScore: number | null
  /** Headline copy (one line). */
  headline: string
  /** Sub-headline (one line). */
  subline: string | null
  /** URL the deep-link button opens (target view). */
  deepLinkUrl: string
  /** Time we took to compute the result, in ms. */
  computedInMs: number
  /** ISO-8601 timestamp at which we computed it. */
  computedAt: string
}

/** Per-platform capability table. */
export const EMBED_CAPABILITIES: Record<BrokeragePlatform, EmbedCapabilities> = {
  KVCORE: {
    themeable:         true,
    inlineRender:      true,
    deepLinkParentNav: true,
  },
  COMPASS: {
    themeable:         true,
    inlineRender:      true,
    deepLinkParentNav: false, // Compass forces deep-links into a new tab
  },
  FOLLOW_UP_BOSS: {
    themeable:         false, // FUB iframe ignores theme tokens
    inlineRender:      false, // FUB renders inside a modal
    deepLinkParentNav: true,
  },
}

/**
 * Performance budget. The spec acceptance criterion says the embed
 * must load in under 1 second on the property card.
 */
export const EMBED_LOAD_BUDGET_MS = 1000

/**
 * Soft threshold for emitting a "slow" warning to the host so they can
 * surface telemetry. We log internally above this even if we still
 * make the hard deadline.
 */
export const EMBED_SLOW_THRESHOLD_MS = 600

/** Default theme used when the host omits theme tokens. */
export const DEFAULT_EMBED_THEME: EmbedTheme = {
  primaryColor: '#0F62FE',
  fontFamily: 'system-ui, sans-serif',
  darkMode: false,
}
