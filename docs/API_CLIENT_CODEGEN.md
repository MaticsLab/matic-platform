# API Client Codegen (swaggo → orval)

`src/lib/api/` has 30+ hand-written TypeScript clients (`tables-go-client.ts`,
`forms-client.ts`, `workspaces-client.ts`, ...) that each re-implement `fetch` +
error handling + request/response types against the Go backend by hand.
Nothing enforces that these types stay in sync with the actual Go structs —
they drift silently.

This doc describes a pipeline that generates a typed TypeScript client
directly from the Go handlers, so drift becomes a compile error instead of a
silent bug. It is currently proven on **two domains** — Tables
(`go-backend/handlers/data_tables.go`) and Forms
(`go-backend/handlers/forms.go`) — as a template for rolling it out to the
rest. **It is additive infrastructure**: none of the 30 hand-written clients
were touched or removed. They keep working exactly as before.

## The pipeline

```
Go handler doc comments (swaggo)
        │  swag init
        ▼
go-backend/docs/{swagger.json,swagger.yaml,docs.go}
        │  orval (npm run generate:api-client)
        ▼
src/lib/api/generated/{endpoints,models}/**
```

1. **Annotate** a Go handler with swaggo comments (`// @Summary`, `// @Tags`,
   `// @Param`, `// @Success`, `// @Router`, ...).
2. **`swag init`** reads those comments and the handler's Go types (including
   referenced `models.*` structs) and emits an OpenAPI 3-ish spec
   (`go-backend/docs/swagger.json`) plus a `docs.go` that registers it at
   runtime.
3. **`orval`** reads `swagger.json` and generates real, typed TypeScript
   fetch functions + interfaces into `src/lib/api/generated/`.
4. Generated calls are routed through the **existing** `goFetch` helper
   (`src/lib/api/go-client.ts`) via a custom orval "mutator", so they get the
   same auth/cookie/error handling as every hand-written client — not a
   second, differently-behaved HTTP layer.

## Running it

```bash
# 1. Regenerate the OpenAPI spec from Go handler annotations
#    (needs the swag CLI: go install github.com/swaggo/swag/cmd/swag@latest)
cd go-backend
swag init -g main.go -o docs --parseDependency --parseInternal

# 2. Regenerate the TypeScript client from the spec
cd ..
npm run generate:api-client   # runs `orval`, reading orval.config.ts
```

Both steps are idempotent and safe to re-run at any time — they fully
overwrite `go-backend/docs/` and `src/lib/api/generated/{endpoints,models}/`
respectively. Nothing outside those generated directories is touched.

## What's annotated today

- **Tables** (`go-backend/handlers/data_tables.go`): `ListDataTables`,
  `GetDataTable`, `CreateDataTable`, `UpdateDataTable`, `DeleteDataTable`,
  `ListTableRows`, `GetTableRow`, `CreateTableRow`, `UpdateTableRow`,
  `DeleteTableRow`, `CreateTableColumn`, `UpdateTableColumn`,
  `DeleteTableColumn` — the same surface `src/lib/api/tables-go-client.ts`
  covers.
- **Forms** (`go-backend/handlers/forms.go`): `ListForms`,
  `ListFormsOptimized`, `GetForm`, `GetFormBySlug`, `GetFormBySubdomainSlug`,
  `CreateForm`, `UpdateForm`, `DeleteForm`, `UpdateFormCustomSlug`,
  `UpdateFormStructure`, `SubmitForm`, `GetFormSubmission`,
  `ListFormSubmissions`, `DeleteFormSubmission` — the surface
  `src/lib/api/forms-client.ts` covers.
- Top-level `@title`/`@version`/`@host`/`@BasePath` annotations live at the
  top of `go-backend/main.go`.
- A live Swagger UI is wired up at `GET /swagger/index.html` via
  `gin-swagger` + `swaggo/files` (see `go-backend/router/router.go`), so you
  can browse/try the annotated endpoints without regenerating anything.

## Adding annotations to a new handler

