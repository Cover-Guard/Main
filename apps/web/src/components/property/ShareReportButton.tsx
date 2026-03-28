'use client'

import { useState } from 'react'
import { Share2 } from 'lucide-react'
import { ShareReportModal } from './ShareReportModal'

interface Props {
  propertyId: string
  propertyAddress: string
}

export function ShareReportButton({ propertyId, propertyAddress }: Props) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="hidden sm:flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
      >
        <Share2 className="h-4 w-4" />
        Share
      </button>
      {open && (
        <ShareReportModal
          propertyId={propertyId}
          propertyAddress={propertyAddress}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  )
}
