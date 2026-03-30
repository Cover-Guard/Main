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

export interface SavedProperty {
  id: string
  userId: string
  propertyId: string
  clientId: string | null
  notes: string | null
  tags: string[]
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

// ─── Risk Alerts ────────────────────────────────────────────────────────────

export type RiskAlertType = 'RISK_INCREASED' | 'RISK_DECREASED' | 'NEW_RISK_FACTOR' | 'ZONE_CHANGE'
export type RiskAlertSeverity = 'LOW' | 'MODERATE' | 'HIGH' | 'CRITICAL'
export type RiskCategory = 'OVERALL' | 'FLOOD' | 'FIRE' | 'WIND' | 'EARTHQUAKE' | 'CRIME'

export interface RiskAlert {
  id: string
  userId: string
  propertyId: string
  alertType: RiskAlertType
  severity: RiskAlertSeverity
  title: string
  message: string
  previousRiskLevel: string | null
  newRiskLevel: string | null
  riskCategory: RiskCategory | null
  isRead: boolean
  createdAt: string
  property?: {
    address: string
    city: string
    state: string
  }
}

export interface RiskAlertPreferences {
  riskAlertEnabled: boolean
  riskAlertThreshold: string
}

// ─── Shared Property Links ──────────────────────────────────────────────────

export interface SharedPropertyLink {
  id: string
  agentId: string
  propertyId: string
  clientId: string | null
  accessToken: string
  includeRisk: boolean
  includeInsurance: boolean
  includeCarriers: boolean
  expiresAt: string
  viewCount: number
  maxViews: number | null
  isActive: boolean
  createdAt: string
  property?: {
    address: string
    city: string
    state: string
    zip: string
  }
}

// ─── Quote Request (enhanced for tracking) ──────────────────────────────────

export interface QuoteRequestDetail {
  id: string
  userId: string
  propertyId: string
  carrierId: string
  coverageTypes: string[]
  notes: string | null
  status: QuoteRequestStatus
  submittedAt: string
  updatedAt: string
  property?: {
    address: string
    city: string
    state: string
    zip: string
    estimatedValue: number | null
  }
}

export type QuoteRequestStatus = 'PENDING' | 'SENT' | 'RESPONDED' | 'DECLINED'

// ─── Lender Types ───────────────────────────────────────────────────────────

export interface LenderPortfolioSummary {
  totalProperties: number
  avgRiskScore: number
  highRiskCount: number
  totalEstimatedValue: number
  avgInsuranceCost: number | null
  riskDistribution: Array<{ level: string; count: number }>
  propertiesByState: Array<{ state: string; count: number; avgRisk: number }>
  loanEligibility: {
    eligible: number
    conditional: number
    ineligible: number
  }
}

export interface LenderPropertyRow {
  propertyId: string
  address: string
  city: string
  state: string
  zip: string
  estimatedValue: number | null
  overallRiskLevel: string | null
  overallRiskScore: number | null
  floodZone: string | null
  inSFHA: boolean
  insuranceRequired: boolean
  loanEligibility: 'ELIGIBLE' | 'CONDITIONAL' | 'INELIGIBLE'
  flags: string[]
  savedAt: string
}

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
