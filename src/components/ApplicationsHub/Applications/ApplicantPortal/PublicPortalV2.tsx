"use client"

import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowRight, Mail, Lock, LayoutDashboard, FileText, MessageSquare, CheckSquare, Home, LogOut, Settings, Bell, CheckCircle2, Menu, X, PanelLeftOpen, PanelLeftClose, Save } from 'lucide-react'
import { AccountSettingsModal } from '@/components/Dashboard/DashboardV2/AccountSettingsModal'
import { Button } from '@/ui-components/button'
import { UserMenu } from './UserMenu'
import { Input } from '@/ui-components/input'
import { Textarea } from '@/ui-components/textarea'
import { Label } from '@/ui-components/label'
import { ApplicantDashboard } from './ApplicantDashboard'
import { AuthPageRenderer } from '@/components/Portal/AuthPageRenderer'
import { Form } from '@/types/forms'
import { Field, PortalConfig, Section } from '@/types/portal'
import { cn } from '@/lib/utils'
import { applyTranslationsToConfig, applyTranslationsToField, normalizeTranslations } from '@/lib/portal-translations'
import { portalBetterAuthClient } from '@/auth/client/portal'
import { toast } from 'sonner'
import { TranslationProvider } from '@/lib/i18n/TranslationProvider'
import { StandaloneLanguageSelector } from '@/components/Portal/LanguageSelector'
import { portalDashboardClient, type PortalActivity } from '@/lib/api/portal-dashboard-client'
import { Loader2, Send, Clock } from 'lucide-react'
import { ScrollArea } from '@/ui-components/scroll-area'
import { Card, CardContent, CardHeader, CardTitle } from '@/ui-components/card'
import { Progress } from '@/ui-components/progress'

import { DynamicApplicationForm } from './DynamicApplicationForm'


/**
 * Loads portal documents and merges them with form data
 */
async function loadAndMergeDocuments(
  baseUrl: string,
  rowId: string,
  form: any,
  existingData: Record<string, any>
): Promise<Record<string, any>> {
  try {
    const docsRes = await fetch(`${baseUrl}/portal/documents?row_id=${rowId}`)
    if (!docsRes.ok) return existingData
    
    const documents = await docsRes.json()
    if (!documents || documents.length === 0) return existingData
    
    const mergedData = { ...existingData }
    const formFields = form?.fields || []
    
    // Create a set of existing file URLs to avoid duplicates
    const existingUrls = new Set<string>()
    formFields.forEach((field: any) => {
      const fieldType = field.field_type_id || field.type
      if (fieldType === 'file' || fieldType === 'image') {
        const fieldValue = mergedData[field.id]
        if (Array.isArray(fieldValue)) {
          fieldValue.forEach((f: any) => {
            if (f?.url) existingUrls.add(f.url)
          })
        } else if (fieldValue?.url) {
          existingUrls.add(fieldValue.url)
        }
      }
    })
    
    // Convert documents to file objects
    const documentFiles = documents
      .filter((doc: any) => doc.url && !existingUrls.has(doc.url))
      .map((doc: any) => ({
        name: doc.name,
        url: doc.url,
        size: doc.size,
        type: doc.mime_type || 'application/octet-stream',
      }))
    
    // If we have documents, add them to file/image fields
    if (documentFiles.length > 0) {
      formFields.forEach((field: any) => {
        const fieldType = field.field_type_id || field.type
        if (fieldType === 'file' || fieldType === 'image') {
          const existingFieldValue = mergedData[field.id]
          
          // If field is empty, populate it with documents
          if (!existingFieldValue || (Array.isArray(existingFieldValue) && existingFieldValue.length === 0)) {
            // For single file fields, use first document; for multiple, use all
            const config = field.config || {}
            if (config.multiple) {
              mergedData[field.id] = documentFiles
            } else if (documentFiles.length > 0) {
              mergedData[field.id] = documentFiles[0]
            }
          } else if (Array.isArray(existingFieldValue)) {
            // Merge documents that aren't already in the field
            const fieldUrls = new Set(existingFieldValue.map((f: any) => f.url))
            const newDocs = documentFiles.filter((doc: any) => !fieldUrls.has(doc.url))
            if (newDocs.length > 0) {
              mergedData[field.id] = [...existingFieldValue, ...newDocs]
            }
          }
        }
      })
    }
    
    return mergedData
  } catch (error) {
    console.warn('Failed to load and merge documents:', error)
    return existingData
  }
}

/**
 * Recursively strips blob URLs from form data before saving.
 * Preserves file objects with proper URLs (HTTP/HTTPS) but removes blob URLs.
 */
function stripBlobUrls(data: any): any {
  if (data === null || data === undefined) return data
  
  if (Array.isArray(data)) {
    return data.map(item => stripBlobUrls(item))
  }
  
  if (typeof data === 'object') {
    // Check if this is a file object with a URL
    // File objects from FileRenderer have: { id, name, url, size, type, uploaded_at, ... }
    if (data.url && typeof data.url === 'string') {
      // If it's a blob URL, skip this object entirely
      if (data.url.startsWith('blob:')) {
        return undefined
      }
      // If it's a proper URL (HTTP/HTTPS), preserve the entire file object
      if (data.url.startsWith('http://') || data.url.startsWith('https://')) {
        return data
      }
    }
    
    // For other objects, recursively clean
    const cleaned: Record<string, any> = {}
    for (const [key, value] of Object.entries(data)) {
      // Skip preview property entirely (it contains blob URLs)
      if (key === 'preview') continue
      
      // Skip blob URL strings
      if (typeof value === 'string' && value.startsWith('blob:')) {
        continue
      }
      
      cleaned[key] = stripBlobUrls(value)
    }
    return cleaned
  }
  
  // For primitive values that are blob URLs, return undefined
  if (typeof data === 'string' && data.startsWith('blob:')) {
    return undefined
  }
  
  return data
}

interface PublicPortalV2Props {
  slug: string
  subdomain?: string
}

type PortalView = 'dashboard' | 'application'

// Helper function to get the correct API URL (matches go-client.ts logic)
// Always prioritizes localhost detection in browser, ignoring env var when on localhost
const getApiUrl = () => {
  // In browser, ALWAYS check localhost first and ignore env var if on localhost
  if (typeof window !== 'undefined') {
    const hostname = window.location.hostname
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      // Force local backend when running on localhost, regardless of env var
      return 'http://localhost:8080/api/v1'
    }
    // Not on localhost, check env var
    if (process.env.NEXT_PUBLIC_GO_API_URL) {
      return process.env.NEXT_PUBLIC_GO_API_URL
    }
    // Not on localhost and no env var, use production
    return 'https://api.maticsapp.com/api/v1'
  }
  // Server-side rendering - check env var
  if (process.env.NEXT_PUBLIC_GO_API_URL) {
    return process.env.NEXT_PUBLIC_GO_API_URL
  }
  // Server-side fallback
  return 'https://api.maticsapp.com/api/v1'
}

