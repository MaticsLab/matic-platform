# Better Auth Usage Guide

## Overview

This application uses **Better Auth** as the primary authentication system. All user authentication, session management, and authorization is handled through Better Auth.

## Architecture

- **Frontend**: Better Auth React client (`better-auth/react`)
- **Backend**: Better Auth Next.js API routes (`/api/auth/[...all]`)
- **Database**: PostgreSQL with Better Auth tables (`ba_users`, `ba_sessions`, `ba_accounts`, `ba_verifications`)
- **Go Backend**: Validates Better Auth session tokens from the database

## Authentication Flow

1. User logs in via `/login` page using Better Auth
2. Better Auth creates a session and stores it in `ba_sessions` table
3. Session token is stored in HTTP-only cookies
4. All API requests include the session token in cookies
5. Go backend validates tokens by looking them up in `ba_sessions` table

## Frontend Usage

### Getting the Current User

```typescript
import { useSession } from '@/lib/better-auth-client'

function MyComponent() {
  const { data, isPending } = useSession()
  const user = data?.user
  
  if (isPending) return <div>Loading...</div>
  if (!user) return <div>Not logged in</div>
  
  return <div>Hello, {user.name || user.email}</div>
}
```

### Getting Session Token for API Calls

```typescript
import { getSessionToken } from '@/lib/supabase' // Still in supabase.ts but uses Better Auth

const token = await getSessionToken()
// Use token in Authorization header: `Bearer ${token}`
```

### Signing In

```typescript
import { authClient } from '@/lib/better-auth-client'

const result = await authClient.signIn.email({
  email: 'user@example.com',
  password: 'password123'
})

if (result.error) {
  console.error('Login failed:', result.error.message)
} else {
  console.log('Logged in:', result.data?.user)
}
```

### Signing Up

```typescript
import { authClient } from '@/lib/better-auth-client'

const result = await authClient.signUp.email({
  email: 'user@example.com',
  password: 'password123',
  name: 'John Doe'
})
```

### Signing Out

```typescript
import { authClient } from '@/lib/better-auth-client'

await authClient.signOut()
```

### OAuth Sign-In

```typescript
import { signIn } from '@/lib/better-auth-client'

await signIn.social({
  provider: 'google', // or 'github'
  callbackURL: `${window.location.origin}/auth/callback`
})
```

### Updating User Profile

```typescript
import { authClient } from '@/lib/better-auth-client'

const result = await authClient.updateUser({
  name: 'New Name',
  email: 'newemail@example.com',
  image: 'https://example.com/avatar.jpg'
})
```

## Server-Side Usage (API Routes)

### Validating Session

```typescript
import { auth } from '@/lib/better-auth'
import { headers } from 'next/headers'

export async function GET(request: Request) {
  const headersList = await headers()
  const session = await auth.api.getSession({
    headers: headersList,
  })
  
  if (!session?.user) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 }
    )
  }
  
  // Use session.user.id, session.user.email, etc.
  return NextResponse.json({ user: session.user })
}
```

## Go Backend Usage

The Go backend validates Better Auth tokens by:

1. Checking if the token exists in `ba_sessions` table
2. Verifying the session is not expired
3. Loading associated user data
4. Setting user context in Gin request

Example:
```go
// Middleware automatically validates and sets user context
// Access user info in handlers:
userID, exists := middleware.GetUserID(c)
email, exists := middleware.GetUserEmail(c)
```

## Environment Variables

Required environment variables:

```bash
# Better Auth
BETTER_AUTH_SECRET=your-secret-key-here
BETTER_AUTH_URL=https://your-domain.com
NEXT_PUBLIC_APP_URL=https://your-domain.com

# Database (for Better Auth tables)
DATABASE_URL=postgresql://...

# Email (for password reset, etc.)
RESEND_API_KEY=your-resend-api-key
EMAIL_FROM=noreply@yourdomain.com

# OAuth (optional)
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
GITHUB_CLIENT_ID=...
GITHUB_CLIENT_SECRET=...
```

## Database Schema

Better Auth uses these tables:

- `ba_users` - User accounts
- `ba_sessions` - Active user sessions
- `ba_accounts` - OAuth/linked accounts
- `ba_verifications` - Email verification and password reset tokens
- `ba_organizations` - Organizations (multi-tenant support)
- `ba_organization_members` - Organization membership

## Migration from Supabase Auth

See [MIGRATION_TO_BETTER_AUTH.md](./MIGRATION_TO_BETTER_AUTH.md) for details on how we migrated from Supabase Auth.

## Important Notes

1. **Supabase is still used** for database queries and realtime subscriptions, but NOT for authentication
2. **Session tokens** are stored in HTTP-only cookies for security
3. **Password reset** emails are sent via Resend
4. **Multi-tenant support** is available through Better Auth's organization plugin
5. **OAuth providers** (Google, GitHub) can be configured via environment variables

## Troubleshooting

### Session not persisting
- Check that cookies are enabled in browser
- Verify `BETTER_AUTH_URL` matches your domain
- Ensure `BETTER_AUTH_SECRET` is set correctly

### API authentication failing
- Verify session token is being sent in cookies
- Check that `ba_sessions` table exists and has data
- Ensure Go backend has access to the database

### OAuth not working
- Verify OAuth credentials in environment variables
- Check redirect URLs are whitelisted in OAuth provider settings
- Ensure `/auth/callback` route is accessible

