/**
 * Go Backend API Client
 * Base client for communicating with the Go backend API
 * 
 * BETTER AUTH INTEGRATION:
 * Better Auth uses HTTP-only cookies for session tokens.
 * Backend is at api.maticsapp.com (same parent domain as frontend)
 * so cookies with domain .maticsapp.com are sent automatically.
 */
import { getSessionToken } from '@/lib/auth-helpers'


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

/**
 * Server-side only: forwards the incoming request's raw Cookie header to the
 * outgoing Go-backend fetch. `credentials: 'include'` is a browser-fetch-spec
 * concept (pulls from the browser's own cookie jar) — Node's fetch has no such
 * jar, so it's a no-op server-side, and nothing gets sent without this. This
 * is also more reliable than the Bearer-token fallback below: it forwards
 * whatever format Better Auth's cookie actually is (compact/jwt/jwe cache),
 * which the Go backend's cookie-parsing path already knows how to handle,
 * rather than depending on the exact shape of `auth.api.getSession()`'s
 * returned session object.
 */
async function getServerCookieHeader(): Promise<string | null> {
  if (typeof window !== 'undefined') return null
  try {
    const { headers } = await import('next/headers')
    const headersList = await headers()
    return headersList.get('cookie')
  } catch {
    return null
  }
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
  // If endpoint starts with /api/, treat it as a full path (for v2 endpoints)
  const baseUrl = endpoint.startsWith('/api/') 
    ? GO_API_URL.replace(/\/api\/v\d+$/, '') // Remove /api/v1 suffix
    : GO_API_URL
  let url = `${baseUrl}${endpoint}`
  if (params) {
    const searchParams = new URLSearchParams(params)
    url += `?${searchParams.toString()}`
  }

  const sessionToken = await getSessionToken()
  const requestHeaders: HeadersInit = {
    'Content-Type': 'application/json',
    ...fetchOptions.headers,
  }

  // Fallback for cross-domain API hosts (e.g., Railway): attach Better Auth session token.
  // On localhost/same-host browser requests, prefer cookies to avoid sending compact cookie-cache
  // tokens as bearer credentials, which backend session-token validation may reject.
  const shouldAttachBearerToken = (() => {
    if (!sessionToken || (requestHeaders as Record<string, string>).Authorization) {
      return false
    }

    if (typeof window === 'undefined') {
      return true
    }

    try {
      const requestHost = new URL(url).hostname
      return requestHost !== window.location.hostname
    } catch {
      return true
    }
  })()

  if (shouldAttachBearerToken) {
    ;(requestHeaders as Record<string, string>).Authorization = `Bearer ${sessionToken}`
  }

  // Server-side (Server Components/layouts): explicitly forward the incoming
  // request's cookie header — credentials: 'include' below does nothing here.
  if (typeof window === 'undefined') {
    const cookieHeader = await getServerCookieHeader()
    if (cookieHeader) {
      ;(requestHeaders as Record<string, string>).Cookie = cookieHeader
    }
  }

  // Make request with credentials: 'include' to send Better Auth session cookies
  // Cookies with domain .maticsapp.com are sent to api.maticsapp.com automatically.
  // cache: 'no-store' is required once this client is called from Server Components —
  // every response here is private/per-user (workspace, org, form data), and Next's
  // fetch Data Cache keys on the URL alone, not the caller's session. Without this,
  // one user's cached response could be served to a different user hitting the same URL.
  const response = await fetch(url, {
    ...fetchOptions,
    credentials: 'include',
    headers: requestHeaders,
    cache: 'no-store',
  })

  // Handle errors
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }))
    
    // Handle 401 Unauthorized - redirect to login if in browser
    // IMPORTANT: Do NOT redirect on portal/applicant pages — an unauthenticated
    // applicant visiting a public form is expected, not a staff session expiring
    if (response.status === 401 && typeof window !== 'undefined') {
      const currentPath = window.location.pathname + window.location.search
      const hostname = window.location.hostname
      
      // Check if this is a portal/applicant page
      // 1. URL starts with /apply/ or /portal
      // 2. OR accessed via subdomain (e.g., bpnc.maticsapp.com)
      // 3. OR accessed via forms.maticsapp.com
      const isSubdomain = hostname.endsWith('.maticsapp.com') && 
                         hostname !== 'www.maticsapp.com' && 
                         hostname !== 'maticsapp.com' &&
                         hostname !== 'api.maticsapp.com'
      const isFormsSubdomain = hostname === 'forms.maticsapp.com'
      const isApplyRoute = currentPath.startsWith('/apply/') || currentPath.startsWith('/portal')
      const isLandingPage = currentPath === '/' || currentPath.startsWith('/?')
      const isPortalPage = isApplyRoute || isSubdomain || isFormsSubdomain
      
      if (isPortalPage || isLandingPage) {
        console.warn('[GoClient] 401 on portal/landing page — skipping redirect', {
          hostname,
          currentPath,
          isSubdomain,
          isFormsSubdomain,
          isApplyRoute,
          isLandingPage
        })
      } else {
        console.warn('[GoClient] Authentication required, redirecting to login...')
        // Use window.location to force a full page reload and clear any stale state
        window.location.href = `/login?redirect=${encodeURIComponent(currentPath)}`
        // Throw error anyway to stop execution
      }
    }
    
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
