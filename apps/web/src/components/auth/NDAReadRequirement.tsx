'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { FileText, ChevronDown, ChevronUp, CheckCircle2 } from 'lucide-react'
import NDAContent from './NDAContent'

interface NDAReadRequirementProps {
  acknowledged: boolean
  onAcknowledgedChange: (value: boolean) => void
}

export default function NDAReadRequirement({ acknowledged, onAcknowledgedChange }: NDAReadRequirementProps) {
  const [expanded, setExpanded] = useState(false)
  const [hasScrolledToBottom, setHasScrolledToBottom] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  const checkScrollPosition = useCallback(() => {
    const el = scrollRef.current
    if (!el) return
    // Content fits without scrolling, or user has scrolled within 20px of the end
    if (el.scrollHeight <= el.clientHeight + 20 || el.scrollTop + el.clientHeight >= el.scrollHeight - 20) {
      setHasScrolledToBottom(true)
    }
  }, [])

  // Check on expand whether the content already fits without scrolling
  useEffect(() => {
    if (expanded) {
      // Wait one frame for the DOM to render the content
      requestAnimationFrame(checkScrollPosition)
    }
  }, [expanded, checkScrollPosition])

  const canAcknowledge = hasScrolledToBottom

  return (
    <div className="rounded-lg border border-gray-200 bg-gray-50">
      {/* Header / toggle */}
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center justify-between px-4 py-3 text-left"
      >
        <span className="flex items-center gap-2 text-sm font-medium text-gray-900">
          <FileText className="h-4 w-4 text-brand-600" />
          Non-Disclosure Agreement
          {acknowledged && <CheckCircle2 className="h-4 w-4 text-green-600" />}
        </span>
        {expanded ? (
          <ChevronUp className="h-4 w-4 text-gray-400" />
        ) : (
          <ChevronDown className="h-4 w-4 text-gray-400" />
        )}
      </button>

      {expanded && (
        <div className="border-t border-gray-200 px-4 pb-4">
          {/* Scrollable NDA content */}
          <div
            ref={scrollRef}
            onScroll={checkScrollPosition}
            className="mt-3 max-h-64 overflow-y-auto rounded border border-gray-200 bg-white px-4 py-3 text-xs text-gray-600"
          >
            <NDAContent className="space-y-4" />
          </div>

          {/* Scroll prompt */}
          {!hasScrolledToBottom && (
            <p className="mt-2 text-xs text-amber-600">
              Please scroll to the bottom of the agreement to continue.
            </p>
          )}

          {/* Acknowledge checkbox */}
          <label className={`mt-3 flex items-start gap-2 text-xs ${canAcknowledge ? 'text-gray-700' : 'text-gray-400'}`}>
            <input
              type="checkbox"
              checked={acknowledged}
              disabled={!canAcknowledge}
              onChange={(e) => onAcknowledgedChange(e.target.checked)}
              className="mt-0.5 rounded border-gray-300 text-brand-600 focus:ring-brand-500 disabled:opacity-50"
            />
            <span>I have read and acknowledge the Non-Disclosure Agreement</span>
          </label>
        </div>
      )}
    </div>
  )
}
