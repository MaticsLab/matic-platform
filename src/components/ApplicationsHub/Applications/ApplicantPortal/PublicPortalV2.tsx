'use client'

import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowRight, Mail, Lock, LayoutDashboard, FileText, MessageSquare, CheckSquare, Home, LogOut, Settings, Bell, CheckCircle2 } from 'lucide-react'
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
import { toast } from 'sonner'
import type { TranslationResource } from '@/lib/i18n/types'
import { TranslationProvider, useTranslationContext } from '@/lib/i18n/TranslationProvider'
import { StandaloneLanguageSelector } from '@/components/Portal/LanguageSelector'
import { PortalFieldAdapter } from '@/components/Fields/PortalFieldAdapter'
import { endingPagesClient } from '@/lib/api/ending-pages-client'
import { EndingPageRenderer } from '@/components/EndingPages/BlockRenderer'
import type { EndingPageConfig } from '@/types/ending-blocks'
import { ApplicationSidebar } from './ApplicationSidebar'
import { portalDashboardClient, type PortalActivity } from '@/lib/api/portal-dashboard-client'
import { Loader2, Send, Clock } from 'lucide-react'
import { ScrollArea } from '@/ui-components/scroll-area'
import { Card, CardContent, CardHeader, CardTitle } from '@/ui-components/card'

/**
 * Recursively strips blob URLs from form data before saving.
 */
