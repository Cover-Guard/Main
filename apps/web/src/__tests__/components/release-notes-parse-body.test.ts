import {
  extractCTA,
  extractExcerpt,
  extractHeroImage,
} from '@/components/release-notes/parsePRBody'

describe('extractHeroImage', () => {
  it('returns the first markdown image URL', () => {
    expect(
      extractHeroImage('## Update\n\n![screenshot](https://cdn.example.com/a.png)\n\nBody.')
    ).toBe('https://cdn.example.com/a.png')
  })

  it('returns the first <img src> URL when no markdown image is present', () => {
    expect(
      extractHeroImage('<p>before</p><img src="https://cdn.example.com/b.jpg" />after')
    ).toBe('https://cdn.example.com/b.jpg')
  })

  it('handles markdown image with a title attribute', () => {
    expect(
      extractHeroImage('![alt](https://cdn.example.com/c.gif "a title")')
    ).toBe('https://cdn.example.com/c.gif')
  })

  it('returns null when no image is present', () => {
    expect(extractHeroImage('plain text body')).toBeNull()
    expect(extractHeroImage('')).toBeNull()
    expect(extractHeroImage(null)).toBeNull()
    expect(extractHeroImage(undefined)).toBeNull()
  })
})

describe('extractExcerpt', () => {
  it('strips markdown images, links, headers, bold, italic, and code', () => {
    const body =
      '## Heading\n\n' +
      '![cover](https://x.com/img.png)\n\n' +
      'Check out **this** _cool_ feature — see [the docs](https://example.com) for details. ' +
      'Run `npm install` first.'
    const excerpt = extractExcerpt(body)
    expect(excerpt).toContain('Heading')
    expect(excerpt).toContain('Check out this cool feature')
    expect(excerpt).toContain('see the docs for details')
    expect(excerpt).toContain('Run npm install first')
    expect(excerpt).not.toContain('!')
    expect(excerpt).not.toContain('[')
    expect(excerpt).not.toContain('`')
    expect(excerpt).not.toContain('**')
  })

  it('clips long bodies at the last word boundary with an ellipsis', () => {
    const body = ('Lorem ipsum dolor sit amet consectetur adipiscing elit '.repeat(20)).trim()
    const excerpt = extractExcerpt(body, 120)
    expect(excerpt.length).toBeLessThanOrEqual(121) // +1 for the ellipsis
    expect(excerpt.endsWith('…')).toBe(true)
    expect(excerpt).not.toMatch(/\s…$/)
  })

  it('returns empty string for null/undefined/empty input', () => {
    expect(extractExcerpt(null)).toBe('')
    expect(extractExcerpt(undefined)).toBe('')
    expect(extractExcerpt('')).toBe('')
  })

  it('removes <!-- HTML comment blocks --> entirely', () => {
    const body = 'Before <!-- hidden note\nwith multiple lines --> After.'
    expect(extractExcerpt(body)).toBe('Before  After.')
  })
})

describe('extractCTA', () => {
  it('finds a "CTA: /path" line', () => {
    expect(extractCTA('Some description.\n\nCTA: /dashboard/new')).toBe('/dashboard/new')
  })

  it('finds a "Try it: /path" line (case-insensitive)', () => {
    expect(extractCTA('TRY IT: /search')).toBe('/search')
    expect(extractCTA('Try it now: /properties')).toBe('/properties')
  })

  it('only matches absolute paths (not external URLs)', () => {
    expect(extractCTA('CTA: https://example.com/x')).toBeNull()
  })

  it('returns null when no CTA line exists', () => {
    expect(extractCTA('Just a description.')).toBeNull()
    expect(extractCTA(null)).toBeNull()
  })
})
