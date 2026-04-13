'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { useMapsLibrary } from '@vis.gl/react-google-maps'
import type { PlacePrediction } from '@coverguard/shared'

export type { PlacePrediction }

/**
 * Hook that wraps the Google Maps Places Autocomplete Data API for typeahead.
 * Must be used inside an APIProvider from @vis.gl/react-google-maps.
 */
export function useGooglePlacesAutocomplete(debounceMs = 250) {
  const placesLib = useMapsLibrary('places')

  const [predictions, setPredictions] = useState<PlacePrediction[]>([])
  const [loading, setLoading] = useState(false)

  const sessionTokenRef = useRef<google.maps.places.AutocompleteSessionToken | null>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(null)

  useEffect(() => {
    if (!placesLib) return
    sessionTokenRef.current = new placesLib.AutocompleteSessionToken()
  }, [placesLib])

  const fetchPredictions = useCallback(
    (input: string) => {
      if (debounceRef.current) clearTimeout(debounceRef.current)

      const trimmed = input.trim()
      if (trimmed.length < 3 || !placesLib) {
        setPredictions([])
        return
      }

      debounceRef.current = setTimeout(async () => {
        setLoading(true)
        try {
          const { suggestions } =
            await placesLib.AutocompleteSuggestion.fetchAutocompleteSuggestions({
              input: trimmed,
              includedRegionCodes: ['us'],
              includedPrimaryTypes: ['address'],
              sessionToken: sessionTokenRef.current ?? undefined,
            })

          if (suggestions.length > 0) {
            setPredictions(
              suggestions.slice(0, 6).map((s) => {
                const p = s.placePrediction!
                return {
                  placeId: p.placeId,
                  description: p.text.text,
                  mainText: p.mainText?.text ?? p.text.text,
                  secondaryText: p.secondaryText?.text ?? '',
                }
              }),
            )
          } else {
            setPredictions([])
          }
        } catch {
          setPredictions([])
        } finally {
          setLoading(false)
        }
      }, debounceMs)
    },
    [debounceMs, placesLib],
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
    fetchPredictions,
    clearPredictions,
    resetSessionToken,
  }
}
