/**
 * Hybrid Authentication System
 * 
 * This module provides a unified interface for both Supabase Auth (legacy users)
 * and Better Auth (new users with multi-tenant support).
 * 
 * Strategy:
 * 1. Check Better Auth session first (new auth system)
 * 2. Fall back to Supabase session (legacy users)
 * 3. Provide migration path for Supabase users to Better Auth
 */

import { createClient } from "@/lib/supabase";
import { auth } from "@/lib/better-auth";
import { headers as getHeaders } from "next/headers";

export type AuthProvider = "supabase" | "better-auth";

export interface HybridUser {
  id: string;
  email: string;
  name: string | null;
  avatarUrl: string | null;
  provider: AuthProvider;
  // Better Auth specific
  betterAuthUserId?: string;
  // Supabase specific
  supabaseUserId?: string;
  // Organization info (Better Auth)
  activeOrganizationId?: string | null;
}

export interface HybridSession {
  user: HybridUser;
  provider: AuthProvider;
  accessToken?: string;
  expiresAt?: Date;
}

/**
 * Get the current session from either auth system
 * Prioritizes Better Auth, falls back to Supabase
 */
export async function getHybridSession(): Promise<HybridSession | null> {
  // Try Better Auth first
  try {
    const headersList = await getHeaders();
    const betterAuthSession = await auth.api.getSession({
      headers: headersList,
    });

    if (betterAuthSession?.user) {
      return {
        user: {
          id: betterAuthSession.user.id,
          email: betterAuthSession.user.email,
          name: betterAuthSession.user.name,
          avatarUrl: betterAuthSession.user.image ?? null,
          provider: "better-auth",
          betterAuthUserId: betterAuthSession.user.id,
          activeOrganizationId: betterAuthSession.session?.activeOrganizationId,
        },
        provider: "better-auth",
        expiresAt: betterAuthSession.session?.expiresAt 
          ? new Date(betterAuthSession.session.expiresAt) 
          : undefined,
      };
    }
  } catch (error) {
    // Better Auth session not found, try Supabase
    console.debug("[HybridAuth] Better Auth session not found, trying Supabase");
  }

  // Fall back to Supabase
  try {
    const supabase = createClient();
    const { data: { session }, error } = await supabase.auth.getSession();

    if (error) {
      console.error("[HybridAuth] Supabase session error:", error);
      return null;
    }

    if (session?.user) {
      const metadata = session.user.user_metadata || {};
      return {
        user: {
          id: session.user.id,
          email: session.user.email!,
          name: metadata.full_name || metadata.name || null,
          avatarUrl: metadata.avatar_url || null,
          provider: "supabase",
          supabaseUserId: session.user.id,
        },
        provider: "supabase",
        accessToken: session.access_token,
        expiresAt: session.expires_at ? new Date(session.expires_at * 1000) : undefined,
      };
    }
  } catch (error) {
    console.error("[HybridAuth] Supabase session error:", error);
  }

  return null;
}

/**
 * Get the current user from either auth system
 */
export async function getHybridUser(): Promise<HybridUser | null> {
  const session = await getHybridSession();
  return session?.user || null;
}

/**
 * Check if user is authenticated with either system
 */
export async function isAuthenticated(): Promise<boolean> {
  const session = await getHybridSession();
  return session !== null;
}

/**
 * Get auth provider being used for current session
 */
export async function getAuthProvider(): Promise<AuthProvider | null> {
  const session = await getHybridSession();
  return session?.provider || null;
}

/**
 * Server-side function to verify and get user from request
 * Used in API routes and server components
 */
export async function requireAuth(): Promise<HybridSession> {
  const session = await getHybridSession();
  
  if (!session) {
    throw new Error("Unauthorized: No valid session found");
  }
  
  return session;
}

/**
 * Get the appropriate user ID for database queries
 * Returns Better Auth user ID if available, otherwise Supabase user ID
 */
export async function getCurrentUserId(): Promise<string | null> {
  const user = await getHybridUser();
  return user?.id || null;
}
