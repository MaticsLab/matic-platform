"use client";

import { createContext, useContext } from "react";
import { useSession as useBetterAuthSession, signOut as betterAuthSignOut } from "@/lib/better-auth-client";

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
  const { data, isPending } = useBetterAuthSession();
  const session = data?.session || null;
  const user = data?.user || null;

  const signOut = async () => {
    await betterAuthSignOut();
  };

  // Check if embedded in iframe
  const isEmbedded = typeof window !== 'undefined' && window.parent !== window;

  return (
    <AuthContext.Provider value={{ session, user, isPending, signOut, isEmbedded, hasMounted: true }}>
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
        await supabase.auth.signOut();
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
