/**
 * Guest Scanner Supabase Client
 * 
 * Provides an anonymous Supabase client for guest scanner operations.
 * Uses the anon key without requiring authentication.
 * 
 * SECURITY NOTE: This client has limited permissions via RLS policies.
 * Only allows operations needed for guest scanning:
 * - Read tables, columns, rows (for barcode lookup)
 * - Update rows (for scan count increment)
 * - Insert scan history (for audit trail)
 */

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables for guest scanner')
}

// System user ID for guest scanner operations
// This UUID is used for created_by/updated_by fields when no auth user exists
// Must match the UUID in create_guest_scanner_user.sql
export const GUEST_SCANNER_SYSTEM_USER_ID = '00000000-0000-0000-0000-000000000001'

/**
 * Anonymous Supabase client for guest scanner
 * Does not require authentication
 * Permissions controlled by RLS policies for 'anon' role
 */
export const guestScannerClient = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: false, // Don't persist auth sessions for guest access
    autoRefreshToken: false,
  },
  global: {
    headers: {
      'X-Client-Info': 'guest-scanner',
    },
  },
})

/**
 * Check if user has guest scanner info saved
 */
export function hasGuestScannerInfo(): boolean {
  if (typeof window === 'undefined') return false
  
  const name = localStorage.getItem('scanner_user_name')
  const email = localStorage.getItem('scanner_user_email')
  
  return Boolean(name && email)
}

/**
 * Get guest scanner user info from localStorage
 */
export function getGuestScannerInfo(): { name: string; email: string } | null {
  if (typeof window === 'undefined') return null
  
  const name = localStorage.getItem('scanner_user_name')
  const email = localStorage.getItem('scanner_user_email')
  
  if (!name || !email) return null
  
  return { name, email }
}

/**
 * Clear guest scanner info (for logout/reset)
 */
export function clearGuestScannerInfo(): void {
  if (typeof window === 'undefined') return
  
  localStorage.removeItem('scanner_user_name')
  localStorage.removeItem('scanner_user_email')
}
