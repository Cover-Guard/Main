'use client'

import { useState, useEffect, useMemo } from 'react'
import { Plus, User, Mail, Phone, Trash2, ChevronDown, ChevronUp, Pencil, Search, X, Check, AlertTriangle } from 'lucide-react'
import type { Client, ClientStatus } from '@coverguard/shared'
import { getClients, createClient2, updateClient, deleteClient } from '@/lib/api'

const STATUS_COLORS: Record<ClientStatus, string> = {
  ACTIVE:   'bg-green-100 text-green-700',
  PROSPECT: 'bg-blue-100 text-blue-700',
  CLOSED:   'bg-gray-100 text-gray-600',
  INACTIVE: 'bg-yellow-100 text-yellow-700',
}

const STATUS_LABELS: Record<ClientStatus, string> = {
  ACTIVE:   'Active',
  PROSPECT: 'Prospect',
  CLOSED:   'Closed',
  INACTIVE: 'Inactive',
}

const ALL_STATUSES: ClientStatus[] = ['ACTIVE', 'PROSPECT', 'CLOSED', 'INACTIVE']

type FilterStatus = 'ALL' | ClientStatus

const emptyForm = { firstName: '', lastName: '', email: '', phone: '', notes: '' }

interface EditForm {
  firstName: string
  lastName: string
  email: string
  phone: string
  notes: string
  status: ClientStatus
}

