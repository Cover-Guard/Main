'use client'

import { useState, useCallback, useEffect, useRef, Component, type ReactNode } from 'react'
import {
  Map,
  AdvancedMarker,
  InfoWindow,
  useMap,
  useApiIsLoaded,
} from '@vis.gl/react-google-maps'
import type { FeatureCollection } from 'geojson'
import type { Property, PropertyRiskProfile, RiskLevel } from '@coverguard/shared'
import {
  MapPin,
  Layers,
  AlertTriangle,
  Droplets,
  Flame,
  Wind,
  Activity,
  ShieldAlert,
  Shield,
  Eye,
  EyeOff,
  FileText,
  Sun,
  CloudOff,
} from 'lucide-react'
import { PropertyRiskReportModal } from '@/components/property/PropertyReportModal'

const GOOGLE_MAPS_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? ''

interface PropertyMapProps {
  properties?: Property[]
  selectedProperty?: Property | null
  riskProfile?: PropertyRiskProfile | null
  onSelectProperty?: (property: Property) => void
  /** Called when user clicks on the map (not on a marker). Provides lat/lng for reverse geocoding. */
  onMapClick?: (latLng: { lat: number; lng: number }) => void
  center?: { lat: number; lng: number }
  zoom?: number
  className?: string
}

type RiskLayer = 'flood' | 'fire' | 'wind' | 'earthquake' | 'crime' | 'heat' | 'drought'

const RISK_LAYER_CONFIG: Record<
  RiskLayer,
  {
    label: string
    color: string
    icon: typeof Droplets
    shows: string
    source: string
    coverage: string
  }
> = {
  flood: {
    label: 'Flood',
    color: '#3b82f6',
    icon: Droplets,
    shows: 'FEMA-designated flood hazard zones and 100-year floodplains.',
    source: 'FEMA National Flood Hazard Layer',
    coverage: 'Not all areas are FEMA-mapped â€” unmapped parcels show no overlay.',
  },
  fire: {
    label: 'Wildfire',
    color: '#ef4444',
    icon: Flame,
    shows: 'Wildfire hazard potential and wildland-urban interface zones.',
    source: 'USDA Wildfire Risk to Communities + USFS WUI',
    coverage: 'Highest detail in forested and wildland-adjacent areas.',
  },
  wind: {
    label: 'Hurricane Surge',
    color: '#a855f7',
    icon: Wind,
    shows: 'NOAA Coastal Flood Hazard Composite â€” SLOSH storm surge + FEMA flood zones + sea-level rise.',
    source: 'NOAA Coastal Flood Exposure Mapper (per-category SLOSH services retired; composite is the active replacement)',
    coverage: 'Coastal regions only â€” inland areas show no overlay. Composite does not distinguish Saffir-Simpson categories.',
  },
  earthquake: {
    label: 'Earthquake',
    color: '#f97316',
    icon: Activity,
    shows: 'Probable ground-shaking intensity from seismic hazard modeling.',
    source: 'USGS 2014 National Seismic Hazard Model',
    coverage: 'Shading can be subtle in low-risk regions.',
  },
  crime: {
    label: 'Crime & Vulnerability',
    color: '#6b7280',
    icon: ShieldAlert,
    shows: 'Violent + property crime (FBI) plus CDC Social Vulnerability Index by census tract.',
    source: 'FBI Crime Data Explorer (score) + CDC SVI via Esri Living Atlas (overlay)',
    coverage: 'FBI has no public tile service; the overlay shows SVI, which correlates with crime via socioeconomic factors.',
  },
  heat: {
    label: 'Extreme Heat',
    color: '#f59e0b',
    icon: Sun,
    shows: 'FEMA NRI Heat Wave risk rating by census tract. Score also reflects â‰¥100Â°F days today and projected to 2050.',
    source: 'FEMA National Risk Index (HWAV_RISKR) + NOAA NCEI state climatology + IPCC AR6 projections',
    coverage: 'Nationwide census-tract coverage via FEMA NRI.',
  },
  drought: {
    label: 'Drought',
    color: '#b45309',
    icon: CloudOff,
    shows: 'Current US Drought Monitor severity (D0â€“D4) polygons.',
    source: 'US Drought Monitor (Esri Living Atlas) + IPCC AR6 precipitation projections',
    coverage: 'Updated weekly. Overlay renders active drought polygons; circle reflects subsidence + projected drying.',
  },
}
// Ã¢Â”Â€Ã¢Â”Â€Ã¢Â”Â€ ArcGIS Tile Service URLs Ã¢Â”Â€Ã¢Â”Â€Ã¢Â”Â€Ã¢Â”Â€Ã¢Â”Â€Ã¢Â”Â€Ã¢Â”Â€Ã¢Â”Â€Ã¢Â”Â€Ã¢Â”Â€Ã¢Â”Â€Ã¢Â”Â€Ã¢Â”Â€Ã¢Â”Â€Ã¢Â”Â€Ã¢Â”Â€Ã¢Â”Â€Ã¢Â”Â€Ã¢Â”Â€Ã¢Â”Â€Ã¢Â”Â€Ã¢Â”Â€Ã¢Â”Â€Ã¢Â”Â€Ã¢Â”Â€Ã¢Â”Â€Ã¢Â”Â€Ã¢Â”Â€Ã¢Â”Â€Ã¢Â”Â€Ã¢Â”Â€Ã¢Â”Â€Ã¢Â”Â€Ã¢Â”Â€Ã¢Â”Â€Ã¢Â”Â€Ã¢Â”Â€Ã¢Â”Â€Ã¢Â”Â€Ã¢Â”Â€Ã¢Â”Â€Ã¢Â”Â€Ã¢Â”Â€Ã¢Â”Â€Ã¢Â”Â€Ã¢Â”Â€Ã¢Â”Â€Ã¢Â”Â€Ã¢Â”Â€Ã¢Â”Â€
// Raster tile overlays are intentionally disabled â€” every active risk layer
// now renders as GeoJSON polygons via `ArcGISFeatureOverlay` (see
// `ARCGIS_FEATURE_SERVICES` below). The const is kept (empty) so the JSX
// that iterates it remains a harmless no-op.
//
// Original tile sources (kept here as documentation only):
//   flood:      FEMA NFHL MapServer/28 (Flood Hazard Zones)
//   fire:       USFS WUI 2020 MapServer/0 + USDA Wildfire Risk to Communities
//   wind:       NOAA Coastal Flood Hazard Composite MapServer (per-state rasters)
//   earthquake: USGS 2014 NSHM MapServer/0 (2% in 50yr, 0.2s SA)
const ARCGIS_TILE_SERVICES: Partial<
  Record<RiskLayer, Array<{ url: string; layers: string; label: string }>>
