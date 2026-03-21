import type { Property } from '@coverguard/shared'
import { formatCurrency, formatSquareFeet, formatAcres } from '@coverguard/shared'

interface PropertyDetailsProps {
  property: Property
}

export function PropertyDetails({ property }: PropertyDetailsProps) {
  const details = [
    { label: 'Property Type', value: property.propertyType?.replace('_', ' ') },
    { label: 'Year Built', value: property.yearBuilt?.toString() },
    { label: 'Square Footage', value: formatSquareFeet(property.squareFeet) },
    { label: 'Bedrooms', value: property.bedrooms?.toString() },
    { label: 'Bathrooms', value: property.bathrooms?.toString() },
    { label: 'Lot Size', value: property.lotSize ? formatAcres(property.lotSize) : null },
    { label: 'Estimated Value', value: property.estimatedValue ? formatCurrency(property.estimatedValue) : null },
    { label: 'Last Sale Price', value: property.lastSalePrice ? formatCurrency(property.lastSalePrice) : null },
    { label: 'Last Sale Date', value: property.lastSaleDate ? new Date(property.lastSaleDate).toLocaleDateString() : null },
    { label: 'County', value: property.county },
    { label: 'Parcel ID', value: property.parcelId },
    { label: 'Coordinates', value: `${property.lat.toFixed(5)}, ${property.lng.toFixed(5)}` },
  ].filter((d) => d.value != null && d.value !== 'Unknown')

  return (
    <div className="card p-6">
      <h2 className="mb-4 text-lg font-semibold text-gray-900">Property Details</h2>
      <dl className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3">
        {details.map((d) => (
          <div key={d.label}>
            <dt className="text-xs text-gray-400">{d.label}</dt>
            <dd className="mt-0.5 text-sm font-medium text-gray-800">{d.value}</dd>
          </div>
        ))}
      </dl>
    </div>
  )
}
