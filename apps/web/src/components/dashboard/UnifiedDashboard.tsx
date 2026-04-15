'use client'



/**

 * UnifiedDashboard — the single landing page for every CoverGuard persona.

 *

 * Replaces the old AgentDashboard / ConsumerDashboard split and pulls the

 * analytics surface directly into Dashboard. No search bar here — search

 * lives on /search and in the global navbar.

 *

 * Sections:

 *   1. Role-aware hero with KPI rail and in-page persona switcher

 *   2. Analytics strip (activity line chart + risk donut + weekly bars

 *      + hazard mix + top markets + quote mix)

 *   3. Market Pulse — state-level carrier capacity & trend

 *   4. Saved properties with filters, search, sort, view toggle, bulk actions

 *   5. Active insurance carriers with filters, appetite meter, market condition

 *   6. Quote request pipeline with funnel visualization & aging

 *   7. Role-specific collaboration panel (Buyer ↔ Agent, Client tracker,

 *      CRE due-diligence, Lender obligations, Insurance intake)

 *   8. To-dos / checklists / follow-ups with tabs and inline add

 *   9. AI Advisor — forward-looking risk notes + chat composer

 *

 * All data is mock-populated so the page is useful before any backend

 * integration has run.

 */



import { useMemo, useState } from 'react'

import Link from 'next/link'

import {

  Activity,

  AlertTriangle,

  ArrowUpRight,

  Bot,

  Building2,

  CheckCircle2,

  ChevronRight,

  Clock,

  DollarSign,

  Droplets,

  FileText,

  Filter,

  Flame,

  Grid2x2,

  Handshake,

  Landmark,

  LayoutList,

  MapPin,

  MessageSquare,

  Plus,

  RefreshCw,

  Search as SearchIcon,

  Send,

  Shield,

  ShieldAlert,

  Sparkles,

  TrendingDown,

  TrendingUp,

  Users,

  Wind,

  Zap,

} from 'lucide-react'

import { cn } from '@/lib/utils'



// ─── Types ──────────────────────────────────────────────────────────────



type Role = 'BUYER' | 'AGENT' | 'LENDER' | 'INSURANCE' | 'ADMIN'

type AgentFlavor = 'RESIDENTIAL' | 'CRE'



interface UnifiedDashboardProps {

  role?: Role

  /** Optional display name for the hero greeting. */

  userName?: string

  /**

   * Override the agent flavor (residential vs commercial). In a real

   * implementation this would come from user metadata.

   */

  agentFlavor?: AgentFlavor

}



// ─── Mock data ──────────────────────────────────────────────────────────



type Hazard = 'flood' | 'fire' | 'wind' | 'quake'

type RiskBand = 'LOW' | 'MODERATE' | 'HIGH' | 'VERY_HIGH'



interface MockProperty {

  id: string

  address: string

  cityState: string

  state: string

  estValue: number

  riskScore: number // 0–100, lower is riskier

  topHazards: Hazard[]

  carrierCount: number

  reportUpdated: string

  savedFor?: string

}



const MOCK_PROPERTIES: MockProperty[] = [

  { id: 'p1', address: '1428 Ocean View Dr', cityState: 'Miami, FL', state: 'FL', estValue: 1_250_000, riskScore: 38, topHazards: ['flood', 'wind'], carrierCount: 4, reportUpdated: '2 days ago', savedFor: 'The Martins' },

  { id: 'p2', address: '907 Redwood Ridge', cityState: 'Napa, CA', state: 'CA', estValue: 2_100_000, riskScore: 42, topHazards: ['fire'], carrierCount: 2, reportUpdated: '5 hours ago', savedFor: 'Kim Family' },

  { id: 'p3', address: '44 Chestnut Hill Ln', cityState: 'Austin, TX', state: 'TX', estValue: 685_000, riskScore: 78, topHazards: ['wind'], carrierCount: 9, reportUpdated: 'yesterday', savedFor: 'J. Alvarez' },

  { id: 'p4', address: '22 Riverbend Ct', cityState: 'Charleston, SC', state: 'SC', estValue: 945_000, riskScore: 51, topHazards: ['flood'], carrierCount: 5, reportUpdated: '3 days ago' },

  { id: 'p5', address: '1300 High Desert Rd', cityState: 'Boise, ID', state: 'ID', estValue: 520_000, riskScore: 84, topHazards: [], carrierCount: 11, reportUpdated: 'today' },

  { id: 'p6', address: '88 Bayshore Blvd', cityState: 'Tampa, FL', state: 'FL', estValue: 1_675_000, riskScore: 34, topHazards: ['flood', 'wind'], carrierCount: 3, reportUpdated: '6 hours ago', savedFor: 'Chen Holdings' },

  { id: 'p7', address: '512 Pine Canyon Rd', cityState: 'Boulder, CO', state: 'CO', estValue: 895_000, riskScore: 58, topHazards: ['fire'], carrierCount: 6, reportUpdated: '4 days ago' },

  { id: 'p8', address: '19 Seaview Ter', cityState: 'Santa Cruz, CA', state: 'CA', estValue: 1_450_000, riskScore: 47, topHazards: ['fire', 'quake'], carrierCount: 3, reportUpdated: '1 day ago', savedFor: 'R. Singh' },

]



type CarrierStatus = 'WRITING' | 'RESTRICTED' | 'NON_RENEWING'

type MarketCondition = 'SOFT' | 'STABLE' | 'HARDENING' | 'HARD'



interface MockCarrier {

  id: string

  name: string

  state: string

  status: CarrierStatus

  avgPremium: number

  bindTime: string

  perils: string[]

  appetite: number // 0-100

  marketCondition: MarketCondition

}



const MOCK_CARRIERS: MockCarrier[] = [

  { id: 'c1', name: 'Heritage Specialty', state: 'FL', status: 'WRITING', avgPremium: 4650, bindTime: '24h', perils: ['Flood', 'Wind'], appetite: 72, marketCondition: 'HARDENING' },

  { id: 'c2', name: 'Pacific Select Home', state: 'CA', status: 'RESTRICTED', avgPremium: 5890, bindTime: '3–5d', perils: ['Fire'], appetite: 34, marketCondition: 'HARD' },

  { id: 'c3', name: 'Lone Star Mutual', state: 'TX', status: 'WRITING', avgPremium: 2180, bindTime: '24h', perils: ['Wind', 'Hail'], appetite: 88, marketCondition: 'SOFT' },

  { id: 'c4', name: 'Palmetto Coastal', state: 'SC', status: 'WRITING', avgPremium: 3420, bindTime: '48h', perils: ['Flood'], appetite: 65, marketCondition: 'STABLE' },

  { id: 'c5', name: 'Mountain West P&C', state: 'ID', status: 'WRITING', avgPremium: 1290, bindTime: '24h', perils: ['Fire'], appetite: 82, marketCondition: 'SOFT' },

  { id: 'c6', name: 'Coastal Surplus Lines', state: 'FL', status: 'NON_RENEWING', avgPremium: 7120, bindTime: '—', perils: ['Wind'], appetite: 12, marketCondition: 'HARD' },

  { id: 'c7', name: 'Rocky Mountain Re', state: 'CO', status: 'WRITING', avgPremium: 2450, bindTime: '48h', perils: ['Fire', 'Hail'], appetite: 58, marketCondition: 'STABLE' },

  { id: 'c8', name: 'Gulf Shores Mutual', state: 'FL', status: 'RESTRICTED', avgPremium: 5240, bindTime: '5d', perils: ['Flood', 'Wind'], appetite: 28, marketCondition: 'HARDENING' },

  { id: 'c9', name: 'Sierra Valley Ins', state: 'CA', status: 'WRITING', avgPremium: 3890, bindTime: '72h', perils: ['Fire', 'Quake'], appetite: 54, marketCondition: 'HARDENING' },

]



type QuoteStatus = 'PENDING' | 'SENT' | 'RESPONDED' | 'BOUND' | 'DECLINED'



interface MockQuote {

  id: string

  property: string

  carrier: string

  status: QuoteStatus

  premium?: number

  submitted: string

  ageDays: number

}



const MOCK_QUOTES: MockQuote[] = [

  { id: 'q1', property: '1428 Ocean View Dr', carrier: 'Heritage Specialty', status: 'RESPONDED', premium: 4820, submitted: '2d ago', ageDays: 2 },

  { id: 'q2', property: '907 Redwood Ridge', carrier: 'Pacific Select Home', status: 'PENDING', submitted: '5h ago', ageDays: 0 },

  { id: 'q3', property: '44 Chestnut Hill Ln', carrier: 'Lone Star Mutual', status: 'BOUND', premium: 2180, submitted: '1w ago', ageDays: 7 },

  { id: 'q4', property: '22 Riverbend Ct', carrier: 'Palmetto Coastal', status: 'SENT', submitted: '3d ago', ageDays: 3 },

  { id: 'q5', property: '1300 High Desert Rd', carrier: 'Mountain West P&C', status: 'RESPONDED', premium: 1290, submitted: '6h ago', ageDays: 0 },

  { id: 'q6', property: '88 Bayshore Blvd', carrier: 'Heritage Specialty', status: 'SENT', submitted: '6d ago', ageDays: 6 },

  { id: 'q7', property: '512 Pine Canyon Rd', carrier: 'Rocky Mountain Re', status: 'DECLINED', submitted: '4d ago', ageDays: 4 },

  { id: 'q8', property: '19 Seaview Ter', carrier: 'Sierra Valley Ins', status: 'PENDING', submitted: '1d ago', ageDays: 1 },

]



// 90-day activity trend (we slice per range)

const MOCK_ACTIVITY_90 = Array.from({ length: 90 }, (_, i) => {

  const base = 8 + Math.round(6 * Math.sin(i / 3.3))

  return {

    day: i + 1,

    checks: Math.max(2, base + (i % 5)),

    quotes: Math.max(0, Math.round(base / 2) + ((i + 2) % 3)),

  }

})



// Weekly bound volume (8 weeks)

const MOCK_WEEKLY_BOUND = [

  { label: 'W1', value: 4 },

  { label: 'W2', value: 7 },

  { label: 'W3', value: 5 },

  { label: 'W4', value: 9 },

  { label: 'W5', value: 12 },

  { label: 'W6', value: 8 },

  { label: 'W7', value: 11 },

  { label: 'W8', value: 14 },

]



// Hazard mix across all saved properties

