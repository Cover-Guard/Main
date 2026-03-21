'use client'

import { useEffect, useState } from 'react'
import type { User } from '@coverguard/shared'
import { getMe } from '@/lib/api'
import { createClient } from '@/lib/supabase/client'
import { Settings, Shield, FileText, Trash2 } from 'lucide-react'

export function AccountSettings() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [deleteConfirm, setDeleteConfirm] = useState(false)

  useEffect(() => {
    getMe()
      .then(setUser)
      .catch(() => null)
      .finally(() => setLoading(false))
  }, [])

  async function handleSignOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    window.location.href = '/login'
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
          <h2 className="text-sm font-semibold text-gray-800 mb-4">Account</h2>
          {loading ? (
            <div className="space-y-3">
              <div className="h-8 rounded bg-gray-100 animate-pulse" />
              <div className="h-8 rounded bg-gray-100 animate-pulse" />
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <p className="text-xs text-gray-400 font-medium mb-0.5">Email</p>
                <p className="text-sm text-gray-800">{user?.email ?? '—'}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400 font-medium mb-0.5">Name</p>
                <p className="text-sm text-gray-800">{displayName}</p>
              </div>
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
