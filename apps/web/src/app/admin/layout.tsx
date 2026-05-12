import { redirect } from 'next/navigation'
import type { ReactNode } from 'react'
import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { AdminSidebar } from './AdminSidebar'

export const metadata: Metadata = {
  title: 'Admin — CoverGuard',
  // Don't index the admin portal
  robots: { index: false, follow: false },
}

/**
 * Admin layout (P-B5.a foundation).
 *
 * Server-side role gate. Reads the Supabase session, hits /api/auth/me
 * with the access token, and redirects to /dashboard if the user
 * isn't an admin. We do NOT rely on a client-side gate because the
 * admin nav and data must never render even briefly for non-admins.
 *
 * The Express API has its own gate via `adminRouter.use(requireAuth,
 * requireRole('ADMIN'))`, so this layout is defense-in-depth — even if
 * a non-admin somehow reached this page, every fetch from it would
 * return 403.
 */
export default async function AdminLayout({ children }: { children: ReactNode }) {
  const supabase = await createClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session?.access_token) redirect('/login?next=/admin')

  // Read the user's role via the API. We deliberately do not touch Prisma
  // from the web tree — only the api workspace owns DB access, and the
  // /api/auth/me handler already has the right select + caching semantics.
  const apiBase =
    process.env.NEXT_PUBLIC_API_URL ??
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000')

  let role: string | null = null
  let displayUser: { firstName?: string | null; lastName?: string | null; email: string } | null = null
  try {
    const res = await fetch(`${apiBase}/api/auth/me`, {
      headers: { Authorization: `Bearer ${session.access_token}` },
      cache: 'no-store',
    })
    if (res.ok) {
      const body = (await res.json()) as { success: boolean; data?: { role: string; firstName?: string; lastName?: string; email: string } }
      if (body.success && body.data) {
        role = body.data.role
        displayUser = { firstName: body.data.firstName, lastName: body.data.lastName, email: body.data.email }
      }
    }
  } catch {
    // Network errors fall through to the redirect below — fail closed.
  }

  if (!role) redirect('/dashboard?reason=no_profile')
  if (role !== 'ADMIN') redirect('/dashboard?reason=not_admin')

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="flex">
        <AdminSidebar user={displayUser ?? { email: '' }} />
        <main className="flex-1 p-8">{children}</main>
      </div>
    </div>
  )
}
