'use client'

import {
  embedSizeClasses,
  normalizeEmbedTheme,
  type EmbedRenderResult,
  type EmbedSize,
  type EmbedTheme,
} from '@coverguard/shared'
import { ExternalLink, Loader2, Shield, ShieldOff, AlertTriangle } from 'lucide-react'

/**
 * The host-facing embed card for the MLS / brokerage embed program
 * (P2 #15).
 *
 * Spec: docs/enhancements/P2-enhancements.md.
 *
 * This is the component the host iframe renders inside the property
 * card on kvCORE / Compass / Follow Up Boss. It is intentionally tiny
 * â the spec acceptance criterion sets a 1-second load budget.
 *
 * Stateless: the parent supplies a pre-computed {@link EmbedRenderResult}
 * (built server-side via `buildEmbedRenderResult`). The component just
 * picks the right copy and hands the user a deep-link.
 */
export interface BrokerageEmbedCardProps {
  /** Pre-computed result from the iframe server. */
  result: EmbedRenderResult | null
  /** Layout variant the host requested. */
  size: EmbedSize
  /** Theme tokens (host may pass partial; we fill defaults). */
  theme?: Partial<EmbedTheme>
  /**
   * Whether to navigate the parent window when the deep-link is
   * clicked. Honors the per-platform capability flag (Compass forces
   * a new tab).
   */
  parentNavigation?: boolean
}

export function BrokerageEmbedCard({
  result,
  size,
  theme,
  parentNavigation = true,
}: BrokerageEmbedCardProps) {
  const t = normalizeEmbedTheme(theme)
  const sizeClasses = embedSizeClasses(size)
  const cardStyle: React.CSSProperties = {
    maxWidth: sizeClasses.rootMaxWidth,
    fontFamily: t.fontFamily ?? 'system-ui, sans-serif',
  }
  const tone = pickTone(result)

  return (
    <article
      style={cardStyle}
      data-coverguard-embed
      data-size={size}
      data-dark={t.darkMode || undefined}
      className={[
        'rounded-lg border p-3 shadow-sm',
        t.darkMode ? 'border-slate-700 bg-slate-900 text-slate-100' : 'border-slate-200 bg-white text-slate-900',
      ].join(' ')}
    >
      <header className="flex items-center gap-2">
        <ToneIcon tone={tone} />
        <span className="text-xs font-medium uppercase tracking-wide opacity-70">
          CoverGuard
        </span>
      </header>

      {result === null ? <LoadingBody /> : <ResultBody result={result} sizeClasses={sizeClasses} />}

      {sizeClasses.showCallToAction && result?.status === 'OK' ? (
        <DeepLinkButton
          href={result.deepLinkUrl}
          parentNavigation={parentNavigation}
          primaryColor={t.primaryColor ?? '#0F62FE'}
          darkMode={t.darkMode}
        />
      ) : null}
    </article>
  )
}

// =============================================================================
// Internal pieces
// =============================================================================

type Tone = 'good' | 'warning' | 'danger' | 'neutral' | 'loading'

function pickTone(result: EmbedRenderResult | null): Tone {
  if (result === null) return 'loading'
  if (result.status !== 'OK') return 'neutral'
  if (result.riskScore === null) return 'neutral'
  if (result.riskScore >= 60) return 'good'
  if (result.riskScore >= 40) return 'warning'
  return 'danger'
}

function ToneIcon({ tone }: { tone: Tone }) {
  switch (tone) {
    case 'good':
      return <Shield className="h-4 w-4 text-emerald-500" aria-hidden />
    case 'warning':
      return <AlertTriangle className="h-4 w-4 text-amber-500" aria-hidden />
    case 'danger':
      return <ShieldOff className="h-4 w-4 text-red-500" aria-hidden />
    case 'loading':
      return <Loader2 className="h-4 w-4 animate-spin text-slate-400" aria-hidden />
    case 'neutral':
      return <Shield className="h-4 w-4 text-slate-400" aria-hidden />
  }
}

function LoadingBody() {
  return (
    <div className="mt-2 space-y-2" aria-label="Loading risk score">
      <div className="h-4 w-3/4 animate-pulse rounded bg-slate-200" />
      <div className="h-3 w-1/2 animate-pulse rounded bg-slate-200" />
    </div>
  )
}

function ResultBody({
  result,
  sizeClasses,
}: {
  result: EmbedRenderResult
  sizeClasses: ReturnType<typeof embedSizeClasses>
}) {
  return (
    <div className="mt-2">
      <p className="text-sm font-semibold leading-snug">{result.headline}</p>
      {sizeClasses.showSubline && result.subline ? (
        <p className="mt-1 text-xs opacity-80">{result.subline}</p>
      ) : null}
    </div>
  )
}

function DeepLinkButton({
  href,
  parentNavigation,
  primaryColor,
  darkMode,
}: {
  href: string
  parentNavigation: boolean
  primaryColor: string
  darkMode: boolean
}) {
  // We deliberately do NOT auto-set rel="noopener" when parentNavigation
  // is true so kvCORE can keep the embed and the report in the same tab.
  const target = parentNavigation ? '_top' : '_blank'
  const rel = parentNavigation ? undefined : 'noopener noreferrer'
  return (
    <a
      href={href}
      target={target}
      rel={rel}
      className={[
        'mt-3 inline-flex w-full items-center justify-center gap-1 rounded-md px-3 py-1.5 text-xs font-medium',
        darkMode ? 'bg-white/10 hover:bg-white/15' : 'hover:opacity-90',
      ].join(' ')}
      style={darkMode ? undefined : { backgroundColor: primaryColor, color: 'white' }}
    >
      View full CoverGuard report
      <ExternalLink className="h-3 w-3" aria-hidden />
    </a>
  )
}
