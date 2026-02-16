'use client'

import Link from 'next/link'
import { Button } from '@/ui-components/button'
import { Navigation } from '@/components/shared/Navigation'
import { Footer } from '@/components/shared/Footer'
import {
  ArrowRight,
  FileText,
  Table2,
  Users,
  ClipboardCheck,
  Shield,
  Zap,
} from 'lucide-react'

// ============================================================================
// Features Data
// ============================================================================
const features = [
  {
    icon: FileText,
    title: 'Smart Forms',
    description:
      'Build powerful, customizable forms with advanced field types, conditional logic, and file uploads.',
  },
  {
    icon: Table2,
    title: 'Data Tables',
    description:
      'Organize and manage your data with spreadsheet-like tables. Sort, filter, search, and link records.',
  },
  {
    icon: ClipboardCheck,
    title: 'Review Workflows',
    description:
      'Set up multi-stage review processes with custom rubrics, reviewer assignments, and scoring.',
  },
  {
    icon: Users,
    title: 'Team Collaboration',
    description:
      'Invite team members to shared workspaces with role-based permissions. Collaborate in real time.',
  },
  {
    icon: Shield,
    title: 'Secure & Compliant',
    description:
      'Enterprise-grade security with encrypted data, secure authentication, and privacy-first design.',
  },
  {
    icon: Zap,
    title: 'Applicant Portal',
    description:
      'Give applicants a dedicated portal to submit applications, track status, and communicate.',
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
          <div className="inline-flex items-center px-4 py-1.5 bg-amber-50 text-amber-700 rounded-full text-xs font-semibold uppercase tracking-wider mb-8 border border-amber-200">
            Forms + Data + Reviews
          </div>
          <h1 className="text-5xl md:text-6xl font-black text-gray-900 tracking-tight leading-tight">
            The all-in-one platform for{' '}
            <span className="text-amber-500">forms, data, and reviews</span>
          </h1>
          <p className="mt-6 text-xl text-gray-500 max-w-2xl mx-auto leading-relaxed">
            Collect data with smart forms, organize it in powerful tables, and run structured review
            workflows — all from a single workspace.
          </p>
          <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link href="/auth">
              <Button className="bg-gray-900 hover:bg-gray-800 text-white text-base px-8 py-3 font-semibold">
                Get started free
                <ArrowRight className="ml-2 w-4 h-4" />
              </Button>
            </Link>
            <Link href="/pricing">
              <Button variant="outline" className="text-base px-8 py-3 border-gray-300 text-gray-700 hover:bg-gray-50 font-medium">
                View pricing
              </Button>
            </Link>
          </div>
          <p className="mt-4 text-sm text-gray-400">No credit card required. Free plan available.</p>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-24 px-6 bg-gray-50/80">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 tracking-tight">
              Everything you need to manage applications
            </h2>
            <p className="mt-4 text-gray-500 max-w-2xl mx-auto">
              From collecting submissions to reviewing them with your team, MaticsApp brings your
              entire workflow into one platform.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feature) => (
              <div
                key={feature.title}
                className="bg-white rounded-2xl p-8 border border-gray-100 hover:shadow-md transition-shadow"
              >
                <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center mb-5">
                  <feature.icon className="w-5 h-5 text-amber-600" />
                </div>
                <h3 className="text-base font-semibold text-gray-900 mb-2">{feature.title}</h3>
                <p className="text-sm text-gray-500 leading-relaxed">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24 px-6">
        <div className="max-w-3xl mx-auto text-center">
          <div className="bg-gray-950 rounded-3xl p-12 md:p-16">
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4 tracking-tight">
              Ready to streamline your workflow?
            </h2>
            <p className="text-gray-400 text-sm mb-8 max-w-lg mx-auto">
              Join teams that use MaticsApp to collect, organize, and review data more efficiently.
            </p>
            <Link href="/auth">
              <Button className="bg-amber-400 hover:bg-amber-500 text-gray-900 px-8 py-3 text-base font-bold">
                Get started for free
                <ArrowRight className="ml-2 w-4 h-4" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  )
}
