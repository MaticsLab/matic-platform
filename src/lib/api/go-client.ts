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

  // Get auth token
  const { getSessionToken } = await import('@/lib/supabase')
  const token = await getSessionToken()
  
  // Debug: log if token is missing
  if (!token) {
    console.warn('⚠️ No auth token available for request:', endpoint)
  } else {
    console.log('✅ Auth token present for request:', endpoint)
  }

  // Make request
  const response = await fetch(url, {
    ...fetchOptions,
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
