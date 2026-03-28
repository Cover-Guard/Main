import { render, screen } from '@testing-library/react'
import { InsuranceCostEstimate } from '@/components/property/InsuranceCostEstimate'
import type { InsuranceCostEstimate as InsuranceCostEstimateType } from '@coverguard/shared'

jest.mock('lucide-react', () => ({
  AlertTriangle: (props: Record<string, unknown>) => <svg data-testid="icon-alert" {...props} />,
  Info: (props: Record<string, unknown>) => <svg data-testid="icon-info" {...props} />,
}))

const mockEstimate: InsuranceCostEstimateType = {
  propertyId: 'prop-1',
  estimatedAnnualTotal: 3200,
  estimatedMonthlyTotal: 267,
  confidenceLevel: 'MEDIUM' as const,
  coverages: [
    {
      type: 'HOMEOWNERS',
      averageAnnualPremium: 1800,
      lowEstimate: 1500,
      highEstimate: 2200,
      required: true,
      notes: ['Standard HO-3'],
    },
    {
      type: 'FLOOD',
      averageAnnualPremium: 1400,
      lowEstimate: 900,
      highEstimate: 1800,
      required: true,
      notes: ['NFIP or private'],
    },
  ],
  keyRiskFactors: ['Flood zone proximity'],
  recommendations: ['Bundle policies for discount'],
  disclaimers: ['Estimates are not quotes'],
  generatedAt: '2024-01-01T00:00:00Z',
}

describe('InsuranceCostEstimate', () => {
  it('renders estimated annual total formatted as currency', () => {
    render(<InsuranceCostEstimate estimate={mockEstimate} />)

    expect(screen.getByText('$3,200')).toBeInTheDocument()
  })

  it('renders monthly equivalent', () => {
    render(<InsuranceCostEstimate estimate={mockEstimate} />)

    expect(screen.getByText(/\$267\/mo/)).toBeInTheDocument()
  })

  it('renders confidence level badge', () => {
    render(<InsuranceCostEstimate estimate={mockEstimate} />)

    expect(screen.getByText('MEDIUM confidence')).toBeInTheDocument()
  })

  it('renders coverage breakdown table with types', () => {
    render(<InsuranceCostEstimate estimate={mockEstimate} />)

    expect(screen.getByText('Homeowners')).toBeInTheDocument()
    expect(screen.getByText('Flood')).toBeInTheDocument()
  })

  it('shows average premium for each coverage', () => {
    render(<InsuranceCostEstimate estimate={mockEstimate} />)

    expect(screen.getByText('$1,800/yr')).toBeInTheDocument()
    expect(screen.getByText('$1,400/yr')).toBeInTheDocument()
  })

  it('shows low-high range for each coverage', () => {
    render(<InsuranceCostEstimate estimate={mockEstimate} />)

    // Homeowners range: $1,500 - $2,200
    expect(screen.getByText(/\$1,500/)).toBeInTheDocument()
    expect(screen.getByText(/\$2,200/)).toBeInTheDocument()
    // Flood range: $900 - $1,800 (use getAllByText since $1,800 also appears as average premium)
    expect(screen.getByText(/\$900/)).toBeInTheDocument()
    const floodHighMatches = screen.getAllByText(/\$1,800/)
    expect(floodHighMatches.length).toBeGreaterThanOrEqual(2) // average premium + range high
  })

  it('marks required coverages with badge', () => {
    render(<InsuranceCostEstimate estimate={mockEstimate} />)

    const requiredBadges = screen.getAllByText('Required')
    expect(requiredBadges).toHaveLength(2)
  })

  it('renders recommendations section', () => {
    render(<InsuranceCostEstimate estimate={mockEstimate} />)

    expect(screen.getByText('Recommendations')).toBeInTheDocument()
    expect(screen.getByText('Bundle policies for discount')).toBeInTheDocument()
  })

  it('renders disclaimer text', () => {
    render(<InsuranceCostEstimate estimate={mockEstimate} />)

    expect(screen.getByText('Estimates are not quotes')).toBeInTheDocument()
  })
})
