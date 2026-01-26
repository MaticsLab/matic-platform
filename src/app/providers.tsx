'use client'

import { ThemeProvider } from 'next-themes'
import { Toaster } from '@/ui-components/sonner'

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      {children}
      <Toaster position="top-right" richColors expand={false} />
    </ThemeProvider>
  )
}
