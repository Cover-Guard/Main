import type {
  Carrier,
  Client,
  ForecastDataPoint,
  Insight,
  KPIDetail,
  Message,
  PortfolioSegment,
  RiskTrendDataPoint,
} from './types';

export const ACTIVE_CARRIERS: Carrier[] = [
  { id: 1, name: 'Hartford Financial', properties: ['Oakwood Commercial Plaza'], clients: ['Oakwood LLC'], rating: 'A+', specialty: 'Commercial Property', quoteRange: '$16,000 - $21,000', responseTime: '24-48 hrs', bindingReady: true, appetite: 'Strong' },
  { id: 2, name: 'Zurich Insurance', properties: ['Riverside Apartment Complex'], clients: ['River Holdings Inc.'], rating: 'AA-', specialty: 'Multi-Family Residential', quoteRange: '$28,000 - $36,000', responseTime: '48-72 hrs', bindingReady: true, appetite: 'Moderate' },
  { id: 3, name: 'Chubb Limited', properties: ['Metro Distribution Center', 'Summit Office Tower'], clients: ['Metro Logistics Corp', 'Summit Capital Group'], rating: 'AA', specialty: 'Industrial & Office', quoteRange: '$40,000 - $72,000', responseTime: '24 hrs', bindingReady: true, appetite: 'Strong' },
  { id: 4, name: 'AIG', properties: ['Harborview Retail Strip'], clients: ['Harbor Retail Partners'], rating: 'A', specialty: 'Coastal Property', quoteRange: '$24,000 - $32,000', responseTime: '72 hrs', bindingReady: false, appetite: 'Cautious' },
  { id: 5, name: 'Liberty Mutual', properties: ['Summit Office Tower'], clients: ['Summit Capital Group'], rating: 'A', specialty: 'High-Value Office', quoteRange: '$58,000 - $75,000', responseTime: '48 hrs', bindingReady: true, appetite: 'Strong' },
  { id: 6, name: 'Travelers', properties: ['Oakwood Commercial Plaza', 'Riverside Apartment Complex'], clients: ['Oakwood LLC', 'River Holdings Inc.'], rating: 'AA-', specialty: 'Multi-Line Commercial', quoteRange: '$15,000 - $34,000', responseTime: '24-48 hrs', bindingReady: true, appetite: 'Strong' },
];

export const FORECAST_DATA: ForecastDataPoint[] = [
  { month: 'May', premium: 191000, claims: 12000, loss: 6.3, projected: 195000 },
  { month: 'Jun', premium: 195000, claims: 18000, loss: 9.2, projected: 198000 },
  { month: 'Jul', premium: 198000, claims: 22000, loss: 11.1, projected: 202000 },
  { month: 'Aug', premium: 202000, claims: 15000, loss: 7.4, projected: 207000 },
  { month: 'Sep', premium: 207000, claims: 9000, loss: 4.3, projected: 210000 },
  { month: 'Oct', premium: 210000, claims: 11000, loss: 5.2, projected: 215000 },
];

export const FORECAST_EXTENDED: ForecastDataPoint[] = [
  { month: 'Jan', premium: 181000, claims: 14000, loss: 7.7, projected: 183000 },
  { month: 'Feb', premium: 184000, claims: 10000, loss: 5.4, projected: 186000 },
  { month: 'Mar', premium: 187000, claims: 16000, loss: 8.6, projected: 189000 },
  { month: 'Apr', premium: 190500, claims: 11000, loss: 5.8, projected: 192000 },
  ...FORECAST_DATA,
];

export const RISK_TREND_DATA: RiskTrendDataPoint[] = [
  { month: 'Nov', score: 62 },
  { month: 'Dec', score: 58 },
  { month: 'Jan', score: 55 },
  { month: 'Feb', score: 52 },
  { month: 'Mar', score: 54 },
  { month: 'Apr', score: 51 },
];

export const RISK_EXTENDED: RiskTrendDataPoint[] = [
  { month: "May'25", score: 68 },
  { month: 'Jun', score: 67 },
  { month: 'Jul', score: 65 },
  { month: 'Aug', score: 64 },
  { month: 'Sep', score: 63 },
  { month: 'Oct', score: 62 },
  ...RISK_TREND_DATA,
];

export const RISK_ANNOTATIONS: Array<{ month: string; note: string }> = [
  { month: 'Jan', note: 'Metro sprinkler upgrade completed' },
  { month: 'Mar', note: 'Harborview claim #3 filed' },
];

export const PORTFOLIO_MIX: PortfolioSegment[] = [
  { name: 'Commercial', value: 35, color: '#6366f1' },
  { name: 'Residential', value: 25, color: '#8b5cf6' },
  { name: 'Industrial', value: 20, color: '#a78bfa' },
  { name: 'Retail', value: 12, color: '#c4b5fd' },
  { name: 'Office', value: 8, color: '#ddd6fe' },
];

export const PORTFOLIO_DETAILS: Record<string, { count: number; avgRisk: number; totalPremium: number; topProperty: string; growth: string }> = {
  Commercial: { count: 16, avgRisk: 54, totalPremium: 67000, topProperty: 'Oakwood Commercial Plaza', growth: '+12%' },
  Residential: { count: 12, avgRisk: 52, totalPremium: 48000, topProperty: 'Riverside Apartment Complex', growth: '+8%' },
  Industrial: { count: 9, avgRisk: 41, totalPremium: 45000, topProperty: 'Metro Distribution Center', growth: '+18%' },
  Retail: { count: 6, avgRisk: 71, totalPremium: 18500, topProperty: 'Harborview Retail Strip', growth: '-3%' },
  Office: { count: 4, avgRisk: 37, totalPremium: 12000, topProperty: 'Summit Office Tower', growth: '+22%' },
};

