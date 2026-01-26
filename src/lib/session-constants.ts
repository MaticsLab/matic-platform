/**
 * Session Management Constants
 * 
 * Better Auth session configuration and timing constants.
 * These align with the Better Auth server configuration.
 */

// Session expiration times (in milliseconds)
export const SESSION_CONSTANTS = {
  // Access token expiration (from Better Auth config - default 1 hour)
  ACCESS_TOKEN_EXPIRY: 60 * 60 * 1000, // 1 hour
  
  // Refresh session before expiration (refresh 5 minutes before)
  REFRESH_BEFORE_EXPIRY: 5 * 60 * 1000, // 5 minutes
  
  // Session check interval (check every 1 minute)
  CHECK_INTERVAL: 60 * 1000, // 1 minute
  
  // Session cache duration (matches Better Auth cookie cache - 5 minutes)
  CACHE_DURATION: 5 * 60 * 1000, // 5 minutes
  
  // Maximum session lifetime (default: 7 days)
  // Note: This should match your Better Auth server configuration
  MAX_SESSION_LIFETIME: 7 * 24 * 60 * 60 * 1000, // 7 days
} as const

/**
 * Calculate when to refresh session based on expiration
 * @param expiresAt - Session expiration timestamp (Date or number)
 * @returns true if session should be refreshed
 */
export function shouldRefreshSession(expiresAt: Date | number): boolean {
  const expiryTime = typeof expiresAt === 'number' ? expiresAt : expiresAt.getTime()
  const now = Date.now()
  const timeUntilExpiry = expiryTime - now
  
  // Refresh if we're within the refresh window
  return timeUntilExpiry <= SESSION_CONSTANTS.REFRESH_BEFORE_EXPIRY && timeUntilExpiry > 0
}

/**
 * Check if session is expired
 * @param expiresAt - Session expiration timestamp (Date or number)
 * @returns true if session is expired
 */
export function isSessionExpired(expiresAt: Date | number): boolean {
  const expiryTime = typeof expiresAt === 'number' ? expiresAt : expiresAt.getTime()
  return Date.now() >= expiryTime
}
