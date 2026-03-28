export type UserRole = 'BUYER' | 'AGENT' | 'LENDER' | 'ADMIN'

export interface User {
  id: string
  email: string
  firstName: string
  lastName: string
  role: UserRole
  company: string | null
  licenseNumber: string | null // for agents
  avatarUrl: string | null
  stripeCustomerId: string | null
  termsAcceptedAt: string | null // null = onboarding not yet completed
  ndaAcceptedAt: string | null
  privacyAcceptedAt: string | null
  createdAt: string
  updatedAt: string
}

export type PropertyPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT'

export interface SavedProperty {
  id: string
  userId: string
  propertyId: string
  clientId: string | null
  notes: string | null
  tags: string[]
  rating: number | null    // 1-5 star rating
  priority: PropertyPriority | null
  savedAt: string
}

export interface PropertyReport {
  id: string
  userId: string
  propertyId: string
  reportType: ReportType
  generatedAt: string
  pdfUrl: string | null
}

export type ReportType = 'FULL' | 'RISK_SUMMARY' | 'INSURANCE_ESTIMATE'

// ─── Property Report Checklists ──────────────────────────────────────────────

export type ChecklistType = 'INSPECTION' | 'NEW_BUYER' | 'AGENT'

export interface ChecklistItem {
  id: string
  label: string
  checked: boolean
}

export interface PropertyChecklist {
  id: string
  userId: string
  propertyId: string
  checklistType: ChecklistType
  title: string
  items: ChecklistItem[]
  createdAt: string
  updatedAt: string
}

export interface Client {
  id: string
  agentId: string
  firstName: string
  lastName: string
  email: string
  phone: string | null
  notes: string | null
  status: ClientStatus
  createdAt: string
  updatedAt: string
  savedPropertyCount?: number
}

export type ClientStatus = 'ACTIVE' | 'PROSPECT' | 'CLOSED' | 'INACTIVE'

// ─── Property Notes Timeline ────────────────────────────────────────────────

export interface PropertyNote {
  id: string
  userId: string
  propertyId: string
  content: string
  createdAt: string
  updatedAt: string
}

// ─── Risk Alerts ────────────────────────────────────────────────────────────

export type AlertFrequency = 'IMMEDIATE' | 'DAILY' | 'WEEKLY'

export type RiskType = 'FLOOD' | 'FIRE' | 'WIND' | 'EARTHQUAKE' | 'CRIME'

export interface RiskAlert {
  id: string
  userId: string
  propertyId: string
  enabled: boolean
  frequency: AlertFrequency
  riskTypes: RiskType[]
  lastNotifiedAt: string | null
  lastRiskScore: number | null
  createdAt: string
  updatedAt: string
}

// ─── Shared Reports (Agent → Client) ────────────────────────────────────────

export interface SharedReport {
  id: string
  agentId: string
  propertyId: string
  clientId: string | null
  shareToken: string
  recipientEmail: string | null
  recipientName: string | null
  message: string | null
  includeRisk: boolean
  includeInsurance: boolean
  includeCarriers: boolean
  viewCount: number
  expiresAt: string | null
  createdAt: string
  shareUrl?: string  // computed by API
}

// ─── Lender Portfolio Summary ───────────────────────────────────────────────

export interface LenderPortfolioSummary {
  totalProperties: number
  totalEstimatedValue: number
  avgOverallRiskScore: number
  riskDistribution: Array<{ level: string; count: number }>
  avgInsuranceCost: number | null
  highRiskProperties: Array<{
    propertyId: string
    address: string
    city: string
    state: string
    estimatedValue: number | null
    overallRiskScore: number
    overallRiskLevel: string
  }>
  riskByPeril: {
    avgFloodScore: number
    avgFireScore: number
    avgWindScore: number
    avgEarthquakeScore: number
    avgCrimeScore: number
  }
  stateExposure: Array<{
    state: string
    count: number
    totalValue: number
    avgRiskScore: number
  }>
}

// ─── Analytics ──────────────────────────────────────────────────────────────

export interface AnalyticsSummary {
  totalSearches: number
  totalSavedProperties: number
  totalClients: number
  totalReports: number
  searchesByDay: Array<{ date: string; count: number }>
  riskDistribution: Array<{ level: string; count: number }>
  topStates: Array<{ state: string; count: number }>
  recentActivity: Array<{ type: string; description: string; timestamp: string }>

  // Quote request metrics
  quoteRequests: {
    total: number
    pending: number
    sent: number
    responded: number
    declined: number
  }

  // Client pipeline breakdown
  clientPipeline: {
    active: number
    prospect: number
    closed: number
    inactive: number
  }

  // Regional risk data (per state)
  regionalRisk: Array<{
    state: string
    propertyCount: number
    avgOverallScore: number
    avgFloodScore: number
    avgFireScore: number
    avgWindScore: number
    avgEarthquakeScore: number
    avgCrimeScore: number
    dominantRiskLevel: string
  }>

  // Searches by month (12 months)
  searchesByMonth: Array<{ month: string; count: number }>

  // Average insurance cost across saved properties
  avgInsuranceCost: number | null
}
