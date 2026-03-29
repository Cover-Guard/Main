import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { SidebarLayout } from '@/components/layout/SidebarLayout'
import { ActivityLogDashboard } from '@/components/activity/ActivityLogDashboard'

export const metadata: Metadata = { title: 'Activity Log' }

export default async function ActivityPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  return (
    <SidebarLayout>
      <ActivityLogDashboard />
    </SidebarLayout>
  )
}
