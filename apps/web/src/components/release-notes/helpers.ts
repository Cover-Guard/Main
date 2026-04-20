/**
 * Release notes helpers — fetch merged PRs from GitHub and transform them
 * into user-friendly entries. Pure functions; safe to import from server or
 * client components.
 */

const GITHUB_API = 'https://api.github.com'

export type Category = 'added' | 'enhanced' | 'fixed' | 'other'

export interface PullRequest {
  id: number
  number: number
  title: string
  body: string
  url: string
  mergedAt: string
  author: string
  authorUrl?: string
  authorAvatar?: string
  labels: string[]
}

export interface ReleaseItem extends PullRequest {
  category: Category
  friendlyTitle: string
}

export interface ReleaseGroup {
  label: string
  items: ReleaseItem[]
  sortKey: string
}

export const CATEGORIES: Record<Category, { label: string; description: string }> = {
  added: { label: 'New', description: 'Fresh features and capabilities' },
  enhanced: { label: 'Improved', description: 'Refinements to existing flows' },
  fixed: { label: 'Fixed', description: 'Bugs squashed' },
  other: { label: 'Changed', description: 'Other updates' },
}

interface FetchOpts {
  owner: string
  repo: string
  baseBranch?: string
  token?: string
  pageSize?: number
  signal?: AbortSignal
}

export async function fetchMergedPRs({
  owner,
  repo,
  baseBranch = 'main',
  token,
  pageSize = 30,
  signal,
}: FetchOpts): Promise<PullRequest[]> {
  if (!owner || !repo) {
    throw new Error('fetchMergedPRs: "owner" and "repo" are required.')
  }

  const headers: Record<string, string> = {
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
  }
  if (token) headers.Authorization = `Bearer ${token}`

  const url =
    `${GITHUB_API}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/pulls` +
    `?state=closed&base=${encodeURIComponent(baseBranch)}` +
    `&sort=updated&direction=desc&per_page=${pageSize}`

  const res = await fetch(url, { headers, signal })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(
      `GitHub API ${res.status} ${res.statusText}` + (body ? ` — ${body.slice(0, 200)}` : '')
    )
  }

  interface RawPR {
    id: number
    number: number
    title?: string
    body?: string | null
    html_url: string
    merged_at: string | null
    user?: { login?: string; html_url?: string; avatar_url?: string } | null
    labels?: Array<{ name: string }>
  }

  const data = (await res.json()) as RawPR[]
  return data
    .filter((pr): pr is RawPR & { merged_at: string } => Boolean(pr.merged_at))
    .map((pr) => ({
      id: pr.id,
      number: pr.number,
      title: pr.title ?? '',
      body: pr.body ?? '',
      url: pr.html_url,
      mergedAt: pr.merged_at,
      author: pr.user?.login ?? 'unknown',
      authorUrl: pr.user?.html_url,
      authorAvatar: pr.user?.avatar_url,
      labels: (pr.labels ?? []).map((l) => l.name),
    }))
}

export function categorizePR(pr: Pick<PullRequest, 'title' | 'labels'>): Category {
  const labels = (pr.labels ?? []).map((l) => l.toLowerCase())
  const title = (pr.title ?? '').toLowerCase().trim()
  const hasLabel = (patterns: string[]) =>
    labels.some((l) => patterns.some((p) => l.includes(p)))

  if (hasLabel(['bug', 'fix', 'hotfix', 'defect'])) return 'fixed'
  if (hasLabel(['feature', 'feat', 'new'])) return 'added'
  if (hasLabel(['enhancement', 'improvement', 'perf', 'refactor', 'a11y'])) return 'enhanced'

  if (/^fix(\([^)]*\))?!?\s*:/.test(title)) return 'fixed'
  if (/^feat(\([^)]*\))?!?\s*:/.test(title)) return 'added'
  if (/^(perf|refactor|chore|improve|style|a11y)(\([^)]*\))?!?\s*:/.test(title)) return 'enhanced'

  return 'other'
}

export function formatFriendlyTitle(pr: Pick<PullRequest, 'title'>): string {
  let title = (pr.title ?? '').trim()
  title = title.replace(
    /^(feat|fix|chore|refactor|perf|docs|style|test|build|ci|revert|a11y)(\([^)]*\))?!?\s*:\s*/i,
    ''
  )
  title = title.replace(/^\[?[A-Z]{2,}-\d+\]?\s*[:-]?\s*/, '')
  title = title.replace(/\s*\(#\d+\)\s*$/, '')
  return title.charAt(0).toUpperCase() + title.slice(1)
}

export function groupPRs(
  prs: ReleaseItem[],
  groupBy: 'week' | 'day' = 'week'
): ReleaseGroup[] {
  const groups = new Map<string, ReleaseGroup>()
  for (const pr of prs) {
    const { key, label, sortKey } = buildGroupKey(pr.mergedAt, groupBy)
    const existing = groups.get(key)
    if (existing) existing.items.push(pr)
    else groups.set(key, { label, items: [pr], sortKey })
  }
  return Array.from(groups.values()).sort(
    (a, b) => new Date(b.sortKey).getTime() - new Date(a.sortKey).getTime()
  )
}

function buildGroupKey(dateStr: string, groupBy: 'week' | 'day') {
  const d = new Date(dateStr)
  if (Number.isNaN(d.getTime())) {
    return { key: 'unknown', label: 'Unknown date', sortKey: new Date(0).toISOString() }
  }
  if (groupBy === 'day') {
    const key = d.toISOString().slice(0, 10)
    const label = d.toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })
    return { key, label, sortKey: d.toISOString() }
  }
  const start = new Date(d)
  start.setHours(0, 0, 0, 0)
  start.setDate(start.getDate() - start.getDay())
  const key = start.toISOString().slice(0, 10)
  const label = `Week of ${start.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })}`
  return { key, label, sortKey: start.toISOString() }
}

const LAST_SEEN_KEY = 'releaseNotes.lastSeenAt'

export function getLastSeenAt(): string | null {
  if (typeof window === 'undefined') return null
  try {
    return window.localStorage.getItem(LAST_SEEN_KEY)
  } catch {
    return null
  }
}

export function markAllSeen(nowIso: string = new Date().toISOString()): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(LAST_SEEN_KEY, nowIso)
  } catch {
    /* storage disabled — no-op */
  }
}

export function countUnseen(prs: Pick<PullRequest, 'mergedAt'>[]): number {
  const lastSeen = getLastSeenAt()
  if (!lastSeen) return prs.length
  const cutoff = new Date(lastSeen).getTime()
  return prs.filter((pr) => new Date(pr.mergedAt).getTime() > cutoff).length
}
