import { redirect } from 'next/navigation'

export default function ComparePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  // Redirect to dashboard compare tab, preserving query params
  return redirect('/dashboard?tab=compare')
}
