/**
 * Main Platform Auth - Re-export
 * 
 * This file re-exports the auth instance from the centralized auth module.
 * Use this for backwards compatibility with existing imports.
 */

export { auth, getAuth } from '@/auth/server/main'
export type { Auth, Session, User } from '@/auth/server/main'
