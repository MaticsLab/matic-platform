"use client"

import { useEffect, useRef, useState } from "react"
import Image from "next/image"

const FEATURES = [
  {
    label: "Forms",
    heading: "Forms that adapt to every applicant.",
    body: "Conditional logic, file uploads, and validation rules — build it once and let it run. Every submission lands exactly where your team needs it.",
    image: "/hero/section3-1b.png",
  },
  {
    label: "Tables",
    heading: "One table. Not a dozen spreadsheets.",
    body: "Every submission becomes structured data automatically — searchable, sortable, and ready to export whenever you need it.",
    image: "/hero/section3-2b.png",
  },
  {
    label: "Reviews",
    heading: "Reviews without the chaos.",
    body: "Assign reviewers, collect scores and references, and track every decision in one shared pipeline — no more chasing anyone over email.",
    image: "/hero/section3-2b.png",
  },
]

function clamp01(v: number) {
  return Math.max(0, Math.min(1, v))
}

export function ScrollFeatures() {
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

  const rawIndex = progress * FEATURES.length
  const activeIndex = Math.min(Math.floor(rawIndex), FEATURES.length - 1)

  return (
    <div ref={outerRef} style={{ height: `${FEATURES.length * 100}vh` }}>
      <div
        className="sticky top-0 flex flex-col overflow-hidden bg-white"
        style={{ height: "100vh" }}
      >
        <div className="pt-10 pb-6 text-center">
          <h2 className="font-sans font-bold text-lg md:text-xl text-gray-900 tracking-tight">
            Everything you need to run your application process.
          </h2>
        </div>

        <div className="w-full h-px bg-gray-200" />

        <div className="flex-1 min-h-0 grid grid-cols-[1fr_1px_420px]">
          <div className="relative overflow-hidden p-5">
            <div className="absolute inset-5 rounded-2xl overflow-hidden">
              <img
                src="/hero/section3-bg.svg"
                alt=""
                aria-hidden
                className="w-full h-full object-cover object-center"
              />
            </div>
            <div className="relative z-10 flex items-center justify-center h-full px-8 py-8">
              <div
                className="relative w-full rounded-xl overflow-hidden shadow-2xl"
                style={{ maxHeight: "80%", aspectRatio: "16/10" }}
              >
                {FEATURES.map((feature, index) => (
                  <Image
                    key={feature.label}
                    src={feature.image}
                    alt={feature.label}
                    fill
                    className="object-cover object-top transition-opacity duration-700"
                    style={{ opacity: index === activeIndex ? 1 : 0 }}
                    sizes="65vw"
                    priority={index === 0}
                  />
                ))}
              </div>
            </div>
          </div>

          <div className="bg-gray-200" />

          <div className="flex flex-col justify-center px-10 py-10 space-y-8">
            {FEATURES.map((feature, index) => {
              const isActive = index === activeIndex
              return (
                <div key={feature.label}>
                  <h3
                    className="font-sans leading-snug tracking-tight transition-all duration-500"
                    style={{
                      fontSize: isActive ? "1.35rem" : "1.05rem",
                      fontWeight: isActive ? 700 : 400,
                      color: isActive ? "#111" : "#9ca3af",
                    }}
                  >
                    {feature.heading}
                  </h3>
                  <div
                    className="overflow-hidden transition-all duration-500"
                    style={{
                      maxHeight: isActive ? "100px" : "0px",
                      opacity: isActive ? 1 : 0,
                      marginTop: isActive ? "0.5rem" : "0",
                    }}
                  >
                    <p className="text-gray-500 text-sm leading-relaxed">
                      {feature.body}
                    </p>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        <div className="w-full h-px bg-gray-200" />
      </div>
    </div>
  )
}