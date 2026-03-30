import { SidebarLayout } from '@/components/layout/SidebarLayout'
import { QuoteRequestsPanel } from '@/components/quotes/QuoteRequestsPanel'

export const metadata = { title: 'Quote Requests | CoverGuard' }

export default function QuotesPage() {
  return (
    <SidebarLayout>
      <div className="min-h-screen bg-[#f2f4f7]">
        <div className="mx-auto max-w-4xl px-4 py-8">
          <QuoteRequestsPanel />
        </div>
      </div>
    </SidebarLayout>
  )
}
