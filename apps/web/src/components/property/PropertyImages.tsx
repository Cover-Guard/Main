'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import Image from 'next/image'
import { Camera, Satellite, ChevronLeft, ChevronRight, Maximize2, X } from 'lucide-react'
import type { PropertyImage } from '@coverguard/shared'

interface PropertyImagesProps {
  images: PropertyImage[]
  address: string
}

const TYPE_ICONS: Record<PropertyImage['type'], typeof Camera> = {
  street_view: Camera,
  satellite: Satellite,
  listing: Camera,
  exterior: Camera,
  interior: Camera,
}

export function PropertyImages({ images, address }: PropertyImagesProps) {
  const [activeIndex, setActiveIndex] = useState(0)
  const [lightboxOpen, setLightboxOpen] = useState(false)
  const closeBtnRef = useRef<HTMLButtonElement>(null)
  const previousFocusRef = useRef<HTMLElement | null>(null)

  const goTo = useCallback((index: number) => {
    setActiveIndex((index + images.length) % images.length)
  }, [images.length])

  // Lightbox keyboard handling (Escape to close, arrow keys to navigate)
  useEffect(() => {
    if (!lightboxOpen) return

    previousFocusRef.current = document.activeElement as HTMLElement | null
    closeBtnRef.current?.focus()

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setLightboxOpen(false)
      } else if (e.key === 'ArrowLeft') {
        goTo(activeIndex - 1)
      } else if (e.key === 'ArrowRight') {
        goTo(activeIndex + 1)
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      previousFocusRef.current?.focus()
    }
  }, [lightboxOpen, activeIndex, goTo])

  if (images.length === 0) return null

  const activeImage = images[Math.min(activeIndex, images.length - 1)]
  if (!activeImage) return null
  const Icon = TYPE_ICONS[activeImage.type] ?? Camera

  return (
    <>
      <div className="card overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100">
          <h2 className="text-lg font-semibold text-gray-900">Property Images</h2>
          <span className="text-xs text-gray-400">
            {images.length} image{images.length !== 1 ? 's' : ''} available
          </span>
        </div>

        {/* Main image */}
        <div className="relative aspect-[16/10] bg-gray-100 group">
          <Image
            src={activeImage.url}
            alt={activeImage.caption || `Property image ${activeIndex + 1}`}
            fill
            className="object-cover"
            sizes="(max-width: 768px) 100vw, 66vw"
            unoptimized
          />

          {/* Navigation arrows — visible on hover and always focusable */}
          {images.length > 1 && (
            <>
              <button
                onClick={() => goTo(activeIndex - 1)}
                className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-black/50 p-1.5 text-white opacity-70 sm:opacity-0 sm:group-hover:opacity-100 focus:opacity-100 transition-opacity hover:bg-black/70"
                aria-label="Previous image"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
              <button
                onClick={() => goTo(activeIndex + 1)}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-black/50 p-1.5 text-white opacity-70 sm:opacity-0 sm:group-hover:opacity-100 focus:opacity-100 transition-opacity hover:bg-black/70"
                aria-label="Next image"
              >
                <ChevronRight className="h-5 w-5" />
              </button>
            </>
          )}

          {/* Fullscreen button */}
          <button
            onClick={() => setLightboxOpen(true)}
            className="absolute top-2 right-2 rounded-lg bg-black/50 p-1.5 text-white opacity-70 sm:opacity-0 sm:group-hover:opacity-100 focus:opacity-100 transition-opacity hover:bg-black/70"
            aria-label="View fullscreen"
          >
            <Maximize2 className="h-4 w-4" />
          </button>

          {/* Caption overlay */}
          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent px-4 py-3">
            <div className="flex items-center gap-2">
              <Icon className="h-4 w-4 text-white/80" aria-hidden="true" />
              <span className="text-sm font-medium text-white">{activeImage.caption}</span>
            </div>
            <span className="text-xs text-white/60">{activeImage.source}</span>
          </div>
        </div>

        {/* Thumbnail strip */}
        {images.length > 1 && (
          <div className="flex gap-1.5 p-3 overflow-x-auto" role="tablist" aria-label="Image thumbnails">
            {images.map((img, i) => (
              <button
                key={`thumb-${i}`}
                role="tab"
                aria-selected={i === activeIndex}
                aria-label={img.caption || `Image ${i + 1}`}
                onClick={() => setActiveIndex(i)}
                className={`relative shrink-0 h-16 w-24 rounded-md overflow-hidden border-2 transition-all ${
                  i === activeIndex
                    ? 'border-brand-600 ring-1 ring-brand-300'
                    : 'border-transparent opacity-60 hover:opacity-100'
                }`}
              >
                <Image
                  src={img.url}
                  alt=""
                  fill
                  className="object-cover"
                  sizes="96px"
                  unoptimized
                />
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Lightbox */}
      {lightboxOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90"
          role="dialog"
          aria-modal="true"
          aria-label={`Fullscreen view: ${activeImage.caption || 'Property image'}`}
          onClick={() => setLightboxOpen(false)}
        >
          <button
            ref={closeBtnRef}
            onClick={() => setLightboxOpen(false)}
            className="absolute top-4 right-4 rounded-full bg-white/10 p-2 text-white hover:bg-white/20 transition-colors"
            aria-label="Close fullscreen"
          >
            <X className="h-6 w-6" />
          </button>

          {images.length > 1 && (
            <>
              <button
                onClick={(e) => { e.stopPropagation(); goTo(activeIndex - 1) }}
                className="absolute left-4 top-1/2 -translate-y-1/2 rounded-full bg-white/10 p-2 text-white hover:bg-white/20"
                aria-label="Previous image"
              >
                <ChevronLeft className="h-8 w-8" />
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); goTo(activeIndex + 1) }}
                className="absolute right-4 top-1/2 -translate-y-1/2 rounded-full bg-white/10 p-2 text-white hover:bg-white/20"
                aria-label="Next image"
              >
                <ChevronRight className="h-8 w-8" />
              </button>
            </>
          )}

          <div className="relative max-h-[85vh] max-w-[90vw]" onClick={(e) => e.stopPropagation()}>
            <Image
              src={activeImage.url}
              alt={activeImage.caption || `Property image ${activeIndex + 1}`}
              width={1200}
              height={750}
              className="rounded-lg object-contain max-h-[85vh]"
              unoptimized
            />
            <div className="absolute bottom-0 left-0 right-0 rounded-b-lg bg-gradient-to-t from-black/70 to-transparent px-6 py-4">
              <p className="text-white font-medium">{activeImage.caption}</p>
              <p className="text-white/60 text-sm">{activeImage.source} &middot; {address}</p>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
