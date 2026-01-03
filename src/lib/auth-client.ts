// Auth client using Better Auth
"use client";

import { useSession, signOut, signIn, getSession } from "@/lib/better-auth-client";

// Re-export Better Auth hooks and functions
export { useSession, signOut };

// Export a compatible auth client interface
export const authClient = {
  useSession,
  signOut,
  signIn: {
    social: async ({ provider }: { provider: string }) => {
      await signIn.social({
        provider: provider as 'google' | 'github',
        callbackURL: `${window.location.origin}/auth/callback`
      });
    },
    anonymous: async () => {
      // Better Auth doesn't have anonymous sign-in by default
      console.warn('Anonymous sign-in not supported');
    }
  },
  getSession,
};
