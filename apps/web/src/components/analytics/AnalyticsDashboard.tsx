'use client'

import { useEffect, useState, useCallback } from 'react'
import type { AnalyticsSummary } from '@coverguard/shared'
import { getAnalytics } from '@/lib/api'
import { ReportsContent } from '@/components/reports/ReportsContent'
import { AnalyticsHeroStats } from './AnalyticsHeroStats'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  rectSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import {
  Shield,
  TrendingUp,
  AlertTriangle,
  Users,
  FileText,
  CheckCircle,
  Activity,
  Clock,
  MapPin,
  Droplets,
  Flame,
  Wind,
  Mountain,
  ShieldAlert,
  DollarSign,
  GripVertical,
  Plus,
  X,
  Eye,
  EyeOff,
  RotateCcw,
  Settings2,
} from 'lucide-react'

// Panel definition
interface PanelConfig {
  id: string
  title: string
  type: 'reports' | 'stats' | 'activity-chart' | 'risk-donut' | 'quote-donut' | 'pipeline-donut' | 'weekly-bars' | 'state-checks' | 'recent-activity' | 'monthly-volume' | 'risk-scores' | 'risk-table' | 'top-risk-states' | 'custom-note'
  size: 'full' | 'half' | 'third'
  visible: boolean
  customContent?: string
}

const DEFAULT_PANELS: PanelConfig[] = [
  { id: 'reports', title: 'Property Reports', type: 'reports', size: 'full', visible: true },
  { id: 'stats-row-1', title: 'Key Metrics', type: 'stats', size: 'full', visible: true },
  { id: 'activity-chart', title: 'Activity — Last 30 Days', type: 'activity-chart', size: 'full', visible: true },
  { id: 'risk-donut', title: 'Risk Level Distribution', type: 'risk-donut', size: 'third', visible: true },
  { id: 'quote-donut', title: 'Quote Request Status', type: 'quote-donut', size: 'third', visible: true },
  { id: 'pipeline-donut', title: 'Client Pipeline', type: 'pipeline-donut', size: 'third', visible: true },
  { id: 'weekly-bars', title: 'Checks — Last 4 Weeks', type: 'weekly-bars', size: 'third', visible: true },
  { id: 'state-checks', title: 'Checks by State', type: 'state-checks', size: 'third', visible: true },
  { id: 'recent-activity', title: 'Recent Activity', type: 'recent-activity', size: 'third', visible: true },
  { id: 'monthly-volume', title: 'Search Volume — Last 12 Months', type: 'monthly-volume', size: 'full', visible: true },
  { id: 'risk-scores', title: 'Average Risk Scores', type: 'risk-scores', size: 'half', visible: true },
  { id: 'risk-table', title: 'Risk Breakdown by State', type: 'risk-table', size: 'full', visible: true },
  { id: 'top-risk-states', title: 'Highest Risk by Category', type: 'top-risk-states', size: 'full', visible: true },
]

const STORAGE_KEY = 'coverguard-analytics-panels'

function loadPanels(): PanelConfig[] {
  if (typeof window === 'undefined') return DEFAULT_PANELS
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) {
      const parsed = JSON.parse(stored) as PanelConfig[]
      // Merge with defaults to pick up any new panels added in updates
      const storedIds = new Set(parsed.map((p) => p.id))
      const merged = [
        ...parsed,
        ...DEFAULT_PANELS.filter((d) => !storedIds.has(d.id)),
      ]
      return merged
    }
  } catch { /* ignore */ }
  return DEFAULT_PANELS
}

function savePanels(panels: PanelConfig[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(panels))
  } catch { /* ignore */ }
}

// Donut SVG
function DonutChart({
  segments,
  size = 90,
}: {
  segments: Array<{ value: number; color: string; label: string }>
  size?: number
}) {
  const total = segments.reduce((s, x) => s + x.value, 0)
  if (total === 0) {
    return (
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={size / 2} cy={size / 2} r={size * 0.4} fill="none" stroke="#e5e7eb" strokeWidth={size * 0.15} />
      </svg>
    )
  }

  const R = size * 0.4
  const r = size * 0.25
  const cx = size / 2
  const cy = size / 2

  function arc(value: number, cumulativeBefore: number) {
    const angle = (value / total) * 2 * Math.PI
    const startAngle = cumulativeBefore * 2 * Math.PI - Math.PI / 2
    const endAngle = (cumulativeBefore + value / total) * 2 * Math.PI - Math.PI / 2
    const x1 = cx + R * Math.cos(startAngle)
    const y1 = cy + R * Math.sin(startAngle)
    const x2 = cx + R * Math.cos(endAngle)
    const y2 = cy + R * Math.sin(endAngle)
    const ix1 = cx + r * Math.cos(startAngle)
    const iy1 = cy + r * Math.sin(startAngle)
    const ix2 = cx + r * Math.cos(endAngle)
    const iy2 = cy + r * Math.sin(endAngle)
    const large = angle > Math.PI ? 1 : 0
    return `M ${x1} ${y1} A ${R} ${R} 0 ${large} 1 ${x2} ${y2} L ${ix2} ${iy2} A ${r} ${r} 0 ${large} 0 ${ix1} ${iy1} Z`
  }

  const cumulativeStarts = segments.map((_, i) =>
    segments.slice(0, i).reduce((sum, s) => sum + s.value / total, 0)
  )

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      {segments.map((seg, i) => (
        <path key={i} d={arc(seg.value, cumulativeStarts[i] ?? 0)} fill={seg.color} />
      ))}
    </svg>
  )
}

