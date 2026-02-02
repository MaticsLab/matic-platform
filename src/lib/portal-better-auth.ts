/**
 * Portal Better Auth Configuration (Best Practices)
 * 
 * Following Better Auth skill guidelines:
 * - Lazy initialization for serverless
 * - Uses BETTER_AUTH_SECRET/BETTER_AUTH_URL env vars
 * - Proper database connection with pg.Pool
 * - Email/password authentication only (no magic links unless needed)
 * - Custom cookie name for portal isolation
 */

import { betterAuth } from "better-auth";
import { Pool } from "pg";

// Lazy singleton pool - created at runtime, not build time
let _pool: Pool | null = null;

function getPool(): Pool {
  if (_pool) return _pool;
  
  if (!process.env.DATABASE_URL) {
    throw new Error('[Portal Auth] DATABASE_URL not set');
  }
  
  _pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
    max: 5,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
  });
  
  _pool.on('error', (err) => {
    console.error('[Portal Auth] Pool error:', err);
    _pool = null; // Reset on error
  });
  
  return _pool;
}

// Lazy singleton auth instance
let _auth: ReturnType<typeof betterAuth> | null = null;

/**
 * Get Portal Auth instance (lazy initialization)
 * Following Better Auth best practices
 */
export function getPortalAuth() {
  if (_auth) return _auth;
  
  console.log('[Portal Auth] Creating auth instance...');
  
  // Skill: baseURL defaults to BETTER_AUTH_URL, only set if not present
  const baseURL = process.env.BETTER_AUTH_URL || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  
  // Skill: secret defaults to BETTER_AUTH_SECRET
  const secret = process.env.BETTER_AUTH_SECRET;
  if (!secret) {
    throw new Error('[Portal Auth] BETTER_AUTH_SECRET not set');
  }
  
  _auth = betterAuth({
    // Core config
    appName: "Matic Portal",
    baseURL,
    basePath: "/api/portal-auth",
    secret,
    database: getPool(),
    
    // Email/password authentication
    emailAndPassword: {
      enabled: true,
      requireEmailVerification: false,
      autoSignIn: true,
    },
    
    // Skill: trustedOrigins for CORS
    trustedOrigins: [
      "https://maticsapp.com",
      "https://www.maticsapp.com",
      "https://*.maticsapp.com", // All subdomains (bpnc.maticsapp.com, etc.)
      "http://localhost:3000",
      "http://localhost:3001",
      "http://localhost:3002",
      ...(process.env.VERCEL_URL ? [`https://${process.env.VERCEL_URL}`] : []),
    ],
    
    // User model config (snake_case column mapping)
    user: {
      modelName: "ba_users", // Table name in DB
      fields: {
        createdAt: "created_at",
        updatedAt: "updated_at",
        emailVerified: "email_verified",
      },
    },
    
    // Session config
    session: {
      modelName: "ba_sessions",
      fields: {
        userId: "user_id",
        expiresAt: "expires_at",
        createdAt: "created_at",
        updatedAt: "updated_at",
        ipAddress: "ip_address",
        userAgent: "user_agent",
      },
      expiresIn: 60 * 60 * 24 * 7, // 7 days
      updateAge: 60 * 60 * 24, // Update every 24 hours
    },
    
    // Account config (for OAuth in future)
    account: {
      modelName: "ba_accounts",
      fields: {
        userId: "user_id",
        createdAt: "created_at",
        updatedAt: "updated_at",
        accessToken: "access_token",
        refreshToken: "refresh_token",
        accessTokenExpiresAt: "access_token_expires_at",
        refreshTokenExpiresAt: "refresh_token_expires_at",
        accountId: "account_id",
        providerId: "provider_id",
      },
    },
    
    // Verification config
    verification: {
      modelName: "ba_verifications",
      fields: {
        expiresAt: "expires_at",
        createdAt: "created_at",
        updatedAt: "updated_at",
      },
    },
    
    // Advanced: Custom cookie name and cross-subdomain support
    advanced: {
      cookies: {
        sessionToken: {
          name: "matic-portal.session_token",
          attributes: {
            secure: process.env.NODE_ENV === "production",
            sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
            domain: process.env.NODE_ENV === "production" ? ".maticsapp.com" : undefined,
            path: "/",
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
      storage: "memory",
    },
  });
  
  console.log('[Portal Auth] Instance created:', { baseURL, basePath: "/api/portal-auth" });
  return _auth;
}

// Export auth instance with lazy loading proxy
export const portalAuth = new Proxy({} as ReturnType<typeof betterAuth>, {
  get(_, prop) {
    return (getPortalAuth() as any)[prop];
  },
});

// Type exports
export type PortalAuth = ReturnType<typeof betterAuth>;
export type PortalSession = PortalAuth['$Infer']['Session'];
export type PortalUser = PortalAuth['$Infer']['Session']['user'];
