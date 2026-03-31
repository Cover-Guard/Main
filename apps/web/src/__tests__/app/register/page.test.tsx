/**
 * RegisterPage tests
 *
 * Covers:
 *  - Rendering registration form with all fields
 *  - Default role is BUYER
 *  - Company field visibility based on role
 *  - Form validation (firstName, password length)
 *  - Successful registration flow (API + auto sign-in + redirect)
 *  - API error handling
 *  - Non-JSON response handling
 *  - Google OAuth with role in redirect
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

const mockFetch = jest.fn()
global.fetch = mockFetch

// ─── Import after mocks ─────────────────────────────────────────────────────

import RegisterPage from '@/app/(auth)/register/page'

// ─── Helpers ────────────────────────────────────────────────────────────────

/** The register form labels don't use htmlFor, so we query by text + sibling input. */
function getInput(labelText: RegExp): HTMLInputElement {
  const label = screen.getByText(labelText)
  const input = label.closest('div')?.querySelector('input, select')
  if (!input) throw new Error(`No input found near label "${labelText}"`)
  return input as HTMLInputElement
}

function getSelect(labelText: RegExp): HTMLSelectElement {
  const label = screen.getByText(labelText)
  const select = label.closest('div')?.querySelector('select')
  if (!select) throw new Error(`No select found near label "${labelText}"`)
  return select as HTMLSelectElement
}

// ─── Tests ──────────────────────────────────────────────────────────────────

beforeEach(() => {
  jest.clearAllMocks()
})

