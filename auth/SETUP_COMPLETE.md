# Better Auth Centralized Setup - Complete! 🎉

Your Better Auth configuration has been successfully centralized into the `/auth` directory.

## 📁 Structure Created

```
auth/
├── README.md              # Documentation
├── config/
│   ├── main.ts           # Main platform config (with all plugins)
│   └── portal.ts         # Portal config (simplified)
├── lib/
│   ├── database.ts       # Shared database pool
│   ├── email.ts          # Shared email service (Resend)
│   └── helpers.ts        # Shared utilities
├── server/
│   ├── main.ts           # Server instance for main app
│   └── portal.ts         # Server instance for portal
├── client/
│   ├── main.ts           # Client instance for main app
│   └── portal.ts         # Client instance for portal
├── types/
│   └── index.ts          # Shared TypeScript types
└── index.ts              # Main exports

auth.ts (root)            # Auto-discovery file for CLI
```

## 🚀 Usage

### Server-Side (API Routes)

```typescript
// Main app auth
import { auth, getAuth } from '@/auth/server/main'

// Portal auth
import { portalAuth, getPortalAuth } from '@/auth/server/portal'
```

### Client-Side (React Components)

```typescript
// Main app
import { authClient, useSession, signIn, signOut } from '@/auth/client/main'
import { organizationAPI } from '@/auth/client/main'

// Portal
import { portalAuthClient, usePortalSession } from '@/auth/client/portal'
```

### Convenience Import (uses main auth)

```typescript
import { auth, authClient, useSession } from '@/auth'
```

## 🛠 Better Auth CLI

The CLI can now use your centralized configuration:

```bash
# Auto-discovery (uses auth.ts at root → main config)
npx @better-auth/cli generate
npx @better-auth/cli migrate
npx @better-auth/cli info

# Specific configuration
npx @better-auth/cli generate --config auth/config/main.ts
npx @better-auth/cli generate --config auth/config/portal.ts

# Output to specific file
npx @better-auth/cli generate --output src/types/auth.ts
```

## 📝 Migration Guide

### Option 1: Keep Existing Files (Recommended for now)

Your existing files in `src/lib/` still work and are unchanged:
- `src/lib/better-auth.ts` ✅ Still works
- `src/lib/better-auth-client.ts` ✅ Still works
- `src/lib/portal-better-auth.ts` ✅ Still works
- `src/lib/portal-better-auth-client.ts` ✅ Still works

### Option 2: Migrate to New Structure (When ready)

To migrate, update imports in your codebase:

**Before:**
```typescript
import { auth } from '@/lib/better-auth'
import { authClient } from '@/lib/better-auth-client'
```

**After:**
```typescript
import { auth } from '@/auth/server/main'
import { authClient } from '@/auth/client/main'
```

You can do this gradually - both approaches work simultaneously!

## 🔄 Next Steps

1. **Test the CLI:**
   ```bash
   npx @better-auth/cli info
   npx @better-auth/cli generate --config auth/config/main.ts
   ```

2. **Generate Types:**
   ```bash
   npx @better-auth/cli generate --output src/types/better-auth.d.ts
   ```

3. **Try the MCP Server (Optional):**
   The MCP server is for Claude Desktop integration, not code generation.
   If you want to use it, manually add to Claude Desktop config:
   ```bash
   claude mcp add --transport http better-auth https://mcp.inkeep.com/better-auth/mcp
   ```

## 💡 Benefits

- ✅ **CLI Support:** Generate types, run migrations with Better Auth CLI
- ✅ **Centralized:** All auth config in one place
- ✅ **Modular:** Shared utilities (database, email, helpers)
- ✅ **Clear Separation:** Server vs client, main vs portal
- ✅ **Type-Safe:** Full TypeScript support
- ✅ **Backwards Compatible:** Existing code still works

## 📚 Documentation

- Main config: [auth/config/main.ts](auth/config/main.ts)
- Portal config: [auth/config/portal.ts](auth/config/portal.ts)
- README: [auth/README.md](auth/README.md)

## 🔧 Environment Variables

Make sure these are set:
- `DATABASE_URL` - PostgreSQL connection string
- `BETTER_AUTH_SECRET` - Secret for session encryption
- `BETTER_AUTH_URL` - Base URL for auth endpoints
- `RESEND_API_KEY` - (Optional) For email sending
- `EMAIL_FROM` - (Optional) From address for emails
