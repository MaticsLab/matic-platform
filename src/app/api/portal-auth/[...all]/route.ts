/**
 * Portal Auth API Route (Best Practices)
 * 
 * Following Better Auth skill guidelines:
 * - Simple handler using toNextJsHandler()
 * - Lazy auth instance initialization
 * - Minimal error handling (Better Auth handles internally)
 */

import { getPortalAuth } from "@/lib/portal-better-auth";
import { toNextJsHandler } from "better-auth/next-js";

export const { GET, POST } = toNextJsHandler(getPortalAuth());
    
    console.log('[Portal Auth] Getting portal auth instance...');
    const portalAuth = getPortalAuth();
    console.log('[Portal Auth] Got portal auth instance, creating handler...');
    
    const { POST: handler } = toNextJsHandler(portalAuth);
    console.log('[Portal Auth] Handler created, calling it...');
    
    const response = await handler(request);
    console.log('[Portal Auth] POST response:', {
      status: response.status,
      statusText: response.statusText,
      headers: Object.fromEntries(response.headers.entries())
    });
    
    // Log response body if it's an error
    if (!response.ok) {
      const clonedResponse = response.clone();
      const text = await clonedResponse.text().catch(() => '');
      console.error('[Portal Auth] Error response body:', text);
    }
    
    return response;
  } catch (error) {
    console.error('[Portal Auth] POST error:', error);
    console.error('[Portal Auth] Error stack:', error instanceof Error ? error.stack : 'No stack');
    return NextResponse.json({ 
      error: 'Internal server error', 
      message: error instanceof Error ? error.message : String(error),
      details: String(error) 
    }, { status: 500 });
  }
}
