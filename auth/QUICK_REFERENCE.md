# Better Auth - Quick Reference

## 🎯 Common Tasks

### Generate TypeScript Types
```bash
# Main platform
npx @better-auth/cli generate --config auth/config/main.ts

# Portal
npx @better-auth/cli generate --config auth/config/portal.ts

# Auto-discovery (uses auth.ts)
npx @better-auth/cli generate
```

### Run Migrations
```bash
npx @better-auth/cli migrate
```

### Check Configuration
```bash
npx @better-auth/cli info
```

## 📦 Import Patterns

### Server-Side (API Routes, Server Components)

```typescript
// ✅ Main platform - Full featured (organization, magic link, etc.)
import { auth } from '@/auth/server/main'

export async function GET(request: Request) {
  const session = await auth.api.getSession({ headers: request.headers })
  // ...
}
```

```typescript
// ✅ Portal - Simplified (email/password only)
import { portalAuth } from '@/auth/server/portal'

export async function POST(request: Request) {
  // Handle portal authentication
}
```

### Client-Side (React Components, Hooks)

```typescript
// ✅ Main platform client
import { authClient, useSession, signIn, signOut } from '@/auth/client/main'
import { organizationAPI } from '@/auth/client/main'

function MyComponent() {
  const { data: session } = useSession()
  const { data: org } = useActiveOrganization()
  
  return <div>Hello {session?.user?.email}</div>
}
```

```typescript
// ✅ Portal client
import { portalAuthClient, usePortalSession } from '@/auth/client/portal'

function PortalComponent() {
  const { data: session } = usePortalSession()
  return <div>Welcome {session?.user?.email}</div>
}
```

### Shared Utilities

```typescript
// Database pool
import { getPool, closePool } from '@/auth/lib/database'

// Email service
import { resend, getEmailFrom } from '@/auth/lib/email'

// Helpers
import { getBaseURL, getTrustedOrigins } from '@/auth/lib/helpers'
```

## 🔐 API Routes

### Main Platform Auth Routes

```typescript
// app/api/auth/[...all]/route.ts
import { getAuth } from "@/auth/server/main"

export const { GET, POST } = getAuth().handler
```

### Portal Auth Routes

```typescript
// app/api/portal-auth/[...all]/route.ts
import { getPortalAuth } from "@/auth/server/portal"

export const { GET, POST } = getPortalAuth().handler
```

## 🎨 Organization Features (Main App Only)

```typescript
import { organizationAPI, useActiveOrganization } from '@/auth/client/main'

// Create organization
await organizationAPI.create({
  name: "My Org",
  slug: "my-org"
})

// Invite member
await organizationAPI.inviteMember({
  email: "user@example.com",
  role: "member",
  organizationId: "org-id"
})

// Use hook
const { data: org } = useActiveOrganization()
```

## 🔄 Multi-Session (Main App Only)

```typescript
import { listSessions, revokeSession } from '@/auth/client/main'

// List all active sessions
const sessions = await listSessions()

// Revoke a specific session
await revokeSession({ sessionId: "session-id" })
```

## 🪄 Magic Link (Main App Only)

```typescript
import { authClient } from '@/auth/client/main'

// Send magic link
await authClient.signIn.magicLink({
  email: "user@example.com",
  callbackURL: "/dashboard"
})
```

## 🔑 Password Management

```typescript
// Main app
import { changePassword, resetPassword } from '@/auth/client/main'

// Portal
import { portalAuthClient } from '@/auth/client/portal'
await portalAuthClient.changePassword({ ... })
```

## 📁 File Structure Reference

```
auth/
├── config/
│   ├── main.ts           # Full config (org, magic link, multi-session)
│   └── portal.ts         # Simple config (email/password only)
├── server/
│   ├── main.ts           # Use in API routes
│   └── portal.ts         # Use in portal API routes
├── client/
│   ├── main.ts           # Use in React components
│   └── portal.ts         # Use in portal components
├── lib/
│   ├── database.ts       # Shared DB pool
│   ├── email.ts          # Shared email (Resend)
│   └── helpers.ts        # Shared utilities
└── types/
    └── index.ts          # Shared TypeScript types
```

## 🆚 Main vs Portal

| Feature | Main App | Portal |
|---------|----------|--------|
| **Endpoint** | `/api/auth` | `/api/portal-auth` |
| **Cookie** | `better-auth.session_token` | `matic-portal.session_token` |
| **Organizations** | ✅ Yes | ❌ No |
| **Magic Link** | ✅ Yes | ❌ No |
| **Multi-Session** | ✅ Yes | ❌ No |
| **Email/Password** | ✅ Yes | ✅ Yes |
| **Database** | Shared `ba_*` tables | Shared `ba_*` tables |

## 🔧 Troubleshooting

### Types not found?
```bash
npx @better-auth/cli generate
```

### Import errors?
Check tsconfig.json has:
```json
{
  "paths": {
    "@/auth/*": ["./auth/*"]
  }
}
```

### Database connection errors?
Ensure `.env` has:
```
DATABASE_URL=postgresql://...
BETTER_AUTH_SECRET=...
BETTER_AUTH_URL=http://localhost:3000
```
