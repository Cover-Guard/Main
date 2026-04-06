import type { LucideIcon } from 'lucide-react'
import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { MarketingNav } from './MarketingNav'
import { MarketingFooter } from './MarketingFooter'

export type ProductFeature = {
  icon: LucideIcon
  title: string
  desc: string
  /** Optional step number rendered above the title. */
  step?: number
  /** Optional override for the icon chip color. Defaults to brand-50/brand-600. */
  iconClassName?: string
}

type Props = {
  badge: string
  headingLead: string
  headingAccent: string
  subtitle: string
  ctaLabel: string
  ctaHref: string
  sectionTitle: string
  features: ProductFeature[]
  /** Tailwind grid column classes for the feature grid. */
  gridClassName?: string
}

export function ProductPageTemplate({
  badge,
  headingLead,
  headingAccent,
  subtitle,
  ctaLabel,
  ctaHref,
  sectionTitle,
  features,
  gridClassName = 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3',
}: Props) {
  return (
    <div className="min-h-screen bg-white">
      <MarketingNav />

      <section className="pt-16 pb-20 bg-gradient-to-b from-brand-50/50 via-white to-white">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 rounded-full bg-brand-50 border border-brand-100 px-4 py-1.5 mb-8">
              <span className="text-sm font-medium text-brand-700">{badge}</span>
            </div>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight text-gray-900 leading-[1.1]">
              {headingLead} <span className="text-brand-600">{headingAccent}</span>
            </h1>
            <p className="mt-6 text-lg sm:text-xl text-gray-600 max-w-2xl leading-relaxed">
              {subtitle}
            </p>
            <div className="mt-10">
              <Link
                href={ctaHref}
                className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-6 py-3 text-base font-semibold text-white hover:bg-brand-700 transition-colors shadow-lg shadow-brand-600/25"
              >
                {ctaLabel}
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="py-20 bg-white">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 max-w-2xl">
            {sectionTitle}
          </h2>
          <div className={`mt-12 grid gap-6 ${gridClassName}`}>
            {features.map((feature) => (
              <div key={feature.title} className="rounded-2xl border border-gray-200 p-6">
                <div
                  className={`inline-flex h-12 w-12 items-center justify-center rounded-xl ${
                    feature.iconClassName ?? 'bg-brand-50 text-brand-600'
                  }`}
                >
                  <feature.icon className="h-6 w-6" />
                </div>
                {feature.step !== undefined && (
                  <p className="mt-4 text-sm font-medium text-brand-600">Step {feature.step}</p>
                )}
                <h3 className={`${feature.step !== undefined ? 'mt-1' : 'mt-4'} text-xl font-semibold text-gray-900`}>
                  {feature.title}
                </h3>
                <p className="mt-2 text-gray-600 leading-relaxed">{feature.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <MarketingFooter />
    </div>
  )
}
