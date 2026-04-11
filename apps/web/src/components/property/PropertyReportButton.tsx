'use client'

import { useState } from 'react'
import { FileText } from 'lucide-react'
import type { Property } from '@coverguard/shared'
import { PropertyRiskReportModal } from './PropertyReportModal'

interface PropertyReportButtonProps {
  property: Property
}

export function PropertyReportButton({ property }: PropertyReportButtonProps) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="hidden sm:flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
      >
        <FileText className="h-4 w-4" />
        View Report
      </button>

      <PropertyRiskReportModal
        property={property}
        open={open}
        onClose={() => setOpen(false)}
      />
    </>
  )
}