const MOCK_HAZARD_MIX = [

  { label: 'Flood', value: 34, color: '#3b82f6', icon: 'flood' as const },

  { label: 'Fire', value: 28, color: '#ef4444', icon: 'fire' as const },

  { label: 'Wind', value: 22, color: '#0ea5e9', icon: 'wind' as const },

  { label: 'Quake', value: 9, color: '#a855f7', icon: 'quake' as const },

  { label: 'Hail', value: 7, color: '#f59e0b', icon: 'wind' as const },

]



// Risk distribution

const MOCK_RISK_DIST = [

  { label: 'Low', count: 38, color: '#22c55e' },

  { label: 'Moderate', count: 24, color: '#3b82f6' },

  { label: 'High', count: 12, color: '#ef4444' },

  { label: 'Very High', count: 6, color: '#b91c1c' },

]



const MOCK_QUOTE_DIST = [

  { label: 'Bound', count: 9, color: '#10b981' },

  { label: 'Responded', count: 14, color: '#3b82f6' },

  { label: 'Sent', count: 7, color: '#f59e0b' },

  { label: 'Declined', count: 3, color: '#ef4444' },

]



// Top markets by saved property count

const MOCK_TOP_MARKETS = [

  { state: 'FL', count: 18, label: 'Florida' },

  { state: 'CA', count: 14, label: 'California' },

  { state: 'TX', count: 11, label: 'Texas' },

  { state: 'SC', count: 7, label: 'S. Carolina' },

  { state: 'CO', count: 5, label: 'Colorado' },

]



// State-level carrier capacity for Market Pulse

interface MockMarket {

  state: string

  name: string

  writingCount: number

  capacity: number // 0-100

  trend: 'up' | 'down' | 'flat'

  hotPeril: string

  avgPremium: number

}



const MOCK_MARKETS: MockMarket[] = [

  { state: 'FL', name: 'Florida', writingCount: 7, capacity: 38, trend: 'down', hotPeril: 'Wind', avgPremium: 5240 },

  { state: 'CA', name: 'California', writingCount: 5, capacity: 42, trend: 'down', hotPeril: 'Fire', avgPremium: 4820 },

  { state: 'TX', name: 'Texas', writingCount: 14, capacity: 78, trend: 'up', hotPeril: 'Hail', avgPremium: 2180 },

  { state: 'SC', name: 'S. Carolina', writingCount: 9, capacity: 62, trend: 'flat', hotPeril: 'Flood', avgPremium: 3420 },

  { state: 'CO', name: 'Colorado', writingCount: 11, capacity: 66, trend: 'up', hotPeril: 'Fire', avgPremium: 2450 },

  { state: 'ID', name: 'Idaho', writingCount: 13, capacity: 84, trend: 'up', hotPeril: 'Fire', avgPremium: 1290 },

]



type TodoCategory = 'REPORT' | 'QUOTE' | 'CLIENT' | 'COMPLIANCE' | 'GENERAL'

type DueBucket = 'OVERDUE' | 'TODAY' | 'UPCOMING' | 'DONE'



interface MockTodo {

  id: string

  label: string

  due: string

  dueBucket: DueBucket

  priority: 'HIGH' | 'MED' | 'LOW'

  category: TodoCategory

  done: boolean

}



const MOCK_TODOS: MockTodo[] = [

  { id: 't1', label: 'Regenerate wind report — 1428 Ocean View Dr', due: 'Today', dueBucket: 'TODAY', priority: 'HIGH', category: 'REPORT', done: false },

  { id: 't2', label: 'Follow up with Pacific Select on Napa quote', due: 'Tomorrow', dueBucket: 'UPCOMING', priority: 'HIGH', category: 'QUOTE', done: false },

  { id: 't3', label: 'Send Martins updated carrier shortlist', due: 'Apr 12', dueBucket: 'UPCOMING', priority: 'MED', category: 'CLIENT', done: false },

  { id: 't4', label: 'Review SFHA zone change for Charleston listing', due: 'Apr 14', dueBucket: 'UPCOMING', priority: 'MED', category: 'COMPLIANCE', done: false },

  { id: 't5', label: 'Reprice Ocean View before carrier non-renewal', due: 'Apr 8', dueBucket: 'OVERDUE', priority: 'HIGH', category: 'QUOTE', done: false },

  { id: 't6', label: 'Confirm inspection for 44 Chestnut Hill', due: 'Today', dueBucket: 'TODAY', priority: 'MED', category: 'GENERAL', done: false },

  { id: 't7', label: 'Schedule inspection for 44 Chestnut Hill', due: 'Apr 6', dueBucket: 'DONE', priority: 'LOW', category: 'GENERAL', done: true },

  { id: 't8', label: 'Close out bound policy — Alvarez', due: 'Apr 5', dueBucket: 'DONE', priority: 'LOW', category: 'QUOTE', done: true },

]



interface MockClient {

  id: string

  name: string

  stage: 'Lead' | 'Qualified' | 'Touring' | 'Under Contract' | 'Closed'

  propertyCount: number

  lastTouch: string

}



const MOCK_CLIENTS: MockClient[] = [

  { id: 'cl1', name: 'The Martins', stage: 'Under Contract', propertyCount: 3, lastTouch: '1d' },

  { id: 'cl2', name: 'Kim Family', stage: 'Touring', propertyCount: 5, lastTouch: '4h' },

  { id: 'cl3', name: 'J. Alvarez', stage: 'Closed', propertyCount: 1, lastTouch: '2w' },

  { id: 'cl4', name: 'Okafor LLC', stage: 'Qualified', propertyCount: 2, lastTouch: '3d' },

  { id: 'cl5', name: 'R. Singh', stage: 'Lead', propertyCount: 1, lastTouch: '6d' },

]



interface MockDeal {

  id: string

  name: string

  type: 'Office' | 'Industrial' | 'Multifamily' | 'Retail' | 'Land'

  dealSize: string

  phase: 'Sourcing' | 'LOI' | 'Due Diligence' | 'Closing'

  insurabilityFlag: 'GREEN' | 'YELLOW' | 'RED'

}



const MOCK_DEALS: MockDeal[] = [

  { id: 'd1', name: 'Harbor Pointe Industrial', type: 'Industrial', dealSize: '$42M', phase: 'Due Diligence', insurabilityFlag: 'YELLOW' },

  { id: 'd2', name: 'Elm & 4th Office Tower', type: 'Office', dealSize: '$88M', phase: 'LOI', insurabilityFlag: 'GREEN' },

  { id: 'd3', name: 'Mesa Ranch Multifamily', type: 'Multifamily', dealSize: '$27M', phase: 'Sourcing', insurabilityFlag: 'RED' },

  { id: 'd4', name: 'Westshore Retail Plaza', type: 'Retail', dealSize: '$14M', phase: 'Closing', insurabilityFlag: 'GREEN' },

]



interface MockLoan {

  id: string

  borrower: string

  property: string

  loanAmt: number

  ltv: number

  insuranceStatus: 'In force' | 'Binder' | 'Lapsed' | 'Force-placed'

  riskFlag: 'LOW' | 'MED' | 'HIGH'

}



const MOCK_LOANS: MockLoan[] = [

  { id: 'l1', borrower: 'Martin, E.', property: '1428 Ocean View Dr', loanAmt: 975_000, ltv: 78, insuranceStatus: 'In force', riskFlag: 'HIGH' },

  { id: 'l2', borrower: 'Kim, S.', property: '907 Redwood Ridge', loanAmt: 1_680_000, ltv: 80, insuranceStatus: 'Binder', riskFlag: 'HIGH' },

  { id: 'l3', borrower: 'Alvarez, J.', property: '44 Chestnut Hill Ln', loanAmt: 548_000, ltv: 80, insuranceStatus: 'In force', riskFlag: 'LOW' },

  { id: 'l4', borrower: 'Chen, L.', property: '22 Riverbend Ct', loanAmt: 722_000, ltv: 76, insuranceStatus: 'Lapsed', riskFlag: 'MED' },

]



interface MockIntake {

  id: string

  applicant: string

  property: string

  premiumTarget: number

  peril: string

  received: string

  priority: 'HIGH' | 'MED' | 'LOW'

}



const MOCK_INTAKE: MockIntake[] = [

  { id: 'i1', applicant: 'E. Martin', property: '1428 Ocean View Dr, Miami FL', premiumTarget: 4500, peril: 'Flood + Wind', received: '2h', priority: 'HIGH' },

  { id: 'i2', applicant: 'S. Kim', property: '907 Redwood Ridge, Napa CA', premiumTarget: 6000, peril: 'Fire', received: '5h', priority: 'HIGH' },

  { id: 'i3', applicant: 'T. Okafor', property: '300 Mesa Ranch Rd, Phoenix AZ', premiumTarget: 2100, peril: 'Wind + Hail', received: '1d', priority: 'MED' },

  { id: 'i4', applicant: 'R. Singh', property: '12 Birchwood Ave, Denver CO', premiumTarget: 1750, peril: 'Hail', received: '2d', priority: 'LOW' },

]



interface MockMessage {

  id: string

  from: string

  preview: string

  time: string

  unread: boolean

}



const MOCK_MESSAGES: MockMessage[] = [

  { id: 'm1', from: 'Agent — Dana Price', preview: 'Ocean View has two carriers willing to bind. Want me to set up a call?', time: '10m', unread: true },

  { id: 'm2', from: 'Agent — Dana Price', preview: 'Uploaded the updated risk report for 907 Redwood.', time: '2h', unread: true },

  { id: 'm3', from: 'You', preview: 'Can we exclude properties with flood score under 40?', time: 'yesterday', unread: false },

]



type InsightCategory = 'MARKET' | 'WEATHER' | 'REGULATORY' | 'PORTFOLIO'



interface MockInsight {

  id: string

  category: InsightCategory

  title: string

  body: string

  severity: 'info' | 'warn' | 'alert'

  horizon: string

}



