'use client'

import { useState } from 'react'
import Link from 'next/link'
import {
  ArrowLeft,
  Wrench,
  DollarSign,
  ClipboardList,
  Mail,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
} from 'lucide-react'

const TOOLS = [
  {
    id: 'cost-estimator',
    icon: DollarSign,
    iconBg: 'bg-blue-50',
    iconColor: 'text-blue-600',
    title: 'Insurance Cost Estimator',
    description: 'Estimate annual premium breakdown before your client gets a quote',
    content: (
      <div className="space-y-3 pt-4">
        <p className="text-sm text-gray-600">
          Enter property details to get an estimated annual insurance cost breakdown
          by peril type.
        </p>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1">
              Property Address
            </label>
            <input
              className="w-full text-sm border border-gray-200 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400"
              placeholder="Enter address…"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1">
              Home Value ($)
            </label>
            <input
              type="number"
              className="w-full text-sm border border-gray-200 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400"
              placeholder="e.g. 450000"
            />
          </div>
        </div>
        <button className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors">
          Estimate Cost
        </button>
      </div>
    ),
  },
  {
    id: 'checklist',
    icon: ClipboardList,
    iconBg: 'bg-blue-50',
    iconColor: 'text-blue-600',
    title: 'Pre-Offer Checklist Generator',
    description: 'AI-generated checklist of insurance items to verify before making an offer',
    content: (
      <div className="space-y-3 pt-4">
        <p className="text-sm text-gray-600">
          Generate a property-specific pre-offer insurance checklist using AI analysis
          of risk factors and carrier requirements.
        </p>
        <div>
          <label className="text-xs font-medium text-gray-600 block mb-1">
            Property Address or APN
          </label>
          <input
            className="w-full text-sm border border-gray-200 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400"
            placeholder="Enter address or APN…"
          />
        </div>
        <button className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors">
          Generate Checklist
        </button>
      </div>
    ),
  },
  {
    id: 'disclosure',
    icon: Mail,
    iconBg: 'bg-blue-50',
    iconColor: 'text-blue-600',
    title: 'Insurance Disclosure Letter Generator',
    description: 'Professional disclosure letter for buyers in challenging insurance markets',
    content: (
      <div className="space-y-3 pt-4">
        <p className="text-sm text-gray-600">
          Create a professional disclosure letter to inform buyers about insurance
          market conditions and property-specific risks.
        </p>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1">
              Buyer Name
            </label>
            <input
              className="w-full text-sm border border-gray-200 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400"
              placeholder="e.g. Jane Smith"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1">
              Property Address
            </label>
            <input
              className="w-full text-sm border border-gray-200 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400"
              placeholder="Enter address…"
            />
          </div>
        </div>
        <button className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors">
          Generate Letter
        </button>
      </div>
    ),
  },
  {
    id: 'hard-market',
    icon: AlertTriangle,
    iconBg: 'bg-blue-50',
    iconColor: 'text-blue-600',
    title: 'Hard Market Lookup',
    description: 'Current carrier withdrawals, surplus lines options, and FAIR Plan context by state',
    content: (
      <div className="space-y-3 pt-4">
        <p className="text-sm text-gray-600">
          Look up current hard market conditions, carrier withdrawals, and FAIR Plan
          availability by state.
        </p>
        <div>
          <label className="text-xs font-medium text-gray-600 block mb-1">
            Select State
          </label>
          <select className="w-full text-sm border border-gray-200 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white">
            <option value="">Select a state…</option>
            <option value="CA">California</option>
            <option value="FL">Florida</option>
            <option value="TX">Texas</option>
            <option value="LA">Louisiana</option>
            <option value="CO">Colorado</option>
          </select>
        </div>
        <button className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors">
          Look Up Market
        </button>
      </div>
    ),
  },
]

export function ToolkitContent() {
  const [openId, setOpenId] = useState<string | null>(null)

  function toggle(id: string) {
    setOpenId((prev) => (prev === id ? null : id))
  }

  return (
    <div className="p-8 max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-1">
        <Link
          href="/dashboard"
          className="text-gray-400 hover:text-gray-600 transition-colors"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div className="flex items-center gap-2">
          <Wrench className="h-6 w-6 text-gray-700" />
          <h1 className="text-2xl font-bold text-gray-900">Agent Toolkit</h1>
        </div>
      </div>
      <p className="text-sm text-blue-600 mb-8 ml-[52px]">
        AI-powered tools for insurance-savvy real estate professionals
      </p>

      {/* Accordion list */}
      <div className="space-y-2">
        {TOOLS.map(({ id, icon: Icon, iconBg, iconColor, title, description, content }) => {
          const isOpen = openId === id
          return (
            <div
              key={id}
              className="bg-white rounded-xl border border-gray-200 overflow-hidden"
            >
              <button
                type="button"
                onClick={() => toggle(id)}
                className="w-full flex items-center gap-4 px-5 py-4 hover:bg-gray-50 transition-colors text-left"
              >
                <div
                  className={`h-9 w-9 rounded-lg ${iconBg} flex items-center justify-center shrink-0`}
                >
                  <Icon className={`h-5 w-5 ${iconColor}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900">{title}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{description}</p>
                </div>
                {isOpen ? (
                  <ChevronUp className="h-4 w-4 text-gray-400 shrink-0" />
                ) : (
                  <ChevronDown className="h-4 w-4 text-gray-400 shrink-0" />
                )}
              </button>
              {isOpen && (
                <div className="px-5 pb-5 border-t border-gray-100">
                  {content}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
