'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Button } from '@/ui-components/button'
import { useSession } from '@/auth/client/main'
import { ArrowRight, Menu, X } from 'lucide-react'

export function Navigation() {
  const [isScrolled, setIsScrolled] = useState(false)
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const { data } = useSession()
  const isAuthenticated = !!data?.user

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 20)
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  return (
    <nav
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        isScrolled ? 'bg-white/95 backdrop-blur-md shadow-sm' : 'bg-white'
      }`}
    >
      <div className="max-w-7xl mx-auto px-6 py-4">
        <div className="flex items-center justify-between">
          {/* Logo */}
          <Link href="/" className="flex items-center">
            <span className="text-2xl font-black text-gray-900 tracking-tight">MaticsApp</span>
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center gap-8">
            <Link href="/#features" className="text-gray-600 hover:text-gray-900 transition-colors text-sm font-medium">
              Features
            </Link>
            <Link href="/pricing" className="text-gray-600 hover:text-gray-900 transition-colors text-sm font-medium">
              Pricing
            </Link>
          </div>

          {/* Auth Buttons */}
          <div className="hidden md:flex items-center gap-3">
            {isAuthenticated ? (
              <Link href="/login">
                <Button>Go to Workspace <ArrowRight className="ml-2 w-4 h-4" /></Button>
              </Link>
            ) : (
              <>
                <Link href="/auth?mode=login">
                  <Button variant="ghost" className="text-gray-600">Log in</Button>
                </Link>
                <Link href="/auth">
                  <Button className="bg-gray-900 hover:bg-gray-800 text-white">Get started</Button>
                </Link>
              </>
            )}
          </div>

          {/* Mobile Menu Button */}
          <button
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="md:hidden p-2 text-gray-600"
          >
            {isMobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>

        {/* Mobile Menu */}
        {isMobileMenuOpen && (
          <div className="md:hidden absolute top-full left-0 right-0 bg-white border-b shadow-lg p-6 space-y-4 z-50">
            <Link href="/#features" className="block text-gray-600 hover:text-gray-900 text-sm font-medium">
              Features
            </Link>
            <Link href="/pricing" className="block text-gray-600 hover:text-gray-900 text-sm font-medium">
              Pricing
            </Link>
            <div className="pt-4 border-t space-y-2">
              {isAuthenticated ? (
                <Link href="/login" className="block">
                  <Button className="w-full">Go to Workspace</Button>
                </Link>
              ) : (
                <>
                  <Link href="/auth?mode=login" className="block">
                    <Button variant="outline" className="w-full">Log in</Button>
                  </Link>
                  <Link href="/auth" className="block">
                    <Button className="w-full bg-gray-900 hover:bg-gray-800 text-white">Get started</Button>
                  </Link>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </nav>
  )
}
