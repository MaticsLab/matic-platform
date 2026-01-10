import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/better-auth";

/**
 * Compatibility route for /api/auth/get-session
 * Proxies to Better Auth's /api/auth/session endpoint
 */
export async function GET(request: NextRequest) {
  try {
    // Get session using Better Auth's API
    const headersList = request.headers;
    const session = await auth.api.getSession({ headers: headersList });
    
    if (session?.session && session?.user) {
      return NextResponse.json({
        session: {
          id: session.session.id,
          userId: session.user.id,
          expiresAt: session.session.expiresAt,
          token: (session.session as any).token || session.session.id,
        },
        user: {
          id: session.user.id,
          email: session.user.email,
          name: session.user.name,
          emailVerified: session.user.emailVerified ?? false,
          image: session.user.image ?? undefined,
          createdAt: session.user.createdAt,
        },
      });
    }
    
    return NextResponse.json({ session: null, user: null }, { status: 200 });
  } catch (error: any) {
    console.error("[Auth Get Session] Error:", error?.message || error);
    return NextResponse.json(
      { error: "Failed to get session", details: error?.message },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  // POST requests also use the same logic
  return GET(request);
}
