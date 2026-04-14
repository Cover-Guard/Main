'use client';

import { useState, useEffect, useRef, useCallback, useMemo, ReactNode, JSX } from 'react';
import {
  BarChart, Bar, LineChart, Line, AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend
} from 'recharts';
import {
  GripVertical, X, Settings, TrendingUp, TrendingDown, AlertTriangle, Shield,
  Building2, FileText, RefreshCw, Eye, ArrowUpRight, ArrowDownRight,
  ChevronDown, ChevronUp, Check, Send, Star, MapPin, DollarSign,
  BarChart3, Activity, Zap, Home, Layers, Clock, Brain,
  Maximize2, Minimize2, LucideIcon
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Property {
  id: number;
  name: string;
  address: string;
  type: string;
  value: number;
  sqft: number;
  yearBuilt: number;
  riskScore: number;
  riskLevel: string;
  premium: number;
  carrier: string;
  coverageAmount: number;
  floodZone: string;
  windScore: number;
  fireScore: number;
  crimeScore: number;
  seismicScore: number;
  lastInspection: string;
  claims: number;
  image: string;
}

interface Carrier {
  id: number;
  name: string;
  properties: string[];
  clients: string[];
  rating: string;
  specialty: string;
  quoteRange: string;
  responseTime: string;
  bindingReady: boolean;
  appetite: string;
}

interface ForecastDataPoint {
  month: string;
  premium: number;
  claims: number;
  loss: number;
  projected: number;
}

interface RiskTrendDataPoint {
  month: string;
  score: number;
}

interface PortfolioSegment {
  name: string;
  value: number;
  color: string;
}

interface Insight {
  id: number;
  type: string;
  icon: string;
  title: string;
  body: string;
  time: string;
  priority: 'high' | 'medium' | 'low';
}

interface Client {
  id: number;
  name: string;
  contact: string;
  email: string;
  phone: string;
  properties: number;
  totalValue: number;
  status: string;
  lastContact: string;
  notes: string;
}

interface Message {
  id: number;
  from: 'agent' | 'buyer';
  name: string;
  text: string;
  time: string;
}

interface RiskCategory {
  label: string;
  score: number;
  max: number;
  color: string;
}

interface KPI {
  label: string;
  value: string;
  raw: number;
  dir: 'up' | 'down';
  icon: LucideIcon;
  color: string;
  bg: string;
  chartColor: string;
}

interface KPIDetail {
  target: number;
  change: string;
  breakdown: Array<{ label: string; value: number }>;
}

interface PanelConfig {
  id: string;
  title: string;
  icon: LucideIcon;
  order: number;
  visible: boolean;
  span: 'full' | 'half' | 'third';
}

interface RealtimeValue {
  value: number;
  direction: 'up' | 'down';
}

// ─── Mock Data ────────────────────────────────────────────────────────────────

const SAVED_PROPERTIES: Property[] = [
  { id: 1, name: 'Oakwood Commercial Plaza', address: '1420 Industrial Blvd, Austin, TX', type: 'Commercial', value: 4200000, sqft: 28000, yearBuilt: 2005, riskScore: 72, riskLevel: 'Moderate', premium: 18500, carrier: 'Hartford', coverageAmount: 5000000, floodZone: 'X', windScore: 3, fireScore: 2, crimeScore: 4, seismicScore: 1, lastInspection: '2025-11-15', claims: 1, image: '🏢' },
  { id: 2, name: 'Riverside Apartment Complex', address: '880 River Rd, Portland, OR', type: 'Residential Multi', value: 8500000, sqft: 65000, yearBuilt: 1998, riskScore: 58, riskLevel: 'Low-Moderate', premium: 32000, carrier: 'Zurich', coverageAmount: 10000000, floodZone: 'AE', windScore: 2, fireScore: 4, crimeScore: 3, seismicScore: 5, lastInspection: '2026-01-20', claims: 0, image: '🏘️' },
  { id: 3, name: 'Metro Distribution Center', address: '5500 Logistics Way, Dallas, TX', type: 'Industrial', value: 12000000, sqft: 120000, yearBuilt: 2018, riskScore: 41, riskLevel: 'Low', premium: 45000, carrier: 'Chubb', coverageAmount: 15000000, floodZone: 'X', windScore: 4, fireScore: 2, crimeScore: 2, seismicScore: 1, lastInspection: '2026-03-05', claims: 0, image: '🏭' },
  { id: 4, name: 'Harborview Retail Strip', address: '220 Coastal Hwy, Miami, FL', type: 'Retail', value: 3800000, sqft: 18000, yearBuilt: 2012, riskScore: 85, riskLevel: 'High', premium: 28000, carrier: 'AIG', coverageAmount: 5000000, floodZone: 'VE', windScore: 5, fireScore: 2, crimeScore: 3, seismicScore: 1, lastInspection: '2025-09-10', claims: 3, image: '🏬' },
  { id: 5, name: 'Summit Office Tower', address: '100 Financial Dr, Chicago, IL', type: 'Office', value: 22000000, sqft: 180000, yearBuilt: 2020, riskScore: 35, riskLevel: 'Low', premium: 67000, carrier: 'Liberty Mutual', coverageAmount: 25000000, floodZone: 'X', windScore: 2, fireScore: 1, crimeScore: 3, seismicScore: 2, lastInspection: '2026-02-28', claims: 0, image: '🏛️' },
];

const ACTIVE_CARRIERS: Carrier[] = [
  { id: 1, name: 'Hartford Financial', properties: ['Oakwood Commercial Plaza'], clients: ['Oakwood LLC'], rating: 'A+', specialty: 'Commercial Property', quoteRange: '$16,000 - $21,000', responseTime: '24-48 hrs', bindingReady: true, appetite: 'Strong' },
  { id: 2, name: 'Zurich Insurance', properties: ['Riverside Apartment Complex'], clients: ['River Holdings Inc.'], rating: 'AA-', specialty: 'Multi-Family Residential', quoteRange: '$28,000 - $36,000', responseTime: '48-72 hrs', bindingReady: true, appetite: 'Moderate' },
  { id: 3, name: 'Chubb Limited', properties: ['Metro Distribution Center', 'Summit Office Tower'], clients: ['Metro Logistics Corp', 'Summit Capital Group'], rating: 'AA', specialty: 'Industrial & Office', quoteRange: '$40,000 - $72,000', responseTime: '24 hrs', bindingReady: true, appetite: 'Strong' },
  { id: 4, name: 'AIG', properties: ['Harborview Retail Strip'], clients: ['Harbor Retail Partners'], rating: 'A', specialty: 'Coastal Property', quoteRange: '$24,000 - $32,000', responseTime: '72 hrs', bindingReady: false, appetite: 'Cautious' },
  { id: 5, name: 'Liberty Mutual', properties: ['Summit Office Tower'], clients: ['Summit Capital Group'], rating: 'A', specialty: 'High-Value Office', quoteRange: '$58,000 - $75,000', responseTime: '48 hrs', bindingReady: true, appetite: 'Strong' },
  { id: 6, name: 'Travelers', properties: ['Oakwood Commercial Plaza', 'Riverside Apartment Complex'], clients: ['Oakwood LLC', 'River Holdings Inc.'], rating: 'AA-', specialty: 'Multi-Line Commercial', quoteRange: '$15,000 - $34,000', responseTime: '24-48 hrs', bindingReady: true, appetite: 'Strong' },
];

const FORECAST_DATA: ForecastDataPoint[] = [
  { month: 'May', premium: 191000, claims: 12000, loss: 6.3, projected: 195000 },
  { month: 'Jun', premium: 195000, claims: 18000, loss: 9.2, projected: 198000 },
  { month: 'Jul', premium: 198000, claims: 22000, loss: 11.1, projected: 202000 },
  { month: 'Aug', premium: 202000, claims: 15000, loss: 7.4, projected: 207000 },
  { month: 'Sep', premium: 207000, claims: 9000, loss: 4.3, projected: 210000 },
  { month: 'Oct', premium: 210000, claims: 11000, loss: 5.2, projected: 215000 },
];

const RISK_TREND_DATA: RiskTrendDataPoint[] = [
  { month: 'Nov', score: 62 },
  { month: 'Dec', score: 58 },
  { month: 'Jan', score: 55 },
  { month: 'Feb', score: 52 },
  { month: 'Mar', score: 54 },
  { month: 'Apr', score: 51 },
];

const PORTFOLIO_MIX: PortfolioSegment[] = [
  { name: 'Commercial', value: 35, color: '#6366f1' },
  { name: 'Residential', value: 25, color: '#8b5cf6' },
  { name: 'Industrial', value: 20, color: '#a78bfa' },
  { name: 'Retail', value: 12, color: '#c4b5fd' },
  { name: 'Office', value: 8, color: '#ddd6fe' },
];

const INSIGHTS: Insight[] = [
  { id: 1, type: 'alert', icon: '⚠️', title: 'High Wind Exposure — Harborview Retail Strip', body: 'Hurricane season begins June 1. Current wind score of 5/5 combined with VE flood zone puts this property at elevated risk. Consider requesting updated wind mitigation credits from AIG or exploring excess flood coverage.', time: '2 hrs ago', priority: 'high' },
  { id: 2, type: 'opportunity', icon: '💡', title: 'Bundle Discount Available — Oakwood + Riverside via Travelers', body: 'Travelers has appetite for both Oakwood Commercial Plaza (Oakwood LLC) and Riverside Apartment Complex (River Holdings Inc.). Bundling could reduce combined premiums by 12-15%, saving approximately $7,500/year.', time: '4 hrs ago', priority: 'medium' },
  { id: 3, type: 'trend', icon: '📈', title: 'Portfolio Risk Score Improving', body: 'Your aggregate risk score has decreased from 62 to 51 over the past 6 months. Key drivers: Metro Distribution Center\'s new sprinkler system and Summit Office Tower\'s updated security infrastructure. Continue momentum by scheduling Harborview inspection.', time: '1 day ago', priority: 'low' },
  { id: 4, type: 'renewal', icon: '🔄', title: 'Upcoming Renewal — Oakwood Commercial Plaza (Hartford)', body: 'Policy renewal due in 45 days. Current premium: $18,500. Market conditions suggest 3-5% increase. Recommend requesting competitive quotes from Travelers and Chubb to leverage at renewal.', time: '1 day ago', priority: 'medium' },
  { id: 5, type: 'forecast', icon: '🔮', title: 'Q3 Premium Forecast: +4.2% Growth', body: 'Based on current pipeline and renewal schedule, projected Q3 premium volume will reach $607,000, up from $583,000 in Q2. Two new prospect properties in underwriting could add an additional $35,000.', time: '3 hrs ago', priority: 'low' },
];

const CLIENTS: Client[] = [
  { id: 1, name: 'Oakwood LLC', contact: 'Marcus Chen', email: 'm.chen@oakwood.com', phone: '(512) 555-0142', properties: 1, totalValue: 4200000, status: 'Active', lastContact: 'Apr 10, 2026', notes: 'Renewal coming up in 45 days' },
  { id: 2, name: 'River Holdings Inc.', contact: 'Sarah Palmer', email: 's.palmer@riverholdings.com', phone: '(503) 555-0198', properties: 1, totalValue: 8500000, status: 'Active', lastContact: 'Apr 8, 2026', notes: 'Interested in bundling with Travelers' },
  { id: 3, name: 'Metro Logistics Corp', contact: 'James Whitfield', email: 'j.whitfield@metrologistics.com', phone: '(214) 555-0211', properties: 1, totalValue: 12000000, status: 'Active', lastContact: 'Apr 12, 2026', notes: 'Expanding warehouse — may need coverage update' },
  { id: 4, name: 'Harbor Retail Partners', contact: 'Diana Reyes', email: 'd.reyes@harborretail.com', phone: '(305) 555-0177', properties: 1, totalValue: 3800000, status: 'At Risk', lastContact: 'Mar 28, 2026', notes: 'Concerned about premium increase after 3 claims' },
  { id: 5, name: 'Summit Capital Group', contact: 'Robert Kline', email: 'r.kline@summitcap.com', phone: '(312) 555-0165', properties: 1, totalValue: 22000000, status: 'Active', lastContact: 'Apr 11, 2026', notes: 'High-value client, very satisfied with Chubb coverage' },
];

const MESSAGES: Message[] = [
  { id: 1, from: 'agent', name: 'Your Agent', text: 'Hi John! I\'ve reviewed the risk report for the Oakwood property. The moderate risk score of 72 is mainly driven by the crime index in that area. I\'d recommend Hartford or Travelers for coverage.', time: '10:15 AM' },
  { id: 2, from: 'buyer', name: 'You', text: 'Thanks! What\'s the premium looking like for Hartford?', time: '10:22 AM' },
  { id: 3, from: 'agent', name: 'Your Agent', text: 'Hartford is quoting $16K-$21K annually for $5M coverage. I can request a formal binding offer if you\'d like to proceed. Travelers may also be competitive — want me to get quotes from both?', time: '10:25 AM' },
  { id: 4, from: 'buyer', name: 'You', text: 'Yes, let\'s get both. Also, can you send over the full risk report?', time: '10:30 AM' },
  { id: 5, from: 'agent', name: 'Your Agent', text: 'Absolutely! I\'ve attached the risk report to your Saved Properties. You can view it anytime by clicking Report on the property card. I\'ll get those quotes out today.', time: '10:32 AM' },
];

// ─── Utility Functions ────────────────────────────────────────────────────────

const fmt = (n: number): string =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);

