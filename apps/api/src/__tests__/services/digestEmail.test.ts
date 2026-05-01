import { renderDigestEmail } from '../../services/digestEmail'
import type { BuiltDigest } from '../../services/digestBuilder'

const baseDigest: BuiltDigest = {
  totalItems: 3,
  urgentCount: 1,
  actionableCount: 2,
  sections: [
    {
      category: 'transactional',
      label: 'Action items',
      items: [
        {
          id: 'a',
          title: 'Sign the renewal',
          body: 'Acme Corp renewal expires in 7 days',
          linkUrl: 'https://app.example/renewals/acme',
          category: 'transactional',
          severity: 'urgent',
          createdAt: '2026-04-30T08:00:00Z',
        },
      ],
      truncated: 0,
    },
    {
      category: 'insight',
      label: 'Insights',
      items: [
        {
          id: 'b',
          title: 'New estimate ready',
          body: null,
          linkUrl: null,
          category: 'insight',
          severity: 'info',
          createdAt: '2026-04-30T09:00:00Z',
        },
      ],
      truncated: 2,
    },
  ],
}

describe('renderDigestEmail', () => {
  const opts = {
    baseUrl: 'https://app.example',
    preferencesUrl: 'https://app.example/dashboard/settings/notifications',
    greetingName: 'John',
  }

  it('generates a subject line with the urgent count when present', () => {
    const out = renderDigestEmail(baseDigest, opts)
    expect(out.subject).toContain('1 urgent')
    expect(out.subject).toContain('3 total')
  })

  it('drops the urgent suffix when no urgent items exist', () => {
    const noUrgent: BuiltDigest = { ...baseDigest, urgentCount: 0 }
    const out = renderDigestEmail(noUrgent, opts)
    expect(out.subject).not.toContain('urgent')
  })

  it('includes greeting, item titles, and section labels in plain text', () => {
    const out = renderDigestEmail(baseDigest, opts)
    expect(out.text).toContain('Hi John,')
    expect(out.text).toContain('Sign the renewal')
    expect(out.text).toContain('ACTION ITEMS')
    expect(out.text).toContain('INSIGHTS')
    expect(out.text).toContain('â¦and 2 more')
  })

  it('escapes HTML metacharacters in user-supplied strings', () => {
    const evil: BuiltDigest = {
      ...baseDigest,
      sections: [
        {
          category: 'system',
          label: 'System',
          items: [
            {
              id: 'x',
              title: '<script>alert(1)</script>',
              body: null,
              linkUrl: null,
              category: 'system',
              severity: 'info',
              createdAt: '2026-04-30T10:00:00Z',
            },
          ],
          truncated: 0,
        },
      ],
    }
    const out = renderDigestEmail(evil, opts)
    expect(out.html).not.toContain('<script>alert(1)</script>')
    expect(out.html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;')
  })

  it('falls back to a deep link when no linkUrl is provided', () => {
    const out = renderDigestEmail(baseDigest, opts)
    expect(out.text).toContain('https://app.example/dashboard?notification=b')
  })

  it('uses generic greeting when no name supplied', () => {
    const { text } = renderDigestEmail(baseDigest, { ...opts, greetingName: undefined })
    expect(text).toContain('Hi there,')
  })
})
