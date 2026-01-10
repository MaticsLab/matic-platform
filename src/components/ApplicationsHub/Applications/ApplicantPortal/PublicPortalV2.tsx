'use client'

import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowRight, Mail, Lock, LayoutDashboard, FileText, MessageSquare, CheckSquare, Home, LogOut, Settings, Bell, CheckCircle2, Menu, X, PanelLeftOpen, PanelLeftClose } from 'lucide-react'
import { AccountSettingsModal } from '@/components/Dashboard/DashboardV2/AccountSettingsModal'
import { Button } from '@/ui-components/button'
import { Input } from '@/ui-components/input'
import { Textarea } from '@/ui-components/textarea'
import { Label } from '@/ui-components/label'
import { DynamicApplicationForm } from './DynamicApplicationForm'
import { ApplicantDashboard } from './ApplicantDashboard'
import { AuthPageRenderer } from '@/components/Portal/AuthPageRenderer'
import { Form } from '@/types/forms'
import { Field, PortalConfig, Section } from '@/types/portal'
import { cn } from '@/lib/utils'
import { applyTranslationsToConfig, applyTranslationsToField, normalizeTranslations } from '@/lib/portal-translations'
import { portalAuthClient } from '@/lib/api/portal-auth-client'
import { authClient } from '@/lib/better-auth-client'
import { toast } from 'sonner'
import { TranslationProvider } from '@/lib/i18n/TranslationProvider'
import { StandaloneLanguageSelector } from '@/components/Portal/LanguageSelector'
import { endingPagesClient } from '@/lib/api/ending-pages-client'
import { EndingPageRenderer } from '@/components/EndingPages/BlockRenderer'
import type { EndingPageConfig } from '@/types/ending-blocks'
import { portalDashboardClient, type PortalActivity } from '@/lib/api/portal-dashboard-client'
import { Loader2, Send, Clock } from 'lucide-react'
import { ScrollArea } from '@/ui-components/scroll-area'
import { Card, CardContent, CardHeader, CardTitle } from '@/ui-components/card'
import { Progress } from '@/ui-components/progress'
import { usePortalFormRealtime } from '@/hooks/usePortalFormRealtime'

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

type PortalView = 'dashboard' | 'messages' | 'tasks' | 'application'

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
    return 'https://backend.maticslab.com/api/v1'
  }
  // Server-side rendering - check env var
  if (process.env.NEXT_PUBLIC_GO_API_URL) {
    return process.env.NEXT_PUBLIC_GO_API_URL
  }
  // Server-side fallback
  return 'https://backend.maticslab.com/api/v1'
}

