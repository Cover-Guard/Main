'use client'

import { useState, useEffect } from 'react'
import { Plus, User, Mail, Phone, Trash2, Edit2, X, Check } from 'lucide-react'
import type { Client, ClientStatus } from '@coverguard/shared'
import { getClients, createClient2, updateClient, deleteClient } from '@/lib/api'

const STATUS_COLORS: Record<ClientStatus, string> = {
  ACTIVE:   'bg-green-100 text-green-700',
  PROSPECT: 'bg-blue-100 text-blue-700',
  CLOSED:   'bg-gray-100 text-gray-600',
  INACTIVE: 'bg-yellow-100 text-yellow-700',
}

export function ClientsPanel() {
  const [clients, setClients] = useState<Client[]>([])
  const [loading, setLoading] = useState(true)
  const [showAddForm, setShowAddForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState({ firstName: '', lastName: '', email: '', phone: '', notes: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getClients()
      .then(setClients)
      .catch(() => setClients([]))
      .finally(() => setLoading(false))
  }, [])

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    if (!form.firstName || !form.lastName || !form.email) return
    setSaving(true)
    setError(null)
    try {
      const client = await createClient2({
        firstName: form.firstName,
        lastName: form.lastName,
        email: form.email,
        phone: form.phone || undefined,
        notes: form.notes || undefined,
      })
      setClients((prev) => [client, ...prev])
      setForm({ firstName: '', lastName: '', email: '', phone: '', notes: '' })
      setShowAddForm(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add client')
    } finally {
      setSaving(false)
    }
  }

  async function handleStatusChange(id: string, status: ClientStatus) {
    try {
      const updated = await updateClient(id, { status })
      setClients((prev) => prev.map((c) => (c.id === id ? updated : c)))
    } catch {
      // silent
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Remove this client?')) return
    try {
      await deleteClient(id)
      setClients((prev) => prev.filter((c) => c.id !== id))
    } catch {
      // silent
    }
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Clients</h2>
          <p className="text-sm text-gray-500">{clients.length} client{clients.length !== 1 ? 's' : ''}</p>
        </div>
        <button
          onClick={() => setShowAddForm((v) => !v)}
          className="btn-primary flex items-center gap-2 px-4 py-2"
        >
          <Plus className="h-4 w-4" />
          Add Client
        </button>
      </div>

      {/* Add form */}
      {showAddForm && (
        <div className="card p-5">
          <h3 className="mb-4 font-semibold text-gray-900">New Client</h3>
          {error && <div className="mb-3 rounded bg-red-50 p-3 text-sm text-red-700">{error}</div>}
          <form onSubmit={handleAdd} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label text-xs">First name</label>
                <input
                  required
                  className="input mt-0.5"
                  value={form.firstName}
                  onChange={(e) => setForm({ ...form, firstName: e.target.value })}
                />
              </div>
              <div>
                <label className="label text-xs">Last name</label>
                <input
                  required
                  className="input mt-0.5"
                  value={form.lastName}
                  onChange={(e) => setForm({ ...form, lastName: e.target.value })}
                />
              </div>
            </div>
            <div>
              <label className="label text-xs">Email</label>
              <input
                required
                type="email"
                className="input mt-0.5"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
            </div>
            <div>
              <label className="label text-xs">Phone (optional)</label>
              <input
                type="tel"
                className="input mt-0.5"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
              />
            </div>
            <div>
              <label className="label text-xs">Notes (optional)</label>
              <textarea
                rows={2}
                className="input mt-0.5 resize-none"
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
              />
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setShowAddForm(false)}
                className="btn-secondary px-4 py-2 text-sm"
              >
                Cancel
              </button>
              <button type="submit" disabled={saving} className="btn-primary px-4 py-2 text-sm">
                {saving ? 'Adding…' : 'Add Client'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Client list */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="card h-20 animate-pulse bg-gray-100" />
          ))}
        </div>
      ) : clients.length === 0 ? (
        <div className="card p-10 text-center text-gray-400">
          <User className="mx-auto mb-3 h-10 w-10 opacity-30" />
          <p className="font-medium">No clients yet</p>
          <p className="mt-1 text-sm">Add your first client to start tracking their property searches.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {clients.map((client) => (
            <div key={client.id} className="card flex items-center gap-4 px-5 py-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-100 text-brand-700 font-semibold text-sm">
                {client.firstName[0]}{client.lastName[0]}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-gray-900 truncate">
                  {client.firstName} {client.lastName}
                </p>
                <div className="flex flex-wrap items-center gap-3 mt-0.5">
                  <span className="flex items-center gap-1 text-xs text-gray-500">
                    <Mail className="h-3 w-3" />
                    {client.email}
                  </span>
                  {client.phone && (
                    <span className="flex items-center gap-1 text-xs text-gray-500">
                      <Phone className="h-3 w-3" />
                      {client.phone}
                    </span>
                  )}
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <select
                  value={client.status}
                  onChange={(e) => handleStatusChange(client.id, e.target.value as ClientStatus)}
                  className={`rounded-full border-0 px-3 py-1 text-xs font-medium focus:ring-1 focus:ring-brand-400 ${STATUS_COLORS[client.status]}`}
                >
                  <option value="PROSPECT">Prospect</option>
                  <option value="ACTIVE">Active</option>
                  <option value="CLOSED">Closed</option>
                  <option value="INACTIVE">Inactive</option>
                </select>
                <button
                  onClick={() => handleDelete(client.id)}
                  className="btn-ghost p-1.5 text-gray-400 hover:text-red-500"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
