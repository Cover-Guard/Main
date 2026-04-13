'use client'

import { useState } from 'react'
import {
  Receipt, History, MapPin, Building2, Footprints, Bus,
  School, Heart, Flame, Shield, TreePine, ShoppingCart, Train,
  ChevronDown, ChevronUp, Star,
} from 'lucide-react'
import { formatCurrency } from '@coverguard/shared'
import type { PropertyPublicData, NearbyAmenity } from '@coverguard/shared'

interface PropertyPublicInfoProps {
  data: PropertyPublicData
  marketValue?: number | null
}

const AMENITY_ICONS: Record<NearbyAmenity['type'], typeof School> = {
  school: School,
  hospital: Heart,
  fire_station: Flame,
  police: Shield,
  park: TreePine,
  grocery: ShoppingCart,
  transit: Train,
}

const AMENITY_COLORS: Record<NearbyAmenity['type'], string> = {
  school: 'text-blue-600 bg-blue-50',
  hospital: 'text-red-600 bg-red-50',
  fire_station: 'text-orange-600 bg-orange-50',
  police: 'text-indigo-600 bg-indigo-50',
  park: 'text-green-600 bg-green-50',
  grocery: 'text-amber-600 bg-amber-50',
  transit: 'text-purple-600 bg-purple-50',
}

function ScoreBadge({ score, label, icon: Icon }: { score: number | null; label: string; icon: typeof Footprints }) {
  if (score === null) return null

  let color = 'text-red-700 bg-red-50 border-red-200'
  let descriptor = 'Car-Dependent'
  if (score >= 90) { color = 'text-green-700 bg-green-50 border-green-200'; descriptor = "Walker's Paradise" }
  else if (score >= 70) { color = 'text-green-600 bg-green-50 border-green-200'; descriptor = 'Very Walkable' }
  else if (score >= 50) { color = 'text-yellow-700 bg-yellow-50 border-yellow-200'; descriptor = 'Somewhat Walkable' }
  else if (score >= 25) { color = 'text-orange-700 bg-orange-50 border-orange-200'; descriptor = 'Car-Dependent' }

  if (label === 'Transit Score') {
    if (score >= 70) descriptor = 'Excellent Transit'
    else if (score >= 50) descriptor = 'Good Transit'
    else if (score >= 25) descriptor = 'Some Transit'
    else descriptor = 'Minimal Transit'
  }

  return (
    <div className={`flex items-center gap-3 rounded-xl border px-4 py-3 ${color}`}>
      <Icon className="h-5 w-5 shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium opacity-70">{label}</p>
        <p className="text-lg font-bold">{score}<span className="text-sm font-normal opacity-70">/100</span></p>
        <p className="text-xs font-medium">{descriptor}</p>
      </div>
    </div>
  )
}

