/**
 * Debug endpoint to test portal auth configuration
 */

import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const diagnostics = {
    timestamp: new Date().toISOString(),
    environment: {
      NODE_ENV: process.env.NODE_ENV,
      hasDatabase: !!process.env.DATABASE_URL,
      databaseUrlPrefix: process.env.DATABASE_URL?.substring(0, 20) + '...',
      hasSecret: !!process.env.BETTER_AUTH_SECRET,
      hasBetterAuthUrl: !!process.env.BETTER_AUTH_URL,
      betterAuthUrl: process.env.BETTER_AUTH_URL,
      hasResendKey: !!process.env.RESEND_API_KEY,
    },
    request: {
      url: request.url,
      origin: request.headers.get('origin'),
      host: request.headers.get('host'),
    },
  };

  try {
    // Try to get portal auth instance
    diagnostics.portalAuth = { status: 'attempting' };
    
    const { getPortalAuth } = await import('@/lib/portal-better-auth');
    diagnostics.portalAuth = { status: 'module imported' };
    
    const portalAuth = getPortalAuth();
    diagnostics.portalAuth = { 
      status: 'instance created',
      hasInstance: !!portalAuth 
    };
    
    // Check if we can access the database
    if (process.env.DATABASE_URL) {
      const { Pool } = await import('pg');
      const pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false },
      });
      
      try {
        const result = await pool.query('SELECT NOW() as time, COUNT(*) as user_count FROM ba_users');
        diagnostics.database = {
          status: 'connected',
          serverTime: result.rows[0]?.time,
          userCount: result.rows[0]?.user_count,
        };
        await pool.end();
      } catch (dbError) {
        diagnostics.database = {
          status: 'error',
          error: dbError instanceof Error ? dbError.message : String(dbError),
        };
      }
    }
    
  } catch (error) {
    diagnostics.portalAuth = {
      status: 'error',
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    };
  }

  return NextResponse.json(diagnostics, { 
    status: 200,
    headers: {
      'Cache-Control': 'no-store, must-revalidate',
    },
  });
}
