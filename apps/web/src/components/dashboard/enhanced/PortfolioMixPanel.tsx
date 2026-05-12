'use client';

import { useEffect, useState } from 'react';
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import type { DashboardPortfolioMixResponse } from '@coverguard/shared';
import { getDashboardPortfolioMix } from '@/lib/api';
import { Modal, fmt } from './utils';

export function PortfolioMixPanel() {
  const [activeSegment, setActiveSegment] = useState<number | null>(null);
  const [showDetail, setShowDetail] = useState<string | null>(null);
  const [response, setResponse] = useState<DashboardPortfolioMixResponse | null>(null);

  // PR-B1.h: pull segments + per-segment detail from API. Replaces the
  // PORTFOLIO_MIX / PORTFOLIO_DETAILS mocks.
  // eslint-disable-next-line react-hooks/set-state-in-effect -- B1.h2 will refactor
  useEffect(() => {
    getDashboardPortfolioMix().then(setResponse).catch(() => setResponse(null));
  }, []);

  const segments = response?.segments ?? [];
  const detailMap = response?.details ?? {};
  const detail = showDetail ? detailMap[showDetail] : null;

  return (
    <div>
      <div className="flex items-center gap-2">
        <ResponsiveContainer width="50%" height={150}>
          <PieChart>
            <Pie data={segments} dataKey="value" nameKey="name" cx="50%" cy="50%"
              innerRadius={30} outerRadius={activeSegment !== null ? 62 : 55} paddingAngle={3}
              onMouseEnter={(_, idx) => setActiveSegment(idx)}
              onMouseLeave={() => setActiveSegment(null)}
              onClick={(_, idx) => setShowDetail(segments[idx].name)}
              style={{ cursor: 'pointer' }}>
              {segments.map((entry, idx) => (
                <Cell key={idx} fill={entry.color}
                  opacity={activeSegment !== null && activeSegment !== idx ? 0.4 : 1}
                  stroke={activeSegment === idx ? entry.color : 'none'}
                  strokeWidth={activeSegment === idx ? 2 : 0} />
              ))}
            </Pie>
            <Tooltip formatter={(v) => `${v}%`} />
          </PieChart>
        </ResponsiveContainer>
        <div className="space-y-1 text-xs flex-1">
          {segments.map((seg, idx) => (
            <div key={seg.name}
              className={`flex items-center gap-1.5 px-1.5 py-0.5 rounded cursor-pointer transition-colors ${activeSegment === idx ? 'bg-gray-100' : 'hover:bg-gray-50'}`}
              onMouseEnter={() => setActiveSegment(idx)}
              onMouseLeave={() => setActiveSegment(null)}
              onClick={() => setShowDetail(seg.name)}>
              <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: seg.color }} />
              <span className="text-gray-600 flex-1">{seg.name}</span>
              <span className="font-semibold text-gray-900">{seg.value}%</span>
            </div>
          ))}
        </div>
      </div>

      <Modal open={!!showDetail} onClose={() => setShowDetail(null)} title={`${showDetail || ''} Segment`}>
        {detail && (
          <div className="space-y-3">
            <div className="grid grid-cols-3 gap-2">
              <div className="bg-gray-50 rounded-lg p-2.5 text-center">
                <p className="text-xs text-gray-500">Properties</p>
                <p className="text-lg font-bold text-gray-900">{detail.count}</p>
              </div>
              <div className="bg-gray-50 rounded-lg p-2.5 text-center">
                <p className="text-xs text-gray-500">Avg Risk</p>
                <p className={`text-lg font-bold ${(detail.avgRisk ?? 0) >= 60 ? 'text-yellow-600' : 'text-green-600'}`}>
                  {detail.avgRisk ?? '—'}
                </p>
              </div>
              <div className="bg-gray-50 rounded-lg p-2.5 text-center">
                <p className="text-xs text-gray-500">Monthly Premium</p>
                <p className="text-lg font-bold text-gray-900">{detail.totalPremium != null ? fmt(detail.totalPremium) : '—'}</p>
              </div>
            </div>
            <div className="bg-gray-50 rounded-lg p-2.5 text-xs space-y-1">
              <p><span className="text-gray-500">Top Property:</span> <span className="font-medium text-gray-900">{detail.topProperty ?? '—'}</span></p>
              {detail.growth && (
                <p><span className="text-gray-500">Growth (YoY):</span>{' '}
                  <span className={`font-semibold ${detail.growth.startsWith('+') ? 'text-green-600' : 'text-red-600'}`}>{detail.growth}</span>
                </p>
              )}
            </div>
            <div>
              <h4 className="text-xs font-semibold text-gray-900 mb-1.5">Segment Share</h4>
              <div className="bg-gray-100 rounded-full h-3 flex overflow-hidden">
                {segments.map((seg) => (
                  <div key={seg.name} className="h-3 transition-all"
                    style={{ width: `${seg.value}%`, backgroundColor: seg.color, opacity: seg.name === showDetail ? 1 : 0.25 }} />
                ))}
              </div>
              <p className="text-xs text-gray-500 mt-1 text-center">{showDetail}: {segments.find((s) => s.name === showDetail)?.value}% of portfolio</p>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
