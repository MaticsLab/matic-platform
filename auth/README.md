# Better Auth Configuration

Centralized Better Auth setup for Matic Platform.

## Structure

```
auth/
├── config/              # Configuration files
│   ├── main.ts         # Main platform auth config
│   └── portal.ts       # Portal auth config
├── lib/                # Shared utilities
│   ├── database.ts     # Database pool management
│   ├── email.ts        # Email sending (Resend)
│   └── helpers.ts      # Auth helpers
├── server/             # Server-side auth instances
│   ├── main.ts         # Export main auth instance
│   └── portal.ts       # Export portal auth instance
├── client/             # Client-side exports
│   ├── main.ts         # Main app client
│   └── portal.ts       # Portal client
└── types/              # TypeScript types
    └── index.ts        # Shared auth types
```

## Usage

### Server-side (API Routes)
```typescript
import { auth } from '@/auth/server/main'
// or
import { portalAuth } from '@/auth/server/portal'
```

### Client-side (React Components)
```typescript
import { authClient, useSession } from '@/auth/client/main'
// or
import { portalAuthClient } from '@/auth/client/portal'
```

## Environment Variables

Required:
- `DATABASE_URL` - PostgreSQL connection string
- `BETTER_AUTH_SECRET` - Secret for session encryption
- `BETTER_AUTH_URL` - Base URL for auth endpoints

Optional:
- `RESEND_API_KEY` - For email sending
- `RESEND_FROM_EMAIL` - From address for emails

## Better Auth CLI

Generate types:
```bash
npx @better-auth/cli generate --config auth/config/main.ts
```

Run migrations:
```bash
npx @better-auth/cli migrate --config auth/config/main.ts
```