const fmtPct = (n: number): string => `${n.toFixed(1)}%`;

// ─── Utility Components ───────────────────────────────────────────────────────

interface BadgeProps {
  children: ReactNode;
  color?: 'blue' | 'green' | 'yellow' | 'red' | 'purple' | 'gray' | 'indigo';
}

function Badge({ children, color = 'blue' }: BadgeProps) {
  const colors: Record<string, string> = {
    blue: 'bg-blue-100 text-blue-800',
    green: 'bg-green-100 text-green-800',
    yellow: 'bg-yellow-100 text-yellow-800',
    red: 'bg-red-100 text-red-800',
    purple: 'bg-purple-100 text-purple-800',
    gray: 'bg-gray-100 text-gray-700',
    indigo: 'bg-indigo-100 text-indigo-800',
  };
  return (
    <span className={`inline-flex items-center px-1.5 py-px rounded-full text-xs font-medium leading-tight ${colors[color]}`}>
      {children}
    </span>
  );
}

interface RiskBadgeProps {
  level: string;
}

function RiskBadge({ level }: RiskBadgeProps) {
  const map: Record<string, BadgeProps['color']> = {
    Low: 'green',
    'Low-Moderate': 'blue',
    Moderate: 'yellow',
    High: 'red',
  };
  return <Badge color={map[level] || 'gray'}>{level}</Badge>;
}

