import { createBrowserClient } from '@supabase/ssr'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

// Create a browser client for client-side usage
export const supabase = createBrowserClient(supabaseUrl, supabaseAnonKey)

// Helper to get the current user
export async function getCurrentUser() {
  const { data: { user } } = await supabase.auth.getUser()
  return user
}

// Helper to get the session token with retry for race conditions
export async function getSessionToken(): Promise<string | undefined> {
  // First try to get session directly
  const { data: { session } } = await supabase.auth.getSession()
  if (session?.access_token) {
    return session.access_token
  }
  
  // If no session yet, wait a moment and try again (handles post-login race condition)
  await new Promise(resolve => setTimeout(resolve, 100))
  const { data: { session: retrySession } } = await supabase.auth.getSession()
  return retrySession?.access_token
}