> = {}

// â”€â”€â”€ ArcGIS FeatureServer overlays â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// For layers whose only public source is a FeatureServer (no MapServer
// `/export` support), we fetch GeoJSON for the current viewport and render
// polygons via `google.maps.Data`. One entry per risk layer.
interface FeatureServiceConfig {
  url: string // .../FeatureServer/N
  label: string
  outFields: string // comma-separated
  where?: string // optional SQL WHERE filter
  styleField: string // attribute whose value selects the style
  styleMap: Record<string, { fill: string; stroke: string; fillOpacity?: number }>
  fallbackStyle: { fill: string; stroke: string; fillOpacity?: number }
  /** Don't fetch at zoom levels below this â€” prevents pulling 80k+ features. */
  minZoom: number
  /** Max features per request (ArcGIS default is 1000â€“2000). */
  resultRecordCount: number
}

// FEMA NRI Census Tracts FeatureServer â€” a single national dataset that
// publishes per-tract risk ratings for every major hazard via `<HAZ>_RISKR`
// fields. We hit this same endpoint with different fields/styles for flood,
// fire, wind, and earthquake so all layers render as polygons.
const NRI_CENSUS_TRACTS_URL =
  'https://services.arcgis.com/XG15cJAlne2vxtgt/arcgis/rest/services/NRI_CensusTracts_v117/FeatureServer/0'

// Reusable rating-â†’-style maps keyed off the standard NRI 5-bucket scale.
// Each hazard tints its own palette but the bucket structure is identical.
const buildRiskStyleMap = (palette: {
  veryHigh: { fill: string; stroke: string }
  high: { fill: string; stroke: string }
  moderate: { fill: string; stroke: string }
  low: { fill: string; stroke: string }
  veryLow: { fill: string; stroke: string }
}): Record<string, { fill: string; stroke: string; fillOpacity?: number }> => ({
  'Very High':           { ...palette.veryHigh, fillOpacity: 0.42 },
  'Relatively High':     { ...palette.high,     fillOpacity: 0.34 },
  'Relatively Moderate': { ...palette.moderate, fillOpacity: 0.28 },
  'Relatively Low':      { ...palette.low,      fillOpacity: 0.22 },
  'Very Low':            { ...palette.veryLow,  fillOpacity: 0.18 },
})

