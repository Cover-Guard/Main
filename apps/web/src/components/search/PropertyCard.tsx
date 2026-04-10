'use client'

import Link from 'next/link'
import { MapPin, Home, Calendar, DollarSign, GitCompare, Shield, ArrowRight, FileText } from 'lucide-react'
import type { Property } from '@coverguard/shared'
import { formatCurrency, formatAddress, formatSquareFeet } from '@coverguard/shared'
import { useCompare } from '@/lib/useCompare'

interface PropertyCardProps {
    property: Property
    onViewReport?: () => void
}

export function PropertyCard({ property, onViewReport }: PropertyCardProps) {
    const { ids, toggle, canAdd } = useCompare()
    const isCompared = ids.includes(property.id)

  return (
        <div className="card overflow-hidden transition-all hover:shadow-md hover:border-gray-300">
              <Link href={`/properties/${property.id}`} className="block p-5">
                      <div className="flex items-start justify-between gap-4">
                                <div className="flex-1 min-w-0">
                                            <div className="flex items-start gap-2">
                                                          <div className="flex-1 min-w-0">
                                                                          <h3 className="font-semibold text-gray-900 truncate">{property.address}</h3>h3>
                                                                          <p className="text-sm text-gray-500">{formatAddress(property)}</p>p>
                                                          </div>div>
                                              {/* Insurability CTA badge */}
                                                          <span className="shrink-0 flex items-center gap-1 rounded-full bg-emerald-50 border border-emerald-200 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                                                                          <Shield className="h-2.5 w-2.5" />
                                                                          Check Risk
                                                          </span>span>
                                            </div>div>
                                
                                            <div className="mt-3 flex flex-wrap gap-3 text-sm text-gray-600">
                                              {property.propertyType && (
                          <span className="flex items-center gap-1">
                                            <Home className="h-3.5 w-3.5 text-gray-400" />
                            {property.propertyType.replace(/_/g, ' ')}
                          </span>span>
                                                          )}
                                              {property.squareFeet && (
                          <span className="flex items-center gap-1">
                                            <MapPin className="h-3.5 w-3.5 text-gray-400" />
                            {formatSquareFeet(property.squareFeet)}
                          </span>span>
                                                          )}
                                              {property.yearBuilt && (
                          <span className="flex items-center gap-1">
                                            <Calendar className="h-3.5 w-3.5 text-gray-400" />
                                            Built {property.yearBuilt}
                          </span>span>
                                                          )}
                                              {property.bedrooms && (
                          <span className="text-gray-600">{property.bedrooms} bd / {property.bathrooms} ba</span>span>
                                                          )}
                                            </div>div>
                                </div>div>
                      
                                <div className="text-right shrink-0">
                                  {property.estimatedValue && (
                        <div>
                                        <p className="text-[10px] text-gray-400 uppercase tracking-wide">Est. value</p>p>
                                        <p className="text-lg font-bold text-gray-900">
                                          {formatCurrency(property.estimatedValue)}
                                        </p>p>
                        </div>div>
                                            )}
                                  {property.lastSalePrice && (
                        <div className="mt-1">
                                        <p className="text-[10px] text-gray-400 uppercase tracking-wide">Last sale</p>p>
                                        <p className="flex items-center gap-0.5 text-sm text-gray-600 justify-end">
                                                          <DollarSign className="h-3 w-3" />
                                          {formatCurrency(property.lastSalePrice)}
                                        </p>p>
                        </div>div>
                                            )}
                                </div>div>
                      </div>div>
              
                      <div className="mt-4 flex items-center justify-between">
                                <span className="text-xs text-gray-400 font-mono">
                                  {property.parcelId ? `APN: ${property.parcelId}` : property.zip ? `ZIP: ${property.zip}` : ''}
                                </span>span>
                                <span className="flex items-center gap-1 text-sm font-semibold text-brand-600">
                                            View full report
                                            <ArrowRight className="h-3.5 w-3.5" />
                                </span>span>
                      </div>div>
              </Link>Link>
        
          {/* Compare toggle & View Report */}
              <div className="border-t border-gray-100 px-5 py-2.5 flex items-center justify-between">
                      <button
                                  onClick={() => toggle(property.id)}
                                  disabled={!isCompared && !canAdd}
                                  className={`flex items-center gap-1.5 text-xs font-medium transition-colors ${
                                                isCompared
                                                  ? 'text-brand-600'
                                                  : canAdd
                                                    ? 'text-gray-500 hover:text-brand-600'
                                                    : 'cursor-not-allowed text-gray-300'
                                  }`}
                                >
                                <GitCompare className="h-3.5 w-3.5" />
                        {isCompared ? 'Added to compare' : canAdd ? 'Add to compare' : 'Compare full (max 3)'}
                      </button>button>
              
                {onViewReport && (
                    <button
                                  onClick={onViewReport}
                                  className="flex items-center gap-1.5 text-xs font-semibold text-emerald-600 hover:text-emerald-700 border border-emerald-200 hover:border-emerald-300 bg-emerald-50 hover:bg-emerald-100 px-2.5 py-1 rounded-lg transition-colors"
                                >
                                <FileText className="h-3.5 w-3.5" />
                                View Report
                    </button>button>
                      )}
              </div>div>
        </div>div>
      )
}</div>
