'use client'

import { useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { Search } from 'lucide-react'
import { cn } from '@/lib/utils'

interface SearchBarProps {
  defaultValue?: string
  autoFocus?: boolean
  className?: string
}

export function SearchBar({ defaultValue = '', autoFocus, className }: SearchBarProps) {
  const router = useRouter()
  const [query, setQuery] = useState(defaultValue)

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const q = query.trim()
    if (!q) return
    router.push(`/search?q=${encodeURIComponent(q)}`)
  }

  return (
    <form onSubmit={handleSubmit} className={cn('flex gap-2', className)}>
      <div className="relative flex-1">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="123 Main St, Austin, TX 78701"
          autoFocus={autoFocus}
          className="input pl-10 py-3 text-base text-gray-900"
        />
      </div>
      <button type="submit" className="btn-primary px-6 py-3 text-base">
        Search
      </button>
    </form>
  )
}