// Line chart
function LineChart({ data }: { data: Array<{ date: string; checks: number; quotes: number }> }) {
  if (data.length === 0) return null
  const maxVal = Math.max(...data.flatMap((d) => [d.checks, d.quotes]), 1)
  const W = 600
  const H = 70
  const pad = 8

  function pts(key: 'checks' | 'quotes') {
    return data
      .map((d, i) => {
        const x = pad + (i / (data.length - 1)) * (W - 2 * pad)
        const y = H - pad - ((d[key] ?? 0) / maxVal) * (H - 2 * pad)
        return `${x},${y}`
      })
      .join(' ')
  }

  const xLabels = [data[0], data[Math.floor(data.length / 4)], data[Math.floor(data.length / 2)], data[Math.floor(3 * data.length / 4)], data[data.length - 1]].filter(Boolean)

  return (
    <div className="w-full overflow-hidden">
      <svg viewBox={`0 0 ${W} ${H + 18}`} className="w-full">
        <polyline points={pts('checks')} fill="none" stroke="#3b82f6" strokeWidth="2" strokeLinejoin="round" />
        <polyline points={pts('quotes')} fill="none" stroke="#10b981" strokeWidth="2" strokeLinejoin="round" strokeDasharray="4 2" />
        {xLabels.map((d, i) => {
          const idx = data.indexOf(d!)
          const x = pad + (idx / (data.length - 1)) * (W - 2 * pad)
          return (
            <text key={i} x={x} y={H + 12} textAnchor="middle" fontSize="9" fill="#9ca3af">
              {d!.date.slice(5)}
            </text>
          )
        })}
      </svg>
      <div className="flex items-center gap-3 mt-0.5 text-[10px] text-gray-500">
        <div className="flex items-center gap-1"><span className="h-0.5 w-4 bg-blue-500 inline-block" />Checks</div>
        <div className="flex items-center gap-1"><span className="h-0.5 w-4 bg-emerald-500 inline-block" />Quotes</div>
      </div>
    </div>
  )
}

// Bar chart
function BarChart({ data, color = 'bg-amber-400' }: { data: Array<{ label: string; value: number }>; color?: string }) {
  const max = Math.max(...data.map((d) => d.value), 1)
  return (
    <div className="flex items-end gap-1.5 h-20">
      {data.map(({ label, value }) => (
        <div key={label} className="flex flex-col items-center gap-0.5 flex-1">
          <div className={`w-full rounded-t ${color} transition-all min-h-[3px]`} style={{ height: `${(value / max) * 100}%` }} />
          <span className="text-[9px] text-gray-500 truncate w-full text-center">{label}</span>
        </div>
      ))}
    </div>
  )
}

// Monthly bar chart
function MonthlyBarChart({ data }: { data: Array<{ month: string; count: number }> }) {
  const max = Math.max(...data.map((d) => d.count), 1)
  return (
    <div className="flex items-end gap-1 h-28">
      {data.map(({ month, count }) => {
        const label = new Date(month + '-01').toLocaleDateString('en-US', { month: 'short' })
        return (
          <div key={month} className="flex flex-col items-center gap-0.5 flex-1">
            <span className="text-[8px] text-gray-400">{count > 0 ? count : ''}</span>
            <div className="w-full rounded-t bg-blue-400 transition-all min-h-[2px]" style={{ height: `${(count / max) * 100}%` }} />
            <span className="text-[8px] text-gray-500">{label}</span>
          </div>
        )
      })}
    </div>
  )
}

// Score bar
function ScoreBar({ score, label, color }: { score: number; label: string; color: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-[10px] text-gray-500 w-20 shrink-0">{label}</span>
      <div className="flex-1 h-1.5 rounded-full bg-gray-100 overflow-hidden">
        <div className="h-1.5 rounded-full transition-all" style={{ width: `${score}%`, background: color }} />
      </div>
      <span className="text-[10px] font-medium text-gray-600 w-6 text-right">{score}</span>
    </div>
  )
}

