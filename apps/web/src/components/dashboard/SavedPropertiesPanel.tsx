'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import type { Property } from '@coverguard/shared'
import { getSavedProperties, getSavedPropertyTags, saveProperty } from '@/lib/api'
import { PropertyCard } from '@/components/search/PropertyCard'
import { Building2, AlertTriangle, Tag, X, Pencil, Check } from 'lucide-react'

interface SavedEntry {
  id: string
  notes: string | null
  tags: string[]
  savedAt: string
  property: Property
}

interface SavedPropertiesPanelProps {
  limit?: number
  compact?: boolean
}

// ── Tag color palette ────────────────────────────────────────────────────────
const TAG_COLORS = [
  'bg-blue-100 text-blue-700',
  'bg-emerald-100 text-emerald-700',
  'bg-purple-100 text-purple-700',
  'bg-amber-100 text-amber-700',
  'bg-rose-100 text-rose-700',
  'bg-cyan-100 text-cyan-700',
  'bg-indigo-100 text-indigo-700',
  'bg-orange-100 text-orange-700',
]

function tagColor(tag: string): string {
  let hash = 0
  for (let i = 0; i < tag.length; i++) {
    hash = tag.charCodeAt(i) + ((hash << 5) - hash)
  }
  return TAG_COLORS[Math.abs(hash) % TAG_COLORS.length]
}

// ── Inline Notes Editor ──────────────────────────────────────────────────────
function InlineNotesEditor({
  propertyId,
  initialNotes,
  tags,
  onSaved,
}: {
  propertyId: string
  initialNotes: string | null
  tags: string[]
  onSaved: (notes: string) => void
}) {
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState(initialNotes ?? '')
  const [saving, setSaving] = useState(false)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.setSelectionRange(value.length, value.length)
    }
  }, [editing, value.length])

  const handleSave = useCallback(async () => {
    const trimmed = value.trim()
    setSaving(true)
    try {
      await saveProperty(propertyId, trimmed || undefined, tags)
      onSaved(trimmed)
      setEditing(false)
    } catch {
      // Silently fail — user can retry
    } finally {
      setSaving(false)
    }
  }, [propertyId, value, tags, onSaved])

  if (!editing) {
    return (
      <button
        onClick={() => setEditing(true)}
        className="group flex items-start gap-1.5 text-left w-full"
      >
        {initialNotes ? (
          <p className="text-xs text-gray-500 line-clamp-2 flex-1">{initialNotes}</p>
        ) : (
          <p className="text-xs text-gray-400 italic flex-1">Add a note...</p>
        )}
        <Pencil className="h-3 w-3 text-gray-300 group-hover:text-gray-500 shrink-0 mt-0.5" />
      </button>
    )
  }

  return (
    <div className="flex items-start gap-1.5">
      <textarea
        ref={inputRef}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={handleSave}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault()
            handleSave()
          }
          if (e.key === 'Escape') {
            setValue(initialNotes ?? '')
            setEditing(false)
          }
        }}
        rows={2}
        disabled={saving}
        className="flex-1 text-xs text-gray-700 border border-gray-300 rounded-md px-2 py-1.5 resize-none focus:outline-none focus:ring-1 focus:ring-blue-400 disabled:opacity-50"
        placeholder="Add a note..."
      />
      <button
        onClick={handleSave}
        disabled={saving}
        className="mt-0.5 p-1 rounded hover:bg-gray-100 disabled:opacity-50"
      >
        <Check className="h-3.5 w-3.5 text-green-600" />
      </button>
    </div>
  )
}

