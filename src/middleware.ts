import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { APP_DOMAIN } from '@/constants/app-domain'

// Main app domains that should NOT be treated as subdomain routing
const MAIN_DOMAINS = [
  APP_DOMAIN,
  'maticsapp.com',
  'www.maticsapp.com',
  'forms.maticsapp.com',
  'build.maticsapp.com',
  'localhost:3000',
  'localhost',
]

// The staff dashboard lives on its own subdomain — root maticsapp.com is marketing-only.
const DASHBOARD_DOMAIN = 'build.maticsapp.com'
const MARKETING_DOMAIN = 'maticsapp.com'
const MARKETING_HOSTS = [APP_DOMAIN, MARKETING_DOMAIN, 'www.maticsapp.com']

// Routes that only belong on the dashboard domain (the staff app + its auth flow)
const DASHBOARD_ROUTE_PREFIXES = [
  '/workspace',
  '/auth',
  '/login',
  '/forgot-password',
  '/gmail-connected',
  '/accept-invitation',
]

// Routes that only belong on the marketing domain
const MARKETING_ROUTE_PREFIXES = ['/pricing', '/company', '/privacy', '/terms']

// Public routes that don't require staff access (auth, public portal, legal pages, etc.)
const PUBLIC_ROUTES = [
  '/auth',
  '/apply',
  '/portal',
  '/api/auth',
  '/_next',
  '/static',
  '/privacy',
  '/terms',
  '/pricing',
]

// Check if hostname is a Vercel preview deployment
const isVercelPreview = (hostname: string) => hostname.includes('vercel.app')

// Check if route is public (accessible to applicants)
function isPublicRoute(pathname: string): boolean {
  return PUBLIC_ROUTES.some(route => pathname.startsWith(route)) || pathname.includes('.')
}

export async function middleware(request: NextRequest) {
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

  // For now, let client-side handle auth redirects
  // Middleware session checks were causing redirect loops
  // TODO: Re-enable after Better Auth session endpoint is stable

  // build.maticsapp.com is the dashboard-only domain — send bare "/" into the
  // workspace resolver, and bounce marketing pages back to the marketing domain.
  if (hostname === DASHBOARD_DOMAIN) {
    if (url.pathname === '/') {
      return NextResponse.redirect(new URL('/workspace', request.url))
    }
    if (MARKETING_ROUTE_PREFIXES.some(route => url.pathname.startsWith(route))) {
      const target = new URL(url.pathname + url.search, `https://${MARKETING_DOMAIN}`)
      return NextResponse.redirect(target)
    }
    return NextResponse.next()
  }

  // The marketing domain is marketing-only — bounce dashboard/auth routes to build.
  if (MARKETING_HOSTS.includes(hostname) && DASHBOARD_ROUTE_PREFIXES.some(route => url.pathname.startsWith(route))) {
    const target = new URL(url.pathname + url.search, `https://${DASHBOARD_DOMAIN}`)
    return NextResponse.redirect(target)
  }

  // Handle forms.maticsapp.com - rewrite to /apply/{slug}
  if (hostname === 'forms.maticsapp.com' && url.pathname !== '/' && !url.pathname.startsWith('/apply')) {
    const slug = url.pathname.slice(1) // Remove leading slash
    const newUrl = new URL(`/apply/${slug}`, request.url)
    
    // Preserve existing query parameters (especially _rsc for Next.js navigation)
    url.searchParams.forEach((value, key) => {
      newUrl.searchParams.set(key, value)
    })
    
    return NextResponse.rewrite(newUrl)
  }
  
  // If it's a main domain, proceed normally
  if (isMainDomain) {
    return NextResponse.next()
  }

  // Check if this is a custom subdomain of maticsapp.com
  // e.g., bpnc.maticsapp.com -> subdomain = "bpnc"
  if (hostname.endsWith('.maticsapp.com')) {
    const subdomain = hostname.replace('.maticsapp.com', '')
    const pathname = url.pathname
    
    // Don't rewrite system routes - preserve them as-is
    const systemRoutes = ['/login', '/auth', '/portal', '/api', '/forgot-password', '/privacy', '/terms']
    if (systemRoutes.some(route => pathname.startsWith(route))) {
      return NextResponse.next()
    }
    
    const slug = pathname.slice(1) // Remove leading slash
    
    if (!subdomain || !slug) {
      return NextResponse.next()
    }

    // Rewrite to the portal page with subdomain and slug as query params
    const newUrl = new URL(`/apply/${slug}`, request.url)
    newUrl.searchParams.set('subdomain', subdomain)
    
    // Preserve existing query parameters (especially _rsc for Next.js navigation)
    url.searchParams.forEach((value, key) => {
      if (key !== 'subdomain') { // Don't duplicate subdomain param
        newUrl.searchParams.set(key, value)
      }
    })
    
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