const ARCGIS_FEATURE_SERVICES: Partial<Record<RiskLayer, FeatureServiceConfig>> = {
  flood: {
    url: NRI_CENSUS_TRACTS_URL,
    label: 'FEMA NRI Riverine Flood',
    outFields: 'RFLD_RISKR,STCOFIPS',
    where: "RFLD_RISKR IS NOT NULL AND RFLD_RISKR <> 'No Rating' AND RFLD_RISKR <> 'Not Applicable'",
    styleField: 'RFLD_RISKR',
    styleMap: buildRiskStyleMap({
      veryHigh: { fill: '#1e3a8a', stroke: '#172554' },
      high:     { fill: '#1d4ed8', stroke: '#1e3a8a' },
      moderate: { fill: '#3b82f6', stroke: '#1e40af' },
      low:      { fill: '#60a5fa', stroke: '#2563eb' },
      veryLow:  { fill: '#bfdbfe', stroke: '#1d4ed8' },
    }),
    fallbackStyle: { fill: '#3b82f6', stroke: '#1e40af', fillOpacity: 0.22 },
    minZoom: 9,
    resultRecordCount: 2000,
  },
  fire: {
    url: NRI_CENSUS_TRACTS_URL,
    label: 'FEMA NRI Wildfire',
    outFields: 'WFIR_RISKR,STCOFIPS',
    where: "WFIR_RISKR IS NOT NULL AND WFIR_RISKR <> 'No Rating' AND WFIR_RISKR <> 'Not Applicable'",
    styleField: 'WFIR_RISKR',
    styleMap: buildRiskStyleMap({
      veryHigh: { fill: '#7f1d1d', stroke: '#450a0a' },
      high:     { fill: '#dc2626', stroke: '#7f1d1d' },
      moderate: { fill: '#f97316', stroke: '#9a3412' },
      low:      { fill: '#fb923c', stroke: '#c2410c' },
      veryLow:  { fill: '#fed7aa', stroke: '#9a3412' },
    }),
    fallbackStyle: { fill: '#ef4444', stroke: '#7f1d1d', fillOpacity: 0.22 },
    minZoom: 9,
    resultRecordCount: 2000,
  },
  wind: {
    url: NRI_CENSUS_TRACTS_URL,
    label: 'FEMA NRI Hurricane',
    outFields: 'HRCN_RISKR,STCOFIPS',
    where: "HRCN_RISKR IS NOT NULL AND HRCN_RISKR <> 'No Rating' AND HRCN_RISKR <> 'Not Applicable'",
    styleField: 'HRCN_RISKR',
    styleMap: buildRiskStyleMap({
      veryHigh: { fill: '#581c87', stroke: '#3b0764' },
      high:     { fill: '#7e22ce', stroke: '#581c87' },
      moderate: { fill: '#a855f7', stroke: '#6b21a8' },
      low:      { fill: '#c084fc', stroke: '#7e22ce' },
      veryLow:  { fill: '#e9d5ff', stroke: '#7e22ce' },
    }),
    fallbackStyle: { fill: '#a855f7', stroke: '#6b21a8', fillOpacity: 0.22 },
    minZoom: 9,
    resultRecordCount: 2000,
  },
  earthquake: {
    url: NRI_CENSUS_TRACTS_URL,
    label: 'FEMA NRI Earthquake',
    outFields: 'ERQK_RISKR,STCOFIPS',
    where: "ERQK_RISKR IS NOT NULL AND ERQK_RISKR <> 'No Rating' AND ERQK_RISKR <> 'Not Applicable'",
    styleField: 'ERQK_RISKR',
    styleMap: buildRiskStyleMap({
      veryHigh: { fill: '#7c2d12', stroke: '#431407' },
      high:     { fill: '#c2410c', stroke: '#7c2d12' },
      moderate: { fill: '#f97316', stroke: '#9a3412' },
      low:      { fill: '#fb923c', stroke: '#c2410c' },
      veryLow:  { fill: '#fed7aa', stroke: '#9a3412' },
    }),
    fallbackStyle: { fill: '#f97316', stroke: '#9a3412', fillOpacity: 0.22 },
    minZoom: 9,
    resultRecordCount: 2000,
  },
  drought: {
    url: 'https://services.arcgis.com/P3ePLMYs2RVChkJx/arcgis/rest/services/US_Drought_Intensity_v1/FeatureServer/0',
    label: 'US Drought Monitor',
    outFields: 'dm,Name',
    styleField: 'dm',
    styleMap: {
      '0': { fill: '#fde68a', stroke: '#d97706', fillOpacity: 0.28 }, // D0 Abnormally Dry
      '1': { fill: '#fcd34d', stroke: '#b45309', fillOpacity: 0.32 }, // D1 Moderate
      '2': { fill: '#fb923c', stroke: '#9a3412', fillOpacity: 0.38 }, // D2 Severe
      '3': { fill: '#ef4444', stroke: '#7f1d1d', fillOpacity: 0.42 }, // D3 Extreme
      '4': { fill: '#991b1b', stroke: '#450a0a', fillOpacity: 0.5 },  // D4 Exceptional
    },
    fallbackStyle: { fill: '#b45309', stroke: '#7c2d12', fillOpacity: 0.25 },
    minZoom: 4, // USDM polygons are continent-scale; OK to show early
    resultRecordCount: 1000,
  },
  heat: {
    url: 'https://services.arcgis.com/XG15cJAlne2vxtgt/arcgis/rest/services/NRI_CensusTracts_v117/FeatureServer/0',
    label: 'FEMA NRI Heat Wave',
    outFields: 'HWAV_RISKR,STCOFIPS',
    where: "HWAV_RISKR IS NOT NULL AND HWAV_RISKR <> 'No Rating'",
    styleField: 'HWAV_RISKR',
    styleMap: {
      'Very High':            { fill: '#991b1b', stroke: '#450a0a', fillOpacity: 0.42 },
      'Relatively High':      { fill: '#ef4444', stroke: '#7f1d1d', fillOpacity: 0.34 },
      'Relatively Moderate':  { fill: '#f59e0b', stroke: '#b45309', fillOpacity: 0.28 },
      'Relatively Low':       { fill: '#fbbf24', stroke: '#92400e', fillOpacity: 0.22 },
      'Very Low':             { fill: '#fde68a', stroke: '#a16207', fillOpacity: 0.18 },
    },
    fallbackStyle: { fill: '#f59e0b', stroke: '#b45309', fillOpacity: 0.2 },
    // NRI tracts are very granular â€” only fetch at city/neighborhood zoom.
    minZoom: 9,
    resultRecordCount: 2000,
  },
  crime: {
    url: 'https://services3.arcgis.com/ZvidGQkLaDJxRSJ2/arcgis/rest/services/CDC_SVI_2020/FeatureServer/0',
    label: 'CDC Social Vulnerability Index',
    outFields: 'RPL_THEMES,COUNTY,STATE',
    where: 'RPL_THEMES >= 0',
    styleField: 'RPL_THEMES',
    // RPL_THEMES is a 0â€“1 percentile; ArcGISFeatureOverlay bins it numerically
    // (styleMap keys are discrete strings and can't express a range).
    styleMap: {},
    fallbackStyle: { fill: '#6b7280', stroke: '#1f2937', fillOpacity: 0.25 },
    minZoom: 8,
    resultRecordCount: 2000,
  },
}
// â”€â”€â”€ Mock risk data for demo when no real risk profile is provided â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const MOCK_RISK_PROFILE: Record<RiskLayer, { score: number; level: RiskLevel }> = {
  flood:      { score: 62, level: 'MODERATE' },
  fire:       { score: 78, level: 'HIGH' },
  wind:       { score: 45, level: 'MODERATE' },
  earthquake: { score: 28, level: 'LOW' },
  crime:      { score: 55, level: 'MODERATE' },
  heat:       { score: 50, level: 'HIGH' },
  drought:    { score: 35, level: 'MODERATE' },
}

function riskLevelBadgeColor(level: RiskLevel): string {
  switch (level) {
    case 'LOW':
      return 'bg-green-100 text-green-700'
    case 'MODERATE':
      return 'bg-yellow-100 text-yellow-700'
    case 'HIGH':
      return 'bg-orange-100 text-orange-700'
    case 'VERY_HIGH':
      return 'bg-red-100 text-red-700'
    case 'EXTREME':
      return 'bg-red-200 text-red-900'
  }
}


/** Imperatively re-centres the map when the computed center changes. */
function MapController({ center, zoom }: { center: { lat: number; lng: number }; zoom: number }) {
  const map = useMap()
  const prevCenterRef = useRef(center)

  useEffect(() => {
    if (!map) return
    const prev = prevCenterRef.current
    if (prev.lat !== center.lat || prev.lng !== center.lng) {
      map.panTo(center)
      map.setZoom(zoom)
      prevCenterRef.current = center
    }
  }, [map, center, zoom])

  return null
}

