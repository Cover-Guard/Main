import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { SidebarLayout } from '@/components/layout/SidebarLayout'
import { QuoteRequestsDashboard } from '@/components/quotes/QuoteRequestsDashboard'

export const metadata: Metadata = { title: 'Quote Requests' }

export default async function QuotesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  return (
    <SidebarLayout>
      <QuoteRequestsDashboard />
    </SidebarLayout>
  )
}
