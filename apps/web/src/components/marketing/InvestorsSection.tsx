const investors = [
  { name: 'Meridian Ventures', type: 'Lead Seed Investor' },
  { name: 'Clocktower Capital', type: 'Insurtech Fund' },
  { name: 'Frontier Partners', type: 'Series A Lead' },
  { name: 'Apex Growth', type: 'Growth Equity' },
  { name: 'Lumen Labs', type: 'PropTech Accelerator' },
  { name: 'Highline Capital', type: 'Strategic Investor' },
]

const milestones = [
  { metric: '$18M', label: 'Total Raised' },
  { metric: 'Series A', label: 'Current Stage' },
  { metric: '2023', label: 'Founded' },
  { metric: '42', label: 'Team Members' },
]

export function InvestorsSection() {
  return (
    <section id="investors" className="py-24 bg-gray-50">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Section header */}
        <div className="text-center max-w-3xl mx-auto">
          <p className="text-sm font-semibold text-brand-600 uppercase tracking-wider">Investors</p>
          <h2 className="mt-3 text-3xl sm:text-4xl font-bold text-gray-900">
            Backed by leading insurtech and proptech investors
          </h2>
          <p className="mt-4 text-lg text-gray-600">
            We&apos;re building the data infrastructure layer for property insurance decisions,
            backed by investors who understand the opportunity.
          </p>
        </div>

        {/* Milestones */}
        <div className="mt-14 grid grid-cols-2 md:grid-cols-4 gap-6 max-w-3xl mx-auto">
          {milestones.map((item) => (
            <div key={item.label} className="text-center">
              <div className="text-3xl font-bold text-brand-600">{item.metric}</div>
              <div className="text-sm text-gray-500 mt-1">{item.label}</div>
            </div>
          ))}
        </div>

        {/* Investor grid */}
        <div className="mt-16 grid grid-cols-2 md:grid-cols-3 gap-4">
          {investors.map((investor) => (
            <div
              key={investor.name}
              className="flex flex-col items-center justify-center rounded-xl border border-gray-200 bg-white p-8 hover:border-brand-200 transition-colors"
            >
              <div className="h-12 w-12 rounded-lg bg-gray-100 flex items-center justify-center mb-4">
                <span className="text-lg font-bold text-gray-400">
                  {investor.name.split(' ').map((w) => w[0]).join('')}
                </span>
              </div>
              <h3 className="text-base font-semibold text-gray-900">{investor.name}</h3>
              <p className="text-sm text-gray-500 mt-1">{investor.type}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
