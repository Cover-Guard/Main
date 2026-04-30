'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import {
  Search,
  ChevronDown,
  Map as MapIcon,
  FileText,
  Users,
  CreditCard,
  Mail,
  ExternalLink,
  HelpCircle,
} from 'lucide-react'
import { cn } from '@/lib/utils'

// In-app help is intentionally lightweight â€” it lives inside SidebarLayout and
// answers the questions users actually ask once they're already signed in.
// For deeper documentation (signup walkthroughs, marketing FAQs, the AI Help
// Advisor) we link out to the public Help Center at /help.

const quickActions = [
  {
    icon: MapIcon,
    title: 'Run a property search',
    body: 'Enter an address to see flood, fire, wind, and earthquake risk plus carrier availability.',
    href: '/check',
    cta: 'Open Search',
  },
  {
    icon: FileText,
    title: 'Generate a report',
    body: 'Build a branded insurability PDF you can share with a client or lender.',
    href: '/reports',
    cta: 'Go to Reports',
  },
  {
    icon: Users,
    title: 'Invite a teammate',
    body: 'Add agents or brokers to your workspace and share saved properties.',
    href: '/account',
    cta: 'Manage team',
  },
  {
    icon: CreditCard,
    title: 'Plan & billing',
    body: 'Update payment details, change your plan, or download invoices.',
    href: '/account',
    cta: 'Account settings',
  },
]

type FAQ = {
  q: string
  a: string
}

const faqs: FAQ[] = [
  {
    q: 'How do I add a new property to my dashboard?',
    a: 'From Search, look up an address and tap "Save to dashboard". The property is pinned to your portfolio and starts tracking carrier and risk changes from that moment forward.',
  },
  {
    q: 'How are insurability scores calculated?',
    a: 'Scores combine peril-specific risk (flood, fire, wind, earthquake), historical claims in the area, and current carrier appetite. You can see the per-peril breakdown by opening any property and expanding the Score panel.',
  },
  {
    q: 'A carrier I expected is missing from a property\'s list. Why?',
    a: 'Carrier availability reflects each insurer\'s current appetite for the address based on peril exposure, build details, and ZIP-level filings. If you believe a carrier should be available, use the "Report missing carrier" link on the property page so we can investigate.',
  },
  {
    q: 'Can I share a report with a client who doesn\'t have a CoverGuard account?',
    a: 'Yes. From any property, choose Reports â†’ Share. You can send a view-only link or download a branded PDF. Shared links expire after 30 days unless you set them to permanent.',
  },
  {
    q: 'How do I switch between agent, broker, and lender views?',
    a: 'Open Settings (sidebar footer or /account) and change your active role. Your dashboard layout, recommended actions, and report templates will adjust accordingly.',
  },
  {
    q: 'What does the AI Assistant know about my data?',
    a: 'The AI Assistant has access to the property, dashboard, and report context of the page you\'re currently on. It does not see other users\' workspaces or anything outside your account.',
  },
  {
    q: 'How do I export my data?',
    a: 'Go to Settings â†’ Data export. You can request a CSV of your saved properties and reports; we email a download link within a few minutes.',
  },
  {
    q: 'Why did my dashboard scores change overnight?',
    a: 'Scores re-run when underlying data updates â€” new claims filings, FEMA map revisions, carrier appetite shifts, or wildfire perimeter changes. Open the property and check "Recent changes" for a per-property changelog.',
  },
]

