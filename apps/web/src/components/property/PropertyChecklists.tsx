'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  ClipboardCheck,
  Plus,
  Trash2,
  Pencil,
  Check,
  X,
  ChevronDown,
  ChevronUp,
  GripVertical,
} from 'lucide-react'
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

const CHECKLIST_LABELS: Record<ChecklistType, string> = {
  INSPECTION: 'Inspection',
  NEW_BUYER: 'New Buyer',
  AGENT: 'Agent',
}

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

// ─── Component ───────────────────────────────────────────────────────────────

interface PropertyChecklistsProps {
  propertyId: string
}

export function PropertyChecklists({ propertyId }: PropertyChecklistsProps) {
  const [checklists, setChecklists] = useState<PropertyChecklist[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [expandedType, setExpandedType] = useState<ChecklistType | null>(null)
  const [saving, setSaving] = useState(false)

  const fetchChecklists = useCallback(async () => {
    try {
      const data = await getPropertyChecklists(propertyId)
      setChecklists(data)
      setError(null)
    } catch {
      // User may not be logged in — show create prompts instead
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
      setExpandedType(type)
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
      if (expandedType === type) setExpandedType(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete checklist')
    } finally {
      setSaving(false)
    }
  }

  const handleUpdate = async (checklist: PropertyChecklist, items: ChecklistItem[], title?: string) => {
    setSaving(true)
    try {
      const updated = await updatePropertyChecklist(propertyId, checklist.id, {
        ...(title !== undefined ? { title } : {}),
        items,
      })
      setChecklists((prev) => prev.map((c) => (c.id === updated.id ? updated : c)))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update checklist')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="card p-6">
        <div className="flex items-center gap-2 mb-4">
          <ClipboardCheck className="h-5 w-5 text-brand-600" />
          <h2 className="text-lg font-semibold text-gray-900">Report Checklists</h2>
        </div>
        <div className="animate-pulse space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-12 rounded-lg bg-gray-100" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="card p-6">
      <div className="flex items-center gap-2 mb-1">
        <ClipboardCheck className="h-5 w-5 text-brand-600" />
        <h2 className="text-lg font-semibold text-gray-900">Report Checklists</h2>
      </div>
      <p className="text-xs text-gray-500 mb-4">
        Create and manage inspection, buyer, and agent checklists for this property.
      </p>

      {error && (
        <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-4 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="space-y-3">
        {(['INSPECTION', 'NEW_BUYER', 'AGENT'] as ChecklistType[]).map((type) => {
          const checklist = getChecklist(type)
          const isExpanded = expandedType === type

          return (
            <div key={type} className="rounded-lg border border-gray-200 overflow-hidden">
              {/* Checklist header */}
              <div className="flex items-center justify-between bg-gray-50 px-4 py-3">
                <button
                  type="button"
                  className="flex items-center gap-2 text-sm font-medium text-gray-800 hover:text-brand-700 transition-colors"
                  onClick={() => setExpandedType(isExpanded ? null : type)}
                  disabled={!checklist}
                >
                  {isExpanded ? (
                    <ChevronUp className="h-4 w-4 text-gray-400" />
                  ) : (
                    <ChevronDown className="h-4 w-4 text-gray-400" />
                  )}
                  {CHECKLIST_LABELS[type]} Checklist
                  {checklist && (
                    <span className="ml-2 text-xs text-gray-400">
                      {(checklist.items as ChecklistItem[]).filter((i) => i.checked).length}/
                      {(checklist.items as ChecklistItem[]).length}
                    </span>
                  )}
                </button>
                <div className="flex items-center gap-1">
                  {checklist ? (
                    <button
                      type="button"
                      onClick={() => handleDelete(type)}
                      disabled={saving}
                      className="rounded p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                      title="Delete checklist"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleCreate(type)}
                      disabled={saving}
                      className="flex items-center gap-1 rounded-md bg-brand-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-brand-700 transition-colors disabled:opacity-50"
                    >
                      <Plus className="h-3 w-3" />
                      Create
                    </button>
                  )}
                </div>
              </div>

              {/* Checklist body (expanded) */}
              {checklist && isExpanded && (
                <ChecklistEditor
                  checklist={checklist}
                  onUpdate={handleUpdate}
                  saving={saving}
                />
              )}
            </div>
          )
        })}
      </div>

      {saving && (
        <p className="mt-3 text-xs text-gray-400 text-right">Saving...</p>
      )}
    </div>
  )
}

// ─── Checklist Editor ────────────────────────────────────────────────────────

interface ChecklistEditorProps {
  checklist: PropertyChecklist
  onUpdate: (checklist: PropertyChecklist, items: ChecklistItem[], title?: string) => Promise<void>
  saving: boolean
}

function ChecklistEditor({ checklist, onUpdate, saving }: ChecklistEditorProps) {
  const items = checklist.items as ChecklistItem[]
  const [editingTitle, setEditingTitle] = useState(false)
  const [titleDraft, setTitleDraft] = useState(checklist.title)
  const [editingItemId, setEditingItemId] = useState<string | null>(null)
  const [editDraft, setEditDraft] = useState('')
  const [newItemLabel, setNewItemLabel] = useState('')

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
    if (!editingItemId || !editDraft.trim()) return
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
  }

  const saveTitle = () => {
    if (!titleDraft.trim()) return
    onUpdate(checklist, items, titleDraft.trim())
    setEditingTitle(false)
  }

  const completedCount = items.filter((i) => i.checked).length
  const progressPct = items.length > 0 ? (completedCount / items.length) * 100 : 0

  return (
    <div className="px-4 py-3 space-y-3">
      {/* Editable title */}
      <div className="flex items-center gap-2">
        {editingTitle ? (
          <div className="flex items-center gap-1 flex-1">
            <input
              type="text"
              value={titleDraft}
              onChange={(e) => setTitleDraft(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && saveTitle()}
              className="flex-1 rounded border border-gray-300 px-2 py-1 text-sm focus:border-brand-500 focus:ring-1 focus:ring-brand-500 outline-none"
              autoFocus
            />
            <button type="button" onClick={saveTitle} className="rounded p-1 text-green-600 hover:bg-green-50">
              <Check className="h-3.5 w-3.5" />
            </button>
            <button type="button" onClick={() => setEditingTitle(false)} className="rounded p-1 text-gray-400 hover:bg-gray-100">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => { setTitleDraft(checklist.title); setEditingTitle(true) }}
            className="flex items-center gap-1 text-sm font-semibold text-gray-700 hover:text-brand-700"
          >
            {checklist.title}
            <Pencil className="h-3 w-3 text-gray-400" />
          </button>
        )}
      </div>

      {/* Progress bar */}
      <div>
        <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
          <span>{completedCount} of {items.length} complete</span>
          <span>{Math.round(progressPct)}%</span>
        </div>
        <div className="h-1.5 w-full rounded-full bg-gray-200 overflow-hidden">
          <div
            className="h-full rounded-full bg-brand-600 transition-all duration-300"
            style={{ width: `${progressPct}%` }}
          />
        </div>
      </div>

      {/* Checklist items */}
      <ul className="space-y-1">
        {items.map((item) => (
          <li
            key={item.id}
            className="group flex items-start gap-2 rounded-md px-2 py-1.5 hover:bg-gray-50 transition-colors"
          >
            <GripVertical className="h-4 w-4 mt-0.5 text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
            <input
              type="checkbox"
              checked={item.checked}
              onChange={() => toggleItem(item.id)}
              disabled={saving}
              className="mt-0.5 h-4 w-4 rounded border-gray-300 text-brand-600 focus:ring-brand-500 shrink-0"
            />
            {editingItemId === item.id ? (
              <div className="flex items-center gap-1 flex-1 min-w-0">
                <input
                  type="text"
                  value={editDraft}
                  onChange={(e) => setEditDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') saveEdit()
                    if (e.key === 'Escape') setEditingItemId(null)
                  }}
                  className="flex-1 rounded border border-gray-300 px-2 py-0.5 text-sm focus:border-brand-500 focus:ring-1 focus:ring-brand-500 outline-none"
                  autoFocus
                />
                <button type="button" onClick={saveEdit} className="rounded p-1 text-green-600 hover:bg-green-50">
                  <Check className="h-3 w-3" />
                </button>
                <button type="button" onClick={() => setEditingItemId(null)} className="rounded p-1 text-gray-400 hover:bg-gray-100">
                  <X className="h-3 w-3" />
                </button>
              </div>
            ) : (
              <>
                <span
                  className={`flex-1 text-sm leading-snug ${item.checked ? 'text-gray-400 line-through' : 'text-gray-700'}`}
                >
                  {item.label}
                </span>
                <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                  <button
                    type="button"
                    onClick={() => startEditing(item)}
                    className="rounded p-1 text-gray-400 hover:text-brand-600 hover:bg-brand-50"
                    title="Edit item"
                  >
                    <Pencil className="h-3 w-3" />
                  </button>
                  <button
                    type="button"
                    onClick={() => removeItem(item.id)}
                    className="rounded p-1 text-gray-400 hover:text-red-600 hover:bg-red-50"
                    title="Remove item"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              </>
            )}
          </li>
        ))}
      </ul>

      {/* Add new item */}
      <div className="flex items-center gap-2 pt-1 border-t border-gray-100">
        <input
          type="text"
          value={newItemLabel}
          onChange={(e) => setNewItemLabel(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && addItem()}
          placeholder="Add a new item..."
          className="flex-1 rounded-md border border-gray-200 px-3 py-1.5 text-sm placeholder:text-gray-400 focus:border-brand-500 focus:ring-1 focus:ring-brand-500 outline-none"
        />
        <button
          type="button"
          onClick={addItem}
          disabled={!newItemLabel.trim() || saving}
          className="flex items-center gap-1 rounded-md bg-gray-100 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-200 transition-colors disabled:opacity-50"
        >
          <Plus className="h-3.5 w-3.5" />
          Add
        </button>
      </div>
    </div>
  )
}
