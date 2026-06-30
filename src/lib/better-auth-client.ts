// Re-export from canonical auth client
export {
  authClient,
  signIn,
  signUp,
  signOut,
  useSession,
  getSession,
  organization,
  useActiveOrganization,
  useListOrganizations,
  organizationAPI,
  changePassword,
  resetPassword,
  updateUser,
  listSessions,
  revokeSession,
  revokeOtherSessions,
} from '@/auth/client/main'

export type { Session, User } from '@/auth/client/main'
