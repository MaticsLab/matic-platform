'use client'

import { useMemo, useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowLeft, ArrowRight, Check, LayoutDashboard, Save, Printer, Send, CheckCircle, AlertTriangle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/ui-components/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/ui-components/card'
import { Progress } from '@/ui-components/progress'
import { Checkbox } from '@/ui-components/checkbox'
import { PortalConfig, Section, Field } from '@/types/portal'
import { PortalFieldAdapter } from '@/components/Fields/PortalFieldAdapter'
import { BlockRenderer } from '@/components/EndingPages/BlockRenderer'
import { applyTranslationsToConfig, normalizeTranslations, getUITranslations } from '@/lib/portal-translations'
import { StandaloneLanguageSelector } from '@/components/Portal/LanguageSelector'
import { generateHTML } from '@tiptap/html'
import StarterKit from '@tiptap/starter-kit'

/**
 * Recursively strips blob URLs from form data before saving.
 * Blob URLs (created via URL.createObjectURL) are temporary and origin-specific,
 * so they should not be persisted to the database.
 */
function stripBlobUrls(data: any): any {
  if (data === null || data === undefined) return data
  
  if (Array.isArray(data)) {
    return data.map(item => stripBlobUrls(item))
  }
  
  if (typeof data === 'object') {
    const cleaned: Record<string, any> = {}
    for (const [key, value] of Object.entries(data)) {
      // Skip preview property entirely (it contains blob URLs)
      if (key === 'preview') continue
      
      // Check if the value itself is a blob URL string
      if (typeof value === 'string' && value.startsWith('blob:')) {
        continue // Skip blob URL strings
      }
      
      cleaned[key] = stripBlobUrls(value)
    }
    return cleaned
  }
  
  // For primitive values that aren't blob URLs, return as-is
  if (typeof data === 'string' && data.startsWith('blob:')) {
    return undefined
  }
  
  return data
}

interface DynamicApplicationFormProps {
  config: PortalConfig
  onBack?: () => void
  onSubmit?: (formData: Record<string, any>, options?: { saveAndExit?: boolean }) => Promise<void>
  onFormDataChange?: (formData: Record<string, any>) => void // Callback when form data changes
  onDashboard?: () => void // Callback to go to dashboard
  isExternal?: boolean
  formId?: string
  initialSectionId?: string
  initialData?: Record<string, any>
  email?: string // Email for autosave
}

export function DynamicApplicationForm({ config, onBack, onSubmit, onFormDataChange, onDashboard, isExternal = false, formId, initialSectionId, initialData, email }: DynamicApplicationFormProps) {
  const defaultLanguage = config.settings.language?.default || 'en'
  const supportedLanguages = Array.from(new Set([defaultLanguage, ...(config.settings.language?.supported || [])])).filter(lang => lang && lang.trim() !== '')
  const [activeLanguage, setActiveLanguage] = useState<string>(defaultLanguage)
  
  // Helper function to render field values in review section
  const renderFieldValue = (value: any, field?: Field): React.ReactNode => {
    if (value === undefined || value === null || value === '') {
      return <span className="text-gray-400 italic">Not provided</span>
    }
    
    // Handle boolean values
    if (typeof value === 'boolean') {
      return <span className={value ? 'text-green-600' : 'text-gray-500'}>{value ? 'Yes' : 'No'}</span>
    }
    
    // Handle arrays (could be repeaters or multi-select)
    if (Array.isArray(value)) {
      if (value.length === 0) return <span className="text-gray-400 italic">None</span>
      
      // Handle array of objects (repeaters/groups)
      if (typeof value[0] === 'object' && value[0] !== null) {
        return (
          <div className="space-y-3">
            {value.map((item, idx) => (
              <div key={idx} className="bg-gray-50 p-3 rounded-lg border border-gray-200">
                <div className="space-y-1.5">
                  {Object.entries(item).map(([k, v]) => (
                    <div key={k} className="flex gap-2 text-sm">
                      <span className="text-gray-500 capitalize min-w-[120px]">{k.replace(/_/g, ' ')}:</span>
                      <span className="text-gray-900 flex-1">{v ? String(v) : <span className="text-gray-400 italic">-</span>}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )
      }
      
      // Simple array - join with commas
      return value.filter(Boolean).join(', ')
    }
    
    // Handle objects (addresses, files, etc.)
    if (typeof value === 'object' && value !== null) {
      // Handle address objects - check multiple possible formats
      if (value.full_address) {
        return value.full_address
      }
      if (value.formatted_address) {
        return value.formatted_address
      }
      if (value.street_address || value.street || value.city) {
        const parts = [
          value.street_address || value.street,
          value.city,
          value.state,
          value.postal_code || value.zip
        ].filter(Boolean)
        return parts.join(', ') || <span className="text-gray-400 italic">Not provided</span>
      }
      
      // Handle file objects
      if (value.url || value.name || value.fileName) {
        const displayName = value.name || value.fileName || value.originalName || 'File'
        return (
          <div className="flex items-center gap-2">
            <span className="text-blue-600">{displayName}</span>
            {value.url && (
              <a href={value.url} target="_blank" rel="noreferrer" className="text-xs text-blue-500 hover:underline">
                View
              </a>
            )}
          </div>
        )
      }
      
      // For other objects, show as formatted data
      return (
        <div className="bg-gray-50 p-2 rounded border border-gray-200 text-xs">
          {Object.entries(value).map(([k, v]) => (
            <div key={k} className="flex gap-2">
              <span className="text-gray-500 capitalize">{k.replace(/_/g, ' ')}:</span>
              <span className="text-gray-900">{v ? String(v) : '-'}</span>
            </div>
          ))}
        </div>
      )
    }
    
    // For strings, just return as is
    return String(value)
  }
  
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
  const [formData, setFormData] = useState<Record<string, any>>(initialData || {})
  const [isSaving, setIsSaving] = useState(false)
  const [isAutosaving, setIsAutosaving] = useState(false)
  const [agreedToTerms, setAgreedToTerms] = useState(false)
  const [agreedToAccuracy, setAgreedToAccuracy] = useState(false)
  const [lastSavedData, setLastSavedData] = useState<string>('')
  
  // Refs for autosave to avoid stale closures
  const formDataRef = useRef(formData)
  const isAutosavingRef = useRef(false)
  
  // Keep refs in sync
  useEffect(() => {
    formDataRef.current = formData
  }, [formData])

  // Update active section when initialSectionId changes (for preview mode navigation)
  useEffect(() => {
    if (initialSectionId) {
      setActiveSectionId(initialSectionId)
    }
  }, [initialSectionId])

  // Load initial data when provided
  useEffect(() => {
    if (initialData) {
      setFormData(initialData)
      setLastSavedData(JSON.stringify(initialData))
    }
  }, [initialData])

  // Notify parent when form data changes
  useEffect(() => {
    if (onFormDataChange) {
      onFormDataChange(formData)
    }
  }, [formData, onFormDataChange])
  
  // Autosave function - saves as draft without changing status
  const autosave = useCallback(async () => {
    if (!formId || !email || isAutosavingRef.current) return
    
    const currentData = formDataRef.current
    // Strip blob URLs before saving - they are temporary and won't work when loaded
    const cleanedData = stripBlobUrls(currentData)
    const dataString = JSON.stringify(cleanedData)
    
    // Skip if no changes since last save
    if (dataString === lastSavedData || Object.keys(cleanedData).length === 0) return
    
    isAutosavingRef.current = true
    setIsAutosaving(true)
    
    try {
      await fetch(`${process.env.NEXT_PUBLIC_GO_API_URL || 'http://localhost:8080/api/v1'}/forms/${formId}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: cleanedData, email, save_draft: true })
      })
      setLastSavedData(dataString)
    } catch (error) {
      console.warn('Autosave failed:', error)
    } finally {
      isAutosavingRef.current = false
      setIsAutosaving(false)
    }
  }, [formId, email, lastSavedData])
  
  // Debounced autosave - triggers 3 seconds after last change
  useEffect(() => {
    if (!formId || !email) return
    
    const timer = setTimeout(() => {
      autosave()
    }, 3000) // 3 second debounce
    
    return () => clearTimeout(timer)
  }, [formData, formId, email, autosave])

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

  const handleSaveAndExit = async () => {
    try {
      setIsSaving(true)
      // Save as a draft by submitting the current form data with saveAndExit flag
      if (onSubmit) {
        await onSubmit(formData, { saveAndExit: true })
        // onSubmit will handle showing success and redirecting
      } else {
        // Fallback: just redirect if no submit handler
        window.location.href = '/'
      }
    } catch (error) {
      console.error('Error saving form:', error)
      // Even on error, allow user to exit
      window.location.href = '/'
    } finally {
      setIsSaving(false)
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
          
          <div className="flex items-center gap-4">
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
              <div className="text-xs text-gray-500 mb-1 flex items-center justify-end gap-2">
                <span>Step {activeSectionIndex + 1} of {translatedConfig.sections?.length || 0}</span>
                {isAutosaving && (
                  <span className="text-blue-500 flex items-center gap-1">
                    <Save className="w-3 h-3 animate-pulse" />
                    Saving...
                  </span>
                )}
              </div>
              <Progress value={calculateProgress()} className="w-32 h-2" />
            </div>
            {onDashboard && (
              <Button 
                variant="outline"
                size="sm"
                onClick={onDashboard}
                className="text-gray-600 hover:text-gray-900"
              >
                <LayoutDashboard className="w-4 h-4 mr-2" />
                My Dashboard
              </Button>
            )}
            <Button 
              className={cn(isExternal && "hover:opacity-90")}
              style={{ backgroundColor: config.settings.themeColor || '#000' }}
              onClick={handleSaveAndExit}
              disabled={isSaving}
            >
              {isSaving ? 'Saving...' : ui.saveAndExit}
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
                    {/* Completion Status */}
                    <div className={cn("border rounded-lg p-4", "bg-green-50 border-green-200")}>
                      <div className="flex items-start gap-3">
                        <CheckCircle className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
                        <div className="flex-1">
                          <h3 className="font-medium text-green-900">Ready to Submit</h3>
                          <p className="text-sm mt-1 text-green-700">
                            Review your information below and submit when ready.
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Review Sections */}
                    {translatedConfig.sections?.filter((s: Section) => s.sectionType === 'form').map((section: Section) => (
                      <div key={section.id} className="border border-gray-200 rounded-lg p-6">
                        <div className="flex items-center justify-between mb-4 pb-2 border-b">
                          <h3 className="font-medium text-gray-900">{section.title}</h3>
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={() => setActiveSectionId(section.id)}
                            className="text-blue-600 hover:text-blue-700"
                          >
                            Edit
                          </Button>
                        </div>
                        <div className="space-y-4">
                          {(section.fields || []).map((field: Field) => {
                            const value = formData[field.id]
                            if (value === undefined || value === null || value === '' || (Array.isArray(value) && value.length === 0)) return null
                            
                            return (
                              <div key={field.id} className="grid grid-cols-3 gap-4 text-sm">
                                <dt className="text-gray-600">{field.label}</dt>
                                <dd className="col-span-2 text-gray-900 break-words">{renderFieldValue(value, field)}</dd>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    ))}
                    
                    {/* Certifications */}
                    <div className="border border-gray-200 rounded-lg p-6 space-y-4">
                      <h3 className="font-medium text-gray-900">Certification</h3>
                      
                      <div className="space-y-3">
                        <div className="flex items-start gap-3">
                          <Checkbox
                            id="terms"
                            checked={agreedToTerms}
                            onCheckedChange={(checked) => setAgreedToTerms(checked as boolean)}
                            className="mt-1"
                          />
                          <label htmlFor="terms" className="text-sm text-gray-700 cursor-pointer flex-1">
                            I certify that I have read and agree to the{' '}
                            <a href="#" className="text-blue-600 hover:underline">terms and conditions</a>{' '}
                            of this program.
                          </label>
                        </div>

                        <div className="flex items-start gap-3">
                          <Checkbox
                            id="accuracy"
                            checked={agreedToAccuracy}
                            onCheckedChange={(checked) => setAgreedToAccuracy(checked as boolean)}
                            className="mt-1"
                          />
                          <label htmlFor="accuracy" className="text-sm text-gray-700 cursor-pointer flex-1">
                            I certify that all information provided in this application is true and accurate to the 
                            best of my knowledge. I understand that providing false information may result in 
                            disqualification.
                          </label>
                        </div>
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex gap-3 flex-wrap">
                      <Button
                        size="lg"
                        onClick={handleNext}
                        disabled={!agreedToTerms || !agreedToAccuracy || isSaving}
                        className={cn("flex-1 min-w-[200px]", isExternal && "bg-gray-900 hover:bg-gray-800")}
                        style={!isExternal ? { backgroundColor: config.settings.themeColor || '#000' } : undefined}
                      >
                        {isSaving ? (
                          <>
                            <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                            Submitting...
                          </>
                        ) : (
                          <>
                            <Send className="h-4 w-4 mr-2" />
                            Submit Application
                          </>
                        )}
                      </Button>

                      <Button 
                        variant="outline" 
                        size="lg" 
                        onClick={() => window.print()}
                        className="min-w-[180px]"
                      >
                        <Printer className="h-4 w-4 mr-2" />
                        Download PDF
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ) : activeSection.sectionType === 'cover' ? (
                // Render cover page with Novel content
                <div className="w-full -mt-8 -mx-8">
                  {/* Full-width Notion-style container */}
                  <div className="max-w-[900px] mx-auto px-8 py-12">
                    {(activeSection as any).content ? (
                      <div 
                        className="prose prose-lg dark:prose-invert max-w-full"
                        dangerouslySetInnerHTML={{ 
                          __html: (() => {
                            try {
                              const json = JSON.parse((activeSection as any).content)
                              return generateHTML(json, [StarterKit])
                            } catch {
                              return (activeSection as any).content
                            }
                          })()
                        }}
                      />
                    ) : (
                      <div className="py-24">
                        <div className="text-center">
                          <h1 className="text-5xl font-bold mb-4">
                            {activeSection.title || 'Welcome'}
                          </h1>
                          {activeSection.description && (
                            <p className="text-lg text-gray-600">
                              {activeSection.description}
                            </p>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
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

        {/* Navigation - hide on review page since it has its own submit button */}
        {activeSection?.sectionType !== 'review' && (
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
        )}
          </div>
        </div>
      </div>
    </div>
  )
}
