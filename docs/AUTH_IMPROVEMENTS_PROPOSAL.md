# Authentication Improvements Proposal

## Current State Analysis

### ✅ What's Working Well
- Better Auth is properly configured with organization and multi-session plugins
- Go backend validates Better Auth tokens correctly
- Basic auth helpers exist (`auth-helpers.ts`)
- Session management via cookies works

### 🔧 Areas for Improvement

1. **No Route Protection Middleware** - Routes are manually checked in components
2. **No Centralized API Auth** - Each API route duplicates auth checks
3. **No Type-Safe Auth Helpers** - Some helpers use `any` types
4. **No RBAC Middleware** - Role checks are scattered
5. **Limited Error Handling** - Auth errors aren't standardized
6. **No Protected Route Component** - Pages manually redirect on auth failure
7. **Organization/Workspace Context** - Not fully integrated with Better Auth orgs

## Proposed Improvements

### 1. Next.js Middleware Route Protection

**Current Issue:** `src/middleware.ts` only handles subdomain routing, doesn't protect routes.

**Solution:** Add authentication checks to middleware.

```typescript
// src/middleware.ts improvements
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { auth } from '@/lib/better-auth'

// Public routes that don't require auth
const PUBLIC_ROUTES = [
  '/login',
  '/signup',
  '/auth/callback',
  '/auth/reset-password',
  '/auth/set-password',
  '/apply', // Public portal
]

// Routes that require auth but allow workspace context
const PROTECTED_ROUTES = [
  '/workspace',
  '/api/workflows',
  '/api/integrations',
  // ... etc
]

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  
  // Skip API routes (handled by API middleware)
  if (pathname.startsWith('/api/auth')) {
    return NextResponse.next()
  }
  
  // Check if route is public
  const isPublicRoute = PUBLIC_ROUTES.some(route => 
    pathname.startsWith(route)
  )
  
  if (isPublicRoute) {
    return NextResponse.next()
  }
  
  // Check if route requires auth
  const requiresAuth = PROTECTED_ROUTES.some(route => 
    pathname.startsWith(route)
  )
  
  if (requiresAuth) {
    // Validate session
    const session = await auth.api.getSession({
      headers: request.headers,
    })
    
    if (!session?.user) {
      const loginUrl = new URL('/login', request.url)
      loginUrl.searchParams.set('redirect', pathname)
      return NextResponse.redirect(loginUrl)
    }
  }
  
  // Continue with existing subdomain routing logic
  // ... rest of middleware
}
```

### 2. Centralized API Route Authentication

**Current Issue:** Each API route duplicates `auth.api.getSession()` logic.

**Solution:** Create reusable auth middleware helper.

```typescript
// src/lib/api-auth.ts
import { auth } from '@/lib/better-auth'
import { NextRequest, NextResponse } from 'next/server'
import { headers } from 'next/headers'

export type AuthContext = {
  user: {
    id: string
    email: string
    name: string | null
  }
  session: {
    id: string
    token: string
  }
  organizationId?: string
}

export async function requireAuth(
  request: NextRequest | Request
): Promise<{ success: true; context: AuthContext } | { success: false; response: NextResponse }> {
  const headersList = request instanceof Request 
    ? request.headers 
    : await headers()
  
  const session = await auth.api.getSession({ headers: headersList })
  
  if (!session?.user) {
    return {
      success: false,
      response: NextResponse.json(
        { error: 'Unauthorized' },
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
      },
      session: {
        id: session.session.id,
        token: session.token,
      },
      organizationId: session.organizationId,
    },
  }
}

// Usage in API routes:
export async function GET(request: NextRequest) {
  const authResult = await requireAuth(request)
  if (!authResult.success) {
    return authResult.response
  }
  
  const { user, session } = authResult.context
  // ... rest of handler
}
```

### 3. Protected Route Component

**Current Issue:** Pages manually check auth in `useEffect` and redirect.

**Solution:** Create a `ProtectedRoute` wrapper component.

