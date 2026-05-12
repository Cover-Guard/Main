'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Shield, Users, CreditCard, FileText, ArrowLeft } from 'lucide-react'

interface AdminSidebarProps {
  user: { firstName?: string | null; lastName?: string | null; email: string }
}

/**
 * Admin sidebar — minimal nav for the P-B5.a foundation. Today only
 * the home page exists; the disabled-look items are placeholders for
 * the per-domain admin tools that land in subsequent P-B5 follow-ups
 * (user management, subscription ops, report inspector).
 */
export function AdminSidebar({ user }: AdminSidebarProps) {
  const pathname = usePathname()
  const isActive = (href: string) => pathname === href

  return (
    <aside className="flex w-56 flex-col gap-1 border-r border-gray-200 bg-white p-4">
      <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-gray-900">
        <Shield className="h-4 w-4 text-blue-600" />
        Admin
      </div>
      <Link
        href="/admin"
        className={`rounded px-3 py-2 text-sm ${isActive('/admin') ? 'bg-blue-50 text-blue-700' : 'text-gray-700 hover:bg-gray-100'}`}
      >
        Overview
      </Link>
      <span className="rounded px-3 py-2 text-sm text-gray-400 cursor-not-allowed flex items-center gap-2" aria-disabled>
        <Users className="h-3.5 w-3.5" /> Users <em className="ml-auto text-xs not-italic">soon</em>
      </span>
      <span className="rounded px-3 py-2 text-sm text-gray-400 cursor-not-allowed flex items-center gap-2" aria-disabled>
        <CreditCard className="h-3.5 w-3.5" /> Subscriptions <em className="ml-auto text-xs not-italic">soon</em>
      </span>
      <span className="rounded px-3 py-2 text-sm text-gray-400 cursor-not-allowed flex items-center gap-2" aria-disabled>
        <FileText className="h-3.5 w-3.5" /> Reports <em className="ml-auto text-xs not-italic">soon</em>
      </span>
      <div className="mt-auto border-t pt-3 text-xs text-gray-500">
        <div className="font-medium text-gray-700">
          {user.firstName ?? user.email}
        </div>
        <Link href="/dashboard" className="mt-2 flex items-center gap-1 text-blue-600 hover:underline">
          <ArrowLeft className="h-3 w-3" /> Back to app
        </Link>
      </div>
    </aside>
  )
}
