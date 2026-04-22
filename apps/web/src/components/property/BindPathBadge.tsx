import type { BindPath } from '@coverguard/shared'
import { CheckCircle2, AlertTriangle, XOctagon } from 'lucide-react'

const CONFIG: Record<
  BindPath['level'],
  {
    label: string
    ariaLabel: string
    container: string
    icon: React.ComponentType<{ className?: string }>
    iconClass: string
  }
> = {
  GREEN: {
    label: 'Clear Bind Path',
    ariaLabel: 'Clear bind path',
    container: 'border-green-200 bg-green-50 text-green-800',
    icon: CheckCircle2,
    iconClass: 'text-green-600',
  },
  YELLOW: {
    label: 'Tight Bind Path',
    ariaLabel: 'Tight bind path',
    container: 'border-yellow-200 bg-yellow-50 text-yellow-800',
    icon: AlertTriangle,
    iconClass: 'text-yellow-600',
  },
  RED: {
    label: 'Difficult Bind Path',
    ariaLabel: 'Difficult bind path',
    container: 'border-red-200 bg-red-50 text-red-800',
    icon: XOctagon,
    iconClass: 'text-red-600',
  },
}

interface BindPathBadgeProps {
  bindPath: BindPath
  /** Compact inline style (badge) vs full card — defaults to "card". */
  variant?: 'badge' | 'card'
  className?: string
}

/**
 * Bind-Path Indicator — visual compression of `BindPath` into Green / Yellow /
 * Red for at-a-glance readability. Usable inline in the property header as a
 * badge, or as a standalone card near the insurability panel.
 *
 * Spec: docs/gtm/value-add-activities/04-bind-path-indicator.md
 */
export function BindPathBadge({ bindPath, variant = 'card', className = '' }: BindPathBadgeProps) {
  const config = CONFIG[bindPath.level]
  const Icon = config.icon

  if (variant === 'badge') {
    return (
      <span
        role="status"
        aria-label={config.ariaLabel}
        className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold ${config.container} ${className}`}
      >
        <Icon className={`h-3.5 w-3.5 ${config.iconClass}`} aria-hidden="true" />
        {config.label}
      </span>
    )
  }

  return (
    <div
      role="status"
      aria-label={config.ariaLabel}
      className={`card flex items-start gap-3 border p-4 ${config.container} ${className}`}
    >
      <Icon className={`h-6 w-6 shrink-0 ${config.iconClass}`} aria-hidden="true" />
      <div className="flex-1">
        <p className="text-xs font-semibold uppercase tracking-wide opacity-80">Bind Path</p>
        <p className="text-base font-bold">{config.label}</p>
        <p className="mt-1 text-sm opacity-90">{bindPath.reason}</p>
      </div>
    </div>
  )
}
