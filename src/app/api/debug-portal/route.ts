/**
 * Debug endpoint to verify portal environment configuration
 * Access: /api/debug-portal
 */

import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const url = new URL(request.url)
  const hostname = request.headers.get('host') || 'unknown'
  
  // Only allow in development or with secret key
  const debugKey = url.searchParams.get('key')
  const isDev = process.env.NODE_ENV === 'development'
  const isAuthorized = isDev || debugKey === process.env.DEBUG_KEY
  
  if (!isAuthorized) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  
  return NextResponse.json({
    timestamp: new Date().toISOString(),
    request: {
      hostname,
      url: request.url,
      origin: request.headers.get('origin'),
      referer: request.headers.get('referer'),
    },
    environment: {
      NODE_ENV: process.env.NODE_ENV,
      NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL || 'not set',
      NEXT_PUBLIC_GO_API_URL: process.env.NEXT_PUBLIC_GO_API_URL || 'not set',
      BETTER_AUTH_URL: process.env.BETTER_AUTH_URL || 'not set',
      BETTER_AUTH_SECRET: process.env.BETTER_AUTH_SECRET ? 'set' : 'NOT SET',
      VERCEL_URL: process.env.VERCEL_URL || 'not set',
    },
    checks: {
      isSubdomain: hostname.endsWith('.maticsapp.com') && 
                   hostname !== 'www.maticsapp.com' && 
                   hostname !== 'maticsapp.com' &&
                   hostname !== 'api.maticsapp.com',
      isFormsSubdomain: hostname === 'forms.maticsapp.com',
      isMainDomain: ['maticsapp.com', 'www.maticsapp.com', 'localhost:3000'].includes(hostname),
    },
  })
}
