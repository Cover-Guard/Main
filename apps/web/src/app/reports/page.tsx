import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { SidebarLayout } from '@/components/layout/SidebarLayout'
import { ReportsContent } from '@/components/reports/ReportsContent'

export const metadata: Metadata = { title: 'Reports — CoverGuard' }

export default async function ReportsPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  return (
    <SidebarLayout>
      <ReportsContent />
    </SidebarLayout>
  )
}
