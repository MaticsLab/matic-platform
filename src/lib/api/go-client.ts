/**
 * Go Backend API Client
 * Base client for communicating with the Go backend API
 * 
 * BETTER AUTH INTEGRATION:
 * Better Auth uses HTTP-only cookies for session tokens.
 * Backend is at api.maticsapp.com (same parent domain as frontend)
 * so cookies with domain .maticsapp.com are sent automatically.
 */

// Use local backend in development, production URL otherwise
const getApiUrl = () => {
  if (process.env.NEXT_PUBLIC_GO_API_URL) {
    return process.env.NEXT_PUBLIC_GO_API_URL
  }
  // In browser, check if we're on localhost
  if (typeof window !== 'undefined') {
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
      return 'http://localhost:8080/api/v1'
    }
  }
  // Server-side or production
  return 'https://api.maticsapp.com/api/v1'
}

const GO_API_URL = getApiUrl()

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

  // Make request with credentials: 'include' to send Better Auth session cookies
  // Cookies with domain .maticsapp.com are sent to api.maticsapp.com automatically
  const response = await fetch(url, {
    ...fetchOptions,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
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
