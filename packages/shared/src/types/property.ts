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
  marketValue?: number | null
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

// ─── Public Property Data (enriched from public sources) ────────────────────

export interface PropertyImage {
  url: string
  source: string
  caption: string
  type: 'street_view' | 'satellite' | 'listing' | 'exterior' | 'interior'
}

export interface PropertyTaxRecord {
  assessedValue: number | null
  taxAmount: number | null
  taxYear: number | null
  landValue: number | null
  improvementValue: number | null
  taxRate: number | null
}

export interface PropertySaleHistory {
  date: string
  price: number
  pricePerSqFt: number | null
  seller: string | null
  buyer: string | null
}

export interface NearbyAmenity {
  name: string
  type: 'school' | 'hospital' | 'fire_station' | 'police' | 'park' | 'grocery' | 'transit'
  distance: number // miles
  rating: number | null
}

export interface PropertyListingData {
  zestimate: number | null
  rentEstimate: number | null
  daysOnMarket: number | null
  listingStatus: 'for_sale' | 'recently_sold' | 'off_market' | 'for_rent' | null
  listPrice: number | null
  pricePerSqFt: number | null
  description: string | null
  features: string[]
  yearRenovated: number | null
  stories: number | null
  garage: string | null
  heating: string | null
  cooling: string | null
  roofType: string | null
  foundation: string | null
  exteriorMaterial: string | null
  hoaFee: number | null
}

export interface PropertyPublicData {
  propertyId: string
  images: PropertyImage[]
  taxRecords: PropertyTaxRecord | null
  saleHistory: PropertySaleHistory[]
  nearbyAmenities: NearbyAmenity[]
  listingData: PropertyListingData | null
  walkScore: number | null
  transitScore: number | null
  neighborhoodMedianValue: number | null
  neighborhoodMedianRent: number | null
  lastUpdated: string
}
