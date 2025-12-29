'use client'

import { ThemeProvider } from 'next-themes'
import { Toaster } from 'sonner'
import { HybridAuthProvider } from '@/hooks/use-hybrid-auth'

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <HybridAuthProvider>
        {children}
        <Toaster position="top-right" richColors />
      </HybridAuthProvider>
    </ThemeProvider>
  )
}
