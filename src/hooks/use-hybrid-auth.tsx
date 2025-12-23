"use client";

/**
 * Hybrid Authentication Hook
 * 
 * Provides a unified authentication interface for both Supabase (legacy)
 * and Better Auth (new multi-tenant system).
 */

import { useEffect, useState, useCallback, createContext, useContext, type ReactNode } from "react";
import { createClient } from "@/lib/supabase";
import { authClient, useSession as useBetterAuthSession } from "@/lib/better-auth-client";
import type { User as SupabaseUser, Session as SupabaseSession } from "@supabase/supabase-js";

export type AuthProvider = "supabase" | "better-auth" | null;

export interface HybridUser {
  id: string;
  email: string;
  name: string | null;
  avatarUrl: string | null;
  provider: AuthProvider;
  betterAuthUserId?: string;
  supabaseUserId?: string;
}

export interface HybridAuthState {
  user: HybridUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  provider: AuthProvider;
  // Supabase specific
  supabaseSession: SupabaseSession | null;
  supabaseUser: SupabaseUser | null;
  // Better Auth specific
  betterAuthSession: any | null;
  // Methods
  signOut: () => Promise<void>;
  refreshSession: () => Promise<void>;
}

const HybridAuthContext = createContext<HybridAuthState | null>(null);

export function HybridAuthProvider({ children }: { children: ReactNode }) {
  const [isLoading, setIsLoading] = useState(true);
  const [supabaseSession, setSupabaseSession] = useState<SupabaseSession | null>(null);
  const [supabaseUser, setSupabaseUser] = useState<SupabaseUser | null>(null);
  
  // Better Auth session
  const { data: betterAuthData, isPending: betterAuthLoading } = useBetterAuthSession();
  
  const supabase = createClient();

  // Load Supabase session
  useEffect(() => {
    const loadSupabaseSession = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        if (!error && session) {
          setSupabaseSession(session);
          setSupabaseUser(session.user);
        }
      } catch (error) {
        console.error("[HybridAuth] Error loading Supabase session:", error);
      }
    };

    loadSupabaseSession();

    // Listen for Supabase auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setSupabaseSession(session);
        setSupabaseUser(session?.user || null);
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, [supabase]);

  // Update loading state
  useEffect(() => {
    // Consider loaded when both auth systems have been checked
    if (!betterAuthLoading) {
      setIsLoading(false);
    }
  }, [betterAuthLoading]);

  // Compute the unified user
  const computeUser = useCallback((): HybridUser | null => {
    // Prioritize Better Auth
    if (betterAuthData?.user) {
      return {
        id: betterAuthData.user.id,
        email: betterAuthData.user.email,
        name: betterAuthData.user.name,
        avatarUrl: betterAuthData.user.image ?? null,
        provider: "better-auth",
        betterAuthUserId: betterAuthData.user.id,
      };
    }

    // Fall back to Supabase
    if (supabaseUser) {
      const metadata = supabaseUser.user_metadata || {};
      return {
        id: supabaseUser.id,
        email: supabaseUser.email!,
        name: metadata.full_name || metadata.name || null,
        avatarUrl: metadata.avatar_url || null,
        provider: "supabase",
        supabaseUserId: supabaseUser.id,
      };
    }

    return null;
  }, [betterAuthData, supabaseUser]);

  const user = computeUser();
  const provider: AuthProvider = user?.provider || null;
  const isAuthenticated = user !== null;

  // Sign out from both systems
  const signOut = useCallback(async () => {
    try {
      // Sign out from Better Auth
      if (betterAuthData?.user) {
        await authClient.signOut();
      }
      
      // Sign out from Supabase
      if (supabaseSession) {
        await supabase.auth.signOut();
      }
    } catch (error) {
      console.error("[HybridAuth] Error signing out:", error);
      throw error;
    }
  }, [betterAuthData, supabaseSession, supabase]);

  // Refresh session
  const refreshSession = useCallback(async () => {
    try {
      // Refresh Supabase session
      if (supabaseSession) {
        await supabase.auth.refreshSession();
      }
      // Better Auth sessions are managed automatically
    } catch (error) {
      console.error("[HybridAuth] Error refreshing session:", error);
    }
  }, [supabaseSession, supabase]);

  const value: HybridAuthState = {
    user,
    isLoading,
    isAuthenticated,
    provider,
    supabaseSession,
    supabaseUser,
    betterAuthSession: betterAuthData,
    signOut,
    refreshSession,
  };

  return (
    <HybridAuthContext.Provider value={value}>
      {children}
    </HybridAuthContext.Provider>
  );
}

/**
 * Hook to access hybrid authentication state
 */
export function useHybridAuth(): HybridAuthState {
  const context = useContext(HybridAuthContext);
  
  if (!context) {
    throw new Error("useHybridAuth must be used within a HybridAuthProvider");
  }
  
  return context;
}

/**
 * Hook to get the current user (simplified)
 */
export function useCurrentUser(): HybridUser | null {
  const { user } = useHybridAuth();
  return user;
}

/**
 * Hook to check authentication status
 */
export function useIsAuthenticated(): boolean {
  const { isAuthenticated } = useHybridAuth();
  return isAuthenticated;
}
