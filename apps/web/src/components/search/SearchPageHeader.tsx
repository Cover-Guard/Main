'use client'

/**
 * Client-side wrapper for the Search page's <PageHeader>.
 *
 * The /search route (app/search/page.tsx) is an async Server Component.
 * React Server Components cannot serialize a component reference across the
 * server→client boundary, and the `lucide-react` `Search` icon is exactly
 * that — a forwardRef component, not a serializable value. Passing
 * `icon={Search}` straight from search/page.tsx into the `'use client'`
 * <PageHeader> threw "Functions cannot be passed directly to Client
 * Components", which surfaced as an uncaught "Server Components render" 500
 * on every /search request.
 *
 * Keeping the icon import and the <PageHeader> usage inside this client
 * component means the icon never crosses the RSC boundary. The other
 * <PageHeader> consumers (Dashboard / Toolkit / Help) are already client
 * components, which is why only /search was affected.
 */

import { Search } from 'lucide-react'
import { PageHeader } from '@/components/layout/PageHeader'
import { SearchBar } from '@/components/search/SearchBar'

interface SearchPageHeaderProps {
  /** Current `q` search param, used to seed the SearchBar input. */
  defaultQuery: string
}

export function SearchPageHeader({ defaultQuery }: SearchPageHeaderProps) {
  return (
    <PageHeader
      icon={Search}
      title="Search"
      subtitle="Find any U.S. property by address, ZIP, or APN"
      belowSlot={<SearchBar defaultValue={defaultQuery} />}
    />
  )
}
