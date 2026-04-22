import { Suspense } from 'react'

import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { getProperty, getPropertyRisk, getPropertyInsurance, getPropertyCarriers, getPropertyInsurability, getPropertyPublicData } from '@/lib/api'
import { RiskSummary } from '@/components/property/RiskSummary'
import { RiskBreakdown } from '@/components/property/RiskBreakdown'
import { GatedInsuranceEstimate } from '@/components/property/GatedInsuranceEstimate'
import { GatedCompareButton } from '@/components/property/GatedCompareButton'
import { PropertyDetails } from '@/components/property/PropertyDetails'
import { InsurabilityPanel } from '@/components/property/InsurabilityPanel'
import { BindPathBadge } from '@/components/property/BindPathBadge'
import { MitigationSavingsCard } from '@/components/property/MitigationSavingsCard'
import { ActiveCarriers } from '@/components/property/ActiveCarriers'
import { computeBindPath, computeMitigationPlan } from '@coverguard/shared'
import { SavePropertyButton } from '@/components/property/SavePropertyButton'
import { PropertyChecklists } from '@/components/property/PropertyChecklists'
import { PropertyImages } from '@/components/property/PropertyImages'
import { PropertyPublicInfo } from '@/components/property/PropertyPublicInfo'
import { SidebarLayout } from '@/components/layout/SidebarLayout'
import { PropertyMapInline } from '@/components/map/PropertyMapInline'
import { MobilePropertyTabs } from '@/components/mobile/MobilePropertyTabs'
import { DummyReportBanner } from '@/components/property/DummyReportBanner'
import { PropertyReportButton } from '@/components/property/PropertyReportButton'
import { formatAddress, formatCurrency } from '@coverguard/shared'
import type { Property } from '@coverguard/shared'
import {
  dummyProperty,
  dummyRiskProfile,
  dummyInsuranceEstimate,
  dummyInsurability,
  dummyCarriers,
  dummyPublicData,
} from '@/lib/dummyPropertyData'

interface PropertyPageProps {
  params: Promise<{ id: string }>
}

export async function generateMetadata({ params }: PropertyPageProps): Promise<Metadata> {
  const { id } = await params
  try {
    const property = await getProperty(id)
    return { title: `${property.address}, ${property.city} ${property.state}` }
  } catch {
    return { title: 'Sample Property Report — CoverGuard' }
  }
}

// ── Skeleton loaders for streaming sections ─────────────────────────────────

function SectionSkeleton({ className = '' }: { className?: string }) {
  return (
    <div className={`animate-pulse rounded-xl bg-gray-200 ${className}`}>
      <div className="p-6 space-y-3">
        <div className="h-4 bg-gray-300 rounded w-1/3" />
        <div className="h-3 bg-gray-300 rounded w-2/3" />
        <div className="h-3 bg-gray-300 rounded w-1/2" />
      </div>
    </div>
  )
}

// ── Async data components (streamed via Suspense) ───────────────────────────

async function RiskSection({ id, isDummy }: { id: string; isDummy?: boolean }) {
  const riskProfile = isDummy
    ? dummyRiskProfile
    : await getPropertyRisk(id).catch(() => null)
  if (!riskProfile) return <p className="text-sm text-gray-500">Risk data unavailable.</p>
  return (
    <>
      <RiskSummary profile={riskProfile} />
      <RiskBreakdown profile={riskProfile} />
    </>
  )
}

async function InsurabilitySection({ id, isDummy }: { id: string; isDummy?: boolean }) {
  const status = isDummy
    ? dummyInsurability
    : await getPropertyInsurability(id).catch(() => null)
  if (!status) return null
  return <InsurabilityPanel status={status} />
}

/**
 * Bind-Path Indicator section — renders a Green/Yellow/Red badge based on the
 * combination of live carrier availability and insurability.
 *
 * Spec: docs/gtm/value-add-activities/04-bind-path-indicator.md
 */
async function BindPathSection({ id, isDummy }: { id: string; isDummy?: boolean }) {
  const [carriersData, status] = isDummy
    ? [dummyCarriers, dummyInsurability]
    : await Promise.all([
        getPropertyCarriers(id).catch(() => null),
        getPropertyInsurability(id).catch(() => null),
      ])
  if (!carriersData || !status) return null
  const bindPath = computeBindPath(carriersData, status)
  return <BindPathBadge bindPath={bindPath} />
}

