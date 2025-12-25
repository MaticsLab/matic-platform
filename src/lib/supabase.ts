import { createBrowserClient } from '@supabase/ssr'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

// Create a browser client for client-side usage
export const supabase = createBrowserClient(supabaseUrl, supabaseAnonKey)

// Export createClient for compatibility
export const createClient = () => createBrowserClient(supabaseUrl, supabaseAnonKey)

// Helper to get the current user
export async function getCurrentUser() {
  const { data: { user } } = await supabase.auth.getUser()
  return user
}

// Helper to get the session token - checks both Supabase and Better Auth
export async function getSessionToken(): Promise<string | null> {
  // First try Supabase session
  const { data: { session } } = await supabase.auth.getSession()
  if (session?.access_token) {
    return session.access_token
  }
  
  // Fall back to Better Auth session token from cookie
  // Better Auth stores the session token in a cookie named 'better-auth.session_token'
  if (typeof document !== 'undefined') {
    const cookies = document.cookie.split(';')
    for (const cookie of cookies) {
      const [name, value] = cookie.trim().split('=')
      if (name === 'better-auth.session_token' && value) {
        return decodeURIComponent(value)
      }
    }
  }
  
  return null
}
