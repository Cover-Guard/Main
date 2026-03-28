import {
  isValidZip,
  isValidEmail,
  isValidState,
  isValidLatLng,
  normalizeAddress,
} from '../../utils/validators'

describe('isValidZip', () => {
  it('accepts 5-digit zip', () => {
    expect(isValidZip('90210')).toBe(true)
    expect(isValidZip('00000')).toBe(true)
  })

  it('accepts ZIP+4 format', () => {
    expect(isValidZip('90210-1234')).toBe(true)
  })

  it('rejects too-short zip', () => {
    expect(isValidZip('9021')).toBe(false)
  })

  it('rejects too-long zip without dash', () => {
    expect(isValidZip('902101')).toBe(false)
  })

  it('rejects non-numeric zip', () => {
    expect(isValidZip('abcde')).toBe(false)
  })

  it('rejects empty string', () => {
    expect(isValidZip('')).toBe(false)
  })

  it('rejects zip with spaces', () => {
    expect(isValidZip('902 10')).toBe(false)
  })
})

describe('isValidEmail', () => {
  it('accepts standard email', () => {
    expect(isValidEmail('user@example.com')).toBe(true)
  })

  it('accepts email with subdomain', () => {
    expect(isValidEmail('user@mail.example.com')).toBe(true)
  })

  it('accepts email with plus addressing', () => {
    expect(isValidEmail('user+tag@example.com')).toBe(true)
  })

  it('rejects email without @', () => {
    expect(isValidEmail('userexample.com')).toBe(false)
  })

  it('rejects email without domain', () => {
    expect(isValidEmail('user@')).toBe(false)
  })

  it('rejects email with spaces', () => {
    expect(isValidEmail('user @example.com')).toBe(false)
  })

  it('rejects empty string', () => {
    expect(isValidEmail('')).toBe(false)
  })
})

describe('isValidState', () => {
  it('accepts valid state code', () => {
    expect(isValidState('CA')).toBe(true)
    expect(isValidState('NY')).toBe(true)
    expect(isValidState('TX')).toBe(true)
  })

  it('accepts lowercase state code (case-insensitive)', () => {
    expect(isValidState('ca')).toBe(true)
    expect(isValidState('ny')).toBe(true)
  })

  it('accepts DC', () => {
    expect(isValidState('DC')).toBe(true)
  })

  it('rejects invalid state code', () => {
    expect(isValidState('ZZ')).toBe(false)
    expect(isValidState('XX')).toBe(false)
  })

  it('rejects full state name', () => {
    expect(isValidState('California')).toBe(false)
  })

  it('rejects empty string', () => {
    expect(isValidState('')).toBe(false)
  })
})

describe('isValidLatLng', () => {
  it('accepts valid coordinates', () => {
    expect(isValidLatLng(34.0522, -118.2437)).toBe(true) // LA
    expect(isValidLatLng(40.7128, -74.0060)).toBe(true) // NYC
  })

  it('accepts boundary values', () => {
    expect(isValidLatLng(90, 180)).toBe(true)
    expect(isValidLatLng(-90, -180)).toBe(true)
    expect(isValidLatLng(0, 0)).toBe(true)
  })

  it('rejects latitude out of range', () => {
    expect(isValidLatLng(91, 0)).toBe(false)
    expect(isValidLatLng(-91, 0)).toBe(false)
  })

  it('rejects longitude out of range', () => {
    expect(isValidLatLng(0, 181)).toBe(false)
    expect(isValidLatLng(0, -181)).toBe(false)
  })
})

describe('normalizeAddress', () => {
  it('trims whitespace', () => {
    expect(normalizeAddress('  123 Main St  ')).toBe('123 MAIN ST')
  })

  it('collapses multiple spaces', () => {
    expect(normalizeAddress('123   Main    St')).toBe('123 MAIN ST')
  })

  it('converts to uppercase', () => {
    expect(normalizeAddress('123 main st')).toBe('123 MAIN ST')
  })

  it('handles already normalized address', () => {
    expect(normalizeAddress('123 MAIN ST')).toBe('123 MAIN ST')
  })
})
