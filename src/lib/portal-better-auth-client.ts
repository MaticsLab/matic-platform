/**
 * Portal Better Auth Client (Best Practices)
 * 
 * Following Better Auth skill guidelines:
 * - Uses createAuthClient from better-auth/react
 * - Simple configuration with baseURL and basePath
 * - No unnecessary plugins (removed magicLink)
 * - Proper credentials: 'include' for cookies
 */

import { createAuthClient } from "better-auth/react";

const getPortalAuthBaseURL = () => {
  if (typeof window !== "undefined") {
    return window.location.origin;
  }
  return process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
};

// Portal auth client - connects to /api/portal-auth
export const portalBetterAuthClient = createAuthClient({
  baseURL: getPortalAuthBaseURL(),
  basePath: "/api/portal-auth",
  fetchOptions: {
    credentials: "include", // Include cookies for session
  },
});

// Export convenience methods
export const {
  signIn: portalSignIn,
  signUp: portalSignUp,
  signOut: portalSignOut,
  useSession: usePortalSession,
} = portalBetterAuthClient;

// Helper to check if user is authenticated
export const isPortalAuthenticated = async (): Promise<boolean> => {
  try {
    const session = await portalBetterAuthClient.getSession();
    return !!session?.data?.user;
  } catch {
    return false;
  }
};

// Helper to get portal user info
export const getPortalUser = async () => {
  try {
    const session = await portalBetterAuthClient.getSession();
    return session?.data?.user || null;
  } catch {
    return null;
  }
};

// Helper to clear portal auth (sign out)
export const clearPortalAuth = async () => {
  try {
    await portalBetterAuthClient.signOut();
  } catch (error) {
    console.warn('Failed to sign out from portal:', error);
  }
  
  // Also clear any localStorage auth data
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

