import type { Metadata } from 'next'
import { SidebarLayout } from '@/components/layout/SidebarLayout'
import { CompareView } from '@/components/compare/CompareView'

export const metadata: Metadata = { title: 'Compare Properties — CoverGuard' }

export default function ComparePage() {
  return (
    <SidebarLayout>
      <CompareView />
    </SidebarLayout>
  )
}
