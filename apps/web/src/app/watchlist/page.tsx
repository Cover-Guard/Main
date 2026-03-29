import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { SidebarLayout } from '@/components/layout/SidebarLayout'
import { RiskWatchlistDashboard } from '@/components/watchlist/RiskWatchlistDashboard'

export const metadata: Metadata = { title: 'Risk Watchlist' }

export default async function WatchlistPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  return (
    <SidebarLayout>
      <RiskWatchlistDashboard />
    </SidebarLayout>
  )
}
