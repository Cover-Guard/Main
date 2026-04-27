'use client'

import type { CanonicalQuoteStatus, QuoteStatusCopy } from '@coverguard/shared'
import { quoteStatusCopy } from '@coverguard/shared'
import {
  Send,
  Inbox,
  FileSearch,
  FileText,
  CheckCircle2,
  XCircle,
  Ban,
} from 'lucide-react'

/**
 * Pill badge for a quote-request status (P0 #4).
 *
 * Spec: docs/enhancements/p0/04-quote-request-status-feedback.md.
 *
 * Renders the canonical 6-state pill with a color from the status's
 * `variant` and an icon. Used in tables, the carrier list, and the
 * top of the timeline. Copy comes from shared so email/SMS/UI all match.
 */
export function QuoteStatusBadge({
  status,
  size = 'md',
}: {
  status: CanonicalQuoteStatus
  size?: 'sm' | 'md'
}) {
  const copy = quoteStatusCopy(status)
  const variantClasses = VARIANT_CLASSES[copy.variant]
  const Icon = STATUS_ICONS[status]
  const sizeClasses =
    size === 'sm'
      ? 'gap-1 px-1.5 py-0.5 text-[10px]'
      : 'gap-1.5 px-2 py-0.5 text-xs'
  const iconSize = size === 'sm' ? 'h-2.5 w-2.5' : 'h-3 w-3'

  return (
    <span
      className={`inline-flex items-center rounded-full font-medium ring-1 ${variantClasses} ${sizeClasses}`}
      title={copy.description}
      aria-label={`${copy.label}: ${copy.description}`}
    >
      <Icon className={iconSize} aria-hidden />
      {copy.label}
    </span>
  )
}

const STATUS_ICONS: Record<CanonicalQuoteStatus, typeof Send> = {
  REQUESTED: Send,
  RECEIVED:  Inbox,
  QUOTING:   FileSearch,
  QUOTED:    FileText,
  BOUND:     CheckCircle2,
  DECLINED:  XCircle,
  CANCELLED: Ban,
}

const VARIANT_CLASSES: Record<QuoteStatusCopy['variant'], string> = {
  neutral:  'bg-gray-50 text-gray-700 ring-gray-200',
  pending:  'bg-blue-50 text-blue-700 ring-blue-200',
  progress: 'bg-amber-50 text-amber-800 ring-amber-200',
  success:  'bg-emerald-50 text-emerald-800 ring-emerald-200',
  warning:  'bg-orange-50 text-orange-800 ring-orange-200',
  danger:   'bg-red-50 text-red-700 ring-red-200',
}
