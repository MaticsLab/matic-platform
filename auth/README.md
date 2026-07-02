# Better Auth Configuration

Centralized Better Auth setup for Matic Platform.

## Structure

```
auth/
├── config/              # Configuration files
│   └── main.ts         # Better Auth config (staff + applicants)
├── lib/                # Shared utilities
│   ├── email.ts        # Email sending (Resend)
│   └── helpers.ts      # Auth helpers
├── server/             # Server-side auth instance
│   └── main.ts         # Export auth instance
├── client/             # Client-side exports
│   └── main.ts         # Auth client
└── types/              # TypeScript types
    └── index.ts        # Shared auth types
```

Staff and applicant users share a single Better Auth instance/cookie,
distinguished by the `userType` field on the `user` table (`'staff'` vs
`'applicant'`). There is no separate portal auth surface.

## Usage

### Server-side (API Routes)
```typescript
import { auth } from '@/auth/server/main'
```

### Client-side (React Components)
```typescript
import { authClient, useSession } from '@/auth/client/main'
```

## Environment Variables

Required:
- `DATABASE_URL` - Main application PostgreSQL connection string
- `BETTER_AUTH_DATABASE_URL` - Fresh PostgreSQL database for Better Auth. Falls back to `DATABASE_URL` if unset.
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
npm run auth:migrate
```


## Fresh Schema Workflow

This project now bootstraps Better Auth from scratch. Do not import or migrate any old Supabase users or schema.

1. Create a fresh PostgreSQL database for Better Auth.
2. Set `BETTER_AUTH_DATABASE_URL` to that new database.
3. Set `BETTER_AUTH_SECRET` and `BETTER_AUTH_URL`.
4. Run `npx --yes auth@latest generate --yes --config auth/config/main.ts` to generate the schema from the current auth config.
5. Run `npm run auth:migrate` to create the Better Auth tables.
6. Start the app and verify `/api/auth/*` routes.

Notes:
- The schema is now generated directly from the current Better Auth config.
- If `BETTER_AUTH_DATABASE_URL` is unset, the auth layer falls back to `DATABASE_URL`.
