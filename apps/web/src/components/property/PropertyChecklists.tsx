'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import {
  ClipboardCheck,
  Plus,
  Trash2,
  Pencil,
  Check,
  X,
  RotateCcw,
  Loader2,
  Search,
  CircleCheckBig,
  Circle,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { PropertyChecklist, ChecklistType, ChecklistItem } from '@coverguard/shared'
import {
  getPropertyChecklists,
  createPropertyChecklist,
  updatePropertyChecklist,
  deletePropertyChecklist,
} from '@/lib/api'

// ─── Default checklist templates ─────────────────────────────────────────────

const DEFAULT_TEMPLATES: Record<ChecklistType, { title: string; items: string[] }> = {
  INSPECTION: {
    title: 'Property Inspection Checklist',
    items: [
      'Roof condition — check for missing shingles, leaks, or sagging',
      'Foundation — inspect for cracks, water damage, or settling',
      'HVAC system — test heating and cooling, check filter and ductwork',
      'Plumbing — run faucets, check water pressure, inspect pipes for leaks',
      'Electrical panel — verify wiring, breaker capacity, GFCI outlets',
      'Water heater — check age, capacity, and condition',
      'Windows and doors — test operation, check seals and weatherstripping',
      'Attic — inspect insulation, ventilation, and signs of pests',
      'Basement / crawl space — check for moisture, mold, or structural issues',
      'Exterior siding and paint — note damage or deterioration',
      'Drainage and grading — ensure water flows away from foundation',
      'Garage — inspect door operation, floor condition, and fire separation',
      'Smoke and CO detectors — verify presence and functionality',
      'Appliances included in sale — test operation',
    ],
  },
  NEW_BUYER: {
    title: 'New Buyer Checklist',
    items: [
      'Review property disclosure statement',
      'Obtain homeowners insurance quotes',
      'Schedule home inspection',
      'Review HOA documents and fees (if applicable)',
      'Verify property tax amount and assessment',
      'Check flood zone designation and insurance requirements',
      'Confirm school district boundaries',
      'Research neighborhood crime statistics',
      'Verify utility providers and estimated costs',
      'Review title report for liens or encumbrances',
      'Confirm property boundaries with survey',
      'Check for pending permits or code violations',
      'Understand closing costs and timeline',
      'Set up utility transfers for closing day',
    ],
  },
  AGENT: {
    title: 'Agent Due Diligence Checklist',
    items: [
      'Pull comparable sales (last 6 months, 1-mile radius)',
      'Verify MLS listing accuracy and disclosures',
      'Confirm property insurability and active carriers',
      'Review risk profile — flood, fire, wind, earthquake, crime',
      'Check for open permits or code enforcement actions',
      'Verify property tax assessment and exemptions',
      'Confirm HOA status, fees, and reserve fund (if applicable)',
      'Review title commitment for exceptions',
      'Document condition issues for negotiation',
      'Prepare insurance cost estimate for client',
      'Identify potential deal-breakers from risk assessment',
      'Send binding quote request to qualifying carriers',
      'Schedule follow-up with client after report review',
    ],
  },
}

const CHECKLIST_META: Record<ChecklistType, { label: string; description: string; color: string; bg: string; border: string; ring: string }> = {
  INSPECTION: {
    label: 'Inspection',
    description: 'Physical property inspection items',
    color: 'text-amber-700',
    bg: 'bg-amber-50',
    border: 'border-amber-200',
    ring: 'ring-amber-500/20',
  },
  NEW_BUYER: {
    label: 'New Buyer',
    description: 'Due diligence for home buyers',
    color: 'text-blue-700',
    bg: 'bg-blue-50',
    border: 'border-blue-200',
    ring: 'ring-blue-500/20',
  },
  AGENT: {
    label: 'Agent',
    description: 'Agent review and follow-up tasks',
    color: 'text-emerald-700',
    bg: 'bg-emerald-50',
    border: 'border-emerald-200',
    ring: 'ring-emerald-500/20',
  },
}

const CHECKLIST_TYPES: ChecklistType[] = ['INSPECTION', 'NEW_BUYER', 'AGENT']

