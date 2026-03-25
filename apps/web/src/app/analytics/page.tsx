import { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { SidebarLayout } from '@/components/layout/SidebarLayout'
import { AnalyticsDashboard } from '@/components/analytics/AnalyticsDashboard'

export const metadata: Metadata = { title: 'Analytics & Reports — CoverGuard' }

export default async function AnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { tab } = await searchParams

  return (
    <SidebarLayout>
      <AnalyticsDashboard initialTab={tab === 'reports' ? 'reports' : undefined} />
    </SidebarLayout>
  )
}
