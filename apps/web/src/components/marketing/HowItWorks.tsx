import { Search, BarChart3, Building2, CheckCircle2 } from 'lucide-react'

const steps = [
  {
    icon: Search,
    step: '01',
    title: 'Enter Any Property Address',
    description:
      'Before your client makes a move, run the check. Enter any U.S. address to instantly pull property details and match them against CoverGuard\'s federal and state risk database.',
  },
  {
    icon: BarChart3,
    step: '02',
    title: 'Get a 90-Second Risk Report',
    description:
      'CoverGuard pulls from FEMA flood maps, USGS seismic data, NOAA wind and hurricane risk, Cal Fire severity zones, and FBI crime stats — all in one multi-peril report in under 90 seconds.',
  },
  {
    icon: Building2,
    step: '03',
    title: 'See Which Carriers Are Still Writing',
    description:
      'Check the real-time carrier dashboard for that specific ZIP code and risk profile. Know exactly which insurers are actively binding policies — and which ones have exited the market.',
  },
  {
    icon: CheckCircle2,
    step: '04',
    title: 'Request a Binding Quote',
    description:
      'Send a quote request directly to active carriers on the platform. No more calling around. Go from insurability check to binding quote request in one workflow — before the offer is signed.',
  },
]

export function HowItWorks() {
  return (
    <section className="py-24 bg-gray-50">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Section header */}
        <div className="text-center max-w-3xl mx-auto">
          <p className="text-sm font-semibold text-brand-600 uppercase tracking-wider">How It Works</p>
          <h2 className="mt-3 text-3xl sm:text-4xl font-bold text-gray-900">
            From address to insured — in minutes
          </h2>
          <p className="mt-4 text-lg text-gray-600">
            CoverGuard fits directly into your existing workflow — whether you&apos;re buying a home,
            closing a deal, approving a loan, or writing a policy.
          </p>
        </div>

        {/* Steps grid */}
        <div className="mt-16 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
          {steps.map((item, index) => (
            <div key={item.step} className="relative">
              {/* Connector line */}
              {index < steps.length - 1 && (
                <div className="hidden lg:block absolute top-6 left-[calc(50%+2rem)] right-[-calc(50%-2rem)] h-px bg-gray-200" />
              )}
              <div className="relative flex flex-col items-start p-6 rounded-2xl bg-white border border-gray-200 hover:border-brand-200 hover:shadow-md transition-all duration-300">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50">
                    <item.icon className="h-5 w-5 text-brand-600" />
                  </div>
                  <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-brand-600 text-xs font-bold text-white">
                    {item.step}
                  </span>
                </div>
                <h3 className="mt-6 text-lg font-semibold text-gray-900">{item.title}</h3>
                <p className="mt-2 text-sm text-gray-600 leading-relaxed">{item.description}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Use-case cards — one per industry segment */}
        <div className="mt-20">
          <h3 className="text-center text-xl font-semibold text-gray-900 mb-8">
            Built for every role in real estate
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              {
                title: 'Home Buyers',
                description: 'Buying a home? Check property risks and insurance availability before you make an offer. Start free — your first 3 reports are on us.',
                tag: 'Free to Start',
              },
              {
                title: 'Residential Agents & Brokers',
                description: 'Run a pre-offer insurability check on every listing. Stop deals from falling through at the closing table because of insurance surprises.',
                tag: 'Most Popular',
              },
              {
                title: 'CRE Agents & Brokers',
                description: 'Evaluate commercial property risk, environmental exposure, and carrier availability for commercial deals — before investor due diligence.',
                tag: 'Commercial',
              },
              {
                title: 'Lenders',
                description: 'Verify insurability before loan commitment. Eliminate last-minute closing delays caused by properties that can\'t secure adequate coverage.',
                tag: 'Lender Portal',
              },
              {
                title: 'Insurance Brokers',
                description: 'Pre-qualify inbound leads, screen portfolios for risk exposure, and integrate CoverGuard risk data into your underwriting workflow via API.',
                tag: 'Broker Ready',
              },
            ].map((card) => (
              <div key={card.title} className="rounded-2xl bg-white border border-gray-200 p-6 hover:border-brand-200 hover:shadow-md transition-all duration-300">
                <span className="inline-flex items-center rounded-full bg-brand-50 px-3 py-1 text-xs font-medium text-brand-700">
                  {card.tag}
                </span>
                <h3 className="mt-4 text-lg font-semibold text-gray-900">{card.title}</h3>
                <p className="mt-2 text-sm text-gray-600 leading-relaxed">{card.description}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
