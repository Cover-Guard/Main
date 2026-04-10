'use client'

import { useState, useCallback, useEffect, useRef, Component, type ReactNode } from 'react'
import {
  Map,
  AdvancedMarker,
  InfoWindow,
  useMap,
  useApiIsLoaded,
} from '@vis.gl/react-google-maps'
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
} from 'lucide-react'

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

type RiskLayer = 'flood' | 'fire' | 'wind' | 'earthquake' | 'crime'

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
    coverage: 'Not all areas are FEMA-mapped — unmapped parcels show no overlay.',
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
    label: 'Hurricane',
    color: '#a855f7',
    icon: Wind,
    shows: 'Category-3 hurricane storm surge inundation zones.',
    source: 'NOAA SLOSH model',
    coverage: 'Coastal regions only — inland areas show no overlay.',
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
    label: 'Crime',
    color: '#6b7280',
    icon: ShieldAlert,
    shows: 'Reported violent and property crime rates by jurisdiction.',
    source: 'FBI Crime Data Explorer',
    coverage: 'Aggregated by county — circle shows local intensity.',
  },
}
// âââ ArcGIS Tile Service URLs ââââââââââââââââââââââââââââââââââââââââââââââââââ
// These public ArcGIS MapServer services render real GIS data as map tiles.
// Primary services are augmented with Esri Living Atlas layers for richer coverage.
const ARCGIS_TILE_SERVICES: Partial<
  Record<RiskLayer, Array<{ url: string; layers: string; label: string }>>
> = {
  flood: [
    {
      url: 'https://hazards.fema.gov/gis/nfhl/rest/services/FIRMette/NFHLREST_FIRMette/MapServer',
      layers: 'show:20', // Layer 20 = S_Fld_Haz_Ar (Flood Hazard Zones)
      label: 'FEMA NFHL',
    },
    // NOTE: FeatureServer does NOT support the `export` (tile) operation —
    // only MapServer does. The previous Esri Living Atlas FeatureServer URL
    // returned 400 Bad Request on every tile. FEMA NFHL above provides the
    // authoritative coverage, so we drop the Esri fallback entirely rather
    // than pointing at a non-existent MapServer. If a secondary source is
    // needed, use the NFHL S_Fld_Haz_Ar layer or a hosted tile service.
  ],
  fire: [
    {
      url: 'https://apps.fs.usda.gov/arcx/rest/services/EDW/EDW_WUI_2020_01/MapServer',
      layers: 'show:0', // Layer 0 = WUI 2020
      label: 'USFS WUI',
    },
    {
      url: 'https://apps.fs.usda.gov/arcx/rest/services/RDW_Wildfire/RMRS_WRC_WildfireRisk/MapServer',
      layers: 'show:0', // USDA Wildfire Risk to Communities (Esri-hosted)
      label: 'USDA Wildfire Risk',
    },
  ],
  wind: [
    {
      url: 'https://coast.noaa.gov/arcgis/rest/services/FloodExposureMapper/CFEM_NHC_Surge_Cat3/MapServer',
      layers: 'show:0', // SLOSH MOM Cat-3 hurricane storm surge
      label: 'NOAA SLOSH Cat-3',
    },
  ],
  earthquake: [
    {
      url: 'https://earthquake.usgs.gov/arcgis/rest/services/haz/US5hz250_2014/MapServer',
      layers: 'show:0', // 2014 NSHM - 2% in 50yr, 0.2s spectral acceleration
      label: 'USGS Seismic Hazard',
    },
  ],
  crime: [
    {
      url: 'https://services.arcgis.com/jIL9msH9OI208GCb/arcgis/rest/services/FBI_Crime_Data_Explorer/MapServer',
      layers: 'show:0', // FBI UCR crime data by county
      label: 'FBI Crime Data',
    },
  ],
}
// ─── Mock risk data for demo when no real risk profile is provided ──────────
const MOCK_RISK_PROFILE: Record<RiskLayer, { score: number; level: RiskLevel }> = {
  flood:      { score: 62, level: 'MODERATE' },
  fire:       { score: 78, level: 'HIGH' },
  wind:       { score: 45, level: 'MODERATE' },
  earthquake: { score: 28, level: 'LOW' },
  crime:      { score: 55, level: 'MODERATE' },
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
        () => { /* Permission denied or unavailable — use fallback */ },
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
      if (effectiveRiskProfile) return effectiveRiskProfile[layer].score
      if (useMock) return MOCK_RISK_PROFILE[layer].score
      return null
    },
    [effectiveRiskProfile, useMock],
  )

  const getRiskLevel = useCallback(
    (layer: RiskLayer): RiskLevel | null => {
      if (effectiveRiskProfile) return effectiveRiskProfile[layer].level
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

  const riskCenter = selectedProperty ?? properties[0] ?? null

  if (!GOOGLE_MAPS_KEY) {
    return (
      <div
        className={`flex items-center justify-center rounded-xl bg-gray-100 text-sm text-gray-500 ${className}`}
      >
        Map unavailable â set NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
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
                if (lat != null && lng != null) {
                  setClickedPin({ lat, lng })
                  onMapClick?.({ lat, lng })
                  // Reverse geocode to get address
                  if (typeof google !== 'undefined' && google.maps?.Geocoder) {
                    new google.maps.Geocoder().geocode(
                      { location: { lat, lng } },
                      (results, status) => {
                        if (status === 'OK' && results?.[0]) {
                          setClickedPin({ lat, lng, address: results[0].formatted_address })
                        }
                      },
                    )
                  }
                }
              }}
            >
              <MapController center={mapCenter} zoom={zoom} />
              {/* ââ GIS tile overlays (real geographic data) ââââââââââââ */}
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

              {/* ââ Risk score circle overlays ââââââââââââââââââââââââââ */}
              {riskCenter &&
                Array.from(activeLayers).map((layer) => {
                  const score = getRiskScore(layer)
                  if (score === null || score === 0) return null
                  return (
                    <RiskCircleOverlay
                      key={`circle-${layer}`}
                      center={{ lat: riskCenter.lat, lng: riskCenter.lng }}
                      radius={500 + score * 30}
                      color={RISK_LAYER_CONFIG[layer].color}
                      score={score}
                    />
                  )
                })}

              {/* ââ Property markers ââââââââââââââââââââââââââââââââââââ */}
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
                    <a
                      href={`/properties/${popupInfo.id}`}
                      className="mt-2 inline-block text-xs font-medium text-brand-600 hover:underline"
                    >
                      View full report â
                    </a>
                  </div>
                </InfoWindow>
              )}

              {/* Clicked pin — user clicked on map to explore a location */}
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

            {/* ── Risk layer control panel ─────────────────────────── */}
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
                ? 'Demo data — search a property for real risk analysis.'
                : 'Tap the i button on any layer to see what it shows and where the data comes from.'}
            </p>
          )}
        </div>
      </div>

      {/* ââ Overall risk badge (top-right) âââââââââââââââââââââââââ */}
      {riskProfile && (
        <div className="absolute top-4 right-4 z-10">
          <div
            className={`rounded-lg px-3 py-1.5 text-xs font-bold shadow-md ${riskLevelBadgeColor(riskProfile.overallRiskLevel)}`}
          >
            Overall: {riskProfile.overallRiskScore}/100 â{' '}
            {riskProfile.overallRiskLevel.replace('_', ' ')}
          </div>
        </div>
      )}

      {/* ââ Layer activation toast âââââââââââââââââââââââââââââââââ */}
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
    </div>
  )
}

