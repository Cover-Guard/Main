/**
 * OnboardingPage tests
 *
 * Covers:
 *  - Rendering all 4 disclosure items
 *  - Button disabled/enabled based on checkbox state
 *  - Button text when loading
 *  - Successful acceptance flow (API + updateUser + redirect)
 *  - No session redirect to /login
 *  - API error display
 *  - Links to /terms, /privacy, /nda
 */

import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

// ─── Mocks ──────────────────────────────────────────────────────────────────

const mockPush = jest.fn()
const mockRefresh = jest.fn()

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush, refresh: mockRefresh }),
}))

const mockSupabase = {
  auth: {
    getSession: jest.fn(),
    updateUser: jest.fn(),
  },
}

jest.mock('@/lib/supabase/client', () => ({
  createClient: () => mockSupabase,
}))

jest.mock('lucide-react', () =>
  new Proxy(
    {},
    {
      get: (_, name) =>
        (props: any) => <span data-testid={`icon-${String(name)}`} {...props} />,
    },
  ),
)

const mockFetch = jest.fn()
global.fetch = mockFetch

// ─── Import after mocks ─────────────────────────────────────────────────────

import OnboardingPage from '@/app/onboarding/page'

// ─── Helpers ────────────────────────────────────────────────────────────────

async function checkAllBoxes(user: ReturnType<typeof userEvent.setup>) {
  const checkboxes = screen.getAllByRole('checkbox')
  for (const cb of checkboxes) {
    await user.click(cb)
  }
}

// ─── Tests ──────────────────────────────────────────────────────────────────

beforeEach(() => {
  jest.clearAllMocks()
})

describe('OnboardingPage', () => {
  it('renders all 4 disclosure items', () => {
    render(<OnboardingPage />)
    expect(screen.getByText('Not a Binding Insurance Quote')).toBeInTheDocument()
    expect(screen.getByText('Data Accuracy & Limitations')).toBeInTheDocument()
    expect(screen.getByText('Not Financial or Legal Advice')).toBeInTheDocument()
    expect(screen.getByText('Carrier Availability')).toBeInTheDocument()
  })

  it('has button disabled when not all checkboxes are checked', () => {
    render(<OnboardingPage />)
    const button = screen.getByRole('button', { name: /accept & continue/i })
    expect(button).toBeDisabled()
  })

  it('has button enabled when all 3 checkboxes are checked', async () => {
    const user = userEvent.setup()
    render(<OnboardingPage />)
    await checkAllBoxes(user)
    const button = screen.getByRole('button', { name: /accept & continue/i })
    expect(button).toBeEnabled()
  })

  it('shows "Saving…" text on button when loading', async () => {
    mockSupabase.auth.getSession.mockResolvedValue({
      data: { session: { access_token: 'token123' } },
    })
    // Make fetch hang to keep loading state
    mockFetch.mockReturnValue(new Promise(() => {}))

    const user = userEvent.setup()
    render(<OnboardingPage />)
    await checkAllBoxes(user)
    await user.click(screen.getByRole('button', { name: /accept & continue/i }))

    await waitFor(() => {
      expect(screen.getByText('Saving…')).toBeInTheDocument()
    })
  })

  it('calls API, updates user metadata, and navigates to /dashboard on success', async () => {
    mockSupabase.auth.getSession.mockResolvedValue({
      data: { session: { access_token: 'token123' } },
    })
    mockFetch.mockResolvedValue({ ok: true, headers: { get: () => 'application/json' } })
    mockSupabase.auth.updateUser.mockResolvedValue({ error: null })

    const user = userEvent.setup()
    render(<OnboardingPage />)
    await checkAllBoxes(user)
    await user.click(screen.getByRole('button', { name: /accept & continue/i }))

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith('/api/auth/me/terms', expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ Authorization: 'Bearer token123' }),
      }))
    })
    expect(mockSupabase.auth.updateUser).toHaveBeenCalledWith({
      data: expect.objectContaining({
        termsAcceptedAt: expect.any(String),
        ndaAcceptedAt: expect.any(String),
        privacyAcceptedAt: expect.any(String),
      }),
    })
    expect(mockPush).toHaveBeenCalledWith('/dashboard')
    expect(mockRefresh).toHaveBeenCalled()
  })

  it('redirects to /login when no session', async () => {
    mockSupabase.auth.getSession.mockResolvedValue({
      data: { session: null },
    })

    const user = userEvent.setup()
    render(<OnboardingPage />)
    await checkAllBoxes(user)
    await user.click(screen.getByRole('button', { name: /accept & continue/i }))

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/login')
    })
  })

  it('shows error message on API failure', async () => {
    mockSupabase.auth.getSession.mockResolvedValue({
      data: { session: { access_token: 'token123' } },
    })
    mockFetch.mockResolvedValue({
      ok: false,
      headers: { get: () => 'application/json' },
      json: async () => ({ error: { message: 'Server error' } }),
    })

    const user = userEvent.setup()
    render(<OnboardingPage />)
    await checkAllBoxes(user)
    await user.click(screen.getByRole('button', { name: /accept & continue/i }))

    await waitFor(() => {
      expect(screen.getByText('Server error')).toBeInTheDocument()
    })
    expect(mockPush).not.toHaveBeenCalledWith('/dashboard')
  })

  it('has links to /terms, /privacy, /nda that open in new tabs', () => {
    render(<OnboardingPage />)
    const termsLinks = screen.getAllByRole('link', { name: /terms of service/i })
    const privacyLinks = screen.getAllByRole('link', { name: /privacy policy/i })
    const ndaLinks = screen.getAllByRole('link', { name: /non-disclosure agreement/i })

    expect(termsLinks.length).toBeGreaterThan(0)
    expect(termsLinks[0]).toHaveAttribute('href', '/terms')
    expect(termsLinks[0]).toHaveAttribute('target', '_blank')

    expect(privacyLinks.length).toBeGreaterThan(0)
    expect(privacyLinks[0]).toHaveAttribute('href', '/privacy')
    expect(privacyLinks[0]).toHaveAttribute('target', '_blank')

    expect(ndaLinks.length).toBeGreaterThan(0)
    expect(ndaLinks[0]).toHaveAttribute('href', '/nda')
    expect(ndaLinks[0]).toHaveAttribute('target', '_blank')
  })
})