// Risk badge
function RiskBadge({ level }: { level: string }) {
  const colors: Record<string, string> = {
    LOW: 'bg-green-100 text-green-700',
    MODERATE: 'bg-blue-100 text-blue-700',
    HIGH: 'bg-red-100 text-red-700',
    VERY_HIGH: 'bg-red-200 text-red-800',
    EXTREME: 'bg-purple-100 text-purple-700',
  }
  return (
    <span className={`px-1.5 py-0.5 rounded text-[9px] font-semibold ${colors[level] ?? 'bg-gray-100 text-gray-600'}`}>
      {level.replace('_', ' ')}
    </span>
  )
}

const RISK_COLORS: Record<string, string> = {
  LOW: '#22c55e', MODERATE: '#3b82f6', HIGH: '#ef4444', VERY_HIGH: '#dc2626', EXTREME: '#7c3aed',
}

const riskScoreMap: Record<string, number> = {
  LOW: 85, MODERATE: 65, HIGH: 45, VERY_HIGH: 25, EXTREME: 10,
}

// Score cell
function ScoreCell({ score }: { score: number }) {
  const color =
    score >= 70 ? 'text-red-600 font-semibold' :
    score >= 50 ? 'text-amber-600 font-medium' :
    score >= 30 ? 'text-blue-600' : 'text-green-600'
  return <span className={`text-[10px] ${color}`}>{score}</span>
}

function MiniStat({ label, sub, value, icon }: { label: string; sub: string; value: number | string; icon: React.ReactNode }) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-3">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-[9px] font-semibold text-gray-400 uppercase tracking-wider">{label}</p>
          <p className="text-xl font-bold text-gray-900 mt-0.5">{value}</p>
          <p className="text-[9px] text-gray-400">{sub}</p>
        </div>
        <div>{icon}</div>
      </div>
    </div>
  )
}

// Sortable panel wrapper
function SortablePanel({
  panel,
  children,
  onToggleVisibility,
}: {
  panel: PanelConfig
  children: React.ReactNode
  onToggleVisibility: (id: string) => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: panel.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 50 : 'auto' as const,
  }

  const sizeClass =
    panel.size === 'full' ? 'col-span-3' :
    panel.size === 'half' ? 'col-span-3 lg:col-span-2' :
    'col-span-3 md:col-span-1'

  if (!panel.visible) return null

  return (
    <div ref={setNodeRef} style={style} className={`${sizeClass} group`}>
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden h-full">
        <div className="flex items-center gap-1.5 px-3 py-2 border-b border-gray-100 bg-gray-50/50">
          <button
            {...attributes}
            {...listeners}
            className="cursor-grab active:cursor-grabbing p-0.5 rounded hover:bg-gray-200 transition-colors touch-none"
            title="Drag to reorder"
          >
            <GripVertical className="h-3.5 w-3.5 text-gray-400" />
          </button>
          <h3 className="text-xs font-semibold text-gray-700 flex-1 truncate">{panel.title}</h3>
          <button
            onClick={() => onToggleVisibility(panel.id)}
            className="p-0.5 rounded hover:bg-gray-200 transition-colors opacity-0 group-hover:opacity-100"
            title="Hide panel"
          >
            <EyeOff className="h-3 w-3 text-gray-400" />
          </button>
        </div>
        <div className="p-3">{children}</div>
      </div>
    </div>
  )
}

