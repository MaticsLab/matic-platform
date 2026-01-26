/**
 * Password Reset API - Better Auth Only
 * 
 * Handles the actual password reset using the token from the forgot-password email.
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/better-auth";
import { headers } from "next/headers";


export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { token, newPassword } = body;

    if (!token || !newPassword) {
      return NextResponse.json(
        { error: "Token and new password are required" },
        { status: 400 }
      );
    }

    if (newPassword.length < 8) {
      return NextResponse.json(
        { error: "Password must be at least 8 characters" },
        { status: 400 }
      );
    }

    // Use Better Auth's built-in password reset
    const headersList = await headers();
    const result = await auth.api.resetPassword(
      {
        body: { token, newPassword },
        headers: headersList,
      }
    );

    // Better Auth's resetPassword returns { status: boolean }
    // If status is false, the password reset failed
    if (!result.status) {
      return NextResponse.json(
        { error: "Failed to reset password. The token may be invalid or expired." },
        { status: 400 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("[Reset Password] Error:", err);
    return NextResponse.json(
      { error: "An unexpected error occurred" },
      { status: 500 }
    );
  }
}
