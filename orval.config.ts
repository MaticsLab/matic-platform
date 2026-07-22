import { defineConfig } from 'orval'

/**
 * Generates a typed TypeScript client from the Go backend's OpenAPI spec.
 *
 * The spec (go-backend/docs/swagger.json) is produced by `swag init`, reading
 * swaggo doc comments (`// @Summary`, `// @Param`, `// @Success`, ...) off the
 * Go handlers themselves — see go-backend/handlers/data_tables.go and
 * go-backend/handlers/forms.go for the annotated, currently-covered domains.
 *
 * Run `npm run generate:api-client` to regenerate. Output goes to
 * src/lib/api/generated/ and should always be treated as generated code —
 * edit the Go annotations and regenerate, don't hand-edit the output.
 *
 * See docs/API_CLIENT_CODEGEN.md for the full pipeline and how to extend it
 * to additional handler domains.
 */
export default defineConfig({
  maticApi: {
    input: {
      target: './go-backend/docs/swagger.json',
    },
    output: {
      mode: 'tags-split',
      target: './src/lib/api/generated/endpoints',
      schemas: './src/lib/api/generated/models',
      client: 'fetch',
      clean: true,
      // A dedicated, minimal tsconfig (not the app's real tsconfig.json) — orval statically
      // parses the bundled mutator with acorn using this file's `target` to pick an ECMA
      // version, and go-client.ts uses a dynamic `import('next/headers')` that needs ES2020+
      // to parse at all. Keeping this separate avoids changing the app's own build target.
      tsconfig: './orval.tsconfig.json',
      override: {
        mutator: {
          path: './src/lib/api/generated/mutator/go-fetch-mutator.ts',
          name: 'goFetchMutator',
        },
        fetch: {
          // Without this, generated functions return `{ data, status, headers }` and expect
          // the mutator to build that whole envelope. `goFetch` (like every hand-written
          // client in src/lib/api/*.ts) already returns the parsed body directly and throws
          // `GoAPIError` on non-2xx — this makes generated functions return `Promise<T>` the
          // same way, so they're a true drop-in for the hand-written call sites.
          includeHttpResponseReturnType: false,
        },
      },
    },
  },
})
