import { betterAuth } from "better-auth";
import { organization, multiSession } from "better-auth/plugins";
import { Pool } from "pg";
import { Resend } from "resend";

// Check if we're in a build environment (no DATABASE_URL)
const isBuildTime = !process.env.DATABASE_URL;

// Create connection pool only if DATABASE_URL is available
// Supabase requires SSL for all connections
const pool = isBuildTime
  ? null
  : new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false }, // Required for Supabase
    });

// Initialize Resend for email sending
const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

// Determine the base URL for authentication
function getBaseURL() {
  // Priority 1: Explicit BETTER_AUTH_URL
  if (process.env.BETTER_AUTH_URL) {
    return process.env.BETTER_AUTH_URL;
  }

  // Priority 2: NEXT_PUBLIC_APP_URL
  if (process.env.NEXT_PUBLIC_APP_URL) {
    return process.env.NEXT_PUBLIC_APP_URL;
  }

  // Priority 3: Vercel URL
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }

  // Fallback: Local development
  return "http://localhost:3000";
}

// Create auth instance - during build time, use a minimal config
// At runtime, the full config with database is used
export const auth = betterAuth({
  baseURL: getBaseURL(),
  basePath: "/api/auth",
  secret: process.env.BETTER_AUTH_SECRET || "build-time-secret-placeholder",
  
  // Use PostgreSQL adapter - pass Pool directly (not wrapped in object)
  database: pool || undefined,

  // Email configuration with Resend
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: false,
    autoSignIn: true,
    // Password reset configuration
    sendResetPassword: async ({ user, url }) => {
      if (!resend) {
        console.error("[Better Auth] Resend not configured - RESEND_API_KEY missing");
        return;
      }
      await resend.emails.send({
        from: process.env.EMAIL_FROM || "Matic <noreply@notifications.maticsapp.com>",
        to: user.email,
        subject: "Reset your password - Matic",
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #1e40af;">Reset Your Password</h2>
            <p>Hi ${user.name || "there"},</p>
            <p>We received a request to reset your password. Click the button below to create a new password:</p>
            <div style="margin: 30px 0;">
              <a href="${url}" style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; display: inline-block;">
                Reset Password
              </a>
            </div>
            <p style="color: #6b7280; font-size: 14px;">
              If you didn't request this, you can safely ignore this email. This link will expire in 1 hour.
            </p>
            <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;" />
            <p style="color: #9ca3af; font-size: 12px;">
              © ${new Date().getFullYear()} Matic. All rights reserved.
            </p>
          </div>
        `,
      });
    },
  },

  // Trusted origins for CORS
  trustedOrigins: [
    "http://localhost:3000",
    "http://localhost:3001",
    ...(process.env.NEXT_PUBLIC_APP_URL ? [process.env.NEXT_PUBLIC_APP_URL] : []),
    ...(process.env.NEXT_PUBLIC_SUPABASE_URL ? [process.env.NEXT_PUBLIC_SUPABASE_URL] : []),
  ],

  // Social providers (can be enabled later)
  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID || "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
      enabled: !!process.env.GOOGLE_CLIENT_ID,
    },
    github: {
      clientId: process.env.GITHUB_CLIENT_ID || "",
      clientSecret: process.env.GITHUB_CLIENT_SECRET || "",
      enabled: !!process.env.GITHUB_CLIENT_ID,
    },
  },

  // Plugins
  plugins: [
    // Organization plugin for multi-tenant support
    organization({
      // Allow users to create organizations
      allowUserToCreateOrganization: true,
      // Default role for new members
      creatorRole: "owner",
    }),
    
    // Multi-session support (user can be logged in on multiple devices)
    multiSession({
      maximumSessions: 5,
    }),
  ],

  // Custom table names and field mappings for existing ba_* tables with snake_case columns
  user: {
    modelName: "ba_users",
    fields: {
      emailVerified: "email_verified",
      createdAt: "created_at",
      updatedAt: "updated_at",
    },
    additionalFields: {
      // Link to Supabase user for migration
      supabaseUserId: {
        type: "string",
        required: false,
        input: false,
        fieldName: "supabase_user_id",
      },
      // Track if user migrated from Supabase
      migratedFromSupabase: {
        type: "boolean",
        required: false,
        defaultValue: false,
        input: false,
        fieldName: "migrated_from_supabase",
      },
      // Store user's full name separately
      fullName: {
        type: "string",
        required: false,
        fieldName: "full_name",
      },
      // Avatar URL
      avatarUrl: {
        type: "string",
        required: false,
        fieldName: "avatar_url",
      },
    },
  },
  
  session: {
    modelName: "ba_sessions",
    expiresIn: 60 * 60 * 24 * 7, // 7 days
    updateAge: 60 * 60 * 24, // Update session every 24 hours
    cookieCache: {
      enabled: true,
      maxAge: 5 * 60, // 5 minutes cache
    },
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
});
// Export types
export type Auth = typeof auth;
export type Session = typeof auth.$Infer.Session;
export type User = typeof auth.$Infer.Session.user;
