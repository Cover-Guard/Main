import {
  Droplets,
  Flame,
  Wind,
  Mountain,
  ShieldAlert,
  Clock,
  Building2,
  AlertTriangle,
} from 'lucide-react'

const risks = [
  { icon: Droplets, label: 'Flood', color: 'text-blue-500', bg: 'bg-blue-50' },
  { icon: Flame, label: 'Fire', color: 'text-orange-500', bg: 'bg-orange-50' },
  { icon: Mountain, label: 'Earthquake', color: 'text-amber-600', bg: 'bg-amber-50' },
  { icon: Wind, label: 'Wind', color: 'text-teal-500', bg: 'bg-teal-50' },
  { icon: ShieldAlert, label: 'Crime', color: 'text-red-500', bg: 'bg-red-50' },
]

const offerings = [
  {
    step: 'STEP 01',
    icon: AlertTriangle,
    title: 'Property Risk — Done Right',
    description:
      'Composite risk scoring from 12+ public sources — FEMA, USGS, NOAA, Cal Fire, USFS, FBI, ASCE 7, and the Esri Living Atlas (flood, wildfire, hurricane tracks, drought, social vulnerability, landslide). One score, every hazard, sourced and auditable — not a black-box vendor model.',
  },
  {
    step: 'STEP 02',
    icon: Building2,
    title: 'Carrier Availability — In That ZIP',
    description:
      'State Farm, Allstate, and Farmers have pulled out of California, Florida, and Texas. We map carrier appetite to the exact ZIP and risk profile — so you know who is still writing before you waste a quote request. Updated continuously.',
  },
  {
    step: 'STEP 03',
    icon: Clock,
    title: 'Quotes & Cost-to-Insure',
    description:
      'From address lookup to a binding-ready quote in 90 seconds. CoverGuard turns the risk score and carrier list into an estimated annual premium and a one-click quote request — so the deal team knows the cost-to-insure before any offer is signed.',
  },
]

export function ProductOfferings() {
  return (
    <section id="product" className="py-24 bg-white">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Section header */}
        <div className="text-center max-w-3xl mx-auto">
          <p className="text-sm font-semibold text-brand-600 uppercase tracking-wider">How it works</p>
          <h2 className="mt-3 text-3xl sm:text-4xl font-bold text-gray-900">
            Property risk → Carrier availability → Quote
          </h2>
          <p className="mt-4 text-lg text-gray-600">
            Three steps. One platform. Built so agents, brokers, lenders, and insurers
            never get blindsided by a deal-killing insurance issue again.
          </p>
        </div>

        {/* Risk badges */}
        <div className="mt-12 flex flex-wrap items-center justify-center gap-3">
          {risks.map((risk) => (
            <div
              key={risk.label}
              className={`inline-flex items-center gap-2 rounded-full ${risk.bg} px-4 py-2`}
            >
              <risk.icon className={`h-4 w-4 ${risk.color}`} />
              <span className="text-sm font-medium text-gray-700">{risk.label}</span>
            </div>
          ))}
        </div>

        {/* Offerings grid */}
        <div className="mt-16 grid grid-cols-1 md:grid-cols-3 gap-8">
          {offerings.map((offering) => (
            <div
              key={offering.title}
              className="relative rounded-2xl border border-gray-200 bg-white p-8 hover:border-brand-200 hover:shadow-lg transition-all duration-300 group"
            >
              <span className="inline-block rounded-full bg-brand-50 px-3 py-1 text-xs font-semibold tracking-wider text-brand-700">
                {offering.step}
              </span>
              <div className="mt-4 flex h-12 w-12 items-center justify-center rounded-xl bg-brand-50 group-hover:bg-brand-100 transition-colors">
                <offering.icon className="h-6 w-6 text-brand-600" />
              </div>
              <h3 className="mt-5 text-xl font-semibold text-gray-900">{offering.title}</h3>
              <p className="mt-3 text-gray-600 leading-relaxed">{offering.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
