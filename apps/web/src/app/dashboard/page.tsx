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

  // Determine user role from Supabase auth metadata (set during registration/OAuth).
  // This avoids a server-side API call to /api/auth/me that added ~50-200ms to every
  // dashboard page load. The role in user_metadata is authoritative — it's set by the
  // register endpoint and the OAuth callback's role update.
  const VALID_ROLES = ['BUYER', 'AGENT', 'LENDER', 'INSURANCE', 'ADMIN'] as const
  type Role = (typeof VALID_ROLES)[number]
  const metadataRole = user.user_metadata?.role as string | undefined
  const userRole: Role = metadataRole && (VALID_ROLES as readonly string[]).includes(metadataRole)
    ? metadataRole as Role
    : 'BUYER'

  const isAgent = userRole === 'AGENT' || userRole === 'LENDER' || userRole === 'INSURANCE' || userRole === 'ADMIN'

  return (
    <SidebarLayout>
      <DashboardWithTabs>
        {isAgent ? <AgentDashboard /> : <ConsumerDashboard />}
      </DashboardWithTabs>
    </SidebarLayout>
  )
}
