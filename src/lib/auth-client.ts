// Stub auth-client that adapts Supabase auth to the workflow builder's expected interface
"use client";

import { createBrowserClient } from "@supabase/ssr";
import { useEffect, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";

// Create Supabase client
const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// Hook to get session
export function useSession() {
  const [data, setData] = useState<{ user: User | null; session: Session | null }>({ user: null, session: null });
  const [isPending, setIsPending] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setData({ user: session?.user ?? null, session });
      setIsPending(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setData({ user: session?.user ?? null, session });
    });

    return () => subscription.unsubscribe();
  }, []);

  return { data, isPending };
}

// Sign out function
export async function signOut() {
  await supabase.auth.signOut();
}

// Export a compatible auth client interface
export const authClient = {
  useSession,
  signOut,
  signIn: {
    social: async ({ provider }: { provider: string }) => {
      await supabase.auth.signInWithOAuth({ 
        provider: provider as 'google' | 'github',
        options: {
          redirectTo: `${window.location.origin}/auth/callback`
        }
      });
    },
    anonymous: async () => {
      // Supabase doesn't have anonymous sign-in by default
      console.warn('Anonymous sign-in not supported');
    }
  },
  getSession: async () => {
    const { data } = await supabase.auth.getSession();
    return { session: data.session, user: data.session?.user };
  }
};