export function PublicPortalV2({ slug, subdomain }: PublicPortalV2Props) {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
    // Saving state for UI
    const [isSaving, setIsSaving] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [signupData, setSignupData] = useState<Record<string, any>>({})
  const [isLogin, setIsLogin] = useState(true)
  const [isLoading, setIsLoading] = useState(false)
  const [isMagicLinkLoading, setIsMagicLinkLoading] = useState(false)
  const [isFormLoading, setIsFormLoading] = useState(true)
  const [form, setForm] = useState<Form | null>(null)
  const [isSubmitted, setIsSubmitted] = useState(false)
  const [hasExistingSubmission, setHasExistingSubmission] = useState(false)
  const [initialData, setInitialData] = useState<any>(null)
  const [submissionData, setSubmissionData] = useState<Record<string, any> | null>(null)
  const [applicationStatus, setApplicationStatus] = useState<string>('draft')
  const [applicationRowId, setApplicationRowId] = useState<string | null>(null)
  const [currentView, setCurrentView] = useState<PortalView>('dashboard')
  const [currentFormData, setCurrentFormData] = useState<Record<string, any>>({})
  const [applicantId, setApplicantId] = useState<string | null>(null)
  const [applicantName, setApplicantName] = useState<string>('')
  const [activeSectionId, setActiveSectionId] = useState<string>('')
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [navSidebarOpen, setNavSidebarOpen] = useState(true) // State for main navigation sidebar
  const [applicationProgress, setApplicationProgress] = useState<number>(0) // Progress for application view
  const [isSettingsOpen, setIsSettingsOpen] = useState(false) // Settings modal state
  
  // Ref to prevent duplicate form loads (React 18 Strict Mode)
  const formLoadRef = useRef<string | null>(null)
  const formLoadAbortControllerRef = useRef<AbortController | null>(null)

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
    
    const rawTranslations = (form.settings as any).translations || (form as any).translations || {}
    const normalizedTranslations = normalizeTranslations(rawTranslations)
    
    if (!normalizedTranslations[activeLanguage]) {
      return form
    }

    const rawSections = (form.settings as any).sections || []
    const translatedConfig = applyTranslationsToConfig(
      { sections: rawSections, settings: form.settings, translations: normalizedTranslations },
      activeLanguage
    )

    const langResource = normalizedTranslations[activeLanguage]

    return {
      ...form,
      name: translatedConfig.settings.name || form.name,
      description: translatedConfig.settings.description || form.description,
      settings: {
        ...form.settings,
        name: translatedConfig.settings.name || form.settings.name,
        description: translatedConfig.settings.description || form.settings.description,
        sections: translatedConfig.sections,
        signupFields: translatedConfig.settings.signupFields || form.settings.signupFields
      }
    }
  }, [form, activeLanguage, defaultLanguage])


  // Handle form data changes — state + localStorage only.
  // Handle form data changes and create initial draft submission if needed
  const handleFormDataChange = useCallback(async (data: Record<string, any>) => {
    setCurrentFormData(data)
    
    // Also update submissionData so dashboard shows current data
    setSubmissionData(data)
    
    // Create initial draft submission if none exists and user has started filling form
    if (form?.id && email && !applicationRowId && Object.keys(data).length > 0) {
      try {
        const session = await portalBetterAuthClient.getSession()
        const sessionToken = session?.data?.session?.token
        
        if (sessionToken) {
          const baseUrl = getApiUrl()
          const response = await fetch(`${baseUrl}/portal/forms/${form.id}/my-submission`, {
            method: 'POST',
            headers: { 
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${sessionToken}`
            },
            body: JSON.stringify({ 
              data: {},  // Empty initial data
              save_draft: true
            })
          })
          
          if (response.ok) {
            const savedSubmission = await response.json()
            if (savedSubmission.id) {
              console.log('[PublicPortalV2] Initial draft submission created:', savedSubmission.id)
              setApplicationRowId(savedSubmission.id)
            }
          }
        }
      } catch (err) {
        console.warn('Failed to create initial draft submission:', err)
      }
    }
    
    // Save to localStorage as backup
    if (form?.id && email) {
      try {
        const storageKey = `portal-form-data-${form.id}-${email}`
        localStorage.setItem(storageKey, JSON.stringify(data))
      } catch (err) {
        console.warn('Failed to save form data to localStorage:', err)
      }
    }
  }, [form, email, applicationRowId])

  // Load form configuration and restore session
  useEffect(() => {
    const loadForm = async () => {
      // Prevent duplicate loads (React 18 Strict Mode in dev)
      const loadKey = `${slug}-${subdomain || ''}`
      if (formLoadRef.current === loadKey) {
        console.log('[PublicPortalV2] Form already loading, skipping duplicate request')
        return
      }
      
      // Cancel any previous request
      if (formLoadAbortControllerRef.current) {
        formLoadAbortControllerRef.current.abort()
      }
      
      // Create new abort controller for this request
      const abortController = new AbortController()
      formLoadAbortControllerRef.current = abortController
      formLoadRef.current = loadKey
      
      try {
        setIsFormLoading(true)
        const baseUrl = getApiUrl()
        console.log('[PublicPortalV2] Using API URL:', baseUrl, 'from hostname:', typeof window !== 'undefined' ? window.location.hostname : 'server')
        
        // If subdomain is provided, use subdomain+slug lookup
        // Otherwise, try by slug (which handles both UUID and custom_slug)
        const endpoint = subdomain 
          ? `${baseUrl}/forms/by-subdomain/${subdomain}/${slug}`
          : `${baseUrl}/forms/by-slug/${slug}`
        
        console.log('[PublicPortalV2] Fetching form from:', endpoint)
        // Allow browser caching for faster subsequent loads
        const formResponse = await fetch(endpoint, { 
          cache: 'default', // Use browser's default caching
          signal: abortController.signal
        })
        
        if (!formResponse.ok) {
          throw new Error('Form not found')
        }
        
        const formData = await formResponse.json()
        console.log('[PublicPortalV2] Raw form data from API:', {
          formData,
          hasSettings: !!formData.settings,
          settingsKeys: formData.settings ? Object.keys(formData.settings) : null,
          settingsSections: formData.settings?.sections,
          sectionsType: typeof formData.settings?.sections,
          sectionsLength: Array.isArray(formData.settings?.sections) ? formData.settings.sections.length : 'not an array'
        })
        
        // Check if request was aborted
        if (abortController.signal.aborted) {
          return
        }
        
        setForm(formData)
        // Show form immediately - don't wait for session restoration
        setIsFormLoading(false)
        
        // Restore session in background (non-blocking)
        // This allows the form to show immediately while session restoration happens
        const restoreSession = async () => {
          try {
            const authKey = `portal-auth-${formData.id}`
            const savedAuth = localStorage.getItem(authKey)
            if (savedAuth) {
              const authData = JSON.parse(savedAuth)
              // Check if session is not too old (e.g., 7 days)
              const maxAge = 7 * 24 * 60 * 60 * 1000 // 7 days
              if (Date.now() - authData.timestamp < maxAge) {
                // Restore authentication state immediately from localStorage
                setEmail(authData.email)
                setApplicantId(authData.applicantId)
                setApplicantName(authData.applicantName || '')
                if (authData.applicationRowId) {
                  setApplicationRowId(authData.applicationRowId)
                }
                if (authData.applicationStatus) {
                  setApplicationStatus(authData.applicationStatus)
                }
                
                // Try to restore from localStorage backup first (instant)
                const formDataKey = `portal-form-data-${formData.id}-${authData.email}`
                const savedFormData = localStorage.getItem(formDataKey)
                if (savedFormData) {
                  try {
                    const parsed = JSON.parse(savedFormData)
                    setCurrentFormData(parsed)
                    setInitialData(parsed)
                  } catch (err) {
                    console.warn('Failed to parse saved form data:', err)
                  }
                }
                
                setIsAuthenticated(true)
                setCurrentView('dashboard')
                
                // Fetch latest submission data using Better Auth user ID
                // This ensures we get the same data shown in the CRM
                try {
                  // Get Better Auth session to query by user ID
                  const session = await portalBetterAuthClient.getSession()
                  if (!session?.data?.user?.id) {
                    console.warn('[PublicPortalV2] No Better Auth session found, skipping submission fetch')
                  } else {
                    const baseUrl = getApiUrl()
                    const sessionToken = session.data.session?.token
                    
                    console.log('[PublicPortalV2] Fetching my submission from portal API')
                    
                    // Use dedicated portal endpoint that fetches user's own submission
                    const res = await fetch(
                      `${baseUrl}/portal/forms/${formData.id}/my-submission`,
                      {
                        headers: {
                          'Authorization': `Bearer ${sessionToken}`
                        }
                      }
                    )
                    
                    if (res.ok) {
                      const submission = await res.json()
                      console.log('[PublicPortalV2] My submission response:', { 
                        hasId: !!submission.id, 
                        hasData: !!submission.data,
                        dataKeys: submission.data ? Object.keys(submission.data) : []
                      })
                      
                      if (submission.id && submission.data) {
                        const existingData = submission.data || {}
                        const rowId = submission.id
                        const metadata = submission.metadata || {}
                      
                        console.log('[PublicPortalV2] Loaded submission data:', {
                          hasData: !!existingData,
                          dataKeys: Object.keys(existingData),
                          rowId,
                          metadata,
                          sampleData: Object.keys(existingData).slice(0, 3).reduce((acc, key) => {
                            acc[key] = existingData[key]
                            return acc
                          }, {} as any)
                        })
                        
                        if (existingData && Object.keys(existingData).length > 0) {
                          setInitialData(existingData)
                          setSubmissionData(existingData)
                          setHasExistingSubmission(true)
                          setCurrentFormData(existingData)
                        }
                        
                        if (rowId) {
                          setApplicationRowId(rowId)
                        }
                        
                        if (metadata.status) {
                          setApplicationStatus(metadata.status)
                        }
                      } else {
                        console.log('[PublicPortalV2] No existing submission found for this user')
                      }
                    } else {
                      console.warn('[PublicPortalV2] Failed to fetch submission:', res.status)
                    }
                  }
                } catch (err) {
                  console.warn('Failed to fetch submission data:', err)
                  // Already restored from localStorage, so this is fine
                }
              } else {
                // Session expired, clear it
                localStorage.removeItem(authKey)
              }
            }
          } catch (err) {
            console.warn('Failed to restore session:', err)
          }
        }
        
        // Run session restoration in background (non-blocking)
        restoreSession()
        
        // Check for Better Auth session and magic link verification
        const checkBetterAuthSession = async () => {
          try {
            // Check if we're returning from magic link verification
            const urlParams = new URLSearchParams(window.location.search)
            const verified = urlParams.get('verified')
            const formIdParam = urlParams.get('formId')
            
            if (verified === 'true' && formIdParam === formData.id) {
              // Verify magic link was successful (using portal-specific auth client)
              const session = await portalBetterAuthClient.getSession()
              if (session?.data?.session && session?.data?.user?.id) {
                setEmail(email)
                const betterAuthUserId = session.data.user.id
                
                // Fetch existing submission data using portal API
                try {
                  const baseUrl = getApiUrl()
                  const sessionToken = session.data.session?.token
                  const dataRes = await fetch(
                    `${baseUrl}/portal/forms/${formData.id}/my-submission`,
                    {
                      headers: {
                        'Authorization': `Bearer ${sessionToken}`
                      }
                    }
                  )
                  if (dataRes.ok) {
                    const submission = await dataRes.json()
                    if (submission.id && submission.data) {
                      const existingData = submission.data || {}
                      const rowId = submission.id
                      
                      if (existingData && Object.keys(existingData).length > 0) {
                        setInitialData(existingData)
                        setSubmissionData(existingData)
                        setHasExistingSubmission(true)
                        setCurrentFormData(existingData)
                        setApplicationRowId(rowId)
                        if (submission.metadata?.status) {
                          setApplicationStatus(submission.metadata.status)
                        }
                        setIsAuthenticated(true)
                        setCurrentView('dashboard')
                      }
                    }
                  }
                  
                  setIsAuthenticated(true)
                  setCurrentView('dashboard')
                  toast.success('Signed in successfully!')
                  
                  // Clean up URL params
                  window.history.replaceState({}, '', window.location.pathname)
                } catch (syncError) {
                  console.warn('Failed to fetch submission on magic link:', syncError)
                }
              }
            } else {
              // Check for existing Better Auth session (portal-specific)
              const session = await portalBetterAuthClient.getSession()
              if (session?.data?.session && session?.data?.user?.id) {
                const betterAuthUserId = session.data.user.id
                const userEmail = session.data.user.email
                
                // Query by Better Auth user ID
                try {
                  const baseUrl = getApiUrl()
                  const sessionToken = session.data.session?.token
                  const res = await fetch(`${baseUrl}/portal/forms/${formData.id}/my-submission`, {
                    headers: {
                      'Authorization': `Bearer ${sessionToken}`
                    }
                  })
                  if (res.ok) {
                    const submission = await res.json()
                    if (submission.id && submission.data) {
                      // User has a submission, restore session
                      setEmail(userEmail)
                      setApplicantName(session.data.user.name || userEmail.split('@')[0])
                      const existingData = submission.data || {}
                      if (existingData && Object.keys(existingData).length > 0) {
                        setInitialData(existingData)
                        setSubmissionData(existingData)
                        setHasExistingSubmission(true)
                        setCurrentFormData(existingData)
                        setApplicationRowId(submission.id)
                        if (submission.metadata?.status) {
                          setApplicationStatus(submission.metadata.status)
                        }
                        setIsAuthenticated(true)
                        setCurrentView('dashboard')
                      }
                    }
                  }
                } catch (err) {
                  console.warn('Failed to check Better Auth session:', err)
                }
              }
            }
          } catch (err) {
            console.warn('Failed to check Better Auth session:', err)
          }
        }
        
        // Check Better Auth session after form loads
        checkBetterAuthSession()
      } catch (error: any) {
        // Ignore abort errors
        if (error.name === 'AbortError') {
          console.log('[PublicPortalV2] Form load aborted')
          return
        }
        console.error('Failed to load form:', error)
        toast.error('Failed to load application form')
        setIsFormLoading(false)
      } finally {
        // Clear the load ref after completion (success or error)
        if (formLoadRef.current === loadKey) {
          formLoadRef.current = null
        }
      }
    }

    if (slug) {
      loadForm()
    }
    
    // Cleanup: abort request if component unmounts or dependencies change
    return () => {
      if (formLoadAbortControllerRef.current) {
        formLoadAbortControllerRef.current.abort()
        formLoadAbortControllerRef.current = null
      }
      formLoadRef.current = null
    }
  }, [slug, subdomain])

  // Handle magic link authentication (works for both login and signup)
  const handleMagicLink = async (emailAddress: string) => {
    if (!form?.id) {
      toast.error('Form not loaded')
      return
    }

    setIsMagicLinkLoading(true)
    try {
      // Magic link works for both signup and login - Better Auth handles it automatically
      // Using portal-specific auth client to avoid conflicts with main app sessions
      const result = await (portalBetterAuthClient.signIn as any).magicLink({
        email: emailAddress,
        callbackURL: `${window.location.origin}/apply/${slug}?verified=true&formId=${form.id}`,
      })

      if (result.error) {
        throw new Error(result.error.message || 'Failed to send magic link')
      }

      toast.success('Magic link sent! Check your email to sign in.')
    } catch (error: any) {
      console.error('Magic link error:', error)
      toast.error(error.message || 'Failed to send magic link')
    } finally {
      setIsMagicLinkLoading(false)
    }
  }

  // Handle authentication with Better Auth
  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form?.id) {
      toast.error('Form not loaded')
      return
    }

    setIsLoading(true)
    try {
      const formIdToUse = form.id
      console.log('[PublicPortalV2] Attempting Better Auth authentication:', {
        isLogin,
        formId: formIdToUse,
        email,
        hasPassword: !!password
      })

      if (isLogin) {
        // Use Better Auth for authentication (cookie-based session)
        console.log('[PublicPortalV2] Calling Better Auth sign-in...')
        const betterAuthResult = await portalBetterAuthClient.signIn.email({
          email,
          password,
        })

        console.log('[PublicPortalV2] Better Auth result:', {
          hasError: !!betterAuthResult.error,
          hasData: !!betterAuthResult.data,
          hasUser: !!betterAuthResult.data?.user,
        })

        if (betterAuthResult.error || !betterAuthResult.data?.user) {
          console.error('[PublicPortalV2] Better Auth login failed:', betterAuthResult.error)
          throw new Error(betterAuthResult.error?.message || 'Invalid email or password')
        }

        const betterAuthUser = betterAuthResult.data.user
        console.log('[PublicPortalV2] Better Auth login successful:', {
          userId: betterAuthUser.id,
          email: betterAuthUser.email,
          name: betterAuthUser.name
        })

        // Set authentication state
        setIsAuthenticated(true)
        setApplicantName(betterAuthUser.name || betterAuthUser.email)

        // Load existing submission data using portal API
        const baseUrl = getApiUrl()
        console.log('[PublicPortalV2] Starting submission fetch, baseUrl:', baseUrl)
        try {
          // Get session token from the login result
          console.log('[PublicPortalV2] Getting session token...')
          const session = await portalBetterAuthClient.getSession()
          console.log('[PublicPortalV2] Session retrieved:', {
            hasSession: !!session,
            hasData: !!session?.data,
            hasSessionData: !!session?.data?.session,
            hasToken: !!session?.data?.session?.token
          })
          const sessionToken = session?.data?.session?.token
          
          if (!sessionToken) {
            console.warn('[PublicPortalV2] No session token found, skipping submission fetch')
            setCurrentView('application')
            toast.success('Logged in successfully')
            setIsLoading(false)
            return
          }
          
          console.log('[PublicPortalV2] Fetching submission from:', `${baseUrl}/portal/forms/${form.id}/my-submission`)
          const dataRes = await fetch(
            `${baseUrl}/portal/forms/${form.id}/my-submission`,
            {
              headers: {
                'Authorization': `Bearer ${sessionToken}`
              }
            }
          )
          
          console.log('[PublicPortalV2] Submission fetch response:', {
            status: dataRes.status,
            ok: dataRes.ok
          })
          
          if (dataRes.ok) {
            const submission = await dataRes.json()
            console.log('[PublicPortalV2] Parsed submission:', {
              hasId: !!submission.id,
              hasData: !!submission.data,
              dataKeys: submission.data ? Object.keys(submission.data) : []
            })
            
            if (submission.id && submission.data) {
              const existingData = submission.data || {}
              const rowId = submission.id
              
              console.log('[PublicPortalV2] Loaded submission:', { rowId, hasData: Object.keys(existingData).length > 0 })
              
              if (rowId) {
                setApplicationRowId(rowId)
              }
              
              if (existingData && Object.keys(existingData).length > 0) {
                // User has existing data - load it into the form
                setInitialData(existingData)
                setSubmissionData(existingData)
                setCurrentFormData(existingData)
                setHasExistingSubmission(true)
                console.log('[PublicPortalV2] Loaded existing data with', Object.keys(existingData).length, 'fields')
              } else {
                // No data yet - initialize empty
                setInitialData({})
              }
              
              // Always show application form after login
              setCurrentView('application')
            } else {
              // No submission yet, show application form
              console.log('[PublicPortalV2] No submission found, showing application form')
              setInitialData({}) // Initialize empty data for new applications
              setCurrentView('application')
            }
            
            if (submissionData && submissionData.status) {
              setApplicationStatus(submissionData.status)
            }
          } else {
            // Request failed but not critical
            console.warn('[PublicPortalV2] Submission fetch failed with status:', dataRes.status)
            // Still show application form
            setInitialData({}) // Initialize empty data for new applications
            setCurrentView('application')
          }
        } catch (err) {
          // Non-critical - user can still access the form
          console.warn('[PublicPortalV2] Could not fetch submission:', err)
          // Still show application form
          setInitialData({}) // Initialize empty data for new applications
          setCurrentView('application')
        }

        toast.success('Logged in successfully')
        setIsLoading(false)
      } else {
        // Signup: Use Better Auth SDK directly (Approach 1)
        const fullName: string = signupData.full_name || signupData.name || ''
        const displayName = fullName.trim() || email

        console.log('[PublicPortalV2] Signing up with Better Auth SDK:', {
          email,
          name: displayName,
          formId: formIdToUse
        })

        // Step 1: Create user with Better Auth SDK
        const signupResult = await portalBetterAuthClient.signUp.email({
          email,
          password,
          name: displayName,
        })

        if (signupResult.error) {
          // Check if user already exists
          if (signupResult.error.message?.toLowerCase().includes('already exists') ||
              signupResult.error.message?.toLowerCase().includes('user exists') ||
              signupResult.error.message?.toLowerCase().includes('email is taken')) {
            toast.error('An account with this email already exists. Please login instead.')
            setIsLogin(true) // Switch to login mode
            setIsLoading(false)
            return
          }
          throw new Error(signupResult.error.message || 'Signup failed')
        }

        if (!signupResult.data?.user) {
          throw new Error('Signup failed - no user returned')
        }

        const betterAuthUser = signupResult.data.user
        console.log('[PublicPortalV2] Better Auth signup successful:', {
          userId: betterAuthUser.id,
          email: betterAuthUser.email
        })

        // Try to load existing submission using portal API
        const baseUrl = getApiUrl()
        try {
          // Get session token after signup
          const session = await portalBetterAuthClient.getSession()
          const sessionToken = session?.data?.session?.token
          const dataRes = await fetch(
            `${baseUrl}/portal/forms/${formIdToUse}/my-submission`,
            {
              headers: {
                'Authorization': `Bearer ${sessionToken}`
              }
            }
          )
          
          if (dataRes.ok) {
            const submission = await dataRes.json()
            
            if (submission.id && submission.data) {
              const existingData = submission.data || {}
              const rowId = submission.id
              
              console.log('[PublicPortalV2] Found existing submission:', rowId)
              
              if (rowId) {
                setApplicationRowId(rowId)
              }
              
              if (existingData && Object.keys(existingData).length > 0) {
                setInitialData(existingData)
                setSubmissionData(existingData)
                setCurrentFormData(existingData)
                setHasExistingSubmission(true)
              }
            }
          }
        } catch (syncError) {
          console.warn('[PublicPortalV2] No existing submission found:', syncError)
          // This is fine for new signups
        }

        // Set authentication state
        setIsAuthenticated(true)
        setApplicantName(displayName || betterAuthUser.name || betterAuthUser.email)

        // Save to localStorage
        try {
          const authData = {
            email: betterAuthUser.email,
            formId: form.id,
            betterAuthUserId: betterAuthUser.id,
            applicantName: displayName,
            timestamp: Date.now()
          }
          localStorage.setItem(`portal-auth-${form.id}`, JSON.stringify(authData))
        } catch (err) {
          console.warn('Failed to save auth to localStorage:', err)
        }

        toast.success('Account created successfully')
      }
    } catch (error: any) {
      console.error('Authentication error:', error)
      toast.error(error.message || 'Authentication failed')
    } finally {
      setIsLoading(false)
    }
  }

  // Helper to wait for any pending file uploads
  const waitForPendingUploads = async (formData: Record<string, any>, maxWait = 5000): Promise<Record<string, any>> => {
    const startTime = Date.now()
    let data = { ...formData }
    
    // Check for blob URLs in the data
    const hasBlobUrls = (obj: any): boolean => {
      if (!obj || typeof obj !== 'object') return false
      if (Array.isArray(obj)) {
        return obj.some(item => hasBlobUrls(item))
      }
      for (const [key, value] of Object.entries(obj)) {
        if (key === 'preview') continue
        if (typeof value === 'string' && value.startsWith('blob:')) return true
        if (typeof value === 'object' && hasBlobUrls(value)) return true
      }
      return false
    }
    
    // Wait for blob URLs to be replaced with permanent URLs
    while (hasBlobUrls(data) && Date.now() - startTime < maxWait) {
      await new Promise(resolve => setTimeout(resolve, 100))
      // Re-check current form data (might have been updated by FileRenderer)
      data = { ...currentFormData, ...data }
    }
    
    return data
  }

  // Handle form submission
  const handleFormSubmit = async (formData: Record<string, any>, options?: { saveAndExit?: boolean }): Promise<void> => {
    try {
      if (!form?.id) {
        throw new Error('Form ID not found')
      }
      
      // Wait for any pending uploads before saving
      const dataWithUploads = await waitForPendingUploads(formData)
      const cleanedFormData = stripBlobUrls(dataWithUploads)
      const isDraft = options?.saveAndExit === true
      
      const baseUrl = getApiUrl()
      
      // Get Better Auth session token
      const session = await portalBetterAuthClient.getSession()
      const sessionToken = session?.data?.session?.token
      
      if (!sessionToken) {
        throw new Error('Not authenticated. Please sign in again.')
      }
      
      // Use the portal submission endpoint
      console.log('[PublicPortalV2] Submitting form data via portal API:', { isDraft, formId: form.id })
      
      const response = await fetch(`${baseUrl}/portal/forms/${form.id}/my-submission`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${sessionToken}`
        },
        body: JSON.stringify({ 
          data: cleanedFormData,
          save_draft: isDraft
        })
      })
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || errorData.message || `Submission failed (HTTP ${response.status})`)
      }
      
      const savedSubmission = await response.json()
      console.log('[PublicPortalV2] Submission saved:', { id: savedSubmission.id })
      
      // Update applicationRowId if we got an ID back
      if (savedSubmission.id && !applicationRowId) {
        setApplicationRowId(savedSubmission.id)
      }
      
      setSubmissionData(cleanedFormData)
      
      if (options?.saveAndExit) {
        // Verify save succeeded - must have an application row ID
        if (!applicationRowId) {
          console.error('[PublicPortalV2] Save returned but no submission ID - save may have failed')
          toast.error('Failed to save application. Please try again.')
          // Don't navigate away if save didn't return an ID
          throw new Error('Save failed: No submission ID returned')
        }
        
        // Save succeeded - show success and navigate
        console.log('[PublicPortalV2] Save and exit successful:', applicationRowId)
        toast.success('Application saved successfully!')
        setCurrentView('dashboard')
        // Don't clear currentFormData - keep it for when user returns
        return
      }
      
      toast.success('Application submitted successfully!')
      setIsSubmitted(true)
    } catch (error) {
      console.error('Form submission error:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to submit form')
    }
  }

  // Handle save and go to dashboard
  const handleSaveAndDashboard = async () => {
    try {
      console.log('[PublicPortalV2] Save and Exit clicked', { 
        hasFormData: Object.keys(currentFormData).length > 0,
        formId: form?.id,
        email,
        applicationRowId
      })
      
      // Call handleFormSubmit to save and navigate - it will show the success toast
      await handleFormSubmit(currentFormData, { saveAndExit: true })
      
      // handleFormSubmit will handle navigation on success
    } catch (error) {
      console.error('[PublicPortalV2] Save and exit failed:', error)
      toast.error('Failed to save application. Please try again.')
      // Don't navigate away if save failed
    }
  }

  // Handle logout
  const handleLogout = () => {
    // Clear localStorage
    if (form?.id) {
      try {
        localStorage.removeItem(`portal-auth-${form.id}`)
        if (email) {
          localStorage.removeItem(`portal-form-data-${form.id}-${email}`)
        }
      } catch (err) {
        console.warn('Failed to clear localStorage:', err)
      }
    }
    
    // Reset all state - portal auth is stateless, no server-side logout needed
    setIsAuthenticated(false)
    setIsLogin(true)
    setEmail('')
    setPassword('')
    setSignupData({})
    setCurrentView('dashboard')
    setHasExistingSubmission(false)
    setSubmissionData(null)
    setInitialData(null)
    setApplicationRowId(null)
    setApplicantId(null)
    setApplicantName('')
    setCurrentFormData({})
    toast.success('Logged out successfully')
  }

  // Handle continue application
  const handleContinueApplication = async () => {
    // If we're leaving another view, save any pending data first
    if (currentView !== 'application' && Object.keys(currentFormData).length > 0) {
      await saveBeforeNavigation()
    }
    
    // Update initialData with current form data when switching back to application
    if (currentFormData && Object.keys(currentFormData).length > 0) {
      setInitialData(currentFormData)
    } else if (submissionData && Object.keys(submissionData).length > 0) {
      setInitialData(submissionData)
    }
    
    setCurrentView('application')
    // Set first section as active - use portalConfig which has translated sections
    // Include cover, form, and review sections (exclude ending)
    if (portalConfig.sections && portalConfig.sections.length > 0) {
      const firstSection = portalConfig.sections.find((s: any) => 
        s.sectionType === 'form' || 
        s.sectionType === 'cover' || 
        s.sectionType === 'review'
      )
      if (firstSection) {
        setActiveSectionId(firstSection.id)
      } else if (portalConfig.sections[0]) {
        setActiveSectionId(portalConfig.sections[0].id)
      }
    }
  }

  // Save application data before navigation
  const saveBeforeNavigation = async (): Promise<void> => {
    // Only save if we're in application view and have form data
    if (currentView !== 'application' || Object.keys(currentFormData).length === 0) {
      return
    }

    // If we have a submission ID, save using handleFormSubmit
    if (applicationRowId && form?.id && email) {
      try {
        console.log('[PublicPortalV2] Saving before navigation')
        await handleFormSubmit(currentFormData, { saveAndExit: true })
        console.log('[PublicPortalV2] Save completed before navigation')
      } catch (error) {
        console.error('[PublicPortalV2] Save failed before navigation:', error)
        // Don't throw - allow navigation even if save fails
      }
    } else if (form?.id && email && Object.keys(currentFormData).length > 0) {
      // No submission ID yet - create one via form submit
      try {
        console.log('[PublicPortalV2] Saving before navigation via form submit (new submission)')
        await handleFormSubmit(currentFormData, { saveAndExit: true })
      } catch (error) {
        console.error('[PublicPortalV2] Failed to save before navigation:', error)
        // Don't throw - allow navigation even if save fails
      }
    }
  }

  // Handle navigation back to portal home
  const handleBackToPortal = async () => {
    // Save before navigating
    await saveBeforeNavigation()
    
    // Change view after save completes
    setCurrentView('dashboard')
    setActiveSectionId('')
  }

  // Build portal config from translated form
  const portalConfig: PortalConfig = useMemo(() => {
    console.log('[PublicPortalV2] Building portal config from translatedForm:', {
      translatedForm,
      hasTranslatedForm: !!translatedForm,
      settings: translatedForm?.settings,
      settingsType: typeof translatedForm?.settings,
      settingsSections: (translatedForm?.settings as any)?.sections
    })

    if (!translatedForm) {
      return {
        sections: [],
        settings: {
          name: '',
          themeColor: '#3B82F6',
          logoUrl: '',
          loginFields: [],
          signupFields: []
        }
      }
    }

    const rawSections = (translatedForm.settings as any)?.sections || []
    const fieldsBySection: Record<string, any[]> = {}
    
    console.log('[PublicPortalV2] rawSections:', rawSections.map((s: any) => ({
      id: s.id,
      title: s.title,
      hasFields: !!s.fields,
      fieldsCount: s.fields?.length || 0,
      fieldsType: typeof s.fields
    })))
    
    console.log('[PublicPortalV2] translatedForm.fields:', {
      hasFields: !!(translatedForm as any).fields,
      fieldsCount: (translatedForm as any).fields?.length || 0,
      fieldsType: typeof (translatedForm as any).fields
    })
    
    // Fields are embedded within sections now
    rawSections.forEach((section: any) => {
      if (section.fields) {
        fieldsBySection[section.id] = section.fields
      }
    })
    
    // Also check if fields are at form level and need to be assigned to sections
    const formLevelFields = (translatedForm as any).fields || []
    if (formLevelFields.length > 0 && Object.keys(fieldsBySection).length === 0) {
      console.log('[PublicPortalV2] Fields found at form level, assigning to sections based on section_id')
      formLevelFields.forEach((field: any) => {
        const sectionId = field.config?.section_id || field.section_id
        if (sectionId) {
          if (!fieldsBySection[sectionId]) {
            fieldsBySection[sectionId] = []
          }
          fieldsBySection[sectionId].push(field)
        }
      })
    }

    const transformFieldForPortal = (f: any) => {
      const config = f.config || {}
      const { section_id, is_required, items, ...restConfig } = config
      const safeLabel = typeof f.label === 'string' ? f.label : (f.label ? String(f.label) : f.id)
      const safeDescription = typeof f.description === 'string' ? f.description : 
                            (f.description ? String(f.description) : undefined)
      
      return {
        id: f.id,
        type: f.type,
        label: safeLabel,
        description: safeDescription,
        required: is_required ?? f.required,
        width: config.width || 'full',
        placeholder: config.placeholder,
        options: items || f.options,
        children: config.children,
        validation: f.validation,
        config: restConfig
      }
    }

    let sections = rawSections
      .filter((section: any) => section.sectionType !== 'ending')
      .map((section: any) => {
        const sectionFields = (fieldsBySection[section.id] || []).map(transformFieldForPortal)
        console.log('[PublicPortalV2] Section processing:', {
          sectionId: section.id,
          sectionName: section.title || section.name,
          sectionType: section.sectionType,
          rawFieldsCount: (fieldsBySection[section.id] || []).length,
          transformedFieldsCount: sectionFields.length,
          sampleField: sectionFields[0]
        })
        return {
          ...section,
          sectionType: section.sectionType || 'form',
          fields: sectionFields
        }
      })

    // Flatten all fields from all sections for checking unassigned fields
    const allSectionFields = rawSections.flatMap((s: any) => s.fields || [])
    
    // Ensure we have at least one section
    if (sections.length === 0) {
      sections = [{ id: 'default', title: translatedForm?.name || 'Form', sectionType: 'form', fields: [] }]
    }

    // Add review section at the end (if not already present)
    const hasReviewSection = sections.some((s: import('@/types/portal').Section) => s.sectionType === 'review')
    if (!hasReviewSection) {
      sections.push({
        id: 'review',
        title: 'Review & Submit',
        description: 'Please review your information before submitting',
        sectionType: 'review',
        fields: []
      })
    }

    const config = {
      sections,
      settings: {
        ...translatedForm.settings,
        name: translatedForm.name,
        themeColor: (translatedForm.settings as any)?.themeColor || '#3B82F6',
        logoUrl: (translatedForm.settings as any)?.logoUrl || '',
        loginFields: [],
        signupFields: []
      }
    }

    console.log('[PublicPortalV2] Portal config built:', {
      rawSections,
      fieldsBySection,
      sectionsCount: sections.length,
      totalFields: sections.reduce((acc: number, s: Section) => acc + s.fields.length, 0),
      config
    })

    return config
  }, [translatedForm])

  // Memoize the form initial data
  const formInitialData = useMemo(() => {
    console.log('[PublicPortalV2] Computing formInitialData:', {
      hasInitialData: !!initialData,
      initialDataKeys: initialData ? Object.keys(initialData) : [],
      applicationRowId
    })
    if (!initialData) return null
    // Map initialData to both field.id and field.config.sourceKey for each field
    let mappedData = { ...initialData }
    if (typeof portalConfig !== 'undefined' && Array.isArray(portalConfig.sections)) {
      portalConfig.sections.forEach(section => {
        if (Array.isArray(section.fields)) {
          section.fields.forEach(field => {
            const altKey = field.config?.sourceKey
            if (altKey && mappedData[field.id] !== undefined) {
              mappedData[altKey] = mappedData[field.id]
            }
            if (altKey && mappedData[altKey] !== undefined) {
              mappedData[field.id] = mappedData[altKey]
            }
          })
        }
      })
    }
    if (applicationRowId) {
      mappedData._submission_id = applicationRowId
    }
    return mappedData
  }, [initialData, applicationRowId, portalConfig])

  // Show loading state
  if (isFormLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  // Show success page if submitted
  if (isSubmitted) {
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
          Thank you for applying. We have received your application and will review it shortly.
        </p>
        <Button onClick={() => window.location.reload()}>
          Return to Home
        </Button>
      </motion.div>
    )
  }

  // Show login/signup if not authenticated
  if (!isAuthenticated) {
    return (
      <TranslationProvider>
        <div className="min-h-screen bg-white">
          {translatedForm && (
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
                onMagicLink={handleMagicLink}
                isLoading={isLoading || isFormLoading}
                isMagicLinkLoading={isMagicLinkLoading}
                onToggleMode={() => setIsLogin(!isLogin)}
                isPreview={false}
              />
            </>
          )}
        </div>
      </TranslationProvider>
    )
  }

  // Get theme settings
  const themeSettings = portalConfig.settings as any
  const accentColor = themeSettings?.themeColor || '#3B82F6'
  const sidebarBgColor = themeSettings?.sidebarBackgroundColor || '#101010'
  const sidebarTextColor = themeSettings?.sidebarTextColor || '#BCE7F4'
  const backgroundColor = themeSettings?.backgroundColor || '#FFFFFF'
  const textColor = themeSettings?.textColor || '#1F2937'
  const fontFamily = themeSettings?.font || 'inter'
  
  // Font family mapping
  const fontMap: Record<string, string> = {
    inter: 'Inter, sans-serif',
    roboto: 'Roboto, sans-serif',
    serif: 'Georgia, serif',
    mono: 'Monaco, monospace'
  }

  // Show authenticated portal with navigation
  return (
    <TranslationProvider>
      <div 
        className="h-screen flex overflow-hidden"
        style={{ 
          backgroundColor: backgroundColor,
          color: textColor,
          fontFamily: fontMap[fontFamily]
        }}
      >
        {/* Left Sidebar Navigation */}
        {navSidebarOpen && (
          <PortalNavSidebar
            currentView={currentView}
            onViewChange={async (view: PortalView) => {
              // If navigating away from application view, save data first
              if (currentView === 'application' && view !== 'application') {
                await saveBeforeNavigation()
              }
              
              // Change view after save completes
              setCurrentView(view)
            }}
            onBackToPortal={handleBackToPortal}
            showBackButton={true}
            formName={form?.name || 'Application'}
            themeColor={accentColor}
            sidebarBgColor={sidebarBgColor}
            sidebarTextColor={sidebarTextColor}
            applicantId={applicantId || undefined}
            applicantName={applicantName}
            email={email}
            onLogout={handleLogout}
            onOpenSettings={() => setIsSettingsOpen(true)}
          />
        )}

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
          {/* Top Header */}
          <PortalHeader
            form={form}
            portalConfig={portalConfig}
            applicantName={applicantName}
            onLogout={handleLogout}
            themeColor={accentColor}
            supportedLanguages={supportedLanguages}
            activeLanguage={activeLanguage}
            onLanguageChange={setActiveLanguage}
            onContinueApplication={handleContinueApplication}
            applicationStatus={applicationStatus}
            applicantId={applicantId || undefined}
            email={email}
            onNameUpdate={(newName) => setApplicantName(newName)}
            currentView={currentView}
            onToggleNavSidebar={() => setNavSidebarOpen(!navSidebarOpen)}
            navSidebarOpen={navSidebarOpen}
            onSaveAndExit={currentView === 'application' ? handleSaveAndDashboard : undefined}
            progress={currentView === 'application' ? applicationProgress : undefined}
            isSaving={isSaving}
            isSettingsOpen={isSettingsOpen}
            onSettingsOpenChange={setIsSettingsOpen}
          />

          {/* Content */}
          <div className="flex-1 overflow-auto">
            {currentView === 'dashboard' && (
              <ApplicantDashboard
                config={portalConfig}
                submissionData={submissionData || {}}
                applicationStatus={applicationStatus}
                email={email}
                formId={form?.id || ''}
                rowId={applicationRowId || undefined}
                onLogout={handleLogout}
                onContinueApplication={handleContinueApplication}
                themeColor={accentColor}
                applicantId={applicantId || undefined}
                applicantName={applicantName}
                onNameUpdate={(newName) => setApplicantName(newName)}
                hideHeader={true}
              />
            )}

            {currentView === 'application' && initialData && (
              <ApplicationView
                portalConfig={portalConfig}
                form={form}
                initialData={initialData}
                currentFormData={currentFormData}
                onFormDataChange={handleFormDataChange}
                onSubmit={handleFormSubmit}
                onSaveAndDashboard={handleSaveAndDashboard}
                email={email}
                activeSectionId={activeSectionId}
                onSectionChange={setActiveSectionId}
                sidebarOpen={sidebarOpen}
                onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
                supportedLanguages={supportedLanguages}
                activeLanguage={activeLanguage}
                onLanguageChange={setActiveLanguage}
                onProgressChange={setApplicationProgress}
                applicationRowId={applicationRowId}
              />
            )}
          </div>
        </div>
      </div>
    </TranslationProvider>
  )
}

