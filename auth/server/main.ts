/**
 * Main Platform Auth - Server Instance
 * 
 * Use this in API routes and server-side code:
 * 
 *   import { auth, getAuth } from '@/auth/server/main'
 */

import { createMainAuthConfig } from "../config/main";
import { validateEnv } from "../lib/helpers";

validateEnv();

let _auth: ReturnType<typeof createMainAuthConfig> | null = null;

/**
 * Get the Better Auth instance.
 * Lazily creates the instance on first access.
 */
export function getAuth() {
  if (!_auth) {
    _auth = createMainAuthConfig();
  }
  return _auth;
}

export const auth = getAuth();

export type Auth = ReturnType<typeof createMainAuthConfig>;
export type Session = Auth['$Infer']['Session'];
export type User = Auth['$Infer']['Session']['user'];
