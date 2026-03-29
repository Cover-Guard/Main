'use client'

import { useState, useEffect } from 'react'
import { GitCompare, X, Trash2, ExternalLink, Bookmark } from 'lucide-react'
import { getSavedComparisons, createSavedComparison, deleteSavedComparison } from '@/lib/api'
import type { SavedComparison } from '@coverguard/shared'
import Link from 'next/link'
import { useCompare } from '@/lib/useCompare'

export function ComparisonHistoryDashboard() {
  const [comparisons, setComparisons] = useState<SavedComparison[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [formName, setFormName] = useState('')
  const [formNotes, setFormNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const { ids: currentCompareIds } = useCompare()

  useEffect(() => {
    setLoading(true)
    getSavedComparisons()
      .then(setComparisons)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  async function handleSaveCurrent(e: React.FormEvent) {
    e.preventDefault()
    if (!formName.trim() || currentCompareIds.length < 2) return
    setSubmitting(true)
    try {
      const comparison = await createSavedComparison({
        name: formName,
        propertyIds: currentCompareIds,
        notes: formNotes || undefined,
      })
      setComparisons((prev) => [comparison, ...prev])
      setShowForm(false)
      setFormName('')
      setFormNotes('')
    } catch {
      // silent
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDelete(id: string) {
    try {
      await deleteSavedComparison(id)
      setComparisons((prev) => prev.filter((c) => c.id !== id))
    } catch {
      // silent
    }
  }

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Saved Comparisons</h1>
          <p className="text-sm text-gray-500 mt-1">Revisit past property comparisons</p>
        </div>
        {currentCompareIds.length >= 2 && (
          <button
            onClick={() => setShowForm(!showForm)}
            className="flex items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-2 text-sm font-medium text-white hover:bg-brand-700 transition-colors"
          >
            {showForm ? <X className="h-4 w-4" /> : <Bookmark className="h-4 w-4" />}
            {showForm ? 'Cancel' : 'Save Current Comparison'}
          </button>
        )}
      </div>

      {/* Current comparison info */}
      {currentCompareIds.length > 0 && (
        <div className="rounded-lg border border-brand-200 bg-brand-50 p-3">
          <div className="flex items-center gap-2">
            <GitCompare className="h-4 w-4 text-brand-600" />
            <span className="text-sm font-medium text-brand-700">
              Current comparison: {currentCompareIds.length} properties
            </span>
            <Link href="/compare" className="ml-auto text-xs text-brand-600 hover:underline flex items-center gap-1">
              View <ExternalLink className="h-3 w-3" />
            </Link>
          </div>
        </div>
      )}

      {/* Save form */}
      {showForm && (
        <form onSubmit={handleSaveCurrent} className="rounded-lg border border-gray-200 bg-white p-4 space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Comparison Name</label>
            <input
              type="text"
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
              placeholder="e.g., Austin TX - Top 3 picks"
              required
              className="w-full rounded-md border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-brand-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Notes (optional)</label>
            <textarea
              value={formNotes}
              onChange={(e) => setFormNotes(e.target.value)}
              rows={2}
              placeholder="Key takeaways from this comparison..."
              className="w-full rounded-md border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-brand-500"
            />
          </div>
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <span>Will save {currentCompareIds.length} property IDs</span>
          </div>
          <button
            type="submit"
            disabled={submitting}
            className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50 transition-colors"
          >
            {submitting ? 'Saving...' : 'Save Comparison'}
          </button>
        </form>
      )}

      {/* Saved comparisons list */}
      <div className="rounded-lg border border-gray-200 bg-white">
        <div className="border-b border-gray-100 px-4 py-3">
          <h2 className="text-sm font-semibold text-gray-900">
            Comparison History
            <span className="ml-2 text-gray-400 font-normal">({comparisons.length})</span>
          </h2>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-gray-300 border-t-brand-600" />
          </div>
        ) : comparisons.length === 0 ? (
          <div className="flex flex-col items-center py-12 text-gray-400">
            <GitCompare className="h-10 w-10 mb-2" />
            <p className="text-sm">No saved comparisons yet</p>
            <p className="text-xs mt-1">Compare 2-3 properties, then save the comparison here</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {comparisons.map((comp) => (
              <div key={comp.id} className="flex items-center gap-4 px-4 py-3 hover:bg-gray-50 transition-colors">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-50">
                  <GitCompare className="h-4 w-4 text-brand-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900">{comp.name}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs text-gray-500">
                      {comp.propertyIds.length} properties
                    </span>
                    <span className="text-xs text-gray-300">|</span>
                    <span className="text-xs text-gray-400">
                      {new Date(comp.createdAt).toLocaleDateString()}
                    </span>
                    {comp.notes && (
                      <>
                        <span className="text-xs text-gray-300">|</span>
                        <span className="text-xs text-gray-500 truncate">{comp.notes}</span>
                      </>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Link
                    href={`/dashboard?tab=compare&ids=${comp.propertyIds.join(',')}`}
                    className="flex items-center gap-1 rounded-md bg-brand-50 px-2.5 py-1.5 text-xs font-medium text-brand-600 hover:bg-brand-100 transition-colors"
                  >
                    <ExternalLink className="h-3 w-3" />
                    Load
                  </Link>
                  <button
                    onClick={() => handleDelete(comp.id)}
                    className="text-gray-300 hover:text-red-500 transition-colors"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
