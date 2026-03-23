'use client'

import { useState, useCallback } from 'react'
import Map, { Marker, NavigationControl, Popup, Source, Layer } from 'react-map-gl'
import type { Property, PropertyRiskProfile } from '@coverguard/shared'
import { MapPin, Layers } from 'lucide-react'
import 'mapbox-gl/dist/mapbox-gl.css'

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? ''

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

  const getCircleRadius = (score: number): number => 500 + score * 20 // meters

  // Build GeoJSON circle for active risk layer
  const activeRiskScore = activeLayer ? getRiskScore(activeLayer) : null

  const riskLayerGeoJSON = (activeLayer && (selectedProperty ?? properties[0]) && activeRiskScore !== null)
    ? buildCircleGeoJSON(
        (selectedProperty ?? properties[0])!.lng,
        (selectedProperty ?? properties[0])!.lat,
        getCircleRadius(activeRiskScore),
        RISK_LAYER_COLORS[activeLayer],
      )
    : null

  if (!MAPBOX_TOKEN) {
    return (
      <div className={`flex items-center justify-center rounded-xl bg-gray-100 text-sm text-gray-500 ${className}`}>
        Map unavailable — set NEXT_PUBLIC_MAPBOX_TOKEN
      </div>
    )
  }

  return (
    <div className={`relative overflow-hidden rounded-xl ${className}`}>
      <Map
        initialViewState={{
          longitude: mapCenter.lng,
          latitude: mapCenter.lat,
          zoom,
        }}
        style={{ width: '100%', height: '100%' }}
        mapStyle="mapbox://styles/mapbox/light-v11"
        mapboxAccessToken={MAPBOX_TOKEN}
      >
        <NavigationControl position="top-right" />

        {/* Risk layer overlay */}
        {riskLayerGeoJSON && activeLayer && (
          <Source id="risk-layer" type="geojson" data={riskLayerGeoJSON}>
            <Layer
              id="risk-fill"
              type="fill"
              paint={{
                'fill-color': RISK_LAYER_COLORS[activeLayer],
                'fill-opacity': 0.18,
              }}
            />
            <Layer
              id="risk-outline"
              type="line"
              paint={{
                'line-color': RISK_LAYER_COLORS[activeLayer],
                'line-width': 2,
                'line-opacity': 0.6,
              }}
            />
          </Source>
        )}

        {/* Property markers */}
        {properties.map((p) => (
          <Marker
            key={p.id}
            longitude={p.lng}
            latitude={p.lat}
            anchor="bottom"
            onClick={(e) => {
              e.originalEvent.stopPropagation()
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
          </Marker>
        ))}

        {/* Selected property with no list */}
        {selectedProperty && properties.length === 0 && (
          <Marker longitude={selectedProperty.lng} latitude={selectedProperty.lat} anchor="bottom">
            <div className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-brand-600 bg-brand-600 text-white shadow-lg">
              <MapPin className="h-5 w-5" />
            </div>
          </Marker>
        )}

        {/* Popup */}
        {popupInfo && (
          <Popup
            longitude={popupInfo.lng}
            latitude={popupInfo.lat}
            anchor="top"
            onClose={() => setPopupInfo(null)}
            closeButton
            maxWidth="260px"
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
          </Popup>
        )}
      </Map>

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

// Build a GeoJSON polygon approximating a circle
function buildCircleGeoJSON(
  lng: number,
  lat: number,
  radiusMeters: number,
  color: string,
): GeoJSON.FeatureCollection {
  const points = 64
  const km = radiusMeters / 1000
  const coords: [number, number][] = []
  for (let i = 0; i < points; i++) {
    const angle = (i / points) * 2 * Math.PI
    const dLat = (km / 111) * Math.cos(angle)
    const dLng = (km / (111 * Math.cos((lat * Math.PI) / 180))) * Math.sin(angle)
    coords.push([lng + dLng, lat + dLat])
  }
  coords.push(coords[0]!) // close ring
  return {
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        properties: { color },
        geometry: { type: 'Polygon', coordinates: [coords] },
      },
    ],
  }
}
