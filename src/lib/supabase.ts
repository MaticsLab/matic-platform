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
  
  // Try Better Auth - get session token from the client
  if (typeof window !== 'undefined') {
    try {
      // Import dynamically to avoid SSR issues
      const { authClient } = await import('@/lib/better-auth-client')
      const betterAuthSession = await authClient.getSession()
      
      if (betterAuthSession?.data?.session?.token) {
        console.log('Using Better Auth session token')
        return betterAuthSession.data.session.token
      }
    } catch (error) {
      console.debug('Better Auth session check failed:', error)
    }
  }
  
  // Last resort: Check cookies directly for Better Auth
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
      const value = valueParts.join('=') // Handle values with = in them
      
      if (betterAuthCookieNames.includes(name) && value) {
        console.log('Found Better Auth session cookie:', name)
        const decodedValue = decodeURIComponent(value)
        // If the cookie is signed (contains .), extract just the token part
        const tokenPart = decodedValue.split('.')[0]
        return tokenPart
      }
    }
  }
  
  return null
}
