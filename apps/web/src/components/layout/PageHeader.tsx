'use client'

/**
 * Shared in-app page header.
 *
 * Used by every page that renders inside `SidebarLayout` (Search, Dashboard,
 * Toolkit, Help) so the top strip of the app always has the same shape:
 *
 *   ┌────────────────────────────────────────────────────────────────────┐
 *   │  [icon]  Title              ← optional actions on the right →     │
 *   │          Subtitle                                                  │
 *   └────────────────────────────────────────────────────────────────────┘
 *
 * Locked-in rules — DO NOT override per page:
 *   • Element: <header>
 *   • Sticky:  sticky top-0 z-30
 *   • Border:  border-b border-gray-200
 *   • BG:      bg-white
 *   • Width:   max-w-screen-2xl
 *   • Padding: px-4 py-2.5
 *   • Title:   text-sm font-bold text-gray-900 (truncates)
 *   • Sub:    text-xs text-gray-500 (truncates)
 *   • Icon:    indigo-600 rounded-lg tile, white 16px lucide icon
 *
 * If a page needs a secondary row (e.g. Search needs a wide SearchBar
 * directly below the title strip), pass it via the `belowSlot` prop —
 * it renders inside the same sticky <header>, with a divider above it.
 */

import type { ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'

interface PageHeaderProps {
  /** Lucide icon shown inside the indigo tile on the left. */
  icon: LucideIcon
  /** Page title — short, sentence case, no trailing punctuation. */
  title: string
  /** Optional one-line subtitle under the title. Truncates. */
  subtitle?: ReactNode
  /** Right-aligned actions (buttons, NotificationBell, compact inputs). */
  actions?: ReactNode
  /** Optional second row inside the same sticky header. */
  belowSlot?: ReactNode
}

export function PageHeader({
  icon: Icon,
  title,
  subtitle,
  actions,
  belowSlot,
}: PageHeaderProps) {
  return (
    <header className="sticky top-0 z-30 border-b border-gray-200 bg-white">
      <div className="mx-auto flex max-w-screen-2xl items-center justify-between gap-3 px-4 py-2.5">
        <div className="flex min-w-0 items-center gap-2">
          <div className="shrink-0 rounded-lg bg-indigo-600 p-1.5">
            <Icon size={16} className="text-white" />
          </div>
          <div className="min-w-0">
            <h1 className="truncate text-sm font-bold text-gray-900">
              {title}
            </h1>
            {subtitle && (
              <p className="truncate text-xs text-gray-500">{subtitle}</p>
            )}
          </div>
        </div>
        {actions && (
          <div className="flex shrink-0 items-center gap-2">{actions}</div>
        )}
      </div>
      {belowSlot && (
        <div className="border-t border-gray-100 bg-white">
          <div className="mx-auto max-w-screen-2xl px-4 py-2.5">
            {belowSlot}
          </div>
        </div>
      )}
    </header>
  )
}
