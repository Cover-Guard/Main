export function InvestorsSection() {
  return (
    <section id="investors" className="py-24 bg-gray-50">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Section header */}
        <div className="text-center max-w-3xl mx-auto">
          <p className="text-sm font-semibold text-brand-600 uppercase tracking-wider">Investors</p>
          <h2 className="mt-3 text-3xl sm:text-4xl font-bold text-gray-900">
            Interested in investing?
          </h2>
          <p className="mt-4 text-lg text-gray-600">
            We&apos;re building the data infrastructure layer for property insurance decisions.
            If you&apos;re interested in learning more about investment opportunities, we&apos;d love to hear from you.
          </p>
        </div>

        {/* CTA */}
        <div className="mt-12 text-center">
          <a
            href="mailto:investor@coverguard.io"
            className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-8 py-4 text-lg font-semibold text-white shadow-sm hover:bg-brand-700 transition-colors"
          >
            Reach out to us
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z" />
              <path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z" />
            </svg>
          </a>
          <p className="mt-4 text-sm text-gray-500">
            investor@coverguard.io
          </p>
        </div>
      </div>
    </section>
  )
}
