import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import type { Property } from '@coverguard/shared'
import { PropertyCard } from '@/components/search/PropertyCard'
import { useCompare } from '@/lib/useCompare'

jest.mock('lucide-react', () =>
  new Proxy(
    {},
    {
      get: (_, name) =>
        (props: any) => <span data-testid={`icon-${String(name)}`} {...props} />,
    },
  ),
)

jest.mock('next/link', () => ({
  __esModule: true,
  default: ({ children, href, ...props }: any) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}))

jest.mock('@/lib/useCompare', () => ({
  useCompare: jest.fn(),
}))

jest.mock('@coverguard/shared', () => ({
  formatCurrency: (v: number) => `$${v.toLocaleString()}`,
  formatAddress: (p: any) => `${p.city}, ${p.state} ${p.zip}`,
  formatSquareFeet: (v: number) => `${v.toLocaleString()} sqft`,
}))

const mockToggle = jest.fn()
const mockUseCompare = useCompare as jest.Mock

function mockProperty(overrides: Partial<Property> = {}): Property {
  return {
    id: 'prop-1',
    address: '123 Main St',
    city: 'Austin',
    state: 'TX',
    zip: '78701',
    county: 'Travis',
    lat: 30.27,
    lng: -97.74,
    propertyType: 'SINGLE_FAMILY',
    yearBuilt: 2000,
    squareFeet: 2000,
    bedrooms: 3,
    bathrooms: 2,
    lotSize: 5000,
    estimatedValue: 500000,
    lastSalePrice: 450000,
    lastSaleDate: '2023-01-15',
    parcelId: 'R123456',
    createdAt: '2024-01-01',
    updatedAt: '2024-06-01',
    ...overrides,
  } as Property
}

beforeEach(() => {
  jest.clearAllMocks()
  mockUseCompare.mockReturnValue({
    ids: [],
    toggle: mockToggle,
    canAdd: true,
    compareUrl: null,
    clear: jest.fn(),
  })
})

describe('PropertyCard', () => {
  it('renders property address and formatted location', () => {
    render(<PropertyCard property={mockProperty()} />)
    expect(screen.getByText('123 Main St')).toBeInTheDocument()
    expect(screen.getByText('Austin, TX 78701')).toBeInTheDocument()
  })

  it('renders property type, square feet, and year built', () => {
    render(<PropertyCard property={mockProperty()} />)
    expect(screen.getByText('SINGLE FAMILY')).toBeInTheDocument()
    expect(screen.getByText('2,000 sqft')).toBeInTheDocument()
    expect(screen.getByText('Built 2000')).toBeInTheDocument()
  })

  it('renders beds/baths when available', () => {
    render(<PropertyCard property={mockProperty()} />)
    expect(screen.getByText('3 bd / 2 ba')).toBeInTheDocument()
  })

  it('links to property detail page', () => {
    render(<PropertyCard property={mockProperty()} />)
    const link = screen.getByRole('link')
    expect(link).toHaveAttribute('href', '/properties/prop-1')
  })

  it('shows estimated value when present', () => {
    render(<PropertyCard property={mockProperty()} />)
    expect(screen.getByText('Est. value')).toBeInTheDocument()
    expect(screen.getByText('$500,000')).toBeInTheDocument()
  })

  it('shows last sale price when present', () => {
    render(<PropertyCard property={mockProperty()} />)
    expect(screen.getByText('Last sale')).toBeInTheDocument()
    expect(screen.getByText('$450,000')).toBeInTheDocument()
  })

  it('hides optional fields when null', () => {
    render(
      <PropertyCard
        property={mockProperty({
          squareFeet: null as any,
          yearBuilt: null as any,
          bedrooms: null as any,
          estimatedValue: null as any,
          lastSalePrice: null as any,
        })}
      />,
    )
    expect(screen.queryByText(/sqft/)).not.toBeInTheDocument()
    expect(screen.queryByText(/Built/)).not.toBeInTheDocument()
    expect(screen.queryByText(/bd \//)).not.toBeInTheDocument()
    expect(screen.queryByText('Est. value')).not.toBeInTheDocument()
    expect(screen.queryByText('Last sale')).not.toBeInTheDocument()
  })

  it('shows "Add to compare" when not compared and canAdd', () => {
    render(<PropertyCard property={mockProperty()} />)
    expect(screen.getByText('Add to compare')).toBeInTheDocument()
  })

  it('shows "Added to compare" when property is in compare list', () => {
    mockUseCompare.mockReturnValue({
      ids: ['prop-1'],
      toggle: mockToggle,
      canAdd: true,
      compareUrl: null,
      clear: jest.fn(),
    })
    render(<PropertyCard property={mockProperty()} />)
    expect(screen.getByText('Added to compare')).toBeInTheDocument()
  })

  it('shows "Compare full (max 3)" when cannot add more', () => {
    mockUseCompare.mockReturnValue({
      ids: ['a', 'b', 'c'],
      toggle: mockToggle,
      canAdd: false,
      compareUrl: null,
      clear: jest.fn(),
    })
    render(<PropertyCard property={mockProperty()} />)
    expect(screen.getByText('Compare full (max 3)')).toBeInTheDocument()
  })

  it('toggle button calls toggle(property.id) on click', () => {
    render(<PropertyCard property={mockProperty()} />)
    fireEvent.click(screen.getByRole('button'))
    expect(mockToggle).toHaveBeenCalledWith('prop-1')
  })

  it('compare button is disabled when full and not already compared', () => {
    mockUseCompare.mockReturnValue({
      ids: ['a', 'b', 'c'],
      toggle: mockToggle,
      canAdd: false,
      compareUrl: null,
      clear: jest.fn(),
    })
    render(<PropertyCard property={mockProperty()} />)
    expect(screen.getByRole('button')).toBeDisabled()
  })

  it('shows APN when parcelId is present', () => {
    render(<PropertyCard property={mockProperty()} />)
    expect(screen.getByText('APN: R123456')).toBeInTheDocument()
  })

  it('shows ZIP when parcelId is not present', () => {
    render(
      <PropertyCard
        property={mockProperty({ parcelId: null as any })}
      />,
    )
    expect(screen.getByText('ZIP: 78701')).toBeInTheDocument()
  })
})
