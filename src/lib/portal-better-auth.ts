/**
 * Portal-specific Better Auth Server Configuration
 * 
 * This is a SEPARATE Better Auth instance for portal/applicant users.
 * It uses a different cookie name to prevent session conflicts with the main app.
 * 
 * Main app uses: "better-auth.session_token"
 * Portal uses: "matic-portal.session_token"
 */

import { betterAuth } from "better-auth";
import { magicLink } from "better-auth/plugins";
import { Pool } from "pg";
import { Resend } from "resend";
import { generateAuthEmail, extractDeviceInfo } from "./auth-email-helper";

// Type definitions for Better Auth callbacks
interface UserForReset {
  id: string;
  email: string;
  name?: string;
}

// Singleton pool instance - created lazily at runtime
let _pool: Pool | null = null;

/**
 * Get or create the database pool.
 * This is called lazily at runtime, not at build time.
 */
function getPool(): Pool | null {
  // Return existing pool if already created
  if (_pool) {
    return _pool;
  }
  
  // Check if DATABASE_URL is available (runtime check)
  if (!process.env.DATABASE_URL) {
    console.error('[Portal Auth] DATABASE_URL is not set. Authentication will not work.');
    return null;
  }
  
  try {
    console.log('[Portal Auth] Creating database pool...');
    _pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false },
      max: 5,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
    });
    
    _pool.on('error', (error) => {
      console.error('[Portal Auth] Pool error:', error);
      // Reset pool on error so it can be recreated
      _pool = null;
    });
    
    _pool.on('connect', () => {
      console.log('[Portal Auth] Database pool connected successfully');
    });
    
    return _pool;
  } catch (error) {
    console.error('[Portal Auth] Failed to create database pool:', error);
    return null;
  }
}

// Initialize Resend for email sending
const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

// Determine the base URL for authentication
function getBaseURL() {
  if (process.env.BETTER_AUTH_URL) {
    const authUrl = process.env.BETTER_AUTH_URL;
    if (authUrl.startsWith("http://localhost") || authUrl.startsWith("http://127.0.0.1")) {
      return authUrl;
    }
    if (process.env.NODE_ENV === 'development' && authUrl.includes("maticsapp.com")) {
      if (process.env.NEXT_PUBLIC_APP_URL) {
        const appUrl = process.env.NEXT_PUBLIC_APP_URL;
        if (appUrl.startsWith("http://localhost") || appUrl.startsWith("http://127.0.0.1")) {
          return appUrl;
        }
      }
      return "http://localhost:3000";
    }
    return authUrl;
  }

  if (process.env.NEXT_PUBLIC_APP_URL) {
    return process.env.NEXT_PUBLIC_APP_URL;
  }

  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }

  return "http://localhost:3000";
}

