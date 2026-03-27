import { redirect } from 'next/navigation'

export default function ComparePage({
  searchParams,
}: {
  searchParams?: Record<string, string | string[] | undefined>
}) {
  // Redirect to dashboard compare tab, preserving query params
  const params = new URLSearchParams()

  // Ensure the tab is always set to "compare"
  params.set('tab', 'compare')

  if (searchParams) {
    for (const [key, value] of Object.entries(searchParams)) {
      // Do not propagate any existing "tab" query param
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
  }

  return redirect(`/dashboard?${params.toString()}`)
}
