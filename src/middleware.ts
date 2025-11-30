import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// Main app domains that should NOT be treated as subdomain routing
const MAIN_DOMAINS = [
  'maticsapp.com',
  'www.maticsapp.com',
  'forms.maticsapp.com',
  'localhost:3000',
  'localhost',
]

export function middleware(request: NextRequest) {
  const url = request.nextUrl
  const hostname = request.headers.get('host') || ''
  
  // Skip for main domains and API routes
  if (
    MAIN_DOMAINS.some(domain => hostname === domain || hostname.endsWith(`.${domain}`)) ||
    url.pathname.startsWith('/api') ||
    url.pathname.startsWith('/_next') ||
    url.pathname.startsWith('/static') ||
    url.pathname.includes('.')
  ) {
    // Exception: forms.maticsapp.com/{uuid-or-slug} should go to /apply/{uuid-or-slug}
    if (hostname === 'forms.maticsapp.com' && url.pathname !== '/' && !url.pathname.startsWith('/apply')) {
      const slug = url.pathname.slice(1) // Remove leading slash
      return NextResponse.rewrite(new URL(`/apply/${slug}`, request.url))
    }
    return NextResponse.next()
  }

  // Extract subdomain from hostname
  // e.g., bpnc.maticsapp.com -> bpnc
  const subdomain = hostname.split('.')[0]
  
  // Get the path (slug)
  // e.g., /scholarship -> scholarship
  const slug = url.pathname.slice(1)
  
  if (!subdomain || !slug) {
    return NextResponse.next()
  }

  // Rewrite to the portal page with subdomain and slug as query params
  // The portal page will use these to fetch the correct form
  const newUrl = new URL(`/apply/${slug}`, request.url)
  newUrl.searchParams.set('subdomain', subdomain)
  
  return NextResponse.rewrite(newUrl)
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\..*|api).*)',
  ],
}
