'use client'

import { useState } from 'react'
import { PropertyCard } from './PropertyCard'
import type { Property } from '@coverguard/shared'
import { PropertyRiskReportModal } from '@/components/property/PropertyReportModal'

interface SearchResultsProps {
    /** Pre-fetched properties from the server. */
    properties: Property[]
    query: string
}

export function SearchResults({ properties, query }: SearchResultsProps) {
    const [selectedProperty, setSelectedProperty] = useState<Property | null>(null)

    if (properties.length === 0) {
        return (
            <div className="py-16 text-center">
                <p className="text-lg font-medium text-gray-700">No properties found for &quot;{query}&quot;</p>
                <p className="mt-2 text-gray-500">Try a different address or ZIP code</p>
            </div>
        )
    }

    return (
        <div>
            <p className="mb-4 text-sm text-gray-500">
                {properties.length} result{properties.length !== 1 ? 's' : ''} for &quot;{query}&quot;
            </p>
            <div className="space-y-4">
                {properties.map((property) => (
                    <PropertyCard
                        key={property.id}
                        property={property}
                        onViewReport={() => setSelectedProperty(property)}
                    />
                ))}
            </div>

            <PropertyRiskReportModal
                property={selectedProperty}
                open={!!selectedProperty}
                onClose={() => setSelectedProperty(null)}
            />
        </div>
    )
}
