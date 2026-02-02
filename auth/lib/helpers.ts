/**
 * Better Auth Helper Utilities
 * Common functions used across auth configurations
 */

/**
 * Determine the base URL for authentication
 */
export function getBaseURL(): string {
  // Priority 1: BETTER_AUTH_URL (can be overridden for local dev)
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

/**
 * Get trusted origins for CORS
 */
export function getTrustedOrigins(): string[] {
  const APP_DOMAIN = process.env.NEXT_PUBLIC_APP_URL || 'https://maticsapp.com';
  
  return [
    // Primary domains
    "https://maticsapp.com",
    "https://www.maticsapp.com",
    APP_DOMAIN,
    // Local development
    "http://localhost:3000",
    "http://localhost:3001",
    "http://localhost:3002",
    // Dynamic origins from environment
    ...(process.env.NEXT_PUBLIC_APP_URL ? [process.env.NEXT_PUBLIC_APP_URL] : []),
    ...(process.env.NEXT_PUBLIC_SUPABASE_URL ? [process.env.NEXT_PUBLIC_SUPABASE_URL] : []),
    // Vercel preview deployments
    ...(process.env.VERCEL_URL ? [`https://${process.env.VERCEL_URL}`] : []),
    // Allow subdomains
    "https://*.vercel.app",
    "https://*.maticsapp.com",
  ];
}

/**
 * Validate critical environment variables at runtime
 */
export function validateEnv(): void {
  if (typeof window === 'undefined' && process.env.NODE_ENV !== 'test') {
    if (!process.env.BETTER_AUTH_SECRET) {
      console.error('[Better Auth] CRITICAL: BETTER_AUTH_SECRET is not set. Authentication will fail.');
    }
    if (!process.env.DATABASE_URL) {
      console.error('[Better Auth] CRITICAL: DATABASE_URL is not set. Authentication will not work.');
    }
  }
}

/**
 * Get cookie configuration based on environment
 */
export function getCookieConfig(cookieName: string) {
  const isProduction = process.env.NODE_ENV === "production";
  
  return {
    name: cookieName,
    attributes: {
      secure: isProduction,
      sameSite: isProduction ? ("none" as const) : ("lax" as const),
      domain: isProduction ? ".maticsapp.com" : undefined,
      path: "/",
      httpOnly: true,
    },
  };
}
