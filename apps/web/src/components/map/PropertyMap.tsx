'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import { APIProvider, Map, AdvancedMarker, InfoWindow, useMap } from '@vis.gl/react-google-maps'
import type { Property, PropertyRiskProfile } from '@coverguard/shared'
import { MapPin, Layers } from 'lucide-react'

const GOOGLE_MAPS_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? ''

interface PropertyMapProps {
  properties?: Property[]
  selectedProperty?: Property | null
  riskProfile?: PropertyRiskProfile | null
  onSelectProperty?: (property: Property) => void
  center?: { lat: number; lng: number }
  zoom?: number
  className?: string
}

type RiskLayer = 'flood' | 'fire' | 'wind' | 'earthquake' | 'crime'

const RISK_LAYER_COLORS: Record<RiskLayer, string> = {
  flood:      '#3b82f6',
  fire:       '#ef4444',
  wind:       '#a855f7',
  earthquake: '#f97316',
  crime:      '#6b7280',
}

const RISK_LAYER_LABELS: Record<RiskLayer, string> = {
  flood:      'Flood',
  fire:       'Fire',
  wind:       'Wind',
  earthquake: 'Earthquake',
  crime:      'Crime',
}

export function PropertyMap({
  properties = [],
  selectedProperty,
  riskProfile,
  onSelectProperty,
  center,
  zoom = 13,
  className = '',
}: PropertyMapProps) {
  const [activeLayer, setActiveLayer] = useState<RiskLayer | null>(null)
  const [popupInfo, setPopupInfo] = useState<Property | null>(null)

  const mapCenter = center ??
    (selectedProperty ? { lat: selectedProperty.lat, lng: selectedProperty.lng } : null) ??
    (properties[0] ? { lat: properties[0].lat, lng: properties[0].lng } : { lat: 37.7749, lng: -122.4194 })

  const getRiskScore = useCallback((layer: RiskLayer): number | null => {
    if (!riskProfile) return null
    return {
      flood:      riskProfile.flood.score,
      fire:       riskProfile.fire.score,
      wind:       riskProfile.wind.score,
      earthquake: riskProfile.earthquake.score,
      crime:      riskProfile.crime.score,
    }[layer]
  }, [riskProfile])

  const activeRiskScore = activeLayer ? getRiskScore(activeLayer) : null
  const riskCenter = selectedProperty ?? properties[0] ?? null
  const circleRadius = activeRiskScore !== null ? 500 + activeRiskScore * 20 : 0

  if (!GOOGLE_MAPS_KEY) {
    return (
      <div className={`flex items-center justify-center rounded-xl bg-gray-100 text-sm text-gray-500 ${className}`}>
        Map unavailable — set NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
      </div>
    )
  }

  return (
    <div className={`relative overflow-hidden rounded-xl ${className}`}>
      <APIProvider apiKey={GOOGLE_MAPS_KEY}>
        <Map
          defaultCenter={mapCenter}
          defaultZoom={zoom}
          mapId="coverguard-property-map"
          gestureHandling="greedy"
          disableDefaultUI={false}
          style={{ width: '100%', height: '100%' }}
        >
          {/* Risk layer circle overlay */}
          {activeLayer && riskCenter && activeRiskScore !== null && (
            <RiskCircleOverlay
              center={{ lat: riskCenter.lat, lng: riskCenter.lng }}
              radius={circleRadius}
              color={RISK_LAYER_COLORS[activeLayer]}
            />
          )}

          {/* Property markers */}
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
            <AdvancedMarker position={{ lat: selectedProperty.lat, lng: selectedProperty.lng }}>
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
                <p className="font-semibold text-gray-900 text-sm">{popupInfo.address}</p>
                <p className="text-xs text-gray-500">{popupInfo.city}, {popupInfo.state} {popupInfo.zip}</p>
                <a
                  href={`/properties/${popupInfo.id}`}
                  className="mt-2 inline-block text-xs font-medium text-brand-600 hover:underline"
                >
                  View full report →
                </a>
              </div>
            </InfoWindow>
          )}
        </Map>
      </APIProvider>

      {/* Risk layer controls */}
      <div className="absolute bottom-4 left-4 z-10">
        <div className="rounded-xl border border-gray-200 bg-white p-3 shadow-lg">
          <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-gray-700">
            <Layers className="h-3.5 w-3.5" />
            Risk Layers
          </div>
          <div className="flex flex-col gap-1">
            {(Object.keys(RISK_LAYER_LABELS) as RiskLayer[]).map((layer) => {
              const score = getRiskScore(layer)
              return (
                <button
                  key={layer}
                  onClick={() => setActiveLayer(activeLayer === layer ? null : layer)}
                  className={`flex items-center gap-2 rounded-lg px-2 py-1.5 text-xs font-medium transition-colors ${
                    activeLayer === layer ? 'text-white shadow-sm' : 'text-gray-700 hover:bg-gray-100'
                  }`}
                  style={activeLayer === layer ? { backgroundColor: RISK_LAYER_COLORS[layer] } : {}}
                >
                  <span
                    className="h-2 w-2 rounded-full"
                    style={{ backgroundColor: RISK_LAYER_COLORS[layer] }}
                  />
                  {RISK_LAYER_LABELS[layer]}
                  {score !== null && (
                    <span className={`ml-auto rounded px-1 py-0.5 text-xs ${activeLayer === layer ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-500'}`}>
                      {score}
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}

/**
 * Draws a circle overlay on the Google Map using the Maps JS API directly.
 */
function RiskCircleOverlay({
  center,
  radius,
  color,
}: {
  center: { lat: number; lng: number }
  radius: number
  color: string
}) {
  const map = useMap()
  const circleRef = useRef<google.maps.Circle | null>(null)

  useEffect(() => {
    if (!map) return

    if (circleRef.current) {
      circleRef.current.setMap(null)
    }

    circleRef.current = new google.maps.Circle({
      map,
      center,
      radius,
      fillColor: color,
      fillOpacity: 0.18,
      strokeColor: color,
      strokeWeight: 2,
      strokeOpacity: 0.6,
      clickable: false,
    })

    return () => {
      circleRef.current?.setMap(null)
      circleRef.current = null
    }
  }, [map, center.lat, center.lng, radius, color])

  return null
}
