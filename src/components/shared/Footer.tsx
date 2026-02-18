'use client'

import Link from 'next/link'

interface FooterProps {
  variant?: 'dark' | 'light'
}

export function Footer({ variant = 'dark' }: FooterProps) {
  const isDark = variant === 'dark'

  return (
    <footer
      className={`border-t ${
        isDark
          ? 'border-white/[0.06] bg-[#0a0a0a] text-white'
          : 'border-gray-100 bg-[#FEFFFC] text-gray-900'
      }`}
    >
      <div className="max-w-7xl mx-auto px-6 md:px-12 lg:px-20 py-20">
        {/* Top — statement + CTA */}
        <div className="mb-16">
          <h3
            className={`text-2xl md:text-3xl font-bold tracking-tight leading-snug max-w-lg ${
              isDark ? '' : 'text-gray-900'
            }`}
          >
            You&apos;re doing important work.
            <br />
            We built this for you.
          </h3>
          <p className={`mt-4 text-sm max-w-md leading-relaxed ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>
            If that sounds like you,{' '}
            <Link
              href="/auth"
              className={`transition-colors ${
                isDark
                  ? 'text-amber-400 hover:text-amber-300'
                  : 'text-gray-900 border-b border-gray-900 hover:text-gray-600 hover:border-gray-600'
              }`}
            >
              try MaticsApp for free
            </Link>
            {' →'}
          </p>
        </div>

        {/* Links row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-10 mb-16">
          <div>
            <h4
              className={`text-xs font-semibold uppercase tracking-[0.2em] mb-5 ${
                isDark ? 'text-gray-600' : 'text-gray-400'
              }`}
            >
              Product
            </h4>
            <ul className="space-y-3 text-sm">
              <li>
                <Link
                  href="/#features"
                  className={`transition-colors ${
                    isDark ? 'text-gray-400 hover:text-white' : 'text-gray-500 hover:text-gray-900'
                  }`}
                >
                  Features
                </Link>
              </li>
              <li>
                <Link
                  href="/pricing"
                  className={`transition-colors ${
                    isDark ? 'text-gray-400 hover:text-white' : 'text-gray-500 hover:text-gray-900'
                  }`}
                >
                  Pricing
                </Link>
              </li>
              <li>
                <Link
                  href="/auth"
                  className={`transition-colors ${
                    isDark ? 'text-gray-400 hover:text-white' : 'text-gray-500 hover:text-gray-900'
                  }`}
                >
                  Start Free
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h4
              className={`text-xs font-semibold uppercase tracking-[0.2em] mb-5 ${
                isDark ? 'text-gray-600' : 'text-gray-400'
              }`}
            >
              Company
            </h4>
            <ul className="space-y-3 text-sm">
              <li>
                <Link
                  href="/company"
                  className={`transition-colors ${
                    isDark ? 'text-gray-400 hover:text-white' : 'text-gray-500 hover:text-gray-900'
                  }`}
                >
                  About
                </Link>
              </li>
              <li>
                <Link
                  href="/company#story"
                  className={`transition-colors ${
                    isDark ? 'text-gray-400 hover:text-white' : 'text-gray-500 hover:text-gray-900'
                  }`}
                >
                  Our Story
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h4
              className={`text-xs font-semibold uppercase tracking-[0.2em] mb-5 ${
                isDark ? 'text-gray-600' : 'text-gray-400'
              }`}
            >
              Legal
            </h4>
            <ul className="space-y-3 text-sm">
              <li>
                <Link
                  href="/privacy"
                  className={`transition-colors ${
                    isDark ? 'text-gray-400 hover:text-white' : 'text-gray-500 hover:text-gray-900'
                  }`}
                >
                  Privacy Policy
                </Link>
              </li>
              <li>
                <Link
                  href="/terms"
                  className={`transition-colors ${
                    isDark ? 'text-gray-400 hover:text-white' : 'text-gray-500 hover:text-gray-900'
                  }`}
                >
                  Terms of Service
                </Link>
              </li>
              <li>
                <a
                  href="mailto:legal@maticsapp.com"
                  className={`transition-colors ${
                    isDark ? 'text-gray-400 hover:text-white' : 'text-gray-500 hover:text-gray-900'
                  }`}
                >
                  legal@maticsapp.com
                </a>
              </li>
            </ul>
          </div>

          <div>
            <h4
              className={`text-xs font-semibold uppercase tracking-[0.2em] mb-5 ${
                isDark ? 'text-gray-600' : 'text-gray-400'
              }`}
            >
              Contact
            </h4>
            <ul className="space-y-3 text-sm">
              <li>
                <a
                  href="mailto:support@maticsapp.com"
                  className={`transition-colors ${
                    isDark ? 'text-gray-400 hover:text-white' : 'text-gray-500 hover:text-gray-900'
                  }`}
                >
                  support@maticsapp.com
                </a>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom bar */}
        <div
          className={`border-t pt-8 flex flex-col md:flex-row justify-between items-center gap-4 ${
            isDark ? 'border-white/[0.06]' : 'border-gray-100'
          }`}
        >
          <span className={`text-xs ${isDark ? 'text-gray-600' : 'text-gray-300'}`}>
            &copy; {new Date().getFullYear()} Matics Lab &mdash; Built for the work that matters.
          </span>
          <div className={`flex items-center gap-6 text-xs ${isDark ? 'text-gray-600' : 'text-gray-400'}`}>
            <Link
              href="/privacy"
              className={`transition-colors ${isDark ? 'hover:text-gray-400' : 'hover:text-gray-900'}`}
            >
              Privacy
            </Link>
            <Link
              href="/terms"
              className={`transition-colors ${isDark ? 'hover:text-gray-400' : 'hover:text-gray-900'}`}
            >
              Terms
            </Link>
          </div>
        </div>
      </div>
    </footer>
  )
}
