/**
 * Go Backend API Client
 * Base client for communicating with the Go backend API
 */

const GO_API_URL = process.env.NEXT_PUBLIC_GO_API_URL || 'https://backend.maticslab.com/api/v1'

// Debug: log the API URL being used
if (typeof window !== 'undefined') {
  console.log('🔗 GO_API_URL:', GO_API_URL)
}

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

  // Debug: log the request
  console.log('🌐 API Request:', url)

  // Get auth token with error handling
  let token: string | undefined
  try {
    const { getSessionToken } = await import('@/lib/supabase')
    token = await getSessionToken()
    
    // Debug: log if token is missing
    if (!token) {
      console.warn('⚠️ No auth token available for request:', endpoint)
    }
  } catch (tokenError) {
    console.error('❌ Error getting auth token:', tokenError)
    // Continue without token - some endpoints may not require auth
  }

  // Make request with error handling
  try {
    const response = await fetch(url, {
      ...fetchOptions,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...fetchOptions.headers,
      },
    })

    // Handle errors
    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Unknown error' }))
      console.error('❌ API Error Response:', response.status, error)
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
  } catch (fetchError) {
    // Log network errors specifically
    if (fetchError instanceof TypeError && fetchError.message === 'Failed to fetch') {
      console.error('❌ Network Error - Failed to fetch:', url)
      console.error('   This usually means: CORS blocked, network issue, or server unreachable')
      console.error('   GO_API_URL:', GO_API_URL)
    }
    throw fetchError
  }
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
