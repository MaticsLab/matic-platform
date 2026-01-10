import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/better-auth";
import { Pool } from "pg";

/**
 * Compatibility route for /api/auth/get-session
 * Returns session with the actual token from database for cross-domain API calls
 */
export async function GET(request: NextRequest) {
  try {
    // Get session using Better Auth's API
    const headersList = request.headers;
    const session = await auth.api.getSession({ headers: headersList });
    
    if (session?.session && session?.user) {
      let sessionToken: string | null = null;
      
      // Try to get the actual token from the database
      // Better Auth stores tokens in ba_sessions table, but doesn't expose them via API
      try {
        if (process.env.DATABASE_URL) {
          const pool = new Pool({
            connectionString: process.env.DATABASE_URL,
            ssl: { rejectUnauthorized: false },
            max: 1,
          });
          
          const result = await pool.query(
            'SELECT token FROM ba_sessions WHERE id = $1 AND expires_at > NOW()',
            [session.session.id]
          );
          
          if (result.rows.length > 0) {
            sessionToken = result.rows[0].token;
          }
          
          await pool.end();
        }
      } catch (dbError) {
        console.debug('[Auth Get Session] Failed to query database for token:', dbError);
        // Fallback to session ID if database query fails
        sessionToken = session.session.id;
      }
      
      // If we couldn't get token from DB, use session ID as fallback
      // (Go backend can also validate using session ID in some cases)
      if (!sessionToken) {
        sessionToken = session.session.id;
      }
      
      return NextResponse.json({
        session: {
          id: session.session.id,
          userId: session.user.id,
          expiresAt: session.session.expiresAt,
          token: sessionToken, // Actual token from database
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
