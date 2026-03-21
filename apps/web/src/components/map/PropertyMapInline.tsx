'use client'

import dynamic from 'next/dynamic'
import type { Property, PropertyRiskProfile } from '@coverguard/shared'

const PropertyMap = dynamic(
  () => import('./PropertyMap').then((m) => ({ default: m.PropertyMap })),
  { ssr: false, loading: () => <div className="h-72 w-full animate-pulse rounded-xl bg-gray-200" /> }
)

interface PropertyMapInlineProps {
  property: Property
  riskProfile?: PropertyRiskProfile | null
}

export function PropertyMapInline({ property, riskProfile }: PropertyMapInlineProps) {
  return (
    <PropertyMap
      selectedProperty={property}
      riskProfile={riskProfile}
      center={{ lat: property.lat, lng: property.lng }}
      zoom={15}
      className="h-72 w-full"
    />
  )
}