export function PropertyMap({
  properties = [],
  selectedProperty,
  riskProfile,
  onSelectProperty,
  onMapClick,
  center,
  zoom = 13,
  className = '',
}: PropertyMapProps) {
  const [activeLayers, setActiveLayers] = useState<Set<RiskLayer>>(new Set())
  const [popupInfo, setPopupInfo] = useState<Property | null>(null)
  const [reportProperty, setReportProperty] = useState<Property | null>(null)
  const [expandedLayerInfo, setExpandedLayerInfo] = useState<RiskLayer | null>(null)
  const [clickedPin, setClickedPin] = useState<{ lat: number; lng: number; address?: string } | null>(null)
  const [layerToast, setLayerToast] = useState<{
    layer: RiskLayer
    action: 'on' | 'off'
    key: number
  } | null>(null)
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const toastKeyRef = useRef(0)
  const [browserLocation, setBrowserLocation] = useState<{ lat: number; lng: number } | null>(null)

  // Request browser geolocation on mount for default center
  useEffect(() => {
    if (!center && !selectedProperty && properties.length === 0 && typeof navigator !== 'undefined' && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => setBrowserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        () => { /* Permission denied or unavailable â€” use fallback */ },
        { timeout: 5000, maximumAge: 300000 },
      )
    }
  }, [center, selectedProperty, properties.length])

  // Clean up toast timer on unmount
  useEffect(() => {
    return () => {
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current)
    }
  }, [])

  const mapCenter =
    center ??
    (selectedProperty
      ? { lat: selectedProperty.lat, lng: selectedProperty.lng }
      : null) ??
    (properties[0]
      ? { lat: properties[0].lat, lng: properties[0].lng }
      : null) ??
    browserLocation ??
    { lat: 37.7749, lng: -122.4194 }

  // Use real risk profile or mock data for demo
  const effectiveRiskProfile = riskProfile ?? null
  const useMock = !riskProfile

  const getRiskScore = useCallback(
    (layer: RiskLayer): number | null => {
      if (effectiveRiskProfile) {
        // heat / drought are optional â€” fall back to mock when missing
        const factor = effectiveRiskProfile[layer]
        if (factor) return factor.score
        if (useMock) return MOCK_RISK_PROFILE[layer].score
        return null
      }
      if (useMock) return MOCK_RISK_PROFILE[layer].score
      return null
    },
    [effectiveRiskProfile, useMock],
  )

  const getRiskLevel = useCallback(
    (layer: RiskLayer): RiskLevel | null => {
      if (effectiveRiskProfile) {
        const factor = effectiveRiskProfile[layer]
        if (factor) return factor.level
        if (useMock) return MOCK_RISK_PROFILE[layer].level
        return null
      }
      if (useMock) return MOCK_RISK_PROFILE[layer].level
      return null
    },
    [effectiveRiskProfile, useMock],
  )

  const activeLayersRef = useRef(activeLayers)
  useEffect(() => {
    activeLayersRef.current = activeLayers
  }, [activeLayers])

  const toggleLayer = useCallback((layer: RiskLayer) => {
    const wasActive = activeLayersRef.current.has(layer)
    setActiveLayers((prev) => {
      const next = new Set(prev)
      if (next.has(layer)) next.delete(layer)
      else next.add(layer)
      return next
    })

    // Show activation toast (outside the updater to avoid side effects)
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current)
    toastKeyRef.current += 1
    setLayerToast({
      layer,
      action: wasActive ? 'off' : 'on',
      key: toastKeyRef.current,
    })
    toastTimerRef.current = setTimeout(() => setLayerToast(null), 2500)
  }, [])

  if (!GOOGLE_MAPS_KEY) {
    return (
      <div
        className={`flex items-center justify-center rounded-xl bg-gray-100 text-sm text-gray-500 ${className}`}
      >
        Map unavailable Ã¢Â€Â” set NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
      </div>
    )
  }

  return (
    <div className={`relative overflow-hidden rounded-xl ${className}`}>
      <MapErrorBoundary className={className}>
        <MapLoadingGuard>
            <Map
              defaultCenter={mapCenter}
              defaultZoom={zoom}
              mapId="coverguard-property-map"
              mapTypeId="satellite"
              tilt={0}
              gestureHandling="greedy"
              disableDefaultUI={false}
              style={{ width: '100%', height: '100%' }}
              onClick={(e) => {
                const lat = e.detail?.latLng?.lat
                const lng = e.detail?.latLng?.lng
                if (
                  lat == null || lng == null ||
                  !Number.isFinite(lat) || !Number.isFinite(lng) ||
                  Math.abs(lat) > 90 || Math.abs(lng) > 180
                ) return
                setClickedPin({ lat, lng })
                onMapClick?.({ lat, lng })
                // Reverse geocode to get address â€” keep prior pin even on failure
                if (typeof google !== 'undefined' && google.maps?.Geocoder) {
                  new google.maps.Geocoder().geocode(
                    { location: { lat, lng } },
                    (results, status) => {
                      const address =
                        status === 'OK' && results?.[0]
                          ? results[0].formatted_address
                          : 'Address unavailable'
                      setClickedPin((prev) =>
                        prev && prev.lat === lat && prev.lng === lng
                          ? { ...prev, address }
                          : prev,
                      )
                    },
                  )
                }
              }}
            >
              <MapController center={mapCenter} zoom={zoom} />
              {/* Ã¢Â”Â€Ã¢Â”Â€ GIS tile overlays (real geographic data) Ã¢Â”Â€Ã¢Â”Â€Ã¢Â”Â€Ã¢Â”Â€Ã¢Â”Â€Ã¢Â”Â€Ã¢Â”Â€Ã¢Â”Â€Ã¢Â”Â€Ã¢Â”Â€Ã¢Â”Â€Ã¢Â”Â€ */}
              {Array.from(activeLayers).flatMap((layer) => {
                const services = ARCGIS_TILE_SERVICES[layer]
                if (!services) return []
                return services.map((service, idx) => (
                  <ArcGISTileOverlay
                    key={`${layer}-${idx}`}
                    serviceUrl={service.url}
                    layers={service.layers}
                    opacity={0.55}
                  />
                ))
              })}

              {/* FeatureServer overlays (GeoJSON-rendered polygons) for
                  layers whose only public source is a FeatureServer
                  (Drought, Heat via NRI, Crime via CDC SVI). */}
              {Array.from(activeLayers).map((layer) => {
                const cfg = ARCGIS_FEATURE_SERVICES[layer]
                if (!cfg) return null
                return <ArcGISFeatureOverlay key={`feat-${layer}`} config={cfg} />
              })}

              {/* Default risk-score circle overlays were removed â€” every
                  active layer now draws its own polygon footprint via
                  ArcGISFeatureOverlay above. */}

              {/* Ã¢Â”Â€Ã¢Â”Â€ Property markers Ã¢Â”Â€Ã¢Â”Â€Ã¢Â”Â€Ã¢Â”Â€Ã¢Â”Â€Ã¢Â”Â€Ã¢Â”Â€Ã¢Â”Â€Ã¢Â”Â€Ã¢Â”Â€Ã¢Â”Â€Ã¢Â”Â€Ã¢Â”Â€Ã¢Â”Â€Ã¢Â”Â€Ã¢Â”Â€Ã¢Â”Â€Ã¢Â”Â€Ã¢Â”Â€Ã¢Â”Â€Ã¢Â”Â€Ã¢Â”Â€Ã¢Â”Â€Ã¢Â”Â€Ã¢Â”Â€Ã¢Â”Â€Ã¢Â”Â€Ã¢Â”Â€Ã¢Â”Â€Ã¢Â”Â€Ã¢Â”Â€Ã¢Â”Â€Ã¢Â”Â€Ã¢Â”Â€Ã¢Â”Â€Ã¢Â”Â€ */}
              {properties.map((p) => (
                <AdvancedMarker
                  key={p.id}
                  position={{ lat: p.lat, lng: p.lng }}
                  onClick={() => {
                    setPopupInfo(p)
                    onSelectProperty?.(p)
                  }}
                >
                  <div
                    className={`flex h-8 w-8 cursor-pointer items-center justify-center rounded-full border-2 shadow-md transition-transform hover:scale-110 ${
                      selectedProperty?.id === p.id
                        ? 'border-brand-600 bg-brand-600 text-white scale-110'
                        : 'border-white bg-white text-brand-700'
                    }`}
                  >
                    <MapPin className="h-4 w-4" />
                  </div>
                </AdvancedMarker>
              ))}

              {/* Selected property with no list */}
              {selectedProperty && properties.length === 0 && (
                <AdvancedMarker
                  position={{
                    lat: selectedProperty.lat,
                    lng: selectedProperty.lng,
                  }}
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-brand-600 bg-brand-600 text-white shadow-lg">
                    <MapPin className="h-5 w-5" />
                  </div>
                </AdvancedMarker>
              )}

              {/* Info window (popup) */}
              {popupInfo && (
                <InfoWindow
                  position={{ lat: popupInfo.lat, lng: popupInfo.lng }}
                  onCloseClick={() => setPopupInfo(null)}
                  pixelOffset={[0, -40]}
                >
                  <div className="p-1">
                    <p className="font-semibold text-gray-900 text-sm">
                      {popupInfo.address}
                    </p>
                    <p className="text-xs text-gray-500">
                      {popupInfo.city}, {popupInfo.state} {popupInfo.zip}
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        setReportProperty(popupInfo)
                        setPopupInfo(null)
                      }}
                      className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-brand-600 hover:underline"
                    >
                      <FileText className="h-3 w-3" />
                      View Report
                    </button>
                  </div>
                </InfoWindow>
              )}

              {/* Clicked pin â€” user clicked on map to explore a location */}
              {clickedPin && (
                <>
                  <AdvancedMarker position={{ lat: clickedPin.lat, lng: clickedPin.lng }}>
                    <div className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-teal-600 bg-teal-600 text-white shadow-lg animate-bounce">
                      <MapPin className="h-5 w-5" />
                    </div>
                  </AdvancedMarker>
                  <InfoWindow
                    position={{ lat: clickedPin.lat, lng: clickedPin.lng }}
                    onCloseClick={() => setClickedPin(null)}
                    pixelOffset={[0, -48]}
                  >
                    <div className="p-1 min-w-[180px]">
                      <p className="font-semibold text-gray-900 text-sm">
                        {clickedPin.address ?? 'Loading address\u2026'}
                      </p>
                      <p className="text-[10px] text-gray-400 mt-0.5">
                        {clickedPin.lat.toFixed(5)}, {clickedPin.lng.toFixed(5)}
                      </p>
                      <a
                        href={clickedPin.address ? `/search?q=${encodeURIComponent(clickedPin.address)}` : `/check?lat=${clickedPin.lat}&lng=${clickedPin.lng}`}
                        className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-white bg-teal-600 hover:bg-teal-700 rounded-md px-2.5 py-1.5 transition-colors"
                      >
                        <Shield className="h-3 w-3" />
                        Run Risk Report
                      </a>
                    </div>
                  </InfoWindow>
                </>
              )}
            </Map>
          </MapLoadingGuard>
      </MapErrorBoundary>

            {/* â”€â”€ Risk layer control panel â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      <div className="absolute bottom-4 left-4 z-10 max-h-[calc(100%-2rem)] overflow-y-auto">
        <div className="rounded-xl border border-gray-200 bg-white/95 backdrop-blur-sm p-3 shadow-lg w-64">
          <div className="mb-2.5 flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-gray-700">
              <Layers className="h-3.5 w-3.5" />
              Risk Layers
            </div>
            {useMock && (
              <span className="text-[9px] font-medium text-amber-500 bg-amber-50 px-1.5 py-0.5 rounded">
                Demo Data
              </span>
            )}
          </div>

          <div className="flex flex-col gap-1">
            {(Object.keys(RISK_LAYER_CONFIG) as RiskLayer[]).map((layer) => {
              const config = RISK_LAYER_CONFIG[layer]
              const Icon = config.icon
              const score = getRiskScore(layer)
              const level = getRiskLevel(layer)
              const isActive = activeLayers.has(layer)
              const isExpanded = expandedLayerInfo === layer

              return (
                <div key={layer}>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => toggleLayer(layer)}
                      className={`group flex items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs transition-all flex-1 ${
                        isActive
                          ? 'shadow-sm'
                          : 'text-gray-600 hover:bg-gray-50'
                      }`}
                      style={
                        isActive
                          ? {
                              backgroundColor: `${config.color}10`,
                              color: config.color,
                              boxShadow: `inset 0 0 0 1px ${config.color}40`,
                            }
                          : {}
                      }
                      title={config.shows}
                    >
                      <div className="shrink-0">
                        {isActive ? (
                          <Eye className="h-3.5 w-3.5" style={{ color: config.color }} />
                        ) : (
                          <EyeOff className="h-3.5 w-3.5 text-gray-400 group-hover:text-gray-500" />
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 min-w-0 flex-1">
                        <Icon className="h-3.5 w-3.5 shrink-0" style={{ color: isActive ? config.color : undefined }} />
                        <span className="font-medium truncate">{config.label}</span>
                      </div>
                      {score !== null && (
                        <span
                          className="shrink-0 rounded px-1.5 py-0.5 text-[10px] font-bold tabular-nums"
                          style={isActive ? { backgroundColor: `${config.color}20`, color: config.color } : { backgroundColor: '#f3f4f6', color: '#6b7280' }}
                        >
                          {score}
                        </span>
                      )}
                      {level && isActive && (
                        <span className={`shrink-0 rounded px-1 py-0.5 text-[9px] font-semibold ${riskLevelBadgeColor(level)}`}>
                          {level.replace('_', ' ')}
                        </span>
                      )}
                    </button>
                    <button
                      onClick={() => setExpandedLayerInfo(isExpanded ? null : layer)}
                      className={`shrink-0 h-7 w-7 rounded-md flex items-center justify-center text-xs font-semibold transition-colors ${
                        isExpanded ? 'bg-gray-200 text-gray-700' : 'text-gray-400 hover:bg-gray-100 hover:text-gray-600'
                      }`}
                      title={`${isExpanded ? 'Hide' : 'Show'} ${config.label} details`}
                      aria-label={`${isExpanded ? 'Hide' : 'Show'} ${config.label} details`}
                    >
                      i
                    </button>
                  </div>
                  {isExpanded && (
                    <div className="ml-3 mr-1 mt-1 mb-2 rounded-lg border border-gray-100 bg-gray-50/80 p-2.5 space-y-1.5">
                      <div>
                        <p className="text-[9px] font-semibold uppercase tracking-wide text-gray-400">What it shows</p>
                        <p className="text-[10px] text-gray-600 leading-snug">{config.shows}</p>
                      </div>
                      <div>
                        <p className="text-[9px] font-semibold uppercase tracking-wide text-gray-400">Source</p>
                        <p className="text-[10px] text-gray-600 leading-snug">{config.source}</p>
                      </div>
                      <div>
                        <p className="text-[9px] font-semibold uppercase tracking-wide text-gray-400">Coverage</p>
                        <p className="text-[10px] text-gray-600 leading-snug">{config.coverage}</p>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {activeLayers.size > 0 && (
            <p className="mt-2.5 border-t border-gray-100 pt-2 text-[10px] text-gray-400 leading-relaxed">
              {useMock
                ? 'Demo data â€” search a property for real risk analysis.'
                : 'Tap the i button on any layer to see what it shows and where the data comes from.'}
            </p>
          )}
        </div>
      </div>

      {/* Ã¢Â”Â€Ã¢Â”Â€ Overall risk badge (top-right) Ã¢Â”Â€Ã¢Â”Â€Ã¢Â”Â€Ã¢Â”Â€Ã¢Â”Â€Ã¢Â”Â€Ã¢Â”Â€Ã¢Â”Â€Ã¢Â”Â€Ã¢Â”Â€Ã¢Â”Â€Ã¢Â”Â€Ã¢Â”Â€Ã¢Â”Â€Ã¢Â”Â€Ã¢Â”Â€Ã¢Â”Â€Ã¢Â”Â€Ã¢Â”Â€Ã¢Â”Â€Ã¢Â”Â€Ã¢Â”Â€Ã¢Â”Â€Ã¢Â”Â€ */}
      {riskProfile && (
        <div className="absolute top-4 right-4 z-10">
          <div
            className={`rounded-lg px-3 py-1.5 text-xs font-bold shadow-md ${riskLevelBadgeColor(riskProfile.overallRiskLevel)}`}
          >
            Overall: {riskProfile.overallRiskScore}/100 Ã¢Â€Â”{' '}
            {riskProfile.overallRiskLevel.replace('_', ' ')}
          </div>
        </div>
      )}

      {/* Ã¢Â”Â€Ã¢Â”Â€ Layer activation toast Ã¢Â”Â€Ã¢Â”Â€Ã¢Â”Â€Ã¢Â”Â€Ã¢Â”Â€Ã¢Â”Â€Ã¢Â”Â€Ã¢Â”Â€Ã¢Â”Â€Ã¢Â”Â€Ã¢Â”Â€Ã¢Â”Â€Ã¢Â”Â€Ã¢Â”Â€Ã¢Â”Â€Ã¢Â”Â€Ã¢Â”Â€Ã¢Â”Â€Ã¢Â”Â€Ã¢Â”Â€Ã¢Â”Â€Ã¢Â”Â€Ã¢Â”Â€Ã¢Â”Â€Ã¢Â”Â€Ã¢Â”Â€Ã¢Â”Â€Ã¢Â”Â€Ã¢Â”Â€Ã¢Â”Â€Ã¢Â”Â€Ã¢Â”Â€Ã¢Â”Â€ */}
      {layerToast && (
        <div
          className="absolute top-4 left-1/2 -translate-x-1/2 z-20 max-w-[calc(100%-2rem)]"
          role="status"
          aria-live="polite"
        >
          <div
            key={layerToast.key}
            className="rounded-lg px-3 py-2 text-xs font-medium shadow-lg backdrop-blur-sm animate-fade-in-down"
            style={{
              backgroundColor:
                layerToast.action === 'on'
                  ? `${RISK_LAYER_CONFIG[layerToast.layer].color}18`
                  : '#f9fafb',
              color:
                layerToast.action === 'on'
                  ? RISK_LAYER_CONFIG[layerToast.layer].color
                  : '#6b7280',
              border: `1px solid ${layerToast.action === 'on' ? `${RISK_LAYER_CONFIG[layerToast.layer].color}40` : '#e5e7eb'}`,
            }}
          >
            <div className="flex items-center gap-2">
              {layerToast.action === 'on' ? (
                <Eye className="h-3.5 w-3.5 shrink-0" />
              ) : (
                <EyeOff className="h-3.5 w-3.5 shrink-0" />
              )}
              <span>
                {RISK_LAYER_CONFIG[layerToast.layer].label}{' '}
                {layerToast.action === 'on' ? ' enabled' : ' disabled'}
              </span>
            </div>
            {layerToast.action === 'on' && (
              <p className="mt-1 text-[10px] opacity-70 leading-relaxed">
                {RISK_LAYER_CONFIG[layerToast.layer].coverage}
              </p>
            )}
          </div>
        </div>
      )}

      {/* Shared Property Risk Report modal â€” opened from map info window */}
      {reportProperty && (
        <PropertyRiskReportModal
          property={reportProperty}
          open
          onClose={() => setReportProperty(null)}
        />
      )}
    </div>
  )
}

