import { render, screen } from '@testing-library/react'
import { SearchResults } from '@/components/search/SearchResults'
import type { Property } from '@coverguard/shared'

jest.mock('@/components/search/PropertyCard', () => ({
  PropertyCard: ({ property }: { property: { id: string; address: string } }) => (
    <div data-testid={`property-card-${property.id}`}>{property.address}</div>
  ),
}))

function makeProperty(overrides: Partial<Property> & { id: string; address: string }): Property {
  return {
    city: 'Austin',
    state: 'TX',
    zip: '78701',
    county: 'Travis',
    lat: 30.2672,
    lng: -97.7431,
    propertyType: 'SINGLE_FAMILY',
    yearBuilt: 2000,
    squareFeet: 1800,
    bedrooms: 3,
    bathrooms: 2,
    lotSize: 5000,
    estimatedValue: 500000,
    lastSalePrice: 400000,
    lastSaleDate: '2022-01-01',
    parcelId: 'MOCK-000001',
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
    ...overrides,
  } as Property
}

const properties: Property[] = [
  makeProperty({ id: '1', address: '100 First St' }),
  makeProperty({ id: '2', address: '200 Second St' }),
  makeProperty({ id: '3', address: '300 Third St' }),
]

describe('SearchResults', () => {
  it('renders a PropertyCard for each property', () => {
    render(<SearchResults properties={properties} query="Austin" />)
    expect(screen.getByTestId('property-card-1')).toBeInTheDocument()
    expect(screen.getByTestId('property-card-2')).toBeInTheDocument()
    expect(screen.getByTestId('property-card-3')).toBeInTheDocument()
  })

  it('displays result count', () => {
    render(<SearchResults properties={properties} query="Austin" />)
    expect(screen.getByText(/3 results/)).toBeInTheDocument()
  })

  it('uses singular "result" for a single property', () => {
    render(<SearchResults properties={[properties[0]!]} query="Austin" />)
    expect(screen.getByText(/1 result(?!s)/)).toBeInTheDocument()
  })

  it('shows empty state message when no properties', () => {
    render(<SearchResults properties={[]} query="Nowhere" />)
    expect(screen.getByText(/No properties found/)).toBeInTheDocument()
  })

  it('shows query in the empty state message', () => {
    render(<SearchResults properties={[]} query="99999" />)
    expect(screen.getByText(/99999/)).toBeInTheDocument()
  })
})
