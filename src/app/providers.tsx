'use client'

import { useState } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ThemeProvider } from 'next-themes'
import { Toaster } from '@/ui-components/sonner'
import { SessionProvider } from '@/components/auth/provider'

export function Providers({ children }: { children: React.ReactNode }) {
  // Created once per browser tab (useState initializer), never per-render —
  // a fresh QueryClient on every render would drop the cache it exists for.
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: {
      queries: {
        // Data here (workspace/form/organization records) changes on someone's
        // deliberate action, not by the second — avoid refetching on every
        // window refocus, which is React Query's own default.
        refetchOnWindowFocus: false,
        staleTime: 30 * 1000,
      },
    },
  }))

  return (
    <QueryClientProvider client={queryClient}>
      <SessionProvider>
        <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false} forcedTheme="light">
          {children}
          <Toaster position="top-right" richColors expand={false} />
        </ThemeProvider>
      </SessionProvider>
    </QueryClientProvider>
  )
}
