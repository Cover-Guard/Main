import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { SidebarLayout } from '@/components/layout/SidebarLayout'
import { AgentDashboard } from '@/components/dashboard/AgentDashboard'
import { ConsumerDashboard } from '@/components/dashboard/ConsumerDashboard'
import { DashboardWithTabs } from '@/components/dashboard/DashboardWithTabs'

export const metadata: Metadata = { title: 'Dashboard' }

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  let userRole: 'BUYER' | 'AGENT' | 'LENDER' | 'ADMIN' = 'BUYER'
  try {
    const res = await fetch(`${process.env.API_REWRITE_URL ?? process.env.NEXT_PUBLIC_API_URL ?? ''}/api/auth/me`, {
      headers: { Authorization: `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}` },
    })
    const json = await res.json()
    if (json.success) userRole = json.data.role
  } catch {
    // default to BUYER
  }

  const isAgent = userRole === 'AGENT' || userRole === 'LENDER' || userRole === 'ADMIN'

  return (
    <SidebarLayout>
      <DashboardWithTabs>
        {isAgent ? <AgentDashboard /> : <ConsumerDashboard />}
      </DashboardWithTabs>
    </SidebarLayout>
  )
}
