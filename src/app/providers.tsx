'use client'

import { ThemeProvider } from 'next-themes'
import { Toaster } from 'sonner'
import { SessionProvider } from '@/components/auth/provider'

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <SessionProvider>
        {children}
        <Toaster position="top-center" richColors offset={70} />
      </SessionProvider>
    </ThemeProvider>
  )
}