function stripBlobUrls(data: any): any {
  if (data === null || data === undefined) return data
  
  if (Array.isArray(data)) {
    return data.map(item => stripBlobUrls(item))
  }
  
  if (typeof data === 'object') {
    const cleaned: Record<string, any> = {}
    for (const [key, value] of Object.entries(data)) {
      if (key === 'preview') continue
      if (typeof value === 'string' && value.startsWith('blob:')) {
        continue
      }
      cleaned[key] = stripBlobUrls(value)
    }
    return cleaned
  }
  
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

export function PublicPortalV2({ slug, subdomain }: PublicPortalV2Props) {
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
  const [applicationStatus, setApplicationStatus] = useState<string>('draft')
  const [endingPage, setEndingPage] = useState<EndingPageConfig | null>(null)
  const [applicationRowId, setApplicationRowId] = useState<string | null>(null)
  const [currentView, setCurrentView] = useState<PortalView>('dashboard')
  const [currentFormData, setCurrentFormData] = useState<Record<string, any>>({})
  const [applicantId, setApplicantId] = useState<string | null>(null)
  const [applicantName, setApplicantName] = useState<string>('')
  const [activeSectionId, setActiveSectionId] = useState<string>('')
  const [sidebarOpen, setSidebarOpen] = useState(true)

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

  // Handle form data changes
  const handleFormDataChange = useCallback((data: Record<string, any>) => {
    setCurrentFormData(data)
  }, [])

  // Load form configuration
  useEffect(() => {
    const loadForm = async () => {
      try {
        setIsFormLoading(true)
        const baseUrl = process.env.NEXT_PUBLIC_GO_API_URL || 'http://localhost:8080/api/v1'
        
        // If subdomain is provided, use subdomain+slug lookup
        // Otherwise, try by slug (which handles both UUID and custom_slug)
        const endpoint = subdomain 
          ? `${baseUrl}/forms/by-subdomain/${subdomain}/${slug}`
          : `${baseUrl}/forms/by-slug/${slug}`
        
        const formResponse = await fetch(endpoint, { cache: 'no-store' })
        
        if (!formResponse.ok) {
          throw new Error('Form not found')
        }
        
        const formData = await formResponse.json()
        setForm(formData)
      } catch (error) {
        console.error('Failed to load form:', error)
        toast.error('Failed to load application form')
      } finally {
        setIsFormLoading(false)
      }
    }

    if (slug) {
      loadForm()
    }
  }, [slug, subdomain])

  // Handle authentication
  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form?.id) {
      toast.error('Form not loaded')
      return
    }

    setIsLoading(true)
    try {
      const formIdToUse = form.id

      if (isLogin) {
        const applicant = await portalAuthClient.login({
          form_id: formIdToUse,
          email,
          password
        })

        setApplicantId(applicant.id)
        setApplicantName(applicant.name || '')

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
            const baseUrl = process.env.NEXT_PUBLIC_GO_API_URL || 'http://localhost:8080/api/v1'
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
          setInitialData(existingData)
          setSubmissionData(existingData)
          setHasExistingSubmission(true)
          setCurrentView('dashboard')
        }

        setIsAuthenticated(true)
        toast.success('Logged in successfully')
      } else {
        const applicant = await portalAuthClient.signup({
          form_id: formIdToUse,
          email,
          password,
          full_name: signupData.name || '',
          data: signupData
        })

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

  // Handle form submission
  const handleFormSubmit = async (formData: Record<string, any>, options?: { saveAndExit?: boolean }) => {
    try {
      if (!form?.id) {
        throw new Error('Form ID not found')
      }
      
      const cleanedFormData = stripBlobUrls(formData)
      const isDraft = options?.saveAndExit === true
      
      const response = await fetch(`${process.env.NEXT_PUBLIC_GO_API_URL || 'http://localhost:8080/api/v1'}/forms/${form.id}/submit`, {
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
        toast.success('Application saved successfully!')
        setCurrentView('dashboard')
        setCurrentFormData({})
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
    await handleFormSubmit(currentFormData, { saveAndExit: true })
  }

  // Handle logout
  const handleLogout = () => {
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
    toast.success('Logged out successfully')
  }

  // Handle continue application
  const handleContinueApplication = () => {
    setCurrentView('application')
    // Set first section as active - use portalConfig which has translated sections
    if (portalConfig.sections && portalConfig.sections.length > 0) {
      const firstSection = portalConfig.sections.find((s: any) => s.sectionType === 'form')
      if (firstSection) {
        setActiveSectionId(firstSection.id)
      } else if (portalConfig.sections[0]) {
        setActiveSectionId(portalConfig.sections[0].id)
      }
    }
  }

  // Handle navigation back to portal home
  const handleBackToPortal = () => {
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
          <AuthPageRenderer
            type={isLogin ? 'login' : 'signup'}
            config={portalConfig}
            email={email}
            password={password}
            signupData={signupData}
            onEmailChange={setEmail}
            onPasswordChange={setPassword}
            onSignupDataChange={setSignupData}
            onSubmit={handleAuth}
            isLoading={isLoading}
          />
        </div>
      </TranslationProvider>
    )
  }

  // Show authenticated portal with navigation
  return (
    <TranslationProvider>
      <div className="min-h-screen bg-gray-50 flex">
        {/* Left Sidebar Navigation */}
        <PortalNavSidebar
          currentView={currentView}
          onViewChange={setCurrentView}
          onBackToPortal={handleBackToPortal}
          showBackButton={currentView === 'application'}
          formName={form?.name || 'Application'}
          themeColor={(portalConfig.settings as any)?.themeColor || '#3B82F6'}
        />

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Top Header */}
          <PortalHeader
            form={form}
            portalConfig={portalConfig}
            applicantName={applicantName}
            onLogout={handleLogout}
            themeColor={(portalConfig.settings as any)?.themeColor || '#3B82F6'}
            supportedLanguages={supportedLanguages}
            activeLanguage={activeLanguage}
            onLanguageChange={setActiveLanguage}
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
                themeColor={(portalConfig.settings as any)?.themeColor || '#3B82F6'}
                applicantId={applicantId || undefined}
                applicantName={applicantName}
                onNameUpdate={(newName) => setApplicantName(newName)}
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
}

function PortalNavSidebar({
  currentView,
  onViewChange,
  onBackToPortal,
  showBackButton,
  formName,
  themeColor
}: PortalNavSidebarProps) {
  const navItems = [
    { id: 'dashboard' as PortalView, label: 'Dashboard', icon: LayoutDashboard },
    { id: 'messages' as PortalView, label: 'Messages', icon: MessageSquare },
    { id: 'tasks' as PortalView, label: 'Tasks', icon: CheckSquare },
    { id: 'application' as PortalView, label: 'Application', icon: FileText },
  ]

  return (
    <aside className="w-64 bg-white border-r border-gray-200 flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center gap-3">
          <div 
            className="w-8 h-8 rounded-lg flex items-center justify-center text-white font-bold"
            style={{ backgroundColor: themeColor }}
          >
            {formName.charAt(0)}
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="font-semibold text-gray-900 truncate text-sm">{formName}</h2>
            <p className="text-xs text-gray-500">Applicant Portal</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto p-2">
        {showBackButton && (
          <button
            onClick={onBackToPortal}
            className="w-full flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-lg text-gray-700 hover:bg-gray-50 mb-2"
          >
            <Home className="w-4 h-4" />
            <span>Portal Home</span>
          </button>
        )}
        
        <div className="space-y-1">
          {navItems.map((item) => {
            const isActive = currentView === item.id
            const Icon = item.icon
            
            return (
              <button
                key={item.id}
                onClick={() => onViewChange(item.id)}
                className={cn(
                  "w-full flex items-center gap-3 px-3 py-2.5 text-sm font-medium rounded-lg transition-colors",
                  isActive
                    ? "bg-blue-50 text-blue-700"
                    : "text-gray-700 hover:bg-gray-50"
                )}
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
}

function PortalHeader({
  form,
  portalConfig,
  applicantName,
  onLogout,
  themeColor,
  supportedLanguages = [],
  activeLanguage,
  onLanguageChange
}: PortalHeaderProps) {
  return (
    <header className="bg-white border-b border-gray-200 px-6 py-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
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
          <span className="font-semibold text-gray-900">{portalConfig.settings.name || form?.name}</span>
        </div>
        
        <div className="flex items-center gap-3">
          {supportedLanguages.length > 1 && activeLanguage && onLanguageChange && (
            <StandaloneLanguageSelector
              activeLanguage={activeLanguage}
              supportedLanguages={supportedLanguages}
              onLanguageChange={onLanguageChange}
            />
          )}
          {applicantName && (
            <span className="text-sm text-gray-600">{applicantName}</span>
          )}
          <Button variant="ghost" size="sm" onClick={onLogout}>
            <LogOut className="w-4 h-4 mr-2" />
            Logout
          </Button>
        </div>
      </div>
    </header>
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
      } catch (error) {
        console.error('Failed to load messages:', error)
        toast.error('Failed to load messages')
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
      } catch (error) {
        console.error('Failed to load tasks:', error)
        toast.error('Failed to load tasks')
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
  onFormDataChange: (data: Record<string, any>) => void
  onSubmit: (data: Record<string, any>, options?: { saveAndExit?: boolean }) => void
  onSaveAndDashboard: () => void
  email: string
  activeSectionId: string
  onSectionChange: (sectionId: string) => void
  sidebarOpen: boolean
  onToggleSidebar: () => void
  supportedLanguages?: string[]
  activeLanguage?: string
  onLanguageChange?: (lang: string) => void
}

function ApplicationView({
  portalConfig,
  form,
  initialData,
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
  onLanguageChange
}: ApplicationViewProps) {
  const sections = portalConfig.sections || []
  const formSections = sections.filter(s => s.sectionType === 'form')

  // Calculate section completion
  const getSectionCompletion = (section: Section): number => {
    if (!initialData) return 0
    const sectionFields = section.fields || []
    if (sectionFields.length === 0) return 100
    
    const filledFields = sectionFields.filter(field => {
      const value = initialData[field.id] || initialData[field.name]
      return value !== undefined && value !== null && value !== ''
    })
    
    return Math.round((filledFields.length / sectionFields.length) * 100)
  }

  const isSectionComplete = (section: Section): boolean => {
    return getSectionCompletion(section) === 100
  }

  return (
    <div className="flex h-full">
      {/* Application Sections Sidebar */}
      <ApplicationSidebar
        sections={formSections.map((s, idx) => ({
          id: s.id,
          title: s.title || `Section ${idx + 1}`,
          icon: undefined
        }))}
        currentSection={formSections.findIndex(s => s.id === activeSectionId)}
        onSectionChange={(idx) => {
          if (formSections[idx]) {
            onSectionChange(formSections[idx].id)
          }
        }}
        getSectionCompletion={(idx) => getSectionCompletion(formSections[idx])}
        isSectionComplete={(idx) => isSectionComplete(formSections[idx])}
        isOpen={sidebarOpen}
        onToggle={onToggleSidebar}
        formName={form?.name || 'Application'}
        formDescription={form?.description}
        isExternal={true}
      />

      {/* Form Content */}
      <div className="flex-1 overflow-auto">
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
