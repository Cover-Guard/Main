import type { Metadata } from 'next'
import { Flame, Waves, Wind, Activity, Shield } from 'lucide-react'
import { ProductPageTemplate, type ProductFeature } from '@/components/marketing'

export const metadata: Metadata = {
  title: 'Risk Intelligence — CoverGuard',
  description:
    'Comprehensive property risk profiles combining FEMA, USGS, Cal Fire, NOAA, FBI, and ASCE data into one instant report.',
}

const perils: ProductFeature[] = [
  {
    icon: Waves,
    title: 'Flood',
    desc: 'FEMA NFHL zones, SFHA status, BFE, and OpenFEMA historical claims by ZIP.',
  },
  {
    icon: Flame,
    title: 'Fire',
    desc: 'Cal Fire FHSZ for California and USFS Wildland-Urban Interface nationwide.',
  },
  {
    icon: Wind,
    title: 'Wind',
    desc: 'ASCE 7 design wind speeds and NOAA SLOSH hurricane surge zones for coastal homes.',
  },
  {
    icon: Activity,
    title: 'Earthquake',
    desc: 'USGS ASCE 7-22 spectral acceleration values for seismic design.',
  },
  {
    icon: Shield,
    title: 'Crime',
    desc: 'FBI Crime Data Explorer rates by agency and jurisdiction.',
  },
]

export default function RiskIntelligencePage() {
  return (
    <ProductPageTemplate
      badge="Risk Intelligence"
      headingLead="Every peril. Every property."
      headingAccent="In one report."
      subtitle="CoverGuard pulls flood, fire, wind, earthquake, and crime data from authoritative public sources — and combines them into a single risk profile in under 90 seconds."
      ctaLabel="Check a Property Free"
      ctaHref="/get-started"
      sectionTitle="Five perils, one unified score"
      features={perils}
    />
  )
}
