import type { Metadata } from 'next'
import { FileText, Send, CheckSquare } from 'lucide-react'
import { ProductPageTemplate, type ProductFeature } from '@/components/marketing'

export const metadata: Metadata = {
  title: 'Quote Requests — CoverGuard',
  description:
    'Request binding insurance quotes from active carriers — directly from the CoverGuard platform.',
}

const steps: ProductFeature[] = [
  {
    icon: FileText,
    step: 1,
    title: 'Review the risk profile',
    desc: 'Confirm flood, fire, wind, earthquake, and crime exposure for the property.',
  },
  {
    icon: CheckSquare,
    step: 2,
    title: 'Pick an active carrier',
    desc: 'Choose from carriers actually writing in the ZIP — no wasted calls.',
  },
  {
    icon: Send,
    step: 3,
    title: 'Send the quote request',
    desc: 'Submit the property details and receive a binding quote from the carrier directly.',
  },
]

export default function QuoteRequestsPage() {
  return (
    <ProductPageTemplate
      badge="Quote Requests"
      headingLead="From risk check to binding quote —"
      headingAccent="in minutes"
      subtitle="After you've verified insurability and seen which carriers are active, request a binding quote right from the property page — no separate portals, no phone tag."
      ctaLabel="Request Your First Quote"
      ctaHref="/get-started"
      sectionTitle="Three steps to a binding quote"
      features={steps}
      gridClassName="grid-cols-1 md:grid-cols-3"
    />
  )
}
