import type { LucideIcon } from 'lucide-react';

export interface Carrier {
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

export interface ForecastDataPoint {
  month: string;
  premium: number;
  claims: number;
  loss: number;
  projected: number;
}

export interface RiskTrendDataPoint {
  month: string;
  score: number;
}

export interface PortfolioSegment {
  name: string;
  value: number;
  color: string;
}

export interface Insight {
  id: number;
  type: string;
  icon: string;
  title: string;
  body: string;
  time: string;
  priority: 'high' | 'medium' | 'low';
}

export interface Client {
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

export interface Message {
  id: number;
  from: 'agent' | 'buyer';
  name: string;
  text: string;
  time: string;
}

export interface KPI {
  label: string;
  value: string;
  raw: number;
  dir: 'up' | 'down';
  icon: LucideIcon;
  color: string;
  bg: string;
  chartColor: string;
}

export interface KPIDetail {
  target: number;
  change: string;
  breakdown: Array<{ label: string; value: number }>;
}

export interface PanelConfig {
  id: string;
  title: string;
  icon: LucideIcon;
  order: number;
  visible: boolean;
  span: 'full' | 'half' | 'third';
}
