import { Search, BarChart3, Send, CheckCircle2 } from 'lucide-react'

const steps = [
  {
    icon: Search,
    step: '01',
    title: 'Search Any Property',
    description:
      'Enter an address, ZIP code, or parcel ID. CoverGuard pulls property details and matches them against federal and state risk databases in real time.',
  },
  {
    icon: BarChart3,
    step: '02',
    title: 'Review Risk Profile',
    description:
      'Get a comprehensive breakdown of flood, fire, earthquake, wind, and crime risk — with scores, zone classifications, and estimated insurance premiums.',
  },
  {
    icon: Send,
    step: '03',
    title: 'See Active Carriers',
    description:
      'View which insurers are currently writing policies for the property\'s risk profile and location. Filter by coverage type, premium range, and writing status.',
  },
  {
    icon: CheckCircle2,
    step: '04',
    title: 'Request a Binding Quote',
    description:
      'Submit a quote request directly to carriers from the platform. Receive competitive quotes and move toward binding — all before closing day.',
  },
]

export function HowItWorks() {
  return (
    <section id="solutions" className="py-24 bg-gray-50">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Section header */}
        <div className="text-center max-w-3xl mx-auto">
          <p className="text-sm font-semibold text-brand-600 uppercase tracking-wider">How It Works</p>
          <h2 className="mt-3 text-3xl sm:text-4xl font-bold text-gray-900">
            From search to quote in minutes
          </h2>
          <p className="mt-4 text-lg text-gray-600">
            A streamlined workflow designed for real estate professionals and home buyers
            who need answers fast.
          </p>
        </div>

        {/* Steps */}
        <div className="mt-16 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {steps.map((item, index) => (
            <div key={item.step} className="relative">
              {/* Connector line (hidden on last item and mobile) */}
              {index < steps.length - 1 && (
                <div className="hidden lg:block absolute top-10 left-[calc(50%+32px)] right-0 h-px bg-gray-300" />
              )}
              <div className="flex flex-col items-center text-center">
                <div className="relative flex h-20 w-20 items-center justify-center rounded-2xl bg-white border border-gray-200 shadow-sm">
                  <item.icon className="h-8 w-8 text-brand-600" />
                  <span className="absolute -top-2 -right-2 flex h-7 w-7 items-center justify-center rounded-full bg-brand-600 text-xs font-bold text-white">
                    {item.step}
                  </span>
                </div>
                <h3 className="mt-6 text-lg font-semibold text-gray-900">{item.title}</h3>
                <p className="mt-2 text-sm text-gray-600 leading-relaxed">{item.description}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Use-case cards */}
        <div className="mt-20 grid grid-cols-1 md:grid-cols-3 gap-6">
          {[
            {
              title: 'For Home Buyers',
              description: 'Know the true cost of owning a property before you place a bid. Avoid surprises with insurance costs that can make or break a deal.',
              tag: 'Consumer Portal',
            },
            {
              title: 'For Real Estate Agents',
              description: 'Differentiate your service by providing clients with risk-aware property intelligence. Manage clients, compare properties, and generate reports.',
              tag: 'Agent Portal',
            },
            {
              title: 'For Lenders',
              description: 'Verify insurability before underwriting. Ensure borrowers can secure required coverage and assess true risk exposure on every loan.',
              tag: 'Enterprise',
            },
          ].map((card) => (
            <div
              key={card.title}
              className="rounded-2xl bg-white border border-gray-200 p-8 hover:shadow-md transition-shadow"
            >
              <span className="inline-block rounded-full bg-brand-50 px-3 py-1 text-xs font-semibold text-brand-600">
                {card.tag}
              </span>
              <h3 className="mt-4 text-lg font-semibold text-gray-900">{card.title}</h3>
              <p className="mt-2 text-sm text-gray-600 leading-relaxed">{card.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
