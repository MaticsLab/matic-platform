import { createBrowserClient } from '@supabase/ssr'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

// Create a browser client for client-side usage
export const supabase = createBrowserClient(supabaseUrl, supabaseAnonKey)

// Export createClient for compatibility
export const createClient = () => createBrowserClient(supabaseUrl, supabaseAnonKey)

/**
 * Supabase Client - For Database and Realtime Only
 * 
 * NOTE: Authentication is now handled by Better Auth.
 * This client is kept only for database queries and realtime subscriptions.
 * Use Better Auth hooks and functions for authentication.
 */

// Helper to get the session token from Better Auth (for API calls)
export async function getSessionToken(): Promise<string | null> {
  // Get session token from Better Auth
  if (typeof window !== 'undefined') {
    try {
      const { authClient } = await import('@/lib/better-auth-client')
      const betterAuthSession = await authClient.getSession()
      
      // Try multiple possible token locations in the session response
      if (betterAuthSession?.data?.session && (betterAuthSession.data.session as any)?.token) {
        return (betterAuthSession.data.session as any).token
      }
      
      // Some Better Auth versions might expose token directly
      if (betterAuthSession?.data && (betterAuthSession.data as any)?.token) {
        return (betterAuthSession.data as any).token
      }
      
      // If we have a session ID but no token, try to fetch it from the API
      if (betterAuthSession?.data?.session?.id) {
        try {
          // Make a direct API call to Better Auth's session endpoint
          // This might expose the token even if getSession() doesn't
          const { APP_DOMAIN } = await import('@/constants/app-domain')
          const baseURL = typeof window !== 'undefined' 
            ? window.location.origin 
            : APP_DOMAIN
          const response = await fetch(`${baseURL}/api/auth/session`, {
            method: 'GET',
            credentials: 'include', // Include cookies
            headers: {
              'Content-Type': 'application/json',
            },
          })
          
          if (response.ok) {
            const sessionData = await response.json()
            if (sessionData?.session?.token) {
              return sessionData.session.token
            }
            if (sessionData?.token) {
              return sessionData.token
            }
          }
        } catch (apiError) {
          console.debug('Failed to fetch session from API:', apiError)
        }
      }
      
      // Check if session exists but token is missing - log for debugging
      if (betterAuthSession?.data?.session && !betterAuthSession.data.session.token) {
        console.warn('⚠️ Better Auth session exists but token is missing. Session structure:', betterAuthSession.data)
      }
    } catch (error) {
      console.error('❌ Better Auth session check failed:', error)
    }
  }
  
  // Fallback: Check cookies directly for Better Auth (only works if not HTTP-only)
  if (typeof document !== 'undefined') {
    const cookies = document.cookie.split(';')
    const betterAuthCookieNames = [
      '__Secure-better-auth.session_token',
      'better-auth.session_token',
      'better-auth_session_token', 
      'better_auth_session',
      'session_token',
      'better-auth.sessionToken'
    ]
    
    for (const cookie of cookies) {
      const [name, ...valueParts] = cookie.trim().split('=')
      const trimmedName = name.trim()
      const value = valueParts.join('=')
      
      if (betterAuthCookieNames.includes(trimmedName) && value) {
        const decodedValue = decodeURIComponent(value)
        // If the cookie is signed (contains .), try to extract the token part
        // Better Auth might sign cookies, so we need to handle that
        const tokenPart = decodedValue.includes('.') ? decodedValue.split('.')[0] : decodedValue
        if (tokenPart && tokenPart.length > 0) {
          return tokenPart
        }
      }
    }
  }
  
  return null
}
