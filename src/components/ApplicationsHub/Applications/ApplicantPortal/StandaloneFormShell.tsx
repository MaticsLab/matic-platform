'use client'

import { useMemo } from 'react'
import { cn } from '@/lib/utils'

export type StandaloneImagePosition =
  | 'none' | 'left' | 'right' | 'banner_top' | 'full_background' | 'card_on_image'

interface StandaloneFormShellProps {
  imagePosition: StandaloneImagePosition
  coverImageUrl?: string
  brightness: number
  questionsBackgroundColor: string
  fontFamily: string
  formContent: React.ReactNode
  /** True on the real public page (edge-to-edge, min-h-screen). False inside the
   * builder canvas, which is already framed by its own rounded "device" card —
   * the shell there just fills that frame (h-full) rather than the viewport. */
  fullBleed: boolean
}

/**
 * The six image-position layouts shared between the real public form
 * (`StandaloneFormRenderer`) and the builder's editing canvas (`PortalEditor`).
 * Single source of truth so the two never drift apart visually.
 */
export function StandaloneFormShell({
  imagePosition,
  coverImageUrl,
  brightness,
  questionsBackgroundColor,
  fontFamily,
  formContent,
  fullBleed,
}: StandaloneFormShellProps) {
  const overlayBackground = useMemo(() => {
    if (brightness >= 50) {
      const alpha = ((brightness - 50) / 50) * 0.7
      return `rgba(255,255,255,${alpha.toFixed(2)})`
    }
    const alpha = ((50 - brightness) / 50) * 0.6
    return `rgba(0,0,0,${alpha.toFixed(2)})`
  }, [brightness])

  const showImage = imagePosition !== 'none'
  const isCardOnImage = imagePosition === 'card_on_image'
  const isFullBackground = imagePosition === 'full_background'
  const isBannerTop = imagePosition === 'banner_top'
  const isImageLeft = imagePosition === 'left'

  const imageColumn = (
    <div className="relative w-full h-full bg-blue-200">
      {coverImageUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={coverImageUrl} alt="" className="absolute inset-0 w-full h-full object-cover" />
      )}
      <div className="absolute inset-0" style={{ background: overlayBackground }} />
    </div>
  )

  // fullBleed (real page): min-h-screen. Builder canvas: min-h-full so content
  // taller than the visible frame still grows and scrolls via the canvas's own
  // overflow-y-auto, rather than being clipped at a fixed height.
  const outerSizing = fullBleed ? 'min-h-screen' : 'min-h-full'

  if (isFullBackground || isCardOnImage) {
    return (
      <div className={cn(outerSizing, 'relative flex items-center justify-center overflow-hidden')} style={{ fontFamily }}>
        <div className="absolute inset-0">
          {coverImageUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={coverImageUrl} alt="" className="w-full h-full object-cover" />
          )}
          <div className="absolute inset-0" style={{ background: overlayBackground }} />
        </div>
        <div className={cn('relative z-10 w-full max-w-xl', isCardOnImage && 'p-6 sm:p-10')}>
          <div className="rounded-2xl overflow-hidden shadow-xl" style={{ background: '#fff' }}>
            {formContent}
          </div>
        </div>
      </div>
    )
  }

  if (isBannerTop) {
    return (
      <div className={cn(outerSizing, 'flex flex-col overflow-hidden')} style={{ background: questionsBackgroundColor, fontFamily }}>
        <div className="w-full h-[220px] flex-shrink-0 relative overflow-hidden">{imageColumn}</div>
        <div className="flex-1 flex items-center justify-center overflow-y-auto">{formContent}</div>
      </div>
    )
  }

  if (!showImage) {
    return (
      <div
        className={cn(outerSizing, 'flex items-center justify-center overflow-y-auto')}
        style={{ background: questionsBackgroundColor, fontFamily }}
      >
        {formContent}
      </div>
    )
  }

  return (
    <div className={cn(outerSizing, 'flex flex-col lg:flex-row overflow-hidden')} style={{ fontFamily }}>
      {isImageLeft && (
        <>
          <div className="w-full h-56 relative overflow-hidden lg:hidden">{imageColumn}</div>
          <div className="hidden lg:block lg:w-[42%] relative overflow-hidden">{imageColumn}</div>
        </>
      )}

      <div
        className="w-full lg:w-[58%] flex items-center justify-center overflow-y-auto"
        style={{ background: questionsBackgroundColor }}
      >
        {formContent}
      </div>

      {!isImageLeft && (
        <>
          <div className="w-full h-56 relative overflow-hidden order-first lg:hidden">{imageColumn}</div>
          <div className="hidden lg:block lg:w-[42%] relative overflow-hidden">{imageColumn}</div>
        </>
      )}
    </div>
  )
}
