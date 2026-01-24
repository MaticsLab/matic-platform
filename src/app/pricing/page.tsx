'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function PricingPage() {
  const router = useRouter()
  
  useEffect(() => {
    // Redirect to main page
    router.replace('/')
  }, [router])

  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center">
        <h1 className="text-2xl font-bold text-gray-900 mb-4">Redirecting...</h1>
        <p className="text-gray-600">Taking you back to the homepage.</p>
      </div>
    </div>
  )
}

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
          <Link href="/" className="flex items-center gap-2">
            <div className="w-8 h-8 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-lg">M</span>
            </div>
            <span className="text-xl font-semibold text-gray-900">Matic</span>
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center gap-8">
            <Link href="/#features" className="text-gray-600 hover:text-gray-900 transition-colors">
              Features
            </Link>
            <Link href="/#demo" className="text-gray-600 hover:text-gray-900 transition-colors">
              Demo
            </Link>
            <Link href="/pricing" className="text-blue-600 font-medium">
              Pricing
            </Link>
          </div>

          {/* Auth Buttons */}
          <div className="hidden md:flex items-center gap-4">
            {isAuthenticated ? (
              <Link href="/workspaces">
                <Button>Go to Dashboard</Button>
              </Link>
            ) : (
              <>
                <Link href="/login">
                  <Button variant="ghost">Sign In</Button>
                </Link>
                <Link href="/signup">
                  <Button>Get Started Free</Button>
                </Link>
              </>
            )}
          </div>

          {/* Mobile Menu Button */}
          <button
            className="md:hidden p-2"
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          >
            {isMobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>

        {/* Mobile Menu */}
        {isMobileMenuOpen && (
          <div className="md:hidden pt-4 pb-2 space-y-4">
            <Link href="/#features" className="block text-gray-600 hover:text-gray-900">
              Features
            </Link>
            <Link href="/#demo" className="block text-gray-600 hover:text-gray-900">
              Demo
            </Link>
            <Link href="/pricing" className="block text-blue-600 font-medium">
              Pricing
            </Link>
            <div className="pt-4 border-t space-y-2">
              {isAuthenticated ? (
                <Link href="/workspaces" className="block">
                  <Button className="w-full">Go to Dashboard</Button>
                </Link>
              ) : (
                <>
                  <Link href="/login" className="block">
                    <Button variant="outline" className="w-full">Sign In</Button>
                  </Link>
                  <Link href="/signup" className="block">
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
// Pricing Toggle
// ============================================================================
function PricingToggle({
  isAnnual,
  setIsAnnual,
}: {
  isAnnual: boolean
  setIsAnnual: (value: boolean) => void
}) {
  return (
    <div className="flex items-center justify-center gap-4 mb-12">
      <span className={`text-sm ${!isAnnual ? 'text-gray-900 font-medium' : 'text-gray-500'}`}>
        Monthly
      </span>
      <button
        onClick={() => setIsAnnual(!isAnnual)}
        className={`relative w-14 h-7 rounded-full transition-colors ${
          isAnnual ? 'bg-blue-600' : 'bg-gray-200'
        }`}
      >
        <div
          className={`absolute top-1 w-5 h-5 bg-white rounded-full shadow transition-transform ${
            isAnnual ? 'translate-x-8' : 'translate-x-1'
          }`}
        />
      </button>
      <span className={`text-sm ${isAnnual ? 'text-gray-900 font-medium' : 'text-gray-500'}`}>
        Annual
        <span className="ml-2 text-green-600 text-xs font-medium">Save 20%</span>
      </span>
    </div>
  )
}

// ============================================================================
// Pricing Card
// ============================================================================
interface PricingTier {
  name: string
  description: string
  monthlyPrice: number
  features: string[]
  highlighted?: boolean
  cta: string
}

function PricingCard({
  tier,
  isAnnual,
}: {
  tier: PricingTier
  isAnnual: boolean
}) {
  const price = isAnnual ? Math.round(tier.monthlyPrice * 0.8) : tier.monthlyPrice

  return (
    <div
      className={`relative rounded-2xl p-8 ${
        tier.highlighted
          ? 'bg-gradient-to-br from-blue-600 to-indigo-600 text-white shadow-xl shadow-blue-500/25 scale-105'
          : 'bg-white border border-gray-200'
      }`}
    >
      {tier.highlighted && (
        <div className="absolute -top-4 left-1/2 -translate-x-1/2">
          <span className="bg-gradient-to-r from-yellow-400 to-orange-400 text-gray-900 text-sm font-medium px-4 py-1 rounded-full">
            Most Popular
          </span>
        </div>
      )}

      <div className="mb-6">
        <h3 className={`text-xl font-semibold mb-2 ${tier.highlighted ? 'text-white' : 'text-gray-900'}`}>
          {tier.name}
        </h3>
        <p className={`text-sm ${tier.highlighted ? 'text-blue-100' : 'text-gray-500'}`}>
          {tier.description}
        </p>
      </div>

      <div className="mb-6">
        <div className="flex items-baseline gap-1">
          <span className={`text-4xl font-bold ${tier.highlighted ? 'text-white' : 'text-gray-900'}`}>
            ${price}
          </span>
          <span className={tier.highlighted ? 'text-blue-100' : 'text-gray-500'}>
            /month
          </span>
        </div>
        {isAnnual && tier.monthlyPrice > 0 && (
          <p className={`text-sm mt-1 ${tier.highlighted ? 'text-blue-100' : 'text-gray-500'}`}>
            Billed annually (${price * 12}/year)
          </p>
        )}
      </div>

      <Link href="/signup">
        <Button
          className={`w-full mb-6 ${
            tier.highlighted
              ? 'bg-white text-blue-600 hover:bg-gray-100'
              : ''
          }`}
          variant={tier.highlighted ? 'secondary' : 'default'}
        >
          {tier.cta}
          <ArrowRight className="w-4 h-4 ml-2" />
        </Button>
      </Link>

      <ul className="space-y-3">
        {tier.features.map((feature, i) => (
          <li key={i} className="flex items-start gap-3">
            <Check className={`w-5 h-5 flex-shrink-0 ${tier.highlighted ? 'text-blue-200' : 'text-green-500'}`} />
            <span className={`text-sm ${tier.highlighted ? 'text-blue-50' : 'text-gray-600'}`}>
              {feature}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}

// ============================================================================
// FAQ Section
// ============================================================================
function FAQSection() {
  const [openIndex, setOpenIndex] = useState<number | null>(null)

  const faqs = [
    {
      question: 'Can I change plans later?',
      answer: 'Yes! You can upgrade or downgrade your plan at any time. When upgrading, you\'ll be prorated for the remainder of your billing cycle. When downgrading, the change takes effect at the start of your next billing cycle.',
    },
    {
      question: 'What payment methods do you accept?',
      answer: 'We accept all major credit cards (Visa, MasterCard, American Express) and can also process payments via ACH for annual enterprise plans.',
    },
    {
      question: 'Is there a free trial?',
      answer: 'Our Free plan lets you explore Matic with no time limit. When you\'re ready to access more features, you can upgrade to Pro or Business at any time.',
    },
    {
      question: 'What happens to my data if I cancel?',
      answer: 'Your data remains accessible for 30 days after cancellation. During this period, you can export all your data or reactivate your subscription. After 30 days, data is permanently deleted.',
    },
    {
      question: 'Do you offer discounts for nonprofits?',
      answer: 'Yes! We offer a 50% discount on all paid plans for registered nonprofit organizations. Contact our sales team to get set up.',
    },
  ]

  return (
    <section className="py-24 bg-gray-50">
      <div className="max-w-3xl mx-auto px-6">
        <h2 className="text-3xl font-bold text-gray-900 text-center mb-12">
          Frequently Asked Questions
        </h2>

        <div className="space-y-4">
          {faqs.map((faq, i) => (
            <div
              key={i}
              className="bg-white rounded-xl border border-gray-200 overflow-hidden"
            >
              <button
                onClick={() => setOpenIndex(openIndex === i ? null : i)}
                className="w-full px-6 py-4 text-left flex items-center justify-between"
              >
                <span className="font-medium text-gray-900">{faq.question}</span>
                <ChevronDown
                  className={`w-5 h-5 text-gray-500 transition-transform ${
                    openIndex === i ? 'rotate-180' : ''
                  }`}
                />
              </button>
              {openIndex === i && (
                <div className="px-6 pb-4">
                  <p className="text-gray-600">{faq.answer}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

// ============================================================================
// Enterprise CTA
// ============================================================================
function EnterpriseCTA() {
  return (
    <section className="py-24">
      <div className="max-w-4xl mx-auto px-6">
        <div className="bg-gradient-to-br from-gray-900 to-gray-800 rounded-3xl p-12 text-center">
          <Sparkles className="w-12 h-12 text-yellow-400 mx-auto mb-6" />
          <h2 className="text-3xl font-bold text-white mb-4">
            Need a custom solution?
          </h2>
          <p className="text-gray-300 mb-8 max-w-xl mx-auto">
            For large organizations with specific requirements, we offer custom pricing, dedicated support, and advanced security features.
          </p>
          <Link href="mailto:sales@maticsapp.com">
            <Button size="lg" className="bg-white text-gray-900 hover:bg-gray-100">
              Contact Sales
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </Link>
        </div>
      </div>
    </section>
  )
}

// ============================================================================
// Footer
// ============================================================================
function Footer() {
  return (
    <footer className="bg-gray-900 text-gray-400 py-12">
      <div className="max-w-7xl mx-auto px-6">
        <div className="flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-indigo-500 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-lg">M</span>
            </div>
            <span className="text-xl font-semibold text-white">Matic</span>
          </div>
          <p className="text-sm">© 2026 Matic. All rights reserved.</p>
          <div className="flex gap-6 text-sm">
            <Link href="/privacy" className="hover:text-white transition-colors">Privacy</Link>
            <Link href="/terms" className="hover:text-white transition-colors">Terms</Link>
          </div>
        </div>
      </div>
    </footer>
  )
}

// ============================================================================
// Main Pricing Page
// ============================================================================
export default function PricingPage() {
  const [isAnnual, setIsAnnual] = useState(true)

  const tiers: PricingTier[] = [
    {
      name: 'Free',
      description: 'Perfect for getting started',
      monthlyPrice: 0,
      cta: 'Get Started',
      features: [
        '1 workspace',
        '3 forms',
        '100 submissions/month',
        '1 GB storage',
        'Basic analytics',
        'Community support',
      ],
    },
    {
      name: 'Pro',
      description: 'For growing teams',
      monthlyPrice: 29,
      cta: 'Start Free Trial',
      highlighted: true,
      features: [
        'Unlimited workspaces',
        'Unlimited forms',
        '10,000 submissions/month',
        '50 GB storage',
        'Advanced analytics',
        'Review workflows',
        'Team collaboration (up to 10)',
        'Public portals',
        'Priority email support',
      ],
    },
    {
      name: 'Business',
      description: 'For large organizations',
      monthlyPrice: 99,
      cta: 'Contact Sales',
      features: [
        'Everything in Pro, plus:',
        'Unlimited submissions',
        '500 GB storage',
        'Unlimited team members',
        'Custom branding',
        'SSO / SAML',
        'Advanced permissions',
        'API access',
        'Dedicated support',
        'SLA guarantee',
      ],
    },
  ]

  return (
    <main className="min-h-screen bg-gray-50">
      <Navigation />

      {/* Hero */}
      <section className="pt-20 pb-12 bg-white">
        <div className="max-w-7xl mx-auto px-6 text-center">
          <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">
            Simple, transparent pricing
          </h1>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            Start free and scale as you grow. No hidden fees, no surprises.
          </p>
        </div>
      </section>

      {/* Pricing Cards */}
      <section className="py-12 bg-white">
        <div className="max-w-6xl mx-auto px-6">
          <PricingToggle isAnnual={isAnnual} setIsAnnual={setIsAnnual} />

          <div className="grid md:grid-cols-3 gap-8 items-start">
            {tiers.map((tier) => (
              <PricingCard key={tier.name} tier={tier} isAnnual={isAnnual} />
            ))}
          </div>
        </div>
      </section>

      <FAQSection />
      <EnterpriseCTA />
      <Footer />
    </main>
  )
}