function generateId(): string {
  return `item_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
}

function buildDefaultItems(type: ChecklistType): ChecklistItem[] {
  return DEFAULT_TEMPLATES[type].items.map((label) => ({
    id: generateId(),
    label,
    checked: false,
  }))
}

// ─── Debounce hook for auto-save ─────────────────────────────────────────────

function useDebouncedSave(delay: number) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const schedule = useCallback(
    (fn: () => void) => {
      if (timerRef.current) clearTimeout(timerRef.current)
      timerRef.current = setTimeout(fn, delay)
    },
    [delay],
  )

  const flush = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
  }, [])

  useEffect(() => () => flush(), [flush])

  return { schedule, flush }
}

// ─── Main Component ──────────────────────────────────────────────────────────

interface PropertyChecklistsProps {
  propertyId: string
}

export function PropertyChecklists({ propertyId }: PropertyChecklistsProps) {
  const [checklists, setChecklists] = useState<PropertyChecklist[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeType, setActiveType] = useState<ChecklistType | null>(null)
  const [saving, setSaving] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState<ChecklistType | null>(null)

  const fetchChecklists = useCallback(async () => {
    try {
      const data = await getPropertyChecklists(propertyId)
      setChecklists(data)
      setError(null)
    } catch {
      setChecklists([])
    } finally {
      setLoading(false)
    }
  }, [propertyId])

  useEffect(() => {
    fetchChecklists()
  }, [fetchChecklists])

  const getChecklist = (type: ChecklistType) =>
    checklists.find((c) => c.checklistType === type)

  const handleCreate = async (type: ChecklistType) => {
    setSaving(true)
    try {
      const template = DEFAULT_TEMPLATES[type]
      const newChecklist = await createPropertyChecklist(propertyId, {
        checklistType: type,
        title: template.title,
        items: buildDefaultItems(type),
      })
      setChecklists((prev) => [...prev.filter((c) => c.checklistType !== type), newChecklist])
      setActiveType(type)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create checklist')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (type: ChecklistType) => {
    const checklist = getChecklist(type)
    if (!checklist) return
    setSaving(true)
    try {
      await deletePropertyChecklist(propertyId, checklist.id)
      setChecklists((prev) => prev.filter((c) => c.id !== checklist.id))
      if (activeType === type) setActiveType(null)
      setConfirmDelete(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete checklist')
    } finally {
      setSaving(false)
    }
  }

  const handleUpdate = async (checklist: PropertyChecklist, items: ChecklistItem[], title?: string) => {
    // Optimistic update
    const updatedOptimistic = {
      ...checklist,
      items: items as unknown as ChecklistItem[],
      ...(title !== undefined ? { title } : {}),
    }
    setChecklists((prev) => prev.map((c) => (c.id === checklist.id ? updatedOptimistic : c)))

    setSaving(true)
    try {
      const updated = await updatePropertyChecklist(propertyId, checklist.id, {
        ...(title !== undefined ? { title } : {}),
        items,
      })
      setChecklists((prev) => prev.map((c) => (c.id === updated.id ? updated : c)))
    } catch (err) {
      // Revert on failure
      setChecklists((prev) => prev.map((c) => (c.id === checklist.id ? checklist : c)))
      setError(err instanceof Error ? err.message : 'Failed to update checklist')
    } finally {
      setSaving(false)
    }
  }

  // ── Loading skeleton ───────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="card p-4 sm:p-6">
        <div className="flex items-center gap-2 mb-4">
          <ClipboardCheck className="h-5 w-5 text-brand-600" />
          <h2 className="text-lg font-semibold text-gray-900">Report Checklists</h2>
        </div>
        <div className="animate-pulse space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 sm:h-14 rounded-xl bg-gray-100" />
          ))}
        </div>
      </div>
    )
  }

  const activeChecklist = activeType ? getChecklist(activeType) : null

  return (
    <div className="card overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 sm:px-6 sm:py-4 border-b border-gray-100">
        <div className="flex items-center gap-2">
          <ClipboardCheck className="h-5 w-5 text-brand-600" />
          <div>
            <h2 className="text-base font-semibold text-gray-900 sm:text-lg">Report Checklists</h2>
            <p className="hidden sm:block text-xs text-gray-500">
              Create and manage inspection, buyer, and agent checklists for this property.
            </p>
          </div>
        </div>
        {saving && (
          <div className="flex items-center gap-1.5 text-xs text-gray-400">
            <Loader2 className="h-3 w-3 animate-spin" />
            <span className="hidden sm:inline">Saving</span>
          </div>
        )}
      </div>

      {/* Error banner */}
      {error && (
        <div className="mx-4 mt-3 sm:mx-6 rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700 flex items-center justify-between gap-2">
          <span className="line-clamp-2">{error}</span>
          <button type="button" onClick={() => setError(null)} className="shrink-0 text-red-400 hover:text-red-600">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Checklist type tabs — horizontally scrollable on mobile */}
      <div className="flex overflow-x-auto border-b border-gray-100 px-4 sm:px-6 gap-1 sm:gap-2 no-tap-highlight scroll-touch">
        {CHECKLIST_TYPES.map((type) => {
          const meta = CHECKLIST_META[type]
          const checklist = getChecklist(type)
          const items = checklist ? (checklist.items as ChecklistItem[]) : []
          const completedCount = items.filter((i) => i.checked).length
          const isActive = activeType === type

          return (
            <button
              key={type}
              type="button"
              onClick={() => setActiveType(isActive ? null : type)}
              className={cn(
                'relative flex shrink-0 items-center gap-2 px-3 py-3 sm:px-4 text-sm font-medium transition-colors',
                'border-b-2',
                isActive
                  ? 'border-brand-600 text-brand-700'
                  : 'border-transparent text-gray-500 hover:text-gray-700 active:text-gray-700'
              )}
            >
              <span>{meta.label}</span>
              {checklist ? (
                <span
                  className={cn(
                    'inline-flex items-center justify-center rounded-full px-1.5 py-0.5 text-[10px] font-semibold leading-none',
                    completedCount === items.length && items.length > 0
                      ? 'bg-green-100 text-green-700'
                      : 'bg-gray-100 text-gray-600'
                  )}
                >
                  {completedCount}/{items.length}
                </span>
              ) : (
                <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-gray-100 text-gray-400">
                  <Plus className="h-2.5 w-2.5" />
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* Active tab content */}
      <div className="min-h-[120px]">
        {activeType && !activeChecklist && (
          <CreateChecklistPanel
            type={activeType}
            onCreate={handleCreate}
            saving={saving}
          />
        )}

        {activeType && activeChecklist && (
          <ChecklistEditor
            checklist={activeChecklist}
            onUpdate={handleUpdate}
            onDelete={() => setConfirmDelete(activeType)}
            onReset={() => {
              const freshItems = buildDefaultItems(activeType)
              handleUpdate(activeChecklist, freshItems, DEFAULT_TEMPLATES[activeType].title)
            }}
            saving={saving}
          />
        )}

        {!activeType && (
          <div className="px-4 py-8 sm:px-6 sm:py-10 text-center">
            <ClipboardCheck className="mx-auto h-8 w-8 text-gray-300 mb-2" />
            <p className="text-sm text-gray-500">Select a checklist type above to get started.</p>
          </div>
        )}
      </div>

      {/* Delete confirmation overlay */}
      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm px-4 pb-safe">
          <div
            className={cn(
              'w-full max-w-sm rounded-t-2xl sm:rounded-2xl bg-white shadow-2xl p-5 space-y-4',
              'transition-transform duration-300 ease-out'
            )}
          >
            <div className="text-center sm:text-left">
              <h3 className="text-base font-semibold text-gray-900">Delete checklist?</h3>
              <p className="mt-1 text-sm text-gray-500">
                This will permanently remove the {CHECKLIST_META[confirmDelete].label.toLowerCase()} checklist and all its items.
              </p>
            </div>
            <div className="flex flex-col-reverse sm:flex-row gap-2 sm:justify-end">
              <button
                type="button"
                onClick={() => setConfirmDelete(null)}
                className="w-full sm:w-auto rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 active:bg-gray-100 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleDelete(confirmDelete)}
                disabled={saving}
                className="w-full sm:w-auto rounded-lg bg-red-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-red-700 active:bg-red-800 transition-colors disabled:opacity-50"
              >
                {saving ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Create Checklist Panel ──────────────────────────────────────────────────

function CreateChecklistPanel({
  type,
  onCreate,
  saving,
}: {
  type: ChecklistType
  onCreate: (type: ChecklistType) => void
  saving: boolean
}) {
  const meta = CHECKLIST_META[type]
  const template = DEFAULT_TEMPLATES[type]

  return (
    <div className="px-4 py-6 sm:px-6 sm:py-8 text-center space-y-4">
      <div className={cn('mx-auto flex h-12 w-12 items-center justify-center rounded-full', meta.bg)}>
        <ClipboardCheck className={cn('h-6 w-6', meta.color)} />
      </div>
      <div>
        <h3 className="text-sm font-semibold text-gray-900">{template.title}</h3>
        <p className="mt-1 text-xs text-gray-500">
          {meta.description} — {template.items.length} default items you can customize.
        </p>
      </div>
      <button
        type="button"
        onClick={() => onCreate(type)}
        disabled={saving}
        className={cn(
          'inline-flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-semibold text-white transition-colors',
          'bg-brand-600 hover:bg-brand-700 active:bg-brand-800 disabled:opacity-50'
        )}
      >
        {saving ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Plus className="h-4 w-4" />
        )}
        Create Checklist
      </button>
    </div>
  )
}

// ─── Checklist Editor ────────────────────────────────────────────────────────

interface ChecklistEditorProps {
  checklist: PropertyChecklist
  onUpdate: (checklist: PropertyChecklist, items: ChecklistItem[], title?: string) => Promise<void>
  onDelete: () => void
  onReset: () => void
  saving: boolean
}

function ChecklistEditor({ checklist, onUpdate, onDelete, onReset, saving }: ChecklistEditorProps) {
  const items = checklist.items as ChecklistItem[]
  const meta = CHECKLIST_META[checklist.checklistType as ChecklistType]

  const [editingTitle, setEditingTitle] = useState(false)
  const [titleDraft, setTitleDraft] = useState(checklist.title)
  const [editingItemId, setEditingItemId] = useState<string | null>(null)
  const [editDraft, setEditDraft] = useState('')
  const [newItemLabel, setNewItemLabel] = useState('')
  const [filterMode, setFilterMode] = useState<'all' | 'pending' | 'done'>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [showSearch, setShowSearch] = useState(false)

  const newItemRef = useRef<HTMLInputElement>(null)
  const { schedule } = useDebouncedSave(800)

  // Display title: use draft while editing, otherwise use the latest from props
  const displayTitle = editingTitle ? titleDraft : checklist.title

  const completedCount = items.filter((i) => i.checked).length
  const progressPct = items.length > 0 ? (completedCount / items.length) * 100 : 0
  const allDone = completedCount === items.length && items.length > 0

  // Filter & search
  const filteredItems = items.filter((item) => {
    if (filterMode === 'pending' && item.checked) return false
    if (filterMode === 'done' && !item.checked) return false
    if (searchQuery) {
      return item.label.toLowerCase().includes(searchQuery.toLowerCase())
    }
    return true
  })

  const toggleItem = (itemId: string) => {
    const updated = items.map((item) =>
      item.id === itemId ? { ...item, checked: !item.checked } : item,
    )
    onUpdate(checklist, updated)
  }

  const removeItem = (itemId: string) => {
    onUpdate(checklist, items.filter((item) => item.id !== itemId))
  }

  const startEditing = (item: ChecklistItem) => {
    setEditingItemId(item.id)
    setEditDraft(item.label)
  }

  const saveEdit = () => {
    if (!editingItemId || !editDraft.trim()) {
      setEditingItemId(null)
      return
    }
    const updated = items.map((item) =>
      item.id === editingItemId ? { ...item, label: editDraft.trim() } : item,
    )
    onUpdate(checklist, updated)
    setEditingItemId(null)
    setEditDraft('')
  }

  const addItem = () => {
    if (!newItemLabel.trim()) return
    const newItem: ChecklistItem = {
      id: generateId(),
      label: newItemLabel.trim(),
      checked: false,
    }
    onUpdate(checklist, [...items, newItem])
    setNewItemLabel('')
    // Keep focus on input for rapid entry
    setTimeout(() => newItemRef.current?.focus(), 50)
  }

  const saveTitle = () => {
    if (!titleDraft.trim()) {
      setEditingTitle(false)
      setTitleDraft(checklist.title)
      return
    }
    onUpdate(checklist, items, titleDraft.trim())
    setEditingTitle(false)
  }

  const handleTitleChange = (value: string) => {
    setTitleDraft(value)
    schedule(() => {
      if (value.trim()) {
        onUpdate(checklist, items, value.trim())
      }
    })
  }

  return (
    <div className="flex flex-col">
      {/* Toolbar: title + actions */}
      <div className="px-4 pt-3 pb-2 sm:px-6 sm:pt-4 sm:pb-3 space-y-3">
        {/* Title row */}
        <div className="flex items-start gap-2">
          {editingTitle ? (
            <div className="flex items-center gap-1.5 flex-1 min-w-0">
              <input
                type="text"
                value={titleDraft}
                onChange={(e) => handleTitleChange(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') saveTitle()
                  if (e.key === 'Escape') { setEditingTitle(false); setTitleDraft(checklist.title) }
                }}
                onBlur={saveTitle}
                className="flex-1 min-w-0 rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-semibold focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 outline-none transition-shadow"
                autoFocus
              />
            </div>
          ) : (
            <button
              type="button"
              onClick={() => { setTitleDraft(checklist.title); setEditingTitle(true) }}
              className="flex items-center gap-1.5 min-w-0 group"
            >
              <h3 className="text-sm font-semibold text-gray-800 truncate group-hover:text-brand-700 transition-colors">
                {displayTitle}
              </h3>
              <Pencil className="h-3 w-3 shrink-0 text-gray-400 opacity-0 group-hover:opacity-100 sm:opacity-100 transition-opacity" />
            </button>
          )}

          {/* Action buttons */}
          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              onClick={() => setShowSearch(!showSearch)}
              className={cn(
                'rounded-lg p-2 transition-colors',
                showSearch ? 'bg-brand-50 text-brand-600' : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100 active:bg-gray-200'
              )}
              title="Search items"
            >
              <Search className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={onReset}
              disabled={saving}
              className="rounded-lg p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 active:bg-gray-200 transition-colors"
              title="Reset to defaults"
            >
              <RotateCcw className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={onDelete}
              disabled={saving}
              className="rounded-lg p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 active:bg-red-100 transition-colors"
              title="Delete checklist"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Search bar (collapsible) */}
        {showSearch && (
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Filter items..."
              className="w-full rounded-lg border border-gray-200 bg-gray-50 pl-9 pr-8 py-2 text-sm placeholder:text-gray-400 focus:border-brand-500 focus:bg-white focus:ring-2 focus:ring-brand-500/20 outline-none transition-all"
              autoFocus
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-gray-400 hover:text-gray-600"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        )}

        {/* Progress bar */}
        <div>
          <div className="flex items-center justify-between text-xs mb-1.5">
            <span className={cn('font-medium', allDone ? 'text-green-600' : 'text-gray-600')}>
              {allDone ? 'All complete!' : `${completedCount} of ${items.length} complete`}
            </span>
            <span className={cn('font-semibold', allDone ? 'text-green-600' : 'text-gray-500')}>
              {Math.round(progressPct)}%
            </span>
          </div>
          <div className="h-2 w-full rounded-full bg-gray-100 overflow-hidden">
            <div
              className={cn(
                'h-full rounded-full transition-all duration-500 ease-out',
                allDone ? 'bg-green-500' : 'bg-brand-600'
              )}
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>

        {/* Filter pills */}
        <div className="flex gap-1.5 overflow-x-auto no-tap-highlight">
          {(['all', 'pending', 'done'] as const).map((mode) => {
            const count = mode === 'all' ? items.length : mode === 'pending' ? items.length - completedCount : completedCount
            return (
              <button
                key={mode}
                type="button"
                onClick={() => setFilterMode(mode)}
                className={cn(
                  'shrink-0 rounded-full px-3 py-1 text-xs font-medium transition-colors',
                  filterMode === mode
                    ? 'bg-brand-600 text-white shadow-sm'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200 active:bg-gray-300'
                )}
              >
                {mode === 'all' ? 'All' : mode === 'pending' ? 'To do' : 'Done'} ({count})
              </button>
            )
          })}
        </div>
      </div>

      {/* Checklist items — scrollable */}
      <div className="flex-1 overflow-y-auto overscroll-contain scroll-touch px-2 sm:px-4">
        {filteredItems.length === 0 ? (
          <div className="py-8 text-center">
            <p className="text-sm text-gray-400">
              {searchQuery ? 'No items match your search.' : filterMode === 'done' ? 'No completed items yet.' : 'All items are complete!'}
            </p>
          </div>
        ) : (
          <ul className="space-y-0.5 py-1">
            {filteredItems.map((item) => (
              <ChecklistItemRow
                key={item.id}
                item={item}
                meta={meta}
                editing={editingItemId === item.id}
                editDraft={editDraft}
                saving={saving}
                onToggle={() => toggleItem(item.id)}
                onEdit={() => startEditing(item)}
                onEditChange={setEditDraft}
                onEditSave={saveEdit}
                onEditCancel={() => setEditingItemId(null)}
                onRemove={() => removeItem(item.id)}
              />
            ))}
          </ul>
        )}
      </div>

      {/* Add new item — sticky at bottom */}
      <div className="sticky bottom-0 border-t border-gray-100 bg-white px-3 py-3 sm:px-5 sm:py-3 pb-safe">
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <input
              ref={newItemRef}
              type="text"
              value={newItemLabel}
              onChange={(e) => setNewItemLabel(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addItem()}
              placeholder="Add a new item..."
              className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 sm:py-2 text-sm placeholder:text-gray-400 focus:border-brand-500 focus:bg-white focus:ring-2 focus:ring-brand-500/20 outline-none transition-all"
            />
          </div>
          <button
            type="button"
            onClick={addItem}
            disabled={!newItemLabel.trim() || saving}
            className={cn(
              'flex shrink-0 items-center justify-center rounded-lg px-3 py-2.5 sm:py-2 text-sm font-medium transition-all',
              newItemLabel.trim()
                ? 'bg-brand-600 text-white hover:bg-brand-700 active:bg-brand-800 shadow-sm'
                : 'bg-gray-100 text-gray-400'
            )}
          >
            <Plus className="h-4 w-4 sm:mr-1.5" />
            <span className="hidden sm:inline">Add</span>
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Checklist Item Row ──────────────────────────────────────────────────────

interface ChecklistItemRowProps {
  item: ChecklistItem
  meta: (typeof CHECKLIST_META)[ChecklistType]
  editing: boolean
  editDraft: string
  saving: boolean
  onToggle: () => void
  onEdit: () => void
  onEditChange: (value: string) => void
  onEditSave: () => void
  onEditCancel: () => void
  onRemove: () => void
}

function ChecklistItemRow({
  item,
  editing,
  editDraft,
  saving,
  onToggle,
  onEdit,
  onEditChange,
  onEditSave,
  onEditCancel,
  onRemove,
}: ChecklistItemRowProps) {
  const editInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (editing) editInputRef.current?.focus()
  }, [editing])

  if (editing) {
    return (
      <li className="flex items-center gap-2 rounded-xl bg-brand-50/50 border border-brand-100 px-3 py-2.5 sm:py-2">
        <input
          ref={editInputRef}
          type="text"
          value={editDraft}
          onChange={(e) => onEditChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') onEditSave()
            if (e.key === 'Escape') onEditCancel()
          }}
          onBlur={onEditSave}
          className="flex-1 min-w-0 rounded-lg border border-brand-200 bg-white px-3 py-1.5 text-sm focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 outline-none transition-shadow"
        />
        <button type="button" onClick={onEditSave} className="shrink-0 rounded-lg p-2 text-green-600 hover:bg-green-50 active:bg-green-100">
          <Check className="h-4 w-4" />
        </button>
        <button type="button" onClick={onEditCancel} className="shrink-0 rounded-lg p-2 text-gray-400 hover:bg-gray-100 active:bg-gray-200">
          <X className="h-4 w-4" />
        </button>
      </li>
    )
  }

  return (
    <li
      className={cn(
        'group flex items-start gap-3 rounded-xl px-3 py-2.5 sm:py-2 transition-colors',
        'hover:bg-gray-50 active:bg-gray-100'
      )}
    >
      {/* Checkbox — large touch target on mobile */}
      <button
        type="button"
        onClick={onToggle}
        disabled={saving}
        className="mt-0.5 shrink-0 touch-manipulation"
        aria-label={item.checked ? 'Mark as incomplete' : 'Mark as complete'}
      >
        {item.checked ? (
          <CircleCheckBig className="h-5 w-5 text-green-500 transition-colors" />
        ) : (
          <Circle className="h-5 w-5 text-gray-300 group-hover:text-gray-400 transition-colors" />
        )}
      </button>

      {/* Label — tap to edit on mobile */}
      <button
        type="button"
        onClick={onEdit}
        className={cn(
          'flex-1 min-w-0 text-left text-sm leading-relaxed transition-colors',
          item.checked ? 'text-gray-400 line-through' : 'text-gray-700'
        )}
      >
        {item.label}
      </button>

      {/* Desktop hover actions */}
      <div className="hidden sm:flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
        <button
          type="button"
          onClick={onEdit}
          className="rounded-lg p-1.5 text-gray-400 hover:text-brand-600 hover:bg-brand-50 transition-colors"
          title="Edit item"
        >
          <Pencil className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onClick={onRemove}
          className="rounded-lg p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
          title="Remove item"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Mobile: swipe-hint delete (visible via long-press context or always-visible) */}
      <button
        type="button"
        onClick={onRemove}
        className="sm:hidden shrink-0 rounded-lg p-2 -mr-1 text-gray-300 active:text-red-500 active:bg-red-50 transition-colors"
        aria-label="Remove item"
      >
        <X className="h-4 w-4" />
      </button>
    </li>
  )
}
