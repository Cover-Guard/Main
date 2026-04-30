import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { SidebarLayout } from '@/components/layout/SidebarLayout'
import { InAppHelp } from '@/components/help/InAppHelp'

export const metadata: Metadata = { title: 'Help' }

export default async function InAppHelpPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  return (
    <SidebarLayout>
      <InAppHelp />
    </SidebarLayout>
  )
}
