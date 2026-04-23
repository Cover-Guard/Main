'use client';

import { JSX, useState } from 'react';
import {
  Activity,
  BarChart3,
  Bot,
  Brain,
  Briefcase,
  Building2,
  GripVertical,
  Home,
  Layers,
  Settings,
  Shield,
  TrendingUp,
  X,
} from 'lucide-react';

import { DealsKpiPanel } from '@/components/dashboard/DealsKpiPanel';
import { NotificationBell } from '@/components/notifications/NotificationBell';
import { ActiveCarriersPanel } from './enhanced/ActiveCarriersPanel';
import { ClientManagementPanel } from './enhanced/ClientManagementPanel';
import { ForecastPanel } from './enhanced/ForecastPanel';
import { HomeBuyerAgentPanel } from './enhanced/HomeBuyerAgentPanel';
import { InsightsPanel } from './enhanced/InsightsPanel';
import { KPIPanel } from './enhanced/KPIPanel';
import { PortfolioMixPanel } from './enhanced/PortfolioMixPanel';
import { RiskTrendPanel } from './enhanced/RiskTrendPanel';
import { SavedPropertiesPanel } from './enhanced/SavedPropertiesPanel';
import type { PanelConfig } from './enhanced/types';
import { LiveDot } from './enhanced/utils';

const DEFAULT_LAYOUT: PanelConfig[] = [
  { id: 'insights', title: 'Insights', icon: Brain, order: 0, visible: true, span: 'full' },
  { id: 'kpis', title: 'Key Metrics', icon: BarChart3, order: 1, visible: true, span: 'full' },
  { id: 'deals', title: 'Deals & Fallout', icon: Briefcase, order: 2, visible: true, span: 'full' },
  { id: 'clients', title: 'Client Management', icon: Building2, order: 3, visible: true, span: 'full' },
  { id: 'properties', title: 'Saved Properties', icon: Home, order: 4, visible: true, span: 'full' },
  { id: 'carriers', title: 'Active Carriers for Your Properties', icon: Shield, order: 5, visible: true, span: 'full' },
  { id: 'forecast', title: 'Premium Forecast', icon: TrendingUp, order: 6, visible: true, span: 'third' },
  { id: 'risktrend', title: 'Risk Trend', icon: Activity, order: 7, visible: true, span: 'third' },
  { id: 'portfolio', title: 'Portfolio Mix', icon: Layers, order: 8, visible: true, span: 'third' },
];

const PANEL_COMPONENTS: Record<string, () => JSX.Element | null> = {
  insights: InsightsPanel,
  kpis: KPIPanel,
  deals: DealsKpiPanel,
  clients: ClientManagementPanel,
  properties: SavedPropertiesPanel,
  carriers: ActiveCarriersPanel,
  forecast: ForecastPanel,
  risktrend: RiskTrendPanel,
  portfolio: PortfolioMixPanel,
};

