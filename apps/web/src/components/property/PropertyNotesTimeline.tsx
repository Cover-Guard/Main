'use client'

import { useEffect, useState, useCallback } from 'react'
import { MessageSquare, Plus, Pencil, Trash2, X, Check, Clock } from 'lucide-react'
import { getPropertyNotes, createPropertyNote, updatePropertyNote, deletePropertyNote } from '@/lib/api'
import type { PropertyNote } from '@coverguard/shared'

interface Props {
  propertyId: string
}

export function PropertyNotesTimeline({ propertyId }: Props) {
  const [notes, setNotes] = useState<PropertyNote[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [newNote, setNewNote] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editContent, setEditContent] = useState('')

  const loadNotes = useCallback(async () => {
    try {
      const data = await getPropertyNotes(propertyId)
      setNotes(data)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load notes')
    } finally {
      setLoading(false)
    }
  }, [propertyId])

  useEffect(() => { loadNotes() }, [loadNotes])

  async function handleCreate() {
    if (!newNote.trim() || submitting) return
    setSubmitting(true)
    try {
      const note = await createPropertyNote(propertyId, newNote.trim())
      setNotes((prev) => [note, ...prev])
      setNewNote('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add note')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleUpdate(noteId: string) {
    if (!editContent.trim()) return
    try {
      const updated = await updatePropertyNote(propertyId, noteId, editContent.trim())
      setNotes((prev) => prev.map((n) => (n.id === noteId ? updated : n)))
      setEditingId(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update note')
    }
  }

  async function handleDelete(noteId: string) {
    try {
      await deletePropertyNote(propertyId, noteId)
      setNotes((prev) => prev.filter((n) => n.id !== noteId))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete note')
    }
  }

  function startEdit(note: PropertyNote) {
    setEditingId(note.id)
    setEditContent(note.content)
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <div className="flex items-center gap-2 mb-4">
        <MessageSquare className="h-4 w-4 text-blue-500" />
        <h3 className="text-sm font-semibold text-gray-800">Notes Timeline</h3>
        <span className="text-xs text-gray-400 ml-auto">{notes.length} note{notes.length !== 1 ? 's' : ''}</span>
      </div>

      {error && (
        <div className="mb-3 rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-700">
          {error}
          <button onClick={() => setError(null)} className="ml-2 text-red-400 hover:text-red-600">
            <X className="h-3 w-3 inline" />
          </button>
        </div>
      )}

      {/* Add note form */}
      <div className="flex gap-2 mb-4">
        <textarea
          value={newNote}
          onChange={(e) => setNewNote(e.target.value)}
          placeholder="Add a note about this property..."
          className="flex-1 min-h-[60px] rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-300 resize-none"
          maxLength={2000}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleCreate()
          }}
        />
        <button
          onClick={handleCreate}
          disabled={!newNote.trim() || submitting}
          className="self-end flex items-center gap-1 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white text-xs font-medium px-3 py-2 rounded-lg transition-colors"
        >
          <Plus className="h-3.5 w-3.5" />
          Add
        </button>
      </div>

      {/* Notes list */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 rounded-lg bg-gray-100 animate-pulse" />
          ))}
        </div>
      ) : notes.length === 0 ? (
        <div className="py-6 text-center">
          <MessageSquare className="mx-auto h-8 w-8 text-gray-200 mb-2" />
          <p className="text-sm text-gray-400">No notes yet. Add your first observation.</p>
        </div>
      ) : (
        <div className="space-y-1">
          {notes.map((note) => (
            <div key={note.id} className="group relative flex gap-3 py-3 border-b border-gray-50 last:border-0">
              {/* Timeline dot */}
              <div className="flex flex-col items-center">
                <div className="mt-1 h-2 w-2 rounded-full bg-blue-400 shrink-0" />
                <div className="flex-1 w-px bg-gray-100 mt-1" />
              </div>

              <div className="flex-1 min-w-0">
                {editingId === note.id ? (
                  <div className="flex flex-col gap-2">
                    <textarea
                      value={editContent}
                      onChange={(e) => setEditContent(e.target.value)}
                      className="w-full min-h-[48px] rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 resize-none"
                      maxLength={2000}
                    />
                    <div className="flex gap-1">
                      <button
                        onClick={() => handleUpdate(note.id)}
                        className="flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-700 px-2 py-1 rounded hover:bg-blue-50"
                      >
                        <Check className="h-3 w-3" /> Save
                      </button>
                      <button
                        onClick={() => setEditingId(null)}
                        className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700 px-2 py-1 rounded hover:bg-gray-50"
                      >
                        <X className="h-3 w-3" /> Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <p className="text-sm text-gray-700 whitespace-pre-wrap">{note.content}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="flex items-center gap-1 text-[10px] text-gray-400">
                        <Clock className="h-3 w-3" />
                        {new Date(note.createdAt).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                          hour: 'numeric',
                          minute: '2-digit',
                        })}
                      </span>
                      <div className="hidden group-hover:flex items-center gap-1 ml-auto">
                        <button
                          onClick={() => startEdit(note)}
                          className="p-1 rounded text-gray-400 hover:text-blue-500 hover:bg-blue-50"
                        >
                          <Pencil className="h-3 w-3" />
                        </button>
                        <button
                          onClick={() => handleDelete(note.id)}
                          className="p-1 rounded text-gray-400 hover:text-red-500 hover:bg-red-50"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
