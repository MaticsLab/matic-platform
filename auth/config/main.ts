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
import { resend, getEmailFrom, getReplyTo, isEmailConfigured, logEmailError } from "../lib/email";
import { getBaseURL, getTrustedOrigins, getCookieConfig } from "../lib/helpers";
import { generateAuthEmail, extractDeviceInfo } from "@/lib/auth-email-helper";
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
        if (!isEmailConfigured()) {
          logEmailError("Password reset");
          return;
        }
        
        const deviceInfo = extractDeviceInfo(request);
        const { html, plainText, subject } = await generateAuthEmail({
          type: 'password-reset',
          email: user.email,
          userName: user.name,
          actionUrl: url,
          expiryMinutes: 60,
          companyName: 'Matic Platform',
          brandColor: '#2563eb',
          ...deviceInfo,
        });
        
        await resend!.emails.send({
          from: getEmailFrom(),
          replyTo: getReplyTo(),
          to: user.email,
          subject,
          html,
          text: plainText,
          tags: [
            { name: 'category', value: 'auth' },
            { name: 'type', value: 'password-reset' },
            { name: 'environment', value: process.env.NODE_ENV || 'development' },
          ],
          headers: {
            'X-Entity-Ref-ID': `pwd-reset-${user.id}`,
            'X-Priority': '1',
          },
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
        invitationLimit: 50,
        invitationExpiresIn: 48 * 60 * 60,
        requireEmailVerificationOnInvitation: false,
        cancelPendingInvitationsOnReInvite: true,
        
        async sendInvitationEmail(data) {
          if (!isEmailConfigured()) {
            logEmailError("Organization invitation");
            return;
          }
          
          const inviteLink = `${getBaseURL()}/accept-invitation/${data.id}`;
          
          await resend!.emails.send({
            from: getEmailFrom(),
            replyTo: getReplyTo(),
            to: data.email,
            subject: `You've been invited to join ${data.organization.name}`,
            html: `
              <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                <h2 style="color: #1e40af;">Join ${data.organization.name}</h2>
                <p>Hi there,</p>
                <p><strong>${data.inviter.user.name || data.inviter.user.email}</strong> has invited you to join <strong>${data.organization.name}</strong> on Matics.</p>
                <div style="margin: 30px 0; text-align: center;">
                  <a href="${inviteLink}" style="background-color: #2563eb; color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; display: inline-block; font-weight: 500; font-size: 16px;">
                    Accept Invitation
                  </a>
                </div>
                <p style="color: #6b7280; font-size: 14px; line-height: 1.6;">
                  This invitation will expire in 48 hours. If you don't want to join this organization, you can safely ignore this email.
                </p>
                <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;" />
                <p style="color: #9ca3af; font-size: 12px; text-align: center;">
                  © ${new Date().getFullYear()} Matics. All rights reserved.
                </p>
              </div>
            `,
            tags: [
              { name: 'category', value: 'organization' },
              { name: 'type', value: 'invitation' },
            ],
          });
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
          if (!isEmailConfigured()) {
            logEmailError("Magic link");
            return;
          }
          
          const deviceInfo = extractDeviceInfo(ctx?.request);
          let portalName = "Matic Platform";
          let portalLogo = "";
          let subdomain = "";
          let brandColor = "#2563eb";
          
          // Extract form ID from callback URL if present
          try {
            let formId: string | null = null;
            
            if (ctx?.request?.body) {
              const body = ctx.request.body;
              if (typeof body === 'object' && body !== null) {
                const callbackURL = (body as any).callbackURL;
                if (callbackURL && typeof callbackURL === 'string') {
                  try {
                    const callbackUrlObj = new URL(callbackURL);
                    formId = callbackUrlObj.searchParams.get('formId');
                  } catch (e) {
                    // URL parsing failed
                  }
                }
              }
            }
            
            if (!formId && url) {
              try {
                const urlObj = new URL(url);
                formId = urlObj.searchParams.get('formId');
                
                if (!formId) {
                  const callbackURL = urlObj.searchParams.get('callbackURL');
                  if (callbackURL) {
                    const callbackUrlObj = new URL(callbackURL);
                    formId = callbackUrlObj.searchParams.get('formId');
                  }
                }
              } catch (e) {
                // URL parsing failed
              }
            }
            
            // Fetch form configuration if we found formId
            if (formId) {
              const baseUrl = process.env.NEXT_PUBLIC_GO_API_URL || 'https://api.maticsapp.com/api/v1';
              const formResponse = await fetch(`${baseUrl}/forms/${formId}`, {
                headers: {
                  'Content-Type': 'application/json',
                },
              });
              
              if (formResponse.ok) {
                const formData = await formResponse.json();
                const settings = formData.settings || {};
                
                portalName = settings.name || formData.name || "Matic Platform";
                portalLogo = settings.logoUrl || "";
                brandColor = settings.primaryColor || "#2563eb";
                
                if (formData.workspace_subdomain) {
                  subdomain = formData.workspace_subdomain;
                }
              }
            }
          } catch (error) {
            console.error("[Better Auth] Failed to fetch portal info for magic link:", error);
          }
          
          const { html, plainText, subject } = await generateAuthEmail({
            type: 'magic-link',
            email,
            actionUrl: url,
            expiryMinutes: 10,
            companyName: portalName,
            companyLogo: portalLogo,
            brandColor,
            ...deviceInfo,
          });
          
          await resend!.emails.send({
            from: getEmailFrom(portalName),
            replyTo: getReplyTo(),
            to: email,
            subject,
            html,
            text: plainText,
            tags: [
              { name: 'category', value: 'auth' },
              { name: 'type', value: 'magic-link' },
              { name: 'portal', value: subdomain || 'main' },
              { name: 'environment', value: process.env.NODE_ENV || 'development' },
            ],
            headers: {
              'X-Entity-Ref-ID': `magic-link-${email}-${Date.now()}`,
              'X-Priority': '1',
            },
          });
        },
        expiresIn: 600, // 10 minutes
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
