import type { Metadata } from 'next'
import { NewCheckPage } from '@/components/search/NewCheckPage'
import { SidebarLayout } from '@/components/layout/SidebarLayout'

export const metadata: Metadata = { title: 'New Check — CoverGuard' }

export default function HomePage() {
  return (
    <SidebarLayout>
      <NewCheckPage />
    </SidebarLayout>
  )
}
