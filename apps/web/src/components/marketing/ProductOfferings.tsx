import {
  Droplets,
  Flame,
  Wind,
  Mountain,
  ShieldAlert,
  FileSearch,
  Building2,
  FileText,
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
    icon: FileSearch,
    title: 'Risk Intelligence',
    description:
      'Comprehensive risk profiles powered by FEMA, USGS, NOAA, Cal Fire, and FBI data sources. Understand flood zones, fire severity, seismic exposure, hurricane surge, and neighborhood crime — all in one report.',
  },
  {
    icon: Building2,
    title: 'Carrier Availability',
    description:
      'See which insurance carriers are actively writing and binding policies for the property\'s specific risk profile and state. No more guessing — know exactly who will cover it before you make an offer.',
  },
  {
    icon: FileText,
    title: 'Binding Quote Requests',
    description:
      'Request a binding quote directly from active carriers on the platform. Streamline the insurance process from risk assessment to policy binding, cutting days of back-and-forth to minutes.',
  },
]

export function ProductOfferings() {
  return (
    <section id="product" className="py-24 bg-white">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Section header */}
        <div className="text-center max-w-3xl mx-auto">
          <p className="text-sm font-semibold text-brand-600 uppercase tracking-wider">Product</p>
          <h2 className="mt-3 text-3xl sm:text-4xl font-bold text-gray-900">
            Complete insurability intelligence in seconds
          </h2>
          <p className="mt-4 text-lg text-gray-600">
            CoverGuard aggregates data from 8+ federal and state sources to give you a full picture
            of property risk and insurance availability.
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
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand-50 group-hover:bg-brand-100 transition-colors">
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