// Ã¢Â”Â€Ã¢Â”Â€Ã¢Â”Â€ ArcGIS Tile Overlay Ã¢Â”Â€Ã¢Â”Â€Ã¢Â”Â€Ã¢Â”Â€Ã¢Â”Â€Ã¢Â”Â€Ã¢Â”Â€Ã¢Â”Â€Ã¢Â”Â€Ã¢Â”Â€Ã¢Â”Â€Ã¢Â”Â€Ã¢Â”Â€Ã¢Â”Â€Ã¢Â”Â€Ã¢Â”Â€Ã¢Â”Â€Ã¢Â”Â€Ã¢Â”Â€Ã¢Â”Â€Ã¢Â”Â€Ã¢Â”Â€Ã¢Â”Â€Ã¢Â”Â€Ã¢Â”Â€Ã¢Â”Â€Ã¢Â”Â€Ã¢Â”Â€Ã¢Â”Â€Ã¢Â”Â€Ã¢Â”Â€Ã¢Â”Â€Ã¢Â”Â€Ã¢Â”Â€Ã¢Â”Â€Ã¢Â”Â€Ã¢Â”Â€Ã¢Â”Â€Ã¢Â”Â€Ã¢Â”Â€Ã¢Â”Â€Ã¢Â”Â€Ã¢Â”Â€Ã¢Â”Â€Ã¢Â”Â€Ã¢Â”Â€Ã¢Â”Â€Ã¢Â”Â€Ã¢Â”Â€Ã¢Â”Â€Ã¢Â”Â€Ã¢Â”Â€Ã¢Â”Â€
// Renders an ArcGIS MapServer as a transparent image tile layer on Google Maps.
// This brings real GIS data (flood zones, fire hazard zones, surge zones) onto
// the map directly from public government servers.
function ArcGISTileOverlay({
  serviceUrl,
  layers,
  opacity = 0.5,
}: {
  serviceUrl: string
  layers?: string
  opacity?: number
}) {
  const map = useMap()
  const overlayRef = useRef<google.maps.ImageMapType | null>(null)

  useEffect(() => {
    if (!map) return

    // Remove any existing overlay from this component instance
    if (overlayRef.current) {
      const idx = findOverlayIndex(map, overlayRef.current)
      if (idx >= 0) map.overlayMapTypes.removeAt(idx)
      overlayRef.current = null
    }

    try {
      const tileLayer = new google.maps.ImageMapType({
        getTileUrl: (coord, zoom) => {
          // Convert tile coordinates to bounding box in Web Mercator (EPSG:3857)
          const tileSize = 256
          const scale = 1 << zoom
          const worldSize = tileSize * scale

          // Tile bounds in pixel coordinates
          const x0 = coord.x * tileSize
          const y0 = coord.y * tileSize
          const x1 = x0 + tileSize
          const y1 = y0 + tileSize

          // Convert pixel to Web Mercator
          const originShift = 20037508.342789244
          const mpp = (2 * originShift) / worldSize

          const xmin = x0 * mpp - originShift
          const xmax = x1 * mpp - originShift
          // Y is flipped in Web Mercator
          const ymin = originShift - y1 * mpp
          const ymax = originShift - y0 * mpp

          return (
            `${serviceUrl}/export?` +
            `bbox=${xmin},${ymin},${xmax},${ymax}` +
            `&bboxSR=3857&imageSR=3857` +
            `&size=${tileSize},${tileSize}` +
            (layers ? `&layers=${layers}` : '') +
            `&format=png32` +
            `&transparent=true` +
            `&f=image`
          )
        },
        tileSize: new google.maps.Size(256, 256),
        opacity,
        name: serviceUrl,
      })

      map.overlayMapTypes.push(tileLayer)
      overlayRef.current = tileLayer
    } catch {
      // Google Maps API not fully available yet Ã¢Â€Â” skip
    }

    return () => {
      if (overlayRef.current && map) {
        const idx = findOverlayIndex(map, overlayRef.current)
        if (idx >= 0) map.overlayMapTypes.removeAt(idx)
        overlayRef.current = null
      }
    }
  }, [map, serviceUrl, layers, opacity])

  return null
}

