import { redirect } from 'next/navigation'

export const metadata = { title: 'Clients — CoverGuard' }

/**
 * Clients are now managed under the Dashboard → Clients tab.
 * This page redirects for backwards compatibility.
 */
export default function ClientsPage() {
  redirect('/dashboard')
}
