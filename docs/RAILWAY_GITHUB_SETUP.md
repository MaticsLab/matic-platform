# Railway + GitHub Setup (Monorepo)

This repository is configured for two Railway services:
- Frontend service (Next.js) from repository root.
- Backend service (Go/Gin) from go-backend.

## 1) Connect GitHub Repository

1. Push your current branch to GitHub.
2. In Railway, create a new project.
3. Choose Deploy from GitHub repo.

## 2) Create Frontend Service

1. Add service from this repo.
2. Set Root Directory to .
3. Railway will use railway.json at repo root.
4. Ensure build/start commands are detected as:
   - Build: npm run build
   - Start: npm run start:railway

Frontend environment variables:

- NODE_ENV=production
- NEXT_PUBLIC_APP_URL=https://<frontend-domain>
- NEXT_PUBLIC_GO_API_URL=https://<backend-domain>/api/v1
- NEXT_PUBLIC_SUPABASE_URL=<your-supabase-url>
- NEXT_PUBLIC_SUPABASE_ANON_KEY=<your-supabase-anon-key>
- BETTER_AUTH_URL=https://<frontend-domain>
- BETTER_AUTH_SECRET=<same-secret-used-everywhere>
- BETTER_AUTH_DATABASE_URL=${{AuthDB.DATABASE_URL}}
- DATABASE_URL=<main app db url or ${{AppDB.DATABASE_URL}}>

Optional but commonly needed:
- RESEND_API_KEY
- EMAIL_FROM
- GOOGLE_CLIENT_ID
- GOOGLE_CLIENT_SECRET

## 3) Create Backend Service

1. Add another service from the same repo.
2. Set Root Directory to go-backend.
3. Railway will use go-backend/railway.json.

Backend environment variables:

- PORT=${{PORT}}
- GIN_MODE=release
- DATABASE_URL=<main app db url or ${{AppDB.DATABASE_URL}}>
- ALLOWED_ORIGINS=https://<frontend-domain>
- BETTER_AUTH_SECRET=<same-secret-used-on-frontend>
- BETTER_AUTH_URL=https://<frontend-domain>
- SUPABASE_URL=<your-supabase-url>
- SUPABASE_ANON_KEY=<your-supabase-anon-key>
- SUPABASE_SERVICE_ROLE_KEY=<your-service-role-key>

## 4) Add Databases in Railway

Recommended layout:
- AppDB Postgres for application data.
- AuthDB Postgres for Better Auth tables.

Use variable references in services:
- Frontend BETTER_AUTH_DATABASE_URL=${{AuthDB.DATABASE_URL}}
- Frontend DATABASE_URL=${{AppDB.DATABASE_URL}} (or same as AuthDB if intentionally shared)
- Backend DATABASE_URL=${{AppDB.DATABASE_URL}}

## 5) Run Better Auth Migration

AuthDB schema is managed with Drizzle Kit (see `drizzle.config.ts` and
`src/drizzle/schemas/auth-schema.ts`), not the Better Auth CLI's raw-SQL migrations.

After frontend service has env variables set:

1. With `BETTER_AUTH_DATABASE_URL` pointed at AuthDB (its public URL works fine from
   a local shell), run:

npm run db:migrate

2. Confirm tables are created in AuthDB:
- user
- account
- session
- verification
- organization, member, invitation
- two_factor, passkey, subscription

## 6) Domains and CORS

1. Assign public domains to both services.
2. Update:
- NEXT_PUBLIC_APP_URL to frontend domain
- NEXT_PUBLIC_GO_API_URL to backend domain + /api/v1
- ALLOWED_ORIGINS to include frontend domain

## 7) Sanity Checks

- Frontend: GET /
- Backend: GET /health
- Auth route: GET /api/auth/get-session (or a sign-in flow from UI)
- Staff and applicant users share this same /api/auth/* instance, distinguished by userType

## Notes

- Better Auth code in this repo preserves ba_* table names for compatibility.
- If BETTER_AUTH_DATABASE_URL is unset, auth falls back to DATABASE_URL.
- Keep BETTER_AUTH_SECRET identical across frontend instances/environments.
