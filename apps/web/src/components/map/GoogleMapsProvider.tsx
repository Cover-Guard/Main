'use client'

import { type ReactNode, useSyncExternalStore } from 'react'
import { APIProvider } from '@vis.gl/react-google-maps'

const GOOGLE_MAPS_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? ''

const emptySubscribe = () => () => {}

interface GoogleMapsProviderProps {
  children: ReactNode
}

export function GoogleMapsProvider({ children }: GoogleMapsProviderProps) {
  const mounted = useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false
  )

  // During SSR and initial hydration, render children without APIProvider
  // to prevent hydration mismatch (React error #418) caused by Google Maps
  // script injection on the client side only
  if (!GOOGLE_MAPS_KEY || !mounted) {
    return <>{children}</>
  }

  return (
    <APIProvider apiKey={GOOGLE_MAPS_KEY} libraries={['places', 'marker']}>
      {children}
    </APIProvider>
  )
}
