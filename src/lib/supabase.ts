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
  // Better Auth can use different cookie names depending on configuration
  if (typeof document !== 'undefined') {
    const cookies = document.cookie.split(';')
    const betterAuthCookieNames = [
      'better-auth.session_token',
      'better-auth_session_token', 
      '__Secure-better-auth.session_token',
      'better_auth_session',
      'session_token'
    ]
    
    for (const cookie of cookies) {
      const [name, value] = cookie.trim().split('=')
      if (betterAuthCookieNames.includes(name) && value) {
        console.log('Found Better Auth session cookie:', name)
        return decodeURIComponent(value)
      }
    }
    
    // Debug: log all cookies to help identify the right one
    console.log('Available cookies:', cookies.map(c => c.trim().split('=')[0]))
  }
  
  return null
}
