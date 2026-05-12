'use client';

import { useEffect, useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import type { DashboardInsightsResponse } from '@coverguard/shared';
import { getDashboardInsights } from '@/lib/api';
import { LiveDot } from './utils';

export function InsightsPanel() {
  const [response, setResponse] = useState<DashboardInsightsResponse | null>(null);

  // PR-B1.h: pull insights from API. Replaces the INSIGHTS mock.
  // eslint-disable-next-line react-hooks/set-state-in-effect -- B1.h2 will refactor
  useEffect(() => { getDashboardInsights().then(setResponse).catch(() => setResponse(null)); }, []);

  const insights = response?.insights ?? [];
  const [expanded, setExpanded] = useState<number | null>(null);
  const priorityColors: Record<string, string> = {
    high: 'border-l-red-500',
    medium: 'border-l-yellow-500',
    low: 'border-l-blue-500',
  };

  if (insights.length === 0) {
    return (
      <div className="space-y-1.5">
        <div className="flex items-center gap-1.5 mb-0.5">
          <LiveDot />
          <span className="text-xs text-gray-500 font-medium">Live intelligence feed</span>
        </div>
        <p className="text-xs text-gray-400 italic px-2 py-3">No insights yet — check back as activity builds.</p>
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-1.5 mb-0.5">
        <LiveDot />
        <span className="text-xs text-gray-500 font-medium">Live intelligence feed</span>
      </div>
      {insights.map((ins) => (
        <div key={ins.id}
          className={`border-l-3 ${priorityColors[ins.priority]} bg-gray-50 rounded p-2.5 cursor-pointer hover:bg-gray-100 transition-colors`}
          onClick={() => setExpanded(expanded === ins.id ? null : ins.id)}>
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-2 flex-1 min-w-0">
              <span className="text-base flex-shrink-0">{ins.icon}</span>
              <div className="min-w-0">
                <p className="font-medium text-xs text-gray-900 leading-snug">{ins.title}</p>
                {expanded === ins.id && <p className="text-xs text-gray-600 mt-1 leading-relaxed">{ins.body}</p>}
              </div>
            </div>
            <div className="flex items-center gap-1.5 flex-shrink-0 ml-2">
              <span className="text-xs text-gray-400">{ins.time}</span>
              {expanded === ins.id ? <ChevronUp size={12} className="text-gray-400" /> : <ChevronDown size={12} className="text-gray-400" />}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
