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

  // Determine user role: try API first, fall back to Supabase auth metadata
  const VALID_ROLES = ['BUYER', 'AGENT', 'LENDER', 'ADMIN'] as const
  type Role = (typeof VALID_ROLES)[number]
  let userRole: Role = 'BUYER'

  try {
    const { data: { session } } = await supabase.auth.getSession()
    if (session?.access_token) {
      const res = await fetch(`${process.env.API_REWRITE_URL ?? process.env.NEXT_PUBLIC_API_URL ?? ''}/api/auth/me`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
      const json = await res.json()
      if (json.success) userRole = json.data.role
    }
  } catch {
    // API unavailable — fall back to Supabase auth metadata
    const metadataRole = user.user_metadata?.role as string | undefined
    if (metadataRole && (VALID_ROLES as readonly string[]).includes(metadataRole)) {
      userRole = metadataRole as Role
    }
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
