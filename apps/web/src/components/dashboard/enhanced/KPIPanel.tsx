'use client';

import { useState } from 'react';
import {
  Activity,
  ArrowDownRight,
  ArrowUpRight,
  Building2,
  DollarSign,
  Shield,
} from 'lucide-react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { KPI_DETAILS, KPI_HISTORY } from './mockData';
import type { KPI } from './types';
import { LiveDot, Modal, fmt, fmtPct, useRealtimeValue } from './utils';

export function KPIPanel() {
  const premium = useRealtimeValue(190500, 0.003, 4000);
  const lossRatio = useRealtimeValue(6.8, 0.05, 5000);
  const properties = useRealtimeValue(47, 0.01, 8000);
  const avgRisk = useRealtimeValue(58.2, 0.02, 6000);
  const [selectedKPI, setSelectedKPI] = useState<KPI | null>(null);

  const kpis: KPI[] = [
    {
      label: 'Total Premium (Monthly)',
      value: fmt(premium.value),
      raw: premium.value,
      dir: premium.direction,
      icon: DollarSign,
      color: 'text-green-600',
      bg: 'bg-green-50',
      chartColor: '#22c55e',
    },
    {
      label: 'Loss Ratio',
      value: fmtPct(lossRatio.value),
      raw: lossRatio.value,
      dir: lossRatio.direction === 'up' ? 'down' : 'up',
      icon: Activity,
      color: 'text-blue-600',
      bg: 'bg-blue-50',
      chartColor: '#3b82f6',
    },
    {
      label: 'Active Properties',
      value: Math.round(properties.value).toString(),
      raw: properties.value,
      dir: properties.direction,
      icon: Building2,
      color: 'text-purple-600',
      bg: 'bg-purple-50',
      chartColor: '#8b5cf6',
    },
    {
      label: 'Avg Risk Score',
      value: avgRisk.value.toFixed(1),
      raw: avgRisk.value,
      dir: avgRisk.direction === 'up' ? 'down' : 'up',
      icon: Shield,
      color: 'text-indigo-600',
      bg: 'bg-indigo-50',
      chartColor: '#6366f1',
    },
  ];

  const detail = selectedKPI ? KPI_DETAILS[selectedKPI.label] : null;
  const history = selectedKPI ? KPI_HISTORY[selectedKPI.label] : [];

  return (
    <>
      <div className="grid grid-cols-4 gap-2.5">
        {kpis.map((kpi) => (
          <div
            key={kpi.label}
            onClick={() => setSelectedKPI(kpi)}
            className="bg-white border border-gray-200 rounded-lg p-2.5 hover:shadow-md hover:border-indigo-300 transition-all cursor-pointer group"
          >
            <div className="flex items-center justify-between mb-1">
              <div className={`p-1.5 rounded ${kpi.bg}`}>
                <kpi.icon size={13} className={kpi.color} />
              </div>
              <div className="flex items-center gap-1">
                <LiveDot />
                {kpi.dir === 'up' ? (
                  <ArrowUpRight size={12} className="text-green-500" />
                ) : (
                  <ArrowDownRight size={12} className="text-red-500" />
                )}
              </div>
            </div>
            <p className="text-lg font-bold text-gray-900 leading-tight">{kpi.value}</p>
            <p className="text-xs text-gray-500">{kpi.label}</p>
            <p className="text-xs text-indigo-500 opacity-0 group-hover:opacity-100 transition-opacity mt-0.5">Click to explore</p>
          </div>
        ))}
      </div>

      <Modal open={!!selectedKPI} onClose={() => setSelectedKPI(null)} title={selectedKPI?.label || ''} wide>
        {selectedKPI && detail && (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-2.5">
              <div className="bg-gray-50 rounded-lg p-3 text-center">
                <p className="text-xs text-gray-500">Current</p>
                <p className="text-xl font-bold text-gray-900">{selectedKPI.value}</p>
              </div>
              <div className="bg-gray-50 rounded-lg p-3 text-center">
                <p className="text-xs text-gray-500">Target</p>
                <p className="text-xl font-bold text-gray-900">
                  {selectedKPI.label.includes('Premium')
                    ? fmt(detail.target)
                    : selectedKPI.label.includes('Ratio')
                      ? fmtPct(detail.target)
                      : detail.target}
                </p>
              </div>
              <div className="bg-gray-50 rounded-lg p-3 text-center">
                <p className="text-xs text-gray-500">6mo Change</p>
                <p
                  className={`text-xl font-bold ${
                    detail.change.startsWith('+') && !selectedKPI.label.includes('Risk')
                      ? 'text-green-600'
                      : detail.change.startsWith('-') && selectedKPI.label.includes('Risk')
                        ? 'text-green-600'
                        : detail.change.startsWith('-') && selectedKPI.label.includes('Ratio')
                          ? 'text-green-600'
                          : 'text-red-600'
                  }`}
                >
                  {detail.change}
                </p>
              </div>
            </div>

            <div>
              <h4 className="text-xs font-semibold text-gray-900 mb-2">6-Month Trend</h4>
              <ResponsiveContainer width="100%" height={140}>
                <AreaChart data={history}>
                  <defs>
                    <linearGradient id={`kpiGrad-${selectedKPI.label}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={selectedKPI.chartColor} stopOpacity={0.15} />
                      <stop offset="95%" stopColor={selectedKPI.chartColor} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="period" tick={{ fontSize: 10, fill: '#94a3b8' }} />
                  <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} />
                  <Tooltip />
                  <Area
                    type="monotone"
                    dataKey="value"
                    stroke={selectedKPI.chartColor}
                    strokeWidth={2}
                    fill={`url(#kpiGrad-${selectedKPI.label})`}
                    dot={{ fill: selectedKPI.chartColor, r: 3 }}
                    name={selectedKPI.label}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            <div>
              <h4 className="text-xs font-semibold text-gray-900 mb-2">Breakdown</h4>
              <div className="space-y-1.5">
                {detail.breakdown.map((item) => {
                  const maxVal = Math.max(...detail.breakdown.map((b) => b.value));
                  return (
                    <div key={item.label} className="flex items-center gap-2">
                      <span className="text-xs text-gray-600 w-28 flex-shrink-0">{item.label}</span>
                      <div className="flex-1 bg-gray-100 rounded-full h-2">
                        <div
                          className="h-2 rounded-full transition-all"
                          style={{ width: `${(item.value / maxVal) * 100}%`, backgroundColor: selectedKPI.chartColor }}
                        />
                      </div>
                      <span className="text-xs font-semibold text-gray-900 w-16 text-right">
                        {selectedKPI.label.includes('Premium')
                          ? fmt(item.value)
                          : selectedKPI.label.includes('Ratio')
                            ? fmtPct(item.value)
                            : item.value}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="bg-indigo-50 rounded-lg p-3">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-semibold text-indigo-900">Progress to Target</span>
                <span className="text-xs font-bold text-indigo-700">{Math.min(100, Math.round((selectedKPI.raw / detail.target) * 100))}%</span>
              </div>
              <div className="bg-indigo-200 rounded-full h-2">
                <div
                  className="h-2 rounded-full bg-indigo-600 transition-all"
                  style={{ width: `${Math.min(100, (selectedKPI.raw / detail.target) * 100)}%` }}
                />
              </div>
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}