// Portal Navigation Sidebar Component
interface PortalNavSidebarProps {
  currentView: PortalView
  onViewChange: (view: PortalView) => void
  onBackToPortal: () => void
  showBackButton: boolean
  formName: string
  themeColor: string
  sidebarBgColor?: string
  sidebarTextColor?: string
  applicantId?: string
  applicantName?: string
  email?: string
  onLogout: () => void
  onOpenSettings?: () => void
}

function PortalNavSidebar({
  currentView,
  onViewChange,
  onBackToPortal,
  showBackButton,
  formName,
  themeColor,
  sidebarBgColor = '#101010',
  sidebarTextColor = '#BCE7F4',
  applicantId,
  applicantName,
  email,
  onLogout,
  onOpenSettings
}: PortalNavSidebarProps) {
  const navItems = [
    { id: 'application' as PortalView, label: 'Application', icon: FileText },
  ]

  return (
    <aside 
      className="w-64 border-r flex flex-col h-full"
      style={{ 
        backgroundColor: sidebarBgColor,
        borderColor: `${sidebarBgColor}33` // Add transparency to border
      }}
    >
      {/* Header */}
      <div 
        className="p-4 border-b"
        style={{ borderColor: `${sidebarTextColor}33` }}
      >
        <div className="flex items-center gap-3">
          <div className="flex-1 min-w-0">
            <h2 
              className="font-semibold truncate text-sm"
              style={{ color: sidebarTextColor }}
            >
              {formName}
            </h2>
            <p 
              className="text-xs"
              style={{ color: `${sidebarTextColor}CC` }}
            >
              Portal
            </p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto p-2">
        <button
          onClick={onBackToPortal}
          className={cn(
            "w-full flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-lg mb-2 transition-colors",
            currentView === 'dashboard' && "mb-2"
          )}
          style={{ 
            color: sidebarTextColor,
            backgroundColor: currentView === 'dashboard' ? `${sidebarTextColor}25` : 'transparent'
          }}
          onMouseEnter={(e) => {
            if (currentView !== 'dashboard') {
              e.currentTarget.style.backgroundColor = `${sidebarTextColor}15`
            }
          }}
          onMouseLeave={(e) => {
            if (currentView !== 'dashboard') {
              e.currentTarget.style.backgroundColor = 'transparent'
            }
          }}
        >
          <Home className="w-4 h-4" />
          <span>Portal Home</span>
        </button>
        
        <div className="space-y-1">
          {navItems.map((item) => {
            const isActive = currentView === item.id
            const Icon = item.icon
            
            return (
              <button
                key={item.id}
                onClick={() => onViewChange(item.id)}
                className={cn(
                  "w-full flex items-center gap-3 px-3 py-2.5 text-sm font-medium rounded-lg transition-colors"
                )}
                style={{
                  backgroundColor: isActive ? `${sidebarTextColor}25` : 'transparent',
                  color: sidebarTextColor,
                }}
                onMouseEnter={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.backgroundColor = `${sidebarTextColor}15`
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.backgroundColor = 'transparent'
                  }
                }}
              >
                <Icon className="w-4 h-4" />
                <span>{item.label}</span>
              </button>
            )
          })}
        </div>
      </nav>
      
      {/* User Menu at Bottom - Always show if logged in */}
      {(applicantId || applicantName || email) && (
        <div 
          className="p-2 border-t mt-auto"
          style={{ borderColor: `${sidebarTextColor}33` }}
        >
          <UserMenu 
            user={{
              id: applicantId || 'unknown',
              name: applicantName || 'User',
              email: email || 'user@example.com'
            }}
            onSignOut={onLogout}
            textColor={sidebarTextColor}
            onOpenSettings={onOpenSettings}
          />
        </div>
      )}
    </aside>
  )
}

