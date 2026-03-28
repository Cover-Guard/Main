import { render, screen } from '@testing-library/react'
import { InsurabilityPanel } from '@/components/property/InsurabilityPanel'
import type { InsurabilityStatus } from '@coverguard/shared'

jest.mock('lucide-react', () => ({
  CheckCircle: (props: Record<string, unknown>) => <svg data-testid="icon-check" {...props} />,
  XCircle: (props: Record<string, unknown>) => <svg data-testid="icon-x" {...props} />,
  AlertTriangle: (props: Record<string, unknown>) => <svg data-testid="icon-alert" {...props} />,
  Info: (props: Record<string, unknown>) => <svg data-testid="icon-info" {...props} />,
}))

const lowRiskStatus: InsurabilityStatus = {
  propertyId: 'prop-1',
  difficultyLevel: 'LOW' as const,
  isInsurable: true,
  potentialIssues: [],
  recommendedActions: ['Standard insurance should be readily available.'],
}

const highRiskStatus: InsurabilityStatus = {
  propertyId: 'prop-2',
  difficultyLevel: 'HIGH' as const,
  isInsurable: true,
  potentialIssues: ['Property is in SFHA flood zone', 'Hurricane wind risk area'],
  recommendedActions: ['Obtain flood insurance', 'Get wind/hurricane coverage'],
}

const extremeStatus: InsurabilityStatus = {
  propertyId: 'prop-3',
  difficultyLevel: 'EXTREME' as const,
  isInsurable: false,
  potentialIssues: ['Multiple severe risk factors'],
  recommendedActions: ['Contact surplus lines broker', 'Consider FAIR Plan'],
}

describe('InsurabilityPanel', () => {
  it('renders "Insurable" badge for insurable property', () => {
    render(<InsurabilityPanel status={lowRiskStatus} />)

    expect(screen.getByText('Insurable')).toBeInTheDocument()
  })

  it('renders "Non-Insurable" badge for non-insurable property', () => {
    render(<InsurabilityPanel status={extremeStatus} />)

    expect(screen.getByText('Non-Insurable')).toBeInTheDocument()
  })

  it('shows difficulty level text', () => {
    render(<InsurabilityPanel status={highRiskStatus} />)

    expect(screen.getByText('Difficult to Insure')).toBeInTheDocument()
  })

  it('renders potential issues as list items', () => {
    render(<InsurabilityPanel status={highRiskStatus} />)

    expect(screen.getByText('Property is in SFHA flood zone')).toBeInTheDocument()
    expect(screen.getByText('Hurricane wind risk area')).toBeInTheDocument()
  })

  it('renders recommended actions as list items', () => {
    render(<InsurabilityPanel status={highRiskStatus} />)

    expect(screen.getByText('Obtain flood insurance')).toBeInTheDocument()
    expect(screen.getByText('Get wind/hurricane coverage')).toBeInTheDocument()
  })

  it('shows no issues section when potentialIssues is empty', () => {
    render(<InsurabilityPanel status={lowRiskStatus} />)

    expect(screen.queryByText('Potential Issues')).not.toBeInTheDocument()
  })

  it('uses green color scheme for LOW difficulty', () => {
    const { container } = render(<InsurabilityPanel status={lowRiskStatus} />)

    expect(screen.getByText('Easily Insurable')).toBeInTheDocument()
    const header = container.querySelector('.bg-green-50')
    expect(header).toBeInTheDocument()
  })

  it('uses orange color scheme for HIGH difficulty', () => {
    const { container } = render(<InsurabilityPanel status={highRiskStatus} />)

    expect(screen.getByText('Difficult to Insure')).toBeInTheDocument()
    const header = container.querySelector('.bg-orange-50')
    expect(header).toBeInTheDocument()
  })

  it('uses red color scheme for EXTREME difficulty', () => {
    const { container } = render(<InsurabilityPanel status={extremeStatus} />)

    expect(screen.getByText('Potentially Uninsurable')).toBeInTheDocument()
    const header = container.querySelector('.bg-red-100')
    expect(header).toBeInTheDocument()
  })
})
