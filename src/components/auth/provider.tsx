"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { createBrowserClient } from "@supabase/ssr";
import { Session, User } from "@supabase/supabase-js";

const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface AuthContextValue {
  session: Session | null;
  user: User | null;
  isPending: boolean;
  signOut: () => Promise<void>;
  isEmbedded: boolean;
  hasMounted: boolean;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [isPending, setIsPending] = useState(true);
  const [hasMounted, setHasMounted] = useState(false);

  useEffect(() => {
    setHasMounted(true);
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setIsPending(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  // Check if embedded in iframe
  const isEmbedded = typeof window !== 'undefined' && window.parent !== window;

  return (
    <AuthContext.Provider value={{ session, user: session?.user ?? null, isPending, signOut, isEmbedded, hasMounted }}>
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
