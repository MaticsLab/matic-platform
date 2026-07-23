import { NextResponse } from 'next/server'
import { revalidateTag } from 'next/cache'
import { requireAuth } from '@/lib/api-auth'
import { formCacheTag } from '@/lib/portal/form-cache-tags'

// Called by the Portal Builder right after a successful publish (see
// PortalEditor.tsx's handleSave) so the public apply/[slug] page's cached
// form config invalidates instantly instead of waiting up to 60s. Revalidates
// id/slug/custom_slug together since the public lookup accepts any of the
// three and this doesn't need to know which one a given visitor's URL uses.
export async function POST(request: Request) {
  const authResult = await requireAuth(request)
  if (!authResult.success) {
    return authResult.response
  }

  try {
    const { id, slug, customSlug } = await request.json()
    const identifiers = Array.from(new Set([id, slug, customSlug].filter(Boolean)))
    identifiers.forEach((identifier: string) => revalidateTag(formCacheTag(identifier)))
    return NextResponse.json({ revalidated: true, identifiers })
  } catch (error) {
    console.error('[forms/revalidate] Failed:', error)
    return NextResponse.json({ revalidated: false }, { status: 500 })
  }
}
