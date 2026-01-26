/**
 * Password Reset API - Better Auth Only
 * 
 * Proxies to Better Auth's built-in password reset endpoint.
 * Better Auth handles token generation, storage, and email sending.
 * 
 * This route forwards requests to Better Auth's built-in handler.
 */

import { NextRequest } from "next/server";
import { auth } from "@/lib/better-auth";
import { toNextJsHandler } from "better-auth/next-js";

// Use Better Auth's built-in handler
const handlers = toNextJsHandler(auth);

export async function POST(request: NextRequest) {
  // Forward to Better Auth's built-in forgot-password handler
  // Better Auth's emailAndPassword plugin provides this endpoint
  return handlers.POST(request);
}
