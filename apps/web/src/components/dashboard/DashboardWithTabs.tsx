'use client'

import { Suspense } from 'react'
import { useSearchParams, useRouter, usePathname } from 'next/navigation'
import { LayoutDashboard, GitCompare } from 'lucide-react'
import { cn } from '@/lib/utils'
import { CompareView } from '@/components/compare/CompareView'

const tabs = [
  { key: 'overview', label: 'Overview', icon: LayoutDashboard },
  { key: 'compare', label: 'Compare', icon: GitCompare },
] as const

type TabKey = (typeof tabs)[number]['key']

export function DashboardWithTabs({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<div className="p-8">{children}</div>}>
      <DashboardTabsInner>{children}</DashboardTabsInner>
    </Suspense>
  )
}

function DashboardTabsInner({ children }: { children: React.ReactNode }) {
  const searchParams = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()

  const activeTab = (searchParams.get('tab') as TabKey) || 'overview'

  function setTab(key: TabKey) {
    const params = new URLSearchParams(searchParams.toString())
    if (key === 'overview') {
      params.delete('tab')
    } else {
      params.set('tab', key)
    }
    const qs = params.toString()
    router.push(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
  }

  return (
    <div>
      {/* Tab bar */}
      <div className="bg-white border-b border-gray-200 px-6">
        <div className="max-w-5xl mx-auto flex gap-1">
          {tabs.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={cn(
                'flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors',
                activeTab === key
                  ? 'border-teal-500 text-teal-700'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              )}
            >
              <Icon className="h-4 w-4" />
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab content */}
      {activeTab === 'overview' ? children : <CompareView />}
    </div>
  )
}
