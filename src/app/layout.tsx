import './globals.css'
import type { Metadata } from 'next'
import { Inter, Instrument_Serif } from 'next/font/google'
import { Providers } from './providers'

const inter = Inter({ subsets: ['latin'] })
const instrumentSerif = Instrument_Serif({
  weight: '400',
  subsets: ['latin'],
  variable: '--font-serif',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'Matic Platform',
  description: 'Forms and Data Tables Platform',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className="light" suppressHydrationWarning>
      <body className={`${inter.className} ${instrumentSerif.variable}`}>
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  )
}
