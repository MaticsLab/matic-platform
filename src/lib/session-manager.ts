/**
 * Session Manager - Prevents duplicate session requests
 *
 * Better Auth's useSession hook can trigger hundreds of duplicate requests
 * when multiple components mount simultaneously. This manager implements
 * request deduplication and caching to prevent 429 rate limit errors.
 *
 * @see https://github.com/better-auth/better-auth/issues/4609
 */

import { authClient } from '@/auth/client/main'

interface SessionCache {
  data: any
  timestamp: number
  promise: Promise<any> | null
}

class SessionManager {
  private cache: SessionCache = {
    data: null,
    timestamp: 0,
    promise: null,
  }

  // Cache TTL: 5 seconds (adjust as needed)
  private readonly CACHE_TTL = 5000

  // Request deduplication: if a request is in flight, return the same promise
  async getSession(forceRefresh = false): Promise<any> {
    const now = Date.now()
    const isCacheValid = this.cache.data && (now - this.cache.timestamp) < this.CACHE_TTL

    // Return cached data if valid and not forcing refresh
    if (!forceRefresh && isCacheValid) {
      return this.cache.data
    }

    // If a request is already in flight, return the same promise
    if (this.cache.promise) {
      return this.cache.promise
    }

    // Create new request
    this.cache.promise = authClient.getSession()
      .then(result => {
        this.cache.data = result
        this.cache.timestamp = Date.now()
        this.cache.promise = null
        return result
      })
      .catch(error => {
        // On error, clear the promise so next call can retry
        this.cache.promise = null
        // Keep cached data if available (stale-while-revalidate pattern)
        throw error
      })

    return this.cache.promise
  }

  // Clear the cache (useful after login/logout)
  clearCache() {
    this.cache = {
      data: null,
      timestamp: 0,
      promise: null,
    }
  }

  // Get cached data without triggering a request
  getCachedSession() {
    return this.cache.data
  }
}

// Export singleton instance
export const sessionManager = new SessionManager()
