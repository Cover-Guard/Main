import { PROPERTY_PUBLIC_SELECT } from '../../utils/propertySelect'

describe('PROPERTY_PUBLIC_SELECT', () => {
  const expectedFields = [
    'id',
    'address',
    'city',
    'state',
    'zip',
    'county',
    'lat',
    'lng',
    'propertyType',
    'yearBuilt',
    'squareFeet',
    'bedrooms',
    'bathrooms',
    'lotSize',
    'estimatedValue',
    'lastSalePrice',
    'lastSaleDate',
    'parcelId',
    'createdAt',
    'updatedAt',
  ]

  it('includes all expected public fields', () => {
    for (const field of expectedFields) {
      expect(PROPERTY_PUBLIC_SELECT).toHaveProperty(field)
    }
  })

  it('does NOT include externalId', () => {
    expect(PROPERTY_PUBLIC_SELECT).not.toHaveProperty('externalId')
  })

  it('all values are true', () => {
    for (const value of Object.values(PROPERTY_PUBLIC_SELECT)) {
      expect(value).toBe(true)
    }
  })

  it('has exactly 20 fields', () => {
    expect(Object.keys(PROPERTY_PUBLIC_SELECT)).toHaveLength(20)
  })
})
