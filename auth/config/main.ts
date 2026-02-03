/**
 * Main Platform Better Auth Configuration
 * 
 * This is the centralized configuration for the main platform auth.
 * Used by Better Auth CLI for generating types and running migrations:
 * 
 *   npx @better-auth/cli generate --config auth/config/main.ts
 *   npx @better-auth/cli migrate --config auth/config/main.ts
 */

import { betterAuth } from "better-auth";
import { organization, multiSession, magicLink } from "better-auth/plugins";
import { getPool } from "../lib/database";
import { getBaseURL, getTrustedOrigins, getCookieConfig } from "../lib/helpers";
import { sendPasswordResetEmail } from "@/lib/emails/password-reset-email";
import { sendMagicLink } from "@/lib/emails/magic-link-email";
import { sendOrganizationInviteEmail } from "@/lib/emails/organization-invite-email";
import type { UserForReset } from "../types";

/**
 * Create the main platform auth configuration
 * This contains all plugins: organization, multiSession, magicLink
 */
export function createMainAuthConfig() {
  const pool = getPool();
  
  if (!pool) {
    throw new Error('[Better Auth] Cannot create auth: database pool unavailable');
  }
  
  if (!process.env.BETTER_AUTH_SECRET) {
    throw new Error('[Better Auth] BETTER_AUTH_SECRET not set');
  }
  
  const APP_DOMAIN = process.env.NEXT_PUBLIC_APP_URL || 'https://maticsapp.com';
  
  return betterAuth({
    // Core configuration
    appName: "Matic Platform",
    baseURL: getBaseURL(),
    basePath: "/api/auth",
    secret: process.env.BETTER_AUTH_SECRET,
    database: pool,
    
    // Email & Password authentication with reset functionality
    emailAndPassword: {
      enabled: true,
      requireEmailVerification: false,
      autoSignIn: true,
      
      sendResetPassword: async ({ user, url, request }: { user: UserForReset; url: string; request?: Request }) => {
        await sendPasswordResetEmail({ 
          user: { 
            email: user.email, 
            name: user.name || user.email.split('@')[0] 
          }, 
          url 
        });
      },
    },
    
    // Trusted origins for CORS
    trustedOrigins: getTrustedOrigins(),
    
    // Social providers (optional)
    socialProviders: {
      google: {
        clientId: process.env.GOOGLE_CLIENT_ID || "",
        clientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
        enabled: !!process.env.GOOGLE_CLIENT_ID,
      }
    },
    
    // Plugins
    plugins: [
      // Organization plugin for multi-tenant support
      organization({
        allowUserToCreateOrganization: true,
        creatorRole: "owner",
        membershipLimit: 100,
        organizationLimit: 5,
        
        async sendInvitationEmail(data) {
          await sendOrganizationInviteEmail(data);
        },
        
        organizationHooks: {
          beforeCreateOrganization: async ({ organization, user }) => {
            console.log(`Creating organization: ${organization.name} for user: ${user.email}`);
            return {
              data: {
                ...organization,
                slug: organization.slug?.toLowerCase().replace(/\s+/g, '-'),
              },
            };
          },
          
          afterCreateOrganization: async ({ organization }) => {
            console.log(`Organization ${organization.name} created successfully`);
          },
          
          beforeAddMember: async ({ member, user, organization }) => {
            console.log(`Adding ${user.email} to ${organization.name}`);
            return { data: { ...member } };
          },
          
          afterAddMember: async ({ user, organization }) => {
            console.log(`${user.email} successfully added to ${organization.name}`);
          },
          
          afterCreateInvitation: async ({ invitation, organization }) => {
            console.log(`Invitation sent to ${invitation.email} for ${organization.name}`);
          },
          
          afterAcceptInvitation: async ({ user, organization }) => {
            console.log(`${user.email} accepted invitation to ${organization.name}`);
          },
        },
      }),
      
      // Multi-session support
      multiSession({
        maximumSessions: 5,
      }),
      
      // Magic Link plugin
      magicLink({
        sendMagicLink: async ({ email, url, token }, ctx) => {
          // Try to extract portal/form settings from the URL if available
          let portalSettings: any = undefined;
          
          try {
            const urlObj = new URL(url);
            const formId = urlObj.searchParams.get('formId');
            
            if (formId) {
              // Fetch portal settings from API
              const baseUrl = process.env.NEXT_PUBLIC_GO_API_URL || 'https://api.maticsapp.com/api/v1';
              const formResponse = await fetch(`${baseUrl}/forms/${formId}`, {
                headers: {
                  'Content-Type': 'application/json',
                },
              });
              
              if (formResponse.ok) {
                const formData = await formResponse.json();
                const settings = formData.settings || {};
                
                portalSettings = {
                  name: settings.name || formData.name,
                  emailSenderName: settings.emailSenderName,
                };
              }
            }
          } catch (error) {
            console.error('[Better Auth] Error fetching portal settings for magic link:', error);
          }
          
          await sendMagicLink({
            user: { name: email.split('@')[0], email },
            url,
            portalSettings,
          });
        },
        expiresIn: 1200, // 20 minutes
        disableSignUp: false,
      }),
    ],
    
    // Custom table names with snake_case column mapping
    user: {
      modelName: "ba_users",
      fields: {
        emailVerified: "email_verified",
        createdAt: "created_at",
        updatedAt: "updated_at",
      },
      additionalFields: {
        supabaseUserId: {
          type: "string" as const,
          required: false,
          input: false,
          fieldName: "supabase_user_id",
        },
        migratedFromSupabase: {
          type: "boolean" as const,
          required: false,
          defaultValue: false,
          input: false,
          fieldName: "migrated_from_supabase",
        },
        fullName: {
          type: "string" as const,
          required: false,
          fieldName: "full_name",
        },
        avatarUrl: {
          type: "string" as const,
          required: false,
          fieldName: "avatar_url",
        },
        userType: {
          type: "string" as const,
          required: false,
          defaultValue: "applicant",
          fieldName: "user_type",
          input: true,
        },
      },
    },
    
    session: {
      modelName: "ba_sessions",
      expiresIn: 60 * 60 * 24 * 7, // 7 days
      updateAge: 60 * 60 * 24, // Update every 24 hours
      freshAge: 60 * 15, // 15 minutes
      cookieCache: {
        enabled: true,
        maxAge: 5 * 60, // 5 minutes
        strategy: "compact" as const,
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
    
    // Advanced cookie configuration
    advanced: {
      cookies: {
        sessionToken: getCookieConfig("better-auth.session_token"),
      },
      crossSubdomainCookies: {
        enabled: true,
        domain: ".maticsapp.com",
      },
      defaultCookieAttributes: {
        sameSite: process.env.NODE_ENV === "production" ? ("none" as const) : ("lax" as const),
        secure: process.env.NODE_ENV === "production",
        httpOnly: true,
        path: "/",
        domain: process.env.NODE_ENV === "production" ? ".maticsapp.com" : undefined,
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
export default createMainAuthConfig;
