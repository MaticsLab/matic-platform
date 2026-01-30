/**
 * Auth Email Template Helper
 * 
 * Calls Go backend to generate professional Vercel/Notion-style authentication emails
 * with device information from better-auth.
 * 
 * Follows Resend best practices:
 * - Retry logic for failed requests
 * - Proper error handling
 * - Email validation
 * - Timeout handling
 * - Tags for tracking and analytics
 */

interface AuthEmailRequest {
  type: 'magic-link' | 'password-reset' | 'verification';
  email: string;
  userName?: string;
  actionUrl: string;
  expiryMinutes?: number;
  ipAddress?: string;
  userAgent?: string;
  location?: string;
  companyName?: string;
  companyLogo?: string;
  brandColor?: string;
  // Resend best practices
  tags?: { name: string; value: string }[];
}

interface AuthEmailResponse {
  html: string;
  plainText: string;
  subject: string;
}

/**
 * Generate professional authentication email using Go backend templates
 * Implements retry logic and timeout handling following Resend best practices
 * 
 * @throws Error if Go backend is unavailable or email generation fails
 */
export async function generateAuthEmail(params: AuthEmailRequest): Promise<AuthEmailResponse> {
  // Validate email format (Resend best practice - fail fast on invalid emails)
  if (!isValidEmail(params.email)) {
    throw new Error('Invalid email address format');
  }

  const GO_API_URL = process.env.NEXT_PUBLIC_GO_API_URL || 'http://localhost:8080';
  const maxRetries = 2;
  const retryDelay = 1000; // 1 second
  
  let lastError: Error | null = null;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      // Resend best practice: Add timeout to prevent hanging requests
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout

      const response = await fetch(`${GO_API_URL}/api/v1/auth/generate-email`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(params),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Failed to generate email' }));
        throw new Error(error.error || 'Failed to generate email');
      }

      const result = await response.json();
      return {
        html: result.html,
        plainText: result.plainText,
        subject: result.subject,
      };
    } catch (error: any) {
      lastError = error;
      console.error(`[Auth Email] Attempt ${attempt + 1}/${maxRetries + 1} failed:`, error.message);
      
      // Don't retry on validation errors (Resend best practice)
      if (error.message.includes('Invalid email')) {
        throw error;
      }
      
      // Retry on timeout or network errors (Resend best practice: exponential backoff)
      if (attempt < maxRetries) {
        console.log(`[Auth Email] Retrying in ${retryDelay * (attempt + 1)}ms...`);
        await new Promise(resolve => setTimeout(resolve, retryDelay * (attempt + 1)));
        continue;
      }
    }
  }
  
  // All retries failed - throw error instead of using fallback
  console.error('[Auth Email] All retries exhausted. Go backend must be running.');
  throw new Error(
    `Failed to generate email after ${maxRetries + 1} attempts. ` +
    `Ensure Go backend is running at ${GO_API_URL}. ` +
    `Last error: ${lastError?.message || 'Unknown error'}`
  );
}

/**
 * Validate email address format (Resend best practice: validate before sending)
 */
function isValidEmail(email: string): boolean {
  // RFC 5322 compliant email regex (simplified)
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email) && email.length <= 254; // Email length limit
}

/**
 * Extract device/session information from better-auth request context
 */
export function extractDeviceInfo(request?: Request): {
  ipAddress?: string;
  userAgent?: string;
  location?: string;
} {
  if (!request) {
    return {};
  }

  // Get IP address
  const ipAddress = 
    request.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
    request.headers.get('x-real-ip') ||
    undefined;

  // Get user agent
  const userAgent = request.headers.get('user-agent') || undefined;

  // Location would require an IP geolocation service (optional)
  const location = undefined;

  return {
    ipAddress,
    userAgent,
    location,
  };
}
