/**
 * Portal Auth - Client Instance
 * 
 * Use this in portal components:
 * 
 *   import { portalAuthClient, usePortalSession } from '@/auth/client/portal'
 */

import { createAuthClient } from "better-auth/react";

/**
 * Get the base URL for portal auth requests
 */
function getPortalAuthBaseURL(): string {
  if (typeof window !== "undefined") {
    return window.location.origin;
  }
  return process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
}

/**
 * Portal auth client - simplified version
 * No plugins, just basic email/password authentication
 */
export const portalAuthClient = createAuthClient({
  baseURL: getPortalAuthBaseURL(),
  basePath: "/api/portal-auth",
  fetchOptions: {
    credentials: "include", // Include cookies for session
  },
});

// Export convenience methods with portal prefix
export const {
  signIn: portalSignIn,
  signUp: portalSignUp,
  signOut: portalSignOut,
  useSession: usePortalSession,
} = portalAuthClient;

/**
 * Check if user is authenticated in portal
 */
export const isPortalAuthenticated = async (): Promise<boolean> => {
  try {
    const session = await portalAuthClient.getSession();
    return !!session?.data?.user;
  } catch {
    return false;
  }
};

/**
 * Get portal user info
 */
export const getPortalUser = async () => {
  try {
    const session = await portalAuthClient.getSession();
    return session?.data?.user || null;
  } catch {
    return null;
  }
};

/**
 * Get portal session token for API requests
 * This retrieves the Better Auth session token from cookies
 */
export const getPortalSessionToken = async (): Promise<string | null> => {
  try {
    const session = await portalAuthClient.getSession();
    if (session?.data?.session) {
      // Better Auth stores the session token in the session object
      return session.data.session.token || null;
    }
    return null;
  } catch {
    return null;
  }
};

/**
 * Clear portal auth (sign out and cleanup)
 */
export const clearPortalAuth = async () => {
  try {
    await portalAuthClient.signOut();
  } catch (error) {
    console.warn('Failed to sign out from portal:', error);
  }
  
  // Clear localStorage auth data
  if (typeof window !== 'undefined') {
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('portal-auth-')) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach(key => localStorage.removeItem(key));
  }
};

// Type exports
export type PortalSession = typeof portalAuthClient.$Infer.Session;
export type PortalUser = typeof portalAuthClient.$Infer.Session.user;

// Re-export the client for backwards compatibility
export const portalBetterAuthClient = portalAuthClient;