const MOCK_INSIGHTS: MockInsight[] = [

  { id: 'ai1', category: 'MARKET', title: 'Miami-Dade wind market tightening', body: 'Three carriers in your shortlist have filed non-renewal notices for coastal FL this quarter. Reprice Ocean View before Apr 30.', severity: 'alert', horizon: '30 days' },

  { id: 'ai2', category: 'WEATHER', title: 'Napa fire season starting early', body: 'NOAA outlook shows elevated fire weather risk starting mid-May — expect Pacific Select to pause binds for Redwood Ridge zone.', severity: 'warn', horizon: '60 days' },

  { id: 'ai3', category: 'MARKET', title: 'Austin wind pricing soft', body: 'Hail losses trending down. Lone Star Mutual raising capacity — good window to lock in multi-year terms for your Austin book.', severity: 'info', horizon: '90 days' },

  { id: 'ai4', category: 'REGULATORY', title: 'FL legislature reviewing Citizens rate cap', body: 'SB-7052 under committee review — may shift residual market eligibility. Could re-open Ocean View to admitted carriers.', severity: 'info', horizon: '120 days' },

  { id: 'ai5', category: 'PORTFOLIO', title: 'Portfolio concentration — 42% coastal FL', body: 'Your bound book is heavily weighted to coastal Florida. Consider diversifying into Atlanta / Nashville metros.', severity: 'warn', horizon: 'Now' },

  { id: 'ai6', category: 'WEATHER', title: 'Colorado front range storm watch', body: 'Severe weather outlook shows elevated hail risk on 512 Pine Canyon Rd through early May. Recommend binder acceleration.', severity: 'warn', horizon: '14 days' },

]



// ─── Helpers ────────────────────────────────────────────────────────────



function fmtCurrency(n: number) {

  return n >= 1_000_000 ? `$${(n / 1_000_000).toFixed(2)}M` : `$${(n / 1000).toFixed(0)}K`

}



function riskTone(score: number) {

  if (score >= 70) return { bg: 'bg-emerald-50', text: 'text-emerald-700', label: 'LOW', band: 'LOW' as RiskBand }

  if (score >= 50) return { bg: 'bg-blue-50', text: 'text-blue-700', label: 'MODERATE', band: 'MODERATE' as RiskBand }

  if (score >= 40) return { bg: 'bg-amber-50', text: 'text-amber-700', label: 'HIGH', band: 'HIGH' as RiskBand }

  return { bg: 'bg-red-50', text: 'text-red-700', label: 'VERY HIGH', band: 'VERY_HIGH' as RiskBand }

}



function hazardIcon(h: Hazard) {

  const props = { className: 'h-3 w-3' }

  switch (h) {

    case 'flood':

      return <Droplets {...props} />

    case 'fire':

      return <Flame {...props} />

    case 'wind':

      return <Wind {...props} />

    case 'quake':

      return <Activity {...props} />

  }

}



// ─── Reusable chart primitives (inline SVG, no deps) ────────────────────



function LineChart({

  data,

  height = 80,

}: {

  data: Array<{ day: number; checks: number; quotes: number }>

  height?: number

}) {

  const W = 600

  const H = height

  const pad = 8

  const maxVal = Math.max(...data.flatMap((d) => [d.checks, d.quotes]), 1)



  const pts = (key: 'checks' | 'quotes') =>

    data

      .map((d, i) => {

        const x = pad + (i / Math.max(1, data.length - 1)) * (W - 2 * pad)

        const y = H - pad - (d[key] / maxVal) * (H - 2 * pad)

        return `${x},${y}`

      })

      .join(' ')



  return (

    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-full">

      <polyline points={pts('checks')} fill="none" stroke="#3b82f6" strokeWidth={2} />

      <polyline points={pts('quotes')} fill="none" stroke="#10b981" strokeWidth={2} strokeDasharray="4 2" />

    </svg>

  )

}



function BarChart({

  data,

  height = 80,

  color = '#14b8a6',

}: {

  data: Array<{ label: string; value: number }>

  height?: number

  color?: string

}) {

  const W = 260

  const H = height

  const pad = 10

  const maxVal = Math.max(...data.map((d) => d.value), 1)

  const barW = (W - 2 * pad) / data.length - 4



  return (

    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-full">

      {data.map((d, i) => {

        const h = (d.value / maxVal) * (H - 2 * pad - 10)

        const x = pad + i * (barW + 4)

        const y = H - pad - h

        return (

          <g key={d.label}>

            <rect x={x} y={y} width={barW} height={h} rx={2} fill={color} />

            <text x={x + barW / 2} y={H - 1} fontSize={8} fill="#9ca3af" textAnchor="middle">

              {d.label}

            </text>

          </g>

        )

      })}

    </svg>

  )

}



function DonutChart({

  segments,

  size = 110,

}: {

  segments: Array<{ count: number; color: string; label: string }>

  size?: number

}) {

  const total = segments.reduce((s, x) => s + x.count, 0) || 1

  const R = size * 0.42

  const r = size * 0.27

  const cx = size / 2

  const cy = size / 2



  const prefixSums = segments.reduce<number[]>((acc, seg) => {

    const prev = acc.length === 0 ? 0 : acc[acc.length - 1]

    acc.push(prev + seg.count)

    return acc

  }, [])

  const paths = segments.map((seg, idx) => {

    const priorSum = idx === 0 ? 0 : prefixSums[idx - 1]

    const start = priorSum / total

    const end = prefixSums[idx] / total

    const a0 = start * 2 * Math.PI - Math.PI / 2

    const a1 = end * 2 * Math.PI - Math.PI / 2

    const large = end - start > 0.5 ? 1 : 0

    const x0 = cx + R * Math.cos(a0)

    const y0 = cy + R * Math.sin(a0)

    const x1 = cx + R * Math.cos(a1)

    const y1 = cy + R * Math.sin(a1)

    const ix0 = cx + r * Math.cos(a0)

    const iy0 = cy + r * Math.sin(a0)

    const ix1 = cx + r * Math.cos(a1)

    const iy1 = cy + r * Math.sin(a1)

    return {

      d: `M ${x0} ${y0} A ${R} ${R} 0 ${large} 1 ${x1} ${y1} L ${ix1} ${iy1} A ${r} ${r} 0 ${large} 0 ${ix0} ${iy0} Z`,

      color: seg.color,

    }

  })



  return (

    <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size}>

      {paths.map((p, i) => (

        <path key={i} d={p.d} fill={p.color} />

      ))}

      <text x={cx} y={cy + 4} textAnchor="middle" fontSize={size * 0.18} fontWeight={700} fill="#111827">

        {total}

      </text>

    </svg>

  )

}



function HazardBar({ data }: { data: typeof MOCK_HAZARD_MIX }) {

  const total = data.reduce((s, d) => s + d.value, 0) || 1

  return (

    <div>

      <div className="flex h-3 w-full overflow-hidden rounded-full bg-gray-100">

        {data.map((d) => (

          <div

            key={d.label}

            style={{ width: `${(d.value / total) * 100}%`, background: d.color }}

            title={`${d.label}: ${d.value}`}

          />

        ))}

      </div>

      <ul className="mt-2 grid grid-cols-5 gap-1 text-[10px]">

        {data.map((d) => (

          <li key={d.label} className="flex items-center gap-1 text-gray-600">

            <span className="h-2 w-2 rounded-full" style={{ background: d.color }} />

            {d.label} <span className="ml-auto font-semibold text-gray-900">{d.value}</span>

          </li>

        ))}

      </ul>

    </div>

  )

}



function Funnel({

  stages,

}: {

  stages: Array<{ label: string; value: number; color: string }>

}) {

  const max = Math.max(...stages.map((s) => s.value), 1)

  return (

    <div className="space-y-1.5">

      {stages.map((s) => {

        const pct = (s.value / max) * 100

        return (

          <div key={s.label} className="flex items-center gap-2">

            <span className="w-20 shrink-0 text-[10px] font-semibold uppercase tracking-wide text-gray-500">

              {s.label}

            </span>

            <div className="relative flex-1 overflow-hidden rounded bg-gray-100">

              <div

                className="h-6 rounded"

                style={{ width: `${pct}%`, background: s.color }}

              />

              <span className="absolute inset-0 flex items-center pl-2 text-[11px] font-bold text-white mix-blend-difference">

                {s.value}

              </span>

            </div>

          </div>

        )

      })}

    </div>

  )

}



// ─── Hero ───────────────────────────────────────────────────────────────



interface HeroProps {

  role: Role

  userName?: string

  agentFlavor: AgentFlavor

  onRoleChange: (r: Role) => void

  onFlavorChange: (f: AgentFlavor) => void

}



