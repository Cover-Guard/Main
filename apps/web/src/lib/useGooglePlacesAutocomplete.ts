'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { useMapsLibrary } from '@vis.gl/react-google-maps'
import type { PlacePrediction } from '@coverguard/shared'

export type { PlacePrediction }

/**
 * Hook that wraps the Google Maps Places AutocompleteService for typeahead.
 * Must be used inside an APIProvider from @vis.gl/react-google-maps.
 */
export function useGooglePlacesAutocomplete(debounceMs = 250) {
  const placesLib = useMapsLibrary('places')

  const [predictions, setPredictions] = useState<PlacePrediction[]>([])
  const [loading, setLoading] = useState(false)
  const [isReady, setIsReady] = useState(false)

  const serviceRef = useRef<google.maps.places.AutocompleteService | null>(null)
  const sessionTokenRef = useRef<google.maps.places.AutocompleteSessionToken | null>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(null)

  useEffect(() => {
    if (!placesLib) return
    serviceRef.current = new placesLib.AutocompleteService()
    sessionTokenRef.current = new placesLib.AutocompleteSessionToken()
    setIsReady(true)
  }, [placesLib])

  const fetchPredictions = useCallback(
    (input: string) => {
      if (debounceRef.current) clearTimeout(debounceRef.current)

      const trimmed = input.trim()
      if (trimmed.length < 3 || !serviceRef.current) {
        setPredictions([])
        return
      }

      debounceRef.current = setTimeout(() => {
        setLoading(true)
        serviceRef.current!.getPlacePredictions(
          {
            input: trimmed,
            componentRestrictions: { country: 'us' },
            types: ['address'],
            sessionToken: sessionTokenRef.current ?? undefined,
          },
          (results, status) => {
            setLoading(false)
            if (
              status === google.maps.places.PlacesServiceStatus.OK &&
              results &&
              results.length > 0
            ) {
              setPredictions(
                results.slice(0, 6).map((p) => ({
                  placeId: p.place_id,
                  description: p.description,
                  mainText: p.structured_formatting.main_text,
                  secondaryText: p.structured_formatting.secondary_text,
                })),
              )
            } else {
              setPredictions([])
            }
          },
        )
      }, debounceMs)
    },
    [debounceMs],
  )

  const clearPredictions = useCallback(() => {
    setPredictions([])
  }, [])

  const resetSessionToken = useCallback(() => {
    if (placesLib) {
      sessionTokenRef.current = new placesLib.AutocompleteSessionToken()
    }
  }, [placesLib])

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [])

  return {
    predictions,
    loading,
    isReady,
    fetchPredictions,
    clearPredictions,
    resetSessionToken,
  }
}
