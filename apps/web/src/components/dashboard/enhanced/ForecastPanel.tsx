'use client';

import { useState } from 'react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { FORECAST_DATA, FORECAST_EXTENDED } from './mockData';
import { LiveDot, fmt, fmtPct } from './utils';

interface SeriesToggleProps {
  label: string;
  color: string;
  active: boolean;
  onClick: () => void;
}

function SeriesToggle({ label, color, active, onClick }: SeriesToggleProps) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-medium transition-colors ${
        active ? 'bg-white border border-gray-200 shadow-sm' : 'bg-gray-100 text-gray-400 line-through'
      }`}
    >
      <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: active ? color : '#d1d5db' }} />
      {label}
    </button>
  );
}

export function ForecastPanel() {
  const [showPremium, setShowPremium] = useState(true);
  const [showProjected, setShowProjected] = useState(true);
  const [showClaims, setShowClaims] = useState(true);
  const [range, setRange] = useState<'6mo' | '10mo'>('6mo');
  const [showTable, setShowTable] = useState(false);

  const data = range === '10mo' ? FORECAST_EXTENDED : FORECAST_DATA;

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5">
          <LiveDot />
          <span className="text-xs text-gray-500">Rolling forecast</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setRange('6mo')}
            className={`px-1.5 py-0.5 rounded text-xs font-medium ${
              range === '6mo' ? 'bg-indigo-100 text-indigo-700' : 'text-gray-400 hover:text-gray-600'
            }`}
          >
            6mo
          </button>
          <button
            onClick={() => setRange('10mo')}
            className={`px-1.5 py-0.5 rounded text-xs font-medium ${
              range === '10mo' ? 'bg-indigo-100 text-indigo-700' : 'text-gray-400 hover:text-gray-600'
            }`}
          >
            10mo
          </button>
          <span className="w-px h-3 bg-gray-200 mx-0.5" />
          <button
            onClick={() => setShowTable(!showTable)}
            className={`px-1.5 py-0.5 rounded text-xs font-medium ${
              showTable ? 'bg-indigo-100 text-indigo-700' : 'text-gray-400 hover:text-gray-600'
            }`}
          >
            Table
          </button>
        </div>
      </div>
      <div className="flex items-center gap-1.5 mb-2">
        <SeriesToggle label="Premium" color="#6366f1" active={showPremium} onClick={() => setShowPremium(!showPremium)} />
        <SeriesToggle label="Projected" color="#a78bfa" active={showProjected} onClick={() => setShowProjected(!showProjected)} />
        <SeriesToggle label="Claims" color="#f59e0b" active={showClaims} onClick={() => setShowClaims(!showClaims)} />
      </div>
      {!showTable ? (
        <ResponsiveContainer width="100%" height={160}>
          <AreaChart data={data}>
            <defs>
              <linearGradient id="colorPrem" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#6366f1" stopOpacity={0.15} />
                <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="colorProj" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#a78bfa" stopOpacity={0.1} />
                <stop offset="95%" stopColor="#a78bfa" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis dataKey="month" tick={{ fontSize: 10, fill: '#94a3b8' }} />
            <YAxis tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 10, fill: '#94a3b8' }} />
            <Tooltip formatter={(v) => fmt(v as number)} />
            {showPremium && <Area type="monotone" dataKey="premium" stroke="#6366f1" strokeWidth={2} fill="url(#colorPrem)" name="Premium" />}
            {showProjected && (
              <Area type="monotone" dataKey="projected" stroke="#a78bfa" strokeWidth={2} strokeDasharray="5 5" fill="url(#colorProj)" name="Projected" />
            )}
            {showClaims && <Area type="monotone" dataKey="claims" stroke="#f59e0b" strokeWidth={2} fill="none" name="Claims" />}
          </AreaChart>
        </ResponsiveContainer>
      ) : (
        <div className="overflow-x-auto max-h-40 overflow-y-auto">
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-white">
              <tr className="border-b">
                {['Month', 'Premium', 'Projected', 'Claims', 'Loss %'].map((h) => (
                  <th key={h} className="text-left py-1 px-2 text-gray-500 font-medium">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.map((d) => (
                <tr key={d.month} className="border-b last:border-0 hover:bg-gray-50">
                  <td className="py-1 px-2 font-medium text-gray-900">{d.month}</td>
                  <td className="py-1 px-2">{fmt(d.premium)}</td>
                  <td className="py-1 px-2">{fmt(d.projected)}</td>
                  <td className="py-1 px-2">{fmt(d.claims)}</td>
                  <td className="py-1 px-2">{fmtPct(d.loss)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
