'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Button } from '@/ui-components/button'
import { useSession } from '@/lib/better-auth-client'
import {
  Check,
  ArrowRight,
  Menu,
  X,
  ChevronDown,
} from 'lucide-react'

// ============================================================================
// Navigation Component
// ============================================================================
function Navigation() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const { data } = useSession()
  const isAuthenticated = !!data?.user

  return (
    <nav className="bg-white border-b">
      <div className="max-w-7xl mx-auto px-6 py-4">
        <div className="flex items-center justify-between">
          {/* Logo */}
          <Link href="/" className="flex items-center">
            <span className="text-2xl font-black text-gray-900 tracking-tight">MaticsApp</span>
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center gap-8">
            <Link href="/#features" className="text-gray-600 hover:text-gray-900 transition-colors">
              Features
            </Link>
            <Link href="/pricing" className="text-gray-600 hover:text-gray-900 transition-colors">
              Pricing
            </Link>
          </div>

          {/* Auth Buttons */}
          <div className="hidden md:flex items-center gap-4">
            {isAuthenticated ? (
              <Link href="/workspaces">
                <Button>Go to Workspace</Button>
              </Link>
            ) : (
              <>
                <Link href="/signup-v2?mode=login">
                  <Button variant="ghost">Sign In</Button>
                </Link>
                <Link href="/signup-v2">
                  <Button>Get Started Free</Button>
                </Link>
              </>
            )}
          </div>

          {/* Mobile Menu Button */}
          <button
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="md:hidden p-2 rounded-lg hover:bg-gray-100"
          >
            {isMobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>

        {/* Mobile Menu */}
        {isMobileMenuOpen && (
          <div className="md:hidden absolute top-full left-0 right-0 bg-white border-b shadow-lg p-6 space-y-4 z-50">
            <Link href="/#features" className="block text-gray-600 hover:text-gray-900">
              Features
            </Link>
            <Link href="/pricing" className="block text-gray-600 hover:text-gray-900">
              Pricing
            </Link>
            <div className="pt-4 border-t space-y-2">
              {isAuthenticated ? (
                <Link href="/workspaces" className="block">
                  <Button className="w-full">Go to Workspace</Button>
                </Link>
              ) : (
                <>
                  <Link href="/signup-v2?mode=login" className="block">
                    <Button variant="outline" className="w-full">Sign In</Button>
                  </Link>
                  <Link href="/signup-v2" className="block">
                    <Button className="w-full">Get Started Free</Button>
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
// Pricing Plans Data
// ============================================================================
const plans = [
  {
    name: 'Free',
    monthlyPrice: 0,
    yearlyPrice: 0,
    description: 'Perfect for getting started and personal projects.',
    features: [
      'Up to 3 forms',
      'Up to 2 team members', 
      '100 responses/month',
      'Basic form builder',
      'Email notifications',
      'CSV exports'
    ],
    cta: 'Get started',
    popular: false
  },
  {
    name: 'Professional', 
    monthlyPrice: 75,
    yearlyPrice: 60,
    description: 'For professionals who need advanced features and workflows.',
    features: [
      'Unlimited forms & responses',
      'Up to 10 team members',
      'Advanced form builder',
      'Custom branding',
      'Workflow automation',
      'Analytics & reporting',
      'API access',
      'Priority support'
    ],
    cta: 'Start free trial',
    popular: true
  },
  {
    name: 'Scale',
    monthlyPrice: 199,
    yearlyPrice: 159,
    description: 'For growing teams that need enterprise-grade capabilities.',
    features: [
      'Everything in Professional',
      'Unlimited team members',
      'Advanced security controls',
      'Custom integrations',
      'Dedicated account manager',
      'SLA guarantee',
      'White-label options',
      'Custom onboarding'
    ],
    cta: 'Contact sales',
    popular: false
  }
]

export default function PricingPage() {
  const [isYearly, setIsYearly] = useState(false)

  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation />
      
      {/* Free Tier Showcase */}
      <section className="py-16 bg-gradient-to-br from-purple-900 via-gray-900 to-gray-800">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-12">
            <h2 className="text-4xl md:text-6xl font-bold text-white mb-4">
              Make unlimited forms <span className="text-yellow-400">for free</span>
            </h2>
          </div>
          
          <div className="bg-white/10 backdrop-blur-sm rounded-3xl p-8 relative overflow-hidden">
            {/* FREE, FOREVER Badge */}
            <div className="absolute top-6 left-6">
              <div className="bg-black text-white px-4 py-2 rounded-full text-sm font-bold">
                FREE, FOREVER
              </div>
            </div>
            
            <div className="grid md:grid-cols-4 gap-8 items-center">
              {/* Features Grid */}
              <div className="md:col-span-3 grid md:grid-cols-3 gap-6 mt-12 md:mt-0">
                {/* Column 1 */}
                <div className="space-y-4">
                  {[
                    'Unlimited forms',
                    'Unlimited portals', 
                    'Form portal builder',
                    'Drag & drop builder',
                    'Field validation',
                    'Conditional logic',
                    'File uploads',
                    'Multi-page forms'
                  ].map((feature, index) => (
                    <div key={index} className="flex items-center gap-3 text-white">
                      <div className="w-5 h-5 bg-green-500 rounded-full flex items-center justify-center flex-shrink-0">
                        <Check className="w-3 h-3 text-white" />
                      </div>
                      <span className="text-sm">{feature}</span>
                    </div>
                  ))}
                </div>
                
                {/* Column 2 */}
                <div className="space-y-4">
                  {[
                    'Unlimited users',
                    'Team collaboration',
                    'Real-time updates',
                    'Auto translations',
                    'Mobile optimization',
                    'Custom branding',
                    'Email notifications',
                    'Data export (CSV)'
                  ].map((feature, index) => (
                    <div key={index} className="flex items-center gap-3 text-white">
                      <div className="w-5 h-5 bg-green-500 rounded-full flex items-center justify-center flex-shrink-0">
                        <Check className="w-3 h-3 text-white" />
                      </div>
                      <span className="text-sm">{feature}</span>
                    </div>
                  ))}
                </div>
                
                {/* Column 3 */}
                <div className="space-y-4">
                  {[
                    '100 responses/month',
                    'Data tables & views',
                    'Advanced filtering',
                    'Form analytics',
                    'Workflow automation',
                    'AI form suggestions',
                    'API access',
                    'And 25+ more features'
                  ].map((feature, index) => (
                    <div key={index} className="flex items-center gap-3 text-white">
                      <div className="w-5 h-5 bg-green-500 rounded-full flex items-center justify-center flex-shrink-0">
                        <Check className="w-3 h-3 text-white" />
                      </div>
                      <span className="text-sm font-medium">{feature}</span>
                    </div>
                  ))}
                </div>
              </div>
              
              {/* Free Pricing Card */}
              <div className="bg-white/90 backdrop-blur-sm rounded-2xl p-6 text-center">
                <div className="mb-4">
                  <h3 className="text-2xl font-bold text-gray-900 mb-1">Free,</h3>
                  <h3 className="text-2xl font-bold text-gray-900">forever</h3>
                </div>
                <div className="mb-6">
                  <span className="text-5xl font-bold text-gray-900">$0</span>
                  <span className="text-gray-500 text-sm ml-1">USD</span>
                </div>
                <Link href="/signup-v2">
                  <Button className="w-full bg-black hover:bg-gray-800 text-white font-semibold py-3 text-lg">
                    Get started
                  </Button>
                </Link>
              </div>
            </div>
            
            {/* Explore Premium Features */}
            <div className="text-center mt-12">
              <button className="text-white/80 hover:text-white text-sm font-medium flex items-center gap-2 mx-auto">
                Explore premium features
                <ChevronDown className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing Plans Section */}
      <section className="py-20 bg-gray-50">
        <div className="max-w-7xl mx-auto px-6 text-center">
          {/* Badge */}
          <div className="inline-flex items-center px-4 py-2 bg-amber-100 text-amber-800 rounded-full text-sm font-medium mb-8">
            PLANS & PRICING
          </div>
          
          <h1 className="text-5xl font-bold text-gray-900 mb-6">
            One flat fee, unlimited users
          </h1>
            <p className="text-xl text-gray-600 mb-8 max-w-2xl mx-auto">
            Start free and upgrade based on your needs.<br />
            Pay monthly or save with an annual plan.
          </p>
          
          {/* Billing Toggle */}
          <div className="flex items-center justify-center gap-4 mb-16">
            <span className={`text-lg font-medium ${!isYearly ? 'text-gray-900' : 'text-gray-500'}`}>
              PAY MONTHLY
            </span>
            <button
              onClick={() => setIsYearly(!isYearly)}
              className={`relative inline-flex h-8 w-14 items-center rounded-full transition-colors ${
                isYearly ? 'bg-amber-500' : 'bg-gray-300'
              }`}
            >
              <span
                className={`inline-block h-6 w-6 transform rounded-full bg-white transition-transform ${
                  isYearly ? 'translate-x-7' : 'translate-x-1'
                }`}
              />
            </button>
            <span className={`text-lg font-medium ${isYearly ? 'text-gray-900' : 'text-gray-500'}`}>
              PAY YEARLY
              <span className="ml-2 px-2 py-1 bg-amber-100 text-amber-800 rounded text-sm font-medium">
                SAVE 20%
              </span>
            </span>
          </div>
        </div>
      </section>

      {/* Pricing Plans Section */}
      <section className="py-20 bg-gray-50">
        <div className="max-w-7xl mx-auto px-6 text-center">
          <h2 className="text-4xl font-bold text-gray-900 mb-4">
            Choose your plan
          </h2>
          <p className="text-xl text-gray-600 mb-12 max-w-2xl mx-auto">
            Upgrade for advanced features, unlimited responses, and priority support.
          </p>
          
          {/* Pricing Cards */}
          <div className="grid lg:grid-cols-3 md:grid-cols-2 gap-8 max-w-5xl mx-auto">
            {plans.map((plan, index) => {
              const price = isYearly ? plan.yearlyPrice : plan.monthlyPrice
              const displayPrice = price === 0 ? '$0' : `$${price}`
              
              return (
                <div
                  key={plan.name}
                  className={`relative rounded-xl p-6 text-left ${
                    plan.popular 
                      ? 'bg-gradient-to-br from-amber-50 to-yellow-50 border-2 border-amber-300 shadow-lg' 
                      : 'bg-white border border-gray-200 shadow-sm hover:shadow-md transition-shadow'
                  }`}
                >
                  <div className="mb-8">
                    <h3 className="text-xl font-semibold text-gray-900 mb-2">
                      {plan.name}
                    </h3>
                    <p className="text-sm text-gray-600 mb-4 min-h-[40px]">
                      {plan.description}
                    </p>
                    
                    <div className="mb-6">
                      <span className="text-3xl font-bold text-gray-900">
                        {displayPrice}
                      </span>
                      <span className="text-gray-500 text-sm ml-1">
                        /MONTH
                      </span>
                    </div>
                    
                    <Button 
                      className={`w-full mb-6 ${
                        plan.popular 
                          ? 'bg-black hover:bg-gray-800 text-white border-black' 
                          : 'bg-white hover:bg-gray-50 text-gray-900 border border-gray-300'
                      }`}
                    >
                      {plan.cta}
                    </Button>
                  </div>
                  
                  <ul className="space-y-3">
                    {plan.features.map((feature, featureIndex) => (
                      <li key={featureIndex} className="flex items-center gap-3 text-sm">
                        <div className="w-4 h-4 rounded-full bg-black flex items-center justify-center flex-shrink-0">
                          <Check className="w-2.5 h-2.5 text-white" />
                        </div>
                        <span className="text-gray-700">{feature}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )
            })}
          </div>
          
          <div className="mt-16">
            <p className="text-gray-500 text-sm">
              All plans include SSL security, 99.9% uptime guarantee, and email support.
            </p>
          </div>
        </div>
      </section>

      {/* Discounts Section */}
      <section className="py-16 bg-gradient-to-r from-amber-300 to-yellow-300">
        <div className="max-w-7xl mx-auto px-6 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <div className="bg-black text-white px-4 py-2 rounded-full text-sm font-semibold uppercase tracking-wider">
              Discounts
            </div>
            <div>
              <h3 className="text-2xl font-bold text-gray-900 mb-1">
                MaticsApp offers discounts to non-profits, students,
              </h3>
              <p className="text-xl text-gray-900">
                startups and educational institutions.
              </p>
            </div>
          </div>
          <Link href="/contact">
            <Button className="bg-black text-white hover:bg-gray-800 px-8 py-3">
              Apply for Discount
            </Button>
          </Link>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="py-24 bg-gray-50">
        <div className="max-w-4xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">
              Frequently asked questions
            </h2>
            <p className="text-lg text-gray-600">
              Can't find the answer you're looking for? Ask us.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-12">
            <div className="space-y-8">
              <div>
                <h3 className="text-xl font-semibold text-gray-900 mb-3">
                  What is MaticsApp?
                </h3>
                <p className="text-gray-600 leading-relaxed">
                  MaticsApp is a powerful tool for building application forms and portals. It's useful for 
                  making both simple, on-brand forms and more intricate, multi-page application workflows.
                </p>
              </div>

              <div>
                <h3 className="text-xl font-semibold text-gray-900 mb-3">
                  Can I cancel my subscription anytime?
                </h3>
                <p className="text-gray-600 leading-relaxed">
                  Yes, MaticsApp subscriptions are billed monthly or yearly and you 
                  can cancel your subscription at any time.
                </p>
              </div>

              <div>
                <h3 className="text-xl font-semibold text-gray-900 mb-3">
                  How is my data kept safe?
                </h3>
                <p className="text-gray-600 leading-relaxed">
                  MaticsApp is designed for intaking customer data securely and we 
                  follow industry best practices to keep your responses secure. 
                  MaticsApp is SOC II compliant. All your data is encrypted in-transit 
                  (with TLS 1.2) and encrypted at rest (with AES). Daily, 
                  encrypted backups are also kept to ensure business continuity.
                </p>
                <p className="text-gray-600 leading-relaxed mt-3">
                  For more details on the security measures, please visit{' '}
                  <Link href="/security" className="text-blue-600 hover:underline">
                    security at MaticsApp
                  </Link>.
                </p>
              </div>
            </div>

            <div className="space-y-8">
              <div>
                <h3 className="text-xl font-semibold text-gray-900 mb-3">
                  How many forms can I make?
                </h3>
                <p className="text-gray-600 leading-relaxed">
                  You can make an <strong>unlimited number of forms</strong> on all plans, 
                  including the free plan.
                </p>
              </div>

              <div>
                <h3 className="text-xl font-semibold text-gray-900 mb-3">
                  What happens if I go over my submissions limit?
                </h3>
                <p className="text-gray-600 leading-relaxed">
                  Your forms will still collect responses. You can then upgrade 
                  tiers, purchase bulk submissions or wait until the next month 
                  when your quota resets.
                </p>
              </div>

              <div>
                <h3 className="text-xl font-semibold text-gray-900 mb-3">
                  Can I customize the forms to look like they were built in-house?
                </h3>
                <p className="text-gray-600 leading-relaxed">
                  Yes, MaticsApp lets you customize every part of the look and feel of 
                  your forms.
                </p>
                <p className="text-gray-600 leading-relaxed mt-3">
                  The MaticsApp{' '}
                  <Link href="/portal-builder" className="text-blue-600 hover:underline">
                    portal designer
                  </Link>{' '}
                  lets you set form colors, positioning, 
                  fonts, sizes and more. You can add your logo, your own images 
                  and even host the forms on your own{' '}
                  <Link href="/custom-domain" className="text-blue-600 hover:underline">
                    domain
                  </Link>.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Bottom CTA Section */}
      <section className="py-24 bg-white">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <div className="bg-gray-100 rounded-3xl p-12">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">
              Make your first form in minutes.
            </h2>
            <p className="text-gray-600 mb-2">
              Unlimited forms with 1000 submissions/month.
            </p>
            <p className="text-gray-600 mb-8">
              Unlimited team seats. See{' '}
              <Link href="/pricing" className="text-blue-600 hover:underline">
                pricing
              </Link>{' '}
              for details.
            </p>
            <Link href="/signup-v2">
              <Button className="bg-amber-500 hover:bg-amber-600 text-black px-8 py-3 text-lg font-semibold">
                Get started — it's free
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-white py-16">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-8 mb-12">
            {/* Logo and Description */}
            <div className="lg:col-span-2">
              <Link href="/" className="inline-block mb-6">
                <span className="text-3xl font-black text-amber-400 tracking-tight">MaticsApp</span>
              </Link>
              <p className="text-gray-400 mb-6 text-lg">
                The all-in-one form solution
              </p>
              <div className="flex gap-4">
                <Link href="#" className="text-gray-400 hover:text-white transition-colors">
                  <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z"/>
                  </svg>
                </Link>
                <Link href="#" className="text-gray-400 hover:text-white transition-colors">
                  <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M23.953 4.57a10 10 0 01-2.825.775 4.958 4.958 0 002.163-2.723c-.951.555-2.005.959-3.127 1.184a4.92 4.92 0 00-8.384 4.482C7.69 8.095 4.067 6.13 1.64 3.162a4.822 4.822 0 00-.666 2.475c0 1.71.87 3.213 2.188 4.096a4.904 4.904 0 01-2.228-.616v.06a4.923 4.923 0 003.946 4.827 4.996 4.996 0 01-2.212.085 4.936 4.936 0 004.604 3.417 9.867 9.867 0 01-6.102 2.105c-.39 0-.779-.023-1.17-.067a13.995 13.995 0 007.557 2.209c9.053 0 13.998-7.496 13.998-13.985 0-.21 0-.42-.015-.63A9.935 9.935 0 0024 4.59z"/>
                  </svg>
                </Link>
                <Link href="#" className="text-gray-400 hover:text-white transition-colors">
                  <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 0c-6.627 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
                  </svg>
                </Link>
              </div>
            </div>

            {/* General */}
            <div>
              <h4 className="text-white font-semibold mb-6 uppercase tracking-wider text-sm">General</h4>
              <ul className="space-y-4 text-sm">
                <li><Link href="/" className="text-gray-400 hover:text-white transition-colors">Home</Link></li>
                <li><Link href="/pricing" className="text-gray-400 hover:text-white transition-colors">Pricing</Link></li>
                <li><Link href="/integrations" className="text-gray-400 hover:text-white transition-colors">Integrations</Link></li>
                <li><Link href="/careers" className="text-gray-400 hover:text-white transition-colors">Careers</Link></li>
                <li><Link href="/contact" className="text-gray-400 hover:text-white transition-colors">Report abuse</Link></li>
                <li><Link href="/blog" className="text-gray-400 hover:text-white transition-colors">What's new</Link></li>
                <li><Link href="/blog" className="text-gray-400 hover:text-white transition-colors">Blog</Link></li>
                <li><Link href="/enterprise" className="text-gray-400 hover:text-white transition-colors">Enterprise</Link></li>
              </ul>
            </div>

            {/* Product */}
            <div>
              <h4 className="text-white font-semibold mb-6 uppercase tracking-wider text-sm">Product</h4>
              <ul className="space-y-4 text-sm">
                <li><Link href="/forms" className="text-gray-400 hover:text-white transition-colors">Forms</Link></li>
                <li><Link href="/scheduling" className="text-gray-400 hover:text-white transition-colors">Scheduling</Link></li>
                <li><Link href="/pdf" className="text-gray-400 hover:text-white transition-colors">PDF generation</Link></li>
                <li><Link href="/payments" className="text-gray-400 hover:text-white transition-colors">Payments</Link></li>
                <li><Link href="/workflows" className="text-gray-400 hover:text-white transition-colors">Workflows</Link></li>
                <li><Link href="/conversion" className="text-gray-400 hover:text-white transition-colors">Conversion kit</Link></li>
                <li><Link href="/zite" className="text-gray-400 hover:text-white transition-colors">Zite</Link></li>
              </ul>
            </div>

            {/* AI Tools */}
            <div>
              <h4 className="text-white font-semibold mb-6 uppercase tracking-wider text-sm">AI Tools</h4>
              <ul className="space-y-4 text-sm">
                <li><Link href="/ai-quiz" className="text-gray-400 hover:text-white transition-colors">AI Quiz Maker</Link></li>
                <li><Link href="/ai-form" className="text-gray-400 hover:text-white transition-colors">AI Form Builder</Link></li>
                <li><Link href="/ai-survey" className="text-gray-400 hover:text-white transition-colors">AI Survey Maker</Link></li>
                <li><Link href="/google-import" className="text-gray-400 hover:text-white transition-colors">Import Google Form</Link></li>
                <li><Link href="/ai-signature" className="text-gray-400 hover:text-white transition-colors">AI Signature Maker</Link></li>
                <li><Link href="/survey-questions" className="text-gray-400 hover:text-white transition-colors">Survey questions</Link></li>
                <li><Link href="/pdf-to-form" className="text-gray-400 hover:text-white transition-colors">PDF to Form</Link></li>
              </ul>
            </div>

            {/* Resources */}
            <div>
              <h4 className="text-white font-semibold mb-6 uppercase tracking-wider text-sm">Resources</h4>
              <ul className="space-y-4 text-sm">
                <li><Link href="/help" className="text-gray-400 hover:text-white transition-colors">Help Center</Link></li>
                <li><Link href="/about" className="text-gray-400 hover:text-white transition-colors">About MaticsApp</Link></li>
                <li><Link href="/status" className="text-gray-400 hover:text-white transition-colors">Status</Link></li>
                <li><Link href="/form-builder" className="text-gray-400 hover:text-white transition-colors">Form builder comparison</Link></li>
                <li><Link href="/vs-jotform" className="text-gray-400 hover:text-white transition-colors">MaticsApp vs Jotform</Link></li>
                <li><Link href="/vs-typeform" className="text-gray-400 hover:text-white transition-colors">vs Typeform</Link></li>
                <li><Link href="/vs-google-forms" className="text-gray-400 hover:text-white transition-colors">vs Google Forms</Link></li>
                <li><Link href="/vs-surveymonkey" className="text-gray-400 hover:text-white transition-colors">vs SurveyMonkey</Link></li>
                <li><Link href="/vs-formstack" className="text-gray-400 hover:text-white transition-colors">vs Formstack</Link></li>
                <li><Link href="/vs-formassembly" className="text-gray-400 hover:text-white transition-colors">vs FormAssembly</Link></li>
              </ul>
            </div>
          </div>

          {/* Bottom Footer */}
          <div className="border-t border-gray-800 pt-8 flex flex-col md:flex-row justify-between items-center">
            <div className="flex flex-wrap gap-6 mb-4 md:mb-0">
              <div className="flex items-center gap-2 px-4 py-2 bg-gray-800 rounded-full">
                <span className="text-xs font-semibold">SOC II Type 2</span>
                <span className="text-xs">Compliant</span>
              </div>
              <div className="flex items-center gap-2 px-4 py-2 bg-gray-800 rounded-full">
                <span className="text-xs font-semibold">256-bit AES</span>
                <span className="text-xs">Data encryption</span>
              </div>
              <div className="flex items-center gap-2 px-4 py-2 bg-gray-800 rounded-full">
                <span className="text-xs font-semibold">24/5 Tech support</span>
                <span className="text-xs">Here if you need us</span>
              </div>
            </div>
            <div className="flex gap-6 text-xs text-gray-400">
              <Link href="/press" className="hover:text-white transition-colors">Press kit</Link>
              <Link href="/privacy" className="hover:text-white transition-colors">Privacy</Link>
              <Link href="/terms" className="hover:text-white transition-colors">Terms</Link>
              <span>© 2026 MaticsApp, Inc.</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}
