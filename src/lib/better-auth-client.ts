
import { APP_DOMAIN } from '@/constants/app-domain';
import { createAuthClient } from "better-auth/react";
import { organizationClient, multiSessionClient, magicLinkClient } from "better-auth/client/plugins";

// Create the Better Auth client for frontend use
export const authClient = createAuthClient({
  baseURL: typeof window !== "undefined" 
    ? window.location.origin 
    : APP_DOMAIN,
  plugins: [
    organizationClient({
      // Enable advanced features if needed in the future
      // dynamicAccessControl: { enabled: true },
      
      // Custom role definitions would go here if implementing custom access control
      // ac: accessController,
      // roles: { owner, admin, member, customRole },
    }),
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

// Password management - exposed directly from authClient
export const changePassword = authClient.changePassword;
export const resetPassword = authClient.resetPassword;

// Type exports
export type Session = typeof authClient.$Infer.Session;
export type User = typeof authClient.$Infer.Session.user;
