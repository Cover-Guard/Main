/** Fields to select when including a property in a response.
 *  Excludes internal fields like `externalId` that are not in the shared Property type. */
export const PROPERTY_PUBLIC_SELECT = {
  id: true,
  address: true,
  city: true,
  state: true,
  zip: true,
  county: true,
  lat: true,
  lng: true,
  propertyType: true,
  yearBuilt: true,
  squareFeet: true,
  bedrooms: true,
  bathrooms: true,
  lotSize: true,
  estimatedValue: true,
  lastSalePrice: true,
  lastSaleDate: true,
  parcelId: true,
  createdAt: true,
  updatedAt: true,
} as const
