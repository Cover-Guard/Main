import Link from 'next/link'
import { AlertTriangle } from 'lucide-react'

export function DummyReportBanner() {
  return (
    <div className="border-b border-amber-300 bg-amber-50">
      <div className="mx-auto max-w-7xl px-4 py-3">
        <div className="flex items-start gap-3">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-amber-800">
              Sample Property Report
            </p>
            <p className="mt-0.5 text-sm text-amber-700">
              We couldn&apos;t load the requested property. This is a demo report
              showing all the data points available in a CoverGuard property
              report &mdash; risk scores, insurance estimates, carrier
              availability, and more.
            </p>
            <Link
              href="/search"
              className="mt-2 inline-block rounded-md bg-amber-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-amber-700 transition-colors"
            >
              Search for a property
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
