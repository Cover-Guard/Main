import type { InsuranceCostEstimate as IInsuranceCostEstimate } from '@coverguard/shared'
import { formatCurrency, formatCoverageType } from '@coverguard/shared'
import { AlertTriangle, Info } from 'lucide-react'

interface InsuranceCostEstimateProps {
  estimate: IInsuranceCostEstimate
}

export function InsuranceCostEstimate({ estimate }: InsuranceCostEstimateProps) {
  return (
    <div className="card overflow-hidden">
      {/* Header */}
      <div className="bg-brand-700 px-5 py-4 text-white">
        <p className="text-sm font-medium text-brand-200">Estimated Annual Insurance</p>
        <p className="text-3xl font-bold">{formatCurrency(estimate.estimatedAnnualTotal)}</p>
        <p className="mt-0.5 text-sm text-brand-200">
          ≈ {formatCurrency(estimate.estimatedMonthlyTotal)}/mo
        </p>
        <span className="mt-2 inline-block rounded-full bg-brand-600 px-2 py-0.5 text-xs text-brand-100">
          {estimate.confidenceLevel} confidence
        </span>
      </div>

      {/* Coverage breakdown */}
      <div className="divide-y divide-gray-100 p-5">
        <h3 className="mb-3 text-sm font-semibold text-gray-700">Coverage Breakdown</h3>
        {estimate.coverages.map((c) => (
          <div key={c.type} className="py-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-900">
                  {formatCoverageType(c.type)}
                  {c.required && (
                    <span className="ml-2 inline-block rounded bg-red-100 px-1.5 py-0.5 text-xs text-red-700">
                      Required
                    </span>
                  )}
                </p>
              </div>
              <p className="text-sm font-semibold text-gray-900">
                {formatCurrency(c.averageAnnualPremium)}/yr
              </p>
            </div>
            <p className="mt-0.5 text-xs text-gray-400">
              Range: {formatCurrency(c.lowEstimate)} – {formatCurrency(c.highEstimate)}
            </p>
            {c.notes.map((note) => (
              <p key={note} className="mt-1 flex items-start gap-1 text-xs text-gray-500">
                <Info className="mt-0.5 h-3 w-3 shrink-0" />
                {note}
              </p>
            ))}
          </div>
        ))}
      </div>

      {/* Recommendations */}
      {estimate.recommendations.length > 0 && (
        <div className="border-t border-gray-100 bg-blue-50 p-5">
          <h3 className="mb-2 text-sm font-semibold text-blue-800">Recommendations</h3>
          <ul className="space-y-1">
            {estimate.recommendations.map((r) => (
              <li key={r} className="flex items-start gap-2 text-xs text-blue-700">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-blue-400" />
                {r}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Disclaimer */}
      {estimate.disclaimers.length > 0 && (
        <div className="border-t border-gray-100 p-5">
          <div className="flex gap-2 text-xs text-gray-400">
            <AlertTriangle className="h-4 w-4 shrink-0 text-yellow-500" />
            <p>{estimate.disclaimers[0]}</p>
          </div>
        </div>
      )}
    </div>
  )
}

