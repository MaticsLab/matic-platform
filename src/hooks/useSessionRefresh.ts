'use client'

import { useEffect, useRef } from 'react'
import { useSession, authClient } from '@/lib/better-auth-client'
import { SESSION_CONSTANTS, shouldRefreshSession, isSessionExpired } from '@/lib/session-constants'

/**
 * Session Refresh Hook
 * 
 * Automatically refreshes the Better Auth session before it expires.
 * Prevents unexpected logouts for long-running sessions.
 * 
 * Usage:
 * ```tsx
 * function App() {
 *   useSessionRefresh()
 *   return <YourApp />
 * }
 * ```
 * 
 * Features:
 * - Checks session every minute
 * - Refreshes 5 minutes before expiration
 * - Handles session expiration gracefully
 * - Automatic cleanup on unmount
 */
export function useSessionRefresh() {
  const { data, isPending } = useSession()
  const intervalRef = useRef<NodeJS.Timeout | null>(null)
  const lastCheckRef = useRef<number>(0)

  useEffect(() => {
    // Don't start refresh logic if still loading or no session
    if (isPending || !data?.session) {
      return
    }

    const checkAndRefresh = async () => {
      // Prevent duplicate checks within the same second
      const now = Date.now()
      if (now - lastCheckRef.current < 1000) {
        return
      }
      lastCheckRef.current = now

      try {
        const session = data?.session
        if (!session) return

        // Get session expiration from the session data
        const expiresAt = (session as any)?.expiresAt
        if (!expiresAt) {
          console.warn('[Session Refresh] No expiration time in session')
          return
        }

        // Check if session is expired
        if (isSessionExpired(expiresAt)) {
          console.warn('[Session Refresh] Session expired, user needs to re-login')
          // Let Better Auth handle the expired session
          // The useSession hook will detect this and update accordingly
          return
        }

        // Check if we should refresh the session
        if (shouldRefreshSession(expiresAt)) {
          console.log('[Session Refresh] Refreshing session...')
          
          // Better Auth automatically handles refresh via HTTP-only cookies
          // We just need to trigger a session check which will refresh if needed
          await authClient.getSession()
          
          console.log('[Session Refresh] Session refreshed successfully')
        }
      } catch (error) {
        console.error('[Session Refresh] Failed to refresh session:', error)
        // Don't throw - let the session expire naturally
        // Better Auth will handle the re-authentication
      }
    }

    // Initial check
    checkAndRefresh()

    // Set up interval for periodic checks
    intervalRef.current = setInterval(checkAndRefresh, SESSION_CONSTANTS.CHECK_INTERVAL)

    // Cleanup on unmount
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
    }
  }, [data, isPending])

  // Return nothing - this is a side-effect hook
  return null
}

/**
 * Get session time remaining in milliseconds
 * Returns null if no session or expiration time
 */
export function useSessionTimeRemaining(): number | null {
  const { data } = useSession()
  
  const session = data?.session
  if (!session) return null

  const expiresAt = (session as any)?.expiresAt
  if (!expiresAt) return null

  const expiryTime = typeof expiresAt === 'number' ? expiresAt : new Date(expiresAt).getTime()
  const remaining = expiryTime - Date.now()

  return remaining > 0 ? remaining : 0
}