function Hero({ role, userName, agentFlavor, onRoleChange, onFlavorChange }: HeroProps) {

  const greeting = userName ? `Welcome back, ${userName}` : 'Welcome back'



  const roleLabel =

    role === 'AGENT'

      ? agentFlavor === 'CRE'

        ? 'Commercial Real Estate Agent'

        : 'Residential Agent'

      : role === 'LENDER'

      ? 'Lender'

      : role === 'INSURANCE'

      ? 'Insurance Agent'

      : role === 'ADMIN'

      ? 'Administrator'

      : 'Home Buyer'



  const kpis = useMemo(() => {

    switch (role) {

      case 'AGENT':

        return [

          { label: 'Saved properties', value: '24', delta: '+3 this week', up: true, icon: <Shield className="h-4 w-4 text-teal-600" /> },

          { label: 'Active clients', value: '12', delta: '+1', up: true, icon: <Users className="h-4 w-4 text-purple-500" /> },

          { label: 'Quotes in flight', value: '7', delta: '2 overdue', up: false, icon: <FileText className="h-4 w-4 text-orange-500" /> },

          { label: 'Bound YTD', value: '$3.2M', delta: '+18%', up: true, icon: <DollarSign className="h-4 w-4 text-emerald-600" /> },

        ]

      case 'LENDER':

        return [

          { label: 'Active loans', value: '186', delta: '+4', up: true, icon: <Landmark className="h-4 w-4 text-blue-600" /> },

          { label: 'Insurance lapses', value: '3', delta: '-1', up: true, icon: <AlertTriangle className="h-4 w-4 text-red-500" /> },

          { label: 'Exposure', value: '$142M', delta: '+$6M', up: true, icon: <DollarSign className="h-4 w-4 text-emerald-600" /> },

          { label: 'Avg LTV', value: '78%', delta: 'flat', up: true, icon: <TrendingUp className="h-4 w-4 text-purple-500" /> },

        ]

      case 'INSURANCE':

        return [

          { label: 'Quote intake', value: '18', delta: '+5 today', up: true, icon: <FileText className="h-4 w-4 text-blue-600" /> },

          { label: 'Pending review', value: '6', delta: '2 high pri', up: false, icon: <Clock className="h-4 w-4 text-amber-500" /> },

          { label: 'Bound this month', value: '22', delta: '+3', up: true, icon: <CheckCircle2 className="h-4 w-4 text-emerald-600" /> },

          { label: 'Avg premium', value: '$3.4K', delta: '+2%', up: true, icon: <DollarSign className="h-4 w-4 text-emerald-600" /> },

        ]

      case 'BUYER':

        return [

          { label: 'Saved properties', value: '5', delta: '+1', up: true, icon: <Shield className="h-4 w-4 text-teal-600" /> },

          { label: 'Insurable now', value: '4', delta: '80%', up: true, icon: <CheckCircle2 className="h-4 w-4 text-emerald-600" /> },

          { label: 'Avg risk score', value: '62', delta: '+4', up: true, icon: <TrendingUp className="h-4 w-4 text-blue-500" /> },

          { label: 'Est. annual premium', value: '$3.1K', delta: '-$120', up: true, icon: <DollarSign className="h-4 w-4 text-emerald-600" /> },

        ]

      default:

        return [

          { label: 'Platform checks', value: '1,284', delta: '+98', up: true, icon: <Shield className="h-4 w-4 text-teal-600" /> },

          { label: 'Active users', value: '312', delta: '+11', up: true, icon: <Users className="h-4 w-4 text-purple-500" /> },

          { label: 'Quotes in flight', value: '64', delta: '+8', up: true, icon: <FileText className="h-4 w-4 text-orange-500" /> },

          { label: 'Bound GWP', value: '$28M', delta: '+6%', up: true, icon: <DollarSign className="h-4 w-4 text-emerald-600" /> },

        ]

    }

  }, [role])



  const personaButtons: Array<{ key: string; label: string; onClick: () => void; active: boolean }> = [

    { key: 'BUYER', label: 'Buyer', onClick: () => onRoleChange('BUYER'), active: role === 'BUYER' },

    { key: 'RES', label: 'Res. Agent', onClick: () => { onRoleChange('AGENT'); onFlavorChange('RESIDENTIAL') }, active: role === 'AGENT' && agentFlavor === 'RESIDENTIAL' },

    { key: 'CRE', label: 'CRE Agent', onClick: () => { onRoleChange('AGENT'); onFlavorChange('CRE') }, active: role === 'AGENT' && agentFlavor === 'CRE' },

    { key: 'LENDER', label: 'Lender', onClick: () => onRoleChange('LENDER'), active: role === 'LENDER' },

    { key: 'INSURANCE', label: 'Insurance', onClick: () => onRoleChange('INSURANCE'), active: role === 'INSURANCE' },

  ]



  return (

    <section className="mb-5">

      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">

        <div>

          <div className="flex items-center gap-2">

            <h1 className="text-2xl font-bold tracking-tight text-gray-900">{greeting}</h1>

            <span className="inline-flex items-center gap-1 rounded-full border border-teal-200 bg-teal-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-teal-700">

              {roleLabel}

            </span>

          </div>

          <p className="mt-1 text-sm text-gray-500">

            Here&apos;s your insurability pulse — saved properties, carriers, quotes, and what to

            do next.

          </p>

        </div>

        <div className="flex items-center gap-2">

          <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[11px] font-semibold text-amber-700">

            <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />

            Demo data

          </span>

        </div>

      </div>



      {/* Persona switcher (demo) */}

      <div className="mb-4 flex flex-wrap items-center gap-1.5 rounded-lg border border-gray-200 bg-white p-1 shadow-sm">

        <span className="px-2 text-[10px] font-semibold uppercase tracking-wide text-gray-400">

          Preview as

        </span>

        {personaButtons.map((b) => (

          <button

            key={b.key}

            type="button"

            onClick={b.onClick}

            className={cn(

              'rounded-md px-3 py-1.5 text-[11px] font-semibold transition-colors',

              b.active

                ? 'bg-teal-600 text-white shadow-sm'

                : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900',

            )}

          >

            {b.label}

          </button>

        ))}

      </div>



      {/* KPI rail */}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">

        {kpis.map((k) => (

          <div

            key={k.label}

            className="flex h-full flex-col justify-between gap-2 rounded-xl border border-gray-200 bg-white p-4 shadow-sm"

          >

            <div className="flex items-center justify-between">

              <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">

                {k.label}

              </span>

              <span className="flex h-7 w-7 items-center justify-center rounded-md bg-gray-50">

                {k.icon}

              </span>

            </div>

            <div className="flex items-end gap-2">

              <span className="text-2xl font-bold text-gray-900">{k.value}</span>

              <span

                className={cn(

                  'mb-1 inline-flex items-center gap-0.5 text-[11px] font-semibold',

                  k.up ? 'text-emerald-600' : 'text-red-600',

                )}

              >

                {k.up ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}

                {k.delta}

              </span>

            </div>

          </div>

        ))}

      </div>

    </section>

  )

}



// ─── Analytics strip ────────────────────────────────────────────────────



type ActivityRange = '7d' | '30d' | '90d'



function AnalyticsStrip() {

  const [range, setRange] = useState<ActivityRange>('30d')

  const activity = useMemo(() => {

    const n = range === '7d' ? 7 : range === '30d' ? 30 : 90

    return MOCK_ACTIVITY_90.slice(-n)

  }, [range])



  return (

    <section className="mb-5 space-y-3">

      {/* Row 1 — activity + risk donut + quote donut */}

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-6">

        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm lg:col-span-3">

          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">

            <div>

              <h2 className="text-sm font-semibold text-gray-900">Activity</h2>

              <p className="text-[11px] text-gray-400">Property checks & quote requests</p>

            </div>

            <div className="flex items-center gap-2">

              <div className="flex rounded-md border border-gray-200 bg-gray-50 p-0.5">

                {(['7d', '30d', '90d'] as ActivityRange[]).map((r) => (

                  <button

                    key={r}

                    onClick={() => setRange(r)}

                    className={cn(

                      'rounded px-2 py-0.5 text-[10px] font-semibold transition-colors',

                      range === r ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-900',

                    )}

                  >

                    {r}

                  </button>

                ))}

              </div>

              <div className="flex items-center gap-3 text-[10px]">

                <span className="flex items-center gap-1 text-gray-500">

                  <span className="inline-block h-0.5 w-4 bg-blue-500" />

                  Checks

                </span>

                <span className="flex items-center gap-1 text-gray-500">

                  <span className="inline-block h-0.5 w-4" style={{ borderTop: '2px dashed #10b981' }} />

                  Quotes

                </span>

              </div>

            </div>

          </div>

          <div className="h-24">

            <LineChart data={activity} />

          </div>

        </div>



        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm lg:col-span-2">

          <div className="mb-2 flex items-center justify-between">

            <h2 className="text-sm font-semibold text-gray-900">Risk distribution</h2>

            <Link href="/analytics" className="flex items-center gap-0.5 text-[10px] font-semibold text-teal-600 hover:text-teal-700">

              Details <ArrowUpRight className="h-3 w-3" />

            </Link>

          </div>

          <div className="flex items-center gap-3">

            <DonutChart segments={MOCK_RISK_DIST} size={100} />

            <ul className="flex-1 space-y-1">

              {MOCK_RISK_DIST.map((r) => (

                <li key={r.label} className="flex items-center justify-between text-[11px]">

                  <span className="flex items-center gap-1.5 text-gray-600">

                    <span className="h-2 w-2 rounded-full" style={{ background: r.color }} />

                    {r.label}

                  </span>

                  <span className="font-semibold text-gray-900">{r.count}</span>

                </li>

              ))}

            </ul>

          </div>

        </div>



        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm lg:col-span-1">

          <h2 className="mb-2 text-sm font-semibold text-gray-900">Quotes</h2>

          <div className="flex flex-col items-center gap-2">

            <DonutChart segments={MOCK_QUOTE_DIST} size={80} />

            <ul className="w-full space-y-0.5">

              {MOCK_QUOTE_DIST.map((q) => (

                <li key={q.label} className="flex items-center justify-between text-[10px]">

                  <span className="flex items-center gap-1 text-gray-600">

                    <span className="h-1.5 w-1.5 rounded-full" style={{ background: q.color }} />

                    {q.label}

                  </span>

                  <span className="font-semibold text-gray-900">{q.count}</span>

                </li>

              ))}

            </ul>

          </div>

        </div>

      </div>



      {/* Row 2 — weekly bars + hazard mix + top markets */}

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-6">

        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm lg:col-span-2">

          <div className="mb-2 flex items-center justify-between">

            <div>

              <h2 className="text-sm font-semibold text-gray-900">Bound / week</h2>

              <p className="text-[11px] text-gray-400">Last 8 weeks</p>

            </div>

            <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">

              +37% QoQ

            </span>

          </div>

          <div className="h-24">

            <BarChart data={MOCK_WEEKLY_BOUND} />

          </div>

        </div>



        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm lg:col-span-2">

          <h2 className="mb-2 text-sm font-semibold text-gray-900">Hazard mix</h2>

          <HazardBar data={MOCK_HAZARD_MIX} />

        </div>



        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm lg:col-span-2">

          <h2 className="mb-2 text-sm font-semibold text-gray-900">Top markets</h2>

          <ul className="space-y-1.5">

            {MOCK_TOP_MARKETS.map((m) => {

              const max = Math.max(...MOCK_TOP_MARKETS.map((x) => x.count))

              return (

                <li key={m.state} className="flex items-center gap-2 text-[11px]">

                  <span className="w-20 shrink-0 text-gray-600">{m.label}</span>

                  <div className="relative flex-1 overflow-hidden rounded bg-gray-100">

                    <div

                      className="h-2 rounded bg-teal-500"

                      style={{ width: `${(m.count / max) * 100}%` }}

                    />

                  </div>

                  <span className="w-6 text-right font-semibold text-gray-900">{m.count}</span>

                </li>

              )

            })}

          </ul>

        </div>

      </div>

    </section>

  )

}



// ─── Market Pulse ───────────────────────────────────────────────────────



