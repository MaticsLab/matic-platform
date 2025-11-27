# Matic Platform - AI Agent Instructions

## Project Overview
Full-stack Airtable-like platform with forms, data tables, and review workflows. Built with Next.js 14 (App Router), Go/Gin backend, PostgreSQL (Supabase), and TypeScript. Hybrid architecture: Go backend for all CRUD operations, Supabase for auth and real-time updates.

## Architecture

### Data Flow (Critical Pattern)
```
Frontend Component → API Client (src/lib/api/*-client.ts)
  → Go Backend (go-backend/handlers/*.go)
  → GORM Model → PostgreSQL

Realtime: PostgreSQL → Supabase postgres_changes → Client useEffect
```

**Rule**: Frontend NEVER queries Supabase directly for data (except auth). All CRUD goes through Go backend.

### Stack
- **Frontend**: Next.js 14 App Router, React 18, TypeScript, Tailwind, shadcn/ui (`src/ui-components/`)
- **Backend**: Go 1.21+ with Gin framework, GORM ORM (`go-backend/`)
- **Database**: PostgreSQL via Supabase, schema in `docs/001_initial_schema.sql`
- **Auth**: Supabase Auth, tokens passed via `Authorization: Bearer <token>`

## Development

### Quick Start
```bash
# Terminal 1 - Backend (localhost:8080)
cd go-backend && go run main.go

# Terminal 2 - Frontend (localhost:3000)
npm run dev
```

### Environment
- Backend: `go-backend/.env` (DATABASE_URL, SUPABASE_URL, SUPABASE_ANON_KEY)
- Frontend: `.env.local` (NEXT_PUBLIC_GO_API_URL, NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY)

## Key Patterns

### Adding New API Features
1. **Model**: Add GORM model in `go-backend/models/*.go` (use `uuid.UUID`, `datatypes.JSON` for JSONB)
2. **Handler**: Create in `go-backend/handlers/your_feature.go`
3. **Route**: Register in `go-backend/router/router.go` under `/api/v1`
4. **Types**: Add TypeScript types in `src/types/*.ts`
5. **Client**: Create `src/lib/api/your-feature-client.ts` using `goFetch` from `go-client.ts`

Example handler pattern:
```go
func GetDataTable(c *gin.Context) {
    id := c.Param("id")
    var table models.DataTable
    if err := database.DB.Preload("Columns").First(&table, "id = ?", id).Error; err != nil {
        c.JSON(404, gin.H{"error": "Table not found"})
        return
    }
    c.JSON(200, table)
}
```

Example client pattern (see `src/lib/api/workflows-client.ts`):
```typescript
import { goFetch } from './go-client';
export const myClient = {
  list: (workspaceId: string) => goFetch<MyType[]>(`/my-resource?workspace_id=${workspaceId}`),
  create: (data: Partial<MyType>) => goFetch<MyType>('/my-resource', { method: 'POST', body: JSON.stringify(data) }),
};
```

### Frontend Conventions
- **Client components**: Mark with `"use client"` - most components need this
- **Imports**: Use `@/` prefix (e.g., `@/lib/api/go-client`, `@/types/data-tables`)
- **Styling**: Tailwind + `cn()` utility for conditional classes
- **Components**: shadcn/ui in `src/ui-components/`, custom in `src/components/`

### Tab System (Workspace Navigation)
`TabManager` (`src/lib/tab-manager.ts`) manages workspace tabs via localStorage:
- Always navigate through tab system, not direct Next.js `router.push()`
- `WorkspaceTabProvider.tsx` wraps workspace pages
- Overview tab auto-created if all tabs closed

## Current API Endpoints (see `go-backend/router/router.go`)

| Resource | Endpoints |
|----------|-----------|
| Workspaces | `/api/v1/workspaces` |
| Activities Hubs | `/api/v1/activities-hubs` + `/tabs` |
| Tables | `/api/v1/tables` + `/rows`, `/columns`, `/search` |
| Table Links | `/api/v1/table-links`, `/api/v1/row-links` |
| Forms | `/api/v1/forms` + `/submissions`, `/submit` |
| Search | `/api/v1/search` + `/suggestions`, `/recent`, `/popular` |
| Workflows | `/api/v1/workflows`, `/stages`, `/reviewer-types`, `/rubrics` |

## Common Pitfalls

1. **No trailing slashes**: Use `/tables/{id}/rows` not `/tables/{id}/rows/`
2. **JSONB columns**: Use `datatypes.JSON` from GORM, not `map[string]interface{}`
3. **UUID types**: Go uses `uuid.UUID`, frontend uses strings (auto-converts via JSON)
4. **Auth tokens**: `goFetch()` auto-injects token via `getSessionToken()`
5. **CORS**: Add new domains to `go-backend/router/router.go` cors config

## File Reference

**Core Files**:
- `go-backend/router/router.go` - All API routes
- `go-backend/models/*.go` - GORM models (models.go, workflows.go, search.go)
- `go-backend/handlers/*.go` - Request handlers
- `src/lib/api/go-client.ts` - Base API client with auth
- `src/lib/api/workflows-client.ts` - Reference for feature-specific clients
- `src/lib/tab-manager.ts` - Workspace tab management
- `src/components/NavigationLayout.tsx` - Main app shell

**Types**: `src/types/*.ts` (data-tables.ts, forms.ts, workspaces.ts, activities-hubs.ts)

**Schema**: `docs/001_initial_schema.sql` - Database single source of truth
