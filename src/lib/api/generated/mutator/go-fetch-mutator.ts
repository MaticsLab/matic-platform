/**
 * Orval custom mutator for the generated Go API client.
 *
 * Instead of teaching orval's generated code to talk to `fetch` directly, every
 * generated call is routed through the existing `goFetch` helper
 * (`src/lib/api/go-client.ts`). That's the same function every hand-written
 * client in `src/lib/api/*.ts` already uses, so generated calls automatically
 * get:
 *   - the localhost-vs-production base URL resolution
 *   - Better Auth session cookie / bearer-token attachment
 *   - server-side cookie forwarding (Server Components)
 *   - 401 portal-aware redirect handling
 *   - the shared `GoAPIError` shape
 *
 * This is what makes the generated client a realistic drop-in replacement for
 * the hand-written ones, rather than a second, differently-behaved HTTP layer.
 *
 * orval's `fetch` client calls custom mutators as `(url, options) => Promise<T>` —
 * `url` already has any query string baked in (see the generated `getXxxUrl`
 * helpers) and `options` is a plain `RequestInit` with `method`/`headers`/`body`
 * already populated, so this just has to hand both straight to `goFetch`.
 *
 * See docs/API_CLIENT_CODEGEN.md for how this is wired up via orval.config.ts.
 */
import { goFetch } from '../../go-client'

export const goFetchMutator = async <T>(url: string, options?: RequestInit): Promise<T> => {
  return goFetch<T>(url, options)
}

export default goFetchMutator
