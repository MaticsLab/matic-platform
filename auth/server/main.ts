/**
 * Main Platform Auth - Server Instance
 * 
 * Use this in API routes and server-side code:
 * 
 *   import { auth, getAuth } from '@/auth/server/main'
 */

import { betterAuth } from "better-auth";
import { createMainAuthConfig } from "../config/main";
import { validateEnv } from "../lib/helpers";

// Validate environment variables
validateEnv();

// Lazy singleton instance
let _auth: ReturnType<typeof betterAuth> | null = null;

/**
 * Get the Better Auth instance.
 * Lazily creates the instance on first access.
 */
export function getAuth() {
  if (!_auth) {
    console.log('[Better Auth] Creating main auth instance...');
    _auth = createMainAuthConfig();
  }
  return _auth;
}

/**
 * Auth instance with lazy initialization proxy
 * Use this for backwards compatibility with existing code
 */
export const auth = new Proxy({} as ReturnType<typeof betterAuth>, {
  get(_, prop) {
    const instance = getAuth();
    return (instance as any)[prop];
  },
});

// Type exports
export type Auth = ReturnType<typeof betterAuth>;
export type Session = Auth['$Infer']['Session'];
export type User = Auth['$Infer']['Session']['user'];
