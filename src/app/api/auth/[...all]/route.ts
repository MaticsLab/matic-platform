import { auth } from "@/lib/better-auth";
import { toNextJsHandler } from "better-auth/next-js";
import { NextRequest, NextResponse } from "next/server";

// Get the handlers from Better Auth
const handlers = toNextJsHandler(auth);

// Wrap handlers with logging
export async function GET(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  console.log("[Better Auth] GET request:", pathname);
  
  try {
    return await handlers.GET(request);
  } catch (error: any) {
    console.error("[Better Auth] GET error:", error?.message || error);
    return NextResponse.json({ error: "Internal server error", details: error?.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  console.log("[Better Auth] POST request:", pathname);
  
  try {
    return await handlers.POST(request);
  } catch (error: any) {
    console.error("[Better Auth] POST error:", error?.message || error);
    return NextResponse.json({ 
      error: "Internal server error", 
      details: error?.message,
      stack: process.env.NODE_ENV === 'development' ? error?.stack : undefined
    }, { status: 500 });
  }
}
