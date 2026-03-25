'use client'

import { useEffect, useState } from 'react'
import type { User } from '@coverguard/shared'
import { getMe, updateMe, deleteAccount } from '@/lib/api'
import { createClient } from '@/lib/supabase/client'
import {
  Settings, Shield, FileText, Trash2, Edit2, Check, X, Loader2,
  LogOut, Eye, EyeOff, Save, Bell, ChevronDown, ChevronUp, User as UserIcon,
  AlertTriangle, Lock, Calendar, BadgeCheck,
} from 'lucide-react'

// ─── Types ────────────────────────────────────────────────────────────────────

type Tab = 'account' | 'notifications' | 'legal' | 'delete'

interface NotificationPrefs {
  riskAlerts: boolean
  carrierAvailability: boolean
  quoteUpdates: boolean
  weeklyDigest: boolean
  marketingEmails: boolean
}

const DEFAULT_NOTIF_PREFS: NotificationPrefs = {
  riskAlerts: true,
  carrierAvailability: true,
  quoteUpdates: true,
  weeklyDigest: false,
  marketingEmails: false,
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtDate(iso: string | null | undefined) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
}

function Toggle({
  checked,
  onChange,
  disabled,
}: {
  checked: boolean
  onChange: (v: boolean) => void
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-5 w-9 flex-shrink-0 rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:ring-offset-1 ${
        checked ? 'bg-emerald-500' : 'bg-gray-200'
      } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
    >
      <span
        className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition duration-200 ${
          checked ? 'translate-x-4' : 'translate-x-0'
        }`}
      />
    </button>
  )
}

function SectionHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="mb-5">
      <h2 className="text-base font-semibold text-gray-900">{title}</h2>
      {subtitle && <p className="text-xs text-gray-400 mt-0.5">{subtitle}</p>}
    </div>
  )
}

// ─── Legal expandable ─────────────────────────────────────────────────────────

function LegalSection({
  icon,
  title,
  badge,
  children,
}: {
  icon: React.ReactNode
  title: string
  badge?: string
  children: React.ReactNode
}) {
  const [open, setOpen] = useState(false)
  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-gray-50 transition-colors text-left"
      >
        <div className="flex items-center gap-3">
          {icon}
          <div>
            <p className="text-sm font-semibold text-gray-800">{title}</p>
            {badge && <p className="text-xs text-gray-400 mt-0.5">{badge}</p>}
          </div>
        </div>
        {open ? (
          <ChevronUp className="h-4 w-4 text-gray-400 flex-shrink-0" />
        ) : (
          <ChevronDown className="h-4 w-4 text-gray-400 flex-shrink-0" />
        )}
      </button>
      {open && (
        <div className="border-t border-gray-100 px-5 py-4 bg-gray-50 text-xs text-gray-600 leading-relaxed space-y-3">
          {children}
        </div>
      )}
    </div>
  )
}

// ─── Avatar ───────────────────────────────────────────────────────────────────

function Avatar({ user }: { user: User | null }) {
  const initials =
    user?.firstName && user?.lastName
      ? `${user.firstName[0]}${user.lastName[0]}`.toUpperCase()
      : user?.email?.[0]?.toUpperCase() ?? '?'

  if (user?.avatarUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={user.avatarUrl} alt="Avatar" className="h-14 w-14 rounded-full object-cover ring-2 ring-gray-100" />
    )
  }
  return (
    <div className="h-14 w-14 rounded-full bg-emerald-500 flex items-center justify-center ring-2 ring-gray-100">
      <span className="text-lg font-bold text-white">{initials}</span>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export function AccountSettings() {
  const [activeTab, setActiveTab] = useState<Tab>('account')
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  // Profile edit
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const [form, setForm] = useState({ firstName: '', lastName: '', company: '', licenseNumber: '' })

  // Password
  const [pwOpen, setPwOpen] = useState(false)
  const [newPw, setNewPw] = useState('')
  const [confirmPw, setConfirmPw] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [pwSaving, setPwSaving] = useState(false)
  const [pwError, setPwError] = useState<string | null>(null)
  const [pwSaved, setPwSaved] = useState(false)

  // Notifications (stored in localStorage)
  const [notifPrefs, setNotifPrefs] = useState<NotificationPrefs>(DEFAULT_NOTIF_PREFS)
  const [notifSaved, setNotifSaved] = useState(false)

  // Delete account
  const [deleteInput, setDeleteInput] = useState('')
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

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

    // Load notification prefs from localStorage
    try {
      const stored = localStorage.getItem('cg_notif_prefs')
      if (stored) setNotifPrefs({ ...DEFAULT_NOTIF_PREFS, ...JSON.parse(stored) })
    } catch {}
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
      setTimeout(() => { setPwSaved(false); setPwOpen(false) }, 2500)
    } catch (err) {
      setPwError(err instanceof Error ? err.message : 'Failed to update password.')
    } finally {
      setPwSaving(false)
    }
  }

  function handleNotifChange(key: keyof NotificationPrefs, val: boolean) {
    const updated = { ...notifPrefs, [key]: val }
    setNotifPrefs(updated)
    localStorage.setItem('cg_notif_prefs', JSON.stringify(updated))
    setNotifSaved(true)
    setTimeout(() => setNotifSaved(false), 1800)
  }

  async function handleDeleteAccount() {
    if (deleteInput !== 'DELETE') return
    setDeleting(true)
    setDeleteError(null)
    try {
      await deleteAccount()
      // Attempt to sign out (may fail if session already invalidated by deletion)
      // but continue with redirect regardless since account is deleted on backend
      const supabase = createClient()
      supabase.auth.signOut().catch(() => {
        // Silently ignore signOut errors — session is already invalid after account deletion
      })
      window.location.href = '/'
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : 'Failed to delete account.')
      setDeleting(false)
    }
  }

  const displayName =
    user?.firstName && user?.lastName
      ? `${user.firstName} ${user.lastName}`
      : user?.email?.split('@')[0] ?? 'User'

  const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: 'account', label: 'Account', icon: <UserIcon className="h-4 w-4" /> },
    { id: 'notifications', label: 'Notifications', icon: <Bell className="h-4 w-4" /> },
    { id: 'legal', label: 'Legal & Privacy', icon: <Shield className="h-4 w-4" /> },
    { id: 'delete', label: 'Delete Account', icon: <Trash2 className="h-4 w-4" /> },
  ]

  return (
    <div className="p-6 md:p-8 max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-2 mb-7">
        <Settings className="h-5 w-5 text-gray-600" />
        <h1 className="text-xl font-bold text-gray-900">Settings</h1>
      </div>

      <div className="flex flex-col md:flex-row gap-6">
        {/* Sidebar tabs */}
        <nav className="md:w-48 flex-shrink-0">
          <ul className="space-y-0.5">
            {TABS.map(({ id, label, icon }) => (
              <li key={id}>
                <button
                  onClick={() => setActiveTab(id)}
                  className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors text-left ${
                    activeTab === id
                      ? id === 'delete'
                        ? 'bg-red-50 text-red-600'
                        : 'bg-emerald-50 text-emerald-700'
                      : id === 'delete'
                      ? 'text-red-400 hover:bg-red-50 hover:text-red-600'
                      : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                  }`}
                >
                  {icon}
                  {label}
                </button>
              </li>
            ))}
          </ul>
        </nav>

        {/* Tab content */}
        <div className="flex-1 min-w-0 space-y-4">

          {/* ── Account Tab ──────────────────────────────────────────── */}
          {activeTab === 'account' && (
            <>
              {/* Profile card */}
              <div className="bg-white rounded-xl border border-gray-200 p-6">
                <div className="flex items-start justify-between mb-5">
                  <div className="flex items-center gap-4">
                    <Avatar user={user} />
                    <div>
                      <p className="font-semibold text-gray-900">{loading ? '—' : displayName}</p>
                      <p className="text-xs text-gray-400 mt-0.5">{user?.email ?? '—'}</p>
                      {user?.role && (
                        <span className="inline-block mt-1.5 text-xs font-medium bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full capitalize">
                          {user.role.toLowerCase()}
                        </span>
                      )}
                    </div>
                  </div>
                  {!loading && !editing && (
                    <button
                      onClick={() => setEditing(true)}
                      className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-700 border border-gray-200 px-2.5 py-1.5 rounded-lg hover:bg-gray-50 transition-colors"
                    >
                      <Edit2 className="h-3 w-3" />
                      Edit
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
                      <p className="text-xs text-gray-400 mt-1">Email cannot be changed here. Contact support to update.</p>
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
                      <div className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{saveError}</div>
                    )}
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={handleCancel}
                        className="flex items-center gap-1.5 text-sm font-medium text-gray-600 border border-gray-200 px-4 py-2 rounded-lg hover:bg-gray-50 transition-colors"
                      >
                        <X className="h-3.5 w-3.5" /> Cancel
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
                  <div className="grid grid-cols-2 gap-x-6 gap-y-4">
                    {saved && (
                      <div className="col-span-2 flex items-center gap-2 text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
                        <Check className="h-4 w-4" /> Profile updated successfully
                      </div>
                    )}
                    <div>
                      <p className="text-xs text-gray-400 font-medium mb-0.5">First Name</p>
                      <p className="text-sm text-gray-800">{user?.firstName || '—'}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-400 font-medium mb-0.5">Last Name</p>
                      <p className="text-sm text-gray-800">{user?.lastName || '—'}</p>
                    </div>
                    {user?.company && (
                      <div className="col-span-2">
                        <p className="text-xs text-gray-400 font-medium mb-0.5">Company</p>
                        <p className="text-sm text-gray-800">{user.company}</p>
                      </div>
                    )}
                    {user?.licenseNumber && (
                      <div className="col-span-2">
                        <p className="text-xs text-gray-400 font-medium mb-0.5">License Number</p>
                        <p className="text-sm text-gray-800">{user.licenseNumber}</p>
                      </div>
                    )}
                    <div className="flex items-center gap-2">
                      <Calendar className="h-3.5 w-3.5 text-gray-400" />
                      <div>
                        <p className="text-xs text-gray-400 font-medium">Member since</p>
                        <p className="text-sm text-gray-800">{fmtDate(user?.createdAt)}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <BadgeCheck className="h-3.5 w-3.5 text-emerald-500" />
                      <div>
                        <p className="text-xs text-gray-400 font-medium">Terms accepted</p>
                        <p className="text-sm text-gray-800">{fmtDate(user?.termsAcceptedAt)}</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Password change */}
              <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <button
                  onClick={() => setPwOpen((o) => !o)}
                  className="w-full flex items-center justify-between px-6 py-4 hover:bg-gray-50 transition-colors text-left"
                >
                  <div className="flex items-center gap-3">
                    <Lock className="h-4 w-4 text-gray-400" />
                    <div>
                      <p className="text-sm font-semibold text-gray-800">Change Password</p>
                      <p className="text-xs text-gray-400 mt-0.5">Update your account password</p>
                    </div>
                  </div>
                  <span className="text-xs text-blue-600 font-medium">{pwOpen ? 'Cancel' : 'Change'}</span>
                </button>
                {pwOpen && (
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
                          className="w-full pr-10 text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-400"
                          placeholder="Min. 8 characters"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPw((s) => !s)}
                          className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600"
                        >
                          {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                    </div>
                    <div>
                      <label className="text-xs font-medium text-gray-500 block mb-1">Confirm Password</label>
                      <input
                        type={showPw ? 'text' : 'password'}
                        value={confirmPw}
                        onChange={(e) => setConfirmPw(e.target.value)}
                        required
                        className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-400"
                        placeholder="Re-enter new password"
                      />
                    </div>
                    {pwError && <p className="text-sm text-red-600">{pwError}</p>}
                    {pwSaved && (
                      <p className="text-sm text-emerald-600 flex items-center gap-1.5">
                        <Check className="h-4 w-4" /> Password updated!
                      </p>
                    )}
                    <button
                      type="submit"
                      disabled={pwSaving || !newPw || !confirmPw}
                      className="flex items-center gap-2 bg-[#0d1929] hover:bg-[#162438] text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors disabled:opacity-50"
                    >
                      {pwSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                      {pwSaving ? 'Updating…' : 'Update Password'}
                    </button>
                  </form>
                )}
              </div>

              {/* Sign out */}
              <div className="bg-white rounded-xl border border-gray-200 p-5 flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-gray-800">Sign Out</p>
                  <p className="text-xs text-gray-400 mt-0.5">Sign out of your account on this device</p>
                </div>
                <button
                  onClick={handleSignOut}
                  className="flex items-center gap-2 text-sm font-medium text-gray-600 border border-gray-200 px-4 py-2 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <LogOut className="h-4 w-4" /> Sign Out
                </button>
              </div>
            </>
          )}

          {/* ── Notifications Tab ─────────────────────────────────────── */}
          {activeTab === 'notifications' && (
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <SectionHeader
                title="Email Notifications"
                subtitle="Choose which emails CoverGuard sends you"
              />
              {notifSaved && (
                <div className="mb-4 flex items-center gap-2 text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
                  <Check className="h-4 w-4" /> Preferences saved
                </div>
              )}
              <div className="space-y-5">
                {(
                  [
                    {
                      key: 'riskAlerts' as const,
                      label: 'Risk alerts',
                      sublabel: "Get notified when a saved property's risk score changes significantly",
                    },
                    {
                      key: 'carrierAvailability' as const,
                      label: 'Carrier availability',
                      sublabel: "When a new carrier starts writing in your saved properties' states",
                    },
                    {
                      key: 'quoteUpdates' as const,
                      label: 'Quote request updates',
                      sublabel: 'When carriers respond to your binding quote requests',
                    },
                    {
                      key: 'weeklyDigest' as const,
                      label: 'Weekly digest',
                      sublabel: 'A weekly summary of activity across your saved properties',
                    },
                    {
                      key: 'marketingEmails' as const,
                      label: 'Product updates & news',
                      sublabel: 'New features, coverage expansions, and platform announcements',
                    },
                  ] as const
                ).map(({ key, label, sublabel }) => (
                  <div key={key} className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-sm font-medium text-gray-800">{label}</p>
                      <p className="text-xs text-gray-400 mt-0.5">{sublabel}</p>
                    </div>
                    <Toggle
                      checked={notifPrefs[key]}
                      onChange={(v) => handleNotifChange(key, v)}
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── Legal & Privacy Tab ───────────────────────────────────── */}
          {activeTab === 'legal' && (
            <div className="space-y-3">
              <SectionHeader
                title="Legal & Privacy"
                subtitle="Review the policies that govern your use of CoverGuard"
              />

              <LegalSection
                icon={<FileText className="h-4 w-4 text-blue-500" />}
                title="Terms of Service"
                badge={user?.termsAcceptedAt ? `Accepted ${fmtDate(user.termsAcceptedAt)}` : undefined}
              >
                <p><strong>Last updated: January 1, 2025</strong></p>
                <p>
                  By using CoverGuard, you agree to these Terms of Service. CoverGuard provides a property
                  insurability intelligence platform that aggregates publicly available risk data and connects
                  users with insurance carriers that may be writing policies in their area.
                </p>
                <p>
                  <strong>No Insurance Advice.</strong> CoverGuard is an information platform only. Risk scores,
                  insurability assessments, and carrier listings are provided for informational purposes and do
                  not constitute insurance advice, a guarantee of coverage, or a binding commitment from any carrier.
                </p>
                <p>
                  <strong>Data Accuracy.</strong> Risk data is sourced from FEMA, USGS, NOAA, the FBI, and other
                  public sources. While we strive for accuracy, data may be outdated or incomplete. Always verify
                  information with a licensed insurance professional before making purchasing decisions.
                </p>
                <p>
                  <strong>Prohibited Uses.</strong> You may not use CoverGuard to scrape data, conduct bulk
                  automated searches, or resell data to third parties without our written consent.
                </p>
                <p>
                  <strong>Account Termination.</strong> We reserve the right to suspend or terminate accounts
                  that violate these terms. You may delete your account at any time through Settings.
                </p>
                <p>
                  <strong>Limitation of Liability.</strong> CoverGuard is not liable for decisions made based
                  on information provided by the platform, including but not limited to property purchase decisions,
                  insurance purchasing decisions, or lending decisions.
                </p>
                <p className="text-gray-400">
                  For questions about these terms, contact legal@coverguard.io
                </p>
              </LegalSection>

              <LegalSection
                icon={<Shield className="h-4 w-4 text-emerald-500" />}
                title="Privacy Policy"
                badge="Effective January 1, 2025"
              >
                <p><strong>Last updated: January 1, 2025</strong></p>
                <p>
                  CoverGuard (&ldquo;we&rdquo;, &ldquo;our&rdquo;, &ldquo;us&rdquo;) is committed to protecting
                  your privacy. This policy explains what data we collect, how we use it, and your rights.
                </p>
                <p>
                  <strong>What We Collect.</strong> We collect account information you provide (name, email,
                  company, license number), property searches and saved properties, quote requests you submit,
                  and usage data such as pages visited and features used.
                </p>
                <p>
                  <strong>How We Use It.</strong> Your data is used to provide and improve our services,
                  personalize your experience, communicate with you about your account and properties,
                  and connect you with carriers when you request quotes.
                </p>
                <p>
                  <strong>Third-Party Sharing.</strong> We do not sell your personal data. We share data with
                  insurance carriers only when you explicitly request a quote. We use Supabase for authentication
                  and database hosting, and Mapbox for map rendering.
                </p>
                <p>
                  <strong>Data Retention.</strong> We retain your account data for as long as your account is
                  active. You may request deletion of your data at any time by deleting your account through Settings.
                </p>
                <p>
                  <strong>Your Rights.</strong> You have the right to access, correct, or delete your personal
                  data. Residents of California have additional rights under CCPA. EU/UK residents have rights
                  under GDPR, including the right to data portability.
                </p>
                <p>
                  <strong>Cookies.</strong> We use essential cookies for authentication. We do not use
                  third-party advertising cookies.
                </p>
                <p className="text-gray-400">
                  For privacy inquiries or data requests, contact privacy@coverguard.io
                </p>
              </LegalSection>

              <LegalSection
                icon={<Trash2 className="h-4 w-4 text-gray-400" />}
                title="Data Deletion Request"
                badge="Request removal of your personal data"
              >
                <p>
                  You may request deletion of your personal data at any time. Deleting your account through the
                  &ldquo;Delete Account&rdquo; tab will permanently remove your profile, saved properties, search
                  history, and all associated data from our systems within 30 days.
                </p>
                <p>
                  Some data may be retained in anonymized, aggregated form for analytics purposes and cannot
                  be individually identified. Transaction records required by law (e.g., binding quote records)
                  may be retained for the legally required period.
                </p>
                <p>
                  For data export requests or targeted deletion requests, email privacy@coverguard.io with the
                  subject &ldquo;Data Request&rdquo; and include your registered email address.
                </p>
                <button
                  onClick={() => setActiveTab('delete')}
                  className="mt-1 flex items-center gap-2 text-red-500 hover:text-red-600 text-xs font-medium border border-red-200 px-3 py-1.5 rounded-lg hover:bg-red-50 transition-colors"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Delete my account
                </button>
              </LegalSection>
            </div>
          )}

          {/* ── Delete Account Tab ────────────────────────────────────── */}
          {activeTab === 'delete' && (
            <div className="bg-white rounded-xl border border-red-200 p-6">
              <div className="flex items-start gap-3 mb-5">
                <div className="flex-shrink-0 h-10 w-10 rounded-full bg-red-50 flex items-center justify-center">
                  <AlertTriangle className="h-5 w-5 text-red-500" />
                </div>
                <div>
                  <h2 className="text-base font-semibold text-gray-900">Delete Account</h2>
                  <p className="text-xs text-gray-500 mt-0.5">
                    This action is permanent and cannot be undone.
                  </p>
                </div>
              </div>

              <div className="bg-red-50 border border-red-100 rounded-lg px-4 py-3 mb-5 space-y-1.5">
                <p className="text-xs font-semibold text-red-700">What will be permanently deleted:</p>
                <ul className="text-xs text-red-600 space-y-1 list-disc list-inside">
                  <li>Your account profile and personal information</li>
                  <li>All saved properties and associated notes</li>
                  <li>Your full search history</li>
                  <li>All quote requests you have submitted</li>
                  <li>Any generated property reports</li>
                  {user?.role === 'AGENT' && <li>All client records linked to your account</li>}
                </ul>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    Type <span className="font-bold font-mono text-red-600">DELETE</span> to confirm
                  </label>
                  <input
                    type="text"
                    value={deleteInput}
                    onChange={(e) => setDeleteInput(e.target.value)}
                    placeholder="Type DELETE here"
                    className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-red-400 font-mono"
                  />
                </div>

                {deleteError && (
                  <div className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
                    {deleteError}
                  </div>
                )}

                <div className="flex items-center gap-3">
                  <button
                    onClick={handleDeleteAccount}
                    disabled={deleteInput !== 'DELETE' || deleting}
                    className="flex items-center gap-2 text-sm font-semibold bg-red-500 hover:bg-red-600 disabled:opacity-40 disabled:cursor-not-allowed text-white px-5 py-2.5 rounded-lg transition-colors"
                  >
                    {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                    {deleting ? 'Deleting account…' : 'Permanently Delete Account'}
                  </button>
                  <button
                    onClick={() => { setDeleteInput(''); setDeleteError(null); setActiveTab('account') }}
                    className="text-sm text-gray-500 hover:text-gray-700 px-3 py-2 rounded-lg hover:bg-gray-100 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  )
}
