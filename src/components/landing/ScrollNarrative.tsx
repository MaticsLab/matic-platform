"use client"

import { useEffect, useRef, useState } from "react"
import Image from "next/image"

function easeOutCubic(t: number) {
  return 1 - Math.pow(1 - t, 3)
}

function easeInOutCubic(t: number) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2
}

function clamp01(v: number) {
  return Math.max(0, Math.min(1, v))
}

function mapRange(v: number, lo: number, hi: number) {
  return clamp01((v - lo) / (hi - lo))
}

export function ScrollNarrative() {
  const outerRef = useRef<HTMLDivElement>(null)
  const [progress, setProgress] = useState(0)

  useEffect(() => {
    let ticking = false
    const onScroll = () => {
      if (ticking) return
      ticking = true
      requestAnimationFrame(() => {
        if (outerRef.current) {
          const el = outerRef.current
          const scrolled = Math.max(0, -el.getBoundingClientRect().top)
          const scrollable = el.offsetHeight - window.innerHeight
          setProgress(clamp01(scrolled / scrollable))
        }
        ticking = false
      })
    }
    window.addEventListener("scroll", onScroll, { passive: true })
    onScroll()
    return () => window.removeEventListener("scroll", onScroll)
  }, [])

  const outProgress = easeInOutCubic(mapRange(progress, 0.2, 0.52))
  const outY = -outProgress * 22
  const outScale = 1 - outProgress * 0.5
  const outOpacity = 1 - easeOutCubic(mapRange(progress, 0.18, 0.5))

  const inProgress = easeOutCubic(mapRange(progress, 0.55, 0.85))
  const inOpacity = inProgress
  const inY = (1 - inProgress) * 5

  const sub0Opacity = 1 - easeInOutCubic(mapRange(progress, 0.1, 0.4))
  const sub1Opacity = easeInOutCubic(mapRange(progress, 0.58, 0.85))

  const growT = easeInOutCubic(mapRange(progress, 0.18, 1.0))
  const cardPad = 20 * (1 - growT)
  const cardRadius = 24 * (1 - growT)
  const cardHeight = 78 + 22 * growT
  const stickyTop = 4 * (1 - growT)

  return (
    <div ref={outerRef} style={{ height: "360vh" }}>
      <div
        className="sticky flex items-center justify-center"
        style={{
          top: `${stickyTop}rem`,
          height: `calc(100vh - ${stickyTop}rem)`,
          padding: `0 ${cardPad}px`,
        }}
      >
        <div
          className="relative w-full overflow-hidden"
          style={{
            height: `${cardHeight}vh`,
            borderRadius: `${cardRadius}px`,
          }}
        >
          <Image
            src="/hero/section2-bg.png"
            alt="Pixel-art office scene"
            fill
            className="object-cover object-center"
            sizes="100vw"
            priority
          />

          <div className="absolute inset-0 bg-black/20" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/65 via-black/5 to-black/10" />

          <div className="absolute inset-0">
            <div className="absolute" style={{ top: "10%", left: "6%", right: "22%" }}>
              <p
                className="text-white/55 text-sm md:text-base leading-relaxed"
                style={{ opacity: sub0Opacity }}
              >
                You&apos;re doing important work. Real work. And somehow it still
                lives in a Google Sheet.
              </p>
            </div>

            <div className="absolute" style={{ top: "22%", left: "6%", right: "22%" }}>
              <p
                className="text-white/55 text-sm md:text-base leading-relaxed"
                style={{ opacity: sub1Opacity }}
              >
                You didn&apos;t sign up to manage spreadsheets, email chains, and
                good intentions.
              </p>
            </div>

            <div className="absolute" style={{ bottom: "9%", left: "6%", right: "6%" }}>
              <p
                className="absolute bottom-0 left-0 text-white font-bold leading-[1.15] tracking-tight"
                style={{
                  fontSize: "clamp(1.9rem, 4vw, 3.5rem)",
                  maxWidth: "min(20ch, 88%)",
                  transform: `translateY(${outY}vh) scale(${outScale})`,
                  transformOrigin: "left bottom",
                  opacity: outOpacity,
                  willChange: "transform, opacity",
                }}
              >
                You didn&apos;t sign up to manage spreadsheets, email chains, and
                good intentions.
              </p>

              <p
                className="absolute bottom-0 left-0 text-white font-bold leading-[1.15] tracking-tight"
                style={{
                  fontSize: "clamp(1.9rem, 4vw, 3.5rem)",
                  maxWidth: "min(20ch, 88%)",
                  transform: `translateY(${inY}vh)`,
                  opacity: inOpacity,
                  willChange: "transform, opacity",
                }}
              >
                You need one tool that actually keeps up with you. Not five that
                slow you down.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}