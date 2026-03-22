'use client'

import { useEffect, useState } from 'react'
import type { User } from '@coverguard/shared'
import { getMe, updateMe } from '@/lib/api'
import { createClient } from '@/lib/supabase/client'
import {
  Settings, Shield, FileText, Trash2, Edit2, Check, X, Loader2,
  LogOut, Eye, EyeOff, Save,
} from 'lucide-react'

function LegalLink({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <button className="flex items-center gap-3 w-full text-left px-3 py-2.5 rounded-lg hover:bg-gray-50 transition-colors group">
      {icon}
      <span className="text-sm text-gray-700 group-hover:text-gray-900">{label}</span>
    </button>
  )
}

export function AccountSettings() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [deleteConfirm, setDeleteConfirm] = useState(false)
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const [form, setForm] = useState({ firstName: '', lastName: '', company: '', licenseNumber: '' })

  // Password change
  const [pwSectionOpen, setPwSectionOpen] = useState(false)
  const [newPw, setNewPw] = useState('')
  const [confirmPw, setConfirmPw] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [pwSaving, setPwSaving] = useState(false)
  const [pwError, setPwError] = useState<string | null>(null)
  const [pwSaved, setPwSaved] = useState(false)

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

  async function handlePasswordChange(e: React.FormEvent) {
    e.preventDefault()
    if (newPw !== confirmPw) { setPwError('Passwords do not match.'); return }
    if (newPw.length < 8) { setPwError('Password must be at least 8 characters.'); return }
    setPwSaving(true)
    setPwError(null)
    try {
      const supabase = createClient()
      const { error } = await supabase.auth.updateUser({ password: newPw })
      if (error) throw error
      setPwSaved(true)
      setNewPw(''); setConfirmPw('')
      setTimeout(() => { setPwSaved(false); setPwSectionOpen(false) }, 2500)
    } catch (err) {
      setPwError(err instanceof Error ? err.message : 'Failed to update password.')
    } finally {
      setPwSaving(false)
    }
  }

  const displayName =
    user?.firstName && user?.lastName
      ? `${user.firstName} ${user.lastName}`
      : user?.email?.split('@')[0] ?? 'User'

  return (
    <div className="p-8 max-w-2xl mx-auto">
      <div className="flex items-center gap-2 mb-8">
        <Settings className="h-6 w-6 text-gray-700" />
        <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
      </div>

      <div className="space-y-4">
        {/* Profile */}
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
                  <input value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-400" placeholder="First name" />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-500 block mb-1">Last Name</label>
                  <input value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-400" placeholder="Last name" />
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500 block mb-1">Email</label>
                <p className="text-sm text-gray-500 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">{user?.email}</p>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500 block mb-1">Company / Brokerage</label>
                <input value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-400" placeholder="e.g. Keller Williams Realty" />
              </div>
              {(user?.role === 'AGENT' || user?.role === 'LENDER') && (
                <div>
                  <label className="text-xs font-medium text-gray-500 block mb-1">License Number</label>
                  <input value={form.licenseNumber} onChange={(e) => setForm({ ...form, licenseNumber: e.target.value })} className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-400" placeholder="e.g. DRE 01234567" />
                </div>
              )}
              {saveError && <div className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{saveError}</div>}
              <div className="flex gap-2">
                <button type="button" onClick={handleCancel} className="flex items-center gap-1.5 text-sm font-medium text-gray-600 border border-gray-200 px-4 py-2 rounded-lg hover:bg-gray-50 transition-colors">
                  <X className="h-3.5 w-3.5" /> Cancel
                </button>
                <button type="submit" disabled={saving} className="flex items-center gap-1.5 text-sm font-semibold bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white px-4 py-2 rounded-lg transition-colors">
                  {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                  {saving ? 'Saving…' : 'Save Changes'}
                </button>
              </div>
            </form>
          ) : (
            <div className="space-y-4">
              {saved && (
                <div className="flex items-center gap-2 text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
                  <Check className="h-4 w-4" /> Profile updated successfully
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
                  <p className="text-sm text-gray-800 capitalize">{user.role.toLowerCase()}</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Password Change */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <button
            onClick={() => setPwSectionOpen((o) => !o)}
            className="w-full flex items-center justify-between px-6 py-4 hover:bg-gray-50 transition-colors text-left"
          >
            <div>
              <p className="text-sm font-semibold text-gray-800">Change Password</p>
              <p className="text-xs text-gray-400 mt-0.5">Update your account password</p>
            </div>
            <span className="text-xs text-blue-600 font-medium">{pwSectionOpen ? 'Cancel' : 'Change'}</span>
          </button>
          {pwSectionOpen && (
            <form onSubmit={handlePasswordChange} className="px-6 pb-6 border-t border-gray-100 pt-4 space-y-3">
              <div>
                <label className="text-xs font-medium text-gray-500 block mb-1">New Password</label>
                <div className="relative">
                  <input type={showPw ? 'text' : 'password'} value={newPw} onChange={(e) => setNewPw(e.target.value)} required minLength={8} className="w-full pr-10 text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-400" placeholder="Min. 8 characters" />
                  <button type="button" onClick={() => setShowPw((s) => !s)} className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600">
                    {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500 block mb-1">Confirm Password</label>
                <input type={showPw ? 'text' : 'password'} value={confirmPw} onChange={(e) => setConfirmPw(e.target.value)} required className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-400" placeholder="Re-enter new password" />
              </div>
              {pwError && <p className="text-sm text-red-600">{pwError}</p>}
              {pwSaved && <p className="text-sm text-emerald-600 flex items-center gap-1.5"><Check className="h-4 w-4" /> Password updated!</p>}
              <button type="submit" disabled={pwSaving || !newPw || !confirmPw} className="flex items-center gap-2 bg-[#0d1929] hover:bg-[#162438] text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors disabled:opacity-50">
                {pwSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                {pwSaving ? 'Updating…' : 'Update Password'}
              </button>
            </form>
          )}
        </div>

        {/* Notifications */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-sm font-semibold text-gray-800 mb-1">Notifications</h2>
          <p className="text-xs text-gray-400 mb-4">Email notification preferences</p>
          <div className="space-y-3">
            {[
              { label: 'Risk alerts for saved properties', sublabel: "Get notified when a saved property's risk score changes significantly" },
              { label: 'New carrier availability', sublabel: "When a new carrier starts writing in your saved properties' states" },
              { label: 'Quote request updates', sublabel: 'When carriers respond to your binding quote requests' },
            ].map(({ label, sublabel }) => (
              <label key={label} className="flex items-start gap-3 cursor-pointer">
                <input type="checkbox" defaultChecked className="mt-0.5 accent-emerald-500" />
                <div>
                  <p className="text-sm text-gray-700">{label}</p>
                  <p className="text-xs text-gray-400">{sublabel}</p>
                </div>
              </label>
            ))}
          </div>
        </div>

        {/* Legal & Privacy */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-sm font-semibold text-gray-800 mb-4">Legal &amp; Privacy</h2>
          <div className="space-y-1">
            <LegalLink icon={<Shield className="h-4 w-4 text-emerald-500" />} label="Privacy Policy" />
            <LegalLink icon={<FileText className="h-4 w-4 text-blue-500" />} label="Terms of Service" />
            <LegalLink icon={<Trash2 className="h-4 w-4 text-gray-400" />} label="Request Data Deletion" />
          </div>
        </div>

        {/* Session */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-sm font-semibold text-gray-800 mb-4">Session</h2>
          <div className="flex items-center gap-3">
            <button onClick={handleSignOut} className="flex items-center gap-2 text-sm font-medium text-gray-600 border border-gray-200 px-4 py-2 rounded-lg hover:bg-gray-50 transition-colors">
              <LogOut className="h-4 w-4" /> Sign Out
            </button>
            {!deleteConfirm ? (
              <button onClick={() => setDeleteConfirm(true)} className="text-sm font-medium text-red-500 hover:text-red-600 border border-red-200 px-4 py-2 rounded-lg hover:bg-red-50 transition-colors">
                Delete Account
              </button>
            ) : (
              <div className="flex items-center gap-2">
                <span className="text-xs text-red-600 font-medium">Are you sure?</span>
                <button onClick={() => setDeleteConfirm(false)} className="text-xs text-gray-500 border border-gray-200 px-3 py-1.5 rounded-lg hover:bg-gray-50">Cancel</button>
                <button className="text-xs text-white bg-red-500 hover:bg-red-600 px-3 py-1.5 rounded-lg">Yes, delete</button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