function findOverlayIndex(
  map: google.maps.Map,
  overlay: google.maps.ImageMapType,
): number {
  for (let i = 0; i < map.overlayMapTypes.getLength(); i++) {
    if (map.overlayMapTypes.getAt(i) === overlay) return i
  }
  return -1
}

// â”€â”€â”€ ArcGIS Feature (GeoJSON) Overlay â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// For FeatureServer sources that do not support raster `/export` tiles
// (US Drought Monitor, FEMA NRI Census Tracts, CDC SVI), we fetch GeoJSON for
// the current viewport and render polygons via `google.maps.Data`. Fetches
// are debounced on map idle events and gated by `minZoom` so we don't pull
// 80k+ features at continental zoom.
function ArcGISFeatureOverlay({ config }: { config: FeatureServiceConfig }) {
  const map = useMap()
  const dataLayerRef = useRef<google.maps.Data | null>(null)
  const lastKeyRef = useRef<string>('')
  const abortRef = useRef<AbortController | null>(null)

  // Pick a style for a given value. Numeric percentile fields (e.g. CDC SVI
  // RPL_THEMES) are binned; string ratings (e.g. HWAV_RISKR) use the map.
  const styleForValue = useCallback(
    (raw: unknown): google.maps.Data.StyleOptions => {
      if (typeof raw === 'number') {
        // Percentile binning for 0â€“1 numeric fields.
        const v = raw
        const bin =
          v >= 0.75 ? { fill: '#991b1b', stroke: '#450a0a', fillOpacity: 0.42 } :
          v >= 0.5  ? { fill: '#ef4444', stroke: '#7f1d1d', fillOpacity: 0.34 } :
          v >= 0.25 ? { fill: '#f59e0b', stroke: '#b45309', fillOpacity: 0.26 } :
                      { fill: '#fde68a', stroke: '#a16207', fillOpacity: 0.18 }
        return {
          fillColor: bin.fill,
          fillOpacity: bin.fillOpacity,
          strokeColor: bin.stroke,
          strokeWeight: 1,
          strokeOpacity: 0.7,
          clickable: false,
        }
      }
      const key = raw == null ? null : String(raw)
      const style = (key && config.styleMap[key]) || config.fallbackStyle
      return {
        fillColor: style.fill,
        fillOpacity: style.fillOpacity ?? 0.3,
        strokeColor: style.stroke,
        strokeWeight: 1,
        strokeOpacity: 0.7,
        clickable: false,
      }
    },
    [config],
  )

  useEffect(() => {
    if (!map) return

    // Create the Data layer for this overlay.
    const data = new google.maps.Data({ map })
    data.setStyle((feature) => {
      const raw = feature.getProperty(config.styleField)
      return styleForValue(raw)
    })
    dataLayerRef.current = data

    const fetchForBounds = async () => {
      const bounds = map.getBounds()
      const zoom = map.getZoom()
      if (!bounds || typeof zoom !== 'number') return
      if (zoom < config.minZoom) {
        // Clear at low zoom so we don't leave stale features on the map.
        data.forEach((f) => data.remove(f))
        return
      }

      const ne = bounds.getNorthEast()
      const sw = bounds.getSouthWest()
      const bboxKey = `${zoom}|${sw.lng().toFixed(3)},${sw.lat().toFixed(3)},${ne.lng().toFixed(3)},${ne.lat().toFixed(3)}`
      if (bboxKey === lastKeyRef.current) return
      lastKeyRef.current = bboxKey

      // Cancel in-flight fetch if the user kept panning.
      abortRef.current?.abort()
      const ac = new AbortController()
      abortRef.current = ac

      const envelope = `${sw.lng()},${sw.lat()},${ne.lng()},${ne.lat()}`
      const params = new URLSearchParams({
        geometry: envelope,
        geometryType: 'esriGeometryEnvelope',
        inSR: '4326',
        spatialRel: 'esriSpatialRelIntersects',
        outFields: config.outFields,
        outSR: '4326',
        returnGeometry: 'true',
        resultRecordCount: String(config.resultRecordCount),
        f: 'geojson',
      })
      if (config.where) params.set('where', config.where)

      try {
        const res = await fetch(`${config.url}/query?${params.toString()}`, { signal: ac.signal })
        if (!res.ok) return
        const geo = (await res.json()) as FeatureCollection
        // Replace features atomically: clear then add.
        data.forEach((f) => data.remove(f))
        if (Array.isArray(geo.features) && geo.features.length > 0) {
          data.addGeoJson(geo)
        }
      } catch (err) {
        // AbortError is expected on rapid map pan; swallow silently.
        if ((err as { name?: string })?.name !== 'AbortError') {
          console.warn(`[${config.label}] FeatureServer fetch failed`, err)
        }
      }
    }

    // Debounce via `idle` (fires once after pan/zoom stops).
    const idleListener = map.addListener('idle', fetchForBounds)
    // Kick off an initial fetch in case the map is already idle.
    fetchForBounds()

    return () => {
      google.maps.event.removeListener(idleListener)
      abortRef.current?.abort()
      dataLayerRef.current?.setMap(null)
      dataLayerRef.current = null
    }
  }, [map, config, styleForValue])

  return null
}

