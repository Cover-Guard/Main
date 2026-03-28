import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { QuoteRequestModal } from '@/components/property/QuoteRequestModal'
import { requestBindingQuote } from '@/lib/api'
import type { Carrier } from '@coverguard/shared'

// Mock lucide-react icons to avoid ESM import issues
jest.mock('lucide-react', () => {
  const icon = (name: string) => (props: Record<string, unknown>) => <svg data-testid={`icon-${name}`} {...props} />
  return {
    X: icon('x'),
    Send: icon('send'),
    CheckCircle: icon('check-circle'),
  }
})

jest.mock('@/lib/api', () => ({
  requestBindingQuote: jest.fn(),
}))

const mockRequestBindingQuote = requestBindingQuote as jest.MockedFunction<typeof requestBindingQuote>

const mockCarrier: Carrier = {
  id: 'state-farm',
  name: 'State Farm',
  amBestRating: 'A++',
  coverageTypes: ['HOMEOWNERS', 'FLOOD'] as any,
  avgPremiumModifier: 1.05,
  statesLicensed: ['ALL'],
  specialties: ['Standard residential'],
  notes: null,
  writingStatus: 'ACTIVELY_WRITING' as const,
}

const defaultProps = {
  carrier: mockCarrier,
  propertyId: 'prop-123',
  propertyAddress: '123 Main St, Austin TX',
  onClose: jest.fn(),
}

describe('QuoteRequestModal', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('renders carrier name and AM Best rating', () => {
    render(<QuoteRequestModal {...defaultProps} />)

    expect(screen.getByText('State Farm')).toBeInTheDocument()
    expect(screen.getByText('AM Best: A++')).toBeInTheDocument()
  })

  it('renders coverage type toggles for each carrier coverage', () => {
    render(<QuoteRequestModal {...defaultProps} />)

    // The component uses formatCoverageType which converts HOMEOWNERS -> Homeowners, FLOOD -> Flood
    const buttons = screen.getAllByRole('button')
    const coverageButtons = buttons.filter(
      (btn) => btn.getAttribute('type') === 'button' && !btn.textContent?.includes('Cancel')
    )
    // Should have at least 2 coverage toggle buttons (HOMEOWNERS and FLOOD)
    expect(coverageButtons.length).toBeGreaterThanOrEqual(2)
  })

  it('submit button disabled when no coverage types selected', () => {
    render(<QuoteRequestModal {...defaultProps} />)

    // The component initializes with the first coverage type selected.
    // We need to deselect all coverage types.
    // Find all toggle buttons and click the selected one(s) to deselect
    const allButtons = screen.getAllByRole('button')

    // Find coverage toggle buttons (type="button" and not Cancel/close)
    const coverageButtons = allButtons.filter(
      (btn) =>
        btn.getAttribute('type') === 'button' &&
        !btn.textContent?.includes('Cancel') &&
        !btn.closest('[class*="btn-ghost"]')
    )

    // Click each coverage button that appears selected to deselect it
    coverageButtons.forEach((btn) => {
      if (btn.className.includes('bg-brand-600') || btn.className.includes('text-white')) {
        fireEvent.click(btn)
      }
    })

    const submitButton = screen.getByRole('button', { name: /Request Binding Quote/i })
    expect(submitButton).toBeDisabled()
  })

  it('selecting coverage types enables submit', () => {
    render(<QuoteRequestModal {...defaultProps} />)

    // The first coverage type is already selected by default
    const submitButton = screen.getByRole('button', { name: /Request Binding Quote/i })
    expect(submitButton).not.toBeDisabled()
  })

  it('successful submission shows success step', async () => {
    mockRequestBindingQuote.mockResolvedValue({ quoteRequestId: 'qr-1' })

    render(<QuoteRequestModal {...defaultProps} />)

    const submitButton = screen.getByRole('button', { name: /Request Binding Quote/i })
    fireEvent.click(submitButton)

    await waitFor(() => {
      expect(screen.getByText('Quote Request Submitted')).toBeInTheDocument()
    })
  })

  it('calls requestBindingQuote with correct params', async () => {
    mockRequestBindingQuote.mockResolvedValue({ quoteRequestId: 'qr-1' })

    render(<QuoteRequestModal {...defaultProps} />)

    const submitButton = screen.getByRole('button', { name: /Request Binding Quote/i })
    fireEvent.click(submitButton)

    await waitFor(() => {
      expect(mockRequestBindingQuote).toHaveBeenCalledWith(
        'prop-123',
        'state-farm',
        expect.arrayContaining(['HOMEOWNERS']),
        '' // notes default to empty string
      )
    })
  })

  it('calls onClose when Done button clicked in success step', async () => {
    mockRequestBindingQuote.mockResolvedValue({ quoteRequestId: 'qr-1' })

    render(<QuoteRequestModal {...defaultProps} />)

    const submitButton = screen.getByRole('button', { name: /Request Binding Quote/i })
    fireEvent.click(submitButton)

    await waitFor(() => {
      expect(screen.getByText('Done')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByText('Done'))
    expect(defaultProps.onClose).toHaveBeenCalledTimes(1)
  })

  it('shows error message when API call fails', async () => {
    mockRequestBindingQuote.mockRejectedValue(new Error('Service unavailable'))

    render(<QuoteRequestModal {...defaultProps} />)

    const submitButton = screen.getByRole('button', { name: /Request Binding Quote/i })
    fireEvent.click(submitButton)

    await waitFor(() => {
      expect(screen.getByText('Service unavailable')).toBeInTheDocument()
    })
  })
})
