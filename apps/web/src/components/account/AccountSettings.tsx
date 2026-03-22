'use client'

import { useEffect, useState } from 'react'
import type { User } from '@coverguard/shared'
import { getMe, updateMe } from '@/lib/api'
import { createClient } from '@/lib/supabase/client'
import { Settings, Shield, FileText, Trash2, Edit2, Check, X, Loader2 } from 'lucide-react'

export function AccountSettings() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [deleteConfirm, setDeleteConfirm] = useState(false)
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const [form, setForm] = useState({ firstName: '', lastName: '', company: '', licenseNumber: '' })

  useEffect(() => {
    getMe()
      .then((u) => {
        setUser(u)
        setForm({
          firstName: u.firstName ?? '',
          lastName: u.lastName ?? '',
          company: u.company ?? '',
          licenseNumber: u.licenseNumber ?? '',
        })
      })
      .catch(() => null)
      .finally(() => setLoading(false))
  }, [])

  async function handleSignOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    window.location.href = '/login'
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setSaveError(null)
    try {
      const updated = await updateMe({
        firstName: form.firstName || undefined,
        lastName: form.lastName || undefined,
        company: form.company || undefined,
        licenseNumber: form.licenseNumber || undefined,
      })
      setUser(updated)
      setEditing(false)
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  function handleCancel() {
    setEditing(false)
    setSaveError(null)
    setForm({
      firstName: user?.firstName ?? '',
      lastName: user?.lastName ?? '',
      company: user?.company ?? '',
      licenseNumber: user?.licenseNumber ?? '',
    })
  }

  const displayName =
    user?.firstName && user?.lastName
      ? `${user.firstName} ${user.lastName}`
      : user?.email?.split('@')[0] ?? 'User'

  return (
    <div className="p-8 max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-2 mb-8">
        <Settings className="h-6 w-6 text-gray-700" />
        <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
      </div>

      <div className="space-y-4">
        {/* Account card */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-gray-800">Account</h2>
            {!loading && !editing && (
              <button
                onClick={() => setEditing(true)}
                className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-700 border border-gray-200 px-2.5 py-1.5 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <Edit2 className="h-3 w-3" />
                Edit Profile
              </button>
            )}
          </div>
          {loading ? (
            <div className="space-y-3">
              <div className="h-8 rounded bg-gray-100 animate-pulse" />
              <div className="h-8 rounded bg-gray-100 animate-pulse" />
            </div>
          ) : editing ? (
            <form onSubmit={handleSave} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-gray-500 block mb-1">First Name</label>
                  <input
                    value={form.firstName}
                    onChange={(e) => setForm({ ...form, firstName: e.target.value })}
                    className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-400"
                    placeholder="First name"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-500 block mb-1">Last Name</label>
                  <input
                    value={form.lastName}
                    onChange={(e) => setForm({ ...form, lastName: e.target.value })}
                    className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-400"
                    placeholder="Last name"
                  />
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500 block mb-1">Email</label>
                <p className="text-sm text-gray-500 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">{user?.email}</p>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500 block mb-1">Company / Brokerage</label>
                <input
                  value={form.company}
                  onChange={(e) => setForm({ ...form, company: e.target.value })}
                  className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-400"
                  placeholder="e.g. Keller Williams Realty"
                />
              </div>
              {(user?.role === 'AGENT' || user?.role === 'LENDER') && (
                <div>
                  <label className="text-xs font-medium text-gray-500 block mb-1">License Number</label>
                  <input
                    value={form.licenseNumber}
                    onChange={(e) => setForm({ ...form, licenseNumber: e.target.value })}
                    className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-400"
                    placeholder="e.g. DRE 01234567"
                  />
                </div>
              )}
              {saveError && (
                <div className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
                  {saveError}
                </div>
              )}
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleCancel}
                  className="flex items-center gap-1.5 text-sm font-medium text-gray-600 border border-gray-200 px-4 py-2 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <X className="h-3.5 w-3.5" />
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex items-center gap-1.5 text-sm font-semibold bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white px-4 py-2 rounded-lg transition-colors"
                >
                  {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                  {saving ? 'Saving…' : 'Save Changes'}
                </button>
              </div>
            </form>
          ) : (
            <div className="space-y-4">
              {saved && (
                <div className="flex items-center gap-2 text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
                  <Check className="h-4 w-4" />
                  Profile updated successfully
                </div>
              )}
              <div>
                <p className="text-xs text-gray-400 font-medium mb-0.5">Email</p>
                <p className="text-sm text-gray-800">{user?.email ?? '—'}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400 font-medium mb-0.5">Name</p>
                <p className="text-sm text-gray-800">{displayName}</p>
              </div>
              {user?.company && (
                <div>
                  <p className="text-xs text-gray-400 font-medium mb-0.5">Company</p>
                  <p className="text-sm text-gray-800">{user.company}</p>
                </div>
              )}
              {user?.licenseNumber && (
                <div>
                  <p className="text-xs text-gray-400 font-medium mb-0.5">License Number</p>
                  <p className="text-sm text-gray-800">{user.licenseNumber}</p>
                </div>
              )}
              {user?.role && (
                <div>
                  <p className="text-xs text-gray-400 font-medium mb-0.5">Role</p>
                  <p className="text-sm text-gray-800 capitalize">
                    {user.role.toLowerCase()}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Legal & Privacy card */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-sm font-semibold text-gray-800 mb-4">
            Legal &amp; Privacy
          </h2>
          <div className="space-y-3">
            <LegalLink
              icon={<Shield className="h-4 w-4 text-emerald-500" />}
              label="Privacy Policy"
            />
            <LegalLink
              icon={<FileText className="h-4 w-4 text-blue-500" />}
              label="Terms of Service"
            />
            <LegalLink
              icon={<Trash2 className="h-4 w-4 text-gray-400" />}
              label="Request Data Deletion"
            />
          </div>
        </div>

        {/* Sign out */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-sm font-semibold text-gray-800 mb-4">Session</h2>
          <button
            onClick={handleSignOut}
            className="text-sm font-medium text-gray-600 border border-gray-200 px-4 py-2 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Sign out
          </button>
        </div>

        {/* Danger Zone */}
        <div className="bg-red-50 rounded-xl border border-red-100 p-6">
          <h2 className="text-sm font-semibold text-red-600 mb-4">Danger Zone</h2>
          {deleteConfirm ? (
            <div className="space-y-3">
              <p className="text-sm text-red-700">
                Are you sure? This action cannot be undone.
              </p>
              <div className="flex gap-2">
                <button className="bg-red-600 hover:bg-red-700 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors">
                  Yes, delete my account
                </button>
                <button
                  onClick={() => setDeleteConfirm(false)}
                  className="text-sm font-medium text-gray-600 border border-gray-200 px-4 py-2 rounded-lg hover:bg-white transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setDeleteConfirm(true)}
              className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors"
            >
              <Trash2 className="h-4 w-4" />
              Delete Account
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

function LegalLink({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <button className="flex items-center gap-2.5 text-sm text-blue-600 hover:underline w-full text-left">
      {icon}
      {label}
    </button>
  )
}
