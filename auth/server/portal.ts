/**
 * Portal Auth - Server Instance
 * 
 * Use this in API routes for portal authentication:
 * 
 *   import { portalAuth, getPortalAuth } from '@/auth/server/portal'
 */

import { createPortalAuthConfig } from "../config/portal";
import { validateEnv } from "../lib/helpers";

validateEnv();

let _auth: ReturnType<typeof createPortalAuthConfig> | null = null;

/**
 * Get the Portal Auth instance.
 * Lazily creates the instance on first access.
 */
export function getPortalAuth() {
  if (!_auth) {
    _auth = createPortalAuthConfig();
  }
  return _auth;
}

export const portalAuth = getPortalAuth();

export type PortalAuth = ReturnType<typeof createPortalAuthConfig>;
export type PortalSession = PortalAuth['$Infer']['Session'];
export type PortalUser = PortalAuth['$Infer']['Session']['user'];
