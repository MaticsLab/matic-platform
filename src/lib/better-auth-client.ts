// Compatibility wrapper to use the existing auth client from auth folder
import { authClient } from '@/lib/auth/auth-client'

// Re-export the main client
export { authClient }

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
