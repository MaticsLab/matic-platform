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
      
      if (betterAuthSession?.data?.session?.token) {
        return betterAuthSession.data.session.token
      }
    } catch (error) {
      console.debug('Better Auth session check failed:', error)
    }
  }
  
  // Check cookies directly for Better Auth
  if (typeof document !== 'undefined') {
    const cookies = document.cookie.split(';')
    const betterAuthCookieNames = [
      '__Secure-better-auth.session_token',
      'better-auth.session_token',
      'better-auth_session_token', 
      'better_auth_session',
      'session_token'
    ]
    
    for (const cookie of cookies) {
      const [name, ...valueParts] = cookie.trim().split('=')
      const value = valueParts.join('=')
      
      if (betterAuthCookieNames.includes(name) && value) {
        const decodedValue = decodeURIComponent(value)
        // If the cookie is signed (contains .), extract just the token part
        const tokenPart = decodedValue.split('.')[0]
        return tokenPart
      }
    }
  }
  
  return null
}
