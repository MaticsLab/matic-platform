
import { APP_DOMAIN } from '@/constants/app-domain';
import { createAuthClient } from "better-auth/react";
import { organizationClient, multiSessionClient, magicLinkClient } from "better-auth/client/plugins";

// Create the Better Auth client for frontend use
export const authClient = createAuthClient({
  baseURL: typeof window !== "undefined" 
    ? window.location.origin 
    : APP_DOMAIN,
  plugins: [
    organizationClient(),
    multiSessionClient(),
    magicLinkClient(),
  ],
});

// Export commonly used hooks and methods
export const {
  signIn,
  signUp,
  signOut,
  useSession,
  getSession,
  // Organization methods
  organization,
  useActiveOrganization,
  useListOrganizations,
} = authClient;

// Password management - exposed directly from authClient
export const changePassword = authClient.changePassword;
export const resetPassword = authClient.resetPassword;

// Type exports
export type Session = typeof authClient.$Infer.Session;
export type User = typeof authClient.$Infer.Session.user;
