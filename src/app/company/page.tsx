'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { Navigation } from '@/components/shared/Navigation'
import { ArrowRight } from 'lucide-react'

// ============================================================================
// Company Page — GIC-inspired design for Matics Lab
// ============================================================================
export default function CompanyPage() {
  const [time, setTime] = useState('')

  useEffect(() => {
    const update = () => {
      const now = new Date()
      setTime(
        now.toLocaleTimeString('en-US', {
          hour: 'numeric',
          minute: '2-digit',
          hour12: true,
          timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        })
      )
    }
    update()
    const interval = setInterval(update, 30_000)
    return () => clearInterval(interval)
  }, [])

  return (
    <div className="min-h-screen bg-[#FEFFFC] text-gray-900 selection:bg-amber-400/30">
      <Navigation variant="light" />

      {/* ── Hero ── */}
      <section className="relative min-h-[100svh] flex flex-col justify-center px-6 md:px-12 lg:px-24">
        <div className="max-w-4xl pt-24">
          <p className="text-sm tracking-[0.25em] uppercase text-gray-400 mb-10 font-medium">
            Matics Lab
          </p>

          <h1 className="font-serif text-[clamp(2.8rem,7vw,6.5rem)] leading-[1.05] tracking-tight text-gray-900">
            Good work deserves
            <br />
            good tools.
            <br />
            <span className="text-gray-400">We&apos;re here to build them.</span>
          </h1>

          <p className="mt-10 text-lg md:text-xl text-gray-500 max-w-xl leading-relaxed">
            We&apos;re a small team that believes the people doing important work
            deserve software that actually helps them do it.
          </p>

          <div className="mt-12 flex flex-wrap items-center gap-6">
            <Link
              href="/"
              className="group inline-flex items-center gap-2 text-sm font-medium text-gray-900 border-b border-gray-900 pb-0.5 hover:text-gray-600 hover:border-gray-600 transition-colors"
            >
              Explore MaticsApp
              <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
            </Link>
          </div>
        </div>

        {/* Timestamp — GIC-style ambient detail */}
        {time && (
          <div className="absolute bottom-10 right-8 md:right-16 text-xs text-gray-300 tracking-widest font-mono">
            {time}
          </div>
        )}
      </section>

      {/* ── Our Belief ── */}
      <section className="px-6 md:px-12 lg:px-24 py-32 md:py-44">
        <div className="max-w-4xl">
          <p className="text-lg md:text-xl text-gray-500 leading-relaxed max-w-2xl">
            Most software is built for the tool. Matics is built for the work.
          </p>
          <h2 className="mt-12 font-serif text-3xl md:text-5xl lg:text-6xl leading-[1.1] tracking-tight text-gray-900">
            The best software disappears.
            <br />
            You shouldn&apos;t have to
            <br />
            think about it.
          </h2>
          <p className="mt-10 text-lg md:text-xl text-gray-500 max-w-2xl leading-relaxed">
            It just works. Quietly. In the background. While you focus on the
            people who count on you.
          </p>
        </div>
      </section>

      {/* ── Product showcase — scenic illustration + glass card ── */}
      <section className="px-6 md:px-12 lg:px-24 py-8">
        <div className="relative w-full rounded-3xl overflow-hidden" style={{ minHeight: '520px' }}>
          {/* Scenic gradient background — evokes GIC's pixel-art meadow */}
          <div className="absolute inset-0 bg-gradient-to-b from-sky-300 via-emerald-200 to-emerald-400" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom,_rgba(251,191,36,0.15)_0%,_transparent_60%)]" />

          {/* Decorative dots pattern to add texture */}
          <div className="absolute inset-0 opacity-[0.04]" style={{
            backgroundImage: 'radial-gradient(circle, #000 1px, transparent 1px)',
            backgroundSize: '16px 16px',
          }} />

          {/* Glassmorphic card overlay */}
          <div className="relative z-10 flex items-center justify-center p-8 md:p-16" style={{ minHeight: '520px' }}>
            <div className="bg-white/60 backdrop-blur-xl rounded-2xl border border-white/40 shadow-2xl shadow-black/5 p-8 md:p-12 max-w-2xl w-full">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-3 h-3 rounded-full bg-red-400/70" />
                <div className="w-3 h-3 rounded-full bg-yellow-400/70" />
                <div className="w-3 h-3 rounded-full bg-green-400/70" />
              </div>
              <h3 className="text-lg font-semibold text-gray-800 mb-3">MaticsApp</h3>
              <p className="text-sm text-gray-600 leading-relaxed mb-6">
                Smart forms. Structured tables. Multi-stage reviews.
                One workspace for your entire application lifecycle.
              </p>
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center text-xs font-bold text-amber-700">F</div>
                  <div className="flex-1 h-3 bg-gray-200/60 rounded-full" />
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center text-xs font-bold text-blue-700">T</div>
                  <div className="flex-1 h-3 bg-gray-200/60 rounded-full w-3/4" />
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center text-xs font-bold text-emerald-700">R</div>
                  <div className="flex-1 h-3 bg-gray-200/60 rounded-full w-5/6" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Values ── */}
      <section className="px-6 md:px-12 lg:px-24 py-32 md:py-44">
        <div className="grid md:grid-cols-2 gap-16 md:gap-24 items-start max-w-6xl">
          <div>
            <h2 className="font-serif text-3xl md:text-5xl leading-[1.1] tracking-tight text-gray-900">
              What we
              <br />
              stand for.
            </h2>
          </div>
          <div className="space-y-10 md:pt-4">
            <div>
              <h3 className="text-base font-semibold text-gray-900 mb-2">Built for real work</h3>
              <p className="text-gray-500 leading-relaxed">
                Not theoretical workflows. We build for the teams actually in the
                trenches — nonprofits, program managers, coordinators, reviewers.
              </p>
            </div>
            <div>
              <h3 className="text-base font-semibold text-gray-900 mb-2">Simple on purpose</h3>
              <p className="text-gray-500 leading-relaxed">
                Complexity is easy. Simplicity is hard. We choose hard.
              </p>
            </div>
            <div>
              <h3 className="text-base font-semibold text-gray-900 mb-2">People over process</h3>
              <p className="text-gray-500 leading-relaxed">
                Software should serve people, not the other way around. If the tool
                gets in your way, we haven&apos;t done our job.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── Ethos / Mission ── */}
      <section className="px-6 md:px-12 lg:px-24 py-32 md:py-44">
        <div className="max-w-4xl">
          <p className="text-lg md:text-xl text-gray-500 leading-relaxed max-w-2xl mb-12">
            We believe teams doing meaningful work deserve meaningful tools.
          </p>
          <h2 className="font-serif text-3xl md:text-5xl lg:text-6xl leading-[1.1] tracking-tight text-gray-900">
            By putting people first,
            <br />
            we can change how
            <br />
            teams work.
          </h2>
        </div>
      </section>

      {/* ── Founders / story — personal touch ── */}
      <section className="px-6 md:px-12 lg:px-24 py-32 md:py-44 border-t border-gray-100">
        <div className="grid md:grid-cols-2 gap-16 md:gap-24 items-start max-w-6xl">
          <div>
            <p className="text-sm tracking-[0.25em] uppercase text-gray-400 mb-8 font-medium">
              Our story
            </p>
            <h2 className="font-serif text-3xl md:text-4xl leading-[1.1] tracking-tight text-gray-900">
              Matics Lab was built
              <br />
              from the inside out.
            </h2>
          </div>
          <div className="space-y-6 md:pt-14">
            <p className="text-gray-500 leading-relaxed">
              We didn&apos;t start in a boardroom. We started in the work —
              managing programs, tracking people, trying to make sense of data
              scattered across five different tools.
            </p>
            <p className="text-gray-500 leading-relaxed">
              We kept asking: why is this so hard? The answer was always the same.
              Nobody built the right tool for this kind of work.
            </p>
            <p className="text-gray-500 leading-relaxed">
              So we did.
            </p>
            <p className="text-gray-900 font-medium mt-8">
              with love,
              <br />
              The Matics Lab team
            </p>
          </div>
        </div>
      </section>

      {/* ── CTA — careers / join illustration ── */}
      <section className="px-6 md:px-12 lg:px-24 py-8">
        <div className="relative w-full rounded-3xl overflow-hidden" style={{ minHeight: '480px' }}>
          {/* Cityscape-inspired gradient — evokes GIC's NYC pixel-art */}
          <div className="absolute inset-0 bg-gradient-to-b from-sky-400 via-sky-300 to-emerald-300" />
          <div className="absolute bottom-0 left-0 right-0 h-1/2 bg-gradient-to-t from-emerald-500/30 to-transparent" />

          {/* Skyline silhouette suggestion */}
          <div className="absolute bottom-0 left-0 right-0 h-40 bg-gradient-to-t from-gray-800/10 to-transparent" />

          {/* Glassmorphic card */}
          <div className="relative z-10 flex items-end p-8 md:p-16" style={{ minHeight: '480px' }}>
            <div className="bg-white/40 backdrop-blur-xl rounded-2xl border border-white/30 shadow-xl p-8 md:p-10 max-w-lg">
              <h3 className="font-serif text-3xl md:text-4xl leading-[1.1] text-white mb-4 drop-shadow-sm">
                Come build with us.
              </h3>
              <p className="text-white/80 text-sm leading-relaxed mb-6 max-w-sm">
                We believe the best products are built by small, dedicated teams
                who care deeply about craft.
              </p>
              <a
                href="mailto:careers@maticsapp.com"
                className="group inline-flex items-center gap-2 text-sm font-medium text-white border-b border-white/60 pb-0.5 hover:border-white transition-colors"
              >
                Get in touch
                <span className="inline-flex items-center justify-center w-5 h-5 rounded-full border border-white/40 text-[10px]">
                  <ArrowRight className="w-3 h-3" />
                </span>
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* ── Closing statement — large serif, centered (matches GIC footer) ── */}
      <section className="px-6 md:px-12 lg:px-24 py-32 md:py-44">
        <div className="max-w-4xl mx-auto text-center">
          {/* Small icon */}
          <div className="mb-10 flex justify-center">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-gray-300">
              <path d="M12 3v1m0 16v1m-7.07-14.07l.7.7m12.73 12.73l.7.7M3 12h1m16 0h1m-14.07 7.07l.7-.7m12.73-12.73l.7-.7" strokeLinecap="round" />
              <circle cx="12" cy="12" r="4" />
            </svg>
          </div>

          <h2 className="font-serif text-[clamp(2rem,5.5vw,5rem)] leading-[1.1] tracking-tight text-gray-900">
            We&apos;re building something
            <br />
            worth using.
          </h2>

          <p className="mt-10 text-gray-500 text-base">
            If that sounds like the kind of company you want to work with,{' '}
            <Link
              href="/auth"
              className="text-gray-900 border-b border-gray-900 hover:text-gray-600 hover:border-gray-600 transition-colors"
            >
              you&apos;re in the right place
            </Link>
            .
          </p>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="border-t border-gray-100 px-6 md:px-12 lg:px-24 py-12">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-start md:items-center gap-8">
          <div className="flex items-center gap-8 text-sm text-gray-400">
            <Link href="/" className="hover:text-gray-900 transition-colors">Home</Link>
            <Link href="/company" className="text-gray-900 font-medium">About</Link>
            <Link href="/pricing" className="hover:text-gray-900 transition-colors">Pricing</Link>
            <Link href="/privacy" className="hover:text-gray-900 transition-colors">Privacy</Link>
          </div>
          <p className="text-xs text-gray-300">
            &copy; {new Date().getFullYear()} Matics Lab INC
          </p>
        </div>
      </footer>
    </div>
  )
}
