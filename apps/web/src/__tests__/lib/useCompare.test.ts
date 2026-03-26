/**
 * useCompare hook tests
 *
 * Uses renderHook from @testing-library/react with jsdom.
 * localStorage is available in jsdom but must be cleared between tests.
 */
import { renderHook, act } from '@testing-library/react'
import { useCompare } from '../../lib/useCompare'

const STORAGE_KEY = 'cg_compare_ids'

beforeEach(() => {
  localStorage.clear()
})

describe('useCompare', () => {
  it('initialises with empty ids when localStorage is empty', () => {
    const { result } = renderHook(() => useCompare())
    expect(result.current.ids).toEqual([])
  })

  it('hydrates from localStorage on mount', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(['prop-1', 'prop-2']))
    const { result } = renderHook(() => useCompare())
    expect(result.current.ids).toEqual(['prop-1', 'prop-2'])
  })

  it('toggle adds a new id', () => {
    const { result } = renderHook(() => useCompare())
    act(() => result.current.toggle('prop-a'))
    expect(result.current.ids).toContain('prop-a')
  })

  it('toggle removes an existing id', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(['prop-a']))
    const { result } = renderHook(() => useCompare())
    act(() => result.current.toggle('prop-a'))
    expect(result.current.ids).not.toContain('prop-a')
  })

  it('does not add more than 3 ids', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(['p1', 'p2', 'p3']))
    const { result } = renderHook(() => useCompare())
    act(() => result.current.toggle('p4'))
    expect(result.current.ids).toHaveLength(3)
    expect(result.current.ids).not.toContain('p4')
  })

  it('canAdd is false when 3 ids are selected', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(['p1', 'p2', 'p3']))
    const { result } = renderHook(() => useCompare())
    expect(result.current.canAdd).toBe(false)
  })

  it('canAdd is true when fewer than 3 ids are selected', () => {
    const { result } = renderHook(() => useCompare())
    expect(result.current.canAdd).toBe(true)
    act(() => result.current.toggle('p1'))
    expect(result.current.canAdd).toBe(true)
  })

  it('clear empties all ids', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(['p1', 'p2']))
    const { result } = renderHook(() => useCompare())
    act(() => result.current.clear())
    expect(result.current.ids).toEqual([])
  })

  it('compareUrl is null when fewer than 2 ids are selected', () => {
    const { result } = renderHook(() => useCompare())
    expect(result.current.compareUrl).toBeNull()
    act(() => result.current.toggle('p1'))
    expect(result.current.compareUrl).toBeNull()
  })

  it('compareUrl contains all ids when 2+ are selected', () => {
    const { result } = renderHook(() => useCompare())
    act(() => result.current.toggle('p1'))
    act(() => result.current.toggle('p2'))
    expect(result.current.compareUrl).toMatch(/\/dashboard\?tab=compare&ids=p1,p2/)
  })

  it('persists changes to localStorage after toggle', () => {
    const { result } = renderHook(() => useCompare())
    act(() => result.current.toggle('prop-z'))
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]')
    expect(stored).toContain('prop-z')
  })

  it('persists changes to localStorage after clear', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(['p1', 'p2']))
    const { result } = renderHook(() => useCompare())
    act(() => result.current.clear())
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '["not-empty"]')
    expect(stored).toEqual([])
  })
})
