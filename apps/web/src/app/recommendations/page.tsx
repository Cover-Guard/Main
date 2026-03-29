import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { SidebarLayout } from '@/components/layout/SidebarLayout'
import { RecommendationsDashboard } from '@/components/recommendations/RecommendationsDashboard'

export const metadata: Metadata = { title: 'Property Recommendations' }

export default async function RecommendationsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  return (
    <SidebarLayout>
      <RecommendationsDashboard />
    </SidebarLayout>
  )
}
