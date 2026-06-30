/**
 * Portal Auth API Route (Best Practices)
 * 
 * Following Better Auth skill guidelines:
 * - Simple handler using toNextJsHandler()
 * - Lazy auth instance initialization
 * - Minimal error handling (Better Auth handles internally)
 */

import { portalAuth } from "@/auth/server/portal";
import { toNextJsHandler } from "better-auth/next-js";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export const { GET, POST } = toNextJsHandler(portalAuth);