/**
 * Mitigation Savings section — shows the top ways this owner can reduce their
 * premium, computed from insurability + baseline insurance cost.
 *
 * Spec: docs/gtm/value-add-activities/06-mitigation-savings.md
 */
async function MitigationSavingsSection({ id, isDummy }: { id: string; isDummy?: boolean }) {
  const [status, estimate] = isDummy
    ? [dummyInsurability, dummyInsuranceEstimate]
    : await Promise.all([
        getPropertyInsurability(id).catch(() => null),
        getPropertyInsurance(id).catch(() => null),
      ])
  if (!status || !estimate) return null
  const plan = computeMitigationPlan(id, status, estimate.estimatedAnnualTotal)
  if (plan.suggestions.length === 0) return null
  // Auto-expand when the baseline premium is elevated — signals urgency.
  const autoExpand = estimate.estimatedAnnualTotal >= 4000
  return <MitigationSavingsCard plan={plan} defaultExpanded={autoExpand} />
}

async function CarriersSection({ id, address, isDummy }: { id: string; address: string; isDummy?: boolean }) {
  const [carriersData, insuranceEstimate] = isDummy
    ? [dummyCarriers, dummyInsuranceEstimate]
    : await Promise.all([
        getPropertyCarriers(id).catch(() => null),
        getPropertyInsurance(id).catch(() => null),
      ])
  return (
    <>
      {carriersData && <ActiveCarriers data={carriersData} propertyId={id} propertyAddress={address} />}
      {insuranceEstimate && <GatedInsuranceEstimate estimate={insuranceEstimate} />}
    </>
  )
}

async function MapWithRisk({ property, isDummy }: { property: Property; isDummy?: boolean }) {
  const riskProfile = isDummy
    ? dummyRiskProfile
    : await getPropertyRisk(property.id).catch(() => null)
  return <PropertyMapInline property={property} riskProfile={riskProfile} />
}

async function PublicDataSection({ id, address, isDummy, marketValue }: { id: string; address: string; isDummy?: boolean; marketValue?: number | null }) {
  const publicInfo = isDummy
    ? dummyPublicData
    : await getPropertyPublicData(id).catch(() => null)
  if (!publicInfo) return null
  return (
    <>
      {publicInfo.images && publicInfo.images.length > 0 && (
        <PropertyImages images={publicInfo.images} address={address} />
      )}
      <PropertyPublicInfo data={publicInfo} marketValue={marketValue} />
    </>
  )
}