export function EnhancedDashboard() {
  const [layout, setLayout] = useState<PanelConfig[]>(DEFAULT_LAYOUT);
  const [showCustomize, setShowCustomize] = useState(false);
  const [dragItem, setDragItem] = useState<number | null>(null);
  // Right-side AI Agent drawer. When open, takes 25% of viewport width and
  // the rest of the page reflows to the remaining 75% so the user can keep
  // working in the dashboard while chatting with the agent.
  const [agentOpen, setAgentOpen] = useState(false);

  const movePanel = (fromIdx: number, toIdx: number) => {
    setLayout((prev) => {
      const items = [...prev];
      const [moved] = items.splice(fromIdx, 1);
      items.splice(toIdx, 0, moved);
      return items.map((item, i) => ({ ...item, order: i }));
    });
  };

  const toggleVisibility = (id: string) => {
    setLayout((prev) => prev.map((p) => (p.id === id ? { ...p, visible: !p.visible } : p)));
  };
  const resetLayout = () => setLayout(DEFAULT_LAYOUT);

  const visiblePanels = layout.filter((p) => p.visible).sort((a, b) => a.order - b.order);

  const handlePanelDragStart = (panelId: string) => {
    const idx = layout.findIndex((p) => p.id === panelId);
    if (idx !== -1) setDragItem(idx);
  };
  const handlePanelDrop = (panelId: string) => {
    if (dragItem === null) return;
    const toIdx = layout.findIndex((p) => p.id === panelId);
    if (toIdx !== -1 && toIdx !== dragItem) movePanel(dragItem, toIdx);
    setDragItem(null);
  };

  return (
    <>
    <div
      className={`min-h-screen bg-gray-50 transition-[padding] duration-300 ease-out ${
        agentOpen ? 'pr-[25vw]' : ''
      }`}
    >
      <header className="bg-white border-b border-gray-200 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 py-2.5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-indigo-600 rounded-lg">
              <Shield size={16} className="text-white" />
            </div>
            <div>
              <h1 className="text-sm font-bold text-gray-900">Insurance Dashboard</h1>
              <p className="text-xs text-gray-500 flex items-center gap-1">
                <LiveDot /> Real-time monitoring
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <NotificationBell />
            <button
              onClick={() => setAgentOpen((v) => !v)}
              aria-pressed={agentOpen}
              aria-label={agentOpen ? 'Close AI Agent panel' : 'Open AI Agent panel'}
              className={`flex items-center gap-1.5 px-3 py-1.5 border rounded-lg text-xs font-medium transition-colors shadow-sm ${
                agentOpen
                  ? 'bg-indigo-600 text-white border-indigo-600 hover:bg-indigo-700'
                  : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
              }`}
            >
              <Bot size={13} />
              Your Agent
            </button>
            <button
              onClick={() => setShowCustomize(!showCustomize)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-xs font-medium text-gray-700 hover:bg-gray-50 transition-colors shadow-sm"
            >
              <Settings size={13} />
              Customize
            </button>
          </div>
        </div>
      </header>

      {showCustomize && (
        <div className="bg-white border-b border-gray-200 shadow-sm">
          <div className="max-w-7xl mx-auto px-4 py-3">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xs font-semibold text-gray-900">Customize Panels</h3>
              <div className="flex gap-2">
                <button onClick={resetLayout} className="text-xs text-indigo-600 hover:text-indigo-700 font-medium">
                  Reset
                </button>
                <button
                  onClick={() => setShowCustomize(false)}
                  className="text-xs text-gray-500 hover:text-gray-700 font-medium ml-2"
                >
                  Done
                </button>
              </div>
            </div>
            <div className="space-y-1">
              {layout.sort((a, b) => a.order - b.order).map((panel, idx) => (
                <div
                  key={panel.id}
                  draggable
                  onDragStart={() => setDragItem(idx)}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={() => {
                    if (dragItem !== null) {
                      movePanel(dragItem, idx);
                      setDragItem(null);
                    }
                  }}
                  className="flex items-center gap-2 px-2 py-1.5 bg-gray-50 rounded border border-gray-200 cursor-move hover:bg-gray-100 transition-colors"
                >
                  <GripVertical size={12} className="text-gray-400" />
                  <panel.icon size={12} className="text-gray-500" />
                  <span
                    className={`text-xs flex-1 ${
                      panel.visible ? 'text-gray-900 font-medium' : 'text-gray-400 line-through'
                    }`}
                  >
                    {panel.title}
                  </span>
                  <button
                    onClick={() => toggleVisibility(panel.id)}
                    className={`Text-xs px-1.5 py-px rounded font-medium ${
                      panel.visible ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-500'
                    }`}
                  >
                    {panel.visible ? 'On' : 'Off'}
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      <main className="max-w-screen-2xl mx-auto px-3 py-2">
        <div className="grid gap-2 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          {visiblePanels.map((panel) => {
            const PanelComponent = PANEL_COMPONENTS[panel.id];
            if (!PanelComponent) return null;
            const isDragging = dragItem !== null && layout[dragItem]?.id === panel.id;
            return (
              <div
                key={panel.id}
                draggable
                onDragStart={() => handlePanelDragStart(panel.id)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => handlePanelDrop(panel.id)}
                onDragEnd={() => setDragItem(null)}
                className={`bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden cursor-move transition-all flex flex-col h-[28rem] ${
                  isDragging ? 'opacity-40 ring-2 ring-indigo-400' : 'hover:shadow-md hover:border-indigo-200'
                }`}
              >
                <div className="flex items-center justify-between px-2 py-1 border-b border-gray-100 bg-gray-50/50 flex-shrink-0">
                  <div className="flex items-center gap-1 min-w-0">
                    <GripVertical size={11} className="text-gray-300 flex-shrink-0" />
                    <panel.icon size={12} className="text-indigo-600 flex-shrink-0" />
                    <h2 className="text-[11px] font-semibold text-gray-900 truncate">{panel.title}</h2>
                  </div>
                  {(panel.id === 'kpis' || panel.id === 'forecast') && (
                    <div className="flex items-center gap-0.5 flex-shrink-0">
                      <LiveDot />
                    </div>
                  )}
                </div>
                <div className="p-1.5 flex-1 overflow-auto">
                  <PanelComponent />
                </div>
              </div>
            );
          })}
        </div>
      </main>

      <footer className="max-w-7xl mx-auto px-4 py-2 text-center">
        <p className="text-xs text-gray-400">
          Last synced: {new Date().toLocaleString()} · Auto-refresh active
        </p>
      </footer>
    </div>

    {/* Right-side AI Agent drawer.
        Fixed-position so it spans the full viewport top-to-bottom; the
        outer page reflows to pr-[25vw] above so the dashboard sits in the
        remaining 75% and stays usable while the agent is open. */}
    <aside
      aria-label="AI Agent"
      aria-hidden={!agentOpen}
      className={`fixed top-0 right-0 h-screen w-1/4 bg-white border-l border-gray-200 shadow-xl z-50 flex flex-col transform transition-transform duration-300 ease-out ${
        agentOpen ? 'translate-x-0' : 'translate-x-full pointer-events-none'
      }`}
    >
      <div className="flex items-center justify-between px-3 py-2.5 border-b border-gray-200 bg-gray-50/50 flex-shrink-0">
        <div className="flex items-center gap-1.5 min-w-0">
          <Bot size={14} className="text-indigo-600 flex-shrink-0" />
          <h2 className="text-xs font-semibold text-gray-900 truncate">Your Agent</h2>
        </div>
        <button
          onClick={() => setAgentOpen(false)}
          aria-label="Close AI Agent panel"
          className="p-1 rounded text-gray-500 hover:bg-gray-100 hover:text-gray-700"
        >
          <X size={14} />
        </button>
      </div>
      <div className="flex-1 min-h-0 overflow-hidden p-2">
        <HomeBuyerAgentPanel />
      </div>
    </aside>
    </>
  );
}
