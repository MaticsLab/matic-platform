/**
 * Main Platform Better Auth Configuration
 *
 * This is the centralized configuration for the main platform auth.
 * Schema/migrations for AuthDB are managed with Drizzle Kit (see drizzle.config.ts,
 * src/drizzle/schemas/auth-schema.ts) — run `npm run db:generate` / `npm run db:migrate`.
 * Types can still be regenerated with:
 *
 *   npx @better-auth/cli generate --config auth/config/main.ts
 */

import { betterAuth } from "better-auth";
import { nextCookies } from "better-auth/next-js";
import { organization, multiSession, magicLink } from "better-auth/plugins";
import { twoFactor } from "better-auth/plugins/two-factor";
import { passkey } from "better-auth/plugins/passkey";
import { admin as adminPlugin } from "better-auth/plugins/admin";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { stripe } from "@better-auth/stripe";
import Stripe from "stripe";
import { db } from "@/drizzle/db";
import { getBaseURL, getTrustedOrigins, getCookieConfig, getCookieDomain } from "../lib/helpers";
import { sendPasswordResetEmail } from "@/lib/emails/password-reset-email";
import { sendMagicLink } from "@/lib/emails/magic-link-email";
import { sendOrganizationInviteEmail } from "@/lib/emails/organization-invite-email";
import { ac, admin, user as userRole } from "@/lib/auth/permissions";
import { STRIPE_PLANS } from "@/lib/auth/stripe-plans";

const stripeClient = new Stripe(process.env.STRIPE_SECRET_KEY || "", {
  apiVersion: "2025-08-27.basil",
});

/**
 * Create the main platform auth configuration
 * This contains all plugins: organization, multiSession, magicLink, twoFactor,
 * passkey, admin, stripe
 */
export function createMainAuthConfig() {
  const cookieDomain = getCookieDomain();

  if (!process.env.BETTER_AUTH_SECRET) {
    throw new Error('[Better Auth] Cannot create auth: BETTER_AUTH_SECRET not set');
  }

  return betterAuth({
    appName: "Matic Platform",
    baseURL: getBaseURL(),
    basePath: "/api/auth",
    secret: process.env.BETTER_AUTH_SECRET,
    database: drizzleAdapter(db, { provider: "pg" }),
    emailAndPassword: {
      enabled: true,
      requireEmailVerification: false,
      autoSignIn: true,
      sendResetPassword: async ({ user, url }) => {
        await sendPasswordResetEmail({ 
          user: { 
            email: user.email ?? "",
            name: user.name || user.email?.split('@')[0] || "User"
          }, 
          url 
        });
      },
    },
    trustedOrigins: getTrustedOrigins(),
    socialProviders: {
      google: {
        clientId: process.env.GOOGLE_CLIENT_ID || "",
        clientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
        enabled: !!process.env.GOOGLE_CLIENT_ID,
      }
    },
    plugins: [
      nextCookies(),
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
      multiSession({
        maximumSessions: 5,
      }),
      magicLink({
        sendMagicLink: async ({ email, url, token }, ctx) => {
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
      twoFactor(),
      passkey(),
      adminPlugin({
        ac,
        roles: {
          admin,
          user: userRole,
        },
      }),
      stripe({
        stripeClient,
        stripeWebhookSecret: process.env.STRIPE_WEBHOOK_SECRET || "",
        createCustomerOnSignUp: true,
        subscription: {
          enabled: true,
          plans: STRIPE_PLANS,
        },
      }),
    ],
    user: {
      // Table/column names now come directly from the Drizzle schema
      // (src/drizzle/schemas/auth-schema.ts) — no modelName/fields overrides needed.
      additionalFields: {
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
      expiresIn: 60 * 60 * 24 * 7, // 7 days
      updateAge: 60 * 60 * 24, // Update every 24 hours
      freshAge: 60 * 15, // 15 minutes
      cookieCache: {
        enabled: true,
        maxAge: 5 * 60, // 5 minutes
        strategy: "compact" as const,
      },
    },
    advanced: {
      cookies: {
        sessionToken: getCookieConfig("better-auth.session_token"),
      },
      crossSubDomainCookies: {
        enabled: !!cookieDomain,
        domain: cookieDomain,
      },
      defaultCookieAttributes: {
        sameSite: process.env.NODE_ENV === "production" ? ("none" as const) : ("lax" as const),
        secure: process.env.NODE_ENV === "production",
        httpOnly: true,
        path: "/",
        domain: cookieDomain,
      },
    },
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