```typescript
// src/components/auth/ProtectedRoute.tsx
'use client'

import { useSession } from '@/lib/better-auth-client'
import { useRouter } from 'next/navigation'
import { useEffect, ReactNode } from 'react'

interface ProtectedRouteProps {
  children: ReactNode
  redirectTo?: string
  requireOrganization?: boolean
}

export function ProtectedRoute({ 
  children, 
  redirectTo = '/login',
  requireOrganization = false 
}: ProtectedRouteProps) {
  const { data, isPending } = useSession()
  const router = useRouter()
  
  useEffect(() => {
    if (isPending) return
    
    if (!data?.session) {
      router.push(`${redirectTo}?redirect=${encodeURIComponent(window.location.pathname)}`)
      return
    }
    
    if (requireOrganization && !data.organizationId) {
      router.push('/workspaces')
      return
    }
  }, [data, isPending, router, redirectTo, requireOrganization])
  
  if (isPending) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4" />
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    )
  }
  
  if (!data?.session) {
    return null // Will redirect
  }
  
  if (requireOrganization && !data.organizationId) {
    return null // Will redirect
  }
  
  return <>{children}</>
}

// Usage:
export default function WorkspacePage() {
  return (
    <ProtectedRoute requireOrganization>
      <WorkspaceContent />
    </ProtectedRoute>
  )
}
```

### 4. Role-Based Access Control (RBAC) Helpers

**Current Issue:** Role checks are scattered throughout codebase.

**Solution:** Create RBAC helpers and middleware.

```typescript
// src/lib/rbac.ts
import { auth } from '@/lib/better-auth'
import { headers } from 'next/headers'

export type WorkspaceRole = 'owner' | 'editor' | 'viewer'
export type OrganizationRole = 'owner' | 'admin' | 'member'

export interface PermissionContext {
  userId: string
  workspaceId?: string
  workspaceRole?: WorkspaceRole
  organizationId?: string
  organizationRole?: OrganizationRole
}

export async function getPermissionContext(
  workspaceId?: string
): Promise<PermissionContext | null> {
  const headersList = await headers()
  const session = await auth.api.getSession({ headers: headersList })
  
  if (!session?.user) {
    return null
  }
  
  const context: PermissionContext = {
    userId: session.user.id,
    organizationId: session.organizationId,
  }
  
  if (workspaceId) {
    // Fetch workspace membership (from your API or database)
    // This would call your workspace membership API
    const membership = await getWorkspaceMembership(
      session.user.id,
      workspaceId
    )
    
    if (membership) {
      context.workspaceId = workspaceId
      context.workspaceRole = membership.role as WorkspaceRole
    }
  }
  
  if (session.organizationId) {
    // Fetch organization membership from Better Auth
    const orgMember = await auth.api.getOrganizationMember({
      headers: headersList,
      organizationId: session.organizationId,
      userId: session.user.id,
    })
    
    if (orgMember) {
      context.organizationRole = orgMember.role as OrganizationRole
    }
  }
  
  return context
}

export function hasPermission(
  context: PermissionContext,
  permission: string
): boolean {
  // Define permission matrix
  const permissions: Record<string, WorkspaceRole[]> = {
    'workspace:create_table': ['owner', 'editor'],
    'workspace:delete_table': ['owner'],
    'workspace:manage_members': ['owner'],
    'workspace:export_data': ['owner', 'editor', 'viewer'],
    // ... etc
  }
  
  const requiredRoles = permissions[permission]
  if (!requiredRoles) return false
  
  if (context.workspaceRole) {
    return requiredRoles.includes(context.workspaceRole)
  }
  
  return false
}

// Usage in API routes:
export async function POST(
  request: NextRequest,
  { params }: { params: { workspaceId: string } }
) {
  const authResult = await requireAuth(request)
  if (!authResult.success) {
    return authResult.response
  }
  
  const context = await getPermissionContext(params.workspaceId)
  if (!context || !hasPermission(context, 'workspace:create_table')) {
    return NextResponse.json(
      { error: 'Forbidden' },
      { status: 403 }
    )
  }
  
  // ... create table
}
```

### 5. Better Auth Helpers with Type Safety

**Solution:** Improve `auth-helpers.ts` with better types.

