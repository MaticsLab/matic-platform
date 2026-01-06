import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { APP_DOMAIN } from '@/constants/app-domain'

// Main app domains that should NOT be treated as subdomain routing
const MAIN_DOMAINS = [
  APP_DOMAIN,
  'maticsapp.com',
  'www.maticsapp.com',
  'forms.maticsapp.com',
  'localhost:3000',
  'localhost',
]

// Check if hostname is a Vercel preview deployment
const isVercelPreview = (hostname: string) => hostname.includes('vercel.app')

export function middleware(request: NextRequest) {
  const url = request.nextUrl
  const hostname = request.headers.get('host') || ''
  
  // Skip API routes and static files
  if (
    url.pathname.startsWith('/api') ||
    url.pathname.startsWith('/_next') ||
    url.pathname.startsWith('/static') ||
    url.pathname.includes('.')
  ) {
    return NextResponse.next()
  }

  // Check if this is a main domain (not a custom subdomain)
  const isMainDomain = MAIN_DOMAINS.includes(hostname) || isVercelPreview(hostname)
  
  // Handle forms.maticsapp.com - rewrite to /apply/{slug}
  if (hostname === 'forms.maticsapp.com' && url.pathname !== '/' && !url.pathname.startsWith('/apply')) {
    const slug = url.pathname.slice(1) // Remove leading slash
    return NextResponse.rewrite(new URL(`/apply/${slug}`, request.url))
  }
  
  // If it's a main domain, proceed normally
  if (isMainDomain) {
    return NextResponse.next()
  }

  // Check if this is a custom subdomain of maticsapp.com
  // e.g., bpnc.maticsapp.com -> subdomain = "bpnc"
  if (hostname.endsWith('.maticsapp.com')) {
    const subdomain = hostname.replace('.maticsapp.com', '')
    const slug = url.pathname.slice(1) // Remove leading slash
    
    if (!subdomain || !slug) {
      return NextResponse.next()
    }

    // Rewrite to the portal page with subdomain and slug as query params
    const newUrl = new URL(`/apply/${slug}`, request.url)
    newUrl.searchParams.set('subdomain', subdomain)
    
    return NextResponse.rewrite(newUrl)
  }

  return NextResponse.next()
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
