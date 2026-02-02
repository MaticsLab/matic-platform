/**
 * Portal Auth API Route
 * 
 * This handles authentication for portal/applicant users.
 * It uses a SEPARATE cookie name from the main app auth to prevent session conflicts.
 * 
 * Main app auth: /api/auth/* (uses "better-auth.session_token" cookie)
 * Portal auth: /api/portal-auth/* (uses "matic-portal.session_token" cookie)
 */

import { getPortalAuth } from "@/lib/portal-better-auth";
import { toNextJsHandler } from "better-auth/next-js";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  try {
    console.log('[Portal Auth GET] Starting request:', request.url);
    const portalAuth = getPortalAuth();
    console.log('[Portal Auth GET] Got auth instance');
    const { GET: handler } = toNextJsHandler(portalAuth);
    console.log('[Portal Auth GET] Got handler, executing...');
    const response = await handler(request);
    console.log('[Portal Auth GET] Response:', response.status);
    return response;
  } catch (error) {
    console.error('[Portal Auth GET] Error:', error);
    console.error('[Portal Auth GET] Error stack:', error instanceof Error ? error.stack : 'No stack');
    console.error('[Portal Auth GET] Error details:', {
      message: error instanceof Error ? error.message : String(error),
      name: error instanceof Error ? error.name : 'Unknown',
    });
    return NextResponse.json({ 
      error: 'Internal server error', 
      message: error instanceof Error ? error.message : String(error),
      path: request.nextUrl.pathname,
    }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const clonedRequest = request.clone();
    const body = await clonedRequest.json().catch(() => ({}));
    console.log('[Portal Auth] POST request:', { 
      url: request.url, 
      email: body.email,
      hasPassword: !!body.password,
      path: request.nextUrl.pathname
    });
    
    console.log('[Portal Auth] Getting portal auth instance...');
    const portalAuth = getPortalAuth();
    console.log('[Portal Auth] Got portal auth instance, creating handler...');
    
    const { POST: handler } = toNextJsHandler(portalAuth);
    console.log('[Portal Auth] Handler created, calling it...');
    
    const response = await handler(request);
    console.log('[Portal Auth] POST response:', {
      status: response.status,
      statusText: response.statusText,
      headers: Object.fromEntries(response.headers.entries())
    });
    
    // Log response body if it's an error
    if (!response.ok) {
      const clonedResponse = response.clone();
      const text = await clonedResponse.text().catch(() => '');
      console.error('[Portal Auth] Error response body:', text);
    }
    
    return response;
  } catch (error) {
    console.error('[Portal Auth] POST error:', error);
    console.error('[Portal Auth] Error stack:', error instanceof Error ? error.stack : 'No stack');
    return NextResponse.json({ 
      error: 'Internal server error', 
      message: error instanceof Error ? error.message : String(error),
      details: String(error) 
    }, { status: 500 });
  }
}
