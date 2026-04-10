/**
 * Properties route layout — wraps /properties/* pages with GoogleMapsProvider
 * so the property detail map can access the Google Maps API context.
 */

import type { ReactNode } from 'react'
import { GoogleMapsProvider } from '@/components/map/GoogleMapsProvider'

export default function PropertiesLayout({ children }: { children: ReactNode }) {
  return (
    <GoogleMapsProvider>
      {children}
    </GoogleMapsProvider>
  )
}
