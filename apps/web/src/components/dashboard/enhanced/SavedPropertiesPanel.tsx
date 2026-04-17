'use client';

import { useEffect, useState } from 'react';
import { AlertTriangle, Building2, FileText, MapPin } from 'lucide-react';
import type { Property as SharedProperty } from '@coverguard/shared';
import { formatAddress, formatCurrency } from '@coverguard/shared';
import { getSavedProperties } from '@/lib/api';
import { PropertyRiskReportModal } from '@/components/property/PropertyReportModal';
import { Badge } from './utils';

interface SavedPropertyRow {
  id: string;
  propertyId: string;
  notes?: string;
  tags?: string[];
  savedAt?: string;
  property: SharedProperty;
}

export function SavedPropertiesPanel() {
  const [saved, setSaved] = useState<SavedPropertyRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selectedProperty, setSelectedProperty] = useState<SharedProperty | null>(null);

  useEffect(() => {
    getSavedProperties()
      .then((data) => setSaved(data as SavedPropertyRow[]))
      .catch((err) => setLoadError(err instanceof Error ? err.message : 'Failed to load saved properties'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="space-y-2">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-16 rounded-lg bg-gray-100 animate-pulse" />
        ))}
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="text-center py-6">
        <AlertTriangle className="mx-auto mb-2 h-7 w-7 text-red-400" />
        <p className="text-xs font-medium text-red-600">{loadError}</p>
        <button
          onClick={() => {
            setLoadError(null);
            setLoading(true);
            getSavedProperties()
              .then((data) => setSaved(data as SavedPropertyRow[]))
              .catch((err) => setLoadError(err instanceof Error ? err.message : 'Failed'))
              .finally(() => setLoading(false));
          }}
          className="mt-2 px-3 py-1.5 bg-gray-900 text-white rounded text-xs font-medium hover:bg-gray-800 transition-colors"
        >
          Retry
        </button>
      </div>
    );
  }

  if (saved.length === 0) {
    return (
      <div className="text-center py-6 text-gray-400">
        <Building2 className="mx-auto mb-2 h-8 w-8 opacity-30" />
        <p className="text-xs font-medium">No saved properties yet</p>
        <p className="text-xs mt-1">Search for a property and save it to see reports here.</p>
      </div>
    );
  }

  return (
    <div>
      <div className="grid grid-cols-1 gap-2">
        {saved.map((row) => {
          const p = row.property;
          return (
            <div
              key={row.id}
              className="border border-gray-200 bg-white rounded-lg p-3 hover:shadow-sm transition-all"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <Building2 size={16} className="text-gray-400 flex-shrink-0" />
                  <div className="min-w-0">
                    <p className="font-semibold text-gray-900 text-xs leading-tight truncate">{p.address}</p>
                    <p className="text-xs text-gray-500 flex items-center gap-0.5 truncate">
                      <MapPin size={9} />
                      {formatAddress(p)}
                    </p>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      {p.propertyType && <Badge color="purple">{p.propertyType.replace(/_/g, ' ')}</Badge>}
                      {(p.marketValue || p.estimatedValue) && (
                        <span className="text-xs text-gray-400">{formatCurrency((p.marketValue ?? p.estimatedValue)!)}</span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 flex-shrink-0 ml-2">
                  <button
                    onClick={() => setSelectedProperty(p)}
                    className="flex items-center gap-1 px-2 py-1 bg-white border border-gray-200 rounded text-xs font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                  >
                    <FileText size={11} /> View Report
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {selectedProperty && (
        <PropertyRiskReportModal
          property={selectedProperty}
          open
          onClose={() => setSelectedProperty(null)}
        />
      )}
    </div>
  );
}
