'use client';

import { useState } from 'react';
import { TrendingDown } from 'lucide-react';
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { RISK_ANNOTATIONS, RISK_EXTENDED, RISK_TREND_DATA } from './mockData';

export function RiskTrendPanel() {
  const [range, setRange] = useState<'6mo' | '12mo'>('6mo');
  const [showAnnotations, setShowAnnotations] = useState(true);
  const [, setSelectedPoint] = useState<string | null>(null);

  const data = range === '12mo' ? RISK_EXTENDED : RISK_TREND_DATA;
  const first = data[0]?.score || 0;
  const last = data[data.length - 1]?.score || 0;
  const changePct = ((last - first) / first * 100).toFixed(1);

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500">Risk score trend</span>
          <div className="flex items-center gap-1 text-green-600">
            <TrendingDown size={11} />
            <span className="text-xs font-semibold">{changePct}%</span>
          </div>
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
            onClick={() => setRange('12mo')}
            className={`px-1.5 py-0.5 rounded text-xs font-medium ${
              range === '12mo' ? 'bg-indigo-100 text-indigo-700' : 'text-gray-400 hover:text-gray-600'
            }`}
          >
            12mo
          </button>
          <span className="w-px h-3 bg-gray-200 mx-0.5" />
          <button
            onClick={() => setShowAnnotations(!showAnnotations)}
            className={`px-1.5 py-0.5 rounded text-xs font-medium ${
              showAnnotations ? 'bg-yellow-100 text-yellow-700' : 'text-gray-400 hover:text-gray-600'
            }`}
            title="Toggle annotations"
          >
            Notes
          </button>
        </div>
      </div>
      <ResponsiveContainer width="100%" height={140}>
        <LineChart data={data} onClick={(e) => {
          if (e?.activeLabel) setSelectedPoint(String(e.activeLabel));
        }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
          <XAxis dataKey="month" tick={{ fontSize: 10, fill: '#94a3b8' }} />
          <YAxis domain={[35, 75]} tick={{ fontSize: 10, fill: '#94a3b8' }} />
          <Tooltip
            content={({ active, payload, label }) => {
              if (!active || !payload?.length) return null;
              const annotation = showAnnotations && RISK_ANNOTATIONS.find((a) => a.month === label);
              return (
                <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-2 text-xs">
                  <p className="font-semibold text-gray-900">
                    {label}: {payload[0].value}
                  </p>
                  {annotation && <p className="text-yellow-700 mt-0.5">Note: {annotation.note}</p>}
                </div>
              );
            }}
          />
          <Line
            type="monotone"
            dataKey="score"
            stroke="#6366f1"
            strokeWidth={2}
            dot={(props) => {
              const { cx, cy, payload } = props;
              const hasNote = RISK_ANNOTATIONS.some((a) => a.month === payload.month);
              return (
                <g key={payload.month}>
                  <circle
                    cx={cx}
                    cy={cy}
                    r={hasNote && showAnnotations ? 5 : 3}
                    fill={hasNote && showAnnotations ? '#f59e0b' : '#6366f1'}
                    stroke={hasNote && showAnnotations ? '#f59e0b' : '#6366f1'}
                    strokeWidth={1}
                  />
                </g>
              );
            }}
            name="Risk Score"
          />
        </LineChart>
      </ResponsiveContainer>
      {showAnnotations && RISK_ANNOTATIONS.length > 0 && (
        <div className="mt-1.5 space-y-0.5">
          {RISK_ANNOTATIONS.map((a) => (
            <div key={a.month} className="flex items-center gap-1.5 text-xs">
              <span className="w-2 h-2 rounded-full bg-yellow-400 flex-shrink-0" />
              <span className="text-gray-500 font-medium">{a.month}:</span>
              <span className="text-gray-700">{a.note}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
