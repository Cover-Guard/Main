'use client'

import { useEffect, useState } from 'react'
import type { User } from '@coverguard/shared'
import { getMe, updateMe } from '@/lib/api'
import { createClient } from '@/lib/supabase/client'
import { Settings, Shield, LogOut, Save, Check, Eye, EyeOff } from 'lucide-react'

export function AccountSettings() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Editable fields
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [company, setCompany] = useState('')
  const [licenseNumber, setLicenseNumber] = useState('')

  // Password change
  const [pwSectionOpen, setPwSectionOpen] = useState(false)
  const [currentPw, setCurrentPw] = useState('')
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
        setFirstName(u.firstName ?? '')
        setLastName(u.lastName ?? '')
        setCompany(u.company ?? '')
        setLicenseNumber(u.licenseNumber ?? '')
      })
      .catch(() => null)
      .finally(() => setLoading(false))
  }, [])

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    try {
      const updated = await updateMe({ firstName, lastName, company, licenseNumber })
      setUser(updated)
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save. Please try again.')
    } finally {
      setSaving(false)
    }
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
      setCurrentPw(''); setNewPw(''); setConfirmPw('')
      setTimeout(() => { setPwSaved(false); setPwSectionOpen(false) }, 2500)
    } catch (err) {
      setPwError(err instanceof Error ? err.message : 'Failed to update password.')
    } finally {
      setPwSaving(false)
    }
  }

  async function handleSignOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    window.location.href = '/login'
  }

  const isAgent = user?.role === 'AGENT' || user?.role === 'LENDER' || user?.role === 'ADMIN'

  return (
    <div className="p-8 max-w-2xl mx-auto">
      <div className="flex items-center gap-2 mb-8">
        <Settings className="h-6 w-6 text-gray-700" />
        <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
      </div>

      <div className="space-y-4">
        {/* Profile */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-sm font-semibold text-gray-800 mb-5">Profile Information</h2>
          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => <div key={i} className="h-10 rounded bg-gray-100 animate-pulse" />)}
            </div>
          ) : (
            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <label className="text-xs font-medium text-gray-500 block mb-1">Email</label>
                <p className="text-sm text-gray-800 px-3 py-2 bg-gray-50 rounded-lg border border-gray-200">{user?.email ?? '—'}</p>
                <p className="text-[10px] text-gray-400 mt-1">Email address cannot be changed here.</p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-gray-500 block mb-1">First Name</label>
                  <input
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-teal-500"
                    placeholder="First name"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-500 block mb-1">Last Name</label>
                  <input
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-teal-500"
                    placeholder="Last name"
                  />
                </div>
              </div>

              {isAgent && (
                <>
                  <div>
                    <label className="text-xs font-medium text-gray-500 block mb-1">Company / Brokerage</label>
                    <input
                      value={company}
                      onChange={(e) => setCompany(e.target.value)}
                      className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-teal-500"
                      placeholder="e.g. Coldwell Banker"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-500 block mb-1">License Number</label>
                    <input
                      value={licenseNumber}
                      onChange={(e) => setLicenseNumber(e.target.value)}
                      className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-teal-500"
                      placeholder="e.g. DRE 01234567"
                    />
                  </div>
                </>
              )}

              {error && <p className="text-sm text-red-600">{error}</p>}

              <div className="flex items-center gap-3">
                <button
                  type="submit"
                  disabled={saving}
                  className="flex items-center gap-2 bg-[#0d1929] hover:bg-[#162438] text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors disabled:opacity-50"
                >
                  {saving ? (
                    <span className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : saved ? (
                    <Check className="h-4 w-4 text-teal-400" />
                  ) : (
                    <Save className="h-4 w-4" />
                  )}
                  {saved ? 'Saved!' : saving ? 'Saving…' : 'Save Changes'}
                </button>

                <div className="flex items-center gap-1.5 text-xs text-gray-400">
                  <Shield className="h-3.5 w-3.5" />
                  <span>Role: <span className="font-medium text-gray-600 capitalize">{user?.role?.toLowerCase() ?? '—'}</span></span>
                </div>
              </div>
            </form>
          )}
        </div>

        {/* Password */}
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
                  <input
                    type={showPw ? 'text' : 'password'}
                    value={newPw}
                    onChange={(e) => setNewPw(e.target.value)}
                    required
                    minLength={8}
                    className="w-full pr-10 text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-teal-500"
                    placeholder="Min. 8 characters"
                  />
                  <button type="button" onClick={() => setShowPw((s) => !s)} className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600">
                    {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500 block mb-1">Confirm New Password</label>
                <input
                  type={showPw ? 'text' : 'password'}
                  value={confirmPw}
                  onChange={(e) => setConfirmPw(e.target.value)}
                  required
                  className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-teal-500"
                  placeholder="Re-enter new password"
                />
              </div>
              {pwError && <p className="text-sm text-red-600">{pwError}</p>}
              {pwSaved && <p className="text-sm text-green-600 flex items-center gap-1.5"><Check className="h-4 w-4" /> Password updated!</p>}
              <button
                type="submit"
                disabled={pwSaving || !newPw || !confirmPw}
                className="flex items-center gap-2 bg-[#0d1929] hover:bg-[#162438] text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors disabled:opacity-50"
              >
                {pwSaving ? <span className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Save className="h-4 w-4" />}
                {pwSaving ? 'Updating…' : 'Update Password'}
              </button>
            </form>
          )}
        </div>

        {/* Notifications — placeholder */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-sm font-semibold text-gray-800 mb-1">Notifications</h2>
          <p className="text-xs text-gray-400 mb-4">Email notification preferences</p>
          <div className="space-y-3">
            {[
              { label: 'Risk alerts for saved properties', sublabel: 'Get notified when a saved property\'s risk score changes significantly' },
              { label: 'New carrier availability', sublabel: 'When a new carrier starts writing in your saved properties\' states' },
              { label: 'Quote request updates', sublabel: 'When carriers respond to your binding quote requests' },
            ].map(({ label, sublabel }) => (
              <label key={label} className="flex items-start gap-3 cursor-pointer">
                <input type="checkbox" defaultChecked className="mt-0.5 accent-teal-500" />
                <div>
                  <p className="text-sm text-gray-700">{label}</p>
                  <p className="text-xs text-gray-400">{sublabel}</p>
                </div>
              </label>
            ))}
          </div>
        </div>

        {/* Danger zone */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-sm font-semibold text-gray-800 mb-4">Account Actions</h2>
          <button
            onClick={handleSignOut}
            className="flex items-center gap-2 text-sm font-medium text-gray-600 hover:text-gray-900 border border-gray-200 hover:border-gray-300 px-4 py-2 rounded-lg transition-colors"
          >
            <LogOut className="h-4 w-4" />
            Sign Out
          </button>
        </div>
      </div>
    </div>
  )
}
