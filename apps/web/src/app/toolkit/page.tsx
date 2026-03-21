import type { Metadata } from 'next'
import { SidebarLayout } from '@/components/layout/SidebarLayout'
import { ToolkitContent } from '@/components/toolkit/ToolkitContent'

export const metadata: Metadata = { title: 'Agent Toolkit' }

export default function ToolkitPage() {
  return (
    <SidebarLayout>
      <ToolkitContent />
    </SidebarLayout>
  )
}
