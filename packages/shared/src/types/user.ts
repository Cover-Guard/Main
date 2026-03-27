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
  termsAcceptedAt: string | null // null = onboarding not yet completed
  createdAt: string
  updatedAt: string
}

export interface SavedProperty {
  id: string
  userId: string
  propertyId: string
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
