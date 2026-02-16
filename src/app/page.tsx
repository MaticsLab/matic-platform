'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useSession } from '@/auth/client/main'
import { Button } from '@/ui-components/button'
import {
  ArrowRight,
  Menu,
  X,
  FileText,
  Table2,
  Users,
  ClipboardCheck,
  Shield,
  Zap,
} from 'lucide-react'

// ============================================================================
// Navigation Component
// ============================================================================
function Navigation() {
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
    <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
      isScrolled ? 'bg-white/95 backdrop-blur-md shadow-sm' : 'bg-white'
    }`}>
      <div className="max-w-7xl mx-auto px-6 py-4">
        <div className="flex items-center justify-between">
          <Link href="/" className="flex items-center">
            <span className="text-2xl font-black text-gray-900 tracking-tight">MaticsApp</span>
          </Link>

          <div className="hidden md:flex items-center gap-8">
            <Link href="#features" className="text-gray-600 hover:text-gray-900 transition-colors">Features</Link>
            <Link href="/pricing" className="text-gray-600 hover:text-gray-900 transition-colors">Pricing</Link>
            <Link href="/privacy" className="text-gray-600 hover:text-gray-900 transition-colors">Privacy</Link>
            <Link href="/terms" className="text-gray-600 hover:text-gray-900 transition-colors">Terms</Link>
          </div>

          <div className="hidden md:flex items-center gap-4">
            {isAuthenticated ? (
              <Link href="/workspace">
                <Button>Go to Workspace <ArrowRight className="ml-2 w-4 h-4" /></Button>
              </Link>
            ) : (
              <>
                <Link href="/auth?mode=login">
                  <Button variant="ghost">Log in</Button>
                </Link>
                <Link href="/auth">
                  <Button>Get started free <ArrowRight className="ml-2 w-4 h-4" /></Button>
                </Link>
              </>
            )}
          </div>

          <button onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} className="md:hidden p-2">
            {isMobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>

        {isMobileMenuOpen && (
          <div className="md:hidden absolute top-full left-0 right-0 bg-white border-b shadow-lg p-6 space-y-4 z-50">
            <Link href="#features" className="block text-gray-600 hover:text-gray-900">Features</Link>
            <Link href="/pricing" className="block text-gray-600 hover:text-gray-900">Pricing</Link>
            <Link href="/privacy" className="block text-gray-600 hover:text-gray-900">Privacy</Link>
            <Link href="/terms" className="block text-gray-600 hover:text-gray-900">Terms</Link>
            <div className="pt-4 border-t space-y-2">
              {isAuthenticated ? (
                <Link href="/workspace" className="block">
                  <Button className="w-full">Go to Workspace</Button>
                </Link>
              ) : (
                <>
                  <Link href="/auth?mode=login" className="block">
                    <Button variant="outline" className="w-full">Log in</Button>
                  </Link>
                  <Link href="/auth" className="block">
                    <Button className="w-full">Get started free</Button>
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

// ============================================================================
// Features Data
// ============================================================================
const features = [
  {
    icon: FileText,
    title: 'Smart Forms',
    description: 'Build powerful, customizable forms with advanced field types, conditional logic, and file uploads. Collect data from applicants and respondents effortlessly.',
  },
  {
    icon: Table2,
    title: 'Data Tables',
    description: 'Organize and manage your data with spreadsheet-like tables. Sort, filter, search, and link records across tables for complete data visibility.',
  },
  {
    icon: ClipboardCheck,
    title: 'Review Workflows',
    description: 'Set up multi-stage review processes with custom rubrics, reviewer assignments, and scoring. Streamline how your team evaluates submissions.',
  },
  {
    icon: Users,
    title: 'Team Collaboration',
    description: 'Invite team members to shared workspaces with role-based permissions. Collaborate in real time across forms, tables, and reviews.',
  },
  {
    icon: Shield,
    title: 'Secure & Compliant',
    description: 'Enterprise-grade security with encrypted data, secure authentication, and privacy-first design. Your data is protected at every layer.',
  },
  {
    icon: Zap,
    title: 'Applicant Portal',
    description: 'Give applicants a dedicated portal to submit applications, track their status, and communicate with your team — all in one place.',
  },
]

// ============================================================================
// Home Page Component
// ============================================================================
export default function HomePage() {
  return (
    <div className="min-h-screen bg-white">
      <Navigation />

      {/* Hero Section */}
      <section className="pt-32 pb-20 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-5xl md:text-6xl font-black text-gray-900 tracking-tight leading-tight">
            The all-in-one platform for <span className="text-blue-600">forms, data, and reviews</span>
          </h1>
          <p className="mt-6 text-xl text-gray-600 max-w-2xl mx-auto leading-relaxed">
            MaticsApp helps teams collect data with smart forms, organize it in powerful tables, and run structured review workflows — all from a single workspace.
          </p>
          <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link href="/auth">
              <Button size="lg" className="text-lg px-8 py-6">
                Get started free <ArrowRight className="ml-2 w-5 h-5" />
              </Button>
            </Link>
            <Link href="/pricing">
              <Button variant="outline" size="lg" className="text-lg px-8 py-6">
                View pricing
              </Button>
            </Link>
          </div>
          <p className="mt-4 text-sm text-gray-500">No credit card required. Free plan available.</p>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-20 px-6 bg-gray-50">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900">Everything you need to manage applications and data</h2>
            <p className="mt-4 text-lg text-gray-600 max-w-2xl mx-auto">
              From collecting submissions to reviewing them with your team, MaticsApp brings your entire workflow into one platform.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {features.map((feature) => (
              <div key={feature.title} className="bg-white rounded-xl p-8 shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
                <feature.icon className="w-10 h-10 text-blue-600 mb-4" />
                <h3 className="text-xl font-semibold text-gray-900 mb-2">{feature.title}</h3>
                <p className="text-gray-600 leading-relaxed">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-6">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900">Ready to streamline your workflow?</h2>
          <p className="mt-4 text-lg text-gray-600">
            Join teams that use MaticsApp to collect, organize, and review data more efficiently.
          </p>
          <div className="mt-8">
            <Link href="/auth">
              <Button size="lg" className="text-lg px-8 py-6">
                Get started for free <ArrowRight className="ml-2 w-5 h-5" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-200 py-12 px-6 bg-gray-50">
        <div className="max-w-6xl mx-auto">
          <div className="grid md:grid-cols-4 gap-8">
            <div>
              <span className="text-xl font-black text-gray-900 tracking-tight">MaticsApp</span>
              <p className="mt-2 text-sm text-gray-500">
                The all-in-one platform for forms, data tables, and review workflows. Built by Matics Lab INC.
              </p>
            </div>
            <div>
              <h4 className="font-semibold text-gray-900 mb-3">Product</h4>
              <ul className="space-y-2 text-sm text-gray-600">
                <li><Link href="#features" className="hover:text-gray-900 transition-colors">Features</Link></li>
                <li><Link href="/pricing" className="hover:text-gray-900 transition-colors">Pricing</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-gray-900 mb-3">Legal</h4>
              <ul className="space-y-2 text-sm text-gray-600">
                <li><Link href="/privacy" className="hover:text-gray-900 transition-colors">Privacy Policy</Link></li>
                <li><Link href="/terms" className="hover:text-gray-900 transition-colors">Terms of Service</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-gray-900 mb-3">Contact</h4>
              <ul className="space-y-2 text-sm text-gray-600">
                <li><a href="mailto:support@maticsapp.com" className="hover:text-gray-900 transition-colors">support@maticsapp.com</a></li>
              </ul>
            </div>
          </div>
          <div className="mt-8 pt-8 border-t border-gray-200 flex flex-col md:flex-row items-center justify-between text-sm text-gray-500">
            <p>&copy; {new Date().getFullYear()} Matics Lab INC. All rights reserved.</p>
            <div className="flex gap-6 mt-4 md:mt-0">
              <Link href="/privacy" className="hover:text-gray-900 transition-colors">Privacy Policy</Link>
              <Link href="/terms" className="hover:text-gray-900 transition-colors">Terms of Service</Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}
