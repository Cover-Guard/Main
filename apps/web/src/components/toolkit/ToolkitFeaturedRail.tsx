'use client'

import { useEffect, useState } from 'react'
import {
  DollarSign,
  Building2,
  Mail,
  ArrowRight,
  Sparkles,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { MOCK_PROPERTIES } from '@/lib/mockData'

export interface ToolkitFeaturedRailProps {
  /** Scroll the page to the cost-estimator tool and open it. */
  onOpenCostEstimator?: () => void
  /** Scroll the page to the hard market tool and open it. */
  onOpenHardMarket?: () => void
  /** Scroll the page to the email templates tool and open it. */
  onOpenEmailTemplates?: () => void
  /** Whether demo mode is active (drives the "based on demo data" hint). */
  demoMode?: boolean
  className?: string
}

/**
 * Featured rail shown above the Toolkit tool grid.
 *
 * Highlights the three highest-value tools with a realistic preview each —
 * so a new user sees *what the tool does* before deciding to open it.
 * Previews are sourced from MOCK_PROPERTIES so the numbers match the Hard
 * Market Lookup dataset.
 */
export function ToolkitFeaturedRail({
  onOpenCostEstimator,
  onOpenHardMarket,
  onOpenEmailTemplates,
  demoMode = false,
  className,
}: ToolkitFeaturedRailProps) {
  // Hydration-safe gate: the rail is a client component, but we only want
  // the "based on demo data" hint to render after the first client mount so
  // an SSR-rendered page never mismatches a hydrated one. We intentionally
  // call setState once in an effect to flip from the SSR-stable `false` to
  // the hydrated-stable `true`; cascading renders are not a concern here.
  const [hydrated, setHydrated] = useState(false)
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setHydrated(true)
  }, [])

  const miamiBeach = MOCK_PROPERTIES.find((p) => p.city === 'Miami Beach')
  const palisades = MOCK_PROPERTIES.find((p) => p.city === 'Pacific Palisades')

  return (
    <section className={cn('mb-5', className)}>
      <div className="mb-2 flex items-center gap-2">
        <Sparkles className="h-3.5 w-3.5 text-brand-600" />
        <span className="text-caption font-semibold uppercase tracking-wide text-muted-foreground">
          Featured tools
        </span>
        {hydrated && demoMode ? (
          <span className="text-caption text-muted-foreground">
            · previews based on demo data
          </span>
        ) : null}
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <FeatureCard
          icon={<DollarSign className="h-4 w-4 text-emerald-600" />}
          iconBg="bg-emerald-50"
          title="Cost Estimator"
          description="State-adjusted annual premium and carrier count, seconds after you type an address."
          onClick={onOpenCostEstimator}
        >
          <PreviewRow label="Example" value="$750k Miami Beach, FL" />
          <PreviewRow
            label="Est. annual premium"
            value={miamiBeach ? `$${miamiBeach.estimatedPremium.toLocaleString()}` : '$14,200'}
            emphasized
          />
          <PreviewRow
            label="Carriers writing"
            value={miamiBeach ? `${miamiBeach.carrierCount} active` : '2 active'}
          />
        </FeatureCard>

        <FeatureCard
          icon={<Building2 className="h-4 w-4 text-orange-600" />}
          iconBg="bg-orange-50"
          title="Hard Market Lookup"
          description="See the insurability status of any state — crisis, hard, moderate, or soft — before you show a property."
          onClick={onOpenHardMarket}
        >
          <PreviewRow label="Example" value="California" />
          <PreviewRow
            label="Market status"
            value={
              <span className="rounded-full bg-red-100 px-2 py-0.5 text-caption font-semibold text-red-700">
                Crisis
              </span>
            }
          />
          <PreviewRow
            label="Recent premium jump"
            value={palisades ? `+340% (Palisades)` : '+340%'}
          />
        </FeatureCard>

        <FeatureCard
          icon={<Mail className="h-4 w-4 text-brand-600" />}
          iconBg="bg-brand-50"
          title="Email Templates"
          description="Pre-written disclosures, buyer warnings, and follow-ups you can paste into any inbox."
          onClick={onOpenEmailTemplates}
        >
          <PreviewRow label="Popular" value="Buyer insurance warning" />
          <PreviewRow label="Length" value="~180 words" />
          <PreviewRow label="Tone" value="Direct, advisor-style" />
        </FeatureCard>
      </div>
    </section>
  )
}

export default ToolkitFeaturedRail

// ─── Internal ────────────────────────────────────────────────────────────────

interface FeatureCardProps {
  icon: React.ReactNode
  iconBg: string
  title: string
  description: string
  onClick?: () => void
  children: React.ReactNode
}

function FeatureCard({ icon, iconBg, title, description, onClick, children }: FeatureCardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex h-full flex-col gap-3 rounded-xl border border-border bg-background p-4 text-left shadow-panel transition-all hover:border-brand-200 hover:shadow-panel-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
    >
      <div className="flex items-start gap-3">
        <div className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-lg', iconBg)}>
          {icon}
        </div>
        <div className="flex-1">
          <p className="text-subheading text-foreground">{title}</p>
          <p className="mt-1 text-caption text-muted-foreground">{description}</p>
        </div>
      </div>

      <div className="space-y-1 rounded-lg bg-muted/50 p-3">{children}</div>

      <div className="flex items-center justify-end gap-1 text-caption font-semibold text-brand-600">
        Open tool
        <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5" />
      </div>
    </button>
  )
}

interface PreviewRowProps {
  label: string
  value: React.ReactNode
  emphasized?: boolean
}

function PreviewRow({ label, value, emphasized }: PreviewRowProps) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-caption text-muted-foreground">{label}</span>
      <span
        className={cn(
          'text-caption text-foreground',
          emphasized && 'font-semibold',
        )}
      >
        {value}
      </span>
    </div>
  )
}
