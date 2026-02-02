/**
 * Simple test endpoint to verify portal auth can be initialized
 */

import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const result: any = {
    step: 'starting',
    timestamp: new Date().toISOString(),
  };

  try {
    result.step = 'checking env vars';
    result.env = {
      hasDatabase: !!process.env.DATABASE_URL,
      hasSecret: !!process.env.BETTER_AUTH_SECRET,
      nodeEnv: process.env.NODE_ENV,
    };

    result.step = 'importing better auth';
    const { getPortalAuth } = await import('@/lib/portal-better-auth');
    result.importSuccess = true;

    result.step = 'calling getPortalAuth';
    const auth = getPortalAuth();
    result.authCreated = !!auth;

    result.step = 'checking auth properties';
    result.authProps = {
      hasApi: !!auth.api,
      typeof: typeof auth,
    };

    result.step = 'complete';
    result.success = true;

  } catch (error) {
    result.error = {
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack?.split('\n').slice(0, 5) : undefined,
      name: error instanceof Error ? error.name : undefined,
    };
    result.success = false;
  }

  return NextResponse.json(result, {
    status: result.success ? 200 : 500,
    headers: {
      'Cache-Control': 'no-store',
    },
  });
}
