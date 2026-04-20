'use client'

import { useEffect, useMemo, useState } from 'react'
import { Sparkles, Wrench, CheckCircle2, AlertCircle, ExternalLink } from 'lucide-react'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { cn } from '@/lib/utils'
import { FeatureTour } from './FeatureTour'
import {
  fetchMergedPRs,
  categorizePR,
  formatFriendlyTitle,
  groupPRs,
  markAllSeen,
  countUnseen,
  CATEGORIES,
  type Category,
  type PullRequest,
  type ReleaseItem,
} from './helpers'

type Variant = 'page' | 'panel'

interface Props {
  owner: string
  repo: string
  baseBranch?: string
  token?: string
  pageSize?: number
  groupBy?: 'week' | 'day'
  variant?: Variant
  onStartWalkthrough?: () => void
  initialFilter?: Category | 'all'
}

const CATEGORY_ICON: Record<Category, React.ComponentType<{ className?: string }>> = {
  added: Sparkles,
  enhanced: Wrench,
  fixed: CheckCircle2,
  other: AlertCircle,
}

const CATEGORY_CHIP: Record<Category, string> = {
  added: 'bg-blue-100 text-blue-800 hover:bg-blue-100',
  enhanced: 'bg-purple-100 text-purple-800 hover:bg-purple-100',
  fixed: 'bg-emerald-100 text-emerald-800 hover:bg-emerald-100',
  other: 'bg-gray-100 text-gray-700 hover:bg-gray-100',
}

