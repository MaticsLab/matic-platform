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
