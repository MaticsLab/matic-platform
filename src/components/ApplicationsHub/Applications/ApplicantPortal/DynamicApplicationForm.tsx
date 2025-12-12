'use client'

import { useMemo, useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowLeft, ArrowRight, Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/ui-components/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/ui-components/card'
import { Progress } from '@/ui-components/progress'
import { PortalConfig, Section, Field } from '@/types/portal'
import { PortalFieldAdapter } from '@/components/Fields/PortalFieldAdapter'
import { applyTranslationsToConfig, normalizeTranslations, getUITranslations } from '@/lib/portal-translations'
import { StandaloneLanguageSelector } from '@/components/Portal/LanguageSelector'

interface DynamicApplicationFormProps {
  config: PortalConfig
  onBack?: () => void
  onSubmit?: (formData: Record<string, any>) => Promise<void>
  isExternal?: boolean
  formId?: string
  initialSectionId?: string
}

export function DynamicApplicationForm({ config, onBack, onSubmit, isExternal = false, formId, initialSectionId }: DynamicApplicationFormProps) {
  const defaultLanguage = config.settings.language?.default || 'en'
  const supportedLanguages = Array.from(new Set([defaultLanguage, ...(config.settings.language?.supported || [])])).filter(lang => lang && lang.trim() !== '')
  const [activeLanguage, setActiveLanguage] = useState<string>(defaultLanguage)
  
  // Normalize translations to new format and apply
  const translatedConfig = useMemo(() => {
    if (activeLanguage === defaultLanguage) {
      return config
    }
    // Normalize translations to handle both legacy and new formats
    const normalizedConfig = {
      ...config,
      translations: normalizeTranslations(config.translations || {})
    }
    return applyTranslationsToConfig(normalizedConfig, activeLanguage)
  }, [activeLanguage, defaultLanguage, config])

  // Get translated UI strings
  const ui = useMemo(() => {
    return getUITranslations(config, activeLanguage)
  }, [config, activeLanguage])

  const [activeSectionId, setActiveSectionId] = useState<string>(initialSectionId || translatedConfig.sections?.[0]?.id || '')
  const [formData, setFormData] = useState<Record<string, any>>({})
  const [isSaving, setIsSaving] = useState(false)

  // Update active section when initialSectionId changes (for preview mode navigation)
  useEffect(() => {
    if (initialSectionId) {
      setActiveSectionId(initialSectionId)
    }
  }, [initialSectionId])

  const activeSectionIndex = Math.max(
    0,
    (translatedConfig.sections || []).findIndex((s: Section) => s.id === activeSectionId)
  )
  const activeSection = translatedConfig.sections?.[activeSectionIndex]

  const handleFieldChange = (fieldId: string, value: any) => {
    setFormData(prev => ({ ...prev, [fieldId]: value }))
  }

  const handleNext = () => {
    const sectionsLength = translatedConfig.sections?.length || 0
    if (activeSectionIndex < sectionsLength - 1) {
      setActiveSectionId(translatedConfig.sections?.[activeSectionIndex + 1]?.id || '')
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } else if (activeSectionIndex === sectionsLength - 1) {
      // Last section - submit the form
      if (onSubmit) {
        setIsSaving(true)
        onSubmit(formData).finally(() => setIsSaving(false))
      }
    }
  }

  const handlePrevious = () => {
    if (activeSectionIndex > 0) {
      setActiveSectionId(translatedConfig.sections?.[activeSectionIndex - 1]?.id || '')
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }

  const calculateProgress = () => {
    const sectionsLength = translatedConfig.sections?.length || 0
    if (sectionsLength === 0) return 0
    return ((activeSectionIndex + 1) / sectionsLength) * 100
  }

  // Collect all fields for cross-field references (e.g., rank source)
  const allFields = useMemo(() => {
    return (translatedConfig.sections || []).flatMap((s: Section) => s.fields || [])
  }, [translatedConfig.sections])

  return (
    <div className={cn("flex flex-col", isExternal ? "min-h-screen bg-white" : "bg-gray-50")}>
      {/* Top Bar */}
      <div className={cn(
        isExternal ? "sticky top-0 z-30" : "",
        "transition-all",
        isExternal ? "bg-white/80 backdrop-blur-md border-b border-gray-100" : "bg-white border-b border-gray-200"
      )}>
        <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            {!isExternal && onBack && (
              <Button variant="ghost" size="sm" onClick={onBack}>
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back
              </Button>
            )}
            
            <div className="flex items-center gap-3">
              {config.settings.logoUrl ? (
                <img src={config.settings.logoUrl} alt="Logo" className="h-8 w-auto" />
              ) : (
                <div 
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-white font-bold"
                  style={{ backgroundColor: config.settings.themeColor || '#000' }}
                >
                  {config.settings.name.charAt(0)}
                </div>
              )}
              <span className="font-semibold text-gray-900">{translatedConfig.settings.name}</span>
            </div>
          </div>
          
          <div className="flex items-center gap-6">
            {config.settings.language?.enabled && supportedLanguages.length > 1 && (
              <StandaloneLanguageSelector
                activeLanguage={activeLanguage}
                supportedLanguages={supportedLanguages}
                onLanguageChange={(v) => {
                  setActiveLanguage(v)
                  setActiveSectionId((applyTranslationsToConfig(config, v).sections?.[0]?.id) || translatedConfig.sections?.[0]?.id || '')
                }}
              />
            )}
            <div className="text-right hidden sm:block">
              <div className="text-xs text-gray-500 mb-1">
                Step {activeSectionIndex + 1} of {translatedConfig.sections?.length || 0}
              </div>
              <Progress value={calculateProgress()} className="w-32 h-2" />
            </div>
            <Button 
              className={cn(isExternal && "hover:opacity-90")}
              style={{ backgroundColor: config.settings.themeColor || '#000' }}
            >
              {ui.saveAndExit}
            </Button>
          </div>
        </div>
      </div>

      {/* Main content area with optional left sidebar for tabs */}
      <div className={cn(
        "flex-1 w-full p-4 lg:p-8 pb-20",
        isExternal ? "max-w-6xl mx-auto" : "max-w-3xl mx-auto"
      )}
      >
        <div className={cn(
          "w-full flex gap-8",
          isExternal ? "min-h-[600px]" : ""
        )}>
          {isExternal && (
            <aside className="hidden lg:block w-64 shrink-0">
              <div className="sticky top-4 space-y-2">
                {translatedConfig.sections?.map((section: Section, idx: number) => {
                  const isActive = section.id === activeSectionId
                  const isCompleted = idx < activeSectionIndex
                  return (
                    <button
                      key={section.id}
                      onClick={() => setActiveSectionId(section.id)}
                      className={cn(
                        "w-full flex items-center justify-between rounded-md px-3 py-2 text-sm",
                        "transition-colors",
                        isActive
                          ? "bg-gray-900 text-white"
                          : isCompleted
                          ? "bg-green-50 text-green-700 hover:bg-green-100"
                          : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                      )}
                    >
                      <span className="truncate text-left">{section.title}</span>
                      {isCompleted && <Check className="w-4 h-4" />}
                    </button>
                  )
                })}
              </div>
            </aside>
          )}

          <div className="flex-1 min-w-0">
        <AnimatePresence mode="wait">
          {activeSection && (
            <motion.div
              key={activeSection.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
            >
              {activeSection.sectionType === 'review' ? (
                // Render review section
                <Card className={cn(isExternal ? "border-none shadow-none" : "")}>
                  <CardHeader className={cn(isExternal ? "px-0" : "")}>
                    <CardTitle className="text-2xl">{activeSection.title}</CardTitle>
                    {activeSection.description && (
                      <CardDescription>{activeSection.description}</CardDescription>
                    )}
                  </CardHeader>
                  <CardContent className={cn("space-y-6", isExternal ? "px-0" : "")}>
                    {translatedConfig.sections?.filter((s: Section) => s.sectionType === 'form').map((section: Section, idx: number) => (
                      <div key={section.id} className="space-y-4">
                        <div className="flex items-center justify-between">
                          <h3 className="text-lg font-semibold text-gray-900">{section.title}</h3>
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={() => setActiveSectionId(section.id)}
                          >
                            Edit
                          </Button>
                        </div>
                        <div className="bg-gray-50 rounded-lg p-4 space-y-3">
                          {(section.fields || []).map((field: Field) => {
                            const value = formData[field.id]
                            if (!value || (Array.isArray(value) && value.length === 0)) return null
                            return (
                              <div key={field.id} className="flex justify-between text-sm">
                                <span className="text-gray-600">{field.label}:</span>
                                <span className="text-gray-900 font-medium">
                                  {Array.isArray(value) ? value.join(', ') : String(value)}
                                </span>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    ))}
                    
                    <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                      <p className="text-sm text-blue-900">
                        By submitting this application, I certify that all information provided is accurate and complete to the best of my knowledge.
                      </p>
                    </div>
                  </CardContent>
                </Card>
              ) : activeSection.sectionType === 'ending' ? (
                // Render ending page preview
                <div className="flex items-center justify-center min-h-[600px]">
                  <Card className="max-w-2xl w-full">
                    <CardContent className="p-12 text-center">
                      <div 
                        className="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6"
                        style={{ backgroundColor: `${config.settings.themeColor || '#3B82F6'}20` }}
                      >
                        <svg className="w-10 h-10" style={{ color: config.settings.themeColor || '#3B82F6' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                      <CardTitle className="text-3xl mb-4">
                        {config.settings.endingPage?.title || 'Thank You for Your Submission!'}
                      </CardTitle>
                      <CardDescription className="text-base mb-8">
                        {config.settings.endingPage?.description || "We've received your application and will review it carefully. You'll hear from us soon via email."}
                      </CardDescription>
                      <div className="flex gap-4 justify-center flex-wrap">
                        {config.settings.endingPage?.showDashboardButton !== false && (
                          <Button variant="outline">
                            {config.settings.endingPage?.dashboardButtonText || 'View Dashboard'}
                          </Button>
                        )}
                        {config.settings.endingPage?.showSubmitAnotherButton !== false && (
                          <Button style={{ backgroundColor: config.settings.themeColor || '#3B82F6' }}>
                            {config.settings.endingPage?.submitAnotherButtonText || 'Submit Another'}
                          </Button>
                        )}
                      </div>
                      {config.settings.endingPage?.footerMessage && (
                        <p className="text-sm text-gray-500 mt-8">
                          {config.settings.endingPage.footerMessage}
                        </p>
                      )}
                    </CardContent>
                  </Card>
                </div>
              ) : (
                // Render normal form section
                <Card className={cn(isExternal ? "border-none shadow-none" : "")}>
                  <CardHeader className={cn(isExternal ? "px-0" : "")}>
                    <CardTitle className="text-2xl">{activeSection.title}</CardTitle>
                    {activeSection.description && (
                      <CardDescription>{activeSection.description}</CardDescription>
                    )}
                  </CardHeader>
                  <CardContent className={cn("space-y-6", isExternal ? "px-0" : "")}>
                    <div className="grid grid-cols-12 gap-6">
                      {(activeSection.fields || []).map((field: Field) => (
                        <div key={field.id} className={cn(
                          field.width === 'half' ? 'col-span-12 sm:col-span-6' : 
                          field.width === 'third' ? 'col-span-12 sm:col-span-4' :
                          field.width === 'quarter' ? 'col-span-12 sm:col-span-3' :
                          'col-span-12'
                        )}>
                          <PortalFieldAdapter
                            field={field}
                            value={formData[field.id]}
                            onChange={(val) => handleFieldChange(field.id, val)}
                            themeColor={config.settings.themeColor}
                            formId={formId}
                            allFields={allFields}
                            formData={formData}
                          />
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        <div className="flex justify-between pt-8 mt-8 border-t border-gray-100">
          <Button 
            variant="ghost" 
            onClick={handlePrevious}
            disabled={activeSectionIndex === 0}
            className="text-gray-500"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            {ui.previous}
          </Button>
          <Button 
            onClick={handleNext}
            disabled={isSaving}
            style={{ backgroundColor: config.settings.themeColor || '#000' }}
            className="text-white"
          >
            {activeSectionIndex === (translatedConfig.sections?.length || 0) - 1 ? (
              <>
                {isSaving ? 'Submitting...' : 'Submit'}
              </>
            ) : (
              <>
                {ui.nextSection}
                <ArrowRight className="w-4 h-4 ml-2" />
              </>
            )}
          </Button>
        </div>
          </div>
        </div>
      </div>
    </div>
  )
}
