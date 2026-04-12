import type { ReactNode } from 'react'
import Link from 'next/link'
import { cn } from '@/lib/utils'

export interface PanelEmptyStateProps {
  /** Decorative icon rendered at the top of the empty state. */
  icon?: ReactNode
  /** Primary headline — keep to a short sentence. */
  title: string
  /** Optional supporting sentence explaining what the panel does. */
  body?: string
  /** Optional call-to-action. Provide either `href` or `onClick`. */
  cta?: {
    label: string
    href?: string
    onClick?: () => void
  }
  /**
   * `default` is the full-sized empty state (dashboard hero, analytics grid).
   * `compact` is tuned for cards that sit inside a dense panel grid.
   */
  size?: 'default' | 'compact'
  className?: string
}

/**
 * Reusable empty-state block for panels that have no data yet.
 *
 * Rationale: prior UX treated empty panels as silence — a bare "No data"
 * string or nothing at all. This component makes every empty panel explain
 * itself in plain language and offer a next action, so the first-run
 * experience never looks broken.
 */
export function PanelEmptyState({
  icon,
  title,
  body,
  cta,
  size = 'default',
  className,
}: PanelEmptyStateProps) {
  const isCompact = size === 'compact'

  const ctaContent = cta ? (
    <span
      className={cn(
        'inline-flex items-center justify-center rounded-md bg-primary px-3 py-1.5 font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary/90',
        isCompact ? 'text-caption' : 'text-body',
      )}
    >
      {cta.label}
    </span>
  ) : null

  return (
    <div
      className={cn(
        'flex h-full w-full flex-col items-center justify-center rounded-xl border border-dashed border-border bg-muted/30 text-center',
        isCompact ? 'gap-1.5 px-4 py-6' : 'gap-3 px-6 py-10',
        className,
      )}
    >
      {icon ? (
        <div
          className={cn(
            'flex items-center justify-center rounded-full bg-background text-muted-foreground shadow-sm',
            isCompact ? 'h-9 w-9 [&_svg]:h-4 [&_svg]:w-4' : 'h-12 w-12 [&_svg]:h-5 [&_svg]:w-5',
          )}
          aria-hidden
        >
          {icon}
        </div>
      ) : null}

      <p
        className={cn(
          'font-semibold text-foreground',
          isCompact ? 'text-subheading' : 'text-heading',
        )}
      >
        {title}
      </p>

      {body ? (
        <p
          className={cn(
            'max-w-sm text-muted-foreground',
            isCompact ? 'text-caption' : 'text-body',
          )}
        >
          {body}
        </p>
      ) : null}

      {cta ? (
        cta.href ? (
          <Link
            href={cta.href}
            className="mt-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            {ctaContent}
          </Link>
        ) : (
          <button
            type="button"
            onClick={cta.onClick}
            className="mt-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            {ctaContent}
          </button>
        )
      ) : null}
    </div>
  )
}

export default PanelEmptyState
