/**
 * Password Reset API - Better Auth Only
 * 
 * Handles password reset for Better Auth users.
 * Sends reset emails via Resend API.
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/better-auth";
import { headers } from "next/headers";

// Initialize Resend
const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;


// Get base URL
function getBaseURL(): string {
  if (process.env.NEXT_PUBLIC_APP_URL) {
    return process.env.NEXT_PUBLIC_APP_URL;
  }
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }
  return "http://localhost:3000";
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email } = body;

    if (!email) {
      return NextResponse.json(
        { error: "Email is required" },
        { status: 400 }
      );
    }

    // Use Better Auth's built-in password reset
    // Better Auth handles token generation, storage, and email sending
    const headersList = await headers();
    const result = await auth.api.forgetPassword(
      {
        body: { email },
        headers: headersList,
      }
    );

    // Better Auth returns success even if user not found (security best practice)
    // So we always return success to prevent email enumeration
    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("[Forgot Password] Error:", err);
    // Still return success to prevent email enumeration
    return NextResponse.json({ success: true });
  }
}
