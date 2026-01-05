'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowRight, Mail, Lock, Sparkles, CheckCircle2, LayoutDashboard, FileEdit } from 'lucide-react'
import { Button } from '@/ui-components/button'
import { Input } from '@/ui-components/input'
import { Textarea } from '@/ui-components/textarea'
import { Label } from '@/ui-components/label'
import { DynamicApplicationForm } from './DynamicApplicationForm'
import { ApplicantDashboard } from './ApplicantDashboard'
import { AuthPageRenderer } from '@/components/Portal/AuthPageRenderer'
import { Form } from '@/types/forms'
import { Field, PortalConfig } from '@/types/portal'
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
  const [hasExistingSubmission, setHasExistingSubmission] = useState(false)
  const [initialData, setInitialData] = useState<any>(null)
  const [submissionData, setSubmissionData] = useState<Record<string, any> | null>(null)
  const [applicationStatus, setApplicationStatus] = useState<string>('draft') // Default to draft until we know they've submitted
  const [endingPage, setEndingPage] = useState<EndingPageConfig | null>(null)
  const [applicationRowId, setApplicationRowId] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState<'dashboard' | 'form'>('form') // Track if viewing dashboard or filling form
  const [currentFormData, setCurrentFormData] = useState<Record<string, any>>({}) // Track current form data for dashboard save
  const [applicantId, setApplicantId] = useState<string | null>(null) // Store applicant ID for settings
  const [applicantName, setApplicantName] = useState<string>('') // Store applicant name for settings

  // Memoize the form initial data with submission ID to prevent infinite re-renders
  // This ensures the object reference stays stable unless initialData or applicationRowId actually changes
  const formInitialData = useMemo(() => {
    if (!initialData) return null
    if (applicationRowId) {
      return { ...initialData, _submission_id: applicationRowId }
    }
    return initialData
  }, [initialData, applicationRowId])

  // Memoize the form data change handler to prevent re-renders
  const handleFormDataChange = useCallback((data: Record<string, any>) => {
    setCurrentFormData(data)
  }, [])

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
    
    if (!form.settings?.language?.enabled || activeLanguage === defaultLanguage) {
      return form
    }
    
    // Get raw translations and normalize to new format (handles both legacy and new)
    const rawTranslations = (form.settings as any).translations || (form as any).translations || {}
    const normalizedTranslations = normalizeTranslations(rawTranslations)
    
    if (!normalizedTranslations[activeLanguage]) {
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
        ...form.settings, // Preserve all settings including images, logos, focal points, etc.
        // Override with translated content where applicable
        name: translatedConfig.settings.name || form.settings.name,
        description: translatedConfig.settings.description || form.settings.description,
        sections: translatedConfig.sections,
        signupFields: translatedConfig.settings.signupFields || form.settings.signupFields
      },
      // Use the manually translated fields
      fields: translatedFields
    }
    
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
      // Use view_id for portal authentication (portal_applicants references table_views)
      const formIdToUse = form.view_id || form.id
      
      if (isLogin) {
        // Login with existing account
        const applicant = await portalAuthClient.login({
          form_id: formIdToUse,
          email,
          password
        })

        // Store applicant info for settings
        setApplicantId(applicant.id)
        setApplicantName(applicant.name || '')

        // Use row_id and status from login response
        if (applicant.row_id) {
          setApplicationRowId(applicant.row_id)
        }
        // Always set status from login response (defaults to 'draft' on backend if no row)
        if (applicant.status) {
          setApplicationStatus(applicant.status)
        }

        // Fetch existing submission if available
        let existingData: any = null
        if (applicant.submission_data && Object.keys(applicant.submission_data).length > 0) {
          existingData = applicant.submission_data
        } else {
          try {
            const baseUrl = process.env.NEXT_PUBLIC_GO_API_URL || 'http://localhost:8080/api/v1'
            const res = await fetch(`${baseUrl}/forms/${form.id}/submission?email=${encodeURIComponent(email)}`)
            if (res.ok) {
              const rowData = await res.json()
              existingData = rowData.data || rowData
              // Fallback: store the row ID for activity feed if not from login
              if (rowData.id && !applicant.row_id) {
                setApplicationRowId(rowData.id)
              }
              // Fallback: extract status from metadata if not from login
              if (rowData.metadata?.status && !applicant.status) {
                setApplicationStatus(rowData.metadata.status)
              }
            }
          } catch (err) {
            console.error("Failed to fetch submission", err)
          }
        }

        // Check if user has already submitted (has meaningful data)
        if (existingData && Object.keys(existingData).length > 0) {
          setInitialData(existingData)
          setSubmissionData(existingData)
          setHasExistingSubmission(true)
          setViewMode('dashboard') // Show dashboard by default for returning users
        }

        setIsAuthenticated(true)
        toast.success('Logged in successfully')
      } else {
        // Sign up new account
        const applicant = await portalAuthClient.signup({
          form_id: formIdToUse,
          email,
          password,
          full_name: signupData.name || '',
          data: signupData
        })

        // Store applicant info for settings
        setApplicantId(applicant.id)
        setApplicantName(applicant.name || signupData.name || '')

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

  const handleFormSubmit = async (formData: Record<string, any>, options?: { saveAndExit?: boolean }) => {
    try {
      // Submit form to backend first
      if (!form?.id) {
        throw new Error('Form ID not found')
      }
      
      // Strip blob URLs before saving - they are temporary and won't work when loaded
      const cleanedFormData = stripBlobUrls(formData)
      
      // Call the backend API to save the submission
      // If saveAndExit is true, mark as draft (don't change status to submitted)
      const response = await fetch(`${process.env.NEXT_PUBLIC_GO_API_URL || 'http://localhost:8080/api/v1'}/forms/${form.id}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          data: cleanedFormData, 
          email,
          save_draft: options?.saveAndExit === true // Only mark as draft if saveAndExit
        })
      })
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        const errorMessage = errorData.error || errorData.message || `Submission failed (HTTP ${response.status})`
        throw new Error(errorMessage)
      }
      const savedRow = await response.json()
      
      // Store the submission ID for features like letters of recommendation
      if (savedRow.id) {
        setApplicationRowId(savedRow.id)
        // Also update initialData so the form has access to the submission ID
        setInitialData((prev: Record<string, any> | null) => ({ ...prev, _submission_id: savedRow.id }))
      }
      
      setSubmissionData(cleanedFormData)
      
      // If Save & Exit, skip ending page and go back to login
      if (options?.saveAndExit) {
        toast.success('Application saved successfully!')
        // Reset state to show login page - keep email for easy re-login
        setIsAuthenticated(false)
        setIsLogin(true)
        // Reset submission state so dashboard doesn't show stale data
        setHasExistingSubmission(false)
        setViewMode('form')
        setCurrentFormData({})
        return
      }
      
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
      
      toast.success('Application submitted successfully!')
      setIsSubmitted(true)
    } catch (error) {
      console.error('Form submission error:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to submit form')
    }
  }

  if (isSubmitted) {
    // Show custom ending page if available
    if (endingPage) {
      return (
        <div className="min-h-screen bg-white light">
          <EndingPageRenderer config={endingPage} submissionData={submissionData || {}} />
        </div>
      )
    }

    // Fall back to default success message
    return (
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }} 
        animate={{ opacity: 1, scale: 1 }} 
        className="min-h-screen bg-white light flex flex-col items-center justify-center p-4 text-center"
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
    // section_id can be either at top level or in config
    const fieldsBySection: Record<string, any[]> = {}
    
    // Build fields by section lookup
    flatFields.forEach((field: any) => {
      const sid = field.section_id || (field.config && field.config.section_id)
      if (sid) {
        if (!fieldsBySection[sid]) fieldsBySection[sid] = []
        fieldsBySection[sid].push(field)
      }
    })

    // Helper function to transform API field to portal field format
    // This mirrors what PortalEditor does when loading fields
    const transformFieldForPortal = (f: any) => {
      const config = f.config || {}
      const { section_id, is_required, items, ...restConfig } = config
      
      // Ensure label and description are strings (could be objects from translations)
      const safeLabel = typeof f.label === 'string' ? f.label : (f.label ? String(f.label) : f.id);
      const safeDescription = typeof f.description === 'string' ? f.description : 
                              (f.description ? String(f.description) : undefined);
      
      return {
        id: f.id,
        type: f.type,
        label: safeLabel,
        description: safeDescription,
        required: is_required ?? f.required,
        width: config.width || 'full',
        placeholder: config.placeholder,
        options: items || f.options,  // Map config.items to options (this is the key fix!)
        children: config.children,
        validation: f.validation,
        config: restConfig
      }
    }

    // Attach fields to sections based on section id, excluding ending sections
    let sections = rawSections
      .filter((section: any) => section.sectionType !== 'ending')
      .map((section: any) => {
        const sectionFields = (fieldsBySection[section.id] || []).map(transformFieldForPortal)
        return {
          ...section,
          sectionType: section.sectionType || 'form',
          fields: sectionFields
        }
      })

    // Handle fields without section_id (unassigned) - put in first section
    const assignedFieldIds = new Set(flatFields.filter((f: any) => f.section_id || (f.config && f.config.section_id)).map((f: any) => f.id))
    const unassignedFields = flatFields
      .filter((f: any) => !f.section_id && !(f.config && f.config.section_id))
      .map(transformFieldForPortal)
    
    if (unassignedFields.length > 0) {
      if (sections.length === 0) {
        sections = [{ id: 'default', title: 'Form', sectionType: 'form', fields: unassignedFields }]
      } else {
        sections[0] = { ...sections[0], fields: [...(sections[0].fields || []), ...unassignedFields] }
      }
    }

    // Ensure we have at least one section
    if (sections.length === 0) {
      sections = [{ id: 'default', title: translatedForm?.name || 'Form', sectionType: 'form', fields: flatFields.map(transformFieldForPortal) }]
    }

    // Add review section at the end
    sections.push({
      id: 'review',
      title: 'Review & Submit',
      description: 'Please review your information before submitting',
      sectionType: 'review',
      fields: []
    })

    const portalConfig: any = {
      sections,
      settings: translatedForm?.settings || {},
      translations: (translatedForm?.settings as any)?.translations || {}
    }

    // Logout handler shared by dashboard and form views
    const handleLogout = () => {
      setIsAuthenticated(false)
      setHasExistingSubmission(false)
      setSubmissionData(null)
      setInitialData(null)
      setEmail('')
      setPassword('')
      setApplicationRowId(null)
      setViewMode('form')
      setCurrentFormData({})
    }

    // Handle save and go to dashboard (saves as draft, doesn't submit)
    const handleSaveAndDashboard = async () => {
      // Use current form data (from DynamicApplicationForm) or fall back to initialData
      const dataToSave = Object.keys(currentFormData).length > 0 ? currentFormData : initialData
      
      // Save current form data as draft (doesn't change status to submitted)
      if (form?.id && dataToSave && Object.keys(dataToSave).length > 0) {
        try {
          const response = await fetch(`${process.env.NEXT_PUBLIC_GO_API_URL || 'http://localhost:8080/api/v1'}/forms/${form.id}/submit`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ data: dataToSave, email, save_draft: true })
          })
          if (response.ok) {
            const savedRow = await response.json()
            // Store the submission ID for features like letters of recommendation
            if (savedRow.id) {
              setApplicationRowId(savedRow.id)
              setInitialData((prev: Record<string, any> | null) => ({ ...prev, _submission_id: savedRow.id }))
            }
          }
          toast.success('Progress saved!')
        } catch (error) {
          console.warn('Failed to save progress:', error)
        }
      }
      setViewMode('dashboard')
      setHasExistingSubmission(true)
      setSubmissionData(dataToSave || {})
    }

    // Show dashboard if user has existing submission AND viewMode is dashboard
    if (hasExistingSubmission && submissionData && viewMode === 'dashboard') {
      return (
        <ApplicantDashboard
          config={portalConfig}
          submissionData={submissionData}
          applicationStatus={applicationStatus}
          email={email}
          formId={form?.id || ''}
          rowId={applicationRowId || undefined}
          onLogout={handleLogout}
          onContinueApplication={() => setViewMode('form')}
          themeColor={(translatedForm?.settings as any)?.themeColor}
          applicantId={applicantId || undefined}
          applicantName={applicantName}
          onNameUpdate={(newName) => setApplicantName(newName)}
        />
      )
    }

    // Show form (either new application or continuing existing one)
    return (
      <motion.div 
        initial={{ opacity: 0 }} 
        animate={{ opacity: 1 }} 
        className="min-h-screen bg-white light"
      >
        <DynamicApplicationForm 
          config={portalConfig}
          onSubmit={handleFormSubmit}
          onFormDataChange={handleFormDataChange}
          isExternal={true}
          formId={form?.id}
          initialData={formInitialData}
          onDashboard={handleSaveAndDashboard}
          email={email}
        />
      </motion.div>
    )
  }

  return (
    <>
      {/* Language Selector - Top Right */}
      {form?.settings?.language?.enabled && supportedLanguages.length > 1 && (
        <StandaloneLanguageSelector
          activeLanguage={activeLanguage}
          supportedLanguages={supportedLanguages}
          onLanguageChange={setActiveLanguage}
          className="fixed top-4 right-4 z-50"
        />
      )}

      {translatedForm && (
        <AuthPageRenderer
          type={isLogin ? 'login' : 'signup'}
          config={translatedForm as any}
          email={email}
          password={password}
          signupData={signupData}
          onEmailChange={setEmail}
          onPasswordChange={setPassword}
          onSignupDataChange={setSignupData}
          onSubmit={handleAuth}
          isLoading={isLoading || isFormLoading}
          onToggleMode={() => setIsLogin(!isLogin)}
          isPreview={false}
        />
      )}
    </>
  )
}
