import { render, screen } from '@testing-library/react'
import { ActiveCarriers } from '@/components/property/ActiveCarriers'
import type { CarriersResult } from '@coverguard/shared'

jest.mock('lucide-react', () => ({
  CheckCircle: (props: Record<string, unknown>) => <svg data-testid="icon-check" {...props} />,
  XCircle: (props: Record<string, unknown>) => <svg data-testid="icon-x" {...props} />,
  AlertTriangle: (props: Record<string, unknown>) => <svg data-testid="icon-alert" {...props} />,
  ChevronDown: (props: Record<string, unknown>) => <svg data-testid="icon-chevron-down" {...props} />,
  ChevronUp: (props: Record<string, unknown>) => <svg data-testid="icon-chevron-up" {...props} />,
  Send: (props: Record<string, unknown>) => <svg data-testid="icon-send" {...props} />,
}))

jest.mock('@/components/property/QuoteRequestModal', () => ({
  QuoteRequestModal: () => <div data-testid="quote-modal" />,
}))

const mockCarriersData: CarriersResult = {
  propertyId: 'prop-1',
  carriers: [
    {
      id: 'state-farm',
      name: 'State Farm',
      amBestRating: 'A++',
      coverageTypes: ['HOMEOWNERS', 'FLOOD'],
      avgPremiumModifier: 1.05,
      statesLicensed: ['ALL'],
      specialties: ['Standard residential'],
      notes: null,
      writingStatus: 'ACTIVELY_WRITING' as const,
    },
    {
      id: 'lexington',
      name: 'Lexington Insurance',
      amBestRating: 'A',
      coverageTypes: ['HOMEOWNERS', 'FLOOD'],
      avgPremiumModifier: 1.25,
      statesLicensed: ['ALL'],
      specialties: ['Surplus lines'],
      notes: 'Surplus lines carrier',
      writingStatus: 'SURPLUS_LINES' as const,
    },
  ],
  marketCondition: 'MODERATE' as const,
  lastUpdated: '2024-01-01T00:00:00Z',
}

describe('ActiveCarriers', () => {
  const defaultProps = {
    data: mockCarriersData,
    propertyId: 'prop-1',
    propertyAddress: '123 Main St, Austin, TX 78701',
  }

  it('renders market condition badge', () => {
    render(<ActiveCarriers {...defaultProps} />)

    expect(screen.getByText('Moderate Market')).toBeInTheDocument()
  })

  it('renders carrier names', () => {
    render(<ActiveCarriers {...defaultProps} />)

    expect(screen.getByText('State Farm')).toBeInTheDocument()
    expect(screen.getByText('Lexington Insurance')).toBeInTheDocument()
  })

  it('shows AM Best rating for each carrier', () => {
    render(<ActiveCarriers {...defaultProps} />)

    expect(screen.getByText('A++')).toBeInTheDocument()
    expect(screen.getByText('A')).toBeInTheDocument()
  })

  it('shows writing status indicator for each carrier', () => {
    render(<ActiveCarriers {...defaultProps} />)

    expect(screen.getByText('Actively Writing')).toBeInTheDocument()
    expect(screen.getByText('Surplus Lines')).toBeInTheDocument()
  })

  it('carrier with ACTIVELY_WRITING status has Request Quote button', () => {
    render(<ActiveCarriers {...defaultProps} />)

    const quoteButtons = screen.getAllByText('Request Quote')
    expect(quoteButtons.length).toBeGreaterThanOrEqual(1)
  })

  it('renders last updated date', () => {
    render(<ActiveCarriers {...defaultProps} />)

    // The component formats the date with toLocaleDateString()
    const dateStr = new Date('2024-01-01T00:00:00Z').toLocaleDateString()
    expect(screen.getByText(new RegExp(dateStr))).toBeInTheDocument()
  })
})
