import {
  categorizePR,
  formatFriendlyTitle,
  groupPRs,
  type ReleaseItem,
} from '@/components/release-notes/helpers'

describe('categorizePR', () => {
  it('prioritizes labels over title prefixes', () => {
    expect(categorizePR({ labels: ['bug'], title: 'feat: something' })).toBe('fixed')
  })

  it('maps common label names to categories', () => {
    expect(categorizePR({ labels: ['bug'], title: 'x' })).toBe('fixed')
    expect(categorizePR({ labels: ['enhancement'], title: 'x' })).toBe('enhanced')
    expect(categorizePR({ labels: ['feature'], title: 'x' })).toBe('added')
    expect(categorizePR({ labels: ['perf'], title: 'x' })).toBe('enhanced')
  })

  it('falls back to Conventional Commit prefixes in titles', () => {
    expect(categorizePR({ labels: [], title: 'feat: add thing' })).toBe('added')
    expect(categorizePR({ labels: [], title: 'fix(auth): oops' })).toBe('fixed')
    expect(categorizePR({ labels: [], title: 'perf: faster load' })).toBe('enhanced')
  })

  it('handles the breaking-change "!" marker', () => {
    expect(categorizePR({ labels: [], title: 'fix!: critical' })).toBe('fixed')
    expect(categorizePR({ labels: [], title: 'feat(core)!: revamp' })).toBe('added')
  })

  it('returns "other" when nothing matches', () => {
    expect(categorizePR({ labels: [], title: 'random change' })).toBe('other')
  })
})

describe('formatFriendlyTitle', () => {
  it('strips Conventional Commit prefixes', () => {
    expect(formatFriendlyTitle({ title: 'feat(auth): add SSO' })).toBe('Add SSO')
    expect(formatFriendlyTitle({ title: 'fix!: critical bug' })).toBe('Critical bug')
  })

  it('strips leading ticket IDs', () => {
    expect(formatFriendlyTitle({ title: '[PLAT-123] Improve modal' })).toBe('Improve modal')
    expect(formatFriendlyTitle({ title: 'ABC-456: rename field' })).toBe('Rename field')
  })

  it('strips trailing PR number suffix', () => {
    expect(formatFriendlyTitle({ title: 'fix: minor tweak (#1234)' })).toBe('Minor tweak')
  })

  it('handles all three combined', () => {
    expect(
      formatFriendlyTitle({ title: 'fix(auth): [PLAT-882] handle expired SSO tokens (#4501)' })
    ).toBe('Handle expired SSO tokens')
  })

  it('leaves clean titles alone', () => {
    expect(formatFriendlyTitle({ title: 'Update docs' })).toBe('Update docs')
  })
})

describe('groupPRs', () => {
  const makeItem = (id: number, mergedAt: string): ReleaseItem => ({
    id,
    number: id,
    title: `PR ${id}`,
    body: '',
    url: `https://github.com/o/r/pull/${id}`,
    mergedAt,
    author: 'tester',
    labels: [],
    category: 'other',
    friendlyTitle: `PR ${id}`,
  })

  it('groups by week and sorts newest-first', () => {
    const items = [
      makeItem(1, '2026-04-15T10:00:00Z'),
      makeItem(2, '2026-04-16T10:00:00Z'),
      makeItem(3, '2026-04-06T10:00:00Z'),
    ]
    const groups = groupPRs(items, 'week')
    expect(groups).toHaveLength(2)
    expect(new Date(groups[0].sortKey).getTime()).toBeGreaterThan(
      new Date(groups[1].sortKey).getTime()
    )
    expect(groups[0].items).toHaveLength(2)
    expect(groups[1].items).toHaveLength(1)
  })

  it('groups by day into one bucket per date', () => {
    const items = [
      makeItem(1, '2026-04-15T10:00:00Z'),
      makeItem(2, '2026-04-16T10:00:00Z'),
      makeItem(3, '2026-04-06T10:00:00Z'),
    ]
    expect(groupPRs(items, 'day')).toHaveLength(3)
  })
})
