import './globals.css'
import type { Metadata } from 'next'
import { Inter, Instrument_Serif, Hanken_Grotesk } from 'next/font/google'
import { Providers } from './providers'

const inter = Inter({ subsets: ['latin'] })
const instrumentSerif = Instrument_Serif({
  weight: '400',
  subsets: ['latin'],
  variable: '--font-serif',
  display: 'swap',
})
const hankenGrotesk = Hanken_Grotesk({
  subsets: ['latin'],
  variable: '--font-hanken-grotesk',
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
      <body className={`${inter.className} ${instrumentSerif.variable} ${hankenGrotesk.variable}`}>
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  )
}
