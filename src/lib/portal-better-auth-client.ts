// Re-export from canonical portal auth client
export {
  portalAuthClient,
  portalBetterAuthClient,
  portalSignIn,
  portalSignUp,
  portalSignOut,
  usePortalSession,
  isPortalAuthenticated,
  getPortalUser,
  getPortalSessionToken,
  clearPortalAuth,
} from '@/auth/client/portal'

export type { PortalSession, PortalUser } from '@/auth/client/portal'
