'use client'

import { useState, useEffect, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowRight, Mail, Lock, Sparkles, CheckCircle2 } from 'lucide-react'
import { Button } from '@/ui-components/button'
import { Input } from '@/ui-components/input'
import { Textarea } from '@/ui-components/textarea'
import { Label } from '@/ui-components/label'
import { DynamicApplicationForm } from './DynamicApplicationForm'
import { Form } from '@/types/forms'
import { Field } from '@/types/portal'
import { cn } from '@/lib/utils'
import { applyTranslationsToConfig, applyTranslationsToField, normalizeTranslations } from '@/lib/portal-translations'
import { portalAuthClient } from '@/lib/api/portal-auth-client'
import { toast } from 'sonner'
import type { TranslationResource } from '@/lib/i18n/types'
import { TranslationProvider, useTranslationContext } from '@/lib/i18n/TranslationProvider'
import { StandaloneLanguageSelector } from '@/components/Portal/LanguageSelector'
import { PortalFieldAdapter } from '@/components/Fields/PortalFieldAdapter'
import { endingPagesClient } from '@/lib/api/ending-pages-client'
import { EndingPageRenderer } from '@/components/EndingPages/BlockRenderer'
import type { EndingPageConfig } from '@/types/ending-blocks'

interface PublicPortalProps {
  slug: string
  subdomain?: string
}

