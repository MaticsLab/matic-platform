/**
 * Portal Auth API Route
 * 
 * This handles authentication for portal/applicant users.
 * It uses a SEPARATE cookie name from the main app auth to prevent session conflicts.
 * 
 * Main app auth: /api/auth/* (uses "better-auth.session_token" cookie)
 * Portal auth: /api/portal-auth/* (uses "matic-portal.session_token" cookie)
 */

import { portalAuth } from "@/lib/portal-better-auth";
import { toNextJsHandler } from "better-auth/next-js";
import { NextRequest, NextResponse } from "next/server";

const { GET: originalGET, POST: originalPOST } = toNextJsHandler(portalAuth);

export async function GET(request: NextRequest) {
  try {
    return await originalGET(request);
  } catch (error) {
    console.error('[Portal Auth] GET error:', error);
    return NextResponse.json({ error: 'Internal server error', details: String(error) }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const clonedRequest = request.clone();
    const body = await clonedRequest.json().catch(() => ({}));
    console.log('[Portal Auth] POST request:', { 
      url: request.url, 
      email: body.email,
      hasPassword: !!body.password 
    });
    
    const response = await originalPOST(request);
    console.log('[Portal Auth] POST response status:', response.status);
    return response;
  } catch (error) {
    console.error('[Portal Auth] POST error:', error);
    return NextResponse.json({ error: 'Internal server error', details: String(error) }, { status: 500 });
  }
}
