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

  // Get auth token - try auth-helpers first (more reliable), fallback to supabase
  let token: string | null = null
  try {
    const { getSessionToken: getTokenFromHelpers } = await import('@/lib/auth-helpers')
    token = await getTokenFromHelpers()
  } catch (error) {
    console.debug('Failed to get token from auth-helpers, trying supabase:', error)
  }
  
  // Fallback to supabase version if auth-helpers didn't work
  if (!token) {
    try {
      const { getSessionToken } = await import('@/lib/supabase')
      token = await getSessionToken()
    } catch (error) {
      console.debug('Failed to get token from supabase:', error)
    }
  }
  
  // Debug: log if token is missing for non-public endpoints
  // Public portal forms and field-types endpoint don't require auth tokens
  const isPublicEndpoint = 
    (endpoint.includes('/forms/') && endpoint.includes('/submit')) ||
    (endpoint.includes('/forms/') && endpoint.includes('/dashboard')) ||
    endpoint.includes('/field-types') ||
    endpoint.includes('/ending-pages/match')
  
  if (!token && !isPublicEndpoint) {
    console.warn('⚠️ No auth token available for request:', endpoint)
    // Additional debugging: try to get session info
    if (typeof window !== 'undefined') {
      try {
        const { authClient } = await import('@/lib/better-auth-client')
        const session = await authClient.getSession()
        console.warn('🔍 Session debug info:', {
          hasSession: !!session?.data?.session,
          hasUser: !!session?.data?.user,
          sessionKeys: session?.data?.session ? Object.keys(session.data.session) : [],
          fullSession: session?.data
        })
      } catch (error) {
        console.debug('Failed to get session for debugging:', error)
      }
    }
  }

  // Make request
  // Include credentials to send cookies (Better Auth stores tokens in HTTP-only cookies)
  const response = await fetch(url, {
    ...fetchOptions,
    credentials: 'include', // Include cookies for Better Auth session tokens
    headers: {
      'Content-Type': 'application/json',
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