Pick one function in a handler file (e.g. `go-backend/handlers/workspaces.go`)
and add a doc comment directly above it, following the pattern already used
in `data_tables.go`/`forms.go`:

```go
// ListWorkspaces godoc
// @Summary      List workspaces for the current user
// @Tags         workspaces
// @Produce      json
// @Success      200  {array}   models.Workspace
// @Failure      401  {object}  map[string]string
// @Router       /workspaces [get]
func ListWorkspaces(c *gin.Context) {
	...
}
```

Rules of thumb:
- `@Tags` groups handlers into one orval-generated file per tag
  (`src/lib/api/generated/endpoints/<tag>/<tag>.ts`) — use one tag per
  domain/hand-written-client (e.g. `workspaces`, `portal`, `review`).
- `@Success`/`@Failure` should point at real Go types (`models.Table`,
  a handler-local DTO struct, etc.) wherever the handler returns one, so
  orval generates a matching TypeScript interface instead of `object`.
- `@Router` must match the actual route path registered in
  `go-backend/router/router.go`, with `{param}` for each `:param` segment.
- Run `swag init` after adding annotations and check the new path appears in
  `go-backend/docs/swagger.json`.

## Known limitation: `datatypes.JSON` fields

Go fields typed `datatypes.JSON` (raw `jsonb` columns — `settings`,
`config`, `validation`, `dashboard_layout`, etc.) are a `[]byte` under the
hood. `swag` doesn't special-case that type, so it infers the JSON schema
from the underlying Go type and emits `number[]` instead of an arbitrary
JSON object (e.g. `ModelsTable.settings?: number[]` in the generated output,
where the hand-written `DataTable.settings?: Record<string, any>` is
correct). This doesn't break compilation — it's a widening of the actual
runtime shape — but it's a known accuracy gap for any field of this type. It
should be fixed as this pipeline is adopted more broadly, e.g. by adding
`swaggertype:"object"` struct tags to `datatypes.JSON` fields in
`go-backend/models/models.go`, or a `swag` type override config. Left
unaddressed for now to avoid touching shared model files outside the two
target handler files.

## Proof it's a viable drop-in: Tables

Before (hand-written, `src/lib/api/tables-go-client.ts`):

```ts
async getTablesByWorkspace(workspaceId: string): Promise<DataTable[]> {
  return goClient.get<DataTable[]>('/tables', { workspace_id: workspaceId })
}
```

After (generated, `src/lib/api/generated/endpoints/tables/tables.ts`):

```ts
export const getTables = async (
  params?: GetTablesParams,
  options?: RequestInit
): Promise<ModelsTable[]> => {
  return goFetchMutator<ModelsTable[]>(getGetTablesUrl(params), {
    ...options,
    method: 'GET',
  })
}

// call site:
await getTables({ workspace_id: workspaceId })
```

Same endpoint (`GET /tables?workspace_id=...`), same auth/cookie handling
(both ultimately call `goFetch`), same error behavior (`GoAPIError` thrown on
non-2xx), and a return type (`ModelsTable[]`) whose fields line up 1:1 with
the hand-written `DataTable` type — modulo the `datatypes.JSON` gap noted
above. `GetTablesParams`, `ModelsTable`, and every other generated type is
compiled from the real Go structs `ListDataTables` actually returns, so if a
Go field is renamed or removed, the next `swag init && npm run
generate:api-client` surfaces it as a TypeScript error at any generated call
site — instead of a silent runtime mismatch.

The same holds for Forms — `formsClient.get(id)` (hand-written) and
`getFormsId(id)` (generated, in `src/lib/api/generated/endpoints/forms/forms.ts`)
hit the same `GET /forms/{id}` route and both resolve to the same
`HandlersFormDTO`/`Form` shape.

## Verification run for this change

```bash
# Go backend
cd go-backend && go build ./... && go vet ./...   # both clean, no output

# Frontend
npx tsc --noEmit                                   # clean, no output
```

## New files / deps introduced

- `go-backend/docs/` — generated: `docs.go`, `swagger.json`, `swagger.yaml`
  (from `swag init`).