export const INSIGHTS: Insight[] = [
  { id: 1, type: 'alert', icon: '⚠️', title: 'High Wind Exposure — Harborview Retail Strip', body: 'Hurricane season begins June 1. Current wind score of 5/5 combined with VE flood zone puts this property at elevated risk. Consider requesting updated wind mitigation credits from AIG or exploring excess flood coverage.', time: '2 hrs ago', priority: 'high' },
  { id: 2, type: 'opportunity', icon: '💡', title: 'Bundle Discount Available — Oakwood + Riverside via Travelers', body: 'Travelers has appetite for both Oakwood Commercial Plaza (Oakwood LLC) and Riverside Apartment Complex (River Holdings Inc.). Bundling could reduce combined premiums by 12-15%, saving approximately $7,500/year.', time: '4 hrs ago', priority: 'medium' },
  { id: 3, type: 'trend', icon: '📈', title: 'Portfolio Risk Score Improving', body: 'Your aggregate risk score has decreased from 62 to 51 over the past 6 months. Key drivers: Metro Distribution Center\'s new sprinkler system and Summit Office Tower\'s updated security infrastructure. Continue momentum by scheduling Harborview inspection.', time: '1 day ago', priority: 'low' },
  { id: 4, type: 'renewal', icon: '🔄', title: 'Upcoming Renewal — Oakwood Commercial Plaza (Hartford)', body: 'Policy renewal due in 45 days. Current premium: $18,500. Market conditions suggest 3-5% increase. Recommend requesting competitive quotes from Travelers and Chubb to leverage at renewal.', time: '1 day ago', priority: 'medium' },
  { id: 5, type: 'forecast', icon: '🔮', title: 'Q3 Premium Forecast: +4.2% Growth', body: 'Based on current pipeline and renewal schedule, projected Q3 premium volume will reach $607,000, up from $583,000 in Q2. Two new prospect properties in underwriting could add an additional $35,000.', time: '3 hrs ago', priority: 'low' },
];

export const CLIENTS: Client[] = [
  { id: 1, name: 'Oakwood LLC', contact: 'Marcus Chen', email: 'm.chen@oakwood.com', phone: '(512) 555-0142', properties: 1, totalValue: 4200000, status: 'Active', lastContact: 'Apr 10, 2026', notes: 'Renewal coming up in 45 days' },
  { id: 2, name: 'River Holdings Inc.', contact: 'Sarah Palmer', email: 's.palmer@riverholdings.com', phone: '(503) 555-0198', properties: 1, totalValue: 8500000, status: 'Active', lastContact: 'Apr 8, 2026', notes: 'Interested in bundling with Travelers' },
  { id: 3, name: 'Metro Logistics Corp', contact: 'James Whitfield', email: 'j.whitfield@metrologistics.com', phone: '(214) 555-0211', properties: 1, totalValue: 12000000, status: 'Active', lastContact: 'Apr 12, 2026', notes: 'Expanding warehouse — may need coverage update' },
  { id: 4, name: 'Harbor Retail Partners', contact: 'Diana Reyes', email: 'd.reyes@harborretail.com', phone: '(305) 555-0177', properties: 1, totalValue: 3800000, status: 'At Risk', lastContact: 'Mar 28, 2026', notes: 'Concerned about premium increase after 3 claims' },
  { id: 5, name: 'Summit Capital Group', contact: 'Robert Kline', email: 'r.kline@summitcap.com', phone: '(312) 555-0165', properties: 1, totalValue: 22000000, status: 'Active', lastContact: 'Apr 11, 2026', notes: 'High-value client, very satisfied with Chubb coverage' },
];

export const MESSAGES: Message[] = [
  { id: 1, from: 'agent', name: 'Your Agent', text: 'Hi John! I\'ve reviewed the risk report for the Oakwood property. The moderate risk score of 72 is mainly driven by the crime index in that area. I\'d recommend Hartford or Travelers for coverage.', time: '10:15 AM' },
  { id: 2, from: 'buyer', name: 'You', text: 'Thanks! What\'s the premium looking like for Hartford?', time: '10:22 AM' },
  { id: 3, from: 'agent', name: 'Your Agent', text: 'Hartford is quoting $16K-$21K annually for $5M coverage. I can request a formal binding offer if you\'d like to proceed. Travelers may also be competitive — want me to get quotes from both?', time: '10:25 AM' },
  { id: 4, from: 'buyer', name: 'You', text: 'Yes, let\'s get both. Also, can you send over the full risk report?', time: '10:30 AM' },
  { id: 5, from: 'agent', name: 'Your Agent', text: 'Absolutely! I\'ve attached the risk report to your Saved Properties. You can view it anytime by clicking Report on the property card. I\'ll get those quotes out today.', time: '10:32 AM' },
];

export const KPI_HISTORY: Record<string, Array<{ period: string; value: number }>> = {
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

export const KPI_DETAILS: Record<string, KPIDetail> = {
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
