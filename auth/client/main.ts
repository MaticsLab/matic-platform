/**
 * Main Platform Auth - Client Instance
 * 
 * Use this in React components and client-side code:
 * 
 *   import { authClient, useSession, signIn } from '@/auth/client/main'
 */

import { createAuthClient } from "better-auth/react";
import { organizationClient, multiSessionClient, magicLinkClient } from "better-auth/client/plugins";

/**
 * Get the base URL for auth requests
 */
function getAuthBaseURL(): string {
  if (typeof window !== "undefined") {
    return window.location.origin;
  }
  return process.env.NEXT_PUBLIC_APP_URL || 'https://www.maticsapp.com';
}

/**
 * Main platform auth client
 * Includes all plugins: organization, multiSession, magicLink
 */
export const authClient = createAuthClient({
  baseURL: getAuthBaseURL(),
  basePath: "/api/auth",
  plugins: [
    organizationClient(),
    multiSessionClient(),
    magicLinkClient(),
  ],
  fetchOptions: {
    // Handle rate limit errors gracefully
    onError: async (context) => {
      const { response } = context;
      if (response.status === 429) {
        const retryAfter = response.headers.get("X-Retry-After") || "60";
        console.warn(`[Auth] Rate limit hit. Retry after ${retryAfter}s`);
      }
    },
  },
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

// Export comprehensive organization API
export const organizationAPI = {
  // Core organization methods
  create: authClient.organization.create,
  list: authClient.organization.list,
  update: authClient.organization.update,
  delete: authClient.organization.delete,
  setActive: authClient.organization.setActive,
  getFullOrganization: authClient.organization.getFullOrganization,
  
  // Member management
  inviteMember: authClient.organization.inviteMember,
  removeMember: authClient.organization.removeMember,
  updateMemberRole: authClient.organization.updateMemberRole,
  listMembers: authClient.organization.listMembers,
  getActiveMember: authClient.organization.getActiveMember,
  getActiveMemberRole: authClient.organization.getActiveMemberRole,
  leave: authClient.organization.leave,
  
  // Invitation management
  acceptInvitation: authClient.organization.acceptInvitation,
  cancelInvitation: authClient.organization.cancelInvitation,
  rejectInvitation: authClient.organization.rejectInvitation,
  listInvitations: authClient.organization.listInvitations,
  listUserInvitations: authClient.organization.listUserInvitations,
  getInvitation: authClient.organization.getInvitation,
  
  // Access control
  hasPermission: authClient.organization.hasPermission,
  
  // Organization hooks
  useActiveOrganization: authClient.useActiveOrganization,
  useListOrganizations: authClient.useListOrganizations,
};

// Password management
export const changePassword = authClient.changePassword;
export const resetPassword = authClient.resetPassword;

// User profile management
export const updateUser = authClient.updateUser;

// Multi-session management
export const listSessions = authClient.listSessions;
export const revokeSession = authClient.revokeSession;
export const revokeOtherSessions = authClient.revokeOtherSessions;

// Type exports
export type Session = typeof authClient.$Infer.Session;
export type User = typeof authClient.$Infer.Session.user;
