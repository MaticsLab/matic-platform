import { createAuthClient } from "better-auth/react"
import { magicLinkClient } from "better-auth/client/plugins";
import { auth } from "./auth"
import {
  inferAdditionalFields,
  organizationClient,
  multiSessionClient,
} from "better-auth/client/plugins"

export const authClient = createAuthClient({
  baseURL: typeof window !== "undefined" 
    ? window.location.origin 
    : process.env.NEXT_PUBLIC_APP_URL || 'https://www.maticsapp.com',
  plugins: [
    inferAdditionalFields<typeof auth>(),
    magicLinkClient(),
    organizationClient(),
    multiSessionClient(),
  ],
})

// Export useful methods for convenience
export const { signIn, signUp, signOut, useSession, getSession } = authClient
