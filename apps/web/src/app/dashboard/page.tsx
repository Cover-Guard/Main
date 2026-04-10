import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { SidebarLayout } from '@/components/layout/SidebarLayout'
import { UnifiedDashboard } from '@/components/dashboard/UnifiedDashboard'

export const metadata: Metadata = { title: 'Dashboard' }

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Determine user role from Supabase auth metadata (set during registration/OAuth).
  // The role in user_metadata is authoritative — it's set by the register endpoint
  // and the OAuth callback's role update.
  const VALID_ROLES = ['BUYER', 'AGENT', 'LENDER', 'INSURANCE', 'ADMIN'] as const
  type Role = (typeof VALID_ROLES)[number]
  const metadataRole = user.user_metadata?.role as string | undefined
  const userRole: Role = metadataRole && (VALID_ROLES as readonly string[]).includes(metadataRole)
    ? (metadataRole as Role)
    : 'BUYER'

  // Optional: distinguish residential vs commercial agents via user_metadata.agentFlavor
  const agentFlavor =
    (user.user_metadata?.agentFlavor as 'RESIDENTIAL' | 'CRE' | undefined) ?? 'RESIDENTIAL'

  const userName =
    (user.user_metadata?.firstName as string | undefined) ??
    (user.user_metadata?.full_name as string | undefined)?.split(' ')[0] ??
    undefined

  return (
    <SidebarLayout>
      <UnifiedDashboard role={userRole} userName={userName} agentFlavor={agentFlavor} />
    </SidebarLayout>
  )
}
