'use client'

import { useEffect, useState } from 'react'
import type { User } from '@coverguard/shared'
import { getMe, updateMe } from '@/lib/api'
import { createClient } from '@/lib/supabase/client'
import { Settings, Shield, FileText, Trash2, Edit2, Check, X, KeyRound, Eye, EyeOff } from 'lucide-react'

export function AccountSettings() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [deleteConfirm, setDeleteConfirm] = useState(false)

  // Profile edit state
  const [editing, setEditing] = useState(false)
  const [editForm, setEditForm] = useState({ firstName: '', lastName: '', company: '', licenseNumber: '' })
  const [savingProfile, setSavingProfile] = useState(false)
  const [profileError, setProfileError] = useState<string | null>(null)
  const [profileSuccess, setProfileSuccess] = useState(false)

  // Password change state
  const [changingPassword, setChangingPassword] = useState(false)
  const [pwForm, setPwForm] = useState({ newPw: '', confirm: '' })
  const [showPw, setShowPw] = useState({ newPw: false, confirm: false })
  const [savingPw, setSavingPw] = useState(false)
  const [pwError, setPwError] = useState<string | null>(null)
  const [pwSuccess, setPwSuccess] = useState(false)

  useEffect(() => {
    getMe()
      .then((u) => {
        setUser(u)
        setEditForm({
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

  async function handleSaveProfile(e: React.FormEvent) {
    e.preventDefault()
    setSavingProfile(true)
    setProfileError(null)
    setProfileSuccess(false)
    try {
      const updated = await updateMe({
        firstName: editForm.firstName,
        lastName: editForm.lastName,
        company: editForm.company || undefined,
        licenseNumber: editForm.licenseNumber || undefined,
      })
      setUser(updated)
      setEditing(false)
      setProfileSuccess(true)
      setTimeout(() => setProfileSuccess(false), 3000)
    } catch (err) {
      setProfileError(err instanceof Error ? err.message : 'Failed to save profile')
    } finally {
      setSavingProfile(false)
    }
  }

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault()
    setPwError(null)
    setPwSuccess(false)
    if (pwForm.newPw !== pwForm.confirm) {
      setPwError('New passwords do not match')
      return
    }
    if (pwForm.newPw.length < 8) {
      setPwError('New password must be at least 8 characters')
      return
    }
    setSavingPw(true)
    try {
      const supabase = createClient()
      const { error } = await supabase.auth.updateUser({ password: pwForm.newPw })
      if (error) throw new Error(error.message)
      setPwForm({ newPw: '', confirm: '' })
      setChangingPassword(false)
      setPwSuccess(true)
      setTimeout(() => setPwSuccess(false), 4000)
    } catch (err) {
      setPwError(err instanceof Error ? err.message : 'Failed to change password')
    } finally {
      setSavingPw(false)
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
        {/* Profile card */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-gray-800">Profile</h2>
            {!editing && !loading && (
              <button
                onClick={() => {
                  setEditing(true)
                  setProfileError(null)
                  setEditForm({
                    firstName: user?.firstName ?? '',
                    lastName: user?.lastName ?? '',
                    company: user?.company ?? '',
                    licenseNumber: user?.licenseNumber ?? '',
                  })
                }}
                className="flex items-center gap-1.5 text-xs font-medium text-blue-600 hover:text-blue-700 border border-blue-200 px-3 py-1.5 rounded-lg hover:bg-blue-50 transition-colors"
              >
                <Edit2 className="h-3.5 w-3.5" />
                Edit
              </button>
            )}
          </div>

          {profileSuccess && (
            <div className="mb-4 rounded-lg bg-green-50 border border-green-200 px-4 py-2 text-sm text-green-700 flex items-center gap-2">
              <Check className="h-4 w-4" />
              Profile updated successfully
            </div>
          )}

          {loading ? (
            <div className="space-y-3">
              <div className="h-8 rounded bg-gray-100 animate-pulse" />
              <div className="h-8 rounded bg-gray-100 animate-pulse" />
            </div>
          ) : editing ? (
            <form onSubmit={handleSaveProfile} className="space-y-4">
              {profileError && (
                <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-2 text-sm text-red-700">{profileError}</div>
              )}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-gray-600 block mb-1">First Name</label>
                  <input
                    required
                    className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400"
                    value={editForm.firstName}
                    onChange={(e) => setEditForm({ ...editForm, firstName: e.target.value })}
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600 block mb-1">Last Name</label>
                  <input
                    required
                    className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400"
                    value={editForm.lastName}
                    onChange={(e) => setEditForm({ ...editForm, lastName: e.target.value })}
                  />
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 block mb-1">Company (optional)</label>
                <input
                  className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400"
                  value={editForm.company}
                  onChange={(e) => setEditForm({ ...editForm, company: e.target.value })}
                />
              </div>
              {(user?.role === 'AGENT' || user?.role === 'LENDER') && (
                <div>
                  <label className="text-xs font-medium text-gray-600 block mb-1">License Number (optional)</label>
                  <input
                    className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400"
                    value={editForm.licenseNumber}
                    onChange={(e) => setEditForm({ ...editForm, licenseNumber: e.target.value })}
                    placeholder="e.g. CA-DRE-01234567"
                  />
                </div>
              )}
              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => { setEditing(false); setProfileError(null) }}
                  className="flex items-center gap-1.5 text-sm font-medium text-gray-600 border border-gray-200 px-4 py-2 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <X className="h-4 w-4" />
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingProfile}
                  className="flex items-center gap-1.5 text-sm font-semibold bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors disabled:opacity-60"
                >
                  <Check className="h-4 w-4" />
                  {savingProfile ? 'Saving…' : 'Save Changes'}
                </button>
              </div>
            </form>
          ) : (
            <div className="space-y-4">
              <ProfileField label="Email" value={user?.email} />
              <ProfileField label="Name" value={displayName} />
              {user?.role && (
                <ProfileField label="Role" value={user.role.charAt(0) + user.role.slice(1).toLowerCase()} />
              )}
              {user?.company && <ProfileField label="Company" value={user.company} />}
              {user?.licenseNumber && <ProfileField label="License Number" value={user.licenseNumber} mono />}
              {user?.termsAcceptedAt && (
                <ProfileField
                  label="Terms Accepted"
                  value={new Date(user.termsAcceptedAt).toLocaleDateString('en-US', {
                    year: 'numeric', month: 'long', day: 'numeric',
                  })}
                />
              )}
            </div>
          )}
        </div>

        {/* Password Change */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-gray-800">Password</h2>
            {!changingPassword && (
              <button
                onClick={() => { setChangingPassword(true); setPwError(null) }}
                className="flex items-center gap-1.5 text-xs font-medium text-blue-600 hover:text-blue-700 border border-blue-200 px-3 py-1.5 rounded-lg hover:bg-blue-50 transition-colors"
              >
                <KeyRound className="h-3.5 w-3.5" />
                Change Password
              </button>
            )}
          </div>

          {pwSuccess && (
            <div className="mb-4 rounded-lg bg-green-50 border border-green-200 px-4 py-2 text-sm text-green-700 flex items-center gap-2">
              <Check className="h-4 w-4" />
              Password updated successfully
            </div>
          )}

          {changingPassword ? (
            <form onSubmit={handleChangePassword} className="space-y-3">
              {pwError && (
                <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-2 text-sm text-red-700">{pwError}</div>
              )}
              {[
                { key: 'newPw' as const, label: 'New Password', placeholder: 'Min 8 characters' },
                { key: 'confirm' as const, label: 'Confirm New Password', placeholder: 'Re-enter new password' },
              ].map(({ key, label, placeholder }) => (
                <div key={key}>
                  <label className="text-xs font-medium text-gray-600 block mb-1">{label}</label>
                  <div className="relative">
                    <input
                      required
                      type={showPw[key] ? 'text' : 'password'}
                      placeholder={placeholder}
                      className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 pr-10 focus:outline-none focus:ring-2 focus:ring-blue-400"
                      value={pwForm[key]}
                      onChange={(e) => setPwForm({ ...pwForm, [key]: e.target.value })}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPw({ ...showPw, [key]: !showPw[key] })}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      {showPw[key] ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
              ))}
              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => { setChangingPassword(false); setPwError(null); setPwForm({ newPw: '', confirm: '' }) }}
                  className="flex items-center gap-1.5 text-sm font-medium text-gray-600 border border-gray-200 px-4 py-2 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <X className="h-4 w-4" />
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingPw}
                  className="flex items-center gap-1.5 text-sm font-semibold bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors disabled:opacity-60"
                >
                  <Check className="h-4 w-4" />
                  {savingPw ? 'Updating…' : 'Update Password'}
                </button>
              </div>
            </form>
          ) : (
            <p className="text-sm text-gray-500">
              Use a strong, unique password. We will never ask for your password via email.
            </p>
          )}
        </div>

        {/* Legal & Privacy */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-sm font-semibold text-gray-800 mb-4">Legal &amp; Privacy</h2>
          <div className="space-y-3">
            <LegalLink icon={<Shield className="h-4 w-4 text-emerald-500" />} label="Privacy Policy" />
            <LegalLink icon={<FileText className="h-4 w-4 text-blue-500" />} label="Terms of Service" />
            <LegalLink icon={<Trash2 className="h-4 w-4 text-gray-400" />} label="Request Data Deletion" />
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
                Are you sure? This action cannot be undone. All your data will be permanently deleted.
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

function ProfileField({ label, value, mono }: { label: string; value?: string | null; mono?: boolean }) {
  return (
    <div>
      <p className="text-xs text-gray-400 font-medium mb-0.5">{label}</p>
      <p className={`text-sm text-gray-800 ${mono ? 'font-mono' : ''}`}>{value ?? '—'}</p>
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
