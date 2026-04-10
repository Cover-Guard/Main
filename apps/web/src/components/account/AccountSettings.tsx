'use client'

import { useEffect, useState } from 'react'
import { useRef } from 'react'
import type { User, SubscriptionState } from '@coverguard/shared'
import { getMe, updateMe, deleteAccount, getSubscriptionState, createPortalSession } from '@/lib/api'
import { createClient } from '@/lib/supabase/client'
import {
  Settings, Shield, FileText, Trash2, Edit2, Check, X, Loader2,
  LogOut, Eye, EyeOff, Save, Bell, ChevronDown, ChevronUp, User as UserIcon,
  AlertTriangle, Lock, Calendar, BadgeCheck, Camera, CreditCard, ExternalLink,
} from 'lucide-react'

// ─── Types ────────────────────────────────────────────────────────────────────

type Tab = 'account' | 'subscription' | 'notifications' | 'legal' | 'delete'

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

function Avatar({
  user,
  editable,
  onUploaded,
}: {
  user: User | null
  editable?: boolean
  onUploaded?: (url: string) => void
}) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)

  const initials =
    user?.firstName && user?.lastName
      ? `${user.firstName[0]}${user.lastName[0]}`.toUpperCase()
      : user?.email?.[0]?.toUpperCase() ?? '?'

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !onUploaded) return

    // Validate file type and size
    const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
    if (!validTypes.includes(file.type)) {
      alert('Please upload a JPG, PNG, WebP, or GIF image.')
      return
    }
    if (file.size > 2 * 1024 * 1024) {
      alert('Image must be under 2 MB.')
      return
    }

    setUploading(true)
    try {
      const supabase = createClient()
      const ext = file.name.split('.').pop() ?? 'jpg'
      const path = `avatars/${user?.id ?? 'unknown'}.${ext}`

      // Upload to Supabase Storage (public bucket)
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(path, file, { upsert: true, contentType: file.type })

      if (uploadError) {
        // If bucket doesn't exist, fall back to data URL
        console.warn('Supabase Storage upload failed, using data URL fallback:', uploadError.message)
        const reader = new FileReader()
        reader.onload = () => {
          if (typeof reader.result === 'string') onUploaded(reader.result)
        }
        reader.readAsDataURL(file)
        return
      }

      const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(path)
      // Append cache-buster so the browser doesn't serve a stale cached version
      onUploaded(`${urlData.publicUrl}?t=${Date.now()}`)
    } catch {
      alert('Failed to upload image. Please try again.')
    } finally {
      setUploading(false)
      // Reset input so the same file can be re-selected
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  const hasImage = user?.avatarUrl && (user.avatarUrl.startsWith('https://') || user.avatarUrl.startsWith('http://') || user.avatarUrl.startsWith('data:'))

  return (
    <div className="relative group">
      {hasImage ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={user!.avatarUrl!} alt="Avatar" className="h-14 w-14 rounded-full object-cover ring-2 ring-gray-100" />
      ) : (
        <div className="h-14 w-14 rounded-full bg-emerald-500 flex items-center justify-center ring-2 ring-gray-100">
          <span className="text-lg font-bold text-white">{initials}</span>
        </div>
      )}

      {editable && (
        <>
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className="absolute inset-0 flex items-center justify-center rounded-full bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
            title="Change photo"
          >
            {uploading ? (
              <Loader2 className="h-5 w-5 text-white animate-spin" />
            ) : (
              <Camera className="h-5 w-5 text-white" />
            )}
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            className="hidden"
            onChange={handleFileChange}
          />
        </>
      )}
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export function AccountSettings() {
  const [activeTab, setActiveTab] = useState<Tab>('account')
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

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

  // Notifications (persisted to Supabase user_metadata + localStorage fallback)
  const [notifPrefs, setNotifPrefs] = useState<NotificationPrefs>(DEFAULT_NOTIF_PREFS)
  const [notifSaved, setNotifSaved] = useState(false)

  // Subscription
  const [subState, setSubState] = useState<SubscriptionState | null>(null)
  const [portalLoading, setPortalLoading] = useState(false)

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
      .catch((err) => setLoadError(err instanceof Error ? err.message : 'Failed to load account details'))
      .finally(() => setLoading(false))

    // Load notification prefs: try Supabase user_metadata first, then localStorage fallback
    ;(async () => {
      try {
        const supabase = createClient()
        const { data: { user: supaUser } } = await supabase.auth.getUser()
        const meta = supaUser?.user_metadata?.notificationPrefs
        if (meta && typeof meta === 'object') {
          setNotifPrefs({ ...DEFAULT_NOTIF_PREFS, ...meta })
          return
        }
      } catch {}
      try {
        const stored = localStorage.getItem('cg_notif_prefs')
        if (stored) setNotifPrefs({ ...DEFAULT_NOTIF_PREFS, ...JSON.parse(stored) })
      } catch {}
    })()

    // Load subscription state
    getSubscriptionState()
      .then(setSubState)
      .catch(() => setSubState(null))
  }, [])

  async function handleSignOut() {
    try {
      const supabase = createClient()
      await supabase.auth.signOut()
    } catch {
      // Sign-out may fail if session is already expired — continue with redirect
    }
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

  async function handleNotifChange(key: keyof NotificationPrefs, val: boolean) {
    const updated = { ...notifPrefs, [key]: val }
    setNotifPrefs(updated)
    // Persist to both localStorage (immediate) and Supabase user_metadata (durable)
    localStorage.setItem('cg_notif_prefs', JSON.stringify(updated))
    setNotifSaved(true)
    setTimeout(() => setNotifSaved(false), 1800)
    try {
      const supabase = createClient()
      await supabase.auth.updateUser({ data: { notificationPrefs: updated } })
    } catch {
      // localStorage fallback is already saved above
    }
  }

  async function handleManageSubscription() {
    setPortalLoading(true)
    try {
      const { url } = await createPortalSession()
      window.location.href = url
    } catch {
      // Portal session creation failed — user may not have a Stripe customer ID
      setPortalLoading(false)
    }
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
    { id: 'subscription', label: 'Subscription', icon: <CreditCard className="h-4 w-4" /> },
    { id: 'notifications', label: 'Notifications', icon: <Bell className="h-4 w-4" /> },
    { id: 'legal', label: 'Legal & Privacy', icon: <Shield className="h-4 w-4" /> },
    { id: 'delete', label: 'Delete Account', icon: <Trash2 className="h-4 w-4" /> },
  ]

  return (
    <div className="p-3 md:p-4 max-w-full mx-auto">
      {/* Header */}
      <div className="flex items-center gap-2 mb-7">
        <Settings className="h-5 w-5 text-gray-600" />
        <h1 className="text-xl font-bold text-gray-900">Settings</h1>
      </div>

      {loadError && (
        <div className="mb-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 shrink-0 text-red-400" />
          {loadError}
        </div>
      )}

      <div className="flex flex-col md:flex-row gap-4">
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
              <div className="bg-white rounded-xl border border-gray-200 p-4">
                <div className="flex items-start justify-between mb-5">
                  <div className="flex items-center gap-4">
                    <Avatar
                      user={user}
                      editable={!loading}
                      onUploaded={async (url) => {
                        try {
                          const updated = await updateMe({ avatarUrl: url })
                          setUser(updated)
                        } catch {
                          // Avatar saved to storage but DB update failed — show it locally anyway
                          setUser((prev) => prev ? { ...prev, avatarUrl: url } : prev)
                        }
                      }}
                    />
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
                  className="w-full flex items-center justify-between px-4 py-4 hover:bg-gray-50 transition-colors text-left"
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
                  <form onSubmit={handlePasswordChange} className="px-4 pb-4 border-t border-gray-100 pt-4 space-y-3">
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

          {/* ── Subscription Tab ────────────────────────────────────── */}
          {activeTab === 'subscription' && (
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <SectionHeader
                title="Subscription"
                subtitle="Manage your plan, billing, and payment methods"
              />

              {!subState ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
                </div>
              ) : subState.subscription ? (
                <div className="space-y-5">
                  {/* Current plan card */}
                  <div className="rounded-xl border border-gray-200 p-5">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-base font-semibold text-gray-900">
                            {subState.subscription.plan} Plan
                          </h3>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            subState.active
                              ? 'bg-emerald-100 text-emerald-700'
                              : subState.subscription.status === 'PAST_DUE'
                              ? 'bg-amber-100 text-amber-700'
                              : 'bg-gray-100 text-gray-600'
                          }`}>
                            {subState.subscription.status.replace('_', ' ')}
                          </span>
                        </div>
                        <p className="text-xs text-gray-400 mt-1">
                          Billing period: {fmtDate(subState.subscription.currentPeriodStart)} — {fmtDate(subState.subscription.currentPeriodEnd)}
                        </p>
                        {subState.subscription.cancelAtPeriodEnd && (
                          <p className="text-xs text-amber-600 mt-1 flex items-center gap-1">
                            <AlertTriangle className="h-3 w-3" />
                            Your subscription will cancel at the end of the current period
                          </p>
                        )}
                      </div>
                      <CreditCard className="h-8 w-8 text-gray-300 shrink-0" />
                    </div>
                  </div>

                  {/* Manage button */}
                  <button
                    onClick={handleManageSubscription}
                    disabled={portalLoading}
                    className="w-full flex items-center justify-center gap-2 bg-[#0d1929] hover:bg-[#162438] text-white text-sm font-semibold px-5 py-3 rounded-xl transition-colors disabled:opacity-50"
                  >
                    {portalLoading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <ExternalLink className="h-4 w-4" />
                    )}
                    Manage Subscription & Billing
                  </button>
                  <p className="text-[11px] text-gray-400 text-center">
                    Opens the Stripe Customer Portal to update payment methods, change plans, or cancel.
                  </p>
                </div>
              ) : (
                <div className="text-center py-8">
                  <CreditCard className="h-10 w-10 text-gray-200 mx-auto mb-3" />
                  <p className="text-sm font-medium text-gray-600">No active subscription</p>
                  <p className="text-xs text-gray-400 mt-1 mb-4">
                    Subscribe to unlock full access to CoverGuard features.
                  </p>
                  <a
                    href="/pricing"
                    className="inline-flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-semibold px-5 py-2.5 rounded-lg transition-colors"
                  >
                    View Plans
                  </a>
                </div>
              )}
            </div>
          )}

          {/* ── Notifications Tab ─────────────────────────────────────── */}
          {activeTab === 'notifications' && (
            <div className="bg-white rounded-xl border border-gray-200 p-4">
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
                <p><strong>Last updated: March 26, 2026</strong></p>
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
                  public sources. While we strive for accuracy, data may be outdated or incomplete. All data should
                  be independently verified with a licensed insurance professional before making decisions.
                </p>
                <p>
                  <strong>Confidentiality.</strong> You agree to treat all proprietary data, risk scoring
                  methodologies, carrier intelligence, and non-public information available through the Platform
                  as confidential. Unauthorized disclosure, reproduction, or redistribution is prohibited.
                </p>
                <p>
                  <strong>Prohibited Uses.</strong> You may not use CoverGuard to scrape data, conduct bulk
                  automated searches, probe system vulnerabilities, introduce malicious code, or resell data to
                  third parties without our written consent. Violations may result in immediate account termination.
                </p>
                <p>
                  <strong>Account Security.</strong> You are responsible for maintaining the security of your
                  account credentials and must notify us immediately of any unauthorized access. We recommend
                  enabling multi-factor authentication where available.
                </p>
                <p>
                  <strong>Limitation of Liability.</strong> CoverGuard is not liable for decisions made based
                  on information provided by the Platform, including but not limited to property purchase decisions,
                  insurance purchasing decisions, or lending decisions.
                </p>
                <p className="text-gray-400">
                  For questions about these terms, contact{' '}
                  <a href="mailto:legal@coverguard.com" className="underline hover:text-gray-500">legal@coverguard.com</a>
                </p>
              </LegalSection>

              <LegalSection
                icon={<Shield className="h-4 w-4 text-emerald-500" />}
                title="Privacy Policy"
                badge="Effective March 26, 2026"
              >
                <p><strong>Last updated: March 26, 2026</strong></p>
                <p>
                  CoverGuard (&ldquo;we&rdquo;, &ldquo;our&rdquo;, &ldquo;us&rdquo;) is committed to protecting
                  your privacy. This policy explains what data we collect, how we use it, and your rights. We
                  limit data collection to what is necessary to provide and improve our services.
                </p>
                <p>
                  <strong>What We Collect.</strong> We collect account information you provide (name, email,
                  company, license number), property searches and saved properties, quote requests you submit,
                  and usage data such as pages visited and features used. We collect only the minimum information
                  necessary to operate and improve the Platform.
                </p>
                <p>
                  <strong>How We Use It.</strong> Your data is processed for specific, documented purposes: to
                  provide and improve our services, personalize your experience, communicate with you about your
                  account and properties, connect you with carriers when you request quotes, and maintain security
                  through audit logging and monitoring.
                </p>
                <p>
                  <strong>Third-Party Sharing.</strong> We do not sell, rent, or trade your personal data. We
                  share data with insurance carriers only when you explicitly request a quote. All third-party
                  service providers (subprocessors) are bound by written data processing agreements that require
                  them to protect your data with appropriate security measures.
                </p>
                <p>
                  <strong>Data Security.</strong> We maintain a comprehensive security program including
                  encryption in transit and at rest, role-based access controls, continuous monitoring,
                  regular penetration testing, and documented incident response procedures.
                </p>
                <p>
                  <strong>Data Retention.</strong> We retain your account data while your account is active and
                  for 30 days after deletion for recovery purposes. Usage logs are retained for up to 24 months.
                  Quote records are retained for up to 7 years per regulatory requirements. All data is securely
                  deleted or anonymized when retention periods expire.
                </p>
                <p>
                  <strong>Your Rights.</strong> You have the right to access, correct, delete, or export your
                  personal data. California residents have additional rights under CCPA/CPRA. We respond to
                  verified requests within 30 days.
                </p>
                <p>
                  <strong>Cookies.</strong> We use strictly necessary cookies for authentication. We do not use
                  third-party advertising or behavioral tracking cookies.
                </p>
                <p className="text-gray-400">
                  For privacy inquiries or data requests, contact{' '}
                  <a href="mailto:privacy@coverguard.com" className="underline hover:text-gray-500">privacy@coverguard.com</a>
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
                  history, and all associated data from our systems within 30 days. Data is securely deleted
                  using industry-standard disposal methods.
                </p>
                <p>
                  Some data may be retained in anonymized, aggregated form for analytics purposes and cannot
                  be individually identified. Transaction records required by law or regulation (e.g., binding
                  quote records) may be retained for the legally required retention period (up to 7 years).
                  Security and audit logs may be retained for up to 12 months for incident investigation purposes.
                </p>
                <p>
                  For data export requests (portability), targeted deletion requests, or to inquire about the
                  specific data we hold about you, email{' '}
                  <a href="mailto:privacy@coverguard.com" className="underline hover:text-gray-500">privacy@coverguard.com</a>
                  {' '}with the subject &ldquo;Data Request&rdquo; and include your registered email address. We
                  will respond to verified requests within 30 days.
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
            <div className="bg-white rounded-xl border border-red-200 p-4">
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
