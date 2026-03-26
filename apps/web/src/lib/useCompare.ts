'use client'

import { useState, useCallback } from 'react'

const MAX_COMPARE = 3
const STORAGE_KEY = 'cg_compare_ids'

function canUseStorage() {
  return typeof window !== 'undefined'
}

function safeGet(key: string): string | null {
  if (!canUseStorage()) return null
  try {
    return window.localStorage.getItem(key)
  } catch {
    return null
  }
}

function safeSet(key: string, value: string): void {
  if (!canUseStorage()) return
  try {
    window.localStorage.setItem(key, value)
  } catch {
    // ignore write errors (privacy mode, quota, etc.)
  }
}

export function useCompare() {
  const [ids, setIds] = useState<string[]>(() => {
    const stored = safeGet(STORAGE_KEY)
    if (!stored) return []
    try {
      return JSON.parse(stored) as string[]
    } catch {
      return []
    }
  })

  const persist = useCallback((next: string[]) => {
    setIds(next)
    safeSet(STORAGE_KEY, JSON.stringify(next))
  }, [])

  const toggle = useCallback((id: string) => {
    setIds((prev) => {
      const next = prev.includes(id)
        ? prev.filter((x) => x !== id)
        : prev.length < MAX_COMPARE
        ? [...prev, id]
        : prev
      safeSet(STORAGE_KEY, JSON.stringify(next))
      return next
    })
  }, [])

  const clear = useCallback(() => persist([]), [persist])

  return {
    ids,
    toggle,
    clear,
    canAdd: ids.length < MAX_COMPARE,
    compareUrl: ids.length >= 2 ? `/compare?ids=${ids.join(',')}` : null,
  }
}
