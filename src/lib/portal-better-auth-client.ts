/**
 * Portal-specific Better Auth Client
 * 
 * This is a SEPARATE auth client for portal/applicant users.
 * It connects to /api/portal-auth (not /api/auth) and uses a different cookie name.
 * 
 * This prevents session conflicts between admin and portal users:
 * - Main app uses: /api/auth with "better-auth.session_token" cookie
 * - Portal uses: /api/portal-auth with "matic-portal.session_token" cookie
 */

import { createAuthClient } from "better-auth/react";
import { magicLinkClient } from "better-auth/client/plugins";

// Determine the base URL for the portal auth client
const getPortalAuthBaseURL = () => {
  if (typeof window !== "undefined") {
    return window.location.origin;
  }
  return process.env.NEXT_PUBLIC_APP_URL || "https://app.maticslab.com";
};

// Create a SEPARATE Better Auth client for portal users
// This connects to /api/portal-auth which uses a different cookie name
export const portalBetterAuthClient = createAuthClient({
  baseURL: getPortalAuthBaseURL(),
  basePath: "/api/portal-auth", // Different from main app's /api/auth
  plugins: [
    magicLinkClient(),
  ],
  fetchOptions: {
    credentials: "include", // Include cookies for session management
  },
});

// Export portal-specific methods
export const {
  signIn: portalSignIn,
  signUp: portalSignUp,
  signOut: portalSignOut,
  useSession: usePortalSession,
  getSession: getPortalSession,
} = portalBetterAuthClient;

// Helper to check if there's an active portal session
export const hasPortalSession = async (): Promise<boolean> => {
  try {
    const session = await portalBetterAuthClient.getSession();
    return !!session?.data?.session;
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

