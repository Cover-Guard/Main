import { render, screen, fireEvent } from '@testing-library/react'
import type { Property } from '@coverguard/shared'

// --- mocks ---

// Mock lucide-react icons to avoid ESM import issues
jest.mock('lucide-react', () => ({
  MapPin: (props: Record<string, unknown>) => <svg data-testid="icon-map-pin" {...props} />,
  Home: (props: Record<string, unknown>) => <svg data-testid="icon-home" {...props} />,
  Calendar: (props: Record<string, unknown>) => <svg data-testid="icon-calendar" {...props} />,
  DollarSign: (props: Record<string, unknown>) => <svg data-testid="icon-dollar" {...props} />,
  GitCompare: (props: Record<string, unknown>) => <svg data-testid="icon-compare" {...props} />,
  Shield: (props: Record<string, unknown>) => <svg data-testid="icon-shield" {...props} />,
  ArrowRight: (props: Record<string, unknown>) => <svg data-testid="icon-arrow" {...props} />,
}))

const mockToggle = jest.fn()
const mockUseCompare = jest.fn().mockReturnValue({
  ids: [],
  toggle: mockToggle,
  canAdd: true,
  compareUrl: null,
  clear: jest.fn(),
})

jest.mock('@/lib/useCompare', () => ({
  useCompare: () => mockUseCompare(),
}))

// Import after mocks are set up
const { PropertyCard } = require('@/components/search/PropertyCard') as typeof import('@/components/search/PropertyCard')

// --- mock property ---

const mockProperty: Property = {
  id: 'prop-1',
  address: '123 Main St',
  city: 'Austin',
  state: 'TX',
  zip: '78701',
  county: 'Travis',
  lat: 30.2672,
  lng: -97.7431,
  propertyType: 'SINGLE_FAMILY' as const,
  yearBuilt: 1998,
  squareFeet: 2100,
  bedrooms: 3,
  bathrooms: 2,
  lotSize: 7200,
  estimatedValue: 620000,
  lastSalePrice: 485000,
  lastSaleDate: '2021-03-15',
  parcelId: 'MOCK-000001',
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-01T00:00:00Z',
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
  it('renders property address', () => {
    render(<PropertyCard property={mockProperty} />)
    expect(screen.getByText('123 Main St')).toBeInTheDocument()
  })

  it('renders city, state, zip', () => {
    render(<PropertyCard property={mockProperty} />)
    // formatAddress produces "123 Main St, Austin, TX 78701"
    expect(screen.getByText(/Austin, TX 78701/)).toBeInTheDocument()
  })

  it('renders property type', () => {
    render(<PropertyCard property={mockProperty} />)
    expect(screen.getByText('SINGLE FAMILY')).toBeInTheDocument()
  })

  it('renders year built', () => {
    render(<PropertyCard property={mockProperty} />)
    expect(screen.getByText(/1998/)).toBeInTheDocument()
  })

  it('renders square feet', () => {
    render(<PropertyCard property={mockProperty} />)
    // formatSquareFeet(2100) => "2,100 sq ft"
    expect(screen.getByText(/2,100 sq ft/)).toBeInTheDocument()
  })

  it('renders bedrooms and bathrooms', () => {
    render(<PropertyCard property={mockProperty} />)
    expect(screen.getByText(/3 bd/)).toBeInTheDocument()
    expect(screen.getByText(/2 ba/)).toBeInTheDocument()
  })

  it('renders estimated value formatted as currency', () => {
    render(<PropertyCard property={mockProperty} />)
    // formatCurrency(620000) => "$620,000"
    expect(screen.getByText('$620,000')).toBeInTheDocument()
  })

  it('renders last sale price formatted as currency', () => {
    render(<PropertyCard property={mockProperty} />)
    // formatCurrency(485000) => "$485,000"
    expect(screen.getByText('$485,000')).toBeInTheDocument()
  })

  it('shows "Check Risk" badge', () => {
    render(<PropertyCard property={mockProperty} />)
    expect(screen.getByText('Check Risk')).toBeInTheDocument()
  })

  it('has link to property detail page', () => {
    render(<PropertyCard property={mockProperty} />)
    const link = screen.getByRole('link')
    expect(link).toHaveAttribute('href', '/properties/prop-1')
  })

  it('shows "Add to compare" button when canAdd is true', () => {
    render(<PropertyCard property={mockProperty} />)
    expect(screen.getByText('Add to compare')).toBeInTheDocument()
  })

  it('shows "Added to compare" when property is in compare ids', () => {
    mockUseCompare.mockReturnValue({
      ids: ['prop-1'],
      toggle: mockToggle,
      canAdd: true,
      compareUrl: '/compare?ids=prop-1',
      clear: jest.fn(),
    })
    render(<PropertyCard property={mockProperty} />)
    expect(screen.getByText('Added to compare')).toBeInTheDocument()
  })

  it('shows "Compare full" when canAdd is false and property not in ids', () => {
    mockUseCompare.mockReturnValue({
      ids: ['other-1', 'other-2', 'other-3'],
      toggle: mockToggle,
      canAdd: false,
      compareUrl: '/compare?ids=other-1,other-2,other-3',
      clear: jest.fn(),
    })
    render(<PropertyCard property={mockProperty} />)
    expect(screen.getByText(/Compare full/)).toBeInTheDocument()
  })

  it('calls toggle with property id when compare button clicked', () => {
    render(<PropertyCard property={mockProperty} />)
    const button = screen.getByText('Add to compare')
    fireEvent.click(button)
    expect(mockToggle).toHaveBeenCalledWith('prop-1')
  })

  it('handles null values gracefully (yearBuilt null, squareFeet null)', () => {
    const nullProperty: Property = {
      ...mockProperty,
      yearBuilt: null as unknown as number,
      squareFeet: null as unknown as number,
    }
    render(<PropertyCard property={nullProperty} />)
    // Should still render without crashing
    expect(screen.getByText('123 Main St')).toBeInTheDocument()
    // These should not appear when null
    expect(screen.queryByText(/Built/)).not.toBeInTheDocument()
    expect(screen.queryByText(/sq ft/)).not.toBeInTheDocument()
  })
})
