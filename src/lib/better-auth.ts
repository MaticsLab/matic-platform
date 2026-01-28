import { betterAuth } from "better-auth";
import { APP_DOMAIN } from '@/constants/app-domain';
import { organization, multiSession, magicLink } from "better-auth/plugins";
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

// Create connection pool only if DATABASE_URL is available
// For Vercel serverless, we need specific pool settings
const pool = isBuildTime
  ? null
  : new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false }, // Required for Supabase
      max: 1, // Limit connections for serverless
      idleTimeoutMillis: 20000,
      connectionTimeoutMillis: 10000,
    });

// Initialize Resend for email sending
const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

// Determine the base URL for authentication
function getBaseURL() {
  // Priority 1: BETTER_AUTH_URL (can be overridden for local dev)
  // If set to localhost, use it (allows local override)
  if (process.env.BETTER_AUTH_URL) {
    const authUrl = process.env.BETTER_AUTH_URL;
    // If it's localhost, always use it
    if (authUrl.startsWith("http://localhost") || authUrl.startsWith("http://127.0.0.1")) {
      return authUrl;
    }
    // In development mode, if BETTER_AUTH_URL is production, try to detect localhost
    if (process.env.NODE_ENV === 'development' && authUrl.includes("maticsapp.com")) {
      // Check if NEXT_PUBLIC_APP_URL is localhost (local override)
      if (process.env.NEXT_PUBLIC_APP_URL) {
        const appUrl = process.env.NEXT_PUBLIC_APP_URL;
        if (appUrl.startsWith("http://localhost") || appUrl.startsWith("http://127.0.0.1")) {
          return appUrl;
        }
      }
      // In dev mode with production URL, default to localhost:3000
      // User should override BETTER_AUTH_URL in .env.local for their port
      return "http://localhost:3000";
    }
    return authUrl;
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

// Auth configuration object
const authConfig = {
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
    sendResetPassword: async ({ user, url }: { user: UserForReset; url: string }) => {
      if (!resend) {
        console.error("[Better Auth] Resend not configured - RESEND_API_KEY missing");
        return;
      }
      await resend.emails.send({
        from: process.env.EMAIL_FROM || "Matics <hello@notifications.maticsapp.com>",
        replyTo: "support@maticsapp.com",
        to: user.email,
        subject: "Reset your password - Matics",
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
              © ${new Date().getFullYear()} MaticsApp. All rights reserved.
            </p>
          </div>
        `,
      });
    },
  },

  // Trusted origins for CORS
  trustedOrigins: [
    (await import('@/constants/app-domain')).APP_DOMAIN,
    "http://localhost:3000", // Default Next.js dev server
    "http://localhost:3001",
    "http://localhost:3002",
    "https://www.maticsapp.com",
    ...(process.env.NEXT_PUBLIC_APP_URL ? [process.env.NEXT_PUBLIC_APP_URL] : []),
    ...(process.env.NEXT_PUBLIC_SUPABASE_URL ? [process.env.NEXT_PUBLIC_SUPABASE_URL] : []),
    // Vercel preview deployments
    ...(process.env.VERCEL_URL ? [`https://${process.env.VERCEL_URL}`] : []),
    // Allow any *.vercel.app subdomains for preview deployments
    "https://*.vercel.app",
    // Allow any *.maticsapp.com subdomains (custom portal subdomains)
    "https://*.maticsapp.com",
  ],

  // Social providers (can be enabled later)
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
      // Basic settings
      allowUserToCreateOrganization: true,
      creatorRole: "owner",
      
      // Limits and constraints
      membershipLimit: 100, // Limit members per organization
      organizationLimit: 5, // Limit organizations per user
      invitationLimit: 50, // Limit pending invitations
      
      // Invitation configuration
      invitationExpiresIn: 48 * 60 * 60, // 48 hours in seconds
      requireEmailVerificationOnInvitation: false,
      cancelPendingInvitationsOnReInvite: true,
      
      // Email invitation handler
      async sendInvitationEmail(data) {
        if (!resend) {
          console.error("[Better Auth] Resend not configured - RESEND_API_KEY missing");
          return;
        }
        
        const inviteLink = `${getBaseURL()}/accept-invitation/${data.id}`;
        
        await resend.emails.send({
          from: process.env.EMAIL_FROM || "Matics <hello@notifications.maticsapp.com>",
          replyTo: "support@maticsapp.com",
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
        });
      },
      
      // Organization lifecycle hooks
      organizationHooks: {
        beforeCreateOrganization: async ({ organization, user }: { organization: any; user: any }) => {
          // Custom validation logic
          console.log(`Creating organization: ${organization.name} for user: ${user.email}`);
          
          // Apply naming conventions
          return {
            data: {
              ...organization,
              slug: organization.slug?.toLowerCase().replace(/\s+/g, '-'),
            },
          };
        },
        
        afterCreateOrganization: async ({ organization, member, user }: { organization: any; member: any; user: any }) => {
          // Post-creation setup
          console.log(`Organization ${organization.name} created successfully`);
          
          // TODO: Create default workspace if needed
          // await createDefaultWorkspace(organization.id);
        },
        
        // Member lifecycle hooks
        beforeAddMember: async ({ member, user, organization }: { member: any; user: any; organization: any }) => {
          console.log(`Adding ${user.email} to ${organization.name}`);
          return { data: { ...member } };
        },
        
        afterAddMember: async ({ member, user, organization }: { member: any; user: any; organization: any }) => {
          // Send welcome email, setup user resources
          console.log(`${user.email} successfully added to ${organization.name}`);
        },
        
        // Invitation lifecycle hooks
        afterCreateInvitation: async ({ invitation, inviter, organization }: { invitation: any; inviter: any; organization: any }) => {
          // Track invitation metrics
          console.log(`Invitation sent to ${invitation.email} for ${organization.name}`);
        },
        
        afterAcceptInvitation: async ({ invitation, member, user, organization }: { invitation: any; member: any; user: any; organization: any }) => {
          // Setup new member resources
          console.log(`${user.email} accepted invitation to ${organization.name}`);
        },
      },
    }),
    
    // Multi-session support (user can be logged in on multiple devices)
    multiSession({
      maximumSessions: 5,
    }),
    
    // Magic Link plugin for passwordless authentication
    magicLink({
      sendMagicLink: async ({ email, url, token }: { email: string; url: string; token: string }, ctx: any) => {
        if (!resend) {
          console.error("[Better Auth] Resend not configured - RESEND_API_KEY missing");
          return;
        }
        
        // Extract form ID from callback URL if present
        let portalName = "Matics";
        let portalLogo = "";
        let subdomain = "";
        
        try {
          // Try multiple methods to get the callback URL with formId
          let formId: string | null = null;
          
          // Method 1: Check context request body (Better Auth passes callbackURL here)
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
          
          // Method 2: Query Better Auth verification table to get callback URL
          // Better Auth stores the callback URL in the verification record
          if (!formId && pool && token) {
            try {
              const result = await pool.query(
                'SELECT identifier FROM ba_verifications WHERE token = $1 ORDER BY created_at DESC LIMIT 1',
                [token]
              );
              
              if (result.rows.length > 0) {
                const identifier = result.rows[0].identifier;
                // The identifier might contain the callback URL or we can check the verification metadata
                // Actually, Better Auth stores callback URL differently - let's check the request
              }
            } catch (dbError) {
              console.error("[Better Auth] Database query error:", dbError);
            }
          }
          
          // Method 3: Parse from verification URL (if Better Auth includes it)
          if (!formId && url) {
            try {
              const urlObj = new URL(url);
              // Check if formId is directly in the verification URL
              formId = urlObj.searchParams.get('formId');
              
              // Or check callbackURL param
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
            const baseUrl = process.env.NEXT_PUBLIC_GO_API_URL || 'https://backend.maticslab.com/api/v1';
            const formResponse = await fetch(`${baseUrl}/forms/${formId}`, {
              headers: {
                'Content-Type': 'application/json',
              },
            });
            
            if (formResponse.ok) {
              const formData = await formResponse.json();
              const settings = formData.settings || {};
              
              // Get portal name from form settings
              portalName = settings.name || formData.name || "Matics";
              
              // Get portal logo
              portalLogo = settings.logoUrl || "";
              
              // Get subdomain if available
              if (formData.workspace_subdomain) {
                subdomain = formData.workspace_subdomain;
              }
            }
          }
        } catch (error) {
          console.error("[Better Auth] Failed to fetch portal info for magic link:", error);
          // Continue with default values
        }
        
        // Build subject with portal name
        const subject = subdomain 
          ? `${portalName} portal: Your portal access link`
          : `${portalName}: Your portal access link`;
        
        // Build email HTML with logo
        const logoHtml = portalLogo 
          ? `<div style="text-align: center; margin-bottom: 30px;">
               <img src="${portalLogo}" alt="${portalName}" style="max-width: 200px; max-height: 80px; height: auto; object-fit: contain;" />
             </div>`
          : "";
        
        await resend.emails.send({
          from: process.env.EMAIL_FROM || `${portalName} <hello@notifications.maticsapp.com>`,
          replyTo: "support@maticsapp.com",
          to: email,
          subject: subject,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
              ${logoHtml}
              <h2 style="color: #1e40af; margin-top: 0;">Hi there,</h2>
              <p style="font-size: 16px; line-height: 1.6; color: #374151;">
                Click below to instantly access your portal.
              </p>
              <div style="margin: 30px 0; text-align: center;">
                <a href="${url}" style="background-color: #1e40af; color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; display: inline-block; font-weight: 500; font-size: 16px;">
                  Go to your portal
                </a>
              </div>
              <p style="color: #6b7280; font-size: 14px; line-height: 1.6;">
                For your security, do not forward this email. Any recipient will have full access to your portal and all its content.
              </p>
              <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;" />
              <p style="color: #9ca3af; font-size: 12px; text-align: center; margin: 0;">
                © ${new Date().getFullYear()} ${portalName}. All rights reserved.
              </p>
            </div>
          `,
        });
      },
      expiresIn: 600, // 10 minutes (improved from 5 minutes based on audit)
      disableSignUp: false, // Allow sign up via magic link
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
        type: "string" as const,
        required: false,
        input: false,
        fieldName: "supabase_user_id",
      },
      // Track if user migrated from Supabase
      migratedFromSupabase: {
        type: "boolean" as const,
        required: false,
        defaultValue: false,
        input: false,
        fieldName: "migrated_from_supabase",
      },
      // Store user's full name separately
      fullName: {
        type: "string" as const,
        required: false,
        fieldName: "full_name",
      },
      // Avatar URL
      avatarUrl: {
        type: "string" as const,
        required: false,
        fieldName: "avatar_url",
      },
      // User type: staff can access main app, applicants restricted to portal
      userType: {
        type: "string" as const,
        required: false,
        defaultValue: "applicant",
        fieldName: "user_type",
        input: true, // Allow setting during signup
      },
    },
  },
  
  session: {
    modelName: "ba_sessions",
    expiresIn: 60 * 60 * 24 * 7, // 7 days
    updateAge: 60 * 60 * 24, // Update session every 24 hours
    freshAge: 60 * 15, // 15 minutes - require fresh session for sensitive operations
    cookieCache: {
      enabled: true,
      maxAge: 5 * 60, // 5 minutes cache
      strategy: "compact" as const, // Smallest size, best performance
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

  // Advanced configuration for production cookie handling
  advanced: {
    cookies: {
      sessionToken: {
        name: "better-auth.session_token",
        attributes: {
          secure: process.env.NODE_ENV === "production",
          sameSite: process.env.NODE_ENV === "production" ? ("none" as const) : ("lax" as const),
          domain: process.env.NODE_ENV === "production" ? ".maticsapp.com" : undefined,
        },
      },
    },
    // Cross-subdomain cookie sharing for *.maticsapp.com
    crossSubdomainCookies: {
      enabled: true,
      domain: ".maticsapp.com",
    },
    // Cookie attributes for security
    defaultCookieAttributes: {
      sameSite: "lax" as const, // Balance security and usability
      secure: process.env.NODE_ENV === "production",
      httpOnly: true,
      path: "/",
    },
  },

  // Rate Limiting for API protection
  rateLimit: {
    enabled: true,
    window: 60, // 1 minute window
    max: 100, // 100 requests per minute per IP
    storage: "memory" as const, // Use memory for single-server, "database" for distributed
  },
};

// Create singleton instance - must be created at module load time for Next.js
console.log('[Better Auth] Creating auth instance at module load');
export const auth = betterAuth(authConfig);

// Export types
export type Auth = ReturnType<typeof betterAuth>;
export type Session = Auth['$Infer']['Session'];
export type User = Auth['$Infer']['Session']['user'];
