'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useEffect, useState, useRef, useCallback } from 'react'
import { Navigation } from '@/components/shared/Navigation'
import { Footer } from '@/components/shared/Footer'
import { ScrollNarrative } from '@/components/landing/ScrollNarrative'
import { ScrollFeatures } from '@/components/landing/ScrollFeatures'
import { ArrowRight } from 'lucide-react'

// ============================================================================
// Home Page Component — GIC-inspired light design
// ============================================================================
export default function HomePage() {
  const [time, setTime] = useState('')
  const [scrollProgress, setScrollProgress] = useState(0)
  const [loaded, setLoaded] = useState(false)
  const heroRef = useRef<HTMLElement>(null)

  // Clock
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

  // Parallax scroll handler — progress 0→1 based on hero section
  const handleScroll = useCallback(() => {
    if (heroRef.current) {
      const rect = heroRef.current.getBoundingClientRect()
      const heroHeight = heroRef.current.offsetHeight
      // progress: 0 when top of hero is at top of viewport,
      // 1 when bottom of hero reaches top of viewport
      const rawProgress = -rect.top / heroHeight
      setScrollProgress(Math.max(0, Math.min(1, rawProgress)))
    }
  }, [])

  useEffect(() => {
    let ticking = false
    const onScroll = () => {
      if (!ticking) {
        requestAnimationFrame(() => {
          handleScroll()
          ticking = false
        })
        ticking = true
      }
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [handleScroll])

  // Staggered reveal on mount
  useEffect(() => {
    const t = setTimeout(() => setLoaded(true), 100)
    return () => clearTimeout(t)
  }, [])

  return (
    <div className="min-h-screen bg-[#FEFFFC] text-gray-900 selection:bg-amber-400/30">
      <Navigation variant={scrollProgress >= 0.95 ? 'light' : 'dark'} />

      {/* ── Hero — parallax layered cityscape ── */}
      <section ref={heroRef} className="relative min-h-[100svh] w-full overflow-hidden rounded-b-3xl">
        {/* Keyframe animations */}
        <style jsx>{`
          @keyframes ken-burns {
            0% { transform: scale(1.06); }
            100% { transform: scale(1.0); }
          }
          @keyframes fade-up {
            0% { opacity: 0; transform: translateY(30px); }
            100% { opacity: 1; transform: translateY(0); }
          }
        `}</style>

        {/* === LAYER 0 — Sky gradient (no parallax, static base) === */}
        <div
          className="absolute inset-0 transition-opacity duration-1000"
          style={{
            opacity: loaded ? 1 : 0,
            background: 'linear-gradient(to bottom, #87CEEB 0%, #B0D4E8 40%, #D0E4F0 70%, #E8EFF5 100%)',
          }}
        />

        {/* === LAYER 1 — Clouds (scroll-driven upward movement) === */}
        <div
          className="absolute -top-[40%] left-0 right-0 bottom-0 transition-opacity duration-1000 delay-200"
          style={{
            opacity: loaded ? 1 : 0,
            transform: `translateY(${scrollProgress * -180}px)`,
            willChange: 'transform',
          }}
        >
          <Image
            src="/hero/clouds.png"
            alt=""
            fill
            priority
            className="object-cover"
            style={{ objectPosition: 'center 40%' }}
            sizes="100vw"
          />
        </div>

        {/* === LAYER 2 — City scene (medium parallax + Ken Burns on load) === */}
        <div
          className="absolute inset-0 w-full transition-opacity duration-[1500ms] delay-300"
          style={{
            opacity: loaded ? 1 : 0,
            transform: `translateY(${scrollProgress * 80}px)`,
            willChange: 'transform',
          }}
        >
          <div
            className="absolute inset-0"
            style={{
              animation: loaded ? 'ken-burns 8s ease-out forwards' : 'none',
              transformOrigin: 'center 60%',
            }}
          >
            <Image
              src="/hero/city.png"
              alt="Chicago Michigan Avenue pixel art street scene"
              fill
              priority
              className="object-cover"
              style={{ objectPosition: 'center 25%' }}
              sizes="100vw"
            />
          </div>
        </div>

        {/* === Atmospheric overlays === */}
        {/* Overall darkening layer */}
        <div className="absolute inset-0 pointer-events-none bg-black/25" />

        {/* Bottom fade — subtle, just enough to soften the edge */}
        <div className="absolute bottom-0 left-0 right-0 h-20 pointer-events-none bg-gradient-to-t from-black/10 to-transparent" />

        {/* Top subtle darkening for nav readability */}
        <div className="absolute top-0 left-0 right-0 h-40 pointer-events-none bg-gradient-to-b from-black/15 to-transparent" />

        {/* === LAYER 3 — Content (normal scroll speed, staggered reveal) === */}
        <div className="relative z-10 min-h-[100svh] flex flex-col justify-between px-6 md:px-12 lg:px-24 pb-8">
          {/* Centered hero headline */}
          <div className="flex-1 flex items-center justify-center pt-32 pb-16">
            <h1
              className="font-serif text-[clamp(2.5rem,6.5vw,5.5rem)] leading-[1.1] tracking-tight text-white text-center"
              style={{
                textShadow: '0 2px 30px rgba(0,0,0,0.4), 0 4px 60px rgba(0,0,0,0.2)',
                animation: loaded ? 'fade-up 1s ease-out 0.6s both' : 'none',
              }}
            >
              Collect applications.
              <br />
              Review them faster.
            </h1>
          </div>

          {/* Bottom section — glassmorphic card + timestamp */}
          <div className="flex items-end justify-between gap-8">
            {/* Glassmorphic product card — bottom left */}
            <div
              className="bg-white/[0.15] backdrop-blur-xl rounded-2xl border border-white/[0.2] shadow-2xl shadow-black/20 p-6 md:p-8 max-w-md"
              style={{
                animation: loaded ? 'fade-up 1s ease-out 0.9s both' : 'none',
              }}
            >
              <h2 className="font-serif text-xl md:text-2xl leading-snug text-white mb-3 drop-shadow-sm">
                Build the form. Assign reviewers. Track every decision.
              </h2>
              <p className="text-white/70 text-sm leading-relaxed mb-5">
                No more spreadsheets, email chains, or lost submissions.
              </p>
              <Link
                href="/auth"
                className="group inline-flex items-center gap-2 text-sm font-medium text-white border-b border-white/50 pb-0.5 hover:border-white transition-colors"
              >
                Start for free
                <span className="inline-flex items-center justify-center w-5 h-5 rounded-full border border-white/30 text-[10px]">
                  <ArrowRight className="w-3 h-3" />
                </span>
              </Link>
            </div>

            {/* Timestamp — ambient detail */}
            {time && (
              <div
                className="hidden md:flex items-center gap-3 text-xs text-white/50 tracking-widest font-mono drop-shadow-sm"
                style={{
                  animation: loaded ? 'fade-up 1s ease-out 1.1s both' : 'none',
                }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-white/40">
                  <circle cx="12" cy="12" r="10" />
                  <path d="M12 6v6l4 2" />
                </svg>
                {time}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ── Problem Section — scroll-driven narrative ── */}
      <ScrollNarrative />

      {/* ── Features — scroll-driven ── */}
      <ScrollFeatures />

      {/* ── Portal illustration ── */}
      <section className="bg-white">
        {/* Heading */}
        <div className="px-6 md:px-16 lg:px-24 py-6 flex items-center justify-center">
          <p className="text-center text-lg md:text-xl font-bold text-gray-900 leading-snug">
            A branded application portal your applicants will actually enjoy using.
          </p>
        </div>

        {/* Divider below heading */}
        <div className="w-full h-px bg-gray-200" />

        {/* Card with pixel-art background + screenshot */}
        <div className="px-6 md:px-16 lg:px-24 py-6 md:py-8">
          <div className="relative w-full rounded-3xl overflow-hidden" style={{ minHeight: 480 }}>
            {/* Background — same SVG as section 3 */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/hero/section3-bg.svg"
              alt=""
              aria-hidden
              className="absolute inset-0 w-full h-full object-cover"
            />

            {/* Screenshot centred inside */}
            <div className="relative z-10 flex items-center justify-center px-8 md:px-16 py-10">
              <div className="w-full max-w-4xl rounded-2xl overflow-hidden shadow-2xl">
                <Image
                  src="/hero/section4.png"
                  alt="Applicant portal — The Logan Scholarship login screen"
                  width={1400}
                  height={900}
                  className="w-full h-auto"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Divider below section */}
        <div className="w-full h-px bg-gray-200" />
      </section>

      {/* ── Statement slide — large centered serif ── */}
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
            Every application. Every reviewer. Every decision.
            <br />
            <span className="text-gray-400">All in one place.</span>
          </h2>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="px-6 md:px-12 lg:px-24 py-32 md:py-44 border-t border-gray-100">
        <div className="max-w-3xl">
          <h2 className="font-serif text-3xl md:text-5xl tracking-tight leading-tight text-gray-900 mb-6">
            Set up your first form.
            <br />
            Start reviewing applications today.
          </h2>
          <p className="text-gray-500 text-base md:text-lg mb-10 max-w-xl leading-relaxed">
            Free to start. No credit card required.
          </p>
          <Link
            href="/auth"
            className="group inline-flex items-center gap-2 bg-gray-900 hover:bg-gray-800 text-white px-8 py-4 rounded-full text-sm font-bold transition-colors"
          >
            Get started for free
            <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
          </Link>
        </div>
      </section>

      <Footer variant="light" />
    </div>
  )
}