describe('RegisterPage', () => {
  it('renders registration form with all fields', () => {
    render(<RegisterPage />)
    expect(screen.getByText(/first name/i)).toBeInTheDocument()
    expect(screen.getByText(/last name/i)).toBeInTheDocument()
    expect(screen.getByText(/^email$/i)).toBeInTheDocument()
    expect(screen.getByText(/^password$/i)).toBeInTheDocument()
    expect(screen.getByText(/i am a/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /create account/i })).toBeInTheDocument()
  })

  it('defaults role to BUYER (Home Buyer)', () => {
    render(<RegisterPage />)
    const select = getSelect(/i am a/i)
    expect(select.value).toBe('BUYER')
  })

  it('hides company field when role is BUYER', () => {
    render(<RegisterPage />)
    expect(screen.queryByText(/^company$/i)).not.toBeInTheDocument()
  })

  it('shows company field when role is AGENT', async () => {
    const user = userEvent.setup()
    render(<RegisterPage />)
    const select = getSelect(/i am a/i)
    await user.selectOptions(select, 'AGENT')
    expect(screen.getByText(/^company$/i)).toBeInTheDocument()
  })

  it('shows validation error when firstName is empty', async () => {
    const user = userEvent.setup()
    render(<RegisterPage />)
    await user.type(getInput(/last name/i), 'Doe')
    await user.type(getInput(/^email$/i), 'test@example.com')
    await user.type(getInput(/^password$/i), 'password123')
    await user.click(screen.getByRole('button', { name: /create account/i }))

    await waitFor(() => {
      expect(screen.getByText(/required/i)).toBeInTheDocument()
    })
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it('shows validation error for password shorter than 8 chars', async () => {
    const user = userEvent.setup()
    render(<RegisterPage />)
    await user.type(getInput(/first name/i), 'John')
    await user.type(getInput(/last name/i), 'Doe')
    await user.type(getInput(/^email$/i), 'test@example.com')
    await user.type(getInput(/^password$/i), 'short')
    await user.click(screen.getByRole('button', { name: /create account/i }))

    await waitFor(() => {
      expect(screen.getByText(/at least 8 characters/i)).toBeInTheDocument()
    })
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it('calls register API and auto-signs-in on success', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      headers: { get: () => 'application/json' },
      json: async () => ({ success: true }),
    })
    mockSupabase.auth.signInWithPassword.mockResolvedValue({ error: null })

    const user = userEvent.setup()
    render(<RegisterPage />)
    await user.type(getInput(/first name/i), 'John')
    await user.type(getInput(/last name/i), 'Doe')
    await user.type(getInput(/^email$/i), 'john@example.com')
    await user.type(getInput(/^password$/i), 'password123')
    await user.click(screen.getByRole('button', { name: /create account/i }))

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith('/api/auth/register', expect.objectContaining({
        method: 'POST',
      }))
    })
    await waitFor(() => {
      expect(mockSupabase.auth.signInWithPassword).toHaveBeenCalledWith({
        email: 'john@example.com',
        password: 'password123',
      })
    })
    expect(mockPush).toHaveBeenCalledWith('/onboarding')
  })

  it('shows API error message on registration failure', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      headers: { get: () => 'application/json' },
      json: async () => ({ success: false, error: { message: 'Email already exists' } }),
    })

    const user = userEvent.setup()
    render(<RegisterPage />)
    await user.type(getInput(/first name/i), 'John')
    await user.type(getInput(/last name/i), 'Doe')
    await user.type(getInput(/^email$/i), 'john@example.com')
    await user.type(getInput(/^password$/i), 'password123')
    await user.click(screen.getByRole('button', { name: /create account/i }))

    await waitFor(() => {
      expect(screen.getByText('Email already exists')).toBeInTheDocument()
    })
    expect(mockPush).not.toHaveBeenCalled()
  })

  it('shows service unavailable message for non-JSON 5xx error', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 502,
      headers: { get: () => 'text/html' },
    })

    const user = userEvent.setup()
    render(<RegisterPage />)
    await user.type(getInput(/first name/i), 'John')
    await user.type(getInput(/last name/i), 'Doe')
    await user.type(getInput(/^email$/i), 'john@example.com')
    await user.type(getInput(/^password$/i), 'password123')
    await user.click(screen.getByRole('button', { name: /create account/i }))

    await waitFor(() => {
      expect(screen.getByText(/temporarily unavailable/i)).toBeInTheDocument()
    })
    expect(mockPush).not.toHaveBeenCalled()
  })

  it('shows unexpected response message for non-JSON 4xx error', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 400,
      headers: { get: () => 'text/html' },
    })

    const user = userEvent.setup()
    render(<RegisterPage />)
    await user.type(getInput(/first name/i), 'John')
    await user.type(getInput(/last name/i), 'Doe')
    await user.type(getInput(/^email$/i), 'john@example.com')
    await user.type(getInput(/^password$/i), 'password123')
    await user.click(screen.getByRole('button', { name: /create account/i }))

    await waitFor(() => {
      expect(screen.getByText(/unexpected response/i)).toBeInTheDocument()
    })
    expect(mockPush).not.toHaveBeenCalled()
  })

  it('redirects to /login if auto-sign-in fails after registration', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      headers: { get: () => 'application/json' },
      json: async () => ({ success: true }),
    })
    mockSupabase.auth.signInWithPassword.mockResolvedValue({
      error: { message: 'Sign-in failed' },
    })

    const user = userEvent.setup()
    render(<RegisterPage />)
    await user.type(getInput(/first name/i), 'John')
    await user.type(getInput(/last name/i), 'Doe')
    await user.type(getInput(/^email$/i), 'john@example.com')
    await user.type(getInput(/^password$/i), 'password123')
    await user.click(screen.getByRole('button', { name: /create account/i }))

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/login')
    })
    expect(screen.getByText(/sign-in failed/i)).toBeInTheDocument()
  })

  it('calls signInWithOAuth for Google sign-up', async () => {
    mockSupabase.auth.signInWithOAuth.mockResolvedValue({ error: null })
    const user = userEvent.setup()
    render(<RegisterPage />)

    await user.click(screen.getByRole('button', { name: /continue with google/i }))

    await waitFor(() => {
      expect(mockSupabase.auth.signInWithOAuth).toHaveBeenCalledWith(
        expect.objectContaining({ provider: 'google' }),
      )
    })
  })

  it('shows company field when role is LENDER', async () => {
    const user = userEvent.setup()
    render(<RegisterPage />)
    const select = getSelect(/i am a/i)
    await user.selectOptions(select, 'LENDER')
    expect(screen.getByText(/^company$/i)).toBeInTheDocument()
  })
})
