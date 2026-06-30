'use client'

import { ThemeProvider } from 'next-themes'
import { Toaster } from '@/ui-components/sonner'
import { SessionProvider } from '@/components/auth/provider'

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false} forcedTheme="light">
        {children}
        <Toaster position="top-right" richColors expand={false} />
      </ThemeProvider>
    </SessionProvider>
  )
}