// Portal Header Component
interface PortalHeaderProps {
  form: Form | null
  portalConfig: PortalConfig
  applicantName: string
  onLogout: () => void
  themeColor: string
  supportedLanguages?: string[]
  activeLanguage?: string
  onLanguageChange?: (lang: string) => void
  onContinueApplication?: () => void
  applicationStatus?: string
  applicantId?: string
  email?: string
  onNameUpdate?: (newName: string) => void
  currentView?: PortalView // Add currentView to hide button when in application view
  onToggleNavSidebar?: () => void
  navSidebarOpen?: boolean
  onSaveAndExit?: () => void // Add save and exit handler
  progress?: number // Progress percentage for progress bar
  isSaving?: boolean // Show saving state
  isSettingsOpen?: boolean // Settings modal state
  onSettingsOpenChange?: (open: boolean) => void // Settings modal state handler
}

function PortalHeader({
  form,
  portalConfig,
  applicantName,
  onLogout,
  themeColor,
  supportedLanguages = [],
  activeLanguage,
  onLanguageChange,
  onContinueApplication,
  applicationStatus = 'draft',
  applicantId,
  email = '',
  onNameUpdate,
  currentView,
  onToggleNavSidebar,
  navSidebarOpen = true,
  onSaveAndExit,
  progress,
  isSaving = false,
  isSettingsOpen = false,
  onSettingsOpenChange
}: PortalHeaderProps) {
  
  const themeSettings = portalConfig.settings as any
  const backgroundColor = themeSettings?.backgroundColor || '#FFFFFF'
  const textColor = themeSettings?.textColor || '#1F2937'
  
  return (
    <>
      <header 
        className="border-b"
        style={{ 
          backgroundColor: backgroundColor,
          borderColor: `${textColor}20`
        }}
      >
        <div className="px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              {/* Sidebar Toggle Button */}
              {onToggleNavSidebar && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9"
                  style={{ 
                    color: textColor,
                  }}
                  onClick={onToggleNavSidebar}
                  aria-label={navSidebarOpen ? "Close sidebar" : "Open sidebar"}
                >
                  {navSidebarOpen ? (
                    <PanelLeftClose className="w-5 h-5" />
                  ) : (
                    <PanelLeftOpen className="w-5 h-5" />
                  )}
                </Button>
              )}
              
              {portalConfig.settings.logoUrl ? (
                <img src={portalConfig.settings.logoUrl} alt="Logo" className="h-8 w-auto" />
              ) : (
                <div 
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-white font-bold"
                  style={{ backgroundColor: themeColor }}
                >
                  {portalConfig.settings.name?.charAt(0) || 'A'}
                </div>
              )}
              <span 
                className="font-semibold"
                style={{ color: textColor }}
              >
                {portalConfig.settings.name || form?.name}
              </span>
            </div>
            
            <div className="flex items-center gap-3">
              {supportedLanguages.length > 1 && activeLanguage && onLanguageChange && (
                <StandaloneLanguageSelector
                  activeLanguage={activeLanguage}
                  supportedLanguages={supportedLanguages}
                  onLanguageChange={onLanguageChange}
                />
              )}
              
              {/* Continue Application Button - Hide when in application view */}
              {onContinueApplication && 
               currentView !== 'application' && 
               ['draft', 'pending', 'in_progress', 'revision_requested', 'submitted'].includes(applicationStatus) && (
                <Button 
                  className="gap-2 text-sm px-4 h-9 text-white"
                  style={{ backgroundColor: themeColor }}
                  onClick={onContinueApplication}
                >
                  <FileText className="w-4 h-4" />
                  Continue Application
                </Button>
              )}
              
              {/* Settings Button */}
              {applicantId && onSettingsOpenChange && (
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="hover:bg-gray-100 h-9 w-9"
                  onClick={() => onSettingsOpenChange(true)}
                  data-settings-trigger
                >
                  <Settings className="w-4 h-4" />
                </Button>
              )}
              
              {/* Save and Exit Button - Made more visible */}
              {onSaveAndExit && (
                <Button 
                  size="lg"
                  onClick={(e) => {
                    e.preventDefault()
                    onSaveAndExit()
                  }}
                  disabled={isSaving}
                  className="bg-yellow-600 hover:bg-yellow-700 text-white shadow-lg font-semibold gap-2"
                >
                  <Save className="w-4 h-4" />
                  {isSaving ? 'Saving...' : 'Save & Exit'}
                </Button>
              )}
            </div>
          </div>
        </div>
      </header>
      
      {/* Progress Bar Below Header - Show only in application view */}
      {currentView === 'application' && progress !== undefined && (
        <>
          <style>{`
            @keyframes pulse-glow-${themeColor?.replace('#', '') || '3B82F6'} {
              0%, 100% {
                opacity: 1;
                box-shadow: 0 4px 30px ${themeColor || '#3B82F6'}20, 0 2px 20px ${themeColor || '#3B82F6'}25, 0 1px 10px ${themeColor || '#3B82F6'}30, 0 0 4px ${themeColor || '#3B82F6'}40;
              }
              50% {
                opacity: 0.9;
                box-shadow: 0 4px 35px ${themeColor || '#3B82F6'}25, 0 2px 24px ${themeColor || '#3B82F6'}30, 0 1px 12px ${themeColor || '#3B82F6'}35, 0 0 6px ${themeColor || '#3B82F6'}45;
              }
            }
          `}</style>
          <div className="w-full h-0.5 bg-gray-200 relative">
            <div 
              className="h-full transition-all duration-300 relative"
              style={{ 
                width: `${progress}%`,
                backgroundColor: themeColor || '#3B82F6',
                animation: `pulse-glow-${themeColor?.replace('#', '') || '3B82F6'} 2s ease-in-out infinite`
              }}
            />
          </div>
        </>
      )}
      
      {/* Account Settings Modal */}
      {applicantId && onSettingsOpenChange && (
        <AccountSettingsModal
          isOpen={isSettingsOpen}
          onClose={() => onSettingsOpenChange(false)}
          applicantId={applicantId}
          currentName={applicantName}
          email={email}
          onNameUpdate={onNameUpdate || (() => {})}
          themeColor={themeColor}
        />
      )}
    </>
  )
}