// âââ ArcGIS Tile Overlay âââââââââââââââââââââââââââââââââââââââââââââââââââââ
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
      // Google Maps API not fully available yet â skip
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

// âââ Risk Circle Overlay âââââââââââââââââââââââââââââââââââââââââââââââââââââ
// Draws a colored circle overlay scaled by the risk score.
function RiskCircleOverlay({
  center,
  radius,
  color,
  score,
}: {
  center: { lat: number; lng: number }
  radius: number
  color: string
  score: number
}) {
  const map = useMap()
  const circleRef = useRef<google.maps.Circle | null>(null)

  // Opacity scales with score: low risk = visible, high risk = bold
  const fillOpacity = 0.15 + (score / 100) * 0.25
  const strokeOpacity = 0.4 + (score / 100) * 0.45

  useEffect(() => {
    if (!map) return

    if (circleRef.current) {
      circleRef.current.setMap(null)
    }

    try {
      circleRef.current = new google.maps.Circle({
        map,
        center,
        radius,
        fillColor: color,
        fillOpacity,
        strokeColor: color,
        strokeWeight: 2,
        strokeOpacity,
        clickable: false,
      })
    } catch {
      circleRef.current = null
    }

    return () => {
      circleRef.current?.setMap(null)
      circleRef.current = null
    }
  }, [map, center, radius, color, fillOpacity, strokeOpacity])

  return null
}

// âââ Error Boundary ââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ
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

// âââ Loading Guard âââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ
function MapLoadingGuard({ children }: { children: ReactNode }) {
  const isLoaded = useApiIsLoaded()
  if (!isLoaded) {
    return (
      <div className="flex h-full w-full items-center justify-center rounded-xl bg-gray-100">
        <div className="flex flex-col items-center gap-2 text-sm text-gray-400">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-gray-300 border-t-brand-600" />
          Loading mapâ¦
        </div>
      </div>
    )
  }
  return <>{children}</>
}