function MarketPulseSection() {

  return (

    <section className="mb-5 rounded-xl border border-gray-200 bg-white shadow-sm">

      <header className="flex items-center justify-between border-b border-gray-100 px-4 py-3">

        <div className="flex items-center gap-2">

          <Zap className="h-4 w-4 text-amber-500" />

          <div>

            <h2 className="text-sm font-semibold text-gray-900">Market pulse</h2>

            <p className="text-[11px] text-gray-400">Carrier capacity & trend by state</p>

          </div>

        </div>

        <Link href="/analytics" className="text-[11px] font-semibold text-teal-600 hover:text-teal-700">

          Full map →

        </Link>

      </header>

      <div className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-2 lg:grid-cols-3">

        {MOCK_MARKETS.map((m) => {

          const capTone =

            m.capacity >= 70 ? 'bg-emerald-500' : m.capacity >= 50 ? 'bg-amber-500' : 'bg-red-500'

          const trendIcon =

            m.trend === 'up' ? (

              <TrendingUp className="h-3 w-3 text-emerald-600" />

            ) : m.trend === 'down' ? (

              <TrendingDown className="h-3 w-3 text-red-600" />

            ) : (

              <Activity className="h-3 w-3 text-gray-400" />

            )

          return (

            <div key={m.state} className="rounded-lg border border-gray-200 bg-gray-50/40 p-3">

              <div className="mb-1.5 flex items-center justify-between">

                <div className="flex items-center gap-2">

                  <span className="flex h-6 w-6 items-center justify-center rounded bg-white text-[10px] font-bold text-gray-700 ring-1 ring-gray-200">

                    {m.state}

                  </span>

                  <span className="text-[12px] font-semibold text-gray-900">{m.name}</span>

                </div>

                {trendIcon}

              </div>

              <div className="mb-1 flex items-center justify-between text-[10px]">

                <span className="text-gray-500">{m.writingCount} carriers writing</span>

                <span className="font-semibold text-gray-700">

                  ${m.avgPremium.toLocaleString()}

                </span>

              </div>

              <div className="h-1.5 overflow-hidden rounded bg-gray-200">

                <div className={cn('h-full rounded', capTone)} style={{ width: `${m.capacity}%` }} />

              </div>

              <div className="mt-1.5 flex items-center justify-between text-[10px]">

                <span className="text-gray-400">Capacity {m.capacity}%</span>

                <span className="rounded bg-orange-50 px-1.5 py-0.5 font-semibold text-orange-700">

                  Hot: {m.hotPeril}

                </span>

              </div>

            </div>

          )

        })}

      </div>

    </section>

  )

}



// ─── Saved properties ───────────────────────────────────────────────────



type SortKey = 'risk' | 'value' | 'updated'

type ViewMode = 'grid' | 'list'



function SavedPropertiesSection() {

  const [query, setQuery] = useState('')

  const [stateFilter, setStateFilter] = useState<string>('ALL')

  const [bandFilter, setBandFilter] = useState<RiskBand | 'ALL'>('ALL')

  const [sort, setSort] = useState<SortKey>('risk')

  const [view, setView] = useState<ViewMode>('grid')

  const [selected, setSelected] = useState<Set<string>>(new Set())



  const allStates = useMemo(() => Array.from(new Set(MOCK_PROPERTIES.map((p) => p.state))).sort(), [])



  const filtered = useMemo(() => {

    let list = MOCK_PROPERTIES.filter((p) => {

      if (stateFilter !== 'ALL' && p.state !== stateFilter) return false

      if (bandFilter !== 'ALL' && riskTone(p.riskScore).band !== bandFilter) return false

      if (query && !`${p.address} ${p.cityState}`.toLowerCase().includes(query.toLowerCase())) return false

      return true

    })

    list = [...list].sort((a, b) => {

      if (sort === 'risk') return a.riskScore - b.riskScore

      if (sort === 'value') return b.estValue - a.estValue

      return 0

    })

    return list

  }, [query, stateFilter, bandFilter, sort])



  const toggleSelect = (id: string) => {

    setSelected((prev) => {

      const next = new Set(prev)

      if (next.has(id)) next.delete(id)

      else next.add(id)

      return next

    })

  }



  const clearSelection = () => setSelected(new Set())



  return (

    <section className="mb-5 rounded-xl border border-gray-200 bg-white shadow-sm">

      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 px-4 py-3">

        <div>

          <h2 className="text-sm font-semibold text-gray-900">Saved properties</h2>

          <p className="text-[11px] text-gray-400">Review risk, regenerate reports, pull carriers</p>

        </div>

        <div className="flex items-center gap-1">

          <button

            onClick={() => setView('grid')}

            className={cn(

              'rounded p-1.5 text-gray-500 hover:bg-gray-100',

              view === 'grid' && 'bg-gray-100 text-gray-900',

            )}

            aria-label="Grid view"

          >

            <Grid2x2 className="h-3.5 w-3.5" />

          </button>

          <button

            onClick={() => setView('list')}

            className={cn(

              'rounded p-1.5 text-gray-500 hover:bg-gray-100',

              view === 'list' && 'bg-gray-100 text-gray-900',

            )}

            aria-label="List view"

          >

            <LayoutList className="h-3.5 w-3.5" />

          </button>

          <Link href="/search" className="ml-2 text-[11px] font-semibold text-teal-600 hover:text-teal-700">

            See all →

          </Link>

        </div>

      </header>



      {/* Filters */}

      <div className="flex flex-wrap items-center gap-2 border-b border-gray-100 px-4 py-2.5">

        <div className="relative flex-1 min-w-[180px]">

          <SearchIcon className="pointer-events-none absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 text-gray-400" />

          <input

            type="text"

            value={query}

            onChange={(e) => setQuery(e.target.value)}

            placeholder="Filter by address or city"

            className="w-full rounded-md border border-gray-200 bg-gray-50 py-1.5 pl-7 pr-2 text-[11px] focus:border-teal-400 focus:bg-white focus:outline-none"

          />

        </div>

        <select

          value={stateFilter}

          onChange={(e) => setStateFilter(e.target.value)}

          className="rounded-md border border-gray-200 bg-gray-50 px-2 py-1.5 text-[11px] font-medium text-gray-700 focus:border-teal-400 focus:bg-white focus:outline-none"

        >

          <option value="ALL">All states</option>

          {allStates.map((s) => (

            <option key={s} value={s}>

              {s}

            </option>

          ))}

        </select>

        <select

          value={bandFilter}

          onChange={(e) => setBandFilter(e.target.value as RiskBand | 'ALL')}

          className="rounded-md border border-gray-200 bg-gray-50 px-2 py-1.5 text-[11px] font-medium text-gray-700 focus:border-teal-400 focus:bg-white focus:outline-none"

        >

          <option value="ALL">All risk</option>

          <option value="LOW">Low</option>

          <option value="MODERATE">Moderate</option>

          <option value="HIGH">High</option>

          <option value="VERY_HIGH">Very high</option>

        </select>

        <select

          value={sort}

          onChange={(e) => setSort(e.target.value as SortKey)}

          className="rounded-md border border-gray-200 bg-gray-50 px-2 py-1.5 text-[11px] font-medium text-gray-700 focus:border-teal-400 focus:bg-white focus:outline-none"

        >

          <option value="risk">Sort: Risk</option>

          <option value="value">Sort: Value</option>

          <option value="updated">Sort: Updated</option>

        </select>

        <span className="ml-auto text-[10px] text-gray-500">

          {filtered.length} of {MOCK_PROPERTIES.length}

        </span>

      </div>



      {/* Bulk selection bar */}

      {selected.size > 0 && (

        <div className="flex items-center justify-between bg-teal-50 px-4 py-2 text-[11px]">

          <span className="font-semibold text-teal-800">

            {selected.size} selected

          </span>

          <div className="flex items-center gap-2">

            <button className="flex items-center gap-1 rounded bg-white px-2 py-1 font-semibold text-teal-700 ring-1 ring-teal-200 hover:bg-teal-100">

              <RefreshCw className="h-3 w-3" /> Regenerate

            </button>

            <button className="flex items-center gap-1 rounded bg-white px-2 py-1 font-semibold text-teal-700 ring-1 ring-teal-200 hover:bg-teal-100">

              <Send className="h-3 w-3" /> Request quotes

            </button>

            <button onClick={clearSelection} className="text-teal-700 hover:underline">

              Clear

            </button>

          </div>

        </div>

      )}



      {view === 'grid' ? (

        <div className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-2 xl:grid-cols-3">

          {filtered.map((p) => {

            const tone = riskTone(p.riskScore)

            const isSelected = selected.has(p.id)

            return (

              <div

                key={p.id}

                className={cn(

                  'group flex flex-col gap-2 rounded-lg border bg-gray-50/40 p-3 transition-colors hover:bg-white',

                  isSelected ? 'border-teal-400 ring-1 ring-teal-200' : 'border-gray-200 hover:border-teal-200',

                )}

              >

                <div className="flex items-start justify-between gap-2">

                  <div className="flex min-w-0 items-start gap-2">

                    <input

                      type="checkbox"

                      checked={isSelected}

                      onChange={() => toggleSelect(p.id)}

                      className="mt-0.5 h-3.5 w-3.5 shrink-0 rounded border-gray-300 text-teal-600 focus:ring-teal-500"

                    />

                    <div className="min-w-0">

                      <p className="truncate text-sm font-semibold text-gray-900">{p.address}</p>

                      <p className="flex items-center gap-1 text-[11px] text-gray-500">

                        <MapPin className="h-3 w-3" />

                        {p.cityState}

                      </p>

                    </div>

                  </div>

                  <span className={cn('shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold', tone.bg, tone.text)}>

                    {tone.label} · {p.riskScore}

                  </span>

                </div>



                <div className="flex items-center justify-between text-[11px] text-gray-500">

                  <span className="font-semibold text-gray-700">{fmtCurrency(p.estValue)}</span>

                  <span className="flex items-center gap-1">

                    <Shield className="h-3 w-3 text-teal-500" />

                    {p.carrierCount} carriers

                  </span>

                </div>



                {p.topHazards.length > 0 && (

                  <div className="flex items-center gap-1.5">

                    {p.topHazards.map((h) => (

                      <span key={h} className="inline-flex items-center gap-0.5 rounded bg-white px-1.5 py-0.5 text-[10px] font-medium text-gray-600 ring-1 ring-gray-200">

                        {hazardIcon(h)}

                        {h}

                      </span>

                    ))}

                  </div>

                )}



                {p.savedFor && (

                  <p className="text-[10px] text-purple-600">

                    <Users className="mr-1 inline h-2.5 w-2.5" />

                    {p.savedFor}

                  </p>

                )}



                <div className="mt-auto flex items-center justify-between border-t border-gray-100 pt-2 text-[11px]">

                  <span className="text-gray-400">Updated {p.reportUpdated}</span>

                  <div className="flex items-center gap-2">

                    <button className="flex items-center gap-0.5 font-semibold text-gray-500 hover:text-gray-700">

                      <RefreshCw className="h-3 w-3" /> Regen

                    </button>

                    <button className="flex items-center gap-0.5 font-semibold text-teal-600 hover:text-teal-700">

                      <FileText className="h-3 w-3" /> View Report

                    </button>

                  </div>

                </div>

              </div>

            )

          })}

        </div>

      ) : (

        <ul className="divide-y divide-gray-100">

          {filtered.map((p) => {

            const tone = riskTone(p.riskScore)

            const isSelected = selected.has(p.id)

            return (

              <li

                key={p.id}

                className={cn(

                  'flex items-center gap-3 px-4 py-2.5 text-[12px] hover:bg-gray-50',

                  isSelected && 'bg-teal-50/50',

                )}

              >

                <input

                  type="checkbox"

                  checked={isSelected}

                  onChange={() => toggleSelect(p.id)}

                  className="h-3.5 w-3.5 rounded border-gray-300 text-teal-600 focus:ring-teal-500"

                />

                <div className="min-w-0 flex-1">

                  <p className="truncate font-semibold text-gray-900">{p.address}</p>

                  <p className="text-[10px] text-gray-500">{p.cityState}</p>

                </div>

                <span className="hidden font-semibold text-gray-700 sm:inline">{fmtCurrency(p.estValue)}</span>

                <span className="hidden text-gray-500 md:inline">{p.carrierCount} carriers</span>

                <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-bold', tone.bg, tone.text)}>

                  {tone.label} · {p.riskScore}

                </span>

                <button className="text-teal-600 hover:text-teal-700" aria-label="Open report">

                  <ChevronRight className="h-4 w-4" />

                </button>

              </li>

            )

          })}

        </ul>

      )}

    </section>

  )

}



