import type { Metadata } from 'next'
import { CheckCircle2, XCircle, AlertCircle } from 'lucide-react'
import { ProductPageTemplate, type ProductFeature } from '@/components/marketing'

export const metadata: Metadata = {
  title: 'Carrier Availability — CoverGuard',
  description:
    'See which carriers are actively writing and binding new policies in any ZIP code. Stop guessing which insurers will cover your client.',
}

const statuses: ProductFeature[] = [
  {
    icon: CheckCircle2,
    title: 'Writing',
    desc: 'Carrier is actively binding new policies in this market.',
    iconClassName: 'text-green-600 bg-green-50',
  },
  {
    icon: AlertCircle,
    title: 'Restricted',
    desc: 'Carrier is writing limited business — narrow eligibility rules apply.',
    iconClassName: 'text-amber-600 bg-amber-50',
  },
  {
    icon: XCircle,
    title: 'Non-Renewing',
    desc: 'Carrier has paused or exited — new business is not being accepted.',
    iconClassName: 'text-red-600 bg-red-50',
  },
]

export default function CarrierAvailabilityPage() {
  return (
    <ProductPageTemplate
      badge="Carrier Availability"
      headingLead="Know who's writing —"
      headingAccent="before you write the offer"
      subtitle="State Farm is under CDI enforcement in California (May 2026). Florida residual rates are easing. Allstate, Farmers, and regional carriers continue to reshuffle appetite by ZIP. CoverGuard tracks which carriers are actively binding at any US address — updated continuously."
      ctaLabel="Check Carrier Availability"
      ctaHref="/get-started"
      sectionTitle="Three writing statuses, one clear answer"
      features={statuses}
      gridClassName="grid-cols-1 md:grid-cols-3"
    />
  )
}
