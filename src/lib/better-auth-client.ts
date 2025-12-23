import { createAuthClient } from "better-auth/react";
import { organizationClient, multiSessionClient } from "better-auth/client/plugins";

// Create the Better Auth client for frontend use
export const authClient = createAuthClient({
  baseURL: typeof window !== "undefined" 
    ? window.location.origin 
    : process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
  plugins: [
    organizationClient(),
    multiSessionClient(),
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

// Type exports
export type Session = typeof authClient.$Infer.Session;
export type User = typeof authClient.$Infer.Session.user;