export function PublicPortal({ slug, subdomain }: PublicPortalProps) {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [signupData, setSignupData] = useState<Record<string, any>>({})
  const [isLogin, setIsLogin] = useState(true)
  const [isLoading, setIsLoading] = useState(false)
  const [isFormLoading, setIsFormLoading] = useState(true)
  const [form, setForm] = useState<Form | null>(null)
  const [isSubmitted, setIsSubmitted] = useState(false)
  const [initialData, setInitialData] = useState<any>(null)
  const [submissionData, setSubmissionData] = useState<Record<string, any> | null>(null)
  const [endingPage, setEndingPage] = useState<EndingPageConfig | null>(null)

  // Language support
  const defaultLanguage = form?.settings?.language?.default || 'en'
  const supportedLanguages = useMemo(() => {
    if (!form?.settings?.language?.enabled) return []
    return Array.from(new Set([defaultLanguage, ...(form.settings.language?.supported || [])])).filter(lang => lang && lang.trim() !== '')
  }, [form, defaultLanguage])
  const [activeLanguage, setActiveLanguage] = useState<string>(defaultLanguage)

  // Apply translations to form config
  const translatedForm = useMemo(() => {
    if (!form) return null
    
    // Debug logging
    console.log('🌐 Translating form:', {
      activeLanguage,
      defaultLanguage,
      hasTranslations: !!(form.settings as any)?.translations || !!(form as any)?.translations,
      translations: (form.settings as any)?.translations || (form as any)?.translations
    })

    if (!form.settings?.language?.enabled || activeLanguage === defaultLanguage) {
      return form
    }
    
    // Get raw translations and normalize to new format (handles both legacy and new)
    const rawTranslations = (form.settings as any).translations || (form as any).translations || {}
    const normalizedTranslations = normalizeTranslations(rawTranslations)
    
    if (!normalizedTranslations[activeLanguage]) {
      console.warn(`⚠️ No translations found for language: ${activeLanguage}`)
      return form
    }

    // 1. Translate Config (Settings & Sections)
    // We pass form.settings.sections so the utility can translate section titles
    const rawSections = (form.settings as any).sections || []
    const translatedConfig = applyTranslationsToConfig(
      { sections: rawSections, settings: form.settings, translations: normalizedTranslations },
      activeLanguage
    )

    // 2. Translate Fields (Flat Array)
    // Get the translation resource for active language
    const langResource = normalizedTranslations[activeLanguage]
    const translatedFields = (form.fields || []).map((field) => 
      applyTranslationsToField(field, langResource)
    )

    const result = {
      ...form,
      name: translatedConfig.settings.name || form.name,
      description: translatedConfig.settings.description || form.description,
      settings: {
        ...form.settings,
        // Use the translated sections from the config
        sections: translatedConfig.sections,
        signupFields: translatedConfig.settings.signupFields || form.settings.signupFields
      },
      // Use the manually translated fields
      fields: translatedFields
    }
    
    console.log('✅ Form translated:', result)
    return result
  }, [form, activeLanguage, defaultLanguage])

  useEffect(() => {
    const fetchForm = async () => {
      try {
        const baseUrl = process.env.NEXT_PUBLIC_GO_API_URL || 'http://localhost:8080/api/v1'
        
        // If subdomain is provided, use subdomain+slug lookup
        // Otherwise, try by slug (which handles both UUID and custom_slug)
        const endpoint = subdomain 
          ? `${baseUrl}/forms/by-subdomain/${subdomain}/${slug}`
          : `${baseUrl}/forms/by-slug/${slug}`
        
        const response = await fetch(endpoint, { cache: 'no-store' })
        if (response.ok) {
          const data = await response.json()
          setForm(data)
        }
      } catch (error) {
        console.error('Failed to fetch form:', error)
      } finally {
        setIsFormLoading(false)
      }
    }
    fetchForm()
  }, [slug, subdomain])

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form?.id) return
    
    setIsLoading(true)

    try {
      if (isLogin) {
        // Login with existing account
        const applicant = await portalAuthClient.login({
          form_id: form.view_id || form.id,
          email,
          password
        })

        // Fetch existing submission if available
        if (applicant.submission_data) {
          setInitialData(applicant.submission_data)
        } else {
          try {
            const baseUrl = process.env.NEXT_PUBLIC_GO_API_URL || 'http://localhost:8080/api/v1'
            const res = await fetch(`${baseUrl}/forms/${form.id}/submission?email=${encodeURIComponent(email)}`)
            if (res.ok) {
              const data = await res.json()
              setInitialData(data)
            }
          } catch (err) {
            console.error("Failed to fetch submission", err)
          }
        }

        setIsAuthenticated(true)
        toast.success('Logged in successfully')
      } else {
        // Sign up new account
        console.log('Form object:', { id: form.id, view_id: form.view_id })
        const formIdToUse = form.view_id || form.id
        console.log('Using form_id:', formIdToUse)
        
        const applicant = await portalAuthClient.signup({
          form_id: formIdToUse,
          email,
          password,
          full_name: signupData.name || '',
          data: signupData
        })

        setIsAuthenticated(true)
        toast.success('Account created successfully')
      }
    } catch (error: any) {
      console.error('Authentication error:', error)
      toast.error(error.message || 'Authentication failed')
    } finally {
      setIsLoading(false)
    }
  }

  const handleFormSubmit = async (formData: Record<string, any>) => {
    try {
      setSubmissionData(formData)
      
      // If we have a form ID, fetch the matching ending page
      if (form?.id) {
        try {
          const matching = await endingPagesClient.findMatching(form.id, formData)
          if (matching) {
            setEndingPage(matching)
          }
        } catch (error) {
          console.warn('Failed to fetch ending page:', error)
          // Continue anyway - will show default success message
        }
      }
      
      setIsSubmitted(true)
    } catch (error) {
      console.error('Form submission error:', error)
      toast.error('Failed to submit form')
    }
  }

  if (isSubmitted) {
    // Show custom ending page if available
    if (endingPage) {
      return (
        <div className="min-h-screen bg-white">
          <EndingPageRenderer config={endingPage} submissionData={submissionData || {}} />
        </div>
      )
    }

    // Fall back to default success message
    return (
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }} 
        animate={{ opacity: 1, scale: 1 }} 
        className="min-h-screen bg-white flex flex-col items-center justify-center p-4 text-center"
      >
        <div className="w-20 h-20 bg-green-100 text-green-600 rounded-full flex items-center justify-center mb-6">
          <CheckCircle2 className="w-10 h-10" />
        </div>
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Application Submitted!</h1>
        <p className="text-gray-500 max-w-md mb-8">
          Thank you for applying. We have received your application and will review it shortly. You will receive a confirmation email at {email}.
        </p>
        <Button onClick={() => window.location.reload()}>
          Return to Home
        </Button>
      </motion.div>
    )
  }

  if (isAuthenticated) {
    // Convert Form to PortalConfig format expected by DynamicApplicationForm
    // Map fields from the flat array to their respective sections
    const flatFields = translatedForm?.fields || []
    const rawSections = translatedForm?.settings?.sections || []

    // Build a lookup of fields by section_id
    const fieldsBySection: Record<string, any[]> = {}
    flatFields.forEach((field: any) => {
      const sid = field.section_id
      if (sid) {
        if (!fieldsBySection[sid]) fieldsBySection[sid] = []
        fieldsBySection[sid].push(field)
      }
    })

    // Attach fields to sections based on section id
    let sections = rawSections.map((section: any) => {
      const sectionFields = fieldsBySection[section.id] || []
      return {
        ...section,
        sectionType: section.sectionType || 'form',
        fields: sectionFields
      }
    })

    // Handle fields without section_id (unassigned) - put in first section
    const assignedFieldIds = new Set(flatFields.filter((f: any) => f.section_id).map((f: any) => f.id))
    const unassignedFields = flatFields.filter((f: any) => !f.section_id)
    
    if (unassignedFields.length > 0) {
      if (sections.length === 0) {
        sections = [{ id: 'default', title: 'Form', sectionType: 'form', fields: unassignedFields }]
      } else {
        sections[0] = { ...sections[0], fields: [...(sections[0].fields || []), ...unassignedFields] }
      }
    }

    // Ensure we have at least one section
    if (sections.length === 0) {
      sections = [{ id: 'default', title: translatedForm?.name || 'Form', sectionType: 'form', fields: flatFields }]
    }

    const portalConfig: any = {
      sections,
      settings: translatedForm?.settings || {},
      translations: (translatedForm?.settings as any)?.translations || {}
    }

    console.log('🚀 Portal config being passed to DynamicApplicationForm:', {
      sectionsCount: sections.length,
      firstSectionFields: sections[0]?.fields?.length,
      sections: sections.map((s: any) => ({
        id: s.id,
        title: s.title,
        fieldCount: s.fields?.length,
        fields: s.fields?.map((f: any) => ({ id: f.id, label: f.label, type: f.type, section_id: f.section_id }))
      })),
      totalFlatFields: flatFields.length,
      unassignedFieldsCount: unassignedFields.length,
    })
    
    // Debug: Log field breakdown
    console.log('📊 Field breakdown:')
    sections.forEach((s: any, idx: number) => {
      console.log(`  Section ${idx} (${s.id}): ${s.title} - ${s.fields?.length || 0} fields`)
      if (s.fields && s.fields.length > 0) {
        s.fields.forEach((f: any) => {
          console.log(`    - ${f.label} (section_id: ${f.section_id || 'unassigned'})`)
        })
      }
    })

    return (
      <motion.div 
        initial={{ opacity: 0 }} 
        animate={{ opacity: 1 }} 
        className="min-h-screen bg-white"
      >
        <DynamicApplicationForm 
          config={portalConfig}
          onSubmit={handleFormSubmit}
          isExternal={true}
          formId={form?.id}
        />
      </motion.div>
    )
  }

  return (
    <div className="min-h-screen bg-[#F7F7F5] flex flex-col items-center justify-center p-4 font-sans text-gray-900">
      {/* Language Selector - Top Right */}
      {form?.settings?.language?.enabled && supportedLanguages.length > 1 && (
        <StandaloneLanguageSelector
          activeLanguage={activeLanguage}
          supportedLanguages={supportedLanguages}
          onLanguageChange={setActiveLanguage}
          className="fixed top-4 right-4 z-50"
        />
      )}

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md"
      >
        {/* Notion-like Header */}
        <div className="mb-8 text-center space-y-4">
          <div className="w-16 h-16 bg-white rounded-xl shadow-sm border border-gray-200 mx-auto flex items-center justify-center text-3xl">
            🎓
          </div>
          {isFormLoading ? (
            <div className="h-10 bg-gray-200 rounded-lg w-3/4 mx-auto animate-pulse" />
          ) : (
            <h1 className="text-3xl font-bold tracking-tight text-gray-900">
              {translatedForm?.name || 'Application Portal'}
            </h1>
          )}
          {isFormLoading ? (
            <div className="h-6 bg-gray-200 rounded-lg w-1/2 mx-auto animate-pulse" />
          ) : (
            <p className="text-gray-500 text-lg">
              {translatedForm?.description || (isLogin ? 'Please log in to continue your application.' : 'Please sign up to continue your application.')}
            </p>
          )}
        </div>

        {/* Auth Card */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 space-y-6">
          <form onSubmit={handleAuth} className="space-y-4">
            {/* Render login fields (always email + password) */}
            {isLogin ? (
              <>
                <div className="space-y-2">
                  <Label htmlFor="email">Email Address</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <Input 
                      id="email" 
                      type="email" 
                      placeholder="you@example.com" 
                      className="pl-10 bg-gray-50/50 border-gray-200 focus:bg-white transition-colors"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <Input 
                      id="password" 
                      type="password" 
                      placeholder="••••••••" 
                      className="pl-10 bg-gray-50/50 border-gray-200 focus:bg-white transition-colors"
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      required
                    />
                  </div>
                </div>
              </>
            ) : (
              /* Render signup fields from portal config using unified field system */
              (translatedForm?.settings?.signupFields || []).map((field: Field) => {
                // Special handling for email field to capture it for auth
                const handleChange = (value: unknown) => {
                  setSignupData(prev => ({ ...prev, [field.id]: value }))
                  // Capture email and password for auth
                  if (field.type === 'email') {
                    setEmail(value as string)
                  }
                  if (field.type === 'text' && field.label.toLowerCase().includes('password')) {
                    setPassword(value as string)
                  }
                }

                return (
                  <div key={field.id}>
                    <PortalFieldAdapter
                      field={field}
                      value={signupData[field.id]}
                      onChange={handleChange}
                      formData={signupData}
                    />
                  </div>
                )
              })
            )}

            <Button 
              type="submit" 
              className="w-full h-10 text-base font-medium bg-gray-900 hover:bg-gray-800 text-white transition-all"
              disabled={isLoading || isFormLoading}
            >
              {isLoading ? (
                <motion.div 
                  animate={{ rotate: 360 }} 
                  transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
                  className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full"
                />
              ) : (
                <span className="flex items-center gap-2">
                  {isLogin ? 'Log In' : 'Create Account'} 
                  <ArrowRight className="w-4 h-4" />
                </span>
              )}
            </Button>
          </form>
        </div>

        <p className="text-center mt-6 text-sm text-gray-500">
          {isLogin ? "Don't have an account? " : "Already have an account? "}
          <button 
            onClick={() => setIsLogin(!isLogin)}
            className="font-medium text-gray-900 hover:underline underline-offset-4"
          >
            {isLogin ? 'Sign up' : 'Log in'}
          </button>
        </p>
      </motion.div>
      
      <div className="mt-12 flex items-center gap-2 text-sm text-gray-400">
        <Sparkles className="w-4 h-4" />
        <span>Powered by Matic Platform</span>
      </div>
    </div>
  )
}
