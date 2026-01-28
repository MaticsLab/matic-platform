import { getAuth } from "@/lib/better-auth";
import { toNextJsHandler } from "better-auth/next-js";
import { NextRequest, NextResponse } from "next/server";

// Lazy handler initialization - creates auth instance on first request
let _handlers: ReturnType<typeof toNextJsHandler> | null = null;

function getHandlers() {
  if (!_handlers) {
    console.log("[Better Auth] Initializing handlers...");
    const auth = getAuth();
    _handlers = toNextJsHandler(auth);
    console.log("[Better Auth] Handlers initialized");
  }
  return _handlers;
}

// Wrap handlers with comprehensive logging
export async function GET(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  console.log("[Better Auth] GET request:", pathname);
  
  try {
    const handlers = getHandlers();
    const response = await handlers.GET(request);
    console.log("[Better Auth] GET response status:", response.status);
    return response;
  } catch (error: any) {
    console.error("[Better Auth] GET error:", {
      message: error?.message || error,
      name: error?.name,
      stack: error?.stack,
    });
    return NextResponse.json(
      { 
        error: "Internal server error", 
        details: error?.message,
        type: error?.name,
        stack: process.env.NODE_ENV === 'development' ? error?.stack : undefined
      }, 
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  console.log("[Better Auth] POST request:", pathname);
  
  try {
    // Clone request to allow reading body and inspecting it for debugging
    const clonedRequest = request.clone();
    let body;
    try {
      body = await clonedRequest.json();
      console.log("[Better Auth] POST body received (email masked):", {
        ...body,
        email: body.email ? `${body.email.substring(0, 3)}***` : undefined,
        password: body.password ? '***' : undefined,
      });
    } catch (e) {
      console.log("[Better Auth] POST body is not JSON");
    }
    
    const handlers = getHandlers();
    const response = await handlers.POST(request);
    console.log("[Better Auth] POST response status:", response.status);
    return response;
  } catch (error: any) {
    console.error("[Better Auth] POST error:", {
      message: error?.message || error,
      name: error?.name,
      code: error?.code,
      stack: error?.stack,
    });
    return NextResponse.json(
      { 
        error: "Internal server error", 
        details: error?.message,
        type: error?.name,
        stack: process.env.NODE_ENV === 'development' ? error?.stack : undefined
      }, 
      { status: 500 }
    );
  }
}