- `go-backend/go.mod` — added `github.com/swaggo/swag`,
  `github.com/swaggo/gin-swagger`, `github.com/swaggo/files` as real
  dependencies (swag CLI itself is a separate, locally-installed tool, not a
  go.mod dependency).
- `go-backend/router/router.go` — mounts `GET /swagger/*any` via
  `gin-swagger`.
- `orval.config.ts` — orval configuration (input spec, output dirs, custom
  mutator, `includeHttpResponseReturnType: false`).
- `orval.tsconfig.json` — a minimal, dedicated tsconfig used only by orval
  when statically bundling/parsing the mutator file (not the app's real
  `tsconfig.json`). Needed because `go-client.ts` uses a dynamic
  `import('next/headers')`, which orval's acorn-based mutator parser can
  only handle at `target: "ES2020"` or newer; the app's real `tsconfig.json`
  target is left untouched.
- `src/lib/api/generated/` — generated: `endpoints/{tables,forms}/*.ts`,
  `models/*.ts`, plus the hand-written `mutator/go-fetch-mutator.ts` (routes
  generated calls through `goFetch`).
- `package.json` — added `orval` devDependency, `"generate:api-client":
  "orval"` script, and a scoped `overrides` entry (see below).
- `package.json` `overrides` — `@stoplight/spectral-core` (a transitive
  dependency of orval, used for spec linting) and `ajv-errors` have a
  peer-dependency conflict with the `ajv@6` this repo's ESLint config needs
  at the root of `node_modules`. The override forces `ajv@8.17.1` and
  `ajv-errors@3.0.0` to nest together under `@stoplight/spectral-core`
  specifically, without touching the root `ajv@6` ESLint depends on. This
  repo also has `legacy-peer-deps=true` in `.npmrc`, which was silently
  ignoring `overrides` entirely — a **clean** `npm install` (deleting
  `node_modules`) was required for the override to actually apply; an
  incremental `npm install` does not re-evaluate it.

## What's left to fully adopt this for other domains

Roughly, per remaining hand-written client (~28 of them: `workspaces-client.ts`,
`portal-*-client.ts`, `review-export-client.ts`, `email-client.ts`,
`crm-client.ts`, `organizations-client.ts`, `invitations-client.ts`,
`storage-client.ts`, `views-client.ts`, `search-client.ts`,
`recommendations-client.ts`, etc.):

1. Add swaggo doc comments to the corresponding handler file(s) in
   `go-backend/handlers/` (see "Adding annotations to a new handler" above).
   Use one `@Tags` value per client to keep the generated output split the
   same way (`mode: 'tags-split'` in `orval.config.ts`).
2. Run `swag init` — confirm the new paths show up in
   `go-backend/docs/swagger.json` and `go build ./... && go vet ./...` stay
   clean.
3. Run `npm run generate:api-client` — confirm the new
   `src/lib/api/generated/endpoints/<tag>/<tag>.ts` compiles
   (`npx tsc --noEmit`).
4. Spot-check one or two calls against the existing hand-written client for
   that domain (same pattern as the Tables/Forms proof above) before
   treating it as a real replacement candidate.
5. Only once a generated client has been verified against real traffic
   (or thorough manual testing) should call sites actually be migrated off
   the hand-written client — this repo intentionally stops short of that
   migration step for Tables/Forms too; both hand-written clients are left
   in place and working.
6. Fix the `datatypes.JSON` typing gap (see above) if/when it starts
   affecting a domain where those fields matter for consumers (e.g. anything
   reading `settings`/`config`/`validation` through the generated client).

Domains most similar to what's already done (single Gin handler file, mostly
CRUD, no exotic response shapes) are the easiest next targets: `workspaces.go`,
`organizations.go`, `views.go`, `invitations.go`. Domains with heavier
non-CRUD logic (`portal_auth_v2.go`, `websocket.go`, `search.go`,
`review_export.go`, streaming/export endpoints) will need more care in what
`@Success`/`@Param` types are declared, since swag's type inference is
weakest for handlers that don't return a plain Go struct.