// Note: the previous `RiskCircleOverlay` component was removed â€” risk
// information is now communicated entirely through the polygon overlays
// drawn by `ArcGISFeatureOverlay`. The score values are still surfaced in
// the legend / sidebar UI via `getRiskScore`.

// Ã¢Â”Â€Ã¢Â”Â€Ã¢Â”Â€ Error Boundary Ã¢Â”Â€Ã¢Â”Â€Ã¢Â”Â€Ã¢Â”Â€Ã¢Â”Â€Ã¢Â”Â€Ã¢Â”Â€Ã¢Â”Â€Ã¢Â”Â€Ã¢Â”Â€Ã¢Â”Â€Ã¢Â”Â€Ã¢Â”Â€Ã¢Â”Â€Ã¢Â”Â€Ã¢Â”Â€Ã¢Â”Â€Ã¢Â”Â€Ã¢Â”Â€Ã¢Â”Â€Ã¢Â”Â€Ã¢Â”Â€Ã¢Â”Â€Ã¢Â”Â€Ã¢Â”Â€Ã¢Â”Â€Ã¢Â”Â€Ã¢Â”Â€Ã¢Â”Â€Ã¢Â”Â€Ã¢Â”Â€Ã¢Â”Â€Ã¢Â”Â€Ã¢Â”Â€Ã¢Â”Â€Ã¢Â”Â€Ã¢Â”Â€Ã¢Â”Â€Ã¢Â”Â€Ã¢Â”Â€Ã¢Â”Â€Ã¢Â”Â€Ã¢Â”Â€Ã¢Â”Â€Ã¢Â”Â€Ã¢Â”Â€Ã¢Â”Â€Ã¢Â”Â€Ã¢Â”Â€Ã¢Â”Â€Ã¢Â”Â€Ã¢Â”Â€Ã¢Â”Â€Ã¢Â”Â€Ã¢Â”Â€Ã¢Â”Â€Ã¢Â”Â€Ã¢Â”Â€
class MapErrorBoundary extends Component<
  { children: ReactNode; className?: string },
  { hasError: boolean }
