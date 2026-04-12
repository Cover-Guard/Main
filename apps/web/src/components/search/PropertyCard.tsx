'use client'

import { useState } from 'react'
import Link from 'next/link'
import { MapPin, Home, Calendar, DollarSign, GitCompare, Shield, FileText, ImageOff } from 'lucide-react'
import type { Property } from '@coverguard/shared'
import { formatCurrency, formatAddress, formatSquareFeet } from '@coverguard/shared'
import { useCompare } from '@/lib/useCompare'

const GOOGLE_MAPS_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? ''

function getStreetViewUrl(property: Property, width = 400, height = 200) {
    const location = property.lat && property.lng
        ? `${property.lat},${property.lng}`
        : `${property.address ?? ''}, ${property.city ?? ''}, ${property.state ?? ''} ${property.zip ?? ''}`
    return `https://maps.googleapis.com/maps/api/streetview?size=${width}x${height}&location=${encodeURIComponent(location)}&key=${GOOGLE_MAPS_KEY}&source=outdoor`
}

interface PropertyCardProps {
    property: Property
    onViewReport?: () => void
}

export function PropertyCard({ property, onViewReport }: PropertyCardProps) {
    const { ids, toggle, canAdd } = useCompare()
    const isCompared = ids.includes(property.id)
    const [imgError, setImgError] = useState(false)

    return (
        <div className="card overflow-hidden transition-all hover:shadow-md hover:border-gray-300">
            {/* Street View Image */}
            {GOOGLE_MAPS_KEY && !imgError && (
                <Link href={`/properties/${property.id}`} className="block">
                    <div className="relative h-36 w-full bg-gray-100 overflow-hidden">
                        <img
                            src={getStreetViewUrl(property)}
                            alt={`Street view of ${property.address ?? 'property'}`}
                            className="w-full h-full object-cover"
                            loading="lazy"
                            onError={() => setImgError(true)}
                        />
                        <div className="absolute bottom-0 left-0 right-0 h-12 bg-gradient-to-t from-black/40 to-transparent" />
                    </div>
                </Link>
            )}
            {(imgError || !GOOGLE_MAPS_KEY) && (
                <Link href={`/properties/${property.id}`} className="block">
                    <div className="h-24 w-full bg-gray-50 flex items-center justify-center">
                        <ImageOff className="h-6 w-6 text-gray-300" />
                    </div>
                </Link>
            )}
            <Link href={`/properties/${property.id}`} className="block p-4">
                <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                        <div className="flex items-start gap-2">
                            <div className="flex-1 min-w-0">
                                <h3 className="font-semibold text-gray-900 truncate text-sm">{property.address}</h3>
                                <p className="text-xs text-gray-500">{formatAddress(property)}</p>
                            </div>
                        </div>

                        {/* Insurability CTA badge */}
                        <span className="shrink-0 inline-flex items-center gap-1 rounded-full bg-teal-50 border border-teal-200 px-2 py-0.5 text-[10px] font-semibold text-teal-700 mt-1.5">
                            <Shield className="h-2.5 w-2.5" />
                            Check Risk
                        </span>
                    </div>
                </div>

                <div className="mt-3 flex flex-wrap gap-3 text-sm text-gray-600">
                    {property.propertyType && (
                        <span className="flex items-center gap-1">
                            <Home className="h-3.5 w-3.5 text-gray-400" />
                            {property.propertyType.replace(/_/g, ' ')}
                        </span>
                    )}
                    {property.squareFeet && (
                        <span className="flex items-center gap-1">
                            <MapPin className="h-3.5 w-3.5 text-gray-400" />
                            {formatSquareFeet(property.squareFeet)}
                        </span>
                    )}
                    {property.yearBuilt && (
                        <span className="flex items-center gap-1">
                            <Calendar className="h-3.5 w-3.5 text-gray-400" />
                            Built {property.yearBuilt}
                        </span>
                    )}
                    {property.bedrooms && (
                        <span className="text-gray-600">
                            {property.bedrooms}bd / {property.bathrooms}ba
                        </span>
                    )}
                </div>

                <div className="text-right shrink-0">
                    {property.marketValue && (
                        <div>
                            <div className="text-[10px] text-gray-400 uppercase tracking-wide">Est. Market Value</div>
                            <div className="text-lg font-bold text-gray-900">{formatCurrency(property.marketValue)}</div>
                        </div>
                    )}
                    {property.estimatedValue && (
                        <div className={property.marketValue ? 'mt-1' : undefined}>
                            <div className="text-[10px] text-gray-400 uppercase tracking-wide">Assessed value</div>
                            <div className={`font-bold text-gray-900 ${property.marketValue ? 'text-sm' : 'text-lg'}`}>{formatCurrency(property.estimatedValue)}</div>
                        </div>
                    )}
                    {property.lastSalePrice && (
                        <div className="mt-1">
                            <div className="text-[10px] text-gray-400 uppercase tracking-wide">Last sale</div>
                            <div className="flex items-center gap-0.5 text-sm text-gray-600 justify-end">
                                <DollarSign className="h-3 w-3" />
                                {formatCurrency(property.lastSalePrice)}
                            </div>
                        </div>
                    )}
                </div>
            </Link>

            {onViewReport && (
                <div className="border-t border-gray-100 px-4 py-2 flex items-center justify-between">
                    <button
                        onClick={(e) => {
                            e.preventDefault()
                            onViewReport()
                        }}
                        className="flex items-center gap-1.5 text-xs font-medium text-brand-600 hover:text-brand-700 transition-colors"
                    >
                        <FileText className="h-3.5 w-3.5" />
                        View Report
                    </button>
                    <button
                        onClick={(e) => {
                            e.preventDefault()
                            e.stopPropagation()
                            toggle(property.id)
                        }}
                        disabled={!isCompared && !canAdd}
                        className={`flex items-center gap-1 text-xs transition-colors ${
                            isCompared
                                ? 'text-brand-600 font-medium'
                                : canAdd
                                  ? 'text-gray-500 hover:text-brand-600'
                                  : 'text-gray-300 cursor-not-allowed'
                        }`}
                    >
                        <GitCompare className="h-3.5 w-3.5" />
                        {isCompared ? 'Compared' : 'Compare'}
                    </button>
                </div>
            )}

            {!onViewReport && (
                <div className="border-t border-gray-100 px-4 py-2">
                    <button
                        onClick={(e) => {
                            e.preventDefault()
                            e.stopPropagation()
                            toggle(property.id)
                        }}
                        disabled={!isCompared && !canAdd}
                        className={`flex items-center gap-1 text-xs transition-colors ${
                            isCompared
                                ? 'text-brand-600 font-medium'
                                : canAdd
                                  ? 'text-gray-500 hover:text-brand-600'
                                  : 'text-gray-300 cursor-not-allowed'
                        }`}
                    >
                        <GitCompare className="h-3.5 w-3.5" />
                        {isCompared ? 'Compared' : 'Compare'}
                    </button>
                </div>
            )}
        </div>
    )
}
