/**
 * Authentication Helpers - Better Auth Only
 * 
 * This module provides helper functions that replace Supabase auth calls
 * with Better Auth equivalents. Use these helpers throughout the codebase
 * to ensure consistent authentication.
 */

import { authClient } from '@/lib/better-auth-client'
import { auth } from '@/lib/better-auth'
import { headers } from 'next/headers'

// Type exports for better TypeScript support
export type AuthUser = {
  id: string
  email: string
  name: string | null
  emailVerified: boolean
  image?: string | null
  createdAt: Date
}

export type AuthSession = {
  id: string
  userId: string
  token: string
  expiresAt: Date
  organizationId?: string
}

/**
 * Get the current user (replaces supabase.auth.getUser())
 * Server-side only - use useSession() hook on client-side
 */
export async function getAuthUser(): Promise<AuthUser | null> {
  if (typeof window !== 'undefined') {
    // Client-side: use authClient (but prefer useSession hook)
    const session = await authClient.getSession()
    if (session?.data?.user) {
      return {
        id: session.data.user.id,
        email: session.data.user.email,
        name: session.data.user.name,
        emailVerified: session.data.user.emailVerified ?? false,
        image: session.data.user.image ?? undefined,
        createdAt: session.data.user.createdAt,
      }
    }
    return null
  } else {
    // Server-side: use auth.api
    try {
      const headersList = await headers()
      const session = await auth.api.getSession({ headers: headersList })
      if (session?.user) {
        return {
          id: session.user.id,
          email: session.user.email,
          name: session.user.name,
          emailVerified: session.user.emailVerified ?? false,
          image: session.user.image ?? undefined,
          createdAt: session.user.createdAt,
        }
      }
    } catch (error) {
      console.debug('[Auth Helper] Session fetch failed:', error)
    }
    return null
  }
}


/**
 * Require a user to be authenticated, throws error if not
 */
export async function requireAuthUser(): Promise<AuthUser> {
  const user = await getAuthUser()
  if (!user) {
    throw new Error('Unauthorized')
  }
  return user
}

/**
 * Get the current user's ID
 */
export async function getAuthUserId(): Promise<string | null> {
  const user = await getAuthUser()
  return user?.id || null
}

/**
 * Get the current user's name or fallback to email prefix
 */
export async function getAuthUserName(): Promise<string | null> {
  const user = await getAuthUser()
  return user?.name || user?.email?.split('@')[0] || null
}

/**
 * Get the current session (replaces supabase.auth.getSession())
 * Server-side only - use useSession() hook on client-side
 */
export async function getAuthSession(): Promise<AuthSession | null> {
  if (typeof window !== 'undefined') {
    // Client-side: use authClient (but prefer useSession hook)
    const session = await authClient.getSession()
    if (session?.data?.session) {
      return {
        id: session.data.session.id,
        userId: session.data.user.id,
        token: session.data.session.token,
        expiresAt: session.data.session.expiresAt,
        organizationId: session.data.organizationId,
      }
    }
    return null
  } else {
    // Server-side: use auth.api
    try {
      const headersList = await headers()
      const session = await auth.api.getSession({ headers: headersList })
      if (session?.session) {
        return {
          id: session.session.id,
          userId: session.user.id,
          token: session.token,
          expiresAt: session.session.expiresAt,
          organizationId: session.organizationId,
        }
      }
    } catch (error) {
      console.debug('[Auth Helper] Session fetch failed:', error)
    }
    return null
  }
}

/**
 * Get session token for API calls (replaces session.access_token)
 */
export async function getSessionToken(): Promise<string | null> {
  const session = await getAuthSession()
  return session?.token || null
}

/**
 * Sign out the current user (replaces supabase.auth.signOut())
 */
export async function signOut() {
  if (typeof window !== 'undefined') {
    await authClient.signOut()
  } else {
    // Server-side sign out would need to clear cookies
    // This is typically done client-side
    throw new Error('signOut() must be called client-side')
  }
}

/**
 * Update user profile (replaces supabase.auth.updateUser())
 */
export async function updateUser(updates: {
  name?: string
  email?: string
  image?: string
  fullName?: string
  avatarUrl?: string
}) {
  if (typeof window !== 'undefined') {
    const result = await authClient.updateUser({
      name: updates.name || updates.fullName,
      email: updates.email,
      image: updates.image || updates.avatarUrl,
    })
    return { data: result.data, error: result.error }
  } else {
    throw new Error('updateUser() must be called client-side')
  }
}

/**
 * Listen to auth state changes (replaces supabase.auth.onAuthStateChange())
 * Note: Better Auth uses React hooks for this, but this provides a similar API
 */
export function onAuthStateChange(callback: (event: string, session: any) => void) {
  if (typeof window === 'undefined') {
    return { data: { subscription: { unsubscribe: () => {} } } }
  }
  
  // Better Auth doesn't have the same subscription model
  // Use the useSession hook from better-auth-client instead
  // This is a compatibility wrapper
  const checkSession = async () => {
    const session = await authClient.getSession()
    callback('SIGNED_IN', session?.data?.session || null)
  }
  
  checkSession()
  
  // Poll for changes (not ideal, but provides compatibility)
  const interval = setInterval(checkSession, 5000)
  
  return {
    data: {
      subscription: {
        unsubscribe: () => clearInterval(interval)
      }
    }
  }
}