// Application View Component
interface ApplicationViewProps {
  portalConfig: PortalConfig
  form: Form | null
  initialData: any
  currentFormData: Record<string, any>
  onFormDataChange: (data: Record<string, any>) => void
  onSubmit: (data: Record<string, any>, options?: { saveAndExit?: boolean }) => Promise<void>
  onSaveAndDashboard: () => void
  email: string
  activeSectionId: string
  onSectionChange: (sectionId: string) => void
  sidebarOpen: boolean
  onToggleSidebar: () => void
  supportedLanguages?: string[]
  activeLanguage?: string
  onLanguageChange?: (lang: string) => void
  onProgressChange?: (progress: number) => void
  applicationRowId?: string | null
}

function ApplicationView({
  portalConfig,
  form,
  initialData,
  currentFormData,
  onFormDataChange,
  onSubmit,
  onSaveAndDashboard,
  email,
  activeSectionId,
  onSectionChange,
  sidebarOpen,
  onToggleSidebar,
  supportedLanguages = [],
  activeLanguage,
  onLanguageChange,
  onProgressChange,
  applicationRowId
}: ApplicationViewProps) {
  const sections = portalConfig.sections || []
  // Include form, cover, and review sections (exclude ending sections)
  const formSections = sections.filter(s => 
    s.sectionType === 'form' || 
    s.sectionType === 'cover' || 
    s.sectionType === 'review'
  )

  // Set initial section if activeSectionId is empty
  useEffect(() => {
    if (!activeSectionId && formSections.length > 0) {
      onSectionChange(formSections[0].id)
    }
  }, [activeSectionId, formSections, onSectionChange])

  // Calculate section completion - only count required fields
  const getSectionCompletion = (section: Section): { completion: number; hasRequired: boolean } => {
    const formData = Object.keys(currentFormData).length > 0 ? currentFormData : initialData
    if (!formData) return { completion: 0, hasRequired: false }
    
    const sectionFields = section.fields || []
    // Filter to only required fields
    const requiredFields = sectionFields.filter(field => field.required === true)
    
    // Review sections: consider complete if all other sections with required fields are complete
    if (section.sectionType === 'review') {
      const otherSections = formSections.filter(s => s.sectionType !== 'review' && s.id !== section.id)
      const sectionsWithRequired = otherSections.filter(s => {
        const fields = s.fields || []
        return fields.some(f => f.required === true)
      })
      
      if (sectionsWithRequired.length === 0) {
        return { completion: 100, hasRequired: false }
      }
      
      let allComplete = true
      for (const s of sectionsWithRequired) {
        const sFields = s.fields || []
        const sRequiredFields = sFields.filter(f => f.required === true)
        if (sRequiredFields.length > 0) {
          const allFilled = sRequiredFields.every(f => {
            const value = formData[f.id]
            return value !== undefined && value !== null && value !== ''
          })
          if (!allFilled) {
            allComplete = false
            break
          }
        }
      }
      return { completion: allComplete ? 100 : 0, hasRequired: true }
    }
    
    // Cover sections: consider complete (no fields to validate)
    if (section.sectionType === 'cover' || sectionFields.length === 0 || requiredFields.length === 0) {
      return { completion: 100, hasRequired: false }
    }
    
    const filledRequiredFields = requiredFields.filter(field => {
      const value = formData[field.id]
      return value !== undefined && value !== null && value !== ''
    })
    
    const completion = Math.round((filledRequiredFields.length / requiredFields.length) * 100)
    return { completion, hasRequired: true }
  }

  const isSectionComplete = (section: Section): boolean => {
    const { completion } = getSectionCompletion(section)
    return completion === 100
  }

  const hasIncompleteRequiredFields = (section: Section): boolean => {
    const { completion, hasRequired } = getSectionCompletion(section)
    return hasRequired && completion < 100 && completion > 0
  }

  // Calculate overall progress for progress bar
  const overallProgress = useMemo(() => {
    const formSectionsWithRequired = formSections.filter(s => {
      const { hasRequired } = getSectionCompletion(s)
      return hasRequired
    })
    
    if (formSectionsWithRequired.length === 0) return 0
    
    const totalCompletion = formSectionsWithRequired.reduce((sum, section) => {
      return sum + getSectionCompletion(section).completion
    }, 0)
    
    return Math.round(totalCompletion / formSectionsWithRequired.length)
  }, [formSections, currentFormData, initialData])

  // Notify parent of progress changes
  useEffect(() => {
    if (onProgressChange) {
      onProgressChange(overallProgress)
    }
  }, [overallProgress, onProgressChange])

  return (
    <div className="flex h-[calc(100vh-4rem)] overflow-hidden">
      {/* Application Sections Sidebar - Separate container with full height */}
      <aside className="hidden lg:block w-64 shrink-0 bg-white border-r border-gray-200 h-full overflow-y-auto">
        <div className="p-4 space-y-2">
          {formSections.map((section: Section, idx: number) => {
            const isActive = section.id === activeSectionId
            const isCompleted = isSectionComplete(section)
            const hasIncomplete = hasIncompleteRequiredFields(section)
            return (
              <button
                key={section.id}
                onClick={() => {
                  // Change section immediately (don't block navigation)
                  onSectionChange(section.id)
                  
                  // Data is already saved via real-time sync in handleFormDataChange
                  // No need for explicit save on section change
                }}
                className={cn(
                  "w-full flex items-center justify-between rounded-md px-3 py-2.5 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-gray-900 text-white"
                    : isCompleted
                    ? "bg-green-50 text-green-700 hover:bg-green-100"
                    : hasIncomplete
                    ? "bg-yellow-50 text-yellow-700 hover:bg-yellow-100"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                )}
              >
                <span className="truncate text-left flex-1">{section.title || `Section ${idx + 1}`}</span>
                {isCompleted && (
                  <CheckCircle2 className={cn(
                    "w-4 h-4 ml-2 flex-shrink-0",
                    isActive ? "text-white" : "text-green-600"
                  )} />
                )}
              </button>
            )
          })}
        </div>
      </aside>

      {/* Form Content - Separate scrollable container */}
      <div className="flex-1 overflow-y-auto h-full">
        <DynamicApplicationForm
          config={portalConfig}
          onSubmit={onSubmit}
          onFormDataChange={onFormDataChange}
          onDashboard={onSaveAndDashboard}
          isExternal={true}
          formId={form?.id}
          initialSectionId={activeSectionId}
          initialData={initialData}
          email={email}
          submissionId={applicationRowId || undefined}
          useOptimisticSave={true}
        />
      </div>
    </div>
  )
}
