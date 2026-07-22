'use client'

import { useMemo, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { generateHTML } from '@tiptap/html'
import StarterKit from '@tiptap/starter-kit'
import { toast } from 'sonner'
import { PortalFieldAdapter } from '@/components/Fields/PortalFieldAdapter'
import { StandaloneLanguageSelector } from '@/components/Portal/LanguageSelector'
import { cn } from '@/lib/utils'
import { getGoogleFont } from '@/lib/fonts'
import { useGoogleFont } from '@/hooks/useGoogleFont'
import type { Form } from '@/types/forms'
import type { PortalConfig, Section } from '@/types/portal'

interface StandaloneFormRendererProps {
  form: Form
  portalConfig: PortalConfig
  formSection: Section
  coverSection?: Section
  onSubmit: (data: Record<string, any>, options?: { saveAndExit?: boolean }) => Promise<void>
  supportedLanguages: string[]
  activeLanguage: string
  onLanguageChange: (lang: string) => void
}

const QUESTION_SIZE_PRESETS: Record<string, { label: number; input: number }> = {
  small: { label: 13, input: 34 },
  normal: { label: 14, input: 38 },
  large: { label: 16, input: 44 },
}

function coverContentToHtml(content?: string): string | null {
  if (!content) return null
  try {
    const json = JSON.parse(content)
    return generateHTML(json, [StarterKit])
  } catch {
    return content
  }
}

export function StandaloneFormRenderer({
  form,
  portalConfig,
  formSection,
  coverSection,
  onSubmit,
  supportedLanguages,
  activeLanguage,
  onLanguageChange,
}: StandaloneFormRendererProps) {
  const [formData, setFormData] = useState<Record<string, any>>({})
  const [isSubmitting, setIsSubmitting] = useState(false)

  const formTheme = portalConfig.settings.formTheme || {}
  const questionsBackgroundColor = formTheme.questionsBackgroundColor || '#F8FAFC'
  const primaryColor = formTheme.primaryColor || portalConfig.settings.themeColor || '#0F172A'
  const questionsColor = formTheme.questionsColor || '#334155'
  const answersColor = formTheme.answersColor || '#334155'
  const imagePosition = formTheme.imagePosition || 'none'
  const brightness = formTheme.coverImageBrightness ?? 50
  const sizePreset = QUESTION_SIZE_PRESETS[formTheme.questionSize || 'normal'] || QUESTION_SIZE_PRESETS.normal
  const selectedFont = getGoogleFont(formTheme.font)
  const showLogo = formTheme.showLogo !== false
  const logoUrls = (formTheme.logoUrls || []).filter(Boolean) as string[]

  useGoogleFont(formTheme.font)

  const coverHtml = useMemo(() => coverContentToHtml(coverSection?.content), [coverSection?.content])

  const overlayBackground = useMemo(() => {
    if (brightness >= 50) {
      const alpha = ((brightness - 50) / 50) * 0.7
      return `rgba(255,255,255,${alpha.toFixed(2)})`
    }
    const alpha = ((50 - brightness) / 50) * 0.6
    return `rgba(0,0,0,${alpha.toFixed(2)})`
  }, [brightness])

  const handleFieldChange = (fieldId: string, value: unknown) => {
    setFormData((prev) => ({ ...prev, [fieldId]: value }))
  }

  const handleSubmit = async () => {
    const missing = (formSection.fields || []).filter((f) => f.required && !formData[f.id])
    if (missing.length > 0) {
      toast.error(
        missing.length === 1
          ? 'Please fill in the required field'
          : `Please fill in all ${missing.length} required fields`
      )
      return
    }
    setIsSubmitting(true)
    try {
      await onSubmit(formData)
    } finally {
      setIsSubmitting(false)
    }
  }

  const showImage = imagePosition !== 'none'
  const isCardOnImage = imagePosition === 'card_on_image'
  const isFullBackground = imagePosition === 'full_background'
  const isBannerTop = imagePosition === 'banner_top'
  const isImageLeft = imagePosition === 'left'

  const themeVars = {
    '--sf-label-size': `${sizePreset.label}px`,
    '--sf-input-height': `${sizePreset.input}px`,
  } as React.CSSProperties

  const formColumn = (
    <div className="standalone-form-fields w-full max-w-xl px-6 py-10 sm:px-10 lg:px-16">
      <div className="flex items-center justify-between mb-8 gap-3">
        <div className="flex items-center gap-2 min-w-0">
          {showLogo && logoUrls.map((url, i) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={i} src={url} alt="" className="h-9 w-auto max-w-[90px] rounded-md object-contain bg-white" />
          ))}
        </div>
        {supportedLanguages.length > 1 && (
          <StandaloneLanguageSelector
            activeLanguage={activeLanguage}
            supportedLanguages={supportedLanguages}
            onLanguageChange={onLanguageChange}
          />
        )}
      </div>

      {coverHtml && (
        <div
          className="mb-6 prose prose-sm max-w-none"
          style={{ color: questionsColor }}
          dangerouslySetInnerHTML={{ __html: coverHtml }}
        />
      )}

      <h1 className="text-2xl font-bold mb-1.5" style={{ color: questionsColor }}>
        {formSection.title || form.name}
      </h1>
      {formSection.description && (
        <p className="text-sm mb-6" style={{ color: questionsColor, opacity: 0.65 }}>
          {formSection.description}
        </p>
      )}

      <div className="space-y-1" style={themeVars}>
        <style>{`
          .standalone-form-fields [style*="--sf-label-size"] label { font-size: var(--sf-label-size); color: ${questionsColor}; }
          .standalone-form-fields [style*="--sf-label-size"] input,
          .standalone-form-fields [style*="--sf-label-size"] textarea,
          .standalone-form-fields [style*="--sf-label-size"] button[role="combobox"] {
            min-height: var(--sf-input-height);
            color: ${answersColor};
          }
        `}</style>
        {(formSection.fields || []).map((field) => (
          <PortalFieldAdapter
            key={field.id}
            field={field}
            value={formData[field.id]}
            onChange={(value) => handleFieldChange(field.id, value)}
            mode="form"
            themeColor={primaryColor}
            allFields={formSection.fields}
            formData={formData}
            formId={form.id}
          />
        ))}
      </div>

      <div className="flex items-center justify-between mt-8">
        <button
          onClick={handleSubmit}
          disabled={isSubmitting}
          className="px-6 py-2.5 rounded-lg text-sm font-semibold text-white disabled:opacity-60 transition-opacity"
          style={{ background: primaryColor }}
        >
          {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Submit'}
        </button>
        <a
          href="https://maticapp.com"
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs hover:underline"
          style={{ color: questionsColor, opacity: 0.5 }}
        >
          Powered by Maticapp
        </a>
      </div>
    </div>
  )

  const imageColumn = (
    <div className="relative w-full h-full bg-blue-200">
      {formTheme.coverImageUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={formTheme.coverImageUrl} alt="" className="absolute inset-0 w-full h-full object-cover" />
      )}
      <div className="absolute inset-0" style={{ background: overlayBackground }} />
    </div>
  )

  // Full background / card-on-image: photo fills the entire viewport, form
  // floats in a centered white card on top — no boxed/padded outer wrapper.
  if (isFullBackground || isCardOnImage) {
    return (
      <div className="min-h-screen relative flex items-center justify-center" style={{ fontFamily: selectedFont.fontFamily }}>
        <div className="absolute inset-0">
          {formTheme.coverImageUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={formTheme.coverImageUrl} alt="" className="w-full h-full object-cover" />
          )}
          <div className="absolute inset-0" style={{ background: overlayBackground }} />
        </div>
        <div className={cn('relative z-10 w-full max-w-xl', isCardOnImage && 'p-6 sm:p-10')}>
          <div className="rounded-2xl overflow-hidden shadow-xl" style={{ background: '#fff' }}>
            {formColumn}
          </div>
        </div>
      </div>
    )
  }

  // Banner top: full-width image strip above the form, no boxed wrapper.
  if (isBannerTop) {
    return (
      <div className="min-h-screen flex flex-col" style={{ background: questionsBackgroundColor, fontFamily: selectedFont.fontFamily }}>
        <div className="w-full h-[220px] flex-shrink-0 relative overflow-hidden">{imageColumn}</div>
        <div className="flex-1 flex items-center justify-center">{formColumn}</div>
      </div>
    )
  }

  // None: single centered column, full height, no image.
  if (!showImage) {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{ background: questionsBackgroundColor, fontFamily: selectedFont.fontFamily }}
      >
        {formColumn}
      </div>
    )
  }

  // Left / right: full-bleed split, image spans the full window height edge to
  // edge on desktop and collapses to a top banner on mobile — mirrors the
  // existing split-screen auth pages (AuthPageRenderer.tsx), not a boxed card.
  return (
    <div className="min-h-screen flex flex-col lg:flex-row" style={{ fontFamily: selectedFont.fontFamily }}>
      {isImageLeft && (
        <>
          <div className="w-full h-56 relative overflow-hidden lg:hidden">{imageColumn}</div>
          <div className="hidden lg:block lg:w-[42%] relative overflow-hidden">{imageColumn}</div>
        </>
      )}

      <div
        className="w-full lg:w-[58%] flex items-center justify-center"
        style={{ background: questionsBackgroundColor }}
      >
        {formColumn}
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