export function ReleaseNotes({
  owner,
  repo,
  baseBranch = 'main',
  token,
  pageSize = 30,
  groupBy = 'week',
  variant = 'page',
  onStartWalkthrough,
  initialFilter = 'all',
}: Props) {
  const [prs, setPrs] = useState<PullRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<Category | 'all'>(initialFilter)
  const [tourOpen, setTourOpen] = useState(false)

  useEffect(() => {
    const controller = new AbortController()
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true)
     
    setError(null)
    fetchMergedPRs({ owner, repo, baseBranch, token, pageSize, signal: controller.signal })
      .then((data) => setPrs(data))
      .catch((err: unknown) => {
        if (err instanceof Error && err.name !== 'AbortError') setError(err.message)
      })
      .finally(() => setLoading(false))
    return () => controller.abort()
  }, [owner, repo, baseBranch, token, pageSize])

  useEffect(() => {
    if (variant === 'page' && prs.length > 0) markAllSeen()
  }, [variant, prs.length])

  const enriched: ReleaseItem[] = useMemo(
    () =>
      prs.map((pr) => ({
        ...pr,
        category: categorizePR(pr),
        friendlyTitle: formatFriendlyTitle(pr),
      })),
    [prs]
  )

  const grouped = useMemo(() => groupPRs(enriched, groupBy), [enriched, groupBy])

  const filtered = useMemo(() => {
    if (filter === 'all') return grouped
    return grouped
      .map((g) => ({ ...g, items: g.items.filter((p) => p.category === filter) }))
      .filter((g) => g.items.length > 0)
  }, [grouped, filter])

  const totals = useMemo(() => {
    const counts: Record<Category | 'all', number> = {
      all: enriched.length,
      added: 0,
      enhanced: 0,
      fixed: 0,
      other: 0,
    }
    enriched.forEach((p) => {
      counts[p.category] += 1
    })
    return counts
  }, [enriched])

  const unseen = useMemo(() => countUnseen(prs), [prs])

  const tourItems = useMemo(
    () => enriched.filter((p) => p.category === 'added' || p.category === 'enhanced'),
    [enriched]
  )

  const header = (
    <div className="flex items-start justify-between gap-4">
      <div>
        <h2 className="text-lg font-semibold text-gray-900">What&apos;s new</h2>
        <p className="mt-0.5 text-sm text-gray-500">
          Updates, improvements, and fixes
          {variant === 'panel' ? '.' : ' shipped to production.'}
        </p>
      </div>
      {variant === 'page' && (
        <Button
          type="button"
          size="sm"
          onClick={() => (onStartWalkthrough ? onStartWalkthrough() : setTourOpen(true))}
          data-tour="start-walkthrough"
        >
          See what&apos;s new
        </Button>
      )}
      {variant === 'panel' && unseen > 0 && (
        <Badge className="bg-blue-600 text-white hover:bg-blue-600">{unseen} new</Badge>
      )}
    </div>
  )

  const body = (
    <>
      {variant === 'page' && (
        <Tabs value={filter} onValueChange={(v) => setFilter(v as Category | 'all')} className="mt-4">
          <TabsList>
            <TabsTrigger value="all">All ({totals.all})</TabsTrigger>
            <TabsTrigger value="added">New ({totals.added})</TabsTrigger>
            <TabsTrigger value="enhanced">Improved ({totals.enhanced})</TabsTrigger>
            <TabsTrigger value="fixed">Fixed ({totals.fixed})</TabsTrigger>
          </TabsList>
          <TabsContent value={filter} className="mt-4" />
        </Tabs>
      )}

      {loading && <SkeletonList rows={variant === 'panel' ? 3 : 8} />}

      {error && (
        <div
          role="alert"
          className="mt-3 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900"
        >
          <p className="font-semibold">Couldn&apos;t load release notes.</p>
          <p className="mt-1 text-red-700">{error}</p>
        </div>
      )}

      {!loading && !error && filtered.length === 0 && (
        <p className="mt-6 text-sm text-gray-500">No updates to show yet.</p>
      )}

      {!loading && !error && (
        <div className="mt-4 space-y-6">
          {filtered.map((group) => (
            <section key={group.sortKey}>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-500">
                {group.label}
              </h3>
              <ul className="space-y-2">
                {group.items.slice(0, variant === 'panel' ? 5 : undefined).map((pr) => (
                  <ReleaseListItem key={pr.id} pr={pr} />
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}

      {variant === 'panel' && !loading && !error && prs.length > 0 && (
        <a
          href="/help#release-notes"
          className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-blue-600 hover:text-blue-700"
        >
          See all updates <ExternalLink className="h-3.5 w-3.5" />
        </a>
      )}
    </>
  )

  if (variant === 'panel') {
    return (
      <Card data-tour="release-notes" aria-label="Release notes">
        <CardHeader className="pb-3">{header}</CardHeader>
        <CardContent className="pt-0">{body}</CardContent>
      </Card>
    )
  }

  return (
    <section
      data-tour="release-notes"
      aria-label="Release notes"
      className="mx-auto max-w-3xl"
    >
      <Card>
        <CardHeader>
          <CardTitle className="sr-only">Release notes</CardTitle>
          <CardDescription className="sr-only">
            Updates, improvements, and fixes shipped to production.
          </CardDescription>
          {header}
        </CardHeader>
        <CardContent>{body}</CardContent>
      </Card>
      <FeatureTour
        items={tourItems}
        open={tourOpen}
        onClose={() => setTourOpen(false)}
      />
    </section>
  )
}

function ReleaseListItem({ pr }: { pr: ReleaseItem }) {
  const meta = CATEGORIES[pr.category]
  const Icon = CATEGORY_ICON[pr.category]
  const mergedOn = new Date(pr.mergedAt).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  })
  return (
    <li className="flex items-start gap-3 rounded-md border border-gray-200 bg-white p-3">
      <Badge
        variant="secondary"
        className={cn('shrink-0 gap-1 font-medium', CATEGORY_CHIP[pr.category])}
      >
        <Icon className="h-3 w-3" aria-hidden="true" />
        <span className="sr-only">Category: </span>
        {meta.label}
      </Badge>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-gray-900">{pr.friendlyTitle}</p>
        <p className="mt-0.5 text-xs text-gray-500">
          <span>{mergedOn}</span>
          <span aria-hidden="true"> · </span>
          <a
            href={pr.url}
            target="_blank"
            rel="noopener noreferrer"
            className="underline underline-offset-2 hover:text-gray-700"
          >
            Details #{pr.number}
          </a>
        </p>
      </div>
    </li>
  )
}

function SkeletonList({ rows }: { rows: number }) {
  return (
    <ul className="mt-4 space-y-2" aria-hidden="true">
      {Array.from({ length: rows }).map((_, i) => (
        <li
          key={i}
          className="flex animate-pulse items-start gap-3 rounded-md border border-gray-200 bg-white p-3"
        >
          <span className="h-5 w-16 shrink-0 rounded-full bg-gray-200" />
          <div className="flex-1 space-y-2">
            <span className="block h-3 w-2/3 rounded bg-gray-200" />
            <span className="block h-2.5 w-1/3 rounded bg-gray-100" />
          </div>
        </li>
      ))}
    </ul>
  )
}
