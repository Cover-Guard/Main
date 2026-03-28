import { render, screen } from '@testing-library/react'

// --- mocks ---

const mockPush = jest.fn()

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
  useSearchParams: () => new URLSearchParams(),
}))

jest.mock('@vis.gl/react-google-maps', () => ({
  APIProvider: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  useMapsLibrary: () => null,
}))

jest.mock('lucide-react', () => ({
  Search: (props: Record<string, unknown>) => <svg data-testid="icon-search" {...props} />,
  MapPin: (props: Record<string, unknown>) => <svg data-testid="icon-map-pin" {...props} />,
  Loader2: (props: Record<string, unknown>) => <svg data-testid="icon-loader" {...props} />,
}))

// Import after mocks are set up
const { SearchBar } = require('@/components/search/SearchBar') as typeof import('@/components/search/SearchBar')

beforeEach(() => {
  jest.clearAllMocks()
})

describe('SearchBar', () => {
  it('renders search input', () => {
    render(<SearchBar />)
    const input = screen.getByPlaceholderText(/search by address/i)
    expect(input).toBeInTheDocument()
  })

  it('renders with defaultValue prop', () => {
    render(<SearchBar defaultValue="742 Evergreen Terrace" />)
    const input = screen.getByDisplayValue('742 Evergreen Terrace')
    expect(input).toBeInTheDocument()
  })

  it('renders with autoFocus prop', () => {
    render(<SearchBar autoFocus />)
    const input = screen.getByPlaceholderText(/search by address/i)
    expect(input).toHaveFocus()
  })

  it('renders with custom className', () => {
    const { container } = render(<SearchBar className="my-custom-class" />)
    const form = container.querySelector('form')
    expect(form?.className).toContain('my-custom-class')
  })
})
