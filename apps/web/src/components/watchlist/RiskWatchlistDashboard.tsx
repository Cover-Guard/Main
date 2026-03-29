'use client'

import { useState, useEffect } from 'react'
import {
  Eye, Trash2, RefreshCw, ChevronRight, TrendingUp, TrendingDown, Minus, Bell,
} from 'lucide-react'
import { cn, riskLevelClasses } from '@/lib/utils'
import {
  getRiskWatchlist,
  removeFromRiskWatchlist,
  checkRiskChanges,
  getRiskChangeEvents,
} from '@/lib/api'
import type { RiskWatchlistEntry, RiskChangeEvent } from '@coverguard/shared'
import Link from 'next/link'

function ScoreBadge({ score, label }: { score: number | null; label: string }) {
  if (score === null) return null
  const level = score <= 25 ? 'LOW' : score <= 50 ? 'MODERATE' : score <= 70 ? 'HIGH' : score <= 85 ? 'VERY_HIGH' : 'EXTREME'
  return (
    <div className="text-center">
      <div className={cn('text-xs font-bold rounded px-1.5 py-0.5', riskLevelClasses(level))}>
        {score}
      </div>
      <p className="text-[9px] text-gray-400 mt-0.5">{label}</p>
    </div>
  )
}

function ChangeIndicator({ prev, curr }: { prev: number; curr: number }) {
  const diff = curr - prev
  if (diff === 0) return <Minus className="h-3 w-3 text-gray-400" />
  if (diff > 0) return (
    <span className="flex items-center gap-0.5 text-red-600">
      <TrendingUp className="h-3 w-3" />
      <span className="text-[10px] font-medium">+{diff}</span>
    </span>
  )
  return (
    <span className="flex items-center gap-0.5 text-green-600">
      <TrendingDown className="h-3 w-3" />
      <span className="text-[10px] font-medium">{diff}</span>
    </span>
  )
}

