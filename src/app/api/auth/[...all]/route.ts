import { auth } from "@/lib/better-auth";
import { toNextJsHandler } from "better-auth/next-js";
import { NextRequest, NextResponse } from "next/server";

// Debug: Log when this module is loaded
console.log("[Better Auth Route] Module loaded, DATABASE_URL exists:", !!process.env.DATABASE_URL);
console.log("[Better Auth Route] BETTER_AUTH_SECRET exists:", !!process.env.BETTER_AUTH_SECRET);
console.log("[Better Auth Route] RESEND_API_KEY exists:", !!process.env.RESEND_API_KEY);

// Get the handlers from Better Auth
const handlers = toNextJsHandler(auth);

// Wrap handlers with logging
export async function GET(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  console.log("[Better Auth] GET request:", pathname);
  
  // Handle compatibility route: /api/auth/get-session -> /api/auth/session
  if (pathname === "/api/auth/get-session") {
    // Redirect to the correct Better Auth session endpoint
    const sessionUrl = new URL("/api/auth/session", request.url);
    return NextResponse.redirect(sessionUrl);
  }
  
  try {
    return await handlers.GET(request);
  } catch (error: any) {
    console.error("[Better Auth] GET error:", error?.message || error, error?.stack);
    return NextResponse.json({ error: "Internal server error", details: error?.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  console.log("[Better Auth] POST request:", pathname);
  
  // Handle compatibility route: /api/auth/get-session -> /api/auth/session
  if (pathname === "/api/auth/get-session") {
    // Redirect to the correct Better Auth session endpoint
    const sessionUrl = new URL("/api/auth/session", request.url);
    return NextResponse.redirect(sessionUrl);
  }
  
  try {
    return await handlers.POST(request);
  } catch (error: any) {
    console.error("[Better Auth] POST error:", error?.message || error, error?.stack);
    return NextResponse.json({ error: "Internal server error", details: error?.message }, { status: 500 });
  }
}
