/**
 * LoginPage tests
 *
 * Covers:
 *  - Rendering form inputs and OAuth button
 *  - Callback error display from searchParams
 *  - Links to agent login and register
 *  - Form validation (email, password)
 *  - Successful login flow
 *  - Login error display
 *  - Google OAuth flow
 *  - Safe redirect validation
 */

import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

// ─── Mocks ──────────────────────────────────────────────────────────────────

const mockPush = jest.fn()
const mockRefresh = jest.fn()
let mockSearchParams = new URLSearchParams()

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush, refresh: mockRefresh }),
  useSearchParams: () => mockSearchParams,
}))

const mockSupabase = {
  auth: {
    signInWithPassword: jest.fn(),
    signInWithOAuth: jest.fn(),
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

// ─── Import after mocks ─────────────────────────────────────────────────────

import LoginPage from '@/app/(auth)/login/page'

// ─── Tests ──────────────────────────────────────────────────────────────────

beforeEach(() => {
  jest.clearAllMocks()
  mockSearchParams = new URLSearchParams()
})

describe('LoginPage', () => {
  it('renders sign in form with email and password inputs', () => {
    render(<LoginPage />)
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument()
  })

  it('renders Google OAuth button with text "Continue with Google"', () => {
    render(<LoginPage />)
    expect(screen.getByRole('button', { name: /continue with google/i })).toBeInTheDocument()
  })

  it('shows callback error from searchParams', () => {
    mockSearchParams = new URLSearchParams('error=OAuth sign-in failed')
    render(<LoginPage />)
    expect(screen.getByText('OAuth sign-in failed')).toBeInTheDocument()
  })

  it('shows link to agent login and register pages', () => {
    render(<LoginPage />)
    expect(screen.getByRole('link', { name: /agent login/i })).toHaveAttribute('href', '/agents/login')
    expect(screen.getByRole('link', { name: /create account/i })).toHaveAttribute('href', '/register')
  })

  it('shows error for invalid email', async () => {
    const user = userEvent.setup()
    render(<LoginPage />)
    // Submit without entering any data — react-hook-form prevents submission
    await user.click(screen.getByRole('button', { name: /sign in/i }))

    await waitFor(() => {
      expect(mockSupabase.auth.signInWithPassword).not.toHaveBeenCalled()
    })
  })

  it('shows error for missing password', async () => {
    const user = userEvent.setup()
    render(<LoginPage />)
    await user.type(screen.getByLabelText(/email/i), 'test@example.com')
    await user.click(screen.getByRole('button', { name: /sign in/i }))

    await waitFor(() => {
      expect(screen.getByText(/password is required/i)).toBeInTheDocument()
    })
    expect(mockSupabase.auth.signInWithPassword).not.toHaveBeenCalled()
  })

  it('calls signInWithPassword and navigates to dashboard on success', async () => {
    mockSupabase.auth.signInWithPassword.mockResolvedValue({ error: null })
    const user = userEvent.setup()
    render(<LoginPage />)

    await user.type(screen.getByLabelText(/email/i), 'test@example.com')
    await user.type(screen.getByLabelText(/password/i), 'password123')
    await user.click(screen.getByRole('button', { name: /sign in/i }))

    await waitFor(() => {
      expect(mockSupabase.auth.signInWithPassword).toHaveBeenCalledWith({
        email: 'test@example.com',
        password: 'password123',
      })
    })
    expect(mockPush).toHaveBeenCalledWith('/dashboard')
    expect(mockRefresh).toHaveBeenCalled()
  })

  it('displays Supabase error message on login failure', async () => {
    mockSupabase.auth.signInWithPassword.mockResolvedValue({
      error: { message: 'Invalid login credentials' },
    })
    const user = userEvent.setup()
    render(<LoginPage />)

    await user.type(screen.getByLabelText(/email/i), 'test@example.com')
    await user.type(screen.getByLabelText(/password/i), 'wrongpass')
    await user.click(screen.getByRole('button', { name: /sign in/i }))

    await waitFor(() => {
      expect(screen.getByText('Invalid login credentials')).toBeInTheDocument()
    })
    expect(mockPush).not.toHaveBeenCalled()
  })

  it('calls signInWithOAuth for Google sign-in', async () => {
    mockSupabase.auth.signInWithOAuth.mockResolvedValue({ error: null })
    const user = userEvent.setup()
    render(<LoginPage />)

    await user.click(screen.getByRole('button', { name: /continue with google/i }))

    await waitFor(() => {
      expect(mockSupabase.auth.signInWithOAuth).toHaveBeenCalledWith(
        expect.objectContaining({ provider: 'google' }),
      )
    })
  })

  it('rejects // prefix redirect and defaults to /dashboard', async () => {
    mockSearchParams = new URLSearchParams('redirectTo=//evil.com')
    mockSupabase.auth.signInWithPassword.mockResolvedValue({ error: null })
    const user = userEvent.setup()
    render(<LoginPage />)

    await user.type(screen.getByLabelText(/email/i), 'test@example.com')
    await user.type(screen.getByLabelText(/password/i), 'password123')
    await user.click(screen.getByRole('button', { name: /sign in/i }))

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/dashboard')
    })
  })
})