```typescript
// src/lib/auth-helpers.ts improvements
import { auth } from '@/lib/better-auth'
import { authClient } from '@/lib/better-auth-client'
import { headers } from 'next/headers'

export type AuthUser = {
  id: string
  email: string
  name: string | null
  emailVerified: boolean
  createdAt: Date
  image?: string | null
}

export type AuthSession = {
  id: string
  userId: string
  token: string
  expiresAt: Date
  organizationId?: string
}

export async function getAuthUser(): Promise<AuthUser | null> {
  try {
    const session = await auth.api.getSession({
      headers: headers(),
    })
    
    if (!session?.user) {
      return null
    }
    
    return {
      id: session.user.id,
      email: session.user.email,
      name: session.user.name,
      emailVerified: session.user.emailVerified,
      createdAt: session.user.createdAt,
      image: session.user.image,
    }
  } catch (error) {
    console.error('[Auth Helper] Session fetch failed:', error)
    return null
  }
}

export async function requireAuthUser(): Promise<AuthUser> {
  const user = await getAuthUser()
  if (!user) {
    throw new Error('Unauthorized')
  }
  return user
}

// Client-side version
export function useAuthUser() {
  const { data } = useSession()
  return data?.user ? {
    id: data.user.id,
    email: data.user.email,
    name: data.user.name,
    emailVerified: data.user.emailVerified,
    createdAt: data.user.createdAt,
    image: data.user.image,
  } : null
}
```

### 6. Organization Context Integration

**Solution:** Better integration with Better Auth organizations.

```typescript
// src/lib/organization-context.ts
import { auth } from '@/lib/better-auth'
import { headers } from 'next/headers'

export async function getActiveOrganization() {
  const headersList = await headers()
  const session = await auth.api.getSession({ headers: headersList })
  
  if (!session?.organizationId) {
    return null
  }
  
  // Use Better Auth's organization API
  const organization = await auth.api.getOrganization({
    headers: headersList,
    organizationId: session.organizationId,
  })
  
  return organization
}

export async function switchOrganization(organizationId: string) {
  // Update session's active organization
  // This would use Better Auth's API to switch context
  const headersList = await headers()
  await auth.api.setActiveOrganization({
    headers: headersList,
    organizationId,
  })
}
```

### 7. Improved Error Handling

**Solution:** Standardized auth error responses.

```typescript
// src/lib/auth-errors.ts
export class AuthError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 401
  ) {
    super(message)
    this.name = 'AuthError'
  }
}

export const AuthErrors = {
  UNAUTHORIZED: new AuthError('Unauthorized', 'UNAUTHORIZED', 401),
  FORBIDDEN: new AuthError('Forbidden', 'FORBIDDEN', 403),
  SESSION_EXPIRED: new AuthError('Session expired', 'SESSION_EXPIRED', 401),
  INVALID_TOKEN: new AuthError('Invalid token', 'INVALID_TOKEN', 401),
  MISSING_PERMISSION: new AuthError(
    'Missing required permission',
    'MISSING_PERMISSION',
    403
  ),
}

export function handleAuthError(error: unknown): NextResponse {
  if (error instanceof AuthError) {
    return NextResponse.json(
      {
        error: error.message,
        code: error.code,
      },
      { status: error.statusCode }
    )
  }
  
  return NextResponse.json(
    { error: 'Internal server error' },
    { status: 500 }
  )
}
```

## Implementation Priority

### Phase 1: Core Infrastructure (High Priority)
1. ✅ Create `requireAuth` helper for API routes
2. ✅ Create `ProtectedRoute` component
3. ✅ Add route protection to Next.js middleware
4. ✅ Improve `auth-helpers.ts` with better types

### Phase 2: RBAC (Medium Priority)
5. ✅ Create RBAC helpers and permission system
6. ✅ Integrate with workspace/organization roles

### Phase 3: Polish (Low Priority)
7. ✅ Improve error handling
8. ✅ Better organization context integration
9. ✅ Add comprehensive tests

## Benefits

1. **Less Code Duplication** - Centralized auth logic
2. **Type Safety** - Better TypeScript support
3. **Consistency** - Standardized auth patterns
4. **Security** - Centralized validation reduces bugs
5. **Developer Experience** - Easier to use, clearer APIs
6. **Maintainability** - Changes in one place affect all routes

## Migration Path

1. Start with API route helpers (non-breaking)
2. Add ProtectedRoute component (optional usage)
3. Gradually migrate routes to use new helpers
4. Add middleware protection (careful testing)
5. Add RBAC system (incremental rollout)

