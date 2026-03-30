import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { SidebarLayout } from '@/components/layout/SidebarLayout'
import { RiskAlertsPanel } from '@/components/alerts/RiskAlertsPanel'

export const metadata: Metadata = { title: 'Risk Alerts' }

export default async function AlertsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  return (
    <SidebarLayout>
      <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
        <RiskAlertsPanel />
      </div>
    </SidebarLayout>
  )
}
