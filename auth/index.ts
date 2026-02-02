/**
 * Better Auth - Main Exports
 * 
 * Server-side (API routes):
 *   import { auth } from '@/auth/server/main'
 * 
 * Client-side (React components):
 *   import { authClient, useSession } from '@/auth/client/main'
 * 
 * Note: To avoid type conflicts, import from specific paths above
 * instead of from '@/auth' directly.
 */

// Server-side exports
export { auth, getAuth } from './server/main';
export type { Auth, Session as ServerSession, User as ServerUser } from './server/main';

// Client-side exports with aliases to avoid conflicts
export { authClient, useSession, signIn, signOut, getSession } from './client/main';
export { organizationAPI, changePassword, resetPassword, updateUser } from './client/main';
export type { Session as ClientSession, User as ClientUser } from './client/main';

// Shared types
export type { UserForReset, EmailContext, OrganizationContext, InvitationContext } from './types';

// Utilities
export { getBaseURL, getTrustedOrigins, getCookieConfig, validateEnv } from './lib/helpers';
