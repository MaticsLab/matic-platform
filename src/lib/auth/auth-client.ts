// Re-export the canonical auth client — do NOT import server-side auth here
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