export function PropertyPublicInfo({ data, marketValue }: PropertyPublicInfoProps) {
  const [showAllAmenities, setShowAllAmenities] = useState(false)
  const [showAllSales, setShowAllSales] = useState(false)

  const visibleAmenities = showAllAmenities ? data.nearbyAmenities : data.nearbyAmenities.slice(0, 5)
  const visibleSales = showAllSales ? data.saleHistory : data.saleHistory.slice(0, 3)

  return (
    <div className="space-y-6">
      {/* Walk & Transit Scores */}
      {(data.walkScore !== null || data.transitScore !== null) && (
        <div className="card p-5">
          <h3 className="text-lg font-semibold text-gray-900 mb-3">Walkability & Transit</h3>
          <div className="grid grid-cols-2 gap-3">
            <ScoreBadge score={data.walkScore} label="Walk Score" icon={Footprints} />
            <ScoreBadge score={data.transitScore} label="Transit Score" icon={Bus} />
          </div>
        </div>
      )}

      {/* Neighborhood Values */}
      {(data.neighborhoodMedianValue || data.neighborhoodMedianRent) && (
        <div className="card p-5">
          <h3 className="text-lg font-semibold text-gray-900 mb-3">Neighborhood</h3>
          <div className="grid grid-cols-2 gap-4">
            {data.neighborhoodMedianValue && (
              <div>
                <p className="text-xs text-gray-400">Median Home Value</p>
                <p className="text-sm font-semibold text-gray-800">{formatCurrency(data.neighborhoodMedianValue)}</p>
              </div>
            )}
            {data.neighborhoodMedianRent && (
              <div>
                <p className="text-xs text-gray-400">Est. Monthly Rent</p>
                <p className="text-sm font-semibold text-gray-800">{formatCurrency(data.neighborhoodMedianRent)}/mo</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tax Records */}
      {data.taxRecords && data.taxRecords.assessedValue && (
        <div className="card p-5">
          <h3 className="flex items-center gap-2 text-lg font-semibold text-gray-900 mb-4">
            <Receipt className="h-5 w-5 text-gray-400" aria-hidden="true" />
            Tax Assessment
          </h3>
          <dl className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-3">
            {marketValue && (
              <div>
                <dt className="text-xs text-gray-400">Est. Market Value</dt>
                <dd className="text-sm font-semibold text-gray-900">{formatCurrency(marketValue)}</dd>
              </div>
            )}
            {data.taxRecords.assessedValue && (
              <div>
                <dt className="text-xs text-gray-400">Assessed Value</dt>
                <dd className="text-sm font-medium text-gray-800">{formatCurrency(data.taxRecords.assessedValue)}</dd>
              </div>
            )}
            {data.taxRecords.taxAmount && (
              <div>
                <dt className="text-xs text-gray-400">Annual Tax</dt>
                <dd className="text-sm font-medium text-gray-800">{formatCurrency(data.taxRecords.taxAmount)}</dd>
              </div>
            )}
            {data.taxRecords.taxYear && (
              <div>
                <dt className="text-xs text-gray-400">Tax Year</dt>
                <dd className="text-sm font-medium text-gray-800">{data.taxRecords.taxYear}</dd>
              </div>
            )}
            {data.taxRecords.landValue && (
              <div>
                <dt className="text-xs text-gray-400">Land Value</dt>
                <dd className="text-sm font-medium text-gray-800">{formatCurrency(data.taxRecords.landValue)}</dd>
              </div>
            )}
            {data.taxRecords.improvementValue && (
              <div>
                <dt className="text-xs text-gray-400">Improvement Value</dt>
                <dd className="text-sm font-medium text-gray-800">{formatCurrency(data.taxRecords.improvementValue)}</dd>
              </div>
            )}
            {data.taxRecords.taxRate && (
              <div>
                <dt className="text-xs text-gray-400">Tax Rate</dt>
                <dd className="text-sm font-medium text-gray-800">{data.taxRecords.taxRate.toFixed(2)}%</dd>
              </div>
            )}
          </dl>
        </div>
      )}

      {/* Listing Details */}
      {data.listingData && (
        <div className="card p-5">
          <h3 className="flex items-center gap-2 text-lg font-semibold text-gray-900 mb-4">
            <Building2 className="h-5 w-5 text-gray-400" aria-hidden="true" />
            Property Details & Features
          </h3>

          <dl className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-3 mb-4">
            {data.listingData.zestimate && (
              <div>
                <dt className="text-xs text-gray-400">Estimated Value</dt>
                <dd className="text-sm font-semibold text-brand-700">{formatCurrency(data.listingData.zestimate)}</dd>
              </div>
            )}
            {data.listingData.rentEstimate && (
              <div>
                <dt className="text-xs text-gray-400">Rent Estimate</dt>
                <dd className="text-sm font-medium text-gray-800">{formatCurrency(data.listingData.rentEstimate)}/mo</dd>
              </div>
            )}
            {data.listingData.pricePerSqFt && (
              <div>
                <dt className="text-xs text-gray-400">Price / Sq Ft</dt>
                <dd className="text-sm font-medium text-gray-800">{formatCurrency(data.listingData.pricePerSqFt)}</dd>
              </div>
            )}
            {data.listingData.stories && (
              <div>
                <dt className="text-xs text-gray-400">Stories</dt>
                <dd className="text-sm font-medium text-gray-800">{data.listingData.stories}</dd>
              </div>
            )}
            {data.listingData.yearRenovated && (
              <div>
                <dt className="text-xs text-gray-400">Year Renovated</dt>
                <dd className="text-sm font-medium text-gray-800">{data.listingData.yearRenovated}</dd>
              </div>
            )}
            {data.listingData.garage && (
              <div>
                <dt className="text-xs text-gray-400">Garage</dt>
                <dd className="text-sm font-medium text-gray-800">{data.listingData.garage}</dd>
              </div>
            )}
            {data.listingData.heating && (
              <div>
                <dt className="text-xs text-gray-400">Heating</dt>
                <dd className="text-sm font-medium text-gray-800">{data.listingData.heating}</dd>
              </div>
            )}
            {data.listingData.cooling && (
              <div>
                <dt className="text-xs text-gray-400">Cooling</dt>
                <dd className="text-sm font-medium text-gray-800">{data.listingData.cooling}</dd>
              </div>
            )}
            {data.listingData.roofType && (
              <div>
                <dt className="text-xs text-gray-400">Roof Type</dt>
                <dd className="text-sm font-medium text-gray-800">{data.listingData.roofType}</dd>
              </div>
            )}
            {data.listingData.foundation && (
              <div>
                <dt className="text-xs text-gray-400">Foundation</dt>
                <dd className="text-sm font-medium text-gray-800">{data.listingData.foundation}</dd>
              </div>
            )}
            {data.listingData.exteriorMaterial && (
              <div>
                <dt className="text-xs text-gray-400">Exterior</dt>
                <dd className="text-sm font-medium text-gray-800">{data.listingData.exteriorMaterial}</dd>
              </div>
            )}
            {data.listingData.hoaFee && (
              <div>
                <dt className="text-xs text-gray-400">HOA Fee</dt>
                <dd className="text-sm font-medium text-gray-800">{formatCurrency(data.listingData.hoaFee)}/mo</dd>
              </div>
            )}
          </dl>

          {data.listingData.features.length > 0 && (
            <div>
              <p className="text-xs text-gray-400 mb-2">Features</p>
              <div className="flex flex-wrap gap-1.5">
                {data.listingData.features.map((feature) => (
                  <span
                    key={feature}
                    className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-600"
                  >
                    {feature}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Sale History */}
      {data.saleHistory.length > 0 && (
        <div className="card p-5">
          <h3 className="flex items-center gap-2 text-lg font-semibold text-gray-900 mb-4">
            <History className="h-5 w-5 text-gray-400" aria-hidden="true" />
            Sale History
          </h3>
          <div className="space-y-3">
            {visibleSales.map((sale, i) => (
              <div
                key={`${sale.date}-${i}`}
                className="flex items-center justify-between rounded-lg bg-gray-50 px-4 py-3"
              >
                <div>
                  <p className="text-sm font-semibold text-gray-800">{formatCurrency(sale.price)}</p>
                  <p className="text-xs text-gray-500">
                    {new Date(sale.date).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}
                    {sale.pricePerSqFt && ` \u00B7 ${formatCurrency(sale.pricePerSqFt)}/sqft`}
                  </p>
                </div>
                {(sale.buyer || sale.seller) && (
                  <div className="text-right text-xs text-gray-400">
                    {sale.buyer && <p>Buyer: {sale.buyer}</p>}
                    {sale.seller && <p>Seller: {sale.seller}</p>}
                  </div>
                )}
              </div>
            ))}
          </div>
          {data.saleHistory.length > 3 && (
            <button
              onClick={() => setShowAllSales(!showAllSales)}
              aria-expanded={showAllSales}
              className="mt-3 flex items-center gap-1 text-sm font-medium text-brand-600 hover:text-brand-700"
            >
              {showAllSales ? <ChevronUp className="h-4 w-4" aria-hidden="true" /> : <ChevronDown className="h-4 w-4" aria-hidden="true" />}
              {showAllSales ? 'Show less' : `Show all ${data.saleHistory.length} sales`}
            </button>
          )}
        </div>
      )}

      {/* Nearby Amenities */}
      {data.nearbyAmenities.length > 0 && (
        <div className="card p-5">
          <h3 className="flex items-center gap-2 text-lg font-semibold text-gray-900 mb-4">
            <MapPin className="h-5 w-5 text-gray-400" aria-hidden="true" />
            Nearby Amenities
          </h3>
          <div className="space-y-2">
            {visibleAmenities.map((amenity, i) => {
              const AmenityIcon = AMENITY_ICONS[amenity.type] ?? MapPin
              const colorClass = AMENITY_COLORS[amenity.type] ?? 'text-gray-600 bg-gray-50'
              return (
                <div
                  key={`${amenity.name}-${i}`}
                  className="flex items-center gap-3 rounded-lg px-3 py-2.5 hover:bg-gray-50 transition-colors"
                >
                  <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${colorClass}`}>
                    <AmenityIcon className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800 truncate">{amenity.name}</p>
                    <p className="text-xs text-gray-400 capitalize">{amenity.type.replace('_', ' ')}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-medium text-gray-700">{amenity.distance} mi</p>
                    {amenity.rating && (
                      <p className="flex items-center gap-0.5 text-xs text-amber-600" aria-label={`${amenity.rating.toFixed(1)} out of 5 stars`}>
                        <Star className="h-3 w-3 fill-amber-500" aria-hidden="true" />
                        {amenity.rating.toFixed(1)}
                      </p>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
          {data.nearbyAmenities.length > 5 && (
            <button
              onClick={() => setShowAllAmenities(!showAllAmenities)}
              aria-expanded={showAllAmenities}
              className="mt-3 flex items-center gap-1 text-sm font-medium text-brand-600 hover:text-brand-700"
            >
              {showAllAmenities ? <ChevronUp className="h-4 w-4" aria-hidden="true" /> : <ChevronDown className="h-4 w-4" aria-hidden="true" />}
              {showAllAmenities ? 'Show less' : `Show all ${data.nearbyAmenities.length} amenities`}
            </button>
          )}
        </div>
      )}
    </div>
  )
}
