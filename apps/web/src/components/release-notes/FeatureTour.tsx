'use client'

import { useCallback, useEffect, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import {
  ChevronLeft,
  ChevronRight,
  List,
  Play,
  Sparkles,
  Wrench,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  X,
} from 'lucide-react'
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { cn } from '@/lib/utils'
import {
  type Category,
  type ReleaseItem,
  CATEGORIES,
  markAllSeen,
} from './helpers'
import { extractCTA, extractExcerpt, extractHeroImage } from './parsePRBody'

/**
 * FeatureTour
 * -----------
 * Full-screen modal carousel that walks a user through recent release-notes
 * items. Two modes inside the same Dialog:
 *
 *   - carousel — one feature card at a time with hero image, description, and
 *                navigation controls. This is the default.
 *   - list     — scrollable summary of every feature in the tour; clicking
 *                one jumps back to carousel focused on it.
 *
 * Contract:
 *   items       The list of features to surface (typically ReleaseNotes
 *               enriched items that are either 'added' or 'enhanced').
 *   open        Parent-controlled open state.
 *   onClose     Fired when the user exits (X button or Escape).
 *   initialIndex  Which card to start on. Defaults to 0.
 *
 * The component marks all items as "seen" when it closes successfully.
 */

type Mode = 'carousel' | 'list'

interface Props {
  items: ReleaseItem[]
  open: boolean
  onClose: () => void
  initialIndex?: number
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

export function FeatureTour({ items, open, onClose, initialIndex = 0 }: Props) {
  const [mode, setMode] = useState<Mode>('carousel')
  const [index, setIndex] = useState(initialIndex)

  // Reset internal state when the dialog is (re-)opened.
  useEffect(() => {
    if (open) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setMode('carousel')
       
      setIndex(Math.min(Math.max(initialIndex, 0), Math.max(items.length - 1, 0)))
    }
  }, [open, initialIndex, items.length])

  const total = items.length
  const safeIndex = Math.min(index, Math.max(total - 1, 0))
  const current = items[safeIndex]

  const handleClose = useCallback(() => {
    markAllSeen()
    onClose()
  }, [onClose])

  const next = useCallback(() => {
    setIndex((i) => Math.min(i + 1, total - 1))
  }, [total])

  const prev = useCallback(() => {
    setIndex((i) => Math.max(i - 1, 0))
  }, [])

  // Keyboard navigation in carousel mode.
  useEffect(() => {
    if (!open || mode !== 'carousel') return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') next()
      else if (e.key === 'ArrowLeft') prev()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, mode, next, prev])

  if (!open || total === 0) return null

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) handleClose()
      }}
    >
      <DialogContent
        className="max-w-3xl gap-0 overflow-hidden p-0"
        data-tour="feature-tour"
        aria-label="What's new walkthrough"
      >
        {mode === 'carousel' ? (
          <CarouselView
            item={current}
            index={safeIndex}
            total={total}
            items={items}
            onPrev={prev}
            onNext={next}
            onJump={setIndex}
            onShowList={() => setMode('list')}
            onClose={handleClose}
          />
        ) : (
          <ListView
            items={items}
            onPick={(i) => {
              setIndex(i)
              setMode('carousel')
            }}
            onBack={() => setMode('carousel')}
            onClose={handleClose}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}

// ---------------------------------------------------------------------------
// Carousel view
// ---------------------------------------------------------------------------

interface CarouselProps {
  item: ReleaseItem
  index: number
  total: number
  items: ReleaseItem[]
  onPrev: () => void
  onNext: () => void
  onJump: (i: number) => void
  onShowList: () => void
  onClose: () => void
}

function CarouselView({
  item,
  index,
  total,
  items,
  onPrev,
  onNext,
  onJump,
  onShowList,
  onClose,
}: CarouselProps) {
  const meta = CATEGORIES[item.category]
  const Icon = CATEGORY_ICON[item.category]
  const heroImage = extractHeroImage(item.body)
  const excerpt = extractExcerpt(item.body, 320) || 'No additional details provided.'
  const cta = extractCTA(item.body)
  const isFirst = index === 0
  const isLast = index === total - 1

  return (
    <div className="flex flex-col">
      {/* Close (X) */}
      <button
        type="button"
        onClick={onClose}
        aria-label="Close walkthrough"
        className="absolute right-3 top-3 z-10 rounded-full bg-white/90 p-1.5 text-gray-500 shadow-sm transition hover:bg-white hover:text-gray-800"
      >
        <X className="h-4 w-4" />
      </button>

      {/* Hero */}
      <div
        className={cn(
          'relative h-56 w-full bg-gradient-to-br sm:h-72',
          item.category === 'added' && 'from-blue-100 via-blue-50 to-white',
          item.category === 'enhanced' && 'from-purple-100 via-purple-50 to-white',
          item.category === 'fixed' && 'from-emerald-100 via-emerald-50 to-white',
          item.category === 'other' && 'from-gray-100 via-gray-50 to-white'
        )}
      >
        {heroImage ? (
          <Image
            src={heroImage}
            alt={item.friendlyTitle}
            fill
            sizes="(max-width: 768px) 100vw, 768px"
            className="object-cover"
            unoptimized
          />
        ) : (
          <div className="flex h-full items-center justify-center">
            <Icon className="h-20 w-20 text-gray-400" aria-hidden="true" />
          </div>
        )}
      </div>

      {/* Body */}
      <div className="px-6 pb-6 pt-5">
        <div className="mb-3 flex items-center gap-2">
          <Badge
            variant="secondary"
            className={cn('gap-1 font-medium', CATEGORY_CHIP[item.category])}
          >
            <Icon className="h-3 w-3" aria-hidden="true" />
            {meta.label}
          </Badge>
          <span className="text-xs text-gray-500">
            {new Date(item.mergedAt).toLocaleDateString(undefined, {
              month: 'short',
              day: 'numeric',
              year: 'numeric',
            })}
          </span>
        </div>

        <DialogTitle className="text-xl font-semibold text-gray-900">
          {item.friendlyTitle}
        </DialogTitle>

        <DialogDescription className="mt-2 whitespace-pre-line text-sm leading-relaxed text-gray-600">
          {excerpt}
        </DialogDescription>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          {cta && (
            <Button asChild size="sm">
              <Link href={cta}>Try it now</Link>
            </Button>
          )}
          <a
            href={item.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-sm text-gray-500 underline underline-offset-2 hover:text-gray-700"
          >
            View PR #{item.number} <ExternalLink className="h-3.5 w-3.5" />
          </a>
        </div>
      </div>

      {/* Footer: nav */}
      <div className="flex items-center justify-between border-t border-gray-200 bg-gray-50 px-4 py-3">
        <Button variant="ghost" size="sm" onClick={onShowList}>
          <List className="mr-1 h-4 w-4" />
          View all ({total})
        </Button>

        {/* Dots */}
        <div className="flex items-center gap-1.5" role="tablist" aria-label="Walkthrough steps">
          {items.map((p, i) => (
            <button
              key={p.id}
              type="button"
              role="tab"
              aria-selected={i === index}
              aria-label={`Go to step ${i + 1}: ${p.friendlyTitle}`}
              onClick={() => onJump(i)}
              className={cn(
                'h-2 w-2 rounded-full transition',
                i === index ? 'w-5 bg-blue-600' : 'bg-gray-300 hover:bg-gray-400'
              )}
            />
          ))}
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={onPrev}
            disabled={isFirst}
            aria-label="Previous"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            size="sm"
            onClick={isLast ? onClose : onNext}
            aria-label={isLast ? 'Finish walkthrough' : 'Next'}
          >
            {isLast ? 'Done' : (
              <>
                Next <ChevronRight className="ml-1 h-4 w-4" />
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// List view
// ---------------------------------------------------------------------------

interface ListProps {
  items: ReleaseItem[]
  onPick: (i: number) => void
  onBack: () => void
  onClose: () => void
}

function ListView({ items, onPick, onBack, onClose }: ListProps) {
  return (
    <div className="flex max-h-[80vh] flex-col">
      <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
        <DialogTitle className="text-lg font-semibold text-gray-900">
          What&apos;s new
        </DialogTitle>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close walkthrough"
          className="rounded-full p-1.5 text-gray-500 transition hover:bg-gray-100 hover:text-gray-800"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <DialogDescription className="sr-only">
        List of all recent updates. Click any item to open it in the carousel.
      </DialogDescription>

      <ScrollArea className="flex-1">
        <ul className="divide-y divide-gray-100">
          {items.map((pr, i) => {
            const meta = CATEGORIES[pr.category]
            const Icon = CATEGORY_ICON[pr.category]
            const thumb = extractHeroImage(pr.body)
            const excerpt = extractExcerpt(pr.body, 160)
            return (
              <li key={pr.id}>
                <button
                  type="button"
                  onClick={() => onPick(i)}
                  className="flex w-full items-start gap-4 px-6 py-4 text-left transition hover:bg-gray-50"
                >
                  <div
                    className={cn(
                      'relative h-16 w-24 shrink-0 overflow-hidden rounded-md bg-gradient-to-br',
                      pr.category === 'added' && 'from-blue-100 to-blue-50',
                      pr.category === 'enhanced' && 'from-purple-100 to-purple-50',
                      pr.category === 'fixed' && 'from-emerald-100 to-emerald-50',
                      pr.category === 'other' && 'from-gray-100 to-gray-50'
                    )}
                  >
                    {thumb ? (
                      <Image
                        src={thumb}
                        alt=""
                        fill
                        sizes="96px"
                        className="object-cover"
                        unoptimized
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center">
                        <Icon className="h-6 w-6 text-gray-400" aria-hidden="true" />
                      </div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="mb-1 flex items-center gap-2">
                      <Badge
                        variant="secondary"
                        className={cn('gap-1 font-medium', CATEGORY_CHIP[pr.category])}
                      >
                        {meta.label}
                      </Badge>
                      <span className="text-xs text-gray-500">
                        {new Date(pr.mergedAt).toLocaleDateString(undefined, {
                          month: 'short',
                          day: 'numeric',
                        })}
                      </span>
                    </div>
                    <p className="truncate text-sm font-medium text-gray-900">{pr.friendlyTitle}</p>
                    {excerpt && (
                      <p className="mt-1 line-clamp-2 text-xs text-gray-500">{excerpt}</p>
                    )}
                  </div>
                </button>
              </li>
            )
          })}
        </ul>
      </ScrollArea>

      <div className="border-t border-gray-200 bg-gray-50 px-4 py-3">
        <Button variant="ghost" size="sm" onClick={onBack}>
          <Play className="mr-1 h-4 w-4" />
          Back to walkthrough
        </Button>
      </div>
    </div>
  )
}