// Custom note panel content
function CustomNoteContent({ content, onChange }: { content: string; onChange: (val: string) => void }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(content)

  if (editing) {
    return (
      <div className="space-y-2">
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          className="w-full text-xs border border-gray-200 rounded-md p-2 resize-none focus:ring-1 focus:ring-teal-400 focus:border-teal-400 outline-none"
          rows={4}
          placeholder="Add your notes here..."
          autoFocus
        />
        <div className="flex gap-2">
          <button
            onClick={() => { onChange(draft); setEditing(false) }}
            className="text-[10px] font-semibold bg-teal-500 hover:bg-teal-600 text-white px-3 py-1 rounded transition-colors"
          >
            Save
          </button>
          <button
            onClick={() => { setDraft(content); setEditing(false) }}
            className="text-[10px] font-semibold text-gray-500 hover:text-gray-700 px-3 py-1 rounded border border-gray-200 transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    )
  }

  return (
    <div
      onClick={() => setEditing(true)}
      className="text-xs text-gray-600 cursor-pointer hover:bg-gray-50 rounded p-1 min-h-[40px] transition-colors"
    >
      {content || <span className="text-gray-400 italic">Click to add notes...</span>}
    </div>
  )
}

// Main component
export function AnalyticsDashboard() {
  const [data, setData] = useState<AnalyticsSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  // Initialize with defaults so server and first client render agree
  // (see React error #418). The persisted panel configuration is then
  // loaded from localStorage after mount. Same hydration-safe pattern
  // as DemoDataToggle in components/analytics/AnalyticsHeroStats.tsx.
  const [panels, setPanels] = useState<PanelConfig[]>(DEFAULT_PANELS)
  const [showSettings, setShowSettings] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPanels(loadPanels())
    const t = requestAnimationFrame(() => setMounted(true))
    return () => cancelAnimationFrame(t)
  }, [])

  useEffect(() => {
    getAnalytics()
      .then(setData)
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load analytics'))
      .finally(() => setLoading(false))
  }, [])

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const updatePanels = useCallback((newPanels: PanelConfig[]) => {
    setPanels(newPanels)
    savePanels(newPanels)
  }, [])

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIndex = panels.findIndex((p) => p.id === active.id)
    const newIndex = panels.findIndex((p) => p.id === over.id)
    if (oldIndex === -1 || newIndex === -1) return
    updatePanels(arrayMove(panels, oldIndex, newIndex))
  }

  function toggleVisibility(id: string) {
    updatePanels(panels.map((p) => p.id === id ? { ...p, visible: !p.visible } : p))
  }

  function resetLayout() {
    updatePanels(DEFAULT_PANELS)
  }

  function addCustomPanel() {
    const id = `custom-${Date.now()}`
    updatePanels([...panels, {
      id,
      title: 'Custom Note',
      type: 'custom-note',
      size: 'third',
      visible: true,
      customContent: '',
    }])
  }

  function updateCustomContent(id: string, content: string) {
    updatePanels(panels.map((p) => p.id === id ? { ...p, customContent: content } : p))
  }

  function removePanel(id: string) {
    updatePanels(panels.filter((p) => p.id !== id))
  }

  function changePanelSize(id: string, size: 'full' | 'half' | 'third') {
    updatePanels(panels.map((p) => p.id === id ? { ...p, size } : p))
  }

  if (loading) return <AnalyticsSkeleton />

  if (error) {
    return (
      <div className="p-4 lg:p-5 max-w-full mx-auto">
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-center">
          <AlertTriangle className="mx-auto h-6 w-6 text-red-400 mb-1.5" />
          <p className="font-semibold text-red-700 text-sm">Failed to load analytics</p>
          <p className="text-xs text-red-500 mt-1">{error}</p>
          <button
            onClick={() => { setError(null); setLoading(true); getAnalytics().then(setData).catch((e) => setError(e instanceof Error ? e.message : 'Failed')).finally(() => setLoading(false)) }}
            className="mt-3 px-3 py-1.5 text-xs font-semibold bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    )
  }

  const visiblePanels = panels.filter((p) => p.visible)
  const hiddenPanels = panels.filter((p) => !p.visible)

  return (
    <div className="p-3 lg:p-4 max-w-full mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Activity className="h-5 w-5 text-blue-600" />
          <h1 className="text-heading text-foreground">Analytics &amp; Reports</h1>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={addCustomPanel}
            className="flex items-center gap-1 text-caption font-semibold text-teal-600 hover:text-teal-700 border border-teal-200 hover:border-teal-300 bg-teal-50 hover:bg-teal-100 px-2.5 py-1.5 rounded-lg transition-colors"
          >
            <Plus className="h-3 w-3" />
            Add Panel
          </button>
          <button
            onClick={() => setShowSettings(!showSettings)}
            className={`flex items-center gap-1 text-caption font-semibold px-2.5 py-1.5 rounded-lg transition-colors border ${
              showSettings
                ? 'text-blue-700 border-blue-300 bg-blue-100'
                : 'text-gray-600 hover:text-gray-700 border-gray-200 hover:border-gray-300 bg-gray-50 hover:bg-gray-100'
            }`}
          >
            <Settings2 className="h-3 w-3" />
            Customize
          </button>
        </div>
      </div>

      {/* Hero stats strip — large-type KPIs + demo-mode toggle */}
      <AnalyticsHeroStats
        data={data}
        onDemoModeChange={() => {
          setLoading(true)
          getAnalytics()
            .then(setData)
            .catch((e) => setError(e instanceof Error ? e.message : 'Failed'))
            .finally(() => setLoading(false))
        }}
      />


      {/* Panel settings drawer */}
      {showSettings && (
        <div className="mb-3 bg-white rounded-lg border border-gray-200 p-3">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-xs font-semibold text-gray-700">Panel Settings</h3>
            <button onClick={resetLayout} className="flex items-center gap-1 text-[10px] text-gray-500 hover:text-gray-700 transition-colors">
              <RotateCcw className="h-3 w-3" />
              Reset Layout
            </button>
          </div>
          <p className="text-[10px] text-gray-400 mb-2">Drag panels to reorder. Toggle visibility below. Click panel size to change.</p>
          <div className="flex flex-wrap gap-1.5">
            {panels.map((p) => (
              <div key={p.id} className={`flex items-center gap-1.5 text-[10px] px-2 py-1 rounded-full border transition-colors ${
                p.visible ? 'bg-teal-50 border-teal-200 text-teal-700' : 'bg-gray-50 border-gray-200 text-gray-400'
              }`}>
                <button onClick={() => toggleVisibility(p.id)} className="hover:opacity-70">
                  {p.visible ? <Eye className="h-2.5 w-2.5" /> : <EyeOff className="h-2.5 w-2.5" />}
                </button>
                <span className="font-medium">{p.title}</span>
                {p.visible && (
                  <select
                    value={p.size}
                    onChange={(e) => changePanelSize(p.id, e.target.value as 'full' | 'half' | 'third')}
                    className="text-[9px] bg-transparent border-none outline-none cursor-pointer"
                  >
                    <option value="third">1/3</option>
                    <option value="half">2/3</option>
                    <option value="full">Full</option>
                  </select>
                )}
                {p.type === 'custom-note' && (
                  <button onClick={() => removePanel(p.id)} className="hover:text-red-500"><X className="h-2.5 w-2.5" /></button>
                )}
              </div>
            ))}
          </div>
          {hiddenPanels.length > 0 && (
            <p className="text-[9px] text-gray-400 mt-2">{hiddenPanels.length} hidden panel{hiddenPanels.length > 1 ? 's' : ''}</p>
          )}
        </div>
      )}

      {/* Draggable panels grid */}
      {mounted && (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={visiblePanels.map((p) => p.id)} strategy={rectSortingStrategy}>
            <div className="grid grid-cols-3 gap-3">
              {visiblePanels.map((panel) => (
                <SortablePanel key={panel.id} panel={panel} onToggleVisibility={toggleVisibility}>
                  <PanelContent panel={panel} data={data} onUpdateCustom={updateCustomContent} />
                </SortablePanel>
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}
    </div>
  )
}

// Panel content router
function PanelContent({
  panel,
  data,
  onUpdateCustom,
}: {
  panel: PanelConfig
  data: AnalyticsSummary | null
  onUpdateCustom: (id: string, content: string) => void
}) {
  switch (panel.type) {
    case 'reports':
      return <ReportsContent embedded />
    case 'stats':
      return data ? <StatsContent data={data} /> : <EmptyState />
    case 'activity-chart':
      return data ? <ActivityChartContent data={data} /> : <EmptyState />
    case 'risk-donut':
      return data ? <RiskDonutContent data={data} /> : <EmptyState />
    case 'quote-donut':
      return data ? <QuoteDonutContent data={data} /> : <EmptyState />
    case 'pipeline-donut':
      return data ? <PipelineDonutContent data={data} /> : <EmptyState />
    case 'weekly-bars':
      return data ? <WeeklyBarsContent data={data} /> : <EmptyState />
    case 'state-checks':
      return data ? <StateChecksContent data={data} /> : <EmptyState />
    case 'recent-activity':
      return data ? <RecentActivityContent data={data} /> : <EmptyState />
    case 'monthly-volume':
      return data ? <MonthlyVolumeContent data={data} /> : <EmptyState />
    case 'risk-scores':
      return data ? <RiskScoresContent data={data} /> : <EmptyState />
    case 'risk-table':
      return data ? <RiskTableContent data={data} /> : <EmptyState />
    case 'top-risk-states':
      return data ? <TopRiskStatesContent data={data} /> : <EmptyState />
    case 'custom-note':
      return <CustomNoteContent content={panel.customContent ?? ''} onChange={(val) => onUpdateCustom(panel.id, val)} />
    default:
      return <EmptyState />
  }
}

function EmptyState() {
  return <p className="text-[10px] text-gray-400 text-center py-4">No data available</p>
}

// Panel content components
function StatsContent({ data }: { data: AnalyticsSummary }) {
  const riskDist = data.riskDistribution ?? []
  const totalRiskItems = riskDist.reduce((s, r) => s + r.count, 0)
  const avgScore = totalRiskItems > 0
    ? Math.round(riskDist.reduce((s, r) => s + (riskScoreMap[r.level] ?? 50) * r.count, 0) / totalRiskItems)
    : 0
  const highRisk = riskDist.filter((r) => r.level === 'HIGH' || r.level === 'VERY_HIGH' || r.level === 'EXTREME').reduce((s, r) => s + r.count, 0)
  const quotes = data.quoteRequests

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-4 gap-2">
        <MiniStat label="TOTAL CHECKS" sub="all time" value={data.totalSearches} icon={<Shield className="h-3.5 w-3.5 text-blue-500" />} />
        <MiniStat label="AVG SCORE" sub="insurability" value={avgScore} icon={<TrendingUp className="h-3.5 w-3.5 text-emerald-500" />} />
        <MiniStat label="HIGH RISK" sub="score < 40" value={highRisk} icon={<AlertTriangle className="h-3.5 w-3.5 text-red-400" />} />
        <MiniStat label="ACTIVE CLIENTS" sub={`${data.totalClients} total`} value={data.totalClients} icon={<Users className="h-3.5 w-3.5 text-purple-400" />} />
      </div>
      <div className="grid grid-cols-4 gap-2">
        <MiniStat label="QUOTES" sub="all time" value={quotes.total} icon={<FileText className="h-3.5 w-3.5 text-orange-400" />} />
        <MiniStat label="RESPONDED" sub="carrier replied" value={quotes.responded} icon={<CheckCircle className="h-3.5 w-3.5 text-emerald-500" />} />
        <MiniStat label="PENDING" sub="awaiting" value={quotes.pending} icon={<Clock className="h-3.5 w-3.5 text-amber-400" />} />
        <MiniStat label="AVG PREMIUM" sub="annual est." value={data.avgInsuranceCost != null ? `$${data.avgInsuranceCost.toLocaleString()}` : '\u2014'} icon={<DollarSign className="h-3.5 w-3.5 text-green-500" />} />
      </div>
    </div>
  )
}

function ActivityChartContent({ data }: { data: AnalyticsSummary }) {
  const activityData = (data.searchesByDay ?? []).length > 0
    ? data.searchesByDay.map((d) => ({ date: d.date, checks: d.count, quotes: 0 }))
    : Array.from({ length: 30 }, (_, i) => {
        const d = new Date()
        d.setDate(d.getDate() - (29 - i))
        return { date: d.toISOString().slice(0, 10), checks: 0, quotes: 0 }
      })
  return <LineChart data={activityData} />
}

function RiskDonutContent({ data }: { data: AnalyticsSummary }) {
  const riskDist = data.riskDistribution ?? []
  const segments = riskDist.length > 0
    ? riskDist.map((r) => ({ value: r.count, color: RISK_COLORS[r.level] ?? '#94a3b8', label: `${r.level.charAt(0) + r.level.slice(1).toLowerCase().replace('_', ' ')} ${r.count}` }))
    : [{ value: 1, color: '#e5e7eb', label: 'No data' }]
  return (
    <div className="flex flex-col items-center gap-2">
      <DonutChart segments={segments} size={90} />
      <div className="space-y-0.5">
        {segments.map((s) => (
          <div key={s.label} className="flex items-center gap-1.5 text-[10px]">
            <span className="h-1.5 w-1.5 rounded-full shrink-0" style={{ background: s.color }} />
            <span className="text-gray-500">{s.label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function QuoteDonutContent({ data }: { data: AnalyticsSummary }) {
  const quotes = data.quoteRequests
  const segments = quotes.total > 0
    ? [
        { value: quotes.pending, color: '#f59e0b', label: `Pending ${quotes.pending}` },
        { value: quotes.sent, color: '#3b82f6', label: `Sent ${quotes.sent}` },
        { value: quotes.responded, color: '#22c55e', label: `Responded ${quotes.responded}` },
        { value: quotes.declined, color: '#ef4444', label: `Declined ${quotes.declined}` },
      ].filter((s) => s.value > 0)
    : [{ value: 1, color: '#e5e7eb', label: 'No quotes yet' }]
  return (
    <div className="flex flex-col items-center gap-2">
      <DonutChart segments={segments} size={90} />
      <div className="space-y-0.5">
        {segments.map((s) => (
          <div key={s.label} className="flex items-center gap-1.5 text-[10px]">
            <span className="h-1.5 w-1.5 rounded-full shrink-0" style={{ background: s.color }} />
            <span className="text-gray-500">{s.label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function PipelineDonutContent({ data }: { data: AnalyticsSummary }) {
  const pipeline = data.clientPipeline
  const total = pipeline.active + pipeline.prospect + pipeline.closed + pipeline.inactive
  const segments = total > 0
    ? [
        { value: pipeline.active, color: '#22c55e', label: `Active ${pipeline.active}` },
        { value: pipeline.prospect, color: '#3b82f6', label: `Prospect ${pipeline.prospect}` },
        { value: pipeline.closed, color: '#6b7280', label: `Closed ${pipeline.closed}` },
        { value: pipeline.inactive, color: '#d1d5db', label: `Inactive ${pipeline.inactive}` },
      ].filter((s) => s.value > 0)
    : [{ value: 1, color: '#e5e7eb', label: 'No clients yet' }]
  return (
    <div className="flex flex-col items-center gap-2">
      <DonutChart segments={segments} size={90} />
      <div className="space-y-0.5">
        {segments.map((s) => (
          <div key={s.label} className="flex items-center gap-1.5 text-[10px]">
            <span className="h-1.5 w-1.5 rounded-full shrink-0" style={{ background: s.color }} />
            <span className="text-gray-500">{s.label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function WeeklyBarsContent({ data }: { data: AnalyticsSummary }) {
  const searchDays = data.searchesByDay ?? []
  const weekBars = Array.from({ length: 4 }, (_, wi) => {
    const weekEnd = 29 - wi * 7
    const weekStart = weekEnd - 6
    const count = searchDays.slice(Math.max(0, weekStart), weekEnd + 1).reduce((s, d) => s + d.count, 0)
    const endDate = new Date()
    endDate.setDate(endDate.getDate() - wi * 7)
    const startDate = new Date(endDate)
    startDate.setDate(startDate.getDate() - 6)
    const fmt = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    return { label: `${fmt(startDate)}`, value: count }
  }).reverse()
  return <BarChart data={weekBars} />
}

function StateChecksContent({ data }: { data: AnalyticsSummary }) {
  const stateChecks = (data.topStates ?? []).slice(0, 5)
  const maxCount = Math.max(...stateChecks.map((s) => s.count), 1)
  if (stateChecks.length === 0) return <p className="text-[10px] text-gray-400">No data yet.</p>
  return (
    <div className="space-y-2">
      {stateChecks.map((s, i) => (
        <div key={s.state} className="flex items-center gap-2">
          <span className="text-[10px] text-gray-400 w-3">{i + 1}</span>
          <span className="text-[10px] font-semibold text-gray-700 w-5">{s.state}</span>
          <div className="flex-1 h-1.5 rounded-full bg-gray-100 overflow-hidden">
            <div className="h-1.5 rounded-full bg-emerald-400" style={{ width: `${(s.count / maxCount) * 100}%` }} />
          </div>
          <span className="text-[10px] text-gray-400 w-5 text-right">{s.count}</span>
        </div>
      ))}
    </div>
  )
}

function RecentActivityContent({ data }: { data: AnalyticsSummary }) {
  const items = data.recentActivity ?? []
  if (items.length === 0) return <p className="text-[10px] text-gray-400">No activity yet.</p>
  return (
    <div className="space-y-1.5">
      {items.slice(0, 7).map((item, i) => (
        <div key={i} className="flex items-start gap-1.5 text-[10px]">
          <span className={`mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full ${
            item.type === 'search' ? 'bg-blue-400' : item.type === 'save' ? 'bg-emerald-400' : 'bg-purple-400'
          }`} />
          <span className="flex-1 text-gray-600 truncate">{item.description}</span>
          <span className="text-gray-400 shrink-0">
            {new Date(item.timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
          </span>
        </div>
      ))}
    </div>
  )
}

function MonthlyVolumeContent({ data }: { data: AnalyticsSummary }) {
  const searchesByMonth = data.searchesByMonth ?? []
  if (searchesByMonth.length === 0) return <p className="text-[10px] text-gray-400 text-center py-4">No search data yet.</p>
  return <MonthlyBarChart data={searchesByMonth} />
}

function RiskScoresContent({ data }: { data: AnalyticsSummary }) {
  const regional = data.regionalRisk ?? []
  const riskCategories = [
    { key: 'avgFloodScore' as const, label: 'Flood', color: '#3b82f6' },
    { key: 'avgFireScore' as const, label: 'Fire', color: '#ef4444' },
    { key: 'avgWindScore' as const, label: 'Wind', color: '#6366f1' },
    { key: 'avgEarthquakeScore' as const, label: 'Earthquake', color: '#f59e0b' },
    { key: 'avgCrimeScore' as const, label: 'Crime', color: '#8b5cf6' },
  ]
  if (regional.length === 0) return <p className="text-[10px] text-gray-400">No data yet.</p>
  const categoryAverages = riskCategories.map((cat) => ({
    ...cat,
    avg: Math.round(regional.reduce((s, r) => s + r[cat.key], 0) / regional.length),
  }))
  return (
    <div className="space-y-2">
      {categoryAverages.map((cat) => (
        <ScoreBar key={cat.label} score={cat.avg} label={cat.label} color={cat.color} />
      ))}
    </div>
  )
}

function RiskTableContent({ data }: { data: AnalyticsSummary }) {
  const regional = data.regionalRisk ?? []
  if (regional.length === 0) {
    return (
      <div className="text-center py-6">
        <MapPin className="h-8 w-8 text-gray-200 mx-auto mb-2" />
        <p className="text-[10px] text-gray-400">Save properties to see regional risk trends.</p>
      </div>
    )
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-[10px]">
        <thead>
          <tr className="border-b border-gray-100">
            <th className="text-left font-semibold text-gray-500 py-1.5 pr-2">State</th>
            <th className="text-center font-semibold text-gray-500 py-1.5 px-1">Props</th>
            <th className="text-center font-semibold text-gray-500 py-1.5 px-1">Overall</th>
            <th className="text-center font-semibold text-gray-500 py-1.5 px-1">
              <span className="flex items-center justify-center gap-0.5"><Droplets className="h-2.5 w-2.5" />Flood</span>
            </th>
            <th className="text-center font-semibold text-gray-500 py-1.5 px-1">
              <span className="flex items-center justify-center gap-0.5"><Flame className="h-2.5 w-2.5" />Fire</span>
            </th>
            <th className="text-center font-semibold text-gray-500 py-1.5 px-1">
              <span className="flex items-center justify-center gap-0.5"><Wind className="h-2.5 w-2.5" />Wind</span>
            </th>
            <th className="text-center font-semibold text-gray-500 py-1.5 px-1">
              <span className="flex items-center justify-center gap-0.5"><Mountain className="h-2.5 w-2.5" />Quake</span>
            </th>
            <th className="text-center font-semibold text-gray-500 py-1.5 px-1">
              <span className="flex items-center justify-center gap-0.5"><ShieldAlert className="h-2.5 w-2.5" />Crime</span>
            </th>
            <th className="text-center font-semibold text-gray-500 py-1.5 px-1">Level</th>
          </tr>
        </thead>
        <tbody>
          {regional.map((r) => (
            <tr key={r.state} className="border-b border-gray-50 hover:bg-gray-50/50">
              <td className="py-1.5 pr-2 font-semibold text-gray-800">{r.state}</td>
              <td className="text-center py-1.5 px-1 text-gray-600">{r.propertyCount}</td>
              <td className="text-center py-1.5 px-1"><ScoreCell score={r.avgOverallScore} /></td>
              <td className="text-center py-1.5 px-1"><ScoreCell score={r.avgFloodScore} /></td>
              <td className="text-center py-1.5 px-1"><ScoreCell score={r.avgFireScore} /></td>
              <td className="text-center py-1.5 px-1"><ScoreCell score={r.avgWindScore} /></td>
              <td className="text-center py-1.5 px-1"><ScoreCell score={r.avgEarthquakeScore} /></td>
              <td className="text-center py-1.5 px-1"><ScoreCell score={r.avgCrimeScore} /></td>
              <td className="text-center py-1.5 px-1"><RiskBadge level={r.dominantRiskLevel} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function TopRiskStatesContent({ data }: { data: AnalyticsSummary }) {
  const regional = data.regionalRisk ?? []
  if (regional.length === 0) return <p className="text-[10px] text-gray-400">No data yet.</p>
  const riskCategories = [
    { key: 'avgFloodScore' as const, label: 'Flood', color: '#3b82f6' },
    { key: 'avgFireScore' as const, label: 'Fire', color: '#ef4444' },
    { key: 'avgWindScore' as const, label: 'Wind', color: '#6366f1' },
    { key: 'avgEarthquakeScore' as const, label: 'Earthquake', color: '#f59e0b' },
    { key: 'avgCrimeScore' as const, label: 'Crime', color: '#8b5cf6' },
  ]
  return (
    <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
      {riskCategories.map((cat) => {
        const sorted = [...regional].sort((a, b) => b[cat.key] - a[cat.key])
        const top3 = sorted.slice(0, 3)
        return (
          <div key={cat.label}>
            <h4 className="text-[10px] font-semibold text-gray-600 mb-2">Highest {cat.label}</h4>
            <div className="space-y-1.5">
              {top3.map((st, i) => (
                <div key={st.state} className="flex items-center gap-1.5">
                  <span className="text-[9px] text-gray-400 w-3">{i + 1}</span>
                  <span className="text-[9px] font-semibold text-gray-700 w-4">{st.state}</span>
                  <div className="flex-1 h-1.5 rounded-full bg-gray-100 overflow-hidden">
                    <div className="h-1.5 rounded-full" style={{ width: `${st[cat.key]}%`, background: cat.color }} />
                  </div>
                  <span className="text-[9px] text-gray-500 w-5 text-right">{st[cat.key]}</span>
                </div>
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function AnalyticsSkeleton() {
  return (
    <div className="p-4 max-w-full mx-auto space-y-3">
      <div className="h-7 w-44 bg-gray-100 animate-pulse rounded" />
      <div className="grid grid-cols-4 gap-2">
        {[1, 2, 3, 4].map((i) => <div key={i} className="h-16 rounded-lg bg-gray-100 animate-pulse" />)}
      </div>
      <div className="h-28 rounded-lg bg-gray-100 animate-pulse" />
      <div className="grid grid-cols-3 gap-3">
        {[1, 2, 3].map((i) => <div key={i} className="h-36 rounded-lg bg-gray-100 animate-pulse" />)}
      </div>
    </div>
  )
}
