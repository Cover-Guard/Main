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
  lat?: number
  lng?: number
  radiusMiles?: number
  page?: number
  limit?: number
}

export interface PropertySearchResult {
  properties: Property[]
  total: number
  page: number
  limit: number
}