// ─── Active carriers ────────────────────────────────────────────────────



function ActiveCarriersSection() {

  const [stateFilter, setStateFilter] = useState('ALL')

  const [perilFilter, setPerilFilter] = useState('ALL')

  const [statusFilter, setStatusFilter] = useState<CarrierStatus | 'ALL'>('ALL')



  const allStates = useMemo(() => Array.from(new Set(MOCK_CARRIERS.map((c) => c.state))).sort(), [])

  const allPerils = useMemo(

    () => Array.from(new Set(MOCK_CARRIERS.flatMap((c) => c.perils))).sort(),

    [],

  )



  const filtered = useMemo(() => {

    return MOCK_CARRIERS.filter((c) => {

      if (stateFilter !== 'ALL' && c.state !== stateFilter) return false

      if (perilFilter !== 'ALL' && !c.perils.includes(perilFilter)) return false

      if (statusFilter !== 'ALL' && c.status !== statusFilter) return false

      return true

    })

  }, [stateFilter, perilFilter, statusFilter])



  return (

    <section className="mb-5 rounded-xl border border-gray-200 bg-white shadow-sm">

      <header className="flex items-center justify-between border-b border-gray-100 px-4 py-3">

        <div>

          <h2 className="text-sm font-semibold text-gray-900">Active carriers in your markets</h2>

          <p className="text-[11px] text-gray-400">Who is actively writing & binding — updated daily</p>

        </div>

        <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">

          {MOCK_CARRIERS.filter((c) => c.status === 'WRITING').length} writing

        </span>

      </header>



      <div className="flex flex-wrap items-center gap-2 border-b border-gray-100 px-4 py-2.5">

        <Filter className="h-3 w-3 text-gray-400" />

        <select

          value={stateFilter}

          onChange={(e) => setStateFilter(e.target.value)}

          className="rounded-md border border-gray-200 bg-gray-50 px-2 py-1 text-[11px] font-medium text-gray-700 focus:border-teal-400 focus:bg-white focus:outline-none"

        >

          <option value="ALL">All states</option>

          {allStates.map((s) => (

            <option key={s} value={s}>

              {s}

            </option>

          ))}

        </select>

        <select

          value={perilFilter}

          onChange={(e) => setPerilFilter(e.target.value)}

          className="rounded-md border border-gray-200 bg-gray-50 px-2 py-1 text-[11px] font-medium text-gray-700 focus:border-teal-400 focus:bg-white focus:outline-none"

        >

          <option value="ALL">All perils</option>

          {allPerils.map((p) => (

            <option key={p} value={p}>

              {p}

            </option>

          ))}

        </select>

        <div className="flex gap-1">

          {(['ALL', 'WRITING', 'RESTRICTED', 'NON_RENEWING'] as const).map((s) => (

            <button

              key={s}

              onClick={() => setStatusFilter(s)}

              className={cn(

                'rounded-full px-2 py-0.5 text-[10px] font-semibold transition-colors',

                statusFilter === s

                  ? 'bg-gray-900 text-white'

                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200',

              )}

            >

              {s === 'ALL' ? 'All' : s.replace('_', ' ')}

            </button>

          ))}

        </div>

        <span className="ml-auto text-[10px] text-gray-500">{filtered.length} carriers</span>

      </div>



      <div className="overflow-x-auto">

        <table className="w-full text-left text-[12px]">

          <thead className="bg-gray-50 text-[10px] uppercase tracking-wider text-gray-500">

            <tr>

              <th className="px-4 py-2 font-semibold">Carrier</th>

              <th className="px-4 py-2 font-semibold">State</th>

              <th className="px-4 py-2 font-semibold">Perils</th>

              <th className="px-4 py-2 font-semibold">Appetite</th>

              <th className="px-4 py-2 font-semibold">Avg premium</th>

              <th className="px-4 py-2 font-semibold">Market</th>

              <th className="px-4 py-2 font-semibold">Status</th>

              <th className="px-4 py-2" />

            </tr>

          </thead>

          <tbody className="divide-y divide-gray-100">

            {filtered.map((c) => {

              const apTone =

                c.appetite >= 70 ? 'bg-emerald-500' : c.appetite >= 40 ? 'bg-amber-500' : 'bg-red-500'

              const mcTone =

                c.marketCondition === 'SOFT'

                  ? 'bg-emerald-50 text-emerald-700'

                  : c.marketCondition === 'STABLE'

                  ? 'bg-blue-50 text-blue-700'

                  : c.marketCondition === 'HARDENING'

                  ? 'bg-amber-50 text-amber-700'

                  : 'bg-red-50 text-red-700'

              return (

                <tr key={c.id} className="hover:bg-gray-50/60">

                  <td className="px-4 py-2.5 font-semibold text-gray-900">{c.name}</td>

                  <td className="px-4 py-2.5 text-gray-600">{c.state}</td>

                  <td className="px-4 py-2.5 text-gray-600">{c.perils.join(', ')}</td>

                  <td className="px-4 py-2.5">

                    <div className="flex items-center gap-2">

                      <div className="h-1.5 w-16 overflow-hidden rounded bg-gray-200">

                        <div className={cn('h-full', apTone)} style={{ width: `${c.appetite}%` }} />

                      </div>

                      <span className="text-[10px] font-semibold text-gray-700">{c.appetite}</span>

                    </div>

                  </td>

                  <td className="px-4 py-2.5 text-gray-600">${c.avgPremium.toLocaleString()}</td>

                  <td className="px-4 py-2.5">

                    <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-semibold', mcTone)}>

                      {c.marketCondition}

                    </span>

                  </td>

                  <td className="px-4 py-2.5">

                    <span

                      className={cn(

                        'rounded-full px-2 py-0.5 text-[10px] font-semibold',

                        c.status === 'WRITING' && 'bg-emerald-50 text-emerald-700',

                        c.status === 'RESTRICTED' && 'bg-amber-50 text-amber-700',

                        c.status === 'NON_RENEWING' && 'bg-red-50 text-red-700',

                      )}

                    >

                      {c.status.replace('_', ' ')}

                    </span>

                  </td>

                  <td className="px-4 py-2.5 text-right">

                    <button className="text-[11px] font-semibold text-teal-600 hover:text-teal-700">

                      Request quote

                    </button>

                  </td>

                </tr>

              )

            })}

          </tbody>

        </table>

      </div>

    </section>

  )

}



// ─── Quote pipeline ─────────────────────────────────────────────────────



function QuotePipelineSection() {

  const [statusFilter, setStatusFilter] = useState<QuoteStatus | 'ALL'>('ALL')



  const stats = useMemo(() => {

    const pending = MOCK_QUOTES.filter((q) => q.status === 'PENDING').length

    const sent = MOCK_QUOTES.filter((q) => q.status === 'SENT').length

    const responded = MOCK_QUOTES.filter((q) => q.status === 'RESPONDED').length

    const bound = MOCK_QUOTES.filter((q) => q.status === 'BOUND').length

    const total = MOCK_QUOTES.length

    const conversion = total ? Math.round((bound / total) * 100) : 0

    return { pending, sent, responded, bound, total, conversion }

  }, [])



  const filtered = useMemo(

    () => MOCK_QUOTES.filter((q) => (statusFilter === 'ALL' ? true : q.status === statusFilter)),

    [statusFilter],

  )



  return (

    <section className="rounded-xl border border-gray-200 bg-white shadow-sm">

      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 px-4 py-3">

        <div>

          <h2 className="text-sm font-semibold text-gray-900">Quote pipeline</h2>

          <p className="text-[11px] text-gray-400">

            {stats.bound} bound / {stats.total} submitted · {stats.conversion}% conversion

          </p>

        </div>

        <div className="flex flex-wrap gap-1">

          {(['ALL', 'PENDING', 'SENT', 'RESPONDED', 'BOUND', 'DECLINED'] as const).map((s) => (

            <button

              key={s}

              onClick={() => setStatusFilter(s)}

              className={cn(

                'rounded-full px-2 py-0.5 text-[10px] font-semibold transition-colors',

                statusFilter === s ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200',

              )}

            >

              {s === 'ALL' ? 'All' : s}

            </button>

          ))}

        </div>

      </header>



      <div className="border-b border-gray-100 px-4 py-3">

        <Funnel

          stages={[

            { label: 'Pending', value: stats.pending, color: '#9ca3af' },

            { label: 'Sent', value: stats.sent, color: '#f59e0b' },

            { label: 'Responded', value: stats.responded, color: '#3b82f6' },

            { label: 'Bound', value: stats.bound, color: '#10b981' },

          ]}

        />

      </div>



      <ul className="divide-y divide-gray-100">

        {filtered.map((q) => {

          const aging = q.ageDays >= 5 ? 'red' : q.ageDays >= 2 ? 'amber' : null

          return (

            <li key={q.id} className="flex items-center justify-between gap-3 px-4 py-2.5">

              <div className="min-w-0">

                <p className="truncate text-[12px] font-semibold text-gray-900">{q.property}</p>

                <p className="truncate text-[11px] text-gray-500">

                  {q.carrier} · submitted {q.submitted}

                </p>

              </div>

              <div className="flex items-center gap-3 text-[11px]">

                {aging && (

                  <span

                    className={cn(

                      'inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-semibold',

                      aging === 'red' ? 'bg-red-50 text-red-700' : 'bg-amber-50 text-amber-700',

                    )}

                  >

                    <Clock className="h-2.5 w-2.5" />

                    {q.ageDays}d

                  </span>

                )}

                {q.premium && (

                  <span className="font-semibold text-gray-700">${q.premium.toLocaleString()}/yr</span>

                )}

                <span

                  className={cn(

                    'rounded-full px-2 py-0.5 text-[10px] font-semibold',

                    q.status === 'BOUND' && 'bg-emerald-100 text-emerald-800',

                    q.status === 'RESPONDED' && 'bg-blue-50 text-blue-700',

                    q.status === 'SENT' && 'bg-amber-50 text-amber-700',

                    q.status === 'PENDING' && 'bg-gray-100 text-gray-600',

                    q.status === 'DECLINED' && 'bg-red-50 text-red-700',

                  )}

                >

                  {q.status}

                </span>

              </div>

            </li>

          )

        })}

      </ul>

    </section>

  )

}



