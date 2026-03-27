import { redirect } from 'next/navigation'

export default async function ComparePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const resolved = await searchParams
  const params = new URLSearchParams()

  // Ensure the tab is always set to "compare"
  params.set('tab', 'compare')

  for (const [key, value] of Object.entries(resolved)) {
    if (key === 'tab') continue

    if (Array.isArray(value)) {
      for (const v of value) {
        if (v != null) {
          params.append(key, v)
        }
      }
    } else if (value != null) {
      params.append(key, value)
    }
  }

  return redirect(`/dashboard?${params.toString()}`)
}
