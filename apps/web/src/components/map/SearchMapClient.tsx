'use client'

import { useState, useEffect } from 'react'
import { PropertyMap } from './PropertyMap'
import type { Property } from '@coverguard/shared'
import { searchProperties } from '@/lib/api'

interface SearchMapClientProps {
  query: string | null
}

export function SearchMapClient({ query }: SearchMapClientProps) {
  const [properties, setProperties] = useState<Property[]>([])
  const [selected, setSelected] = useState<Property | null>(null)

  useEffect(() => {
    if (!query) {
      setProperties([])
      setSelected(null)
      return
    }

    const params: Record<string, string> = {}
    const zipMatch = query.match(/\b(\d{5})\b/)
    if (zipMatch) {
      params.zip = zipMatch[1]!
      params.address = query
    } else {
      params.address = query
    }

    searchProperties({ ...params, limit: 50 })
      .then((r) => {
        setProperties(r.properties)
        if (r.properties.length > 0) setSelected(r.properties[0]!)
      })
      .catch(() => setProperties([]))
  }, [query])

  return (
    <PropertyMap
      properties={properties}
      selectedProperty={selected}
      onSelectProperty={setSelected}
      className="h-full w-full"
      zoom={properties.length === 1 ? 15 : 12}
    />
  )
}