> {
  constructor(props: { children: ReactNode; className?: string }) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div
          className={`flex flex-col items-center justify-center gap-2 rounded-xl bg-gray-100 text-sm text-gray-500 ${this.props.className ?? ''}`}
        >
          <AlertTriangle className="h-5 w-5 text-amber-500" />
          <span>Map failed to load. Please refresh the page.</span>
        </div>
      )
    }
    return this.props.children
  }
}

// Ã¢Â”Â€Ã¢Â”Â€Ã¢Â”Â€ Loading Guard Ã¢Â”Â€Ã¢Â”Â€Ã¢Â”Â€Ã¢Â”Â€Ã¢Â”Â€Ã¢Â”Â€Ã¢Â”Â€Ã¢Â”Â€Ã¢Â”Â€Ã¢Â”Â€Ã¢Â”Â€Ã¢Â”Â€Ã¢Â”Â€Ã¢Â”Â€Ã¢Â”Â€Ã¢Â”Â€Ã¢Â”Â€Ã¢Â”Â€Ã¢Â”Â€Ã¢Â”Â€Ã¢Â”Â€Ã¢Â”Â€Ã¢Â”Â€Ã¢Â”Â€Ã¢Â”Â€Ã¢Â”Â€Ã¢Â”Â€Ã¢Â”Â€Ã¢Â”Â€Ã¢Â”Â€Ã¢Â”Â€Ã¢Â”Â€Ã¢Â”Â€Ã¢Â”Â€Ã¢Â”Â€Ã¢Â”Â€Ã¢Â”Â€Ã¢Â”Â€Ã¢Â”Â€Ã¢Â”Â€Ã¢Â”Â€Ã¢Â”Â€Ã¢Â”Â€Ã¢Â”Â€Ã¢Â”Â€Ã¢Â”Â€Ã¢Â”Â€Ã¢Â”Â€Ã¢Â”Â€Ã¢Â”Â€Ã¢Â”Â€Ã¢Â”Â€Ã¢Â”Â€Ã¢Â”Â€Ã¢Â”Â€Ã¢Â”Â€Ã¢Â”Â€Ã¢Â”Â€
function MapLoadingGuard({ children }: { children: ReactNode }) {
  const isLoaded = useApiIsLoaded()
  if (!isLoaded) {
    return (
      <div className="flex h-full w-full items-center justify-center rounded-xl bg-gray-100">
        <div className="flex flex-col items-center gap-2 text-sm text-gray-400">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-gray-300 border-t-brand-600" />
          Loading mapÃ¢Â€Â¦
        </div>
      </div>
    )
  }
  return <>{children}</>
}