// ─── Role-specific collaboration panel ──────────────────────────────────



function RolePanel({ role, agentFlavor }: { role: Role; agentFlavor: AgentFlavor }) {

  if (role === 'BUYER') {

    return (

      <section className="rounded-xl border border-gray-200 bg-white shadow-sm">

        <header className="flex items-center justify-between border-b border-gray-100 px-4 py-3">

          <div className="flex items-center gap-2">

            <MessageSquare className="h-4 w-4 text-teal-600" />

            <h2 className="text-sm font-semibold text-gray-900">Your agent — Dana Price</h2>

          </div>

          <Link href="#" className="text-[11px] font-semibold text-teal-600 hover:text-teal-700">

            Open inbox →

          </Link>

        </header>

        <ul className="divide-y divide-gray-100">

          {MOCK_MESSAGES.map((m) => (

            <li key={m.id} className="flex items-start gap-3 px-4 py-2.5">

              <div className={cn('mt-1 h-2 w-2 shrink-0 rounded-full', m.unread ? 'bg-teal-500' : 'bg-gray-200')} />

              <div className="min-w-0 flex-1">

                <div className="flex items-center justify-between">

                  <p className="text-[11px] font-semibold text-gray-900">{m.from}</p>

                  <span className="text-[10px] text-gray-400">{m.time}</span>

                </div>

                <p className="truncate text-[11px] text-gray-600">{m.preview}</p>

              </div>

            </li>

          ))}

        </ul>

        <div className="border-t border-gray-100 px-4 py-3">

          <button className="w-full rounded-lg bg-teal-600 px-3 py-2 text-[12px] font-semibold text-white hover:bg-teal-700">

            Message your agent

          </button>

        </div>

      </section>

    )

  }



  if (role === 'AGENT' && agentFlavor === 'RESIDENTIAL') {

    return (

      <section className="rounded-xl border border-gray-200 bg-white shadow-sm">

        <header className="flex items-center justify-between border-b border-gray-100 px-4 py-3">

          <div className="flex items-center gap-2">

            <Users className="h-4 w-4 text-purple-600" />

            <h2 className="text-sm font-semibold text-gray-900">Client pipeline</h2>

          </div>

          <Link href="#" className="text-[11px] font-semibold text-teal-600 hover:text-teal-700">

            Manage →

          </Link>

        </header>

        <ul className="divide-y divide-gray-100">

          {MOCK_CLIENTS.map((c) => (

            <li key={c.id} className="flex items-center justify-between gap-3 px-4 py-2.5">

              <div className="min-w-0">

                <p className="truncate text-[12px] font-semibold text-gray-900">{c.name}</p>

                <p className="text-[10px] text-gray-500">

                  {c.propertyCount} properties · last touch {c.lastTouch}

                </p>

              </div>

              <span

                className={cn(

                  'rounded-full px-2 py-0.5 text-[10px] font-semibold',

                  c.stage === 'Closed' && 'bg-emerald-50 text-emerald-700',

                  c.stage === 'Under Contract' && 'bg-teal-50 text-teal-700',

                  c.stage === 'Touring' && 'bg-blue-50 text-blue-700',

                  c.stage === 'Qualified' && 'bg-amber-50 text-amber-700',

                  c.stage === 'Lead' && 'bg-gray-100 text-gray-600',

                )}

              >

                {c.stage}

              </span>

            </li>

          ))}

        </ul>

      </section>

    )

  }



  if (role === 'AGENT' && agentFlavor === 'CRE') {

    return (

      <section className="rounded-xl border border-gray-200 bg-white shadow-sm">

        <header className="flex items-center justify-between border-b border-gray-100 px-4 py-3">

          <div className="flex items-center gap-2">

            <Building2 className="h-4 w-4 text-indigo-600" />

            <h2 className="text-sm font-semibold text-gray-900">CRE deals & due diligence</h2>

           </div>

          <Link href="#" className="text-[11px] font-semibold text-teal-600 hover:text-teal-700">

            Open pipeline →

          </Link>

        </header>

        <ul className="divide-y divide-gray-100">

          {MOCK_DEALS.map((d) => (

            <li key={d.id} className="flex items-center justify-between gap-3 px-4 py-2.5">

              <div className="min-w-0">

                <p className="truncate text-[12px] font-semibold text-gray-900">{d.name}</p>

                <p className="text-[10px] text-gray-500">

                  {d.type} · {d.dealSize} · {d.phase}

                </p>

              </div>

              <span

                className={cn(

                  'h-2.5 w-2.5 rounded-full',

                  d.insurabilityFlag === 'GREEN' && 'bg-emerald-500',

                  d.insurabilityFlag === 'YELLOW' && 'bg-amber-500',

                  d.insurabilityFlag === 'RED' && 'bg-red-500',

                )}

                title={`Insurability: ${d.insurabilityFlag}`}

              />

            </li>

          ))}

        </ul>

      </section>

    )

  }



  if (role === 'LENDER') {

    return (

      <section className="rounded-xl border border-gray-200 bg-white shadow-sm">

        <header className="flex items-center justify-between border-b border-gray-100 px-4 py-3">

          <div className="flex items-center gap-2">

            <Landmark className="h-4 w-4 text-blue-600" />

            <h2 className="text-sm font-semibold text-gray-900">Mortgage exposure & coverage</h2>

          </div>

          <Link href="#" className="text-[11px] font-semibold text-teal-600 hover:text-teal-700">

            Loan book →

          </Link>

        </header>

        <ul className="divide-y divide-gray-100">

          {MOCK_LOANS.map((l) => (

            <li key={l.id} className="flex items-center justify-between gap-3 px-4 py-2.5">

              <div className="min-w-0">

                <p className="truncate text-[12px] font-semibold text-gray-900">

                  {l.borrower} — {l.property}

                </p>

                <p className="text-[10px] text-gray-500">

                  ${l.loanAmt.toLocaleString()} · {l.ltv}% LTV

                </p>

              </div>

              <span

                className={cn(

                  'rounded-full px-2 py-0.5 text-[10px] font-semibold',

                  l.insuranceStatus === 'In force' && 'bg-emerald-50 text-emerald-700',

                  l.insuranceStatus === 'Binder' && 'bg-blue-50 text-blue-700',

                  l.insuranceStatus === 'Lapsed' && 'bg-red-50 text-red-700',

                  l.insuranceStatus === 'Force-placed' && 'bg-amber-50 text-amber-700',

                )}

              >

                {l.insuranceStatus}

              </span>

            </li>

          ))}

        </ul>

      </section>

    )

  }



  if (role === 'INSURANCE') {

    return (

      <section className="rounded-xl border border-gray-200 bg-white shadow-sm">

        <header className="flex items-center justify-between border-b border-gray-100 px-4 py-3">

          <div className="flex items-center gap-2">

            <Handshake className="h-4 w-4 text-emerald-600" />

            <h2 className="text-sm font-semibold text-gray-900">Incoming quote requests</h2>

          </div>

          <Link href="#" className="text-[11px] font-semibold text-teal-600 hover:text-teal-700">

            Intake queue →

          </Link>

        </header>

        <ul className="divide-y divide-gray-100">

          {MOCK_INTAKE.map((i) => (

            <li key={i.id} className="flex items-center justify-between gap-3 px-4 py-2.5">

              <div className="min-w-0">

                <p className="truncate text-[12px] font-semibold text-gray-900">{i.applicant}</p>

                <p className="truncate text-[10px] text-gray-500">

                  {i.property} · {i.peril}

                </p>

              </div>

              <div className="flex items-center gap-2 text-[11px]">

                <span className="font-semibold text-gray-700">${i.premiumTarget.toLocaleString()}</span>

                <span

                  className={cn(

                    'rounded-full px-2 py-0.5 text-[10px] font-semibold',

                    i.priority === 'HIGH' && 'bg-red-50 text-red-700',

                    i.priority === 'MED' && 'bg-amber-50 text-amber-700',

                    i.priority === 'LOW' && 'bg-gray-100 text-gray-600',

                  )}

                >

                  {i.priority}

                </span>

              </div>

            </li>

          ))}

        </ul>

      </section>

    )

  }



  return null

}



// ─── To-dos / follow-ups ────────────────────────────────────────────────



