// Shared between the public apply/[slug] page's fetch (tags a cached response)
// and the Portal Builder's publish action (invalidates it) — both must agree
// on the exact tag string, so it lives in one place rather than being
// hand-typed at each call site.
export function formCacheTag(identifier: string): string {
  return `form-public:${identifier}`
}