export function PublicPortalV2({ slug, subdomain }: PublicPortalV2Props) {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
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
  const [endingPage, setEndingPage] = useState<EndingPageConfig | null>(null)
  const [applicationRowId, setApplicationRowId] = useState<string | null>(null)
  const [currentView, setCurrentView] = useState<PortalView>('dashboard')
  const [currentFormData, setCurrentFormData] = useState<Record<string, any>>({})
  const [applicantId, setApplicantId] = useState<string | null>(null)
  const [applicantName, setApplicantName] = useState<string>('')
  const [activeSectionId, setActiveSectionId] = useState<string>('')
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [navSidebarOpen, setNavSidebarOpen] = useState(true) // State for main navigation sidebar
  const [applicationProgress, setApplicationProgress] = useState<number>(0) // Progress for application view
  
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
    const translatedFields = (form.fields || []).map((field) => 
      applyTranslationsToField(field, langResource)
    )

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
      },
      fields: translatedFields
    }
  }, [form, activeLanguage, defaultLanguage])

  // Memoize the form initial data
  const formInitialData = useMemo(() => {
    if (!initialData) return null
    if (applicationRowId) {
      return { ...initialData, _submission_id: applicationRowId }
    }
    return initialData
  }, [initialData, applicationRowId])

  // Set up real-time form data synchronization (only when form and submission exist)
  const realtimeHookEnabled = isAuthenticated && !!form?.id && !!applicationRowId && !!email
  const { saveData: realtimeSaveData, isSaving: isRealtimeSaving } = usePortalFormRealtime({
    formId: form?.id || '',
    submissionId: applicationRowId,
    email: email || '',
    enabled: realtimeHookEnabled,
    onDataUpdate: (updatedData) => {
      // When data is updated via realtime, merge it with current form data
      setCurrentFormData((prev) => ({ ...prev, ...updatedData }))
      setInitialData((prev: any) => ({ ...prev, ...updatedData }))
    },
    onSave: async (data) => {
      // Custom save handler that uses the existing API
      if (!form?.id) {
        throw new Error('Form ID not available')
      }
      const cleanedFormData = stripBlobUrls(data)
      const baseUrl = getApiUrl()
      
      console.log('[PublicPortalV2] Saving form data:', { 
        formId: form.id, 
        email, 
        dataKeys: Object.keys(cleanedFormData).length 
      })
      
      const response = await fetch(`${baseUrl}/forms/${form.id}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          data: cleanedFormData, 
          email,
          save_draft: true
        })
      })
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        const errorMessage = errorData.error || errorData.message || `Save failed (HTTP ${response.status})`
        console.error('[PublicPortalV2] Save failed:', errorMessage)
        throw new Error(errorMessage)
      }
      
      const savedRow = await response.json()
      console.log('[PublicPortalV2] Save successful:', { rowId: savedRow.id })
      
      if (savedRow.id && !applicationRowId) {
        setApplicationRowId(savedRow.id)
      }
      if (applicationRowId || savedRow.id) {
        setInitialData((prev: any) => ({ 
          ...prev, 
          ...cleanedFormData, 
          _submission_id: applicationRowId || savedRow.id 
        }))
      } else {
        setInitialData((prev: any) => ({ ...prev, ...cleanedFormData }))
      }
    },
  })


  // Handle form data changes - now uses real-time sync
  const handleFormDataChange = useCallback((data: Record<string, any>) => {
    setCurrentFormData(data)
    
    // Save via real-time sync (debounced automatically)
    if (applicationRowId && form?.id && email) {
      realtimeSaveData(data).catch((err) => {
        console.error('[PublicPortalV2] Realtime save failed in handleFormDataChange:', err)
        // Error is logged but don't block form interaction
      })
    }
    
    // Also save to localStorage as backup
    if (form?.id && email) {
      try {
        const storageKey = `portal-form-data-${form.id}-${email}`
        localStorage.setItem(storageKey, JSON.stringify(data))
      } catch (err) {
        console.warn('Failed to save form data to localStorage:', err)
      }
    }
  }, [form?.id, email, applicationRowId, realtimeSaveData])

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
                
                // Fetch latest submission data in background (non-blocking)
                // This updates the data after the form is already shown
                try {
                  const baseUrl = getApiUrl()
                  const res = await fetch(`${baseUrl}/forms/${formData.id}/submission?email=${encodeURIComponent(authData.email)}`)
                  if (res.ok) {
                    const rowData = await res.json()
                    let existingData = rowData.data || rowData
                    if (existingData && Object.keys(existingData).length > 0) {
                      // If we have a row ID, load and merge documents
                      if (rowData.id) {
                        existingData = await loadAndMergeDocuments(baseUrl, rowData.id, formData, existingData)
                        if (!authData.applicationRowId) {
                          setApplicationRowId(rowData.id)
                        }
                      }
                      setInitialData(existingData)
                      setSubmissionData(existingData)
                      setHasExistingSubmission(true)
                      setCurrentFormData(existingData)
                    }
                    
                    if (rowData.metadata?.status && !authData.applicationStatus) {
                      setApplicationStatus(rowData.metadata.status)
                    }
                  }
                } catch (err) {
                  console.warn('Failed to fetch submission on restore:', err)
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
              // Verify magic link was successful
              const session = await authClient.getSession()
              if (session?.data?.session?.user) {
              setEmail(email)
                setEmail(user.email)
                
                // Sync with portal_applicant
                try {
                  const baseUrl = getApiUrl()
                  const syncResponse = await fetch(`${baseUrl}/portal/sync-better-auth-applicant`, {
                    method: 'POST',
                    headers: { 
                      'Content-Type': 'application/json',
                    },
                    credentials: 'include', // Include cookies for Better Auth session
                    body: JSON.stringify({
                      form_id: formData.id,
                      email: user.email,
                      better_auth_user_id: user.id,
                      name: user.name || user.email.split('@')[0],
                      first_name: user.name?.split(' ')[0] || '',
                      last_name: user.name?.split(' ').slice(1).join(' ') || ''
                    })
                  })
                  
                  if (syncResponse.ok) {
                    const applicant = await syncResponse.json()
                    setApplicantId(applicant.id)
                    setApplicantName(applicant.name || user.name || '')
                    
                    if (applicant.row_id) {
                      setApplicationRowId(applicant.row_id)
                    }
                    if (applicant.status) {
                      setApplicationStatus(applicant.status)
                    }
                    
                    // Fetch submission data
                    const res = await fetch(`${baseUrl}/forms/${formData.id}/submission?email=${encodeURIComponent(user.email)}`)
                    if (res.ok) {
                      const rowData = await res.json()
                      let existingData = rowData.data || rowData
                      if (existingData && Object.keys(existingData).length > 0) {
                        // If we have a row ID, load and merge documents
                        if (rowData.id) {
                          existingData = await loadAndMergeDocuments(baseUrl, rowData.id, formData, existingData)
                        }
                        setInitialData(existingData)
                        setSubmissionData(existingData)
                        setHasExistingSubmission(true)
                        setCurrentFormData(existingData)
                      }
                    }
                    
                    setIsAuthenticated(true)
                    setCurrentView('dashboard')
                    toast.success('Signed in successfully!')
                    
                    // Clean up URL params
                    window.history.replaceState({}, '', window.location.pathname)
                  }
                } catch (syncError) {
                  console.warn('Failed to sync with portal applicant:', syncError)
                }
              }
            } else {
              // Check for existing Better Auth session
              const session = await authClient.getSession()
              if (session?.data?.session?.user) {
                const user = session.data.session.user
                // Check if this user has a portal_applicant for this form
                try {
                  const baseUrl = getApiUrl()
                  const res = await fetch(`${baseUrl}/forms/${formData.id}/submission?email=${encodeURIComponent(user.email)}`)
                  if (res.ok) {
                    const rowData = await res.json()
                    if (rowData.id) {
                      // User has a submission, restore session
                      setEmail(user.email)
                      setApplicantName(user.name || user.email)
                      const existingData = rowData.data || rowData
                      if (existingData && Object.keys(existingData).length > 0) {
                        setInitialData(existingData)
                        setSubmissionData(existingData)
                        setHasExistingSubmission(true)
                        setCurrentFormData(existingData)
                        setApplicationRowId(rowData.id)
                        if (rowData.metadata?.status) {
                          setApplicationStatus(rowData.metadata.status)
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
      const result = await authClient.signIn.magicLink({
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
        // Try Better Auth first
        let betterAuthUser = null
        let betterAuthResult = await authClient.signIn.email({
          email,
          password,
        })

        // If Better Auth fails, try legacy portal login and migrate
        if (betterAuthResult.error || !betterAuthResult.data?.user) {
          console.log('[PublicPortalV2] Better Auth login failed, trying legacy portal login...')
          
          // Try legacy portal login
          const baseUrl = getApiUrl()
          try {
            const legacyLoginResponse = await fetch(`${baseUrl}/portal/login`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                form_id: formIdToUse,
                email,
                password,
              }),
            })

            if (legacyLoginResponse.ok) {
              const legacyApplicant = await legacyLoginResponse.json()
              console.log('[PublicPortalV2] Legacy login successful, migrating to Better Auth...')
              
              // Create Better Auth account for this user
              // Try to sign up with Better Auth (this will create account or return error if exists)
              const signUpResult = await authClient.signUp.email({
                email,
                password,
                name: legacyApplicant.name || email.split('@')[0],
              })

              if (signUpResult.data?.user) {
                // Successfully created Better Auth account
                betterAuthUser = signUpResult.data.user
                betterAuthUserId = signUpResult.data.user.id
              } else if (signUpResult.error) {
                // User might already exist in Better Auth - try to sign in
                console.log('[PublicPortalV2] Better Auth signup failed, trying sign-in:', signUpResult.error.message)
                const signInResult = await authClient.signIn.email({
                  email,
                  password,
                })
                
                if (signInResult.data?.user) {
                  betterAuthUser = signInResult.data.user
                  betterAuthUserId = signInResult.data.user.id
                } else {
                  // Better Auth sign-in also failed - password might be different
                  console.warn('[PublicPortalV2] Better Auth sign-in failed, user may have different password')
                  // Continue with legacy auth below
                }
              }

              // If we successfully created/got Better Auth user, sync them
              if (betterAuthUser || betterAuthUserId) {
                const syncResponse = await fetch(`${baseUrl}/portal/sync-better-auth-applicant`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  credentials: 'include',
                  body: JSON.stringify({
                    form_id: formIdToUse,
                    email,
                    better_auth_user_id: betterAuthUserId || betterAuthUser?.id,
                    name: legacyApplicant.name,
                    first_name: legacyApplicant.name?.split(' ')[0] || '',
                    last_name: legacyApplicant.name?.split(' ').slice(1).join(' ') || '',
                  }),
                })

                if (syncResponse.ok) {
                  // Now try to sign in with Better Auth
                  betterAuthResult = await authClient.signIn.email({
                    email,
                    password,
                  })

                  if (betterAuthResult.data?.user) {
                    betterAuthUser = betterAuthResult.data.user
                  } else {
                    // Fall back to legacy auth if Better Auth sign-in still fails
                    console.log('[PublicPortalV2] Better Auth sign-in still failed, using legacy auth')
                    // Use legacy applicant data
                    setApplicantId(legacyApplicant.id)
                    setApplicantName(legacyApplicant.name || '')
                    setEmail(email)
                    setIsAuthenticated(true)

                    if (legacyApplicant.row_id) {
                      setApplicationRowId(legacyApplicant.row_id)
                    }
                    if (legacyApplicant.status) {
                      setApplicationStatus(legacyApplicant.status)
                    }

                    if (legacyApplicant.submission_data && Object.keys(legacyApplicant.submission_data).length > 0) {
                      setInitialData(legacyApplicant.submission_data)
                      setSubmissionData(legacyApplicant.submission_data)
                      setHasExistingSubmission(true)
                      setCurrentView('dashboard')
                    }

                    // Save to localStorage
                    try {
                      const authData = {
                        email,
                        formId: form.id,
                        applicantId: legacyApplicant.id,
                        applicantName: legacyApplicant.name || '',
                        timestamp: Date.now()
                      }
                      localStorage.setItem(`portal-auth-${form.id}`, JSON.stringify(authData))
                    } catch (err) {
                      console.warn('Failed to save auth to localStorage:', err)
                    }

                    toast.success('Logged in successfully')
                    setIsLoading(false)
                    return
                  }
                }
              } else {
                // Couldn't create Better Auth account, use legacy auth
                console.log('[PublicPortalV2] Could not create Better Auth account, using legacy auth')
                setApplicantId(legacyApplicant.id)
                setApplicantName(legacyApplicant.name || '')
                setEmail(email)
                setIsAuthenticated(true)

                if (legacyApplicant.row_id) {
                  setApplicationRowId(legacyApplicant.row_id)
                }
                if (legacyApplicant.status) {
                  setApplicationStatus(legacyApplicant.status)
                }

                if (legacyApplicant.submission_data && Object.keys(legacyApplicant.submission_data).length > 0) {
                  setInitialData(legacyApplicant.submission_data)
                  setSubmissionData(legacyApplicant.submission_data)
                  setHasExistingSubmission(true)
                  setCurrentView('dashboard')
                }

                // Save to localStorage
                try {
                  const authData = {
                    email,
                    formId: form.id,
                    applicantId: legacyApplicant.id,
                    applicantName: legacyApplicant.name || '',
                    timestamp: Date.now()
                  }
                  localStorage.setItem(`portal-auth-${form.id}`, JSON.stringify(authData))
                } catch (err) {
                  console.warn('Failed to save auth to localStorage:', err)
                }

                toast.success('Logged in successfully')
                setIsLoading(false)
                return
              }
            } else {
              // Legacy login also failed
              const errorData = await legacyLoginResponse.json().catch(() => ({}))
              throw new Error(errorData.error || 'Invalid email or password')
            }
          } catch (legacyError: any) {
            console.error('[PublicPortalV2] Legacy login error:', legacyError)
            throw new Error(legacyError.message || 'Invalid email or password')
          }
        } else {
          betterAuthUser = betterAuthResult.data.user
        }

        if (!betterAuthUser) {
          throw new Error('Invalid email or password')
        }
        
        // After Better Auth login, sync with portal_applicants
        // This ensures form-specific data is available
        try {
          const baseUrl = getApiUrl()
          // Use existing portal login endpoint which will create applicant if needed
          // But we'll pass a flag to indicate Better Auth user
          const syncResponse = await fetch(`${baseUrl}/portal/sync-better-auth-applicant`, {
            method: 'POST',
            headers: { 
              'Content-Type': 'application/json',
              // Include Better Auth session token if available
            },
            credentials: 'include', // Include cookies for Better Auth session
            body: JSON.stringify({
              form_id: formIdToUse,
              email: betterAuthUser.email,
              better_auth_user_id: betterAuthUser.id,
              name: betterAuthUser.name || `${betterAuthUser.email}`.split('@')[0],
              first_name: betterAuthUser.name?.split(' ')[0] || '',
              last_name: betterAuthUser.name?.split(' ').slice(1).join(' ') || ''
            })
          })

          if (syncResponse.ok) {
            const applicant = await syncResponse.json()
            setApplicantId(applicant.id)
            setApplicantName(applicant.name || betterAuthUser.name || '')

            if (applicant.row_id) {
              setApplicationRowId(applicant.row_id)
            }
            if (applicant.status) {
              setApplicationStatus(applicant.status)
            }

            let existingData: any = null
            if (applicant.submission_data && Object.keys(applicant.submission_data).length > 0) {
              existingData = applicant.submission_data
            } else {
              try {
                const res = await fetch(`${baseUrl}/forms/${form.id}/submission?email=${encodeURIComponent(email)}`)
                if (res.ok) {
                  const rowData = await res.json()
                  existingData = rowData.data || rowData
                  if (rowData.id && !applicant.row_id) {
                    setApplicationRowId(rowData.id)
                  }
                  if (rowData.metadata?.status && !applicant.status) {
                    setApplicationStatus(rowData.metadata.status)
                  }
                }
              } catch (err) {
                console.error("Failed to fetch submission", err)
              }
            }

            if (existingData && Object.keys(existingData).length > 0) {
              // If we have a row ID, load and merge documents
              if (applicationRowId) {
                try {
                  existingData = await loadAndMergeDocuments(baseUrl, applicationRowId, form, existingData)
                } catch (docError) {
                  console.warn('Failed to load documents:', docError)
                }
              }
              setInitialData(existingData)
              setSubmissionData(existingData)
              setHasExistingSubmission(true)
              setCurrentView('dashboard')
            }
          }
        } catch (syncError) {
          console.warn('Failed to sync with portal applicant, continuing with Better Auth user:', syncError)
          // Still allow login even if sync fails
          setApplicantName(betterAuthUser.name || betterAuthUser.email)
        }

        // Save authentication state to localStorage
        try {
          const authData = {
            email: betterAuthUser.email,
            formId: form.id,
            betterAuthUserId: betterAuthUser.id,
            applicantName: betterAuthUser.name || '',
            timestamp: Date.now()
          }
          localStorage.setItem(`portal-auth-${form.id}`, JSON.stringify(authData))
        } catch (err) {
          console.warn('Failed to save auth to localStorage:', err)
        }

        setIsAuthenticated(true)
        toast.success('Logged in successfully')
      } else {
        // Sign up with Better Auth
        const fullName = signupData.full_name || signupData.name || ''
        const displayName = fullName.trim() || email

        const result = await authClient.signUp.email({
          email,
          password,
          name: displayName,
        })

        if (result.error) {
          throw new Error(result.error.message || 'Signup failed')
        }

        if (!result.data?.user) {
          throw new Error('Signup failed')
        }

        const betterAuthUser = result.data.user

        // Parse full name into first and last for backend compatibility
        const nameParts = displayName.trim().split(/\s+/)
        const firstName = nameParts[0] || ''
        const lastName = nameParts.slice(1).join(' ') || ''

        // After Better Auth signup, create portal_applicant record
        try {
          const baseUrl = getApiUrl()
          const syncResponse = await fetch(`${baseUrl}/portal/sync-better-auth-applicant`, {
            method: 'POST',
            headers: { 
              'Content-Type': 'application/json',
            },
            credentials: 'include', // Include cookies for Better Auth session
            body: JSON.stringify({
              form_id: formIdToUse,
              email: betterAuthUser.email,
              better_auth_user_id: betterAuthUser.id,
              first_name: firstName,
              last_name: lastName,
              name: displayName
            })
          })

          if (syncResponse.ok) {
            const applicant = await syncResponse.json()
            setApplicantId(applicant.id)
            setApplicantName(applicant.name || displayName)

            if (applicant.row_id) {
              setApplicationRowId(applicant.row_id)
            }
            if (applicant.status) {
              setApplicationStatus(applicant.status)
            }
          }
        } catch (syncError) {
          console.warn('Failed to sync with portal applicant:', syncError)
          // Still allow signup even if sync fails
          setApplicantName(displayName)
        }

        // Save authentication state to localStorage
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
      const response = await fetch(`${baseUrl}/forms/${form.id}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          data: cleanedFormData, 
          email,
          save_draft: isDraft ? true : undefined
        })
      })
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || errorData.message || `Submission failed (HTTP ${response.status})`)
      }
      
      const savedRow = await response.json()
      
      if (savedRow.id) {
        setApplicationRowId(savedRow.id)
        setInitialData((prev: Record<string, any> | null) => ({ ...prev, _submission_id: savedRow.id }))
      }
      
      setSubmissionData(cleanedFormData)
      
      if (options?.saveAndExit) {
        // Verify save succeeded - must have a row ID
        if (!savedRow.id) {
          console.error('[PublicPortalV2] Save returned but no row ID - save may have failed')
          toast.error('Failed to save application. Please try again.')
          // Don't navigate away if save didn't return an ID
          throw new Error('Save failed: No row ID returned')
        }
        
        // Save succeeded - show success and navigate
        console.log('[PublicPortalV2] Save and exit successful:', savedRow.id)
        toast.success('Application saved successfully!')
        setCurrentView('dashboard')
        // Don't clear currentFormData - keep it for when user returns
        return
      }
      
      if (form?.id) {
        try {
          const matching = await endingPagesClient.findMatching(form.id, formData)
          if (matching) {
            setEndingPage(matching)
          }
        } catch (error) {
          console.warn('Failed to fetch ending page:', error)
        }
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

    // If we have a submission ID, use real-time save
    if (applicationRowId && form?.id && email) {
      try {
        console.log('[PublicPortalV2] Saving before navigation via real-time')
        await realtimeSaveData(currentFormData)
        console.log('[PublicPortalV2] Real-time save completed before navigation')
      } catch (error) {
        console.warn('[PublicPortalV2] Real-time save failed, trying form submit:', error)
        // Fallback to form submit if real-time fails
        try {
          await handleFormSubmit(currentFormData, { saveAndExit: true })
        } catch (submitError) {
          console.error('[PublicPortalV2] Form submit also failed:', submitError)
          // Don't throw - allow navigation even if save fails
        }
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

    const flatFields = translatedForm.fields || []
    const rawSections = (translatedForm.settings as any)?.sections || []
    const fieldsBySection: Record<string, any[]> = {}
    
    flatFields.forEach((field: any) => {
      const sid = field.section_id || (field.config && field.config.section_id)
      if (sid) {
        if (!fieldsBySection[sid]) fieldsBySection[sid] = []
        fieldsBySection[sid].push(field)
      }
    })

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
        return {
          ...section,
          sectionType: section.sectionType || 'form',
          fields: sectionFields
        }
      })

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

    // Add review section at the end (if not already present)
    const hasReviewSection = sections.some(s => s.sectionType === 'review')
    if (!hasReviewSection) {
      sections.push({
        id: 'review',
        title: 'Review & Submit',
        description: 'Please review your information before submitting',
        sectionType: 'review',
        fields: []
      })
    }

    return {
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
  }, [translatedForm])

  // Show loading state
  if (isFormLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  // Show ending page if submitted
  if (isSubmitted) {
    if (endingPage) {
      return (
        <div className="min-h-screen bg-white">
          <EndingPageRenderer config={endingPage} submissionData={submissionData || {}} />
        </div>
      )
    }

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
        className="min-h-screen flex"
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
          />
        )}

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col min-w-0">
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
            isSaving={isRealtimeSaving}
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

            {currentView === 'messages' && (
              <MessagesView
                formId={form?.id || ''}
                rowId={applicationRowId || undefined}
                email={email}
              />
            )}

            {currentView === 'tasks' && (
              <TasksView
                formId={form?.id || ''}
                rowId={applicationRowId || undefined}
                email={email}
              />
            )}

            {currentView === 'application' && (
              <ApplicationView
                portalConfig={portalConfig}
                form={translatedForm}
                initialData={formInitialData}
                currentFormData={currentFormData}
                onFormDataChange={handleFormDataChange}
                onSubmit={handleFormSubmit}
                onSaveAndDashboard={handleSaveAndDashboard}
                email={email}
                activeSectionId={activeSectionId}
                onSectionChange={(sectionId: string) => {
                  // Change section immediately (don't block navigation)
                  setActiveSectionId(sectionId)
                  
                  // Data is already saved via real-time sync in handleFormDataChange
                  // No need for explicit save on section change
                }}
                applicationRowId={applicationRowId}
                sidebarOpen={sidebarOpen}
                onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
                supportedLanguages={supportedLanguages}
                activeLanguage={activeLanguage}
                onLanguageChange={setActiveLanguage}
                onProgressChange={setApplicationProgress}
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
}

function PortalNavSidebar({
  currentView,
  onViewChange,
  onBackToPortal,
  showBackButton,
  formName,
  themeColor,
  sidebarBgColor = '#101010',
  sidebarTextColor = '#BCE7F4'
}: PortalNavSidebarProps) {
  const navItems = [
    { id: 'messages' as PortalView, label: 'Messages', icon: MessageSquare },
    { id: 'tasks' as PortalView, label: 'Tasks', icon: CheckSquare },
    { id: 'application' as PortalView, label: 'Application', icon: FileText },
  ]

  return (
    <aside 
      className="w-64 border-r flex flex-col"
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
  isSaving = false
}: PortalHeaderProps) {
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  
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
              {applicantId && (
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="hover:bg-gray-100 h-9 w-9"
                  onClick={() => setIsSettingsOpen(true)}
                >
                  <Settings className="w-4 h-4" />
                </Button>
              )}
              
              {applicantName && (
                <span className="text-sm text-gray-600">{applicantName}</span>
              )}
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={(e) => {
                  e.preventDefault()
                  if (onSaveAndExit) {
                    onSaveAndExit()
                  } else {
                    onLogout()
                  }
                }}
                disabled={isSaving}
              >
                <LogOut className="w-4 h-4 mr-2" />
                {onSaveAndExit ? (isSaving ? 'Saving...' : 'Save and Exit') : 'Logout'}
              </Button>
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
      {applicantId && (
        <AccountSettingsModal
          isOpen={isSettingsOpen}
          onClose={() => setIsSettingsOpen(false)}
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

// Messages View Component
interface MessagesViewProps {
  formId: string
  rowId?: string
  email: string
}

function MessagesView({ formId, rowId, email }: MessagesViewProps) {
  const [messages, setMessages] = useState<PortalActivity[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [newMessage, setNewMessage] = useState('')
  const [isSending, setIsSending] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Load messages
  useEffect(() => {
    if (!rowId) {
      setIsLoading(false)
      return
    }

    const loadMessages = async () => {
      try {
        setIsLoading(true)
        const activities = await portalDashboardClient.listActivities(rowId, 'both')
        // Filter to only messages
        const messageActivities = activities.filter(a => a.activity_type === 'message')
        setMessages(messageActivities)
      } catch (error: any) {
        // Silently handle errors - don't show toast for 500s as they're backend issues
        // Only log for debugging
        if (error?.status !== 500) {
          console.error('Failed to load messages:', error)
          toast.error('Failed to load messages')
        } else {
          console.warn('Messages endpoint returned 500 - backend issue, continuing without messages')
        }
        // Set empty array on error so UI doesn't break
        setMessages([])
      } finally {
        setIsLoading(false)
      }
    }

    loadMessages()
    
    // Refresh messages every 30 seconds
    const interval = setInterval(loadMessages, 30000)
    return () => clearInterval(interval)
  }, [rowId])

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Send message
  const handleSendMessage = async () => {
    if (!newMessage.trim() || !rowId || isSending) return

    try {
      setIsSending(true)
      await portalDashboardClient.createActivity(rowId, {
        activity_type: 'message',
        content: newMessage.trim(),
        visibility: 'both'
      })
      
      setNewMessage('')
      // Reload messages
      const activities = await portalDashboardClient.listActivities(rowId, 'both')
      const messageActivities = activities.filter(a => a.activity_type === 'message')
      setMessages(messageActivities)
    } catch (error) {
      console.error('Failed to send message:', error)
      toast.error('Failed to send message')
    } finally {
      setIsSending(false)
    }
  }

  if (!rowId) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Messages</h1>
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <p className="text-gray-500">Please submit your application first to access messages.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto p-6 h-full flex flex-col">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Messages</h1>
      
      <Card className="flex-1 flex flex-col">
        <CardHeader>
          <CardTitle className="text-lg">Conversation</CardTitle>
        </CardHeader>
        <CardContent className="flex-1 flex flex-col min-h-0">
          {isLoading ? (
            <div className="flex items-center justify-center h-64">
              <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
            </div>
          ) : (
            <>
              <ScrollArea className="flex-1 pr-4">
                <div className="space-y-4">
                  {messages.length === 0 ? (
                    <div className="text-center py-12 text-gray-500">
                      <MessageSquare className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                      <p>No messages yet. Start a conversation!</p>
                    </div>
                  ) : (
                    messages.map((message) => {
                      const isFromApplicant = message.sender_type === 'applicant'
                      const time = new Date(message.created_at).toLocaleString()
                      
                      return (
                        <div
                          key={message.id}
                          className={cn(
                            "flex",
                            isFromApplicant ? "justify-end" : "justify-start"
                          )}
                        >
                          <div
                            className={cn(
                              "max-w-[70%] rounded-lg px-4 py-2",
                              isFromApplicant
                                ? "bg-blue-600 text-white"
                                : "bg-gray-100 text-gray-900"
                            )}
                          >
                            <div className="text-sm font-medium mb-1">
                              {message.sender_name || (isFromApplicant ? 'You' : 'Staff')}
                            </div>
                            <div className="text-sm whitespace-pre-wrap">{message.content}</div>
                            <div className={cn(
                              "text-xs mt-1",
                              isFromApplicant ? "text-blue-100" : "text-gray-500"
                            )}>
                              {time}
                            </div>
                          </div>
                        </div>
                      )
                    })
                  )}
                  <div ref={messagesEndRef} />
                </div>
              </ScrollArea>
              
              <div className="mt-4 pt-4 border-t border-gray-200">
                <div className="flex gap-2">
                  <Input
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault()
                        handleSendMessage()
                      }
                    }}
                    placeholder="Type your message..."
                    disabled={isSending}
                  />
                  <Button
                    onClick={handleSendMessage}
                    disabled={!newMessage.trim() || isSending}
                    style={{ backgroundColor: '#3B82F6' }}
                  >
                    {isSending ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Send className="w-4 h-4" />
                    )}
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

// Tasks View Component
interface TasksViewProps {
  formId: string
  rowId?: string
  email: string
}

function TasksView({ formId, rowId, email }: TasksViewProps) {
  const [tasks, setTasks] = useState<PortalActivity[]>([])
  const [isLoading, setIsLoading] = useState(true)

  // Load tasks (file requests and other actionable activities)
  useEffect(() => {
    if (!rowId) {
      setIsLoading(false)
      return
    }

    const loadTasks = async () => {
      try {
        setIsLoading(true)
        const activities = await portalDashboardClient.listActivities(rowId, 'both')
        // Filter to actionable tasks (file requests, etc.)
        const taskActivities = activities.filter(a => 
          a.activity_type === 'file_request' || 
          a.activity_type === 'note' ||
          (a.activity_type === 'status_update' && a.metadata?.action_required)
        )
        setTasks(taskActivities)
      } catch (error: any) {
        // Silently handle errors - don't show toast for 500s as they're backend issues
        // Only log for debugging
        if (error?.status !== 500) {
          console.error('Failed to load tasks:', error)
          toast.error('Failed to load tasks')
        } else {
          console.warn('Tasks endpoint returned 500 - backend issue, continuing without tasks')
        }
        // Set empty array on error so UI doesn't break
        setTasks([])
      } finally {
        setIsLoading(false)
      }
    }

    loadTasks()
    
    // Refresh tasks every 30 seconds
    const interval = setInterval(loadTasks, 30000)
    return () => clearInterval(interval)
  }, [rowId])

  if (!rowId) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Tasks</h1>
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <p className="text-gray-500">Please submit your application first to view tasks.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Tasks</h1>
      
      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
        </div>
      ) : tasks.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-gray-500">
            <CheckSquare className="w-12 h-12 mx-auto mb-3 text-gray-300" />
            <p>No tasks at this time.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {tasks.map((task) => {
            const time = new Date(task.created_at).toLocaleString()
            const isFileRequest = task.activity_type === 'file_request'
            
            return (
              <Card key={task.id}>
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <div className={cn(
                      "w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0",
                      isFileRequest ? "bg-blue-100 text-blue-600" : "bg-gray-100 text-gray-600"
                    )}>
                      {isFileRequest ? <FileText className="w-5 h-5" /> : <CheckSquare className="w-5 h-5" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <h3 className="font-semibold text-gray-900">
                          {isFileRequest ? 'Document Request' : 'Task'}
                        </h3>
                        <span className="text-xs text-gray-500 flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {time}
                        </span>
                      </div>
                      <p className="text-sm text-gray-600 whitespace-pre-wrap">{task.content}</p>
                      {task.metadata && Object.keys(task.metadata).length > 0 && (
                        <div className="mt-2 text-xs text-gray-500">
                          {JSON.stringify(task.metadata, null, 2)}
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
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
        />
      </div>
    </div>
  )
}
