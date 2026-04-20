'use client'

import { useEffect, useMemo, useState } from 'react'
import { FeatureTour } from './FeatureTour'
import {
  categorizePR,
  countUnseen,
  fetchMergedPRs,
  formatFriendlyTitle,
  getLastSeenAt,
  type ReleaseItem,
} from './helpers'

/**
 * NewFeaturesTourLauncher
 * -----------------------
 * Mounted once at the authenticated layout level (see SidebarLayout). On mount:
 *
 *   1. Fetch recent merged PRs for the configured repo.
 *   2. Keep only the 'added' / 'enhanced' items that landed AFTER the user's
 *      last-seen timestamp (or all of them on first visit).
 *   3. If any remain, pop the FeatureTour modal automatically.
 *
 * When the tour closes it marks everything seen so it won't re-open until
 * the next batch of PRs ships.
 */

interface Props {
  owner: string
  repo: string
  baseBranch?: string
  /** Cap the number of items surfaced at once. */
  maxItems?: number
}

export function NewFeaturesTourLauncher({
  owner,
  repo,
  baseBranch = 'main',
  maxItems = 10,
}: Props) {
  const [items, setItems] = useState<ReleaseItem[]>([])
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const controller = new AbortController()
    fetchMergedPRs({ owner, repo, baseBranch, pageSize: 30, signal: controller.signal })
      .then((prs) => {
        const lastSeen = getLastSeenAt()
        const cutoff = lastSeen ? new Date(lastSeen).getTime() : 0
        const unseen = prs.filter((p) => new Date(p.mergedAt).getTime() > cutoff)
        const tourable = unseen
          .map((p) => ({
            ...p,
            category: categorizePR(p),
            friendlyTitle: formatFriendlyTitle(p),
          }))
          .filter((p) => p.category === 'added' || p.category === 'enhanced')
          .slice(0, maxItems)

        if (tourable.length > 0) {
           
          setItems(tourable)
           
          setOpen(true)
        }
      })
      .catch(() => {
        /* fail silent — launcher is opportunistic; missing data should never
         * block app render. countUnseen() on the Settings panel still surfaces
         * unseen items independently. */
      })
    return () => controller.abort()
    // owner/repo/baseBranch are effectively static per session
  }, [owner, repo, baseBranch, maxItems])

  // Belt-and-suspenders: if countUnseen disagrees with items for some reason
  // (e.g. helpers changed), don't pop an empty modal.
  const shouldRender = useMemo(() => items.length > 0 && countUnseen(items) > 0, [items])

  if (!shouldRender) return null

  return <FeatureTour items={items} open={open} onClose={() => setOpen(false)} />
}