// Portal Auth configuration - uses DIFFERENT cookie name than main app
const portalAuthConfig = {
  baseURL: getBaseURL(),
  basePath: "/api/portal-auth", // Different path than main app's /api/auth
  secret: 'placeholder-replaced-at-runtime',
  
  // Database will be set at runtime in createPortalAuth()
  // This is intentionally undefined here - it's set when getPortalAuth() is called

  emailAndPassword: {
    enabled: true,
    requireEmailVerification: false,
    autoSignIn: true,
    sendResetPassword: async ({ user, url, request }: { user: UserForReset; url: string; request?: Request }) => {
      if (!resend) {
        console.error("[Portal Auth] Resend not configured - RESEND_API_KEY missing");
        return;
      }
      
      // Extract device information from request
      const deviceInfo = extractDeviceInfo(request);
      
      // Generate professional email template
      const { html, plainText, subject } = await generateAuthEmail({
        type: 'password-reset',
        email: user.email,
        userName: user.name,
        actionUrl: url,
        expiryMinutes: 60,
        companyName: 'Matic Portal',
        brandColor: '#1e40af',
        ...deviceInfo,
      });
      
      // Send email with Resend best practices
      await resend.emails.send({
        from: process.env.EMAIL_FROM || "Matics <hello@notifications.maticsapp.com>",
        replyTo: "support@maticsapp.com",
        to: user.email,
        subject,
        html,
        text: plainText,
        // Resend best practice: Add tags for tracking and analytics
        tags: [
          { name: 'category', value: 'auth' },
          { name: 'type', value: 'password-reset' },
          { name: 'portal', value: 'portal' },
          { name: 'environment', value: process.env.NODE_ENV || 'development' },
        ],
        // Resend best practice: Add headers for better deliverability and tracking
        headers: {
          'X-Entity-Ref-ID': `portal-pwd-reset-${user.id}`,
          'X-Priority': '1', // High priority for auth emails
        },
      });
    },
  },

  // Trusted origins for CORS - CRITICAL for portal subdomain access
  trustedOrigins: [
    // Primary domains
    "https://maticsapp.com",
    "https://www.maticsapp.com",
    // Local development
    "http://localhost:3000",
    "http://localhost:3001",
    "http://localhost:3002",
    // Dynamic origins from environment
    ...(process.env.NEXT_PUBLIC_APP_URL ? [process.env.NEXT_PUBLIC_APP_URL] : []),
    // Vercel preview deployments
    ...(process.env.VERCEL_URL ? [`https://${process.env.VERCEL_URL}`] : []),
    // Allow any *.vercel.app subdomains for preview deployments
    "https://*.vercel.app",
    // CRITICAL: Allow any *.maticsapp.com subdomains (custom portal subdomains like bpnc.maticsapp.com)
    "https://*.maticsapp.com",
  ],

  // Magic link plugin for passwordless login
  plugins: [
    magicLink({
      sendMagicLink: async ({ email, token, url }, ctx: any) => {
        if (!resend) {
          console.error("[Portal Auth] Resend not configured");
          return;
        }
        
        // Extract device information from request
        const deviceInfo = extractDeviceInfo(ctx?.request);
        
        // Generate professional email template
        const { html, plainText, subject } = await generateAuthEmail({
          type: 'magic-link',
          email,
          actionUrl: url,
          expiryMinutes: 15,
          companyName: 'Matic Portal',
          brandColor: '#1e40af',
          ...deviceInfo,
        });
        
        // Send email with Resend best practices
        await resend.emails.send({
          from: process.env.EMAIL_FROM || "Matics <hello@notifications.maticsapp.com>",
          replyTo: "support@maticsapp.com",
          to: email,
          subject,
          html,
          text: plainText,
          // Resend best practice: Add tags for tracking and analytics
          tags: [
            { name: 'category', value: 'auth' },
            { name: 'type', value: 'magic-link' },
            { name: 'portal', value: 'portal' },
            { name: 'environment', value: process.env.NODE_ENV || 'development' },
          ],
          // Resend best practice: Add headers for better deliverability
          headers: {
            'X-Entity-Ref-ID': `portal-magic-link-${email}-${Date.now()}`,
            'X-Priority': '1', // High priority for auth emails
          },
        });
      },
    }),
  ],

  // Use the SAME database tables as main auth (users are shared)
  // This allows portal users to also use the main app if needed
  user: {
    modelName: "ba_users",
    fields: {
      createdAt: "created_at",
      updatedAt: "updated_at",
      emailVerified: "email_verified",
    },
    additionalFields: {
      // User type: portal users should always be applicants
      userType: {
        type: "string" as const,
        required: false,
        defaultValue: "applicant", // Portal users are applicants by default
        fieldName: "user_type",
        input: false, // Don't allow override from portal
      },
    },
  },

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
    updateAge: 60 * 60 * 24, // Update session every 24 hours
  },

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

  verification: {
    modelName: "ba_verifications",
    fields: {
      expiresAt: "expires_at",
      createdAt: "created_at",
      updatedAt: "updated_at",
    },
  },

  // CRITICAL: Different cookie name than main app to prevent session conflicts
  advanced: {
    cookies: {
      sessionToken: {
        name: "matic-portal.session_token", // Different from main app's "better-auth.session_token"
        attributes: {
          secure: process.env.NODE_ENV === "production",
          sameSite: process.env.NODE_ENV === "production" ? ("none" as const) : ("lax" as const),
          domain: process.env.NODE_ENV === "production" ? ".maticsapp.com" : undefined,
          path: "/",
        },
      },
    },
    crossSubdomainCookies: {
      enabled: true,
      domain: ".maticsapp.com",
    },
    // Cookie attributes for security - MUST match sessionToken for cross-subdomain
    defaultCookieAttributes: {
      sameSite: process.env.NODE_ENV === "production" ? ("none" as const) : ("lax" as const),
      secure: process.env.NODE_ENV === "production",
      httpOnly: true,
      path: "/",
      domain: process.env.NODE_ENV === "production" ? ".maticsapp.com" : undefined,
    },
  },

  rateLimit: {
    enabled: true,
    window: 60,
    max: 100,
    storage: "memory" as const,
  },
};

// Lazy singleton instance - created on first access, not at module load time
// This is critical for Vercel where env vars aren't available during build
let _auth: ReturnType<typeof betterAuth> | null = null;

function createPortalAuth() {
  console.log('[Portal Auth] Creating portal auth instance...');
  
  // Get pool at runtime (when DATABASE_URL is available)
  const pool = getPool();
  
  if (!pool) {
    console.error('[Portal Auth] Cannot create auth instance: database pool is not available');
    console.error('[Portal Auth] Make sure DATABASE_URL environment variable is set');
  }
  
  // Create config with runtime values
  const runtimeConfig = {
    ...portalAuthConfig,
    database: pool || undefined,
    secret: process.env.BETTER_AUTH_SECRET || 'build-time-secret-placeholder',
  };
  
  console.log('[Portal Auth] Auth config:', {
    baseURL: runtimeConfig.baseURL,
    basePath: runtimeConfig.basePath,
    hasDatabase: !!runtimeConfig.database,
    hasSecret: !!process.env.BETTER_AUTH_SECRET,
  });
  
  return betterAuth(runtimeConfig);
}

/**
 * Get the Portal Auth instance.
 * Lazily creates the instance on first access to ensure
 * environment variables are available (runtime vs build time).
 */
export function getPortalAuth() {
  if (!_auth) {
    _auth = createPortalAuth();
  }
  return _auth;
}

// For backwards compatibility, export portalAuth as a getter
// This ensures lazy initialization
export const portalAuth = new Proxy({} as ReturnType<typeof betterAuth>, {
  get(_, prop) {
    const instance = getPortalAuth();
    return (instance as any)[prop];
  },
});

// Export types
export type PortalAuth = ReturnType<typeof betterAuth>;
export type PortalSession = PortalAuth['$Infer']['Session'];
export type PortalUser = PortalAuth['$Infer']['Session']['user'];
