/**
 * Parse fields out of a GitHub PR body (markdown).
 *
 * The fields we care about for the feature tour:
 *   - Hero image   — the first image in the body, if any (markdown or <img>).
 *   - Excerpt      — plain-text summary for the tour card (first ~280 chars).
 *   - CTA          — an optional "CTA:" or "Try it:" line pointing at a path.
 */

/** Match the first markdown image `![alt](url)` or `<img src="url">`. */
export function extractHeroImage(body: string | null | undefined): string | null {
  if (!body) return null
  const md = body.match(/!\[[^\]]*\]\(([^)\s]+)(?:\s+"[^"]*")?\)/)
  if (md?.[1]) return md[1].trim()
  const html = body.match(/<img[^>]+src=["']([^"']+)["']/i)
  if (html?.[1]) return html[1].trim()
  return null
}

/**
 * Reduce a markdown body to a short plain-text excerpt suitable for a tour
 * card. Strips markdown syntax, HTML tags, and comment blocks; clips to
 * `maxChars` characters at a word boundary.
 */
export function extractExcerpt(body: string | null | undefined, maxChars = 280): string {
  if (!body) return ''
  const text = body
    // strip <!-- release-notes --> blocks wholesale
    .replace(/<!--[\s\S]*?-->/g, '')
    // strip images
    .replace(/!\[[^\]]*\]\([^)]+\)/g, '')
    // keep link text, drop URL
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    // strip any remaining HTML tags
    .replace(/<[^>]+>/g, '')
    // inline code -> plain
    .replace(/`([^`]+)`/g, '$1')
    // drop header markers
    .replace(/^#{1,6}\s+/gm, '')
    // drop list markers
    .replace(/^\s*[-*+]\s+/gm, '')
    // drop bold/italic markers (greedy enough for simple cases)
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/__([^_]+)__/g, '$1')
    .replace(/_([^_]+)_/g, '$1')
    // collapse whitespace
    .replace(/\r\n/g, '\n')
    .replace(/\n{2,}/g, '\n\n')
    .trim()

  if (text.length <= maxChars) return text

  // Clip at last word boundary under the limit and suffix an ellipsis.
  const slice = text.slice(0, maxChars)
  const cut = slice.lastIndexOf(' ')
  return (cut > maxChars * 0.6 ? slice.slice(0, cut) : slice).trimEnd() + '…'
}

/**
 * Look for an optional "CTA: /some/path" or "Try it: /some/path" line.
 * Returns the path or null.
 */
export function extractCTA(body: string | null | undefined): string | null {
  if (!body) return null
  const m = body.match(/^(?:CTA|Try it|Try it now):\s*(\/\S+)/im)
  return m?.[1] ?? null
}
