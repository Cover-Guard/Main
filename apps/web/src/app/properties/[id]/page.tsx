import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowLeft, GitCompare } from 'lucide-react'
import { getProperty, getPropertyRisk, getPropertyInsurance, getPropertyCarriers, getPropertyInsurability } from '@/lib/api'
import { RiskSummary } from '@/components/property/RiskSummary'
import { RiskBreakdown } from '@/components/property/RiskBreakdown'
import { InsuranceCostEstimate } from '@/components/property/InsuranceCostEstimate'
import { PropertyDetails } from '@/components/property/PropertyDetails'
import { InsurabilityPanel } from '@/components/property/InsurabilityPanel'
import { ActiveCarriers } from '@/components/property/ActiveCarriers'
import { SavePropertyButton } from '@/components/property/SavePropertyButton'
import { WatchlistButton } from '@/components/watchlist/WatchlistButton'
import { SidebarLayout } from '@/components/layout/SidebarLayout'
import { PropertyMapInline } from '@/components/map/PropertyMapInline'
import { MobilePropertyTabs } from '@/components/mobile/MobilePropertyTabs'
import { formatAddress, formatCurrency } from '@coverguard/shared'

interface PropertyPageProps {
  params: Promise<{ id: string }>
}

export async function generateMetadata({ params }: PropertyPageProps): Promise<Metadata> {
  const { id } = await params
  try {
    const property = await getProperty(id)
    return { title: `${property.address}, ${property.city} ${property.state}` }
  } catch {
    return { title: 'Property Not Found' }
  }
}

export default async function PropertyPage({ params }: PropertyPageProps) {
  const { id } = await params

  const [property, risk, insurance, carriers, insurability] = await Promise.allSettled([
    getProperty(id),
    getPropertyRisk(id),
    getPropertyInsurance(id),
    getPropertyCarriers(id),
    getPropertyInsurability(id),
  ])

  if (property.status === 'rejected') notFound()

  const prop = property.value
  const riskProfile = risk.status === 'fulfilled' ? risk.value : null
  const insuranceEstimate = insurance.status === 'fulfilled' ? insurance.value : null
  const carriersData = carriers.status === 'fulfilled' ? carriers.value : null
  const insurabilityStatus = insurability.status === 'fulfilled' ? insurability.value : null

  const fullAddress = `${prop.address}, ${prop.city}, ${prop.state} ${prop.zip}`

  // ── Mobile tab content ─────────────────────────────────────────────────
  const overviewPanel = (
    <div className="space-y-4 p-4">
      <PropertyMapInline property={prop} riskProfile={riskProfile} />
      {insurabilityStatus && <InsurabilityPanel status={insurabilityStatus} />}
    </div>
  )

  const riskPanel = (
    <div className="space-y-4 p-4">
      {riskProfile ? (
        <>
          <RiskSummary profile={riskProfile} />
          <RiskBreakdown profile={riskProfile} />
        </>
      ) : (
        <p className="text-sm text-gray-500">Risk data unavailable.</p>
      )}
    </div>
  )

  const carriersPanel = (
    <div className="space-y-4 p-4">
      {carriersData ? (
        <ActiveCarriers data={carriersData} propertyId={prop.id} propertyAddress={fullAddress} />
      ) : (
        <p className="text-sm text-gray-500">Carrier data unavailable.</p>
      )}
      {insuranceEstimate && <InsuranceCostEstimate estimate={insuranceEstimate} />}
    </div>
  )

  const detailsPanel = (
    <div className="p-4">
      <PropertyDetails property={prop} />
    </div>
  )

  return (
    <SidebarLayout>
      <div className="min-h-screen bg-[#f2f4f7]">

        {/* Header */}
        <div className="bg-white border-b border-gray-200">
          <div className="mx-auto max-w-7xl px-4 py-4 md:py-5">
            {/* Breadcrumb */}
            <div className="flex items-center gap-2 mb-3">
              <Link
                href="/search"
                className="flex items-center gap-1 text-sm text-gray-400 hover:text-gray-600 transition-colors"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                Back to search
              </Link>
            </div>
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-medium text-gray-400 uppercase tracking-wider">Property Report</p>
                <h1 className="text-xl font-bold text-gray-900 md:text-2xl mt-0.5">{prop.address}</h1>
                <p className="text-gray-600">{formatAddress(prop)}</p>
                <div className="mt-2 flex flex-wrap items-center gap-4">
                  {prop.estimatedValue && (
                    <p className="text-lg font-semibold text-brand-700">
                      Est. {formatCurrency(prop.estimatedValue)}
                    </p>
                  )}
                  {prop.parcelId && (
                    <p className="text-sm text-gray-500">
                      APN / Parcel: <span className="font-mono font-medium text-gray-700">{prop.parcelId}</span>
                    </p>
                  )}
                </div>
              </div>
              {/* Actions */}
              <div className="flex shrink-0 items-center gap-2 mt-1">
                <Link
                  href={`/compare?ids=${prop.id}`}
                  className="hidden sm:flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  <GitCompare className="h-4 w-4" />
                  Compare
                </Link>
                <WatchlistButton propertyId={prop.id} />
                <SavePropertyButton propertyId={prop.id} />
              </div>
            </div>
          </div>
        </div>

        {/* ── Mobile: tabbed layout ────────────────────────────────── */}
        <MobilePropertyTabs
          tabs={[
            { id: 'overview',  label: 'Overview' },
            { id: 'risk',      label: 'Risk' },
            { id: 'carriers',  label: 'Carriers' },
            { id: 'details',   label: 'Details' },
          ]}
          panels={{
            overview: overviewPanel,
            risk:     riskPanel,
            carriers: carriersPanel,
            details:  detailsPanel,
          }}
        />

        {/* ── Desktop: 3-column grid ───────────────────────────────── */}
        <div className="mx-auto hidden max-w-7xl px-4 py-8 md:block">
          <div className="grid gap-8 lg:grid-cols-3">
            {/* Left / main column */}
            <div className="space-y-8 lg:col-span-2">
              <PropertyMapInline property={prop} riskProfile={riskProfile} />
              {insurabilityStatus && <InsurabilityPanel status={insurabilityStatus} />}
              {riskProfile && (
                <>
                  <RiskSummary profile={riskProfile} />
                  <RiskBreakdown profile={riskProfile} />
                </>
              )}
              <PropertyDetails property={prop} />
            </div>

            {/* Right sidebar */}
            <div className="space-y-6">
              {carriersData && (
                <ActiveCarriers
                  data={carriersData}
                  propertyId={prop.id}
                  propertyAddress={fullAddress}
                />
              )}
              {insuranceEstimate && <InsuranceCostEstimate estimate={insuranceEstimate} />}
            </div>
          </div>
        </div>

      </div>
    </SidebarLayout>
  )
}