function LiveDot() {
  return (
    <span className="relative flex h-2 w-2">
      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
      <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
    </span>
  );
}

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  wide?: boolean;
  children: ReactNode;
}

function Modal({ open, onClose, title, wide = false, children }: ModalProps) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
      <div
        className={`relative bg-white rounded-xl shadow-2xl ${wide ? 'max-w-6xl' : 'max-w-2xl'} w-full max-h-[90vh] overflow-auto`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-white z-10 flex items-center justify-between px-4 py-3 border-b rounded-t-xl">
          <h2 className="text-sm font-semibold text-gray-900">{title}</h2>
          <button
            onClick={onClose}
            className="p-0.5 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600"
          >
            <X size={16} />
          </button>
        </div>
        <div className="p-4">{children}</div>
      </div>
    </div>
  );
}

// ─── Real-time Ticker Hook ────────────────────────────────────────────────────

function useRealtimeValue(base: number, variance: number = 0.02, interval: number = 3000): RealtimeValue {
  const [value, setValue] = useState(base);
  const [direction, setDirection] = useState<'up' | 'down'>('up');

  useEffect(() => {
    const id = setInterval(() => {
      setValue((prev) => {
        const change = prev * variance * (Math.random() - 0.45);
        const next = prev + change;
        setDirection(change >= 0 ? 'up' : 'down');
        return next;
      });
    }, interval);
    return () => clearInterval(id);
  }, [base, variance, interval]);

  return { value, direction };
}

// ─── Panel: Insights ───────────────────────────────────────────────────────────

