export interface Property {
  id: string
  address: string
  city: string
  state: string
  zip: string
  county: string
  lat: number
  lng: number
  propertyType: PropertyType
  yearBuilt: number | null
  squareFeet: number | null
  bedrooms: number | null
  bathrooms: number | null
  lotSize: number | null
  estimatedValue: number | null
  lastSalePrice: number | null
  lastSaleDate: string | null
  parcelId: string | null
  createdAt: string
  updatedAt: string
}

export type PropertyType =
  | 'SINGLE_FAMILY'
  | 'MULTI_FAMILY'
  | 'CONDO'
  | 'TOWNHOUSE'
  | 'MOBILE_HOME'
  | 'COMMERCIAL'
  | 'LAND'

export interface PropertySearchParams {
  address?: string
  city?: string
  state?: string
  zip?: string
  parcelId?: string
  placeId?: string
  lat?: number
  lng?: number
  radiusMiles?: number
  page?: number
  limit?: number
}

/** Prediction returned by Google Places Autocomplete, used for typeahead. */
export interface PlacePrediction {
  placeId: string
  description: string
  mainText: string
  secondaryText: string
}

/** Result of resolving a Google Place ID to a validated property. */
export interface GeocodedProperty {
  address: string
  city: string
  state: string
  zip: string
  county: string
  lat: number
  lng: number
  formattedAddress: string
  placeId: string
}

export interface PropertySearchResult {
  properties: Property[]
  total: number
  page: number
  limit: number
}
