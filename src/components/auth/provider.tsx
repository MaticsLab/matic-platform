"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { useSession as useBetterAuthSession, signOut as betterAuthSignOut } from "@/auth/client/main";
import { useSessionRefresh } from "@/hooks/useSessionRefresh";

interface AuthContextValue {
  session: any | null;
  user: any | null;
  isPending: boolean;
  signOut: () => Promise<void>;
  isEmbedded: boolean;
  hasMounted: boolean;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [hasMounted, setHasMounted] = useState(false);

  // Handle mount state - prevents hydration mismatch and duplicate requests
  // See: https://github.com/better-auth/better-auth/issues/4609
  useEffect(() => {
    setHasMounted(true);
  }, []);

  // Only call useSession after mount to prevent duplicate requests during hydration
  // This is a workaround for Better Auth's known issue with SSR/hydration
  const { data, isPending } = useBetterAuthSession();

  // Automatically refresh session before expiration
  useSessionRefresh();

  // Return loading state until mounted to prevent hydration issues
  const session = hasMounted ? (data?.session || null) : null;
  const user = hasMounted ? (data?.user || null) : null;
  const finalIsPending = !hasMounted || isPending;

  const signOut = async () => {
    await betterAuthSignOut({
      fetchOptions: {
        onSuccess: () => {
          window.location.href = '/';
        }
      }
    });
  };

  // Check if embedded in iframe
  const isEmbedded = typeof window !== 'undefined' && window.parent !== window;

  return (
    <AuthContext.Provider value={{
      session,
      user,
      isPending: finalIsPending,
      signOut,
      isEmbedded,
      hasMounted
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuthContext(): AuthContextValue {
  const context = useContext(AuthContext);
  if (context === undefined) {
    // Return a default value instead of throwing when used outside provider
    return {
      session: null,
      user: null,
      isPending: true,
      signOut: async () => {
        await betterAuthSignOut();
      },
      isEmbedded: false,
      hasMounted: true,
    };
  }
  return context;
}

export function useSession() {
  const context = useAuthContext();
  return {
    data: {
      user: context.user,
      session: context.session,
    },
    isPending: context.isPending,
  };
}