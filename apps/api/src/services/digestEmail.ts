/**
 * Digest email renderer (PR 10).
 *
 * Renders a `BuiltDigest` to plain text + HTML. Both are returned so the
 * Resend client can include both â clients that strip HTML (Apple Watch,
 * accessibility tools) get a usable text alternative.
 *
 * Style choices:
 *   â¢ Single-column layout, no images, no tracking pixels â feels like an
 *     internal email rather than marketing.
 *   â¢ Inline CSS only. Most email clients ignore <style> blocks.
 *   â¢ Title: "Your CoverGuard digest â N items" with a count summary.
 *   â¢ Each section has a heading + bullet list of items, each linking to
 *     the in-app deep-link if present.
 *   â¢ Footer reminds users where to change preferences.
 */

import type { BuiltDigest, DigestNotification } from './digestBuilder'

export interface DigestEmail {
  subject: string
  text: string
  html: string
}

/** Escape a string for safe HTML interpolation. */
function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function formatSubject(digest: BuiltDigest): string {
  const { totalItems, urgentCount } = digest
  if (urgentCount > 0) {
    return `Your CoverGuard digest â ${urgentCount} urgent, ${totalItems} total`
  }
  if (totalItems === 1) {
    return `Your CoverGuard digest â 1 item`
  }
  return `Your CoverGuard digest â ${totalItems} items`
}

function itemLine(item: DigestNotification, baseUrl: string): string {
  const target = item.linkUrl ?? `${baseUrl}/dashboard?notification=${item.id}`
  const tail = item.body ? ` â ${item.body}` : ''
  return `${item.title}${tail}\n  ${target}`
}

function itemHtml(item: DigestNotification, baseUrl: string): string {
  const target = item.linkUrl ?? `${baseUrl}/dashboard?notification=${item.id}`
  const sevBadge =
    item.severity === 'urgent' || item.severity === 'blocking'
      ? `<span style="display:inline-block;padding:1px 6px;margin-right:6px;font-size:11px;font-weight:600;color:#fff;background:#c1272d;border-radius:3px;">URGENT</span>`
      : item.severity === 'actionable'
        ? `<span style="display:inline-block;padding:1px 6px;margin-right:6px;font-size:11px;font-weight:600;color:#fff;background:#0d62a0;border-radius:3px;">ACTION</span>`
        : ''
  const body = item.body ? `<div style="color:#475569;font-size:13px;margin-top:2px;">${escapeHtml(item.body)}</div>` : ''
  return `
    <li style="margin:0 0 14px 0;list-style:none;padding:0;">
      <a href="${escapeHtml(target)}" style="color:#0d1929;text-decoration:none;">
        <div style="font-weight:600;font-size:14px;">${sevBadge}${escapeHtml(item.title)}</div>
        ${body}
      </a>
    </li>`
}

export function renderDigestEmail(
  digest: BuiltDigest,
  opts: { greetingName?: string; baseUrl: string; preferencesUrl: string },
): DigestEmail {
  const greeting = opts.greetingName
    ? `Hi ${opts.greetingName},`
    : `Hi there,`

  // ââ plain text
  const textHeader = `${greeting}\n\nHere's a summary of recent activity on CoverGuard.\n`
  const textSections = digest.sections.map((s) => {
    const lines = s.items.map((i) => itemLine(i, opts.baseUrl)).join('\n\n')
    const more = s.truncated > 0 ? `\n  â¦and ${s.truncated} more` : ''
    return `${s.label.toUpperCase()}\n${lines}${more}`
  })
  const textFooter = `\nâ\nManage your digest preferences: ${opts.preferencesUrl}\n`
  const text = `${textHeader}\n${textSections.join('\n\n')}${textFooter}`

  // ââ HTML
  const htmlSections = digest.sections.map((s) => {
    const items = s.items.map((i) => itemHtml(i, opts.baseUrl)).join('')
    const more =
      s.truncated > 0
        ? `<li style="list-style:none;padding:0;color:#64748b;font-size:13px;">â¦and ${s.truncated} more</li>`
        : ''
    return `
      <h3 style="margin:24px 0 10px;font-size:14px;color:#475569;text-transform:uppercase;letter-spacing:0.5px;">${escapeHtml(s.label)}</h3>
      <ul style="margin:0;padding:0;">${items}${more}</ul>`
  })

  const subject = formatSubject(digest)
  const html = `<!doctype html>
<html><body style="font-family:Helvetica,Arial,sans-serif;color:#0d1929;margin:0;padding:24px;background:#f8fafc;">
  <div style="max-width:560px;margin:0 auto;background:#fff;padding:24px;border-radius:8px;border:1px solid #e2e8f0;">
    <h1 style="margin:0 0 8px 0;font-size:18px;">CoverGuard digest</h1>
    <p style="margin:0 0 8px 0;color:#475569;font-size:14px;">${escapeHtml(greeting)}</p>
    <p style="margin:0 0 16px 0;color:#475569;font-size:13px;">${digest.totalItems} item${digest.totalItems === 1 ? '' : 's'} since your last digest${digest.urgentCount > 0 ? ` &middot; <strong style="color:#c1272d;">${digest.urgentCount} urgent</strong>` : ''}.</p>
    ${htmlSections.join('')}
    <hr style="margin:24px 0 12px;border:none;border-top:1px solid #e2e8f0;" />
    <p style="font-size:12px;color:#64748b;margin:0;">
      <a href="${escapeHtml(opts.preferencesUrl)}" style="color:#64748b;">Manage digest preferences</a>
    </p>
  </div>
</body></html>`

  return { subject, text, html }
}
