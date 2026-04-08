/**
 * Search route layout — wraps all /search/* pages with GoogleMapsProvider
 * so the Maps API loads exactly once for both SearchBar and PropertyMap.
 *
 * File: apps/web/src/app/search/layout.tsx  (NEW FILE)
 */

import type { ReactNode } from 'react'
import { GoogleMapsProvider } from '@/components/map/GoogleMapsProvider'

export default function SearchLayout({ children }: { children: ReactNode }) {
  return (
    <GoogleMapsProvider>
      {children}
    </GoogleMapsProvider>
  )
}
