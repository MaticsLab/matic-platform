/**
 * Portal Auth - Server Instance
 * 
 * Use this in API routes for portal authentication:
 * 
 *   import { portalAuth, getPortalAuth } from '@/auth/server/portal'
 */

import { betterAuth } from "better-auth";
import { createPortalAuthConfig } from "../config/portal";
import { validateEnv } from "../lib/helpers";

// Validate environment variables
validateEnv();

// Lazy singleton instance
let _auth: ReturnType<typeof betterAuth> | null = null;

/**
 * Get the Portal Auth instance.
 * Lazily creates the instance on first access.
 */
export function getPortalAuth() {
  if (!_auth) {
    console.log('[Portal Auth] Creating auth instance...');
    _auth = createPortalAuthConfig();
  }
  return _auth;
}

/**
 * Portal auth instance with lazy initialization proxy
 */
export const portalAuth = new Proxy({} as ReturnType<typeof betterAuth>, {
  get(_, prop) {
    const instance = getPortalAuth();
    return (instance as any)[prop];
  },
});

// Type exports
export type PortalAuth = ReturnType<typeof betterAuth>;
export type PortalSession = PortalAuth['$Infer']['Session'];
export type PortalUser = PortalAuth['$Infer']['Session']['user'];