// ── Main Component ───────────────────────────────────────────────────────────
export function SavedPropertiesPanel({ limit, compact }: SavedPropertiesPanelProps) {
  const [saved, setSaved] = useState<SavedEntry[]>([])
  const [allTags, setAllTags] = useState<string[]>([])
  const [activeTag, setActiveTag] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchData = useCallback(async (tag?: string | null) => {
    setLoading(true)
    setError(null)
    try {
      const [props, tags] = await Promise.all([
        getSavedProperties(tag ?? undefined),
        getSavedPropertyTags(),
      ])
      setSaved(props as SavedEntry[])
      setAllTags(tags)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load saved properties')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData(activeTag)
  }, [activeTag, fetchData])

  const handleTagFilter = (tag: string) => {
    setActiveTag((prev) => (prev === tag ? null : tag))
  }

  const handleNotesSaved = (entryId: string, notes: string) => {
    setSaved((prev) =>
      prev.map((s) => (s.id === entryId ? { ...s, notes: notes || null } : s))
    )
  }

  const displayed = limit ? saved.slice(0, limit) : saved

  if (loading && saved.length === 0) {
    return (
      <div className="space-y-3">
        {[1, 2].map((i) => (
          <div key={i} className="card h-24 animate-pulse bg-gray-100" />
        ))}
      </div>
    )
  }

  if (error) {
    return (
      <div className="card p-6 text-center">
        <AlertTriangle className="mx-auto mb-2 h-7 w-7 text-red-400" />
        <p className="font-medium text-red-600">Could not load saved properties</p>
        <p className="mt-1 text-sm text-gray-400">{error}</p>
      </div>
    )
  }

  if (saved.length === 0 && !activeTag) {
    return (
      <div className="card p-10 text-center text-gray-400">
        <Building2 className="mx-auto mb-3 h-10 w-10 opacity-30" />
        <p className="font-medium">No saved properties yet</p>
        <p className="mt-1 text-sm">Search for a property and save it to track it here.</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {/* Header */}
      {!compact && (
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">Saved Properties</h2>
          <p className="text-sm text-gray-500">{saved.length} saved</p>
        </div>
      )}
      {compact && <h3 className="font-semibold text-gray-800">Recent Saved Properties</h3>}

      {/* Tag filter bar */}
      {allTags.length > 0 && (
        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
          <Tag className="h-3.5 w-3.5 text-gray-400 shrink-0" />
          {activeTag && (
            <button
              onClick={() => setActiveTag(null)}
              className="flex items-center gap-1 text-xs font-medium text-gray-500 border border-gray-200 rounded-full px-2.5 py-1 hover:bg-gray-50 shrink-0"
            >
              Clear
              <X className="h-3 w-3" />
            </button>
          )}
          {allTags.map((tag) => (
            <button
              key={tag}
              onClick={() => handleTagFilter(tag)}
              className={`shrink-0 rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                activeTag === tag
                  ? 'bg-gray-900 text-white'
                  : `${tagColor(tag)} hover:opacity-80`
              }`}
            >
              {tag}
            </button>
          ))}
        </div>
      )}

      {/* Empty state when filtering */}
      {saved.length === 0 && activeTag && (
        <div className="card p-6 text-center text-gray-400">
          <p className="text-sm">No properties found with tag &ldquo;{activeTag}&rdquo;</p>
          <button
            onClick={() => setActiveTag(null)}
            className="mt-2 text-xs text-blue-600 hover:underline"
          >
            Clear filter
          </button>
        </div>
      )}

      {/* Property cards with notes and tags */}
      {displayed.map((entry) => (
        <div
          key={entry.id}
          className="bg-white rounded-xl border border-gray-200 overflow-hidden"
        >
          <PropertyCard property={entry.property} />

          {/* Notes & tags section */}
          <div className="px-4 pb-3 pt-1 border-t border-gray-100 space-y-2">
            {/* Tags */}
            {entry.tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {entry.tags.map((tag) => (
                  <span
                    key={tag}
                    className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${tagColor(tag)}`}
                  >
                    {tag}
                  </span>
                ))}
              </div>
            )}

            {/* Inline notes */}
            <InlineNotesEditor
              propertyId={entry.property.id}
              initialNotes={entry.notes}
              tags={entry.tags}
              onSaved={(notes) => handleNotesSaved(entry.id, notes)}
            />
          </div>
        </div>
      ))}
    </div>
  )
}
