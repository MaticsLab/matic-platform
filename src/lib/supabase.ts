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

// Helper to check if user is authenticated with Better Auth
// NOTE: Better Auth handles session tokens via HTTP-only cookies automatically
// The Go backend extracts tokens from cookies - frontend doesn't need to manually handle tokens
export async function isAuthenticated(): Promise<boolean> {
  if (typeof window !== 'undefined') {
    try {
      const { authClient } = await import('@/lib/better-auth-client')
      const session = await authClient.getSession()
      return !!session?.data?.user
    } catch (error) {
      console.error('Failed to check authentication:', error)
      return false
    }
  }
  return false
}

// NOTE: Better Auth manages sessions via HTTP-only cookies.
// For API calls to Go backend, always use:
// fetch(url, { credentials: 'include' })
// This ensures cookies are sent with requests.
