import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { SidebarLayout } from '@/components/layout/SidebarLayout'
import { ComparisonHistoryDashboard } from '@/components/comparisons/ComparisonHistoryDashboard'

export const metadata: Metadata = { title: 'Saved Comparisons' }

export default async function ComparisonsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  return (
    <SidebarLayout>
      <ComparisonHistoryDashboard />
    </SidebarLayout>
  )
}
