'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Button } from '@/ui-components/button'
import { Navigation } from '@/components/shared/Navigation'
import { Footer } from '@/components/shared/Footer'
import { Check, ArrowRight } from 'lucide-react'

// ============================================================================
// Pricing Plans Data
// ============================================================================
const plans = [
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
      'Priority support',
    ],
    cta: 'Start free trial',
    popular: true,
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
      'Custom onboarding',
    ],
    cta: 'Contact sales',
    popular: false,
  },
]

// ============================================================================
// FAQ Data
// ============================================================================
const faqs = [
  {
    q: 'What is MaticsApp?',
    a: 'MaticsApp is a powerful tool for building application forms, managing data tables, and running review workflows. It\'s useful for making both simple, on-brand forms and more intricate, multi-page application workflows.',
  },
  {
    q: 'How many forms can I make?',
    a: 'You can make an unlimited number of forms on all plans.',
  },
  {
    q: 'Can I cancel my subscription anytime?',
    a: 'Yes, MaticsApp subscriptions are billed monthly or yearly and you can cancel your subscription at any time.',
  },
  {
    q: 'What happens if I go over my submissions limit?',
    a: 'Your forms will still collect responses. You can then upgrade tiers, purchase bulk submissions, or wait until the next month when your quota resets.',
  },
  {
    q: 'How is my data kept safe?',
    a: 'MaticsApp is designed for intaking customer data securely and we follow industry best practices. All your data is encrypted in-transit (with TLS 1.2) and encrypted at rest (with AES-256). Daily, encrypted backups are also kept to ensure business continuity.',
  },
  {
    q: 'Can I customize the forms to look like they were built in-house?',
    a: 'Yes, MaticsApp lets you customize every part of the look and feel of your forms — colors, fonts, positioning, sizing, logos, images, and more.',
  },
]

