/**
 * Go Backend API Client
 * Base client for communicating with the Go backend API
 */

// Use local backend in development, production URL otherwise
// Check if we're in browser and on localhost, or if NEXT_PUBLIC_GO_API_URL is not set
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
  return 'https://backend.maticslab.com/api/v1'
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

  // Get auth token from Better Auth
  // For cross-domain requests (Vercel -> backend.maticslab.com), we need to send
  // the token in the Authorization header since cookies may not be sent cross-domain
  let token: string | null = null
  
  if (typeof window !== 'undefined') {
    try {
      // First, try to get token from our custom get-session endpoint
      // This endpoint can access the actual session token from Better Auth
      const baseURL = window.location.origin
      const sessionResponse = await fetch(`${baseURL}/api/auth/get-session`, {
        method: 'GET',
        credentials: 'include', // Include cookies
        headers: { 'Content-Type': 'application/json' },
      })
      
      if (sessionResponse.ok) {
        const sessionData = await sessionResponse.json()
        // The get-session endpoint returns token in session.token
        token = sessionData?.session?.token || null
        if (token) {
          console.debug('✅ [Go Client] Got token from get-session endpoint')
        } else {
          console.warn('⚠️ [Go Client] get-session returned data but no token:', sessionData)
        }
      } else {
        console.warn('⚠️ [Go Client] get-session failed with status:', sessionResponse.status)
      }
      
      // Fallback: try auth helpers
      if (!token) {
        try {
          const { getSessionToken: getTokenFromHelpers } = await import('@/lib/auth-helpers')
          token = await getTokenFromHelpers()
          if (token) {
            console.debug('✅ [Go Client] Got token from auth-helpers')
          }
        } catch (helperError) {
          console.debug('Failed to get token from auth-helpers:', helperError)
        }
      }
      
      // Final fallback: try Better Auth client directly
      if (!token) {
        try {
          const { authClient } = await import('@/lib/better-auth-client')
          const session = await authClient.getSession()
          if (session?.data?.session) {
            token = (session.data.session as any)?.token || null
            if (token) {
              console.debug('✅ [Go Client] Got token from Better Auth client')
            }
          }
        } catch (authError) {
          console.debug('Failed to get token from Better Auth client:', authError)
        }
      }
    } catch (error) {
      console.error('❌ [Go Client] Failed to get auth token:', error)
    }
  }
  
  // Public portal forms and field-types endpoint don't require auth tokens
  const isPublicEndpoint = 
    (endpoint.includes('/forms/') && endpoint.includes('/submit')) ||
    (endpoint.includes('/forms/') && endpoint.includes('/dashboard')) ||
    endpoint.includes('/field-types') ||
    endpoint.includes('/ending-pages/match')
  
  // Log warning if token is missing for protected endpoints (helpful for debugging)
  if (!token && !isPublicEndpoint && typeof window !== 'undefined') {
    console.error('❌ [Go Client] No auth token available for protected API call:', endpoint)
    console.error('❌ [Go Client] This will result in 401 Unauthorized. Check browser console for auth errors.')
  } else if (token && typeof window !== 'undefined') {
    console.debug('✅ [Go Client] Making authenticated request to:', endpoint)
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