export function ClientsPanel() {
  const [clients, setClients] = useState<Client[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  // Add form
  const [showAddForm, setShowAddForm] = useState(false)
  const [addForm, setAddForm] = useState(emptyForm)
  const [addSaving, setAddSaving] = useState(false)
  const [addError, setAddError] = useState<string | null>(null)

  // Edit
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState<EditForm | null>(null)
  const [editSaving, setEditSaving] = useState(false)
  const [editError, setEditError] = useState<string | null>(null)

  // Expand notes
  const [expandedId, setExpandedId] = useState<string | null>(null)

  // Filter / search
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('ALL')

  // Action errors (status change, delete)
  const [actionError, setActionError] = useState<string | null>(null)

  useEffect(() => {
    getClients()
      .then(setClients)
      .catch((err) => setLoadError(err instanceof Error ? err.message : 'Failed to load clients'))
      .finally(() => setLoading(false))
  }, [])

  // ── Stats ─────────────────────────────────────────────────────────────────

  const stats = useMemo(() => {
    const counts: Record<ClientStatus, number> = { ACTIVE: 0, PROSPECT: 0, CLOSED: 0, INACTIVE: 0 }
    for (const c of clients) counts[c.status] = (counts[c.status] ?? 0) + 1
    return counts
  }, [clients])

  // ── Filtered list ──────────────────────────────────────────────────────────

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return clients.filter((c) => {
      if (filterStatus !== 'ALL' && c.status !== filterStatus) return false
      if (q) {
        const name = `${c.firstName} ${c.lastName}`.toLowerCase()
        if (!name.includes(q) && !c.email.toLowerCase().includes(q)) return false
      }
      return true
    })
  }, [clients, search, filterStatus])

  // ── Add ────────────────────────────────────────────────────────────────────

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    if (!addForm.firstName || !addForm.lastName || !addForm.email) return
    setAddSaving(true)
    setAddError(null)
    try {
      const client = await createClient2({
        firstName: addForm.firstName,
        lastName: addForm.lastName,
        email: addForm.email,
        phone: addForm.phone || undefined,
        notes: addForm.notes || undefined,
      })
      setClients((prev) => [client, ...prev])
      setAddForm(emptyForm)
      setShowAddForm(false)
    } catch (err) {
      setAddError(err instanceof Error ? err.message : 'Failed to add client')
    } finally {
      setAddSaving(false)
    }
  }

  // ── Edit ───────────────────────────────────────────────────────────────────

  function startEdit(client: Client) {
    setEditingId(client.id)
    setEditForm({
      firstName: client.firstName,
      lastName: client.lastName,
      email: client.email,
      phone: client.phone ?? '',
      notes: client.notes ?? '',
      status: client.status,
    })
    setEditError(null)
  }

  function cancelEdit() {
    setEditingId(null)
    setEditForm(null)
    setEditError(null)
  }

  async function handleSaveEdit(id: string) {
    if (!editForm) return

    // Basic client-side validation to avoid server-side validation errors
    const trimmedFirstName = editForm.firstName ? editForm.firstName.trim() : ''
    const trimmedLastName = editForm.lastName ? editForm.lastName.trim() : ''
    const trimmedEmail = editForm.email ? editForm.email.trim() : ''

    if (!trimmedFirstName) {
      setEditError('First name is required.')
      return
    }

    if (!trimmedLastName) {
      setEditError('Last name is required.')
      return
    }

    if (!trimmedEmail) {
      setEditError('Email is required.')
      return
    }

    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailPattern.test(trimmedEmail)) {
      setEditError('Please enter a valid email address.')
      return
    }

    setEditSaving(true)
    setEditError(null)
    try {
      const updated = await updateClient(id, {
        firstName: trimmedFirstName,
        lastName: trimmedLastName,
        email: trimmedEmail,
        phone: editForm.phone,
        notes: editForm.notes,
        status: editForm.status,
      })
      setClients((prev) => prev.map((c) => (c.id === id ? updated : c)))
      setEditingId(null)
      setEditForm(null)
    } catch (err) {
      setEditError(err instanceof Error ? err.message : 'Failed to save')
    } finally {
      setEditSaving(false)
    }
  }

  // ── Status quick-change (outside edit mode) ────────────────────────────────

  async function handleStatusChange(id: string, status: ClientStatus) {
    setActionError(null)
    try {
      const updated = await updateClient(id, { status })
      setClients((prev) => prev.map((c) => (c.id === id ? updated : c)))
      setActionError(null)
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to update status')
    }
  }

  // ── Delete ─────────────────────────────────────────────────────────────────

  async function handleDelete(id: string) {
    if (!confirm('Remove this client?')) return
    setActionError(null)
    try {
      await deleteClient(id)
      setClients((prev) => prev.filter((c) => c.id !== id))
      if (expandedId === id) setExpandedId(null)
      if (editingId === id) cancelEdit()
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to delete client')
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-5">

      {/* ── Action error banner ───────────────────────────────────────────── */}
      {actionError && (
        <div className="flex items-center justify-between rounded bg-red-50 px-4 py-2.5 text-sm text-red-700">
          <span>{actionError}</span>
          <button
            onClick={() => setActionError(null)}
            className="ml-4 shrink-0 text-red-400 hover:text-red-600"
            aria-label="Dismiss error"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* ── Stats row ─────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {ALL_STATUSES.map((s) => (
          <button
            key={s}
            onClick={() => setFilterStatus(filterStatus === s ? 'ALL' : s)}
            className={`rounded-xl border p-4 text-left transition-colors ${
              filterStatus === s
                ? 'border-brand-400 bg-brand-50 ring-1 ring-brand-300'
                : 'border-gray-200 bg-white hover:bg-gray-50'
            }`}
          >
            <p className="text-2xl font-bold text-gray-900">{loading ? '—' : stats[s]}</p>
            <p className={`mt-0.5 text-xs font-semibold px-2 py-0.5 rounded-full w-fit ${STATUS_COLORS[s]}`}>
              {STATUS_LABELS[s]}
            </p>
          </button>
        ))}
      </div>

      {/* ── Toolbar ───────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
        {/* Search */}
        <div className="relative flex-1 w-full">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search by name or email…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input pl-9 pr-8 w-full"
          />
          {search && (
            <button
              type="button"
              aria-label="Clear search"
              onClick={() => setSearch('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Filter tabs */}
        <div className="flex items-center gap-1 rounded-lg border border-gray-200 bg-white p-1 shrink-0">
          {(['ALL', ...ALL_STATUSES] as FilterStatus[]).map((s) => (
            <button
              key={s}
              onClick={() => setFilterStatus(s)}
              className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
                filterStatus === s
                  ? 'bg-gray-900 text-white'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {s === 'ALL' ? 'All' : STATUS_LABELS[s]}
            </button>
          ))}
        </div>

        <button
          onClick={() => { setShowAddForm((v) => !v); if (showAddForm) { setAddForm(emptyForm); } setAddError(null) }}
          className="btn-primary flex items-center gap-2 px-4 py-2 shrink-0"
        >
          <Plus className="h-4 w-4" />
          Add Client
        </button>
      </div>

      {/* ── Add form ──────────────────────────────────────────────────────── */}
      {showAddForm && (
        <div className="card p-5">
          <h3 className="mb-4 font-semibold text-gray-900">New Client</h3>
          {addError && (
            <div className="mb-3 rounded bg-red-50 p-3 text-sm text-red-700">{addError}</div>
          )}
          <form onSubmit={handleAdd} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label text-xs">First name *</label>
                <input
                  required
                  className="input mt-0.5"
                  value={addForm.firstName}
                  onChange={(e) => setAddForm({ ...addForm, firstName: e.target.value })}
                />
              </div>
              <div>
                <label className="label text-xs">Last name *</label>
                <input
                  required
                  className="input mt-0.5"
                  value={addForm.lastName}
                  onChange={(e) => setAddForm({ ...addForm, lastName: e.target.value })}
                />
              </div>
            </div>
            <div>
              <label className="label text-xs">Email *</label>
              <input
                required
                type="email"
                className="input mt-0.5"
                value={addForm.email}
                onChange={(e) => setAddForm({ ...addForm, email: e.target.value })}
              />
            </div>
            <div>
              <label className="label text-xs">Phone (optional)</label>
              <input
                type="tel"
                className="input mt-0.5"
                value={addForm.phone}
                onChange={(e) => setAddForm({ ...addForm, phone: e.target.value })}
              />
            </div>
            <div>
              <label className="label text-xs">Notes (optional)</label>
              <textarea
                rows={2}
                className="input mt-0.5 resize-none"
                value={addForm.notes}
                onChange={(e) => setAddForm({ ...addForm, notes: e.target.value })}
              />
            </div>
            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={() => { setShowAddForm(false); setAddForm(emptyForm); setAddError(null) }}
                className="btn-secondary px-4 py-2 text-sm"
              >
                Cancel
              </button>
              <button type="submit" disabled={addSaving} className="btn-primary px-4 py-2 text-sm">
                {addSaving ? 'Adding…' : 'Add Client'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ── Client list ───────────────────────────────────────────────────── */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="card h-20 animate-pulse bg-gray-100" />
          ))}
        </div>
      ) : loadError ? (
        <div className="card p-8 text-center">
          <AlertTriangle className="mx-auto mb-2 h-8 w-8 text-red-400" />
          <p className="font-medium text-red-600">Could not load clients</p>
          <p className="mt-1 text-sm text-gray-400">{loadError}</p>
        </div>
      ) : clients.length === 0 ? (
        <div className="card p-10 text-center text-gray-400">
          <User className="mx-auto mb-3 h-10 w-10 opacity-30" />
          <p className="font-medium">No clients yet</p>
          <p className="mt-1 text-sm">Add your first client to start tracking their property searches.</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="card p-10 text-center text-gray-400">
          <Search className="mx-auto mb-3 h-8 w-8 opacity-30" />
          <p className="font-medium">No clients match</p>
          <p className="mt-1 text-sm">Try adjusting your search or filter.</p>
          <button
            onClick={() => { setSearch(''); setFilterStatus('ALL') }}
            className="mt-3 text-sm text-brand-600 hover:underline"
          >
            Clear filters
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((client) => {
            const isEditing = editingId === client.id
            const isExpanded = expandedId === client.id
            const initials = `${client.firstName[0]}${client.lastName[0]}`

            if (isEditing && editForm) {
              return (
                <div key={client.id} className="card p-5">
                  <h4 className="mb-3 font-semibold text-gray-900 text-sm">Edit Client</h4>
                  {editError && (
                    <div className="mb-3 rounded bg-red-50 p-3 text-sm text-red-700">{editError}</div>
                  )}
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="label text-xs">First name</label>
                        <input
                          className="input mt-0.5"
                          value={editForm.firstName}
                          onChange={(e) => setEditForm({ ...editForm, firstName: e.target.value })}
                        />
                      </div>
                      <div>
                        <label className="label text-xs">Last name</label>
                        <input
                          className="input mt-0.5"
                          value={editForm.lastName}
                          onChange={(e) => setEditForm({ ...editForm, lastName: e.target.value })}
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="label text-xs">Email</label>
                        <input
                          type="email"
                          className="input mt-0.5"
                          value={editForm.email}
                          onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                        />
                      </div>
                      <div>
                        <label className="label text-xs">Phone</label>
                        <input
                          type="tel"
                          className="input mt-0.5"
                          value={editForm.phone}
                          onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="label text-xs">Status</label>
                        <select
                          className="input mt-0.5"
                          value={editForm.status}
                          onChange={(e) => setEditForm({ ...editForm, status: e.target.value as ClientStatus })}
                        >
                          {ALL_STATUSES.map((s) => (
                            <option key={s} value={s}>{STATUS_LABELS[s]}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                    <div>
                      <label className="label text-xs">Notes</label>
                      <textarea
                        rows={3}
                        className="input mt-0.5 resize-none"
                        value={editForm.notes}
                        onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
                        placeholder="Add notes about this client…"
                      />
                    </div>
                    <div className="flex gap-2 pt-1">
                      <button
                        type="button"
                        onClick={cancelEdit}
                        className="btn-secondary px-4 py-2 text-sm"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        disabled={editSaving}
                        onClick={() => handleSaveEdit(client.id)}
                        className="btn-primary px-4 py-2 text-sm flex items-center gap-1.5"
                      >
                        <Check className="h-4 w-4" />
                        {editSaving ? 'Saving…' : 'Save Changes'}
                      </button>
                    </div>
                  </div>
                </div>
              )
            }

            return (
              <div key={client.id} className="card overflow-hidden">
                {/* Main row */}
                <div className="flex items-center gap-4 px-5 py-4">
                  {/* Avatar */}
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-100 text-brand-700 font-semibold text-sm">
                    {initials}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-900 truncate">
                      {client.firstName} {client.lastName}
                    </p>
                    <div className="flex flex-wrap items-center gap-3 mt-0.5">
                      <span className="flex items-center gap-1 text-xs text-gray-500">
                        <Mail className="h-3 w-3 shrink-0" />
                        {client.email}
                      </span>
                      {client.phone && (
                        <span className="flex items-center gap-1 text-xs text-gray-500">
                          <Phone className="h-3 w-3 shrink-0" />
                          {client.phone}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex shrink-0 items-center gap-2">
                    <select
                      value={client.status}
                      onChange={(e) => handleStatusChange(client.id, e.target.value as ClientStatus)}
                      className={`rounded-full border-0 px-3 py-1 text-xs font-medium cursor-pointer focus:ring-1 focus:ring-brand-400 ${STATUS_COLORS[client.status]}`}
                    >
                      {ALL_STATUSES.map((s) => (
                        <option key={s} value={s}>{STATUS_LABELS[s]}</option>
                      ))}
                    </select>

                    <button
                      onClick={() => startEdit(client)}
                      className="btn-ghost p-1.5 text-gray-400 hover:text-brand-600"
                      title="Edit client"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>

                    <button
                      onClick={() => setExpandedId(isExpanded ? null : client.id)}
                      className="btn-ghost p-1.5 text-gray-400 hover:text-gray-600"
                      title={isExpanded ? 'Collapse' : 'Expand notes'}
                    >
                      {isExpanded ? (
                        <ChevronUp className="h-4 w-4" />
                      ) : (
                        <ChevronDown className="h-4 w-4" />
                      )}
                    </button>

                    <button
                      onClick={() => handleDelete(client.id)}
                      className="btn-ghost p-1.5 text-gray-400 hover:text-red-500"
                      title="Delete client"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                {/* Expanded notes */}
                {isExpanded && (
                  <div className="border-t border-gray-100 px-5 py-3 bg-gray-50">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-gray-500 mb-1">Notes</p>
                        {client.notes ? (
                          <p className="text-sm text-gray-700 whitespace-pre-wrap">{client.notes}</p>
                        ) : (
                          <p className="text-sm text-gray-400 italic">No notes added.</p>
                        )}
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="text-xs text-gray-400">
                          Added {new Date(client.createdAt).toLocaleDateString('en-US', {
                            month: 'short', day: 'numeric', year: 'numeric',
                          })}
                        </p>
                        {client.savedPropertyCount !== undefined && (
                          <p className="text-xs text-gray-500 mt-1">
                            {client.savedPropertyCount} saved {client.savedPropertyCount === 1 ? 'property' : 'properties'}
                          </p>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={() => startEdit(client)}
                      className="mt-2 text-xs text-brand-600 hover:underline flex items-center gap-1"
                    >
                      <Pencil className="h-3 w-3" />
                      Edit notes
                    </button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Result count */}
      {!loading && clients.length > 0 && (
        <p className="text-xs text-gray-400 text-center">
          {filtered.length === clients.length
            ? `${clients.length} client${clients.length !== 1 ? 's' : ''}`
            : `${filtered.length} of ${clients.length} clients`}
        </p>
      )}
    </div>
  )
}
