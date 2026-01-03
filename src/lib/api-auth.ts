/**
 * Centralized API Route Authentication
 * 
 * Provides reusable auth helpers for Next.js API routes to reduce duplication
 * and ensure consistent authentication handling.
 */

import { auth } from '@/lib/better-auth'
import { NextRequest, NextResponse } from 'next/server'

export type AuthContext = {
  user: {
    id: string
    email: string
    name: string | null
    emailVerified: boolean
    image?: string | null
  }
  session: {
    id: string
    token: string
    expiresAt: Date
  }
  organizationId?: string
}

/**
 * Require authentication for an API route.
 * Returns either authenticated context or an error response.
 * 
 * @example
 * ```typescript
 * export async function GET(request: NextRequest) {
 *   const authResult = await requireAuth(request)
 *   if (!authResult.success) {
 *     return authResult.response
 *   }
 *   
 *   const { user, session } = authResult.context
 *   // Use authenticated user...
 * }
 * ```
 */
export async function requireAuth(
  request?: NextRequest | Request | null
): Promise<
  | { success: true; context: AuthContext }
  | { success: false; response: NextResponse }
> {
  try {
    let headersList: Headers

    if (request instanceof Request) {
      headersList = request.headers
    } else if (request instanceof NextRequest) {
      headersList = request.headers
    } else {
      // Server-side without request object (e.g., Server Actions)
      // Dynamic import to avoid bundling next/headers in client code
      const { headers } = await import('next/headers')
      headersList = await headers()
    }

    const session = await auth.api.getSession({ headers: headersList })

    if (!session?.user || !session?.session) {
      return {
        success: false,
        response: NextResponse.json(
          { error: 'Unauthorized', code: 'UNAUTHORIZED' },
          { status: 401 }
        ),
      }
    }

    return {
      success: true,
      context: {
        user: {
          id: session.user.id,
          email: session.user.email,
          name: session.user.name,
          emailVerified: session.user.emailVerified ?? false,
          image: session.user.image ?? undefined,
        },
        session: {
          id: session.session.id,
          token: session.token,
          expiresAt: session.session.expiresAt,
        },
        organizationId: session.organizationId,
      },
    }
  } catch (error) {
    console.error('[API Auth] Session validation failed:', error)
    return {
      success: false,
      response: NextResponse.json(
        { error: 'Authentication failed', code: 'AUTH_ERROR' },
        { status: 500 }
      ),
    }
  }
}

/**
 * Optional authentication - returns context if user is authenticated,
 * but doesn't fail if not authenticated.
 */
export async function optionalAuth(
  request?: NextRequest | Request | null
): Promise<AuthContext | null> {
  const result = await requireAuth(request)
  return result.success ? result.context : null
}

