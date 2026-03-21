import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { getProperty, getPropertyRisk, getPropertyInsurance, getPropertyCarriers, getPropertyInsurability } from '@/lib/api'
import { RiskSummary } from '@/components/property/RiskSummary'
import { RiskBreakdown } from '@/components/property/RiskBreakdown'
import { InsuranceCostEstimate } from '@/components/property/InsuranceCostEstimate'
import { PropertyDetails } from '@/components/property/PropertyDetails'
import { InsurabilityPanel } from '@/components/property/InsurabilityPanel'
import { ActiveCarriers } from '@/components/property/ActiveCarriers'
import { SidebarLayout } from '@/components/layout/SidebarLayout'
import { PropertyMapInline } from '@/components/map/PropertyMapInline'
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

  return (
    <SidebarLayout>
      <div className="min-h-screen bg-[#f2f4f7]">

      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="mx-auto max-w-7xl px-4 py-6">
          <p className="text-sm text-gray-500">Property Report</p>
          <h1 className="text-2xl font-bold text-gray-900">{prop.address}</h1>
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
      </div>

      <div className="mx-auto max-w-7xl px-4 py-8">
        <div className="grid gap-8 lg:grid-cols-3">
          {/* Left / main column */}
          <div className="space-y-8 lg:col-span-2">
            {/* Map */}
            <PropertyMapInline property={prop} riskProfile={riskProfile} />

            {/* Insurability — the hero feature */}
            {insurabilityStatus && (
              <InsurabilityPanel status={insurabilityStatus} />
            )}

            {/* Risk scores */}
            {riskProfile && (
              <>
                <RiskSummary profile={riskProfile} />
                <RiskBreakdown profile={riskProfile} />
              </>
            )}

            {/* Property details */}
            <PropertyDetails property={prop} />
          </div>

          {/* Right sidebar */}
          <div className="space-y-6">
            {/* Active carriers + quote request — primary CTA */}
            {carriersData && (
              <ActiveCarriers
                data={carriersData}
                propertyId={prop.id}
                propertyAddress={fullAddress}
              />
            )}

            {/* Insurance cost estimate */}
            {insuranceEstimate && (
              <InsuranceCostEstimate estimate={insuranceEstimate} />
            )}
          </div>
        </div>
      </div>
      </div>
    </SidebarLayout>
  )
}
