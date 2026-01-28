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

// Type definitions for Better Auth callbacks
interface UserForReset {
  id: string;
  email: string;
  name?: string;
}

// Check if we're in a build environment (no DATABASE_URL)
const isBuildTime = !process.env.DATABASE_URL;

console.log('[Portal Auth Config] Initializing...', { 
  isBuildTime, 
  hasDbUrl: !!process.env.DATABASE_URL,
  hasSecret: !!process.env.BETTER_AUTH_SECRET 
});

// Create connection pool only if DATABASE_URL is available
let pool: Pool | null = null;
if (!isBuildTime) {
  try {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false },
      max: 5, // Increase from 1 to 5
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
    });
    console.log('[Portal Auth Config] Database pool created');
  } catch (error) {
    console.error('[Portal Auth Config] Failed to create pool:', error);
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
  secret: process.env.BETTER_AUTH_SECRET || "build-time-secret-placeholder",
  
  database: pool || undefined,

  emailAndPassword: {
    enabled: true,
    requireEmailVerification: false,
    autoSignIn: true,
    sendResetPassword: async ({ user, url }: { user: UserForReset; url: string }) => {
      if (!resend) {
        console.error("[Portal Auth] Resend not configured - RESEND_API_KEY missing");
        return;
      }
      await resend.emails.send({
        from: process.env.EMAIL_FROM || "Matics <hello@notifications.maticsapp.com>",
        replyTo: "support@maticsapp.com",
        to: user.email,
        subject: "Reset your password - Matics Portal",
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #1e40af;">Reset Your Password</h2>
            <p>Hi ${user.name || "there"},</p>
            <p>You requested to reset your password. Click the link below to set a new password:</p>
            <p style="margin: 24px 0;">
              <a href="${url}" style="background-color: #1e40af; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px;">
                Reset Password
              </a>
            </p>
            <p style="color: #666; font-size: 14px;">
              If you didn't request this, you can safely ignore this email.
            </p>
            <p style="color: #666; font-size: 14px;">
              This link will expire in 1 hour.
            </p>
          </div>
        `,
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
      sendMagicLink: async ({ email, token, url }) => {
        if (!resend) {
          console.error("[Portal Auth] Resend not configured");
          return;
        }
        await resend.emails.send({
          from: process.env.EMAIL_FROM || "Matics <hello@notifications.maticsapp.com>",
          replyTo: "support@maticsapp.com",
          to: email,
          subject: "Sign in to Matics Portal",
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h2 style="color: #1e40af;">Sign in to Matics Portal</h2>
              <p>Click the link below to sign in:</p>
              <p style="margin: 24px 0;">
                <a href="${url}" style="background-color: #1e40af; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px;">
                  Sign In
                </a>
              </p>
              <p style="color: #666; font-size: 14px;">
                If you didn't request this, you can safely ignore this email.
              </p>
              <p style="color: #666; font-size: 14px;">
                This link will expire in 15 minutes.
              </p>
            </div>
          `,
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

// Create portal auth instance
console.log('[Portal Auth] Creating portal auth instance at module load');
export const portalAuth = betterAuth(portalAuthConfig);

// Export types
export type PortalAuth = typeof portalAuth;
export type PortalSession = PortalAuth['$Infer']['Session'];
export type PortalUser = PortalAuth['$Infer']['Session']['user'];
