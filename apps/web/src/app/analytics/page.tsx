import { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { SidebarLayout } from '@/components/layout/SidebarLayout'
import { AnalyticsWithGate } from '@/components/analytics/AnalyticsWithGate'

export const metadata: Metadata = { title: 'Analytics & Reports — CoverGuard' }

export default async function AnalyticsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  return (
    <SidebarLayout>
      <AnalyticsWithGate />
    </SidebarLayout>
  )
}
