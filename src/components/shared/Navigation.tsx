'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useSession } from '@/auth/client/main'
import { useActiveOrganization, useListOrganizations } from '@/auth/client/main'
import { getLastWorkspace, saveLastWorkspace } from '@/lib/utils'
import { ArrowRight, Menu, X } from 'lucide-react'

interface NavigationProps {
  variant?: 'dark' | 'light'
}

export function Navigation({ variant = 'dark' }: NavigationProps) {
  const [isScrolled, setIsScrolled] = useState(false)
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const { data } = useSession()
  const router = useRouter()
  const pathname = usePathname()
  const isAuthenticated = !!data?.user

  const isDark = variant === 'dark'
  const { data: activeOrg } = useActiveOrganization()
  const { data: organizations } = useListOrganizations()
  const workspaceSlug = activeOrg?.slug ?? organizations?.[0]?.slug

  const parseWorkspaceSlugFromPath = (path: string | null | undefined) => {
    if (!path) return null
    const match = path.match(/^\/workspace\/([^/?#]+)/)
    return match?.[1] ?? null
  }

  useEffect(() => {
    if (typeof window === 'undefined') return

    const slugFromPath = parseWorkspaceSlugFromPath(pathname)
    if (!slugFromPath) return

    saveLastWorkspace(slugFromPath)
    localStorage.setItem('lastWorkspace', JSON.stringify({ slug: slugFromPath }))
  }, [pathname])

  const getStoredWorkspaceSlug = () => {
    if (typeof window === 'undefined') return null

    // Primary source used by most workspace pages.
    const rawLastWorkspace = localStorage.getItem('lastWorkspace')
    if (rawLastWorkspace) {
      try {
        const parsed = JSON.parse(rawLastWorkspace) as { slug?: string } | string
        if (typeof parsed === 'string' && parsed.trim()) return parsed.trim()
        if (typeof parsed === 'object' && parsed?.slug) return parsed.slug
      } catch {
        if (rawLastWorkspace.trim()) return rawLastWorkspace.trim()
      }
    }

    // Backward compatibility with legacy helper key.
    const legacy = getLastWorkspace()
    if (legacy) return legacy

    const slugFromCurrentPath = parseWorkspaceSlugFromPath(window.location.pathname)
    if (slugFromCurrentPath) return slugFromCurrentPath

    if (document.referrer) {
      try {
        const refUrl = new URL(document.referrer)
        if (refUrl.origin === window.location.origin) {
          const slugFromReferrer = parseWorkspaceSlugFromPath(refUrl.pathname)
          if (slugFromReferrer) return slugFromReferrer
        }
      } catch {
        // Ignore malformed referrer.
      }
    }

    return null
  }

  const handleWorkspaceClick = (e: React.MouseEvent) => {
    e.preventDefault()
    const slug = getStoredWorkspaceSlug() ?? workspaceSlug
    router.push(slug ? `/workspace/${slug}/applications` : '/workspace')
    setIsMobileMenuOpen(false)
  }

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 20)
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 flex justify-center px-4 pt-4 md:pt-5">
      {/* Floating glassmorphic pill */}
      <div
        className={`flex items-center gap-1 px-2 py-1.5 rounded-full transition-all duration-500 ${
          isDark
            ? 'bg-white/[0.08] backdrop-blur-xl border border-white/[0.12] shadow-lg shadow-black/20'
            : 'bg-white/80 backdrop-blur-xl border border-gray-200/60 shadow-lg shadow-black/5'
        }`}
      >
        {/* Logo — pixel-art warm mosaic */}
        <Link href="/" className="flex items-center gap-2 pl-2.5 pr-3">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect x="1" y="1" width="6.5" height="6.5" rx="1.5" fill="#F59E0B" opacity="0.9" />
            <rect x="8.75" y="1" width="6.5" height="6.5" rx="1.5" fill="#FB923C" opacity="0.7" />
            <rect x="16.5" y="1" width="6.5" height="6.5" rx="1.5" fill="#FBBF24" opacity="0.5" />
            <rect x="1" y="8.75" width="6.5" height="6.5" rx="1.5" fill="#F97316" opacity="0.6" />
            <rect x="8.75" y="8.75" width="6.5" height="6.5" rx="1.5" fill="#F59E0B" opacity="0.85" />
            <rect x="16.5" y="8.75" width="6.5" height="6.5" rx="1.5" fill="#FB923C" opacity="0.55" />
            <rect x="1" y="16.5" width="6.5" height="6.5" rx="1.5" fill="#FBBF24" opacity="0.45" />
            <rect x="8.75" y="16.5" width="6.5" height="6.5" rx="1.5" fill="#F97316" opacity="0.65" />
            <rect x="16.5" y="16.5" width="6.5" height="6.5" rx="1.5" fill="#F59E0B" opacity="0.8" />
          </svg>
        </Link>

        {/* Desktop links */}
        <div className="hidden md:flex items-center">
          <Link
            href="/#features"
            className={`text-sm font-medium px-3.5 py-1.5 rounded-full transition-colors ${
              isDark ? 'text-white/70 hover:text-white hover:bg-white/10' : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100/60'
            }`}
          >
            Features
          </Link>
          <Link
            href="/pricing"
            className={`text-sm font-medium px-3.5 py-1.5 rounded-full transition-colors ${
              isDark ? 'text-white/70 hover:text-white hover:bg-white/10' : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100/60'
            }`}
          >
            Pricing
          </Link>
          <Link
            href="/company"
            className={`text-sm font-medium px-3.5 py-1.5 rounded-full transition-colors ${
              isDark ? 'text-white/70 hover:text-white hover:bg-white/10' : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100/60'
            }`}
          >
            Company
          </Link>
        </div>

        {/* CTA button — inside the pill */}
        <div className="hidden md:block ml-1">
          {isAuthenticated ? (
            <a
              href="#"
              onClick={handleWorkspaceClick}
              className={`group inline-flex items-center gap-1.5 pl-4 pr-3 py-1.5 rounded-full text-sm font-semibold transition-colors ${
                isDark
                  ? 'bg-white text-gray-900 hover:bg-gray-100'
                  : 'bg-gray-900 text-white hover:bg-gray-800'
              }`}
            >
              Workspace
              <span className={`inline-flex items-center justify-center w-5 h-5 rounded-full text-[10px] ${
                isDark ? 'border border-gray-300' : 'border border-white/40'
              }`}>
                <ArrowRight className="w-3 h-3" />
              </span>
            </a>
          ) : (
            <Link
              href="/auth"
              className={`group inline-flex items-center gap-1.5 pl-4 pr-3 py-1.5 rounded-full text-sm font-semibold transition-colors ${
                isDark
                  ? 'bg-white text-gray-900 hover:bg-gray-100'
                  : 'bg-gray-900 text-white hover:bg-gray-800'
              }`}
            >
              Start Free
              <span className={`inline-flex items-center justify-center w-5 h-5 rounded-full text-[10px] ${
                isDark ? 'border border-gray-300' : 'border border-white/40'
              }`}>
                <ArrowRight className="w-3 h-3" />
              </span>
            </Link>
          )}
        </div>

        {/* Mobile Menu Button */}
        <button
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          className={`md:hidden p-2 rounded-full ${isDark ? 'text-white/70' : 'text-gray-600'}`}
        >
          {isMobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {/* Mobile Menu — dropdown */}
      {isMobileMenuOpen && (
        <div
          className={`md:hidden absolute top-full left-4 right-4 mt-2 p-5 rounded-2xl space-y-3 z-50 ${
            isDark
              ? 'bg-gray-900/95 backdrop-blur-xl border border-white/10 shadow-xl'
              : 'bg-white/90 backdrop-blur-xl border border-gray-200/60 shadow-xl'
          }`}
        >
          <Link
            href="/#features"
            className={`block text-sm font-medium py-2 ${
              isDark ? 'text-white/70 hover:text-white' : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Features
          </Link>
          <Link
            href="/pricing"
            className={`block text-sm font-medium py-2 ${
              isDark ? 'text-white/70 hover:text-white' : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Pricing
          </Link>
          <Link
            href="/company"
            className={`block text-sm font-medium py-2 ${
              isDark ? 'text-white/70 hover:text-white' : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Company
          </Link>
          <div className={`pt-3 space-y-3 ${isDark ? 'border-t border-white/10' : 'border-t border-gray-200'}`}>
            {isAuthenticated ? (
              <a
                href="#"
                onClick={handleWorkspaceClick}
                className={`block text-center px-5 py-2.5 rounded-full text-sm font-semibold ${
                  isDark ? 'bg-white text-gray-900' : 'bg-gray-900 text-white'
                }`}
              >
                Go to Workspace
              </a>
            ) : (
              <>
                <Link
                  href="/auth?mode=login"
                  className={`block text-sm font-medium py-2 ${
                    isDark ? 'text-white/70 hover:text-white' : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  Log in
                </Link>
                <Link
                  href="/auth"
                  className={`block text-center px-5 py-2.5 rounded-full text-sm font-semibold ${
                    isDark ? 'bg-white text-gray-900' : 'bg-gray-900 text-white'
                  }`}
                >
                  Start Free
                </Link>
              </>
            )}
          </div>
        </div>
      )}
    </nav>
  )
}
