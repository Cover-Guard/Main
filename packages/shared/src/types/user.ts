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
}

// ─── Quote Request ───────────────────────────────────────────────────────────

export type QuoteRequestStatus = 'PENDING' | 'SENT' | 'RESPONDED' | 'DECLINED'

export interface QuoteRequest {
  id: string
  userId: string
  propertyId: string
  carrierId: string
  carrierName: string | null
  coverageTypes: string[]
  notes: string | null
  status: QuoteRequestStatus
  statusNote: string | null
  submittedAt: string
  updatedAt: string
  property?: import('./property').Property
}

// ─── Activity Log ────────────────────────────────────────────────────────────

export type ActivityType = 'NOTE' | 'CALL' | 'EMAIL' | 'MEETING' | 'VIEWING' | 'QUOTE_SENT' | 'FOLLOW_UP' | 'STATUS_CHANGE'

export interface PropertyActivityLogEntry {
  id: string
  userId: string
  propertyId: string
  clientId: string | null
  activityType: ActivityType
  title: string
  description: string | null
  createdAt: string
  property?: import('./property').Property
  client?: Pick<Client, 'id' | 'firstName' | 'lastName'>
}

// ─── Client Property Recommendation ─────────────────────────────────────────

export type RecommendationPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT'
export type RecommendationStatus = 'PENDING' | 'VIEWED' | 'INTERESTED' | 'NOT_INTERESTED' | 'QUOTE_REQUESTED'

export interface ClientPropertyRecommendation {
  id: string
  agentId: string
  clientId: string
  propertyId: string
  priority: RecommendationPriority
  status: RecommendationStatus
  notes: string | null
  createdAt: string
  updatedAt: string
  property?: import('./property').Property
  client?: Pick<Client, 'id' | 'firstName' | 'lastName'>
}

// ─── Saved Comparison ────────────────────────────────────────────────────────

export interface SavedComparison {
  id: string
  userId: string
  name: string
  propertyIds: string[]
  notes: string | null
  createdAt: string
}

// ─── Risk Watchlist ──────────────────────────────────────────────────────────

export interface RiskWatchlistEntry {
  id: string
  userId: string
  propertyId: string
  lastKnownOverallScore: number | null
  lastKnownFloodScore: number | null
  lastKnownFireScore: number | null
  lastKnownWindScore: number | null
  lastKnownEarthquakeScore: number | null
  lastKnownCrimeScore: number | null
  addedAt: string
  lastCheckedAt: string | null
  property?: import('./property').Property
  changeEvents?: RiskChangeEvent[]
}

export interface RiskChangeEvent {
  id: string
  watchlistId: string
  propertyId: string
  userId: string
  riskDimension: string
  previousScore: number
  newScore: number
  previousLevel: import('./risk').RiskLevel
  newLevel: import('./risk').RiskLevel
  detectedAt: string
}
