# Authentication Improvements - Implementation Guide

## Overview

This guide shows you how to use the improved authentication system we've implemented while keeping Better Auth.

## Quick Start

### 1. For API Routes - Use `requireAuth()`

**Before:**
```typescript
// src/app/api/user/route.ts
export async function GET(request: Request) {
  const session = await auth.api.getSession({
    headers: request.headers,
  })

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  // Use session.user.id, etc...
}
```

**After:**
```typescript
// src/app/api/user/route.ts
import { requireAuth } from '@/lib/api-auth'

export async function GET(request: Request) {
  const authResult = await requireAuth(request)
  if (!authResult.success) {
    return authResult.response
  }

  const { user, session } = authResult.context
  // Use user.id, user.email, session.token, etc...
}
```

### 2. For Protected Pages - Use `ProtectedRoute`

**Before:**
```typescript
// src/app/workspace/[slug]/page.tsx
'use client'

import { useSession } from '@/lib/better-auth-client'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'

export default function WorkspacePage() {
  const { data, isPending } = useSession()
  const router = useRouter()

  useEffect(() => {
    if (!isPending && !data?.session) {
      router.push('/login')
    }
  }, [data, isPending, router])

  if (isPending || !data?.session) {
    return <div>Loading...</div>
  }

  return <WorkspaceContent />
}
```

**After:**
```typescript
// src/app/workspace/[slug]/page.tsx
'use client'

import { ProtectedRoute } from '@/components/auth/ProtectedRoute'

export default function WorkspacePage() {
  return (
    <ProtectedRoute>
      <WorkspaceContent />
    </ProtectedRoute>
  )
}
```

### 3. For Server Components - Use `getAuthUser()`

**Before:**
```typescript
// src/app/dashboard/page.tsx
import { auth } from '@/lib/better-auth'
import { headers } from 'next/headers'

export default async function DashboardPage() {
  const session = await auth.api.getSession({
    headers: await headers(),
  })

  if (!session?.user) {
    redirect('/login')
  }

  return <DashboardContent user={session.user} />
}
```

**After:**
```typescript
// src/app/dashboard/page.tsx
import { getAuthUser, requireAuthUser } from '@/lib/auth-helpers'
import { redirect } from 'next/navigation'

export default async function DashboardPage() {
  // Option 1: Return null if not authenticated
  const user = await getAuthUser()
  if (!user) {
    redirect('/login')
  }

  // Option 2: Throw error if not authenticated
  // const user = await requireAuthUser() // Throws if not authenticated

  return <DashboardContent user={user} />
}
```

## Available Helpers

### API Route Helpers (`src/lib/api-auth.ts`)

#### `requireAuth(request?)`
Requires authentication, returns context or error response.

```typescript
const authResult = await requireAuth(request)
if (!authResult.success) {
  return authResult.response // Already a NextResponse
}

const { user, session, organizationId } = authResult.context
```

#### `optionalAuth(request?)`
Optional authentication - returns context if authenticated, null otherwise.

```typescript
const context = await optionalAuth(request)
if (context) {
  // User is authenticated
  console.log(context.user.email)
}
```

### Server-Side Helpers (`src/lib/auth-helpers.ts`)

#### `getAuthUser()`
Get current user, returns null if not authenticated.

```typescript
const user = await getAuthUser()
if (user) {
  console.log(user.id, user.email)
}
```

#### `requireAuthUser()`
Get current user, throws error if not authenticated.

```typescript
try {
  const user = await requireAuthUser()
  // User is guaranteed to exist
} catch (error) {
  // Handle unauthorized
}
```

#### `getAuthUserId()`
Quick helper to get user ID.

```typescript
const userId = await getAuthUserId()
```

#### `getSessionToken()`
Get session token for API calls.

```typescript
const token = await getSessionToken()
// Use in Authorization header: `Bearer ${token}`
```

### Client-Side Component (`src/components/auth/ProtectedRoute.tsx`)

#### `ProtectedRoute`
Wrapper component for protected pages.

```typescript
<ProtectedRoute requireOrganization redirectTo="/login">
  <YourPageContent />
</ProtectedRoute>
```

**Props:**
- `children`: The page content to render
- `redirectTo?`: Where to redirect if not authenticated (default: '/login')
- `requireOrganization?`: Require user to have active organization
- `fallback?`: Custom loading/redirecting UI

## Migration Checklist

### Phase 1: API Routes (Recommended First)

- [ ] Update `/api/user/route.ts` to use `requireAuth()`
- [ ] Update `/api/workflows/route.ts` to use `requireAuth()`
- [ ] Update `/api/integrations/route.ts` to use `requireAuth()`
- [ ] Update other API routes as you touch them

### Phase 2: Protected Pages

- [ ] Wrap `/workspace/[slug]/page.tsx` with `ProtectedRoute`
- [ ] Wrap `/settings/page.tsx` with `ProtectedRoute`
- [ ] Remove manual auth checks from page components

### Phase 3: Server Components

- [ ] Replace `auth.api.getSession()` with `getAuthUser()`
- [ ] Use `requireAuthUser()` where authentication is required
- [ ] Use `getSessionToken()` for token-based API calls

## Benefits

✅ **Less Code** - No more duplicating auth checks
✅ **Type Safety** - Full TypeScript support
✅ **Consistency** - Same patterns everywhere
✅ **Security** - Centralized validation
✅ **Maintainability** - Change auth logic in one place

## Examples

### Example 1: Protected API Route

```typescript
// src/app/api/projects/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-auth'

export async function GET(request: NextRequest) {
  const authResult = await requireAuth(request)
  if (!authResult.success) {
    return authResult.response
  }

  const { user } = authResult.context
  // Fetch projects for this user
  const projects = await getProjectsForUser(user.id)
  
  return NextResponse.json({ projects })
}
```

### Example 2: Protected Page with Organization

```typescript
// src/app/workspace/[slug]/settings/page.tsx
'use client'

import { ProtectedRoute } from '@/components/auth/ProtectedRoute'
import { SettingsContent } from './SettingsContent'

export default function SettingsPage() {
  return (
    <ProtectedRoute requireOrganization>
      <SettingsContent />
    </ProtectedRoute>
  )
}
```

### Example 3: Server Component with Auth

```typescript
// src/app/dashboard/page.tsx
import { requireAuthUser } from '@/lib/auth-helpers'
import { redirect } from 'next/navigation'

export default async function DashboardPage() {
  const user = await requireAuthUser()
  const stats = await getDashboardStats(user.id)

  return (
    <div>
      <h1>Welcome, {user.name || user.email}</h1>
      <StatsDisplay stats={stats} />
    </div>
  )
}
```

## Next Steps

1. **Start with API routes** - Easiest migration, immediate benefits
2. **Add ProtectedRoute to pages** - Better UX, less boilerplate
3. **Update server components** - Type-safe, cleaner code
4. **Consider RBAC** - See `docs/AUTH_IMPROVEMENTS_PROPOSAL.md` for role-based access control

## Questions?

See `docs/AUTH_IMPROVEMENTS_PROPOSAL.md` for the full proposal including:
- RBAC (Role-Based Access Control) implementation
- Next.js middleware route protection
- Organization context integration
- Error handling improvements

