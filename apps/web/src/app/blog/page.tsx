import type { Metadata } from 'next'
import Link from 'next/link'
import { MarketingNav, MarketingFooter, FooterPagesNav } from '@/components/marketing'
import { ArrowRight } from 'lucide-react'

export const metadata: Metadata = {
  title: 'Blog — CoverGuard',
  description: 'Insights on property insurance, risk intelligence, and real-estate technology from the CoverGuard team.',
}

const posts = [
  { title: 'Why Pre-Offer Insurance Checks Save Deals', excerpt: 'Discover how running an insurability report before making an offer can prevent last-minute surprises and protect your clients.', date: 'Coming Soon', slug: '#' },
  { title: 'Understanding Flood Zones: A, V, X and What They Mean', excerpt: 'A plain-English guide to FEMA flood zone designations and how they affect carrier availability and premium estimates.', date: 'Coming Soon', slug: '#' },
  { title: 'Carrier Appetite Shifts in 2026: What Agents Need to Know', excerpt: 'An overview of which carriers are expanding and contracting in high-risk coastal, wildfire, and wind markets.', date: 'Coming Soon', slug: '#' },
]

export default function BlogPage() {
  return (
    <>
      <MarketingNav />
      <FooterPagesNav />
      <main className="min-h-screen bg-white">
        <section className="bg-gradient-to-br from-brand-700 via-brand-800 to-brand-900 text-white">
          <div className="mx-auto max-w-5xl px-4 py-20 text-center">
            <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl">Blog</h1>
            <p className="mx-auto mt-6 max-w-2xl text-lg text-brand-100">Insights on property insurance, risk data, and the technology transforming real-estate transactions.</p>
          </div>
        </section>
        <section className="mx-auto max-w-4xl px-4 py-20">
          <div className="space-y-10">
            {posts.map((post) => (
              <article key={post.title} className="group border-b border-gray-100 pb-10 last:border-0">
                <p className="text-sm font-medium text-brand-600">{post.date}</p>
                <h2 className="mt-2 text-xl font-bold text-gray-900 group-hover:text-brand-700 transition-colors">{post.title}</h2>
                <p className="mt-3 text-gray-600 leading-relaxed">{post.excerpt}</p>
                <Link href={post.slug} className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-brand-600 hover:text-brand-700">Read more <ArrowRight className="h-3 w-3" /></Link>
              </article>
            ))}
          </div>
        </section>
      </main>
      <MarketingFooter />
    </>
  )
}