export default function PricingPage() {
  const [isYearly, setIsYearly] = useState(false)

  return (
    <div className="min-h-screen bg-white">
      <Navigation />

      {/* Hero */}
      <section className="pt-32 pb-4 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center px-4 py-1.5 bg-amber-50 text-amber-700 rounded-full text-xs font-semibold uppercase tracking-wider mb-8 border border-amber-200">
            Plans &amp; Pricing
          </div>
          <h1 className="text-5xl md:text-6xl font-black text-gray-900 tracking-tight leading-tight">
            Simple pricing,{' '}
            <span className="text-amber-500">powerful tools</span>
          </h1>
          <p className="mt-6 text-xl text-gray-500 max-w-2xl mx-auto leading-relaxed">
            Start free and upgrade when you&apos;re ready. Pay monthly or save 20% with an annual plan.
          </p>

          {/* Billing Toggle */}
          <div className="flex items-center justify-center gap-4 mt-10">
            <span className={`text-sm font-semibold uppercase tracking-wider transition-colors ${!isYearly ? 'text-gray-900' : 'text-gray-400'}`}>
              Monthly
            </span>
            <button
              onClick={() => setIsYearly(!isYearly)}
              className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors ${
                isYearly ? 'bg-amber-500' : 'bg-gray-300'
              }`}
            >
              <span
                className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-sm transition-transform ${
                  isYearly ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
            <span className={`text-sm font-semibold uppercase tracking-wider transition-colors ${isYearly ? 'text-gray-900' : 'text-gray-400'}`}>
              Yearly
              <span className="ml-2 px-2 py-0.5 bg-green-100 text-green-700 rounded-full text-[10px] font-bold uppercase">
                Save 20%
              </span>
            </span>
          </div>
        </div>
      </section>

      {/* Pricing Cards */}
      <section className="py-16 px-6">
        <div className="max-w-4xl mx-auto">
          <div className="grid md:grid-cols-2 gap-6">
            {plans.map((plan) => {
              const price = isYearly ? plan.yearlyPrice : plan.monthlyPrice

              return (
                <div
                  key={plan.name}
                  className={`relative rounded-2xl p-8 transition-all ${
                    plan.popular
                      ? 'bg-gray-950 text-white shadow-2xl shadow-gray-900/20 ring-1 ring-gray-800'
                      : 'bg-white border border-gray-200 shadow-sm hover:shadow-md'
                  }`}
                >
                  {plan.popular && (
                    <div className="absolute -top-3 left-8">
                      <span className="px-3 py-1 bg-amber-400 text-gray-900 text-xs font-bold uppercase tracking-wider rounded-full">
                        Most Popular
                      </span>
                    </div>
                  )}

                  <h3 className={`text-lg font-semibold ${plan.popular ? 'text-white' : 'text-gray-900'}`}>
                    {plan.name}
                  </h3>
                  <p className={`text-sm mt-1 ${plan.popular ? 'text-gray-400' : 'text-gray-500'}`}>
                    {plan.description}
                  </p>

                  <div className="mt-6 mb-8">
                    <span className={`text-5xl font-black ${plan.popular ? 'text-white' : 'text-gray-900'}`}>
                      ${price}
                    </span>
                    <span className={`text-sm ml-1 ${plan.popular ? 'text-gray-400' : 'text-gray-500'}`}>
                      / month
                    </span>
                    {isYearly && (
                      <span className={`block text-xs mt-1 ${plan.popular ? 'text-gray-500' : 'text-gray-400'}`}>
                        billed annually
                      </span>
                    )}
                  </div>

                  <Link href="/auth">
                    <Button
                      className={`w-full py-3 text-sm font-semibold ${
                        plan.popular
                          ? 'bg-amber-400 hover:bg-amber-500 text-gray-900 border-0'
                          : 'bg-gray-900 hover:bg-gray-800 text-white'
                      }`}
                    >
                      {plan.cta}
                      <ArrowRight className="ml-2 w-4 h-4" />
                    </Button>
                  </Link>

                  <div className={`mt-8 pt-8 border-t ${plan.popular ? 'border-gray-800' : 'border-gray-100'}`}>
                    <p className={`text-xs font-semibold uppercase tracking-wider mb-4 ${plan.popular ? 'text-gray-400' : 'text-gray-500'}`}>
                      What&apos;s included
                    </p>
                    <ul className="space-y-3">
                      {plan.features.map((feature, i) => (
                        <li key={i} className="flex items-start gap-3 text-sm">
                          <div className={`w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${
                            plan.popular ? 'bg-amber-400' : 'bg-gray-900'
                          }`}>
                            <Check className={`w-2.5 h-2.5 ${plan.popular ? 'text-gray-900' : 'text-white'}`} />
                          </div>
                          <span className={plan.popular ? 'text-gray-300' : 'text-gray-600'}>
                            {feature}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              )
            })}
          </div>

          <p className="text-center text-sm text-gray-400 mt-8">
            All plans include SSL security, 99.9% uptime guarantee, and email support.
          </p>
        </div>
      </section>

      {/* Discount Banner */}
      <section className="py-4 px-6">
        <div className="max-w-4xl mx-auto">
          <div className="bg-gradient-to-r from-amber-400 to-amber-500 rounded-2xl p-8 md:p-10 flex flex-col md:flex-row items-center justify-between gap-6">
            <div>
              <div className="inline-flex items-center px-3 py-1 bg-black/10 rounded-full text-xs font-bold uppercase tracking-wider text-gray-900 mb-3">
                Discounts Available
              </div>
              <h3 className="text-xl md:text-2xl font-bold text-gray-900 leading-snug">
                Special pricing for non-profits, students, startups,
                <br className="hidden md:block" /> and educational institutions.
              </h3>
            </div>
            <a href="mailto:support@maticsapp.com">
              <Button className="bg-gray-900 hover:bg-gray-800 text-white px-6 py-3 font-semibold whitespace-nowrap">
                Apply for Discount
              </Button>
            </a>
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="py-24 px-6">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 tracking-tight">
              Frequently asked questions
            </h2>
            <p className="text-gray-500 mt-3">
              Can&apos;t find the answer you&apos;re looking for?{' '}
              <a href="mailto:support@maticsapp.com" className="text-amber-600 hover:underline font-medium">
                Reach out to us
              </a>.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-x-12 gap-y-10">
            {faqs.map((faq, i) => (
              <div key={i}>
                <h3 className="text-base font-semibold text-gray-900 mb-2">{faq.q}</h3>
                <p className="text-sm text-gray-500 leading-relaxed">{faq.a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Bottom CTA */}
      <section className="py-20 px-6">
        <div className="max-w-3xl mx-auto text-center">
          <div className="bg-gray-950 rounded-3xl p-12 md:p-16">
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4 tracking-tight">
              Make your first form in minutes.
            </h2>
            <p className="text-gray-400 mb-2 text-sm">
              Unlimited forms with 1,000 submissions/month.
            </p>
            <p className="text-gray-400 mb-8 text-sm">
              No credit card required.
            </p>
            <Link href="/auth">
              <Button className="bg-amber-400 hover:bg-amber-500 text-gray-900 px-8 py-3 text-base font-bold">
                Get Started Free
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