export default async function PropertyPage({ params }: PropertyPageProps) {
  const { id } = await params

  let prop: Property
  let isDummy = false
  try {
    prop = await getProperty(id)
  } catch {
    // Fall back to a dummy property report so the user can see all data points
    prop = dummyProperty
    isDummy = true
  }

  const fullAddress = `${prop.address}, ${prop.city}, ${prop.state} ${prop.zip}`

  // ── Mobile tab content ─────────────────────────────────────────────────
  const overviewPanel = (
    <div className="space-y-4 p-4">
      <Suspense fallback={<SectionSkeleton className="h-20 w-full" />}>
        <BindPathSection id={id} isDummy={isDummy} />
      </Suspense>
      <Suspense fallback={<SectionSkeleton className="h-48 w-full" />}>
        <PublicDataSection id={id} address={fullAddress} isDummy={isDummy} marketValue={prop.marketValue} />
      </Suspense>
      <Suspense fallback={<SectionSkeleton className="h-72 w-full" />}>
        <MapWithRisk property={prop} isDummy={isDummy} />
      </Suspense>
      <Suspense fallback={<SectionSkeleton />}>
        <InsurabilitySection id={id} isDummy={isDummy} />
      </Suspense>
      <Suspense fallback={<SectionSkeleton className="h-32 w-full" />}>
        <MitigationSavingsSection id={id} isDummy={isDummy} />
      </Suspense>
    </div>
  )

  const riskPanel = (
    <div className="space-y-4 p-4">
      <Suspense fallback={<><SectionSkeleton /><SectionSkeleton /></>}>
        <RiskSection id={id} isDummy={isDummy} />
      </Suspense>
    </div>
  )

  const carriersPanel = (
    <div className="space-y-4 p-4">
      <Suspense fallback={<><SectionSkeleton /><SectionSkeleton /></>}>
        <CarriersSection id={id} address={fullAddress} isDummy={isDummy} />
      </Suspense>
    </div>
  )

  const detailsPanel = (
    <div className="space-y-4 p-4">
      <PropertyDetails property={prop} />
    </div>
  )

  const checklistsPanel = (
    <div className="p-4">
      <PropertyChecklists propertyId={prop.id} />
    </div>
  )

  return (
    <SidebarLayout>
      <div className="min-h-screen bg-[#f2f4f7]">

        {isDummy && <DummyReportBanner />}

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
                <p className="text-xs font-medium text-gray-400 uppercase tracking-wider">
                  {isDummy ? 'Sample Property Report' : 'Property Report'}
                </p>
                <h1 className="text-xl font-bold text-gray-900 md:text-2xl mt-0.5">{prop.address}</h1>
                <p className="text-gray-600">{formatAddress(prop)}</p>
                <div className="mt-2 flex flex-wrap items-center gap-4">
                  {prop.marketValue && (
                    <p className="text-lg font-semibold text-brand-700">
                      Est. Market Value: {formatCurrency(prop.marketValue)}
                    </p>
                  )}
                  {prop.estimatedValue && (
                    <p className={prop.marketValue ? 'text-sm text-gray-600' : 'text-lg font-semibold text-brand-700'}>
                      Assessed Value: {formatCurrency(prop.estimatedValue)}
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
                <PropertyReportButton property={prop} />
                {!isDummy && (
                  <>
                    <GatedCompareButton propertyId={prop.id} />
                    <SavePropertyButton propertyId={prop.id} />
                  </>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* ── Mobile: tabbed layout ────────────────────────────────── */}
        <MobilePropertyTabs
          tabs={[
            { id: 'overview',    label: 'Overview' },
            { id: 'risk',        label: 'Risk' },
            { id: 'carriers',    label: 'Carriers' },
            { id: 'details',     label: 'Details' },
            ...(!isDummy ? [{ id: 'checklists',  label: 'Checklists' }] : []),
          ]}
          panels={{
            overview:   overviewPanel,
            risk:       riskPanel,
            carriers:   carriersPanel,
            details:    detailsPanel,
            ...(!isDummy ? { checklists: checklistsPanel } : {}),
          }}
        />

        {/* ── Desktop: 3-column grid ───────────────────────────────── */}
        <div className="mx-auto hidden max-w-7xl px-4 py-8 md:block">
          <div className="grid gap-8 lg:grid-cols-3">
            {/* Left / main column */}
            <div className="space-y-8 lg:col-span-2">
              <Suspense fallback={<SectionSkeleton className="h-20 w-full" />}>
                <BindPathSection id={id} isDummy={isDummy} />
              </Suspense>
              <Suspense fallback={<SectionSkeleton className="h-48 w-full" />}>
                <PublicDataSection id={id} address={fullAddress} isDummy={isDummy} marketValue={prop.marketValue} />
              </Suspense>
              <Suspense fallback={<SectionSkeleton className="h-72 w-full" />}>
                <MapWithRisk property={prop} isDummy={isDummy} />
              </Suspense>
              <Suspense fallback={<SectionSkeleton />}>
                <InsurabilitySection id={id} isDummy={isDummy} />
              </Suspense>
              <Suspense fallback={<SectionSkeleton className="h-32 w-full" />}>
                <MitigationSavingsSection id={id} isDummy={isDummy} />
              </Suspense>
              <Suspense fallback={<><SectionSkeleton /><SectionSkeleton /></>}>
                <RiskSection id={id} isDummy={isDummy} />
              </Suspense>
              <PropertyDetails property={prop} />
              {!isDummy && <PropertyChecklists propertyId={prop.id} />}
            </div>

            {/* Right sidebar */}
            <div className="space-y-6">
              <Suspense fallback={<><SectionSkeleton /><SectionSkeleton /></>}>
                <CarriersSection id={id} address={fullAddress} isDummy={isDummy} />
              </Suspense>
            </div>
          </div>
        </div>

      </div>
    </SidebarLayout>
  )
}
