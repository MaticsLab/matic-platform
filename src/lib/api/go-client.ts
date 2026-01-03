/**
 * Go Backend API Client
 * Base client for communicating with the Go backend API
 */

const GO_API_URL = process.env.NEXT_PUBLIC_GO_API_URL || 'https://backend.maticslab.com/api/v1'

export class GoAPIError extends Error {
  constructor(
    message: string,
    public status: number,
    public response?: any
  ) {
    super(message)
    this.name = 'GoAPIError'
  }
}

interface RequestOptions extends RequestInit {
  params?: Record<string, string>
}

/**
 * Base fetch wrapper with error handling
 */
export async function goFetch<T>(
  endpoint: string,
  options: RequestOptions = {}
): Promise<T> {
  const { params, ...fetchOptions } = options

  // Build URL with query params
  let url = `${GO_API_URL}${endpoint}`
  if (params) {
    const searchParams = new URLSearchParams(params)
    url += `?${searchParams.toString()}`
  }

  // Get auth token from Better Auth only
  // Better Auth stores tokens in HTTP-only cookies, so we try to get it from the session
  // If not available, we rely on cookies being sent automatically with credentials: 'include'
  let token: string | null = null
  try {
    const { getSessionToken: getTokenFromHelpers } = await import('@/lib/auth-helpers')
    token = await getTokenFromHelpers()
  } catch (error) {
    console.debug('Failed to get token from auth-helpers:', error)
  }
  
  // Don't fallback to Supabase - we're using Better Auth only
  // If token is not available, rely on cookies being sent with credentials: 'include'
  // Better Auth tokens are stored in HTTP-only cookies which JavaScript can't read,
  // but they will be sent automatically with credentials: 'include'
  
  // Debug: log if token is missing for non-public endpoints
  // Public portal forms and field-types endpoint don't require auth tokens
  const isPublicEndpoint = 
    (endpoint.includes('/forms/') && endpoint.includes('/submit')) ||
    (endpoint.includes('/forms/') && endpoint.includes('/dashboard')) ||
    endpoint.includes('/field-types') ||
    endpoint.includes('/ending-pages/match')
  
  if (!token && !isPublicEndpoint) {
    // Don't warn - cookies will be sent automatically
    // Better Auth stores tokens in HTTP-only cookies which we can't read,
    // but they'll be included in the request via credentials: 'include'
  }

  // Make request
  // Include credentials to send cookies (Better Auth stores tokens in HTTP-only cookies)
  // Only include Authorization header if we have a token (Better Auth JWT)
  // Otherwise, rely on cookies for session token authentication
  const response = await fetch(url, {
    ...fetchOptions,
    credentials: 'include', // Include cookies for Better Auth session tokens
    headers: {
      'Content-Type': 'application/json',
      // Only send Authorization header if we have a Better Auth token
      // Otherwise, rely on cookies (Better Auth session tokens are in HTTP-only cookies)
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...fetchOptions.headers,
    },
  })

  // Handle errors
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }))
    throw new GoAPIError(
      error.error || `Request failed with status ${response.status}`,
      response.status,
      error
    )
  }

  // Handle 204 No Content
  if (response.status === 204) {
    return null as T
  }

  return response.json()
}

/**
 * Go API Client
 */
export const goClient = {
  // GET request
  get: <T>(endpoint: string, params?: Record<string, string>) =>
    goFetch<T>(endpoint, { method: 'GET', params }),

  // POST request
  post: <T>(endpoint: string, data?: any, params?: Record<string, string>) =>
    goFetch<T>(endpoint, {
      method: 'POST',
      body: data ? JSON.stringify(data) : undefined,
      params,
    }),

  // PATCH request
  patch: <T>(endpoint: string, data: any, params?: Record<string, string>) =>
    goFetch<T>(endpoint, {
      method: 'PATCH',
      body: JSON.stringify(data),
      params,
    }),

  // PUT request
  put: <T>(endpoint: string, data: any, params?: Record<string, string>) =>
    goFetch<T>(endpoint, {
      method: 'PUT',
      body: JSON.stringify(data),
      params,
    }),

  // DELETE request
  delete: <T>(endpoint: string, params?: Record<string, string>) =>
    goFetch<T>(endpoint, { method: 'DELETE', params }),
}