function InsightsPanel() {
  const [expanded, setExpanded] = useState<number | null>(null);
  const priorityColors: Record<string, string> = {
    high: 'border-l-red-500',
    medium: 'border-l-yellow-500',
    low: 'border-l-blue-500',
  };

  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-1.5 mb-0.5">
        <LiveDot />
        <span className="text-xs text-gray-500 font-medium">Live intelligence feed</span>
      </div>
      {INSIGHTS.map((ins) => (
        <div
          key={ins.id}
          className={`border-l-3 ${priorityColors[ins.priority]} bg-gray-50 rounded p-2.5 cursor-pointer hover:bg-gray-100 transition-colors`}
          onClick={() => setExpanded(expanded === ins.id ? null : ins.id)}
        >
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
              {expanded === ins.id ? (
                <ChevronUp size={12} className="text-gray-400" />
              ) : (
                <ChevronDown size={12} className="text-gray-400" />
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Panel: Risk Report Modal ─────────────────────────────────────────────────

interface RiskReportModalProps {
  property: Property | null;
  open: boolean;
  onClose: () => void;
  running: boolean;
  onReRun: () => void;
}

function RiskReportModal({ property, open, onClose, running, onReRun }: RiskReportModalProps) {
  if (!property) return null;

  const riskCategories: RiskCategory[] = [
    { label: 'Wind / Hurricane', score: property.windScore, max: 5, color: property.windScore >= 4 ? '#ef4444' : property.windScore >= 3 ? '#f59e0b' : '#22c55e' },
    { label: 'Fire / Wildfire', score: property.fireScore, max: 5, color: property.fireScore >= 4 ? '#ef4444' : property.fireScore >= 3 ? '#f59e0b' : '#22c55e' },
    { label: 'Crime / Theft', score: property.crimeScore, max: 5, color: property.crimeScore >= 4 ? '#ef4444' : property.crimeScore >= 3 ? '#f59e0b' : '#22c55e' },
    { label: 'Seismic', score: property.seismicScore, max: 5, color: property.seismicScore >= 4 ? '#ef4444' : property.seismicScore >= 3 ? '#f59e0b' : '#22c55e' },
    { label: 'Flood Zone', score: property.floodZone === 'VE' ? 5 : property.floodZone === 'AE' ? 4 : 1, max: 5, color: property.floodZone === 'VE' ? '#ef4444' : property.floodZone === 'AE' ? '#f59e0b' : '#22c55e' },
  ];

  return (
    <Modal open={open} onClose={onClose} title={`Risk Report — ${property.name}`} wide>
      <div className="space-y-4">
        {running && (
          <div className="flex items-center gap-2 bg-indigo-50 text-indigo-700 rounded-lg p-2.5">
            <RefreshCw size={14} className="animate-spin" />
            <span className="text-xs font-medium">Re-running risk analysis... Updated data will appear momentarily.</span>
          </div>
        )}

        {/* Summary Header */}
        <div className="grid grid-cols-4 gap-2.5">
          <div className="bg-gray-50 rounded-lg p-3 text-center">
            <p className="text-xs text-gray-500 uppercase tracking-wider">Overall Risk</p>
            <p
              className={`text-2xl font-bold mt-0.5 ${
                property.riskScore >= 75 ? 'text-red-600' : property.riskScore >= 50 ? 'text-yellow-600' : 'text-green-600'
              }`}
            >
              {property.riskScore}
            </p>
            <RiskBadge level={property.riskLevel} />
          </div>
          <div className="bg-gray-50 rounded-lg p-3 text-center">
            <p className="text-xs text-gray-500 uppercase tracking-wider">Property Value</p>
            <p className="text-xl font-bold mt-0.5 text-gray-900">{fmt(property.value)}</p>
          </div>
          <div className="bg-gray-50 rounded-lg p-3 text-center">
            <p className="text-xs text-gray-500 uppercase tracking-wider">Annual Premium</p>
            <p className="text-xl font-bold mt-0.5 text-gray-900">{fmt(property.premium)}</p>
          </div>
          <div className="bg-gray-50 rounded-lg p-3 text-center">
            <p className="text-xs text-gray-500 uppercase tracking-wider">Flood Zone</p>
            <p className="text-xl font-bold mt-0.5 text-gray-900">{property.floodZone}</p>
          </div>
        </div>

        {/* Risk Breakdown */}
        <div>
          <h3 className="text-xs font-semibold text-gray-900 mb-2">Risk Factor Breakdown</h3>
          <div className="space-y-1.5">
            {riskCategories.map((cat) => (
              <div key={cat.label} className="flex items-center gap-3">
                <span className="text-xs text-gray-600 w-28">{cat.label}</span>
                <div className="flex-1 bg-gray-200 rounded-full h-2">
                  <div
                    className="h-2 rounded-full transition-all duration-500"
                    style={{ width: `${(cat.score / cat.max) * 100}%`, backgroundColor: cat.color }}
                  />
                </div>
                <span className="text-xs font-semibold w-8 text-right" style={{ color: cat.color }}>
                  {cat.score}/{cat.max}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Property Details */}
        <div className="grid grid-cols-2 gap-2.5">
          <div className="bg-gray-50 rounded-lg p-3">
            <h4 className="text-xs font-semibold text-gray-900 mb-1.5">Property Details</h4>
            <div className="space-y-0.5 text-xs">
              <p>
                <span className="text-gray-500">Type:</span> <span className="text-gray-900 font-medium">{property.type}</span>
              </p>
              <p>
                <span className="text-gray-500">Sq Ft:</span> <span className="text-gray-900 font-medium">{property.sqft.toLocaleString()}</span>
              </p>
              <p>
                <span className="text-gray-500">Built:</span> <span className="text-gray-900 font-medium">{property.yearBuilt}</span>
              </p>
              <p>
                <span className="text-gray-500">Inspected:</span> <span className="text-gray-900 font-medium">{property.lastInspection}</span>
              </p>
            </div>
          </div>
          <div className="bg-gray-50 rounded-lg p-3">
            <h4 className="text-xs font-semibold text-gray-900 mb-1.5">Coverage Summary</h4>
            <div className="space-y-0.5 text-xs">
              <p>
                <span className="text-gray-500">Carrier:</span> <span className="text-gray-900 font-medium">{property.carrier}</span>
              </p>
              <p>
                <span className="text-gray-500">Limit:</span> <span className="text-gray-900 font-medium">{fmt(property.coverageAmount)}</span>
              </p>
              <p>
                <span className="text-gray-500">Premium:</span> <span className="text-gray-900 font-medium">{fmt(property.premium)}</span>
              </p>
              <p>
                <span className="text-gray-500">Claims:</span> <span className="text-gray-900 font-medium">{property.claims}</span>
              </p>
            </div>
          </div>
        </div>

        {/* Recommendations */}
        <div className="bg-indigo-50 rounded-lg p-3">
          <h4 className="text-xs font-semibold text-indigo-900 mb-1">Recommendations</h4>
          <ul className="space-y-0.5 text-xs text-indigo-800">
            {property.riskScore >= 75 && (
              <li>• Prioritize mitigation: Consider wind-resistive upgrades and updated flood barriers</li>
            )}
            {property.claims > 0 && <li>• Review claims history with carrier to negotiate improved terms at renewal</li>}
            {property.floodZone !== 'X' && <li>• Evaluate supplemental flood insurance or excess coverage options</li>}
            <li>• Schedule property re-inspection to capture any risk-reducing improvements</li>
            <li>• Request competitive quotes from 2-3 alternative carriers before renewal</li>
          </ul>
        </div>

        <div className="flex justify-end gap-2">
          <button
            onClick={onReRun}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-xs font-medium transition-colors"
          >
            <RefreshCw size={12} className={running ? 'animate-spin' : ''} />
            ReRun Analysis
          </button>
          <button
            onClick={onClose}
            className="px-3 py-1.5 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 text-xs font-medium transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </Modal>
  );
}

// ─── Panel: Saved Properties ──────────────────────────────────────────────────

function SavedPropertiesPanel() {
  const [selectedReport, setSelectedReport] = useState<Property | null>(null);
  const [reportRunning, setReportRunning] = useState(false);
  const [compareSet, setCompareSet] = useState(new Set<number>());
  const [showCompare, setShowCompare] = useState(false);

  const toggleCompare = (id: number) => {
    setCompareSet((prev) => {
      const next = new Set(prev);
      if (next.has(id)) { next.delete(id); } else { next.add(id); }
      return next;
    });
  };

  const handleReRun = () => {
    setReportRunning(true);
    setTimeout(() => setReportRunning(false), 2500);
  };

  const comparedProperties = SAVED_PROPERTIES.filter((p) => compareSet.has(p.id));

  return (
    <div>
      {compareSet.size >= 2 && (
        <div className="mb-2 flex items-center justify-between bg-indigo-50 rounded-lg px-3 py-2">
          <span className="text-xs text-indigo-800 font-medium">{compareSet.size} properties selected</span>
          <button
            onClick={() => setShowCompare(true)}
            className="px-3 py-1 bg-indigo-600 text-white rounded text-xs font-medium hover:bg-indigo-700 transition-colors"
          >
            Compare Selected
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 gap-2">
        {SAVED_PROPERTIES.map((prop) => (
          <div
            key={prop.id}
            className={`border rounded-lg p-3 hover:shadow-sm transition-all ${
              compareSet.has(prop.id) ? 'border-indigo-400 bg-indigo-50/30 ring-1 ring-indigo-200' : 'border-gray-200 bg-white'
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <label className="flex items-center cursor-pointer" onClick={(e) => e.stopPropagation()}>
                  <input
                    type="checkbox"
                    checked={compareSet.has(prop.id)}
                    onChange={() => toggleCompare(prop.id)}
                    className="h-3.5 w-3.5 text-indigo-600 rounded border-gray-300"
                  />
                </label>
                <span className="text-lg flex-shrink-0">{prop.image}</span>
                <div className="min-w-0">
                  <p className="font-semibold text-gray-900 text-xs leading-tight">{prop.name}</p>
                  <p className="text-xs text-gray-500 flex items-center gap-0.5">
                    <MapPin size={9} />
                    {prop.address}
                  </p>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <Badge color="purple">{prop.type}</Badge>
                    <RiskBadge level={prop.riskLevel} />
                    <span className="text-xs text-gray-400">{fmt(prop.value)}</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-1.5 flex-shrink-0 ml-2">
                <div className="text-right mr-1">
                  <p
                    className={`text-lg font-bold leading-none ${
                      prop.riskScore >= 75 ? 'text-red-600' : prop.riskScore >= 50 ? 'text-yellow-600' : 'text-green-600'
                    }`}
                  >
                    {prop.riskScore}
                  </p>
                  <p className="text-xs text-gray-400 leading-tight">risk</p>
                </div>
                <button
                  onClick={() => setSelectedReport(prop)}
                  className="flex items-center gap-1 px-2 py-1 bg-white border border-gray-200 rounded text-xs font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  <FileText size={11} /> Report
                </button>
                <button
                  onClick={() => {
                    setSelectedReport(prop);
                    setTimeout(handleReRun, 300);
                  }}
                  className="flex items-center gap-1 px-2 py-1 bg-indigo-600 text-white rounded text-xs font-medium hover:bg-indigo-700 transition-colors"
                >
                  <RefreshCw size={11} /> ReRun
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Risk Report Modal */}
      <RiskReportModal
        property={selectedReport}
        open={!!selectedReport}
        onClose={() => {
          setSelectedReport(null);
          setReportRunning(false);
        }}
        running={reportRunning}
        onReRun={handleReRun}
      />

      {/* Comparison Modal */}
      <Modal open={showCompare} onClose={() => setShowCompare(false)} title={`Property Comparison (${comparedProperties.length})`} wide>
        {comparedProperties.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2 px-3 text-gray-500 font-medium">Metric</th>
                  {comparedProperties.map((p) => (
                    <th key={p.id} className="text-left py-2 px-3 font-semibold text-gray-900">
                      <div className="flex items-center gap-1.5">
                        {p.image} {p.name}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[
                  { label: 'Type', key: 'type' as const },
                  { label: 'Address', key: 'address' as const },
                  { label: 'Property Value', key: 'value' as const, fmt: fmt },
                  { label: 'Square Feet', key: 'sqft' as const, fmt: (v: number) => v.toLocaleString() },
                  { label: 'Year Built', key: 'yearBuilt' as const },
                  { label: 'Risk Score', key: 'riskScore' as const, highlight: true },
                  { label: 'Risk Level', key: 'riskLevel' as const },
                  { label: 'Annual Premium', key: 'premium' as const, fmt: fmt },
                  { label: 'Coverage Limit', key: 'coverageAmount' as const, fmt: fmt },
                  { label: 'Carrier', key: 'carrier' as const },
                  { label: 'Flood Zone', key: 'floodZone' as const },
                  { label: 'Wind Score', key: 'windScore' as const, fmt: (v: number) => `${v}/5` },
                  { label: 'Fire Score', key: 'fireScore' as const, fmt: (v: number) => `${v}/5` },
                  { label: 'Crime Score', key: 'crimeScore' as const, fmt: (v: number) => `${v}/5` },
                  { label: 'Seismic Score', key: 'seismicScore' as const, fmt: (v: number) => `${v}/5` },
                  { label: 'Claims (12mo)', key: 'claims' as const },
                  { label: 'Last Inspection', key: 'lastInspection' as const },
                ].map((row) => {
                  const vals = comparedProperties.map((p) => p[row.key as keyof Property]);
                  const numVals = vals.map(Number).filter((n) => !isNaN(n));
                  const best =
                    row.key === 'riskScore' || row.key === 'claims'
                      ? Math.min(...numVals)
                      : row.key === 'value' || row.key === 'coverageAmount' || row.key === 'sqft'
                        ? Math.max(...numVals)
                        : null;

                  return (
                    <tr key={row.label} className="border-b last:border-0 hover:bg-gray-50">
                      <td className="py-1.5 px-3 text-gray-500 font-medium">{row.label}</td>
                      {comparedProperties.map((p) => {
                        const val = p[row.key as keyof Property];
                        const displayVal = row.fmt ? row.fmt(Number(val)) : String(val);
                        const isBest = best !== null && Number(val) === best && numVals.length > 1;
                        return (
                          <td
                            key={p.id}
                            className={`py-1.5 px-3 ${isBest ? 'text-green-700 font-semibold bg-green-50/50' : 'text-gray-900'}`}
                          >
                            {displayVal} {isBest && <span className="text-green-500 ml-0.5">★</span>}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Modal>
    </div>
  );
}

// ─── Panel: Active Carriers ───────────────────────────────────────────────────

function ActiveCarriersPanel() {
  const [quoteModal, setQuoteModal] = useState<Carrier | null>(null);
  const [quoteSent, setQuoteSent] = useState(new Set<number>());

  const handleSendQuote = (carrierId: number) => {
    setQuoteSent((prev) => new Set(prev).add(carrierId));
    setTimeout(() => setQuoteModal(null), 1500);
  };

  return (
    <div className="space-y-2">
      {ACTIVE_CARRIERS.map((carrier) => (
        <div key={carrier.id} className="border border-gray-200 rounded-lg p-2.5 hover:shadow-sm transition-all bg-white">
          <div className="flex items-start justify-between">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 mb-1">
                <span className="font-semibold text-xs text-gray-900">{carrier.name}</span>
                <Badge color="indigo">{carrier.rating}</Badge>
                <Badge color={carrier.appetite === 'Strong' ? 'green' : carrier.appetite === 'Moderate' ? 'yellow' : 'red'}>
                  {carrier.appetite}
                </Badge>
              </div>
              <div className="space-y-0.5">
                <p className="text-xs text-gray-500">
                  <span className="font-medium text-gray-700">Properties:</span> {carrier.properties.join(', ')}
                </p>
                <p className="text-xs text-gray-500">
                  <span className="font-medium text-gray-700">Clients:</span> {carrier.clients.join(', ')}
                </p>
                <div className="flex items-center gap-3 mt-0.5">
                  <span className="text-xs text-gray-500">
                    <span className="font-medium text-gray-700">Quote:</span> {carrier.quoteRange}
                  </span>
                  <span className="text-xs text-gray-500">
                    <span className="font-medium text-gray-700">Response:</span> {carrier.responseTime}
                  </span>
                </div>
              </div>
            </div>
            <div className="flex flex-col items-end gap-1.5 ml-2 flex-shrink-0">
              {carrier.bindingReady && <Badge color="green">Binding Ready</Badge>}
              <button
                onClick={() => setQuoteModal(carrier)}
                disabled={quoteSent.has(carrier.id)}
                className={`flex items-center gap-1 px-2 py-1 rounded text-xs font-medium transition-colors ${
                  quoteSent.has(carrier.id)
                    ? 'bg-green-100 text-green-700'
                    : 'bg-indigo-600 text-white hover:bg-indigo-700'
                }`}
              >
                {quoteSent.has(carrier.id) ? (
                  <>
                    <Check size={11} /> Sent
                  </>
                ) : (
                  <>
                    <Send size={11} /> Request Quote
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      ))}

      {/* Quote Confirmation Modal */}
      <Modal open={!!quoteModal} onClose={() => setQuoteModal(null)} title="Confirm Quote Request">
        {quoteModal && (
          <div className="space-y-3">
            <div className="bg-gray-50 rounded-lg p-3">
              <p className="text-xs text-gray-600 mb-2">You are about to send a potential binding offer request to:</p>
              <div className="space-y-1.5">
                <p className="font-semibold text-gray-900 text-sm">{quoteModal.name}</p>
                <div className="grid grid-cols-2 gap-1.5 text-xs">
                  <div>
                    <span className="text-gray-500">Rating:</span> <span className="font-medium">{quoteModal.rating}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Response:</span> <span className="font-medium">{quoteModal.responseTime}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Quote:</span> <span className="font-medium">{quoteModal.quoteRange}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Binding Ready:</span> <span className="font-medium">{quoteModal.bindingReady ? 'Yes' : 'No'}</span>
                  </div>
                </div>
              </div>
            </div>
            <div className="bg-blue-50 rounded-lg p-3">
              <p className="text-xs font-medium text-blue-900 mb-0.5">Properties & Clients:</p>
              {quoteModal.properties.map((prop, i) => (
                <p key={i} className="text-xs text-blue-800">
                  • {prop} — <span className="italic">{quoteModal.clients[i]}</span>
                </p>
              ))}
            </div>
            <div className="bg-yellow-50 rounded-lg p-2.5 border border-yellow-200">
              <p className="text-xs text-yellow-800">
                <span className="font-semibold">Important:</span> This will send binding offer details to {quoteModal.name}. They
                will respond within {quoteModal.responseTime}.
              </p>
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <button
                onClick={() => setQuoteModal(null)}
                className="px-3 py-1.5 bg-gray-100 text-gray-700 rounded text-xs font-medium hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => handleSendQuote(quoteModal.id)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 text-white rounded text-xs font-medium hover:bg-indigo-700 transition-colors"
              >
                <Send size={12} /> Send Binding Offer Request
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

// ─── Panel: KPI Metrics ───────────────────────────────────────────────────────

const KPI_HISTORY: Record<string, Array<{ period: string; value: number }>> = {
  'Total Premium (Monthly)': [
    { period: 'Nov', value: 172000 },
    { period: 'Dec', value: 178000 },
    { period: 'Jan', value: 181000 },
    { period: 'Feb', value: 184000 },
    { period: 'Mar', value: 187000 },
    { period: 'Apr', value: 190500 },
  ],
  'Loss Ratio': [
    { period: 'Nov', value: 8.1 },
    { period: 'Dec', value: 7.4 },
    { period: 'Jan', value: 7.9 },
    { period: 'Feb', value: 6.5 },
    { period: 'Mar', value: 7.2 },
    { period: 'Apr', value: 6.8 },
  ],
  'Active Properties': [
    { period: 'Nov', value: 38 },
    { period: 'Dec', value: 40 },
    { period: 'Jan', value: 42 },
    { period: 'Feb', value: 44 },
    { period: 'Mar', value: 45 },
    { period: 'Apr', value: 47 },
  ],
  'Avg Risk Score': [
    { period: 'Nov', value: 62 },
    { period: 'Dec', value: 60.5 },
    { period: 'Jan', value: 59.8 },
    { period: 'Feb', value: 59.1 },
    { period: 'Mar', value: 58.7 },
    { period: 'Apr', value: 58.2 },
  ],
};

const KPI_DETAILS: Record<string, KPIDetail> = {
  'Total Premium (Monthly)': {
    target: 200000,
    change: '+9.7%',
    breakdown: [
      { label: 'Commercial', value: 67000 },
      { label: 'Residential', value: 48000 },
      { label: 'Industrial', value: 45000 },
      { label: 'Retail', value: 18500 },
      { label: 'Office', value: 12000 },
    ],
  },
  'Loss Ratio': {
    target: 5.0,
    change: '-16.0%',
    breakdown: [
      { label: 'Wind/Weather', value: 3.2 },
      { label: 'Fire', value: 1.1 },
      { label: 'Theft', value: 1.5 },
      { label: 'Water Damage', value: 0.7 },
      { label: 'Other', value: 0.3 },
    ],
  },
  'Active Properties': {
    target: 55,
    change: '+23.7%',
    breakdown: [
      { label: 'Commercial', value: 16 },
      { label: 'Residential', value: 12 },
      { label: 'Industrial', value: 9 },
      { label: 'Retail', value: 6 },
      { label: 'Office', value: 4 },
    ],
  },
  'Avg Risk Score': {
    target: 50,
    change: '-6.1%',
    breakdown: [
      { label: 'Low (0-40)', value: 14 },
      { label: 'Low-Mod (41-55)', value: 12 },
      { label: 'Moderate (56-74)', value: 13 },
      { label: 'High (75-100)', value: 8 },
    ],
  },
};

function KPIPanel() {
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
            {/* Top stats row */}
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

            {/* Sparkline trend */}
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

            {/* Breakdown table */}
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

            {/* Progress to target */}
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

// ─── Panel: Forecast Chart ───────────────────────────────────────────────────

const FORECAST_EXTENDED: ForecastDataPoint[] = [
  { month: 'Jan', premium: 181000, claims: 14000, loss: 7.7, projected: 183000 },
  { month: 'Feb', premium: 184000, claims: 10000, loss: 5.4, projected: 186000 },
  { month: 'Mar', premium: 187000, claims: 16000, loss: 8.6, projected: 189000 },
  { month: 'Apr', premium: 190500, claims: 11000, loss: 5.8, projected: 192000 },
  ...FORECAST_DATA,
];

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

function ForecastPanel() {
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

// ─── Panel: Risk Trend ────────────────────────────────────────────────────────

const RISK_EXTENDED: RiskTrendDataPoint[] = [
  { month: "May'25", score: 68 },
  { month: 'Jun', score: 67 },
  { month: 'Jul', score: 65 },
  { month: 'Aug', score: 64 },
  { month: 'Sep', score: 63 },
  { month: 'Oct', score: 62 },
  ...RISK_TREND_DATA,
];

const RISK_ANNOTATIONS: Array<{ month: string; note: string }> = [
  { month: 'Jan', note: 'Metro sprinkler upgrade completed' },
  { month: 'Mar', note: 'Harborview claim #3 filed' },
];

function RiskTrendPanel() {
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
          if (e?.activeLabel) setSelectedPoint(e.activeLabel);
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

// ─── Panel: Portfolio Mix ─────────────────────────────────────────────────────

const PORTFOLIO_DETAILS: Record<string, { count: number; avgRisk: number; totalPremium: number; topProperty: string; growth: string }> = {
  Commercial: { count: 16, avgRisk: 54, totalPremium: 67000, topProperty: 'Oakwood Commercial Plaza', growth: '+12%' },
  Residential: { count: 12, avgRisk: 52, totalPremium: 48000, topProperty: 'Riverside Apartment Complex', growth: '+8%' },
  Industrial: { count: 9, avgRisk: 41, totalPremium: 45000, topProperty: 'Metro Distribution Center', growth: '+18%' },
  Retail: { count: 6, avgRisk: 71, totalPremium: 18500, topProperty: 'Harborview Retail Strip', growth: '-3%' },
  Office: { count: 4, avgRisk: 37, totalPremium: 12000, topProperty: 'Summit Office Tower', growth: '+22%' },
};

function PortfolioMixPanel() {
  const [activeSegment, setActiveSegment] = useState<number | null>(null);
  const [showDetail, setShowDetail] = useState<string | null>(null);

  const detail = showDetail ? PORTFOLIO_DETAILS[showDetail] : null;

  return (
    <div>
      <div className="flex items-center gap-2">
        <ResponsiveContainer width="50%" height={150}>
          <PieChart>
            <Pie
              data={PORTFOLIO_MIX}
              dataKey="value"
              nameKey="name"
              cx="50%"
              cy="50%"
              innerRadius={30}
              outerRadius={activeSegment !== null ? 62 : 55}
              paddingAngle={3}
              onMouseEnter={(_, idx) => setActiveSegment(idx)}
              onMouseLeave={() => setActiveSegment(null)}
              onClick={(_, idx) => setShowDetail(PORTFOLIO_MIX[idx].name)}
              style={{ cursor: 'pointer' }}
            >
              {PORTFOLIO_MIX.map((entry, idx) => (
                <Cell
                  key={idx}
                  fill={entry.color}
                  opacity={activeSegment !== null && activeSegment !== idx ? 0.4 : 1}
                  stroke={activeSegment === idx ? entry.color : 'none'}
                  strokeWidth={activeSegment === idx ? 2 : 0}
                />
              ))}
            </Pie>
            <Tooltip formatter={(v) => `${v}%`} />
          </PieChart>
        </ResponsiveContainer>
        <div className="space-y-1 text-xs flex-1">
          {PORTFOLIO_MIX.map((seg, idx) => (
            <div
              key={seg.name}
              className={`flex items-center gap-1.5 px-1.5 py-0.5 rounded cursor-pointer transition-colors ${
                activeSegment === idx ? 'bg-gray-100' : 'hover:bg-gray-50'
              }`}
              onMouseEnter={() => setActiveSegment(idx)}
              onMouseLeave={() => setActiveSegment(null)}
              onClick={() => setShowDetail(seg.name)}
            >
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
                <p className={`text-lg font-bold ${detail.avgRisk >= 60 ? 'text-yellow-600' : 'text-green-600'}`}>
                  {detail.avgRisk}
                </p>
              </div>
              <div className="bg-gray-50 rounded-lg p-2.5 text-center">
                <p className="text-xs text-gray-500">Monthly Premium</p>
                <p className="text-lg font-bold text-gray-900">{fmt(detail.totalPremium)}</p>
              </div>
            </div>
            <div className="bg-gray-50 rounded-lg p-2.5 text-xs space-y-1">
              <p>
                <span className="text-gray-500">Top Property:</span> <span className="font-medium text-gray-900">{detail.topProperty}</span>
              </p>
              <p>
                <span className="text-gray-500">Growth (YoY):</span>{' '}
                <span className={`font-semibold ${detail.growth.startsWith('+') ? 'text-green-600' : 'text-red-600'}`}>
                  {detail.growth}
                </span>
              </p>
            </div>
            <div>
              <h4 className="text-xs font-semibold text-gray-900 mb-1.5">Segment Share</h4>
              <div className="bg-gray-100 rounded-full h-3 flex overflow-hidden">
                {PORTFOLIO_MIX.map((seg) => (
                  <div
                    key={seg.name}
                    className="h-3 transition-all"
                    style={{
                      width: `${seg.value}%`,
                      backgroundColor: seg.color,
                      opacity: seg.name === showDetail ? 1 : 0.25,
                    }}
                  />
                ))}
              </div>
              <p className="text-xs text-gray-500 mt-1 text-center">
                {showDetail}: {PORTFOLIO_MIX.find((s) => s.name === showDetail)?.value}% of portfolio
              </p>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

// ─── Panel: Client Management ─────────────────────────────────────────────────

function ClientManagementPanel() {
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const statusColors: Record<string, BadgeProps['color']> = { Active: 'green', 'At Risk': 'red', Prospect: 'yellow' };

  return (
    <div className="space-y-2">
      {CLIENTS.map((client) => (
        <div
          key={client.id}
          className="border border-gray-200 rounded-lg p-2.5 hover:shadow-sm transition-all bg-white cursor-pointer"
          onClick={() => setSelectedClient(selectedClient?.id === client.id ? null : client)}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <div className="w-7 h-7 rounded-full bg-indigo-100 flex items-center justify-center flex-shrink-0">
                <span className="text-xs font-bold text-indigo-600">{client.name.charAt(0)}</span>
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <p className="font-semibold text-xs text-gray-900">{client.name}</p>
                  <Badge color={statusColors[client.status]}>{client.status}</Badge>
                </div>
                <p className="text-xs text-gray-500">
                  {client.contact} · {client.properties} property · {fmt(client.totalValue)}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <span className="text-xs text-gray-400">{client.lastContact}</span>
              {selectedClient?.id === client.id ? (
                <ChevronUp size={12} className="text-gray-400" />
              ) : (
                <ChevronDown size={12} className="text-gray-400" />
              )}
            </div>
          </div>
          {selectedClient?.id === client.id && (
            <div className="mt-2 pt-2 border-t border-gray-100 grid grid-cols-2 gap-2 text-xs">
              <div>
                <span className="text-gray-500">Email:</span> <span className="font-medium text-gray-900">{client.email}</span>
              </div>
              <div>
                <span className="text-gray-500">Phone:</span> <span className="font-medium text-gray-900">{client.phone}</span>
              </div>
              <div className="col-span-2">
                <span className="text-gray-500">Notes:</span> <span className="font-medium text-gray-900">{client.notes}</span>
              </div>
              <div className="col-span-2 flex gap-1.5 mt-1">
                <button className="px-2 py-1 bg-indigo-600 text-white rounded text-xs font-medium hover:bg-indigo-700">
                  Send Message
                </button>
                <button className="px-2 py-1 bg-white border border-gray-200 text-gray-700 rounded text-xs font-medium hover:bg-gray-50">
                  View Properties
                </button>
                <button className="px-2 py-1 bg-white border border-gray-200 text-gray-700 rounded text-xs font-medium hover:bg-gray-50">
                  Schedule Call
                </button>
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ─── Panel: Home Buyer — Agent Interaction ────────────────────────────────────

function HomeBuyerAgentPanel() {
  const [newMsg, setNewMsg] = useState('');
  const [messages, setMessages] = useState<Message[]>(MESSAGES);

  const handleSend = () => {
    if (!newMsg.trim()) return;
    setMessages((prev) => [
      ...prev,
      {
        id: prev.length + 1,
        from: 'buyer',
        name: 'You',
        text: newMsg,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      },
    ]);
    setNewMsg('');
  };

  return (
    <div className="flex flex-col" style={{ height: 280 }}>
      <div className="flex-1 overflow-y-auto space-y-2 mb-2 pr-1">
        {messages.map((msg) => (
          <div key={msg.id} className={`flex ${msg.from === 'buyer' ? 'justify-end' : 'justify-start'}`}>
            <div
              className={`max-w-xs rounded-lg px-2.5 py-1.5 ${
                msg.from === 'buyer' ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-900'
              }`}
            >
              <p className={`text-xs font-medium mb-0.5 ${msg.from === 'buyer' ? 'text-indigo-200' : 'text-gray-500'}`}>
                {msg.name}
              </p>
              <p className="text-xs leading-relaxed">{msg.text}</p>
              <p className={`text-xs mt-0.5 ${msg.from === 'buyer' ? 'text-indigo-300' : 'text-gray-400'}`}>{msg.time}</p>
            </div>
          </div>
        ))}
      </div>
      <div className="flex gap-1.5 border-t pt-2">
        <input
          type="text"
          value={newMsg}
          onChange={(e) => setNewMsg(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSend()}
          placeholder="Message your agent..."
          className="flex-1 px-2.5 py-1.5 border border-gray-200 rounded text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
        />
        <button
          onClick={handleSend}
          className="px-2.5 py-1.5 bg-indigo-600 text-white rounded text-xs font-medium hover:bg-indigo-700 transition-colors"
        >
          <Send size={12} />
        </button>
      </div>
    </div>
  );
}

// ─── Panel Layout Configuration ───────────────────────────────────────────────

const DEFAULT_LAYOUT: PanelConfig[] = [
  { id: 'insights', title: 'Insights', icon: Brain, order: 0, visible: true, span: 'full' },
  { id: 'kpis', title: 'Key Metrics', icon: BarChart3, order: 1, visible: true, span: 'full' },
  { id: 'clients', title: 'Client Management', icon: Building2, order: 2, visible: true, span: 'full' },
  { id: 'properties', title: 'Saved Properties', icon: Home, order: 3, visible: true, span: 'full' },
  { id: 'carriers', title: 'Active Carriers for Your Properties', icon: Shield, order: 4, visible: true, span: 'full' },
  { id: 'agentchat', title: 'Your Agent', icon: Send, order: 5, visible: true, span: 'third' },
  { id: 'forecast', title: 'Premium Forecast', icon: TrendingUp, order: 6, visible: true, span: 'third' },
  { id: 'risktrend', title: 'Risk Trend', icon: Activity, order: 7, visible: true, span: 'third' },
  { id: 'portfolio', title: 'Portfolio Mix', icon: Layers, order: 8, visible: true, span: 'third' },
];

const PANEL_COMPONENTS: Record<string, () => JSX.Element> = {
  insights: InsightsPanel,
  kpis: KPIPanel,
  clients: ClientManagementPanel,
  properties: SavedPropertiesPanel,
  carriers: ActiveCarriersPanel,
  agentchat: HomeBuyerAgentPanel,
  forecast: ForecastPanel,
  risktrend: RiskTrendPanel,
  portfolio: PortfolioMixPanel,
};

// ─── Main Dashboard Component ─────────────────────────────────────────────────

export function EnhancedDashboard() {
  const [layout, setLayout] = useState<PanelConfig[]>(DEFAULT_LAYOUT);
  const [showCustomize, setShowCustomize] = useState(false);
  const [dragItem, setDragItem] = useState<number | null>(null);

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

  const cycleSpan = (id: string) => {
    const order: Array<'full' | 'half' | 'third'> = ['full', 'half', 'third'];
    setLayout((prev) =>
      prev.map((p) => {
        if (p.id !== id) return p;
        const idx = order.indexOf(p.span);
        return { ...p, span: order[(idx + 1) % order.length] };
      })
    );
  };

  const resetLayout = () => setLayout(DEFAULT_LAYOUT);

  const visiblePanels = layout.filter((p) => p.visible).sort((a, b) => a.order - b.order);

  // Group panels into rows
  const rows: PanelConfig[][] = [];
  let currentRow: PanelConfig[] = [];
  let currentRowMax = 0;

  visiblePanels.forEach((panel) => {
    if (panel.span === 'full') {
      if (currentRow.length > 0) {
        rows.push(currentRow);
        currentRow = [];
        currentRowMax = 0;
      }
      rows.push([panel]);
    } else {
      const targetCols = panel.span === 'third' ? 3 : 2;
      if (currentRow.length > 0 && (currentRowMax !== targetCols || currentRow.length >= currentRowMax)) {
        rows.push(currentRow);
        currentRow = [];
        currentRowMax = 0;
      }
      currentRowMax = targetCols;
      currentRow.push(panel);
      if (currentRow.length >= currentRowMax) {
        rows.push(currentRow);
        currentRow = [];
        currentRowMax = 0;
      }
    }
  });
  if (currentRow.length > 0) rows.push(currentRow);

  const gridClass = (row: PanelConfig[]): string => {
    if (row.length === 1 && row[0].span === 'full') return 'grid-cols-1';
    if (row.length === 3 || row[0]?.span === 'third') return 'grid-cols-3';
    if (row.length === 2) return 'grid-cols-2';
    return 'grid-cols-1';
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
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
          <button
            onClick={() => setShowCustomize(!showCustomize)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-xs font-medium text-gray-700 hover:bg-gray-50 transition-colors shadow-sm"
          >
            <Settings size={13} />
            Customize
          </button>
        </div>
      </header>

      {/* Customize Drawer */}
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
                    onClick={() => cycleSpan(panel.id)}
                    className="text-xs px-1.5 py-px rounded bg-white border border-gray-200 text-gray-600 hover:bg-gray-100"
                  >
                    {panel.span === 'full' ? 'Full' : panel.span === 'half' ? '½' : '⅓'}
                  </button>
                  <button
                    onClick={() => toggleVisibility(panel.id)}
                    className={`text-xs px-1.5 py-px rounded font-medium ${
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

      {/* Dashboard Body */}
      <main className="max-w-7xl mx-auto px-4 py-3 space-y-2.5">
        {rows.map((row, rowIdx) => (
          <div key={rowIdx} className={`grid gap-2.5 ${gridClass(row)}`}>
            {row.map((panel) => {
              const PanelComponent = PANEL_COMPONENTS[panel.id];
              if (!PanelComponent) return null;
              return (
                <div key={panel.id} className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden">
                  <div className="flex items-center justify-between px-3 py-2 border-b border-gray-100 bg-gray-50/50">
                    <div className="flex items-center gap-1.5">
                      <panel.icon size={13} className="text-indigo-600" />
                      <h2 className="text-xs font-semibold text-gray-900">{panel.title}</h2>
                    </div>
                    {(panel.id === 'kpis' || panel.id === 'forecast') && (
                      <div className="flex items-center gap-1">
                        <LiveDot />
                        <span className="text-xs text-gray-400">Live</span>
                      </div>
                    )}
                  </div>
                  <div className="p-3">
                    <PanelComponent />
                  </div>
                </div>
              );
            })}
          </div>
        ))}
      </main>

      {/* Footer */}
      <footer className="max-w-7xl mx-auto px-4 py-2 text-center">
        <p className="text-xs text-gray-400">
          Last synced: {new Date().toLocaleString()} · Auto-refresh active
        </p>
      </footer>
    </div>
  );
}
