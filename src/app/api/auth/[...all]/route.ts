import { auth } from "@/lib/better-auth";
import { toNextJsHandler } from "better-auth/next-js";
import { NextRequest, NextResponse } from "next/server";

// Debug: Log when this module is loaded
console.log("[Better Auth Route] Module loaded");

// Get the handlers from Better Auth
const handlers = toNextJsHandler(auth);

// Wrap handlers with logging
export async function GET(request: NextRequest) {
  console.log("[Better Auth] GET request:", request.nextUrl.pathname);
  try {
    return await handlers.GET(request);
  } catch (error) {
    console.error("[Better Auth] GET error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  console.log("[Better Auth] POST request:", request.nextUrl.pathname);
  try {
    return await handlers.POST(request);
  } catch (error) {
    console.error("[Better Auth] POST error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
