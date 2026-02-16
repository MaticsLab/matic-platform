/**
 * Portal Better Auth Configuration
 * 
 * Simplified auth configuration for applicant portal:
 * - Email/password only (no magic links, no organizations)
 * - Shares same database tables (ba_users, ba_sessions)
 * - Uses custom cookie name for isolation
 * - Separate API endpoint (/api/portal-auth)
 * 
 * Used by Better Auth CLI:
 *   npx @better-auth/cli generate --config auth/config/portal.ts
 */

import { betterAuth } from "better-auth";
import { getPool } from "../lib/database";
import { getBaseURL, getTrustedOrigins, getCookieConfig } from "../lib/helpers";

/**
 * Create the portal auth configuration
 * Simplified version without plugins
 */
export function createPortalAuthConfig() {
  const pool = getPool();
  
  if (!pool) {
    throw new Error('[Portal Auth] Cannot create auth: database pool unavailable');
  }
  
  if (!process.env.BETTER_AUTH_SECRET) {
    throw new Error('[Portal Auth] BETTER_AUTH_SECRET not set');
  }
  
  return betterAuth({
    // Core configuration
    appName: "Matic Portal",
    baseURL: getBaseURL(),
    basePath: "/api/portal-auth",
    secret: process.env.BETTER_AUTH_SECRET,
    database: pool,
    
    // Email & Password authentication only
    emailAndPassword: {
      enabled: true,
      requireEmailVerification: false,
      autoSignIn: true,
    },
    
    // Trusted origins for CORS
    trustedOrigins: getTrustedOrigins(),
    
    // Custom table names with snake_case column mapping
    user: {
      modelName: "ba_users",
      fields: {
        emailVerified: "email_verified",
        createdAt: "created_at",
        updatedAt: "updated_at",
      },
    },
    
    session: {
      modelName: "ba_sessions",
      expiresIn: 60 * 60 * 24 * 7, // 7 days
      updateAge: 60 * 60 * 24, // Update every 24 hours
      fields: {
        userId: "user_id",
        expiresAt: "expires_at",
        ipAddress: "ip_address",
        userAgent: "user_agent",
        createdAt: "created_at",
        updatedAt: "updated_at",
      },
    },
    
    account: {
      modelName: "ba_accounts",
      fields: {
        userId: "user_id",
        accountId: "account_id",
        providerId: "provider_id",
        accessToken: "access_token",
        refreshToken: "refresh_token",
        accessTokenExpiresAt: "access_token_expires_at",
        refreshTokenExpiresAt: "refresh_token_expires_at",
        idToken: "id_token",
        createdAt: "created_at",
        updatedAt: "updated_at",
      },
    },
    
    verification: {
      modelName: "ba_verifications",
      fields: {
        expiresAt: "expires_at",
        createdAt: "created_at",
        updatedAt: "updated_at",
      },
    },
    
    // Advanced cookie configuration - uses custom cookie name
    advanced: {
      cookies: {
        sessionToken: {
          name: "matic-portal.session_token",
          attributes: {
            secure: process.env.NODE_ENV === "production",
            sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
            domain: process.env.NODE_ENV === "production" ? ".maticsapp.com" : undefined,
            path: "/",
            httpOnly: true,
          },
        },
      },
      crossSubdomainCookies: {
        enabled: true,
        domain: ".maticsapp.com",
      },
    },
    
    // Rate limiting
    rateLimit: {
      enabled: true,
      window: 60,
      max: 100,
      storage: "memory" as const,
    },
  });
}

// Export for Better Auth CLI
export default createPortalAuthConfig;
