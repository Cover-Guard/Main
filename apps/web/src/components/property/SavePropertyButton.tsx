'use client'

import { useState, useEffect } from 'react'
import { Bookmark, BookmarkCheck, Loader2 } from 'lucide-react'
import { saveProperty, unsaveProperty, getSavedProperties } from '@/lib/api'

interface SavePropertyButtonProps {
  propertyId: string
  className?: string
}

export function SavePropertyButton({ propertyId, className = '' }: SavePropertyButtonProps) {
  const [saved, setSaved] = useState(false)
  const [loading, setLoading] = useState(true)
  const [working, setWorking] = useState(false)
  const [feedback, setFeedback] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    getSavedProperties()
      .then((list) => {
        if (cancelled) return
        setSaved(list.some((s) => s.propertyId === propertyId || s.property.id === propertyId))
      })
      .catch(() => {
        if (cancelled) return
        // Unable to check saved status — default to unsaved.
        // Auth-required endpoint will fail for logged-out users; that's expected.
        setSaved(false)
      })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [propertyId])

  async function toggle() {
    if (working) return
    setWorking(true)
    try {
      if (saved) {
        await unsaveProperty(propertyId)
        setSaved(false)
        flash('Removed from saved')
      } else {
        await saveProperty(propertyId)
        setSaved(true)
        flash('Saved to reports')
      }
    } catch {
      flash('Sign in to save properties')
    } finally {
      setWorking(false)
    }
  }

  function flash(msg: string) {
    setFeedback(msg)
    setTimeout(() => setFeedback(null), 2000)
  }

  return (
    <div className="relative inline-flex">
      <button
        onClick={toggle}
        disabled={loading || working}
        title={saved ? 'Remove from saved' : 'Save property'}
        className={`flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-medium transition-colors disabled:opacity-50 ${
          saved
            ? 'border-emerald-300 bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
            : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
        } ${className}`}
      >
        {working || loading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : saved ? (
          <BookmarkCheck className="h-4 w-4" />
        ) : (
          <Bookmark className="h-4 w-4" />
        )}
        {saved ? 'Saved' : 'Save'}
      </button>
      {feedback && (
        <div className="absolute -bottom-9 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-md bg-gray-900 px-2.5 py-1.5 text-xs text-white shadow-lg">
          {feedback}
        </div>
      )}
    </div>
  )
}
