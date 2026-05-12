'use client';

import { useEffect, useState } from 'react';
import { TrendingDown } from 'lucide-react';
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { DashboardRiskTrendResponse, RiskTrendDataPoint } from '@coverguard/shared';
import { getDashboardRiskTrend } from '@/lib/api';

export function RiskTrendPanel() {
  const [range, setRange] = useState<'6mo' | '12mo'>('6mo');
  const [showAnnotations, setShowAnnotations] = useState(true);
  const [, setSelectedPoint] = useState<string | null>(null);
  const [response, setResponse] = useState<DashboardRiskTrendResponse | null>(null);

  // PR-B1.g: pull 12-month trend. Replaces RISK_TREND_DATA / RISK_EXTENDED / RISK_ANNOTATIONS mocks.
  // eslint-disable-next-line react-hooks/set-state-in-effect -- B1.g2 will refactor
  useEffect(() => { getDashboardRiskTrend().then(setResponse).catch(() => setResponse(null)); }, []);

  const fullSeries: RiskTrendDataPoint[] = (response?.series ?? []).filter((p): p is RiskTrendDataPoint & { score: number } => typeof p.score === 'number');
  const data = range === '12mo' ? fullSeries : fullSeries.slice(-6);
  const first = data[0]?.score ?? 0;
  const last = data[data.length - 1]?.score ?? 0;
  const changePct = first > 0 ? ((last - first) / first * 100).toFixed(1) : '0.0';

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500">Risk score trend</span>
          <div className="flex items-center gap-1 text-green-600"><TrendingDown size={11} /><span className="text-xs font-semibold">{changePct}%</span></div>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={() => setRange('6mo')} className={`px-1.5 py-0.5 rounded text-xs font-medium ${range === '6mo' ? 'bg-indigo-100 text-indigo-700' : 'text-gray-400 hover:text-gray-600'}`}>6mo</button>
          <button onClick={() => setRange('12mo')} className={`px-1.5 py-0.5 rounded text-xs font-medium ${range === '12mo' ? 'bg-indigo-100 text-indigo-700' : 'text-gray-400 hover:text-gray-600'}`}>12mo</button>
          <span className="w-px h-3 bg-gray-200 mx-0.5" />
          <button onClick={() => setShowAnnotations(!showAnnotations)} className={`px-1.5 py-0.5 rounded text-xs font-medium ${showAnnotations ? 'bg-yellow-100 text-yellow-700' : 'text-gray-400 hover:text-gray-600'}`} title="Toggle annotations">Notes</button>
        </div>
      </div>
      <ResponsiveContainer width="100%" height={140}>
        <LineChart data={data} onClick={(e) => { if (e?.activeLabel) setSelectedPoint(String(e.activeLabel)); }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
          <XAxis dataKey="month" tick={{ fontSize: 10, fill: '#94a3b8' }} />
          <YAxis domain={[35, 75]} tick={{ fontSize: 10, fill: '#94a3b8' }} />
          <Tooltip content={({ active, payload, label }) => {
            if (!active || !payload?.length) return null;
            const annotation = showAnnotations && (response?.annotations ?? []).find((a) => a.month === label);
            return (
              <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-2 text-xs">
                <p className="font-semibold text-gray-900">{label}: {payload[0].value}</p>
                {annotation && <p className="text-yellow-700 mt-0.5">Note: {annotation.note}</p>}
              </div>
            );
          }} />
          <Line type="monotone" dataKey="score" stroke="#6366f1" strokeWidth={2}
            dot={(props) => {
              const { cx, cy, payload } = props;
              const hasNote = (response?.annotations ?? []).some((a) => a.month === payload.month);
              return <g key={payload.month}><circle cx={cx} cy={cy} r={hasNote && showAnnotations ? 5 : 3}
                fill={hasNote && showAnnotations ? '#f59e0b' : '#6366f1'}
                stroke={hasNote && showAnnotations ? '#f59e0b' : '#6366f1'} strokeWidth={1} /></g>;
            }} name="Risk Score" />
        </LineChart>
      </ResponsiveContainer>
      {showAnnotations && (response?.annotations ?? []).length > 0 && (
        <div className="mt-1.5 space-y-0.5">
          {(response?.annotations ?? []).map((a) => (
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