function TodosSection() {

  const [todos, setTodos] = useState(MOCK_TODOS)

  const [tab, setTab] = useState<DueBucket>('TODAY')

  const [newLabel, setNewLabel] = useState('')



  const counts = useMemo(

    () => ({

      OVERDUE: todos.filter((t) => t.dueBucket === 'OVERDUE' && !t.done).length,

      TODAY: todos.filter((t) => t.dueBucket === 'TODAY' && !t.done).length,

      UPCOMING: todos.filter((t) => t.dueBucket === 'UPCOMING' && !t.done).length,

      DONE: todos.filter((t) => t.done).length,

    }),

    [todos],

  )



  const filtered = useMemo(

    () =>

      todos.filter((t) => (tab === 'DONE' ? t.done : t.dueBucket === tab && !t.done)),

    [todos, tab],

  )



  const addTodo = () => {

    const label = newLabel.trim()

    if (!label) return

    setTodos((prev) => [

      ...prev,

      {

        id: `t${Date.now()}`,

        label,

        due: tab === 'TODAY' ? 'Today' : tab === 'OVERDUE' ? 'Overdue' : 'Upcoming',

        dueBucket: tab === 'DONE' ? 'TODAY' : tab,

        priority: 'MED',

        category: 'GENERAL',

        done: false,

      },

    ])

    setNewLabel('')

  }



  return (

    <section className="rounded-xl border border-gray-200 bg-white shadow-sm">

      <header className="flex items-center justify-between border-b border-gray-100 px-4 py-3">

        <div className="flex items-center gap-2">

          <CheckCircle2 className="h-4 w-4 text-teal-600" />

          <h2 className="text-sm font-semibold text-gray-900">To-dos & follow-ups</h2>

        </div>

      </header>



      <div className="flex border-b border-gray-100 text-[11px]">

        {(['OVERDUE', 'TODAY', 'UPCOMING', 'DONE'] as DueBucket[]).map((b) => (

          <button

            key={b}

            onClick={() => setTab(b)}

            className={cn(

              'flex-1 border-b-2 px-3 py-2 font-semibold transition-colors',

              tab === b ? 'border-teal-500 text-teal-700' : 'border-transparent text-gray-500 hover:text-gray-900',

            )}

          >

            {b[0] + b.slice(1).toLowerCase()}{' '}

            <span className={cn('ml-1 rounded-full px-1.5 text-[9px]', b === 'OVERDUE' && counts.OVERDUE > 0 ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-600')}>

              {counts[b]}

            </span>

          </button>

        ))}

      </div>



      {/* Inline add */}

      <div className="flex items-center gap-2 border-b border-gray-100 px-4 py-2">

        <Plus className="h-3 w-3 text-gray-400" />

        <input

          type="text"

          value={newLabel}

          onChange={(e) => setNewLabel(e.target.value)}

          onKeyDown={(e) => {

            if (e.key === 'Enter') addTodo()

          }}

          placeholder="Add a task and press Enter"

          className="flex-1 bg-transparent text-[11px] focus:outline-none"

        />

      </div>



      <ul className="divide-y divide-gray-100">

        {filtered.length === 0 && (

          <li className="px-4 py-4 text-center text-[11px] text-gray-400">Nothing here — nice work.</li>

        )}

        {filtered.map((t) => (

          <li key={t.id} className="flex items-start gap-3 px-4 py-2.5">

            <input

              type="checkbox"

              checked={t.done}

              onChange={() =>

                setTodos((prev) =>

                  prev.map((x) =>

                    x.id === t.id

                      ? { ...x, done: !x.done, dueBucket: !x.done ? 'DONE' : x.dueBucket }

                      : x,

                  ),

                )

              }

              className="mt-0.5 h-4 w-4 shrink-0 rounded border-gray-300 text-teal-600 focus:ring-teal-500"

            />

            <div className="min-w-0 flex-1">

              <p className={cn('text-[12px]', t.done ? 'text-gray-400 line-through' : 'font-medium text-gray-900')}>

                {t.label}

              </p>

              <div className="mt-0.5 flex items-center gap-2 text-[10px] text-gray-500">

                <span className="flex items-center gap-0.5">

                  <Clock className="h-2.5 w-2.5" /> {t.due}

                </span>

                <span

                  className={cn(

                    'rounded px-1 font-semibold',

                    t.priority === 'HIGH' && 'bg-red-50 text-red-600',

                    t.priority === 'MED' && 'bg-amber-50 text-amber-700',

                    t.priority === 'LOW' && 'bg-gray-100 text-gray-500',

                  )}

                >

                  {t.priority}

                </span>

                <span className="rounded bg-gray-100 px-1 font-semibold text-gray-500">

                  {t.category}

                </span>

              </div>

            </div>

          </li>

        ))}

      </ul>

    </section>

  )

}



// ─── AI Advisor ─────────────────────────────────────────────────────────



function AIAdvisorSection() {

  const [category, setCategory] = useState<InsightCategory | 'ALL'>('ALL')

  const [question, setQuestion] = useState('')

  const [chat, setChat] = useState<Array<{ role: 'user' | 'ai'; text: string }>>([

    { role: 'ai', text: 'I can scan your portfolio, carriers, and market conditions. Try asking about reprice timing or carrier non-renewals.' },

  ])



  const filtered = useMemo(

    () => (category === 'ALL' ? MOCK_INSIGHTS : MOCK_INSIGHTS.filter((i) => i.category === category)),

    [category],

  )



  const ask = () => {

    const q = question.trim()

    if (!q) return

    setChat((prev) => [

      ...prev,

      { role: 'user', text: q },

      {

        role: 'ai',

        text: 'Based on your current book, I see 3 carriers matching your criteria. The best window to reprice is the next 10 days before the FL market tightens further.',

      },

    ])

    setQuestion('')

  }



  return (

    <section className="rounded-xl border border-purple-200 bg-gradient-to-br from-purple-50 via-white to-indigo-50 shadow-sm">

      <header className="flex items-center justify-between border-b border-purple-100 px-4 py-3">

        <div className="flex items-center gap-2">

          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-purple-100">

            <Bot className="h-4 w-4 text-purple-600" />

          </div>

          <div>

            <h2 className="text-sm font-semibold text-gray-900">AI Advisor</h2>

            <p className="text-[10px] text-gray-500">Forward-looking risk & market signals</p>

          </div>

        </div>

        <Sparkles className="h-4 w-4 text-purple-400" />

      </header>



      <div className="flex flex-wrap gap-1 border-b border-purple-100 px-4 py-2">

        {(['ALL', 'MARKET', 'WEATHER', 'REGULATORY', 'PORTFOLIO'] as const).map((c) => (

          <button

            key={c}

            onClick={() => setCategory(c)}

            className={cn(

              'rounded-full px-2 py-0.5 text-[10px] font-semibold transition-colors',

              category === c ? 'bg-purple-600 text-white' : 'bg-white text-purple-700 ring-1 ring-purple-200 hover:bg-purple-100',

            )}

          >

            {c === 'ALL' ? 'All' : c[0] + c.slice(1).toLowerCase()}

          </button>

        ))}

      </div>



      <ul className="max-h-[320px] divide-y divide-purple-100 overflow-y-auto">

        {filtered.map((ins) => (

          <li key={ins.id} className="px-4 py-3">

            <div className="flex items-start gap-2">

              <span

                className={cn(

                  'mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full',

                  ins.severity === 'alert' && 'bg-red-100 text-red-600',

                  ins.severity === 'warn' && 'bg-amber-100 text-amber-600',

                  ins.severity === 'info' && 'bg-blue-100 text-blue-600',

                )}

              >

                {ins.severity === 'alert' ? (

                  <ShieldAlert className="h-3 w-3" />

                ) : ins.severity === 'warn' ? (

                  <AlertTriangle className="h-3 w-3" />

                ) : (

                  <TrendingUp className="h-3 w-3" />

                )}

              </span>

              <div className="min-w-0 flex-1">

                <div className="flex items-center justify-between gap-2">

                   <p className="text-[12px] font-semibold text-gray-900">{ins.title}</p>

                  <span className="rounded-full bg-white px-1.5 py-0.5 text-[9px] font-semibold text-purple-600 ring-1 ring-purple-200">

                    {ins.horizon}

                  </span>

                </div>

                <p className="mt-0.5 text-[11px] leading-snug text-gray-600">{ins.body}</p>

                <button className="mt-1 flex items-center gap-0.5 text-[10px] font-semibold text-purple-600 hover:text-purple-700">

                  Ask advisor <ChevronRight className="h-3 w-3" />

                </button>

              </div>

            </div>

          </li>

        ))}

      </ul>



      {/* Chat composer */}

      <div className="border-t border-purple-100 p-3">

        <div className="mb-2 max-h-28 space-y-1 overflow-y-auto rounded-md bg-white/60 p-2 text-[11px]">

          {chat.map((c, i) => (

            <p

              key={i}

              className={cn(

                'rounded px-2 py-1',

                c.role === 'ai' ? 'bg-purple-50 text-gray-700' : 'bg-teal-50 text-gray-800',

              )}

            >

              <span className="mr-1 font-semibold">

                {c.role === 'ai' ? 'Advisor:' : 'You:'}

              </span>

              {c.text}

            </p>

          ))}

        </div>

        <div className="flex items-center gap-2 rounded-md border border-purple-200 bg-white px-2 py-1.5">

          <input

            type="text"

            value={question}

            onChange={(e) => setQuestion(e.target.value)}

            onKeyDown={(e) => {

              if (e.key === 'Enter') ask()

            }}

            placeholder="Ask about risk, carriers, or timing…"

            className="flex-1 bg-transparent text-[11px] focus:outline-none"

          />

          <button

            onClick={ask}

            className="flex items-center gap-1 rounded bg-purple-600 px-2 py-1 text-[10px] font-semibold text-white hover:bg-purple-700"

          >

            <Send className="h-3 w-3" /> Ask

          </button>

        </div>

      </div>

    </section>

  )

}



// ─── Main export ────────────────────────────────────────────────────────



export function UnifiedDashboard({

  role: roleProp = 'BUYER',

  userName,

  agentFlavor: agentFlavorProp = 'RESIDENTIAL',

}: UnifiedDashboardProps) {

  const [role, setRole] = useState<Role>(roleProp)

  const [agentFlavor, setAgentFlavor] = useState<AgentFlavor>(agentFlavorProp)



  return (

    <div className="mx-auto max-w-7xl p-3 lg:p-5">

      <Hero

        role={role}

        userName={userName}

        agentFlavor={agentFlavor}

        onRoleChange={setRole}

        onFlavorChange={setAgentFlavor}

      />



      <AnalyticsStrip />



      <MarketPulseSection />



      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">

        {/* Left column (main content) */}

        <div className="lg:col-span-2">

          <SavedPropertiesSection />

          <ActiveCarriersSection />

          <QuotePipelineSection />

        </div>



        {/* Right rail */}

        <aside className="space-y-5">

          <RolePanel role={role} agentFlavor={agentFlavor} />

          <TodosSection />

          <AIAdvisorSection />

        </aside>

      </div>

    </div>

  )

}



export default UnifiedDashboard