export function RiskWatchlistDashboard() {
  const [entries, setEntries] = useState<RiskWatchlistEntry[]>([])
  const [changes, setChanges] = useState<RiskChangeEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [checkingId, setCheckingId] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'watchlist' | 'changes'>('watchlist')

  useEffect(() => {
    setLoading(true)
    Promise.all([getRiskWatchlist(), getRiskChangeEvents()])
      .then(([watchlist, events]) => {
        setEntries(watchlist)
        setChanges(events)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  async function handleCheck(watchlistId: string) {
    setCheckingId(watchlistId)
    try {
      const result = await checkRiskChanges(watchlistId)
      if (result.changes.length > 0) {
        // Refresh both lists
        const [watchlist, events] = await Promise.all([getRiskWatchlist(), getRiskChangeEvents()])
        setEntries(watchlist)
        setChanges(events)
      } else {
        // Just update lastCheckedAt locally
        setEntries((prev) =>
          prev.map((e) =>
            e.id === watchlistId ? { ...e, lastCheckedAt: new Date().toISOString() } : e,
          ),
        )
      }
    } catch {
      // silent
    } finally {
      setCheckingId(null)
    }
  }

  async function handleRemove(id: string) {
    try {
      await removeFromRiskWatchlist(id)
      setEntries((prev) => prev.filter((e) => e.id !== id))
    } catch {
      // silent
    }
  }

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-gray-900">Risk Watchlist</h1>
        <p className="text-sm text-gray-500 mt-1">Monitor properties for risk score changes over time</p>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200">
        <button
          onClick={() => setActiveTab('watchlist')}
          className={cn(
            'px-4 py-2 text-sm font-medium border-b-2 transition-colors',
            activeTab === 'watchlist'
              ? 'border-brand-600 text-brand-600'
              : 'border-transparent text-gray-500 hover:text-gray-700',
          )}
        >
          <Eye className="h-4 w-4 inline mr-1.5" />
          Watching ({entries.length})
        </button>
        <button
          onClick={() => setActiveTab('changes')}
          className={cn(
            'px-4 py-2 text-sm font-medium border-b-2 transition-colors',
            activeTab === 'changes'
              ? 'border-brand-600 text-brand-600'
              : 'border-transparent text-gray-500 hover:text-gray-700',
          )}
        >
          <Bell className="h-4 w-4 inline mr-1.5" />
          Changes ({changes.length})
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-gray-300 border-t-brand-600" />
        </div>
      ) : activeTab === 'watchlist' ? (
        /* Watchlist tab */
        <div className="rounded-lg border border-gray-200 bg-white">
          {entries.length === 0 ? (
            <div className="flex flex-col items-center py-12 text-gray-400">
              <Eye className="h-10 w-10 mb-2" />
              <p className="text-sm">No properties on your watchlist</p>
              <p className="text-xs mt-1">Add properties from the property detail page</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {entries.map((entry) => (
                <div key={entry.id} className="px-4 py-3 hover:bg-gray-50 transition-colors">
                  <div className="flex items-center gap-4">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-50">
                      <Eye className="h-4 w-4 text-blue-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      {entry.property && (
                        <p className="text-sm font-medium text-gray-900 truncate">
                          {entry.property.address}, {entry.property.city}, {entry.property.state}
                        </p>
                      )}
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-[10px] text-gray-400">
                          Added {new Date(entry.addedAt).toLocaleDateString()}
                        </span>
                        {entry.lastCheckedAt && (
                          <>
                            <span className="text-[10px] text-gray-300">|</span>
                            <span className="text-[10px] text-gray-400">
                              Last checked: {new Date(entry.lastCheckedAt).toLocaleDateString()}
                            </span>
                          </>
                        )}
                        {entry.changeEvents && entry.changeEvents.length > 0 && (
                          <>
                            <span className="text-[10px] text-gray-300">|</span>
                            <span className="text-[10px] text-amber-600 font-medium">
                              {entry.changeEvents.length} recent change{entry.changeEvents.length > 1 ? 's' : ''}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                    {/* Score badges */}
                    <div className="hidden md:flex items-center gap-2">
                      <ScoreBadge score={entry.lastKnownOverallScore} label="Overall" />
                      <ScoreBadge score={entry.lastKnownFloodScore} label="Flood" />
                      <ScoreBadge score={entry.lastKnownFireScore} label="Fire" />
                      <ScoreBadge score={entry.lastKnownWindScore} label="Wind" />
                      <ScoreBadge score={entry.lastKnownEarthquakeScore} label="Quake" />
                      <ScoreBadge score={entry.lastKnownCrimeScore} label="Crime" />
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        onClick={() => handleCheck(entry.id)}
                        disabled={checkingId === entry.id}
                        className="flex items-center gap-1 rounded-md bg-blue-50 px-2 py-1.5 text-xs font-medium text-blue-600 hover:bg-blue-100 disabled:opacity-50 transition-colors"
                        title="Check for changes"
                      >
                        <RefreshCw className={cn('h-3 w-3', checkingId === entry.id && 'animate-spin')} />
                        Check
                      </button>
                      <button
                        onClick={() => handleRemove(entry.id)}
                        className="text-gray-300 hover:text-red-500 transition-colors"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                      {entry.property && (
                        <Link href={`/properties/${entry.propertyId}`} className="text-gray-400 hover:text-brand-600">
                          <ChevronRight className="h-4 w-4" />
                        </Link>
                      )}
                    </div>
                  </div>
                  {/* Mobile score row */}
                  <div className="flex items-center gap-2 mt-2 md:hidden">
                    <ScoreBadge score={entry.lastKnownOverallScore} label="Overall" />
                    <ScoreBadge score={entry.lastKnownFloodScore} label="Flood" />
                    <ScoreBadge score={entry.lastKnownFireScore} label="Fire" />
                    <ScoreBadge score={entry.lastKnownWindScore} label="Wind" />
                    <ScoreBadge score={entry.lastKnownEarthquakeScore} label="Quake" />
                    <ScoreBadge score={entry.lastKnownCrimeScore} label="Crime" />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        /* Changes tab */
        <div className="rounded-lg border border-gray-200 bg-white">
          {changes.length === 0 ? (
            <div className="flex flex-col items-center py-12 text-gray-400">
              <Bell className="h-10 w-10 mb-2" />
              <p className="text-sm">No risk changes detected yet</p>
              <p className="text-xs mt-1">Check your watchlist properties to detect score changes</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {changes.map((event) => {
                const increased = event.newScore > event.previousScore
                return (
                  <div key={event.id} className="flex items-center gap-4 px-4 py-3 hover:bg-gray-50 transition-colors">
                    <div className={cn(
                      'flex h-8 w-8 shrink-0 items-center justify-center rounded-full',
                      increased ? 'bg-red-100' : 'bg-green-100',
                    )}>
                      {increased ? (
                        <TrendingUp className="h-4 w-4 text-red-600" />
                      ) : (
                        <TrendingDown className="h-4 w-4 text-green-600" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-gray-900 capitalize">
                          {event.riskDimension} Risk
                        </span>
                        <ChangeIndicator prev={event.previousScore} curr={event.newScore} />
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <span className={cn('text-[10px] font-medium rounded px-1 py-0.5', riskLevelClasses(event.previousLevel))}>
                          {event.previousLevel}
                        </span>
                        <span className="text-[10px] text-gray-400">→</span>
                        <span className={cn('text-[10px] font-medium rounded px-1 py-0.5', riskLevelClasses(event.newLevel))}>
                          {event.newLevel}
                        </span>
                        <span className="text-[10px] text-gray-400 ml-2">
                          Score: {event.previousScore} → {event.newScore}
                        </span>
                      </div>
                      {(event as RiskChangeEvent & { property?: { address: string; city: string; state: string } }).property && (
                        <p className="text-xs text-gray-500 mt-1">
                          {(event as RiskChangeEvent & { property: { address: string; city: string; state: string } }).property.address},{' '}
                          {(event as RiskChangeEvent & { property: { address: string; city: string; state: string } }).property.city}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-[10px] text-gray-400">
                        {new Date(event.detectedAt).toLocaleDateString()}
                      </span>
                      <Link href={`/properties/${event.propertyId}`} className="text-gray-400 hover:text-brand-600">
                        <ChevronRight className="h-4 w-4" />
                      </Link>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
