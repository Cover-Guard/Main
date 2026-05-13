import { Check, X, MapPin, Layers, Workflow, Users } from 'lucide-react'

const pillars = [
  {
    icon: MapPin,
    title: 'All 50 states. Day one.',
    body:
      'CoverGuard is national from launch. Other agent-facing insurability tools have rolled out one state at a time.',
  },
  {
    icon: Layers,
    title: '12+ public data sources.',
    body:
      'FEMA, USGS, NOAA, Cal Fire, USFS, FBI, ASCE 7, and the Esri Living Atlas. Sourced, auditable, no black-box ML.',
  },
  {
    icon: Workflow,
    title: 'Risk + carrier + binding quote — one workflow.',
    body:
      'Carrier-side incumbents stop at risk scores. Quote/bind platforms stop at quotes. We deliver the whole chain.',
  },
  {
    icon: Users,
    title: 'Two portals, one data spine.',
    body:
      'Buyer&rsquo;s agent on one side, listing agent on the other, the buyer in the middle — same property record across the table.',
  },
]

// Refreshed May 13, 2026 — see docs/competitive-scrub-2026-05-13.md
const competitors = [
  { name: 'CoverGuard', risk: true, carriers: true, binding: true, national: true, twoPortal: true },
  { name: 'Rhino DealShield (CA only · multi-state goal by EOY 2026)', risk: true, carriers: true, binding: false, national: false, twoPortal: false },
  { name: 'ZestyAI / CAPE (Moody’s) / Betterview', risk: true, carriers: false, binding: false, national: true, twoPortal: false },
  { name: 'HazardHub / LexisNexis × Cytora', risk: true, carriers: false, binding: false, national: true, twoPortal: false },
  { name: 'First Street Risk Factor (Zillow removed Dec 2025)', risk: true, carriers: false, binding: false, national: true, twoPortal: false },
  { name: 'RealReports / SourceRE (MLS bundles, no carrier signal)', risk: true, carriers: false, binding: false, national: true, twoPortal: false },
  { name: 'Westwood Insurance (new construction only)', risk: false, carriers: true, binding: true, national: true, twoPortal: false },
  { name: 'CoverForce (commercial)', risk: false, carriers: true, binding: true, national: true, twoPortal: false },
  { name: 'Matic Insurance (mortgage embedded)', risk: false, carriers: true, binding: true, national: true, twoPortal: false },
]

function Mark({ on }: { on: boolean }) {
  return on ? (
    <Check className="h-4 w-4 text-emerald-600" />
  ) : (
    <X className="h-4 w-4 text-gray-300" />
  )
}

export function WhyCoverGuard() {
  return (
    <section id="why" className="py-24 bg-white border-t border-gray-100">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto">
          <p className="text-sm font-semibold text-brand-600 uppercase tracking-wider">Why CoverGuard</p>
          <h2 className="mt-3 text-3xl sm:text-4xl font-bold text-gray-900">
            What only we can say in 2026.
          </h2>
          <p className="mt-4 text-lg text-gray-600">
            One direct competitor — California-only, with a public goal of multi-state by end of 2026.
            Adjacent layers serve carriers (not the transaction). New-construction embedded plays only cover builders.
            CoverGuard is the only platform that combines risk, carrier writing-status, and binding workflow nationally —
            for resale and new construction alike, agents and consumers alike.
          </p>
        </div>

        {/* Pillars */}
        <div className="mt-14 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {pillars.map((p) => (
            <div
              key={p.title}
              className="flex flex-col items-start p-6 rounded-2xl bg-brand-50/50 border border-brand-100"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-600 text-white">
                <p.icon className="h-5 w-5" />
              </div>
              <h3 className="mt-4 text-base font-semibold text-gray-900">{p.title}</h3>
              <p className="mt-2 text-sm text-gray-600 leading-relaxed">{p.body}</p>
            </div>
          ))}
        </div>

        {/* Comparison matrix */}
        <div className="mt-16 overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left py-3 pr-4 font-semibold text-gray-900">Platform</th>
                <th className="text-center py-3 px-3 font-semibold text-gray-900">Risk data</th>
                <th className="text-center py-3 px-3 font-semibold text-gray-900">Carrier writing-status</th>
                <th className="text-center py-3 px-3 font-semibold text-gray-900">Binding quote</th>
                <th className="text-center py-3 px-3 font-semibold text-gray-900">National</th>
                <th className="text-center py-3 pl-3 font-semibold text-gray-900">Agent + Consumer</th>
              </tr>
            </thead>
            <tbody>
              {competitors.map((c) => {
                const isUs = c.name === 'CoverGuard'
                return (
                  <tr
                    key={c.name}
                    className={`border-b border-gray-100 ${isUs ? 'bg-brand-50/60' : ''}`}
                  >
                    <td className={`py-3 pr-4 ${isUs ? 'font-semibold text-brand-700' : 'text-gray-700'}`}>
                      {c.name}
                    </td>
                    <td className="py-3 px-3"><div className="flex justify-center"><Mark on={c.risk} /></div></td>
                    <td className="py-3 px-3"><div className="flex justify-center"><Mark on={c.carriers} /></div></td>
                    <td className="py-3 px-3"><div className="flex justify-center"><Mark on={c.binding} /></div></td>
                    <td className="py-3 px-3"><div className="flex justify-center"><Mark on={c.national} /></div></td>
                    <td className="py-3 pl-3"><div className="flex justify-center"><Mark on={c.twoPortal} /></div></td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          <p className="mt-3 text-xs text-gray-500">
            Comparison reflects publicly disclosed positioning as of May 13, 2026. Competitor capabilities change frequently.
        