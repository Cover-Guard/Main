import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { SidebarLayout } from '@/components/layout/SidebarLayout'
import { NewCheckPage } from '@/components/search/NewCheckPage'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Search a Property' }

export default async function CheckPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  return (
    <SidebarLayout>
      <NewCheckPage />
    </SidebarLayout>
  )
}
