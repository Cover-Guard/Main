import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { SidebarLayout } from '@/components/layout/SidebarLayout'
import { UploadDropzone } from '@/components/bulk-upload/UploadDropzone'

export const metadata: Metadata = {
  title: 'Bulk address upload',
  description:
    'Upload a CSV of property addresses and CoverGuard will run insurability checks on each one in the background.',
}

/**
 * Bulk address upload page (P0 #3).
 *
 * Spec: docs/enhancements/p0/03-bulk-address-upload.md.
 *
 * For now this is the *upload + preview* surface. The submit handler is
 * a no-op until the corresponding API route lands; that's a follow-up PR
 * because it needs a queue + DB migration.
 */
export default async function BulkUploadPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/agents/login?redirect=/bulk-upload')

  return (
    <SidebarLayout>
      <div className="mx-auto max-w-2xl px-4 py-10">
        <header className="mb-8">
          <p className="text-xs font-medium uppercase tracking-wider text-gray-400">
            Tools
          </p>
          <h1 className="mt-1 text-2xl font-bold text-gray-900">
            Bulk address upload
          </h1>
          <p className="mt-2 text-sm text-gray-600">
            Drop a CSV of addresses (one per row) and we&apos;ll run flood, fire,
            wind, earthquake, and crime risk plus carrier appetite checks for
            each one. Results land in your dashboard when the job finishes; a
            CSV + bundled PDF download is available the moment the last row
            completes.
          </p>
        </header>

        <UploadDropzone />

        <section className="mt-8 rounded-xl border border-gray-200 bg-white p-5 text-sm text-gray-600">
          <h2 className="mb-2 text-base font-semibold text-gray-900">
            CSV format
          </h2>
          <p className="mb-3">
            One header row, then one address per data row. Required column:
            {' '}
            <code className="rounded bg-gray-100 px-1 py-0.5">address</code>.
            Optional column:{' '}
            <code className="rounded bg-gray-100 px-1 py-0.5">external_ref</code>{' '}
            (any string up to 200 chars — e.g. your CRM&apos;s lead id, so
            the output rows can be joined back to your system).
          </p>
          <pre className="overflow-x-auto rounded-lg bg-gray-900 px-3 py-2 text-xs leading-relaxed text-gray-100">{`address,external_ref
742 Evergreen Terrace, Springfield, IL 62704,LEAD-001
1600 Pennsylvania Ave NW, Washington, DC 20500,LEAD-002`}</pre>
        </section>
      </div>
    </SidebarLayout>
  )
}