export function InAppHelp() {
  const [query, setQuery] = useState('')
  const [openIdx, setOpenIdx] = useState<number | null>(null)

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return faqs
    return faqs.filter(
      (f) => f.q.toLowerCase().includes(q) || f.a.toLowerCase().includes(q),
    )
  }, [query])

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-8 md:px-8 md:py-10">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-teal-600">
          <HelpCircle className="h-3.5 w-3.5" />
          Help
        </div>
        <h1 className="mt-1 text-2xl font-bold text-gray-900 md:text-3xl">
          How can we help?
        </h1>
        <p className="mt-1 text-sm text-gray-600 md:text-base">
          Quick answers for everything inside CoverGuard. Looking for product
          info or signup help?{' '}
          <Link
            href="/help"
            className="inline-flex items-center gap-1 font-medium text-teal-700 hover:text-teal-800"
          >
            Visit the full Help Center
            <ExternalLink className="h-3 w-3" />
          </Link>
          .
        </p>
      </div>

      {/* Search */}
      <div className="relative mb-8">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search help topicsâ€¦"
          aria-label="Search help topics"
          className="w-full rounded-lg border border-gray-200 bg-white py-2.5 pl-10 pr-3 text-sm text-gray-900 placeholder:text-gray-400 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20"
        />
      </div>

      {/* Quick actions */}
      <section className="mb-10">
        <h2 className="mb-3 text-sm font-semibold text-gray-900">
          Common tasks
        </h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {quickActions.map(({ icon: Icon, title, body, href, cta }) => (
            <Link
              key={title}
              href={href}
              className="group rounded-lg border border-gray-200 bg-white p-4 transition-colors hover:border-teal-500 hover:bg-teal-50/30"
            >
              <div className="mb-2 flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-md bg-teal-100 text-teal-700">
                  <Icon className="h-4 w-4" />
                </div>
                <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
              </div>
              <p className="text-xs leading-relaxed text-gray-600">{body}</p>
              <span className="mt-2 inline-block text-xs font-semibold text-teal-700 group-hover:text-teal-800">
                {cta} â†’
              </span>
            </Link>
          ))}
        </div>
      </section>

      {/* FAQs */}
      <section className="mb-10">
        <h2 className="mb-3 text-sm font-semibold text-gray-900">
          Frequently asked
        </h2>
        {filtered.length === 0 ? (
          <p className="rounded-lg border border-dashed border-gray-200 bg-gray-50 p-6 text-center text-sm text-gray-600">
            No topics match{' '}
            <span className="font-mono text-gray-900">&ldquo;{query}&rdquo;</span>. Try a
            different keyword, or{' '}
            <Link href="/contact" className="font-medium text-teal-700 hover:text-teal-800">
              contact support
            </Link>
            .
          </p>
        ) : (
          <ul className="divide-y divide-gray-200 rounded-lg border border-gray-200 bg-white">
            {filtered.map((f, i) => {
              const open = openIdx === i
              return (
                <li key={f.q}>
                  <button
                    type="button"
                    onClick={() => setOpenIdx(open ? null : i)}
                    aria-expanded={open}
                    className="flex w-full items-center justify-between gap-4 px-4 py-3 text-left hover:bg-gray-50"
                  >
                    <span className="text-sm font-medium text-gray-900">
                      {f.q}
                    </span>
                    <ChevronDown
                      className={cn(
                        'h-4 w-4 shrink-0 text-gray-400 transition-transform',
                        open && 'rotate-180',
                      )}
                    />
                  </button>
                  {open && (
                    <div className="border-t border-gray-100 bg-gray-50 px-4 py-3 text-sm leading-relaxed text-gray-700">
                      {f.a}
                    </div>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </section>

      {/* Contact */}
      <section className="rounded-lg border border-gray-200 bg-gray-50 p-5">
        <div className="flex items-start gap-3">
          <Mail className="mt-0.5 h-4 w-4 shrink-0 text-teal-700" />
          <div>
            <h3 className="text-sm font-semibold text-gray-900">
              Still stuck?
            </h3>
            <p className="mt-1 text-sm text-gray-600">
              Use the AI Assistant in the sidebar for instant help, or{' '}
              <Link
                href="/contact"
                className="font-medium text-teal-700 hover:text-teal-800"
              >
                reach our support team
              </Link>
              .
            </p>
          </div>
        </div>
      </section>
    </div>
  )
}
