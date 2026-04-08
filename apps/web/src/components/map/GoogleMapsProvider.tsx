'use client'

/**
 * Shared Google Maps API provider.
 *
 * Wraps the entire app (or search layout) so the Maps JavaScript API is loaded
 * exactly ONCE â with ALL required libraries. This prevents the
 * "Google Maps JavaScript API has already been loaded with different parameters"
 * warning that occurred when both SearchBar and PropertyMap each had their own
 * <APIProvider>.
 *
 * File: apps/web/src/components/map/GoogleMapsProvider.tsx
 */

import { type ReactNode } from 'react'
import { APIProvider } from '@vis.gl/react-google-maps'

const GOOGLE_MAPS_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? ''

interface GoogleMapsProviderProps {
  children: ReactNode
}

export function GoogleMapsProvider({ children }: GoogleMapsProviderProps) {
  if (!GOOGLE_MAPS_KEY) {
    return <>{children}</>
  }

  return (
    <APIProvider
      apiKey={GOOGLE_MAPS_KEY}
      libraries={['places', 'marker']}
    >
      {children}
    </APIProvider>
  )
}
