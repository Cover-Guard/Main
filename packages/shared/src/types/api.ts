export interface ApiResponse<T> {
  success: true
  data: T
  meta?: Record<string, unknown>
}

export interface ApiError {
  success: false
  error: {
    code: string
    message: string
    details?: unknown
  }
}

export type ApiResult<T> = ApiResponse<T> | ApiError

export interface PaginatedResponse<T> {
  items: T[]
  total: number
  page: number
  limit: number
  totalPages: number
}

export interface AuthTokens {
  accessToken: string
  refreshToken: string
  expiresIn: number
}
