# Matic Platform

An Airtable-inspired platform with dynamic forms, data tables, review workflows, and a document portal — built with Next.js and a Go backend.

## Tech Stack

**Frontend**
- Next.js 14 (App Router) + React 18 + TypeScript
- Tailwind CSS + shadcn/ui (Radix primitives)
- Better Auth for authentication, with Drizzle Kit managing the auth schema

**Backend**
- Go + Gin (`go-backend/`) — the API used for writes and most reads
- PostgreSQL on Railway: a separate database per concern (app data — "AppDB" — and Better Auth — "AuthDB")
- Supabase is used for file storage only, and is in the process of being migrated to Railway buckets

**Infra**
- Both services deploy to Railway (see [docs/RAILWAY_GITHUB_SETUP.md](docs/RAILWAY_GITHUB_SETUP.md))
- CI runs on every push/PR via `.github/workflows/ci.yml`: `tsc --noEmit`, `eslint`, and `vitest` for the frontend; `go build`, `go vet`, and `go test` for the backend

## Project Structure

```
matic-platform/
├── src/                  # Next.js app
│   ├── app/              # App Router routes
│   ├── components/       # React components
│   ├── lib/              # API clients, utilities, i18n
│   └── ui-components/    # shadcn/ui components
├── auth/                 # Better Auth server/client config
├── go-backend/           # Go + Gin API
│   ├── handlers/         # Route handlers
│   ├── services/         # Business logic
│   ├── models/           # Data models
│   ├── database/         # DB connection setup
│   ├── migrations/       # SQL migrations
│   └── router/           # Route registration
├── scripts/              # One-off maintenance/migration scripts
└── docs/                 # Deeper reference docs (API, field types, migrations)
```

## Quick Start

### Prerequisites
- Node.js 18+
- Go 1.24+
- A Postgres instance (Railway or local) for app data and for Better Auth

### Setup

```bash
git clone https://github.com/MaticsLab/matic-platform.git
cd matic-platform

# Frontend
npm install
cp .env.example .env.local
# fill in DATABASE_URL, BETTER_AUTH_DATABASE_URL, BETTER_AUTH_SECRET, etc. — see .env.example for the full list

# Backend
cd go-backend
go mod download
cp .env.example .env
# fill in DATABASE_URL, JWT_SECRET, SUPABASE_URL, etc.
```

### Run

```bash
# Terminal 1 — backend (from go-backend/, runs on :8000)
go run main.go

# Terminal 2 — frontend (from the repo root, runs on :3000)
npm run dev
```

## Scripts

**Frontend** (`package.json`):
```bash
npm run dev          # Start dev server
npm run build        # Production build
npm run lint         # ESLint
npx tsc --noEmit     # Type check
npx vitest run       # Run tests
npm run db:studio    # Drizzle Studio (Better Auth schema)
```

**Backend** (`go-backend/`):
```bash
go run main.go       # Run server
go build ./...       # Build
go vet ./...         # Vet
go test ./...        # Run tests
```

## Documentation

See [docs/](docs/) for deeper references: field types, the portal API, review export API, and past migration notes.

## License

Private/proprietary — all rights reserved.
