'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  User, GraduationCap, DollarSign, FileText, Trophy, Upload, 
  CheckCircle2, AlertCircle, Save, ChevronRight, ArrowLeft, ArrowRight,
  Calendar as CalendarIcon, Plus, Trash2, GripVertical, Clock,
  LayoutGrid, Mail, Star, Send, Printer, CheckCircle, AlertTriangle, ClipboardCheck, Lightbulb, Info, HelpCircle
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/ui-components/button'
import { Input } from '@/ui-components/input'
import { Label } from '@/ui-components/label'
import { Textarea } from '@/ui-components/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/ui-components/select'
import { Checkbox } from '@/ui-components/checkbox'
import { RadioGroup, RadioGroupItem } from '@/ui-components/radio-group'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/ui-components/card'
import { Separator } from '@/ui-components/separator'
import { Badge } from '@/ui-components/badge'
import { Progress } from '@/ui-components/progress'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/ui-components/tooltip'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/ui-components/dialog'
import { Form, FormField } from '@/types/forms'
import { goClient } from '@/lib/api/go-client'
import { supabase } from '@/lib/supabase'
import { AddressField, AddressValue } from '@/components/Tables/AddressField'
import { FileUploadField } from '@/components/ui/FileUploadField'
import { ProgressHeader } from './ProgressHeader'
import { ApplicationSidebar } from './ApplicationSidebar'
import { toast } from 'sonner'
import { PortalFieldAdapter } from '@/components/Fields/PortalFieldAdapter'
import type { Field as PortalField } from '@/types/portal'
import { getUITranslations } from '@/lib/portal-translations'

// Callout color configurations
const CALLOUT_COLORS: Record<string, { bg: string; border: string; icon: string; title: string; text: string }> = {
  blue: { bg: 'bg-blue-50', border: 'border-blue-200', icon: 'text-blue-600', title: 'text-blue-900', text: 'text-blue-700' },
  green: { bg: 'bg-green-50', border: 'border-green-200', icon: 'text-green-600', title: 'text-green-900', text: 'text-green-700' },
  yellow: { bg: 'bg-yellow-50', border: 'border-yellow-200', icon: 'text-yellow-600', title: 'text-yellow-900', text: 'text-yellow-700' },
  red: { bg: 'bg-red-50', border: 'border-red-200', icon: 'text-red-600', title: 'text-red-900', text: 'text-red-700' },
  purple: { bg: 'bg-purple-50', border: 'border-purple-200', icon: 'text-purple-600', title: 'text-purple-900', text: 'text-purple-700' },
  gray: { bg: 'bg-gray-50', border: 'border-gray-200', icon: 'text-gray-600', title: 'text-gray-900', text: 'text-gray-700' },
}

const CALLOUT_ICONS: Record<string, any> = {
  lightbulb: Lightbulb,
  info: Info,
  warning: AlertTriangle,
  error: AlertCircle,
  success: CheckCircle,
  help: HelpCircle,
}

// Consistent hover/highlight styling for all dropdown items
const SELECT_ITEM_HOVER = 'data-[highlighted]:bg-gray-100 data-[highlighted]:text-gray-900'

// Types
type TabId = string

export interface ApplicationState {
  personal: {
    studentName: string
    preferredName: string
    pronouns: string
    raceEthnicity: string[]
    dob: string
    studentId: string
    cpsEmail: string
    personalEmail: string
    phone: string
    address: { street: string; city: string; state: string; zip: string }
  }
  academic: {
    gpa: string
    testsTaken: boolean
    tests: { id: string; type: 'SAT' | 'ACT'; score: string; date: string }[]
    fullTime: string
    universities: { id: string; name: string }[]
    top3: string[]
  }
  financial: {
    fafsaStatus: string
    pellEligible: string
    efc: string
    firstGen: string
    universityOffers: {
      schoolName: string
      coa: string
      grants: string
      federalGrants: string
      workStudy: string
      loans: string
    }[]
    bestFit: string
    familyContribution: string
    gapExplanation: string
  }
  essays: {
    whyScholarship: string
    challenge: string
    careerGoals: string
  }
  activities: {
    items: {
      id: string
      type: string
      organization: string
      role: string
      dates: string
      hours: string
      description: string
    }[]
    awards: { id: string; name: string; organization: string; date: string }[]
    leadership: string
  }
  documents: {
    recommendation: { status: 'not_requested' | 'requested' | 'received'; recommender: any }
    transcript: { status: 'pending' | 'uploaded'; fileName?: string }
    optional: { status: 'pending' | 'uploaded'; fileName?: string }
  }
}

export const MOCK_APPLICATION_STATE: ApplicationState = {
  personal: {
    studentName: 'Alex Rivera', // Pre-filled
    preferredName: '',
    pronouns: '',
    raceEthnicity: [],
    dob: '',
    studentId: '1234567', // Pre-filled
    cpsEmail: 'arivera@cps.edu', // Pre-filled
    personalEmail: '',
    phone: '',
    address: { street: '', city: 'Chicago', state: 'IL', zip: '' }
  },
  academic: {
    gpa: '',
    testsTaken: false,
    tests: [],
    fullTime: '',
    universities: [],
    top3: ['', '', '']
  },
  financial: {
    fafsaStatus: '',
    pellEligible: '',
    efc: '',
    firstGen: '',
    universityOffers: [],
    bestFit: '',
    familyContribution: '',
    gapExplanation: ''
  },
  essays: {
    whyScholarship: '',
    challenge: '',
    careerGoals: ''
  },
  activities: {
    items: [{ id: '1', type: '', organization: '', role: '', dates: '', hours: '', description: '' }],
    awards: [],
    leadership: ''
  },
  documents: {
    recommendation: { status: 'not_requested', recommender: {} },
    transcript: { status: 'pending' },
    optional: { status: 'pending' }
  }
}

export const EMPTY_APPLICATION_STATE: ApplicationState = {
  personal: {
    studentName: '',
    preferredName: '',
    pronouns: '',
    raceEthnicity: [],
    dob: '',
    studentId: '',
    cpsEmail: '',
    personalEmail: '',
    phone: '',
    address: { street: '', city: '', state: '', zip: '' }
  },
  academic: {
    gpa: '',
    testsTaken: false,
    tests: [],
    fullTime: '',
    universities: [],
    top3: ['', '', '']
  },
  financial: {
    fafsaStatus: '',
    pellEligible: '',
    efc: '',
    firstGen: '',
    universityOffers: [],
    bestFit: '',
    familyContribution: '',
    gapExplanation: ''
  },
  essays: {
    whyScholarship: '',
    challenge: '',
    careerGoals: ''
  },
  activities: {
    items: [{ id: '1', type: '', organization: '', role: '', dates: '', hours: '', description: '' }],
    awards: [],
    leadership: ''
  },
  documents: {
    recommendation: { status: 'not_requested', recommender: {} },
    transcript: { status: 'pending' },
    optional: { status: 'pending' }
  }
}

// Version history entry type
interface VersionEntry {
  date: Date
  data: any
}

export function ApplicationForm({ 
  onBack, 
  onSave,
  initialData, 
  isExternal = false,
  formDefinition,
  userEmail,
  supportedLanguages,
  activeLanguage,
  onLanguageChange
}: { 
  onBack: () => void, 
  onSave?: () => void,
  initialData?: any, 
  isExternal?: boolean,
  formDefinition?: Form | null,
  userEmail?: string,
  supportedLanguages?: string[],
  activeLanguage?: string,
  onLanguageChange?: (lang: string) => void
}) {
  const rawSections = (formDefinition?.settings?.sections as any[]) || []
  const hasFields = (formDefinition?.fields?.length || 0) > 0
  
  // If formDefinition is provided, we treat it as dynamic.
  // If no sections defined but fields exist, create a default section.
  const sections = rawSections.length > 0 
    ? rawSections 
    : (hasFields ? [{ id: 'default', title: 'Form', icon: 'FileText' }] : [])

  const isDynamic = !!formDefinition

  // Add Review tab at the end for both dynamic and static forms
  const baseTabs = isDynamic && sections.length > 0
    ? sections.map(s => ({ id: s.id, title: s.title, icon: FileText }))
    : [
        { id: 'personal', title: 'Personal Info', icon: User },
        { id: 'academic', title: 'Academic Info', icon: GraduationCap },
        { id: 'financial', title: 'Financial Info', icon: DollarSign },
        { id: 'essays', title: 'Essays', icon: FileText },
        { id: 'activities', title: 'Activities', icon: Trophy },
        { id: 'documents', title: 'Documents', icon: Upload },
      ]
  
  const TABS = [...baseTabs, { id: 'review', title: 'Review & Submit', icon: ClipboardCheck }]

  // Get translated UI strings
  const ui = useMemo(() => {
    // Build a minimal config structure for getUITranslations
    const configForTranslations = formDefinition?.settings ? { translations: formDefinition.settings.translations } : {}
    return getUITranslations(configForTranslations, activeLanguage)
  }, [formDefinition?.settings, activeLanguage])

  // Update Review & Submit tab title with translation
  const localizedTabs = useMemo(() => {
    return TABS.map(tab => 
      tab.id === 'review' ? { ...tab, title: ui.reviewAndSubmit || 'Review & Submit' } : tab
    )
  }, [TABS, ui.reviewAndSubmit])

  const [currentSectionIndex, setCurrentSectionIndex] = useState(0)
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [formData, setFormData] = useState<any>(initialData || (isDynamic ? {} : EMPTY_APPLICATION_STATE))
  const [lastSaved, setLastSaved] = useState<Date | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [versionHistory, setVersionHistory] = useState<VersionEntry[]>([])
  const [visitedSections, setVisitedSections] = useState<Set<number>>(new Set([0])) // Track which sections user has advanced past

  const activeTab = TABS[currentSectionIndex]?.id || TABS[0]?.id

  // Create a user-specific storage key to prevent cross-user data leakage
  // Include both form ID and user email to ensure each user has their own saved data
  const storageKey = useMemo(() => {
    const formKey = formDefinition?.id || 'scholarship-application'
    if (userEmail) {
      // Hash the email for privacy while still being unique per user
      return `${formKey}-${btoa(userEmail).replace(/[^a-zA-Z0-9]/g, '')}`
    }
    return formKey
  }, [formDefinition?.id, userEmail])

  // Load saved data and version history on mount
  useEffect(() => {
    const saved = localStorage.getItem(storageKey)
    const savedHistory = localStorage.getItem(`${storageKey}-history`)
    
    if (saved && !initialData) {
      try {
        const data = JSON.parse(saved)
        // Only restore data if it belongs to this user (check _submission_id matches or doesn't exist)
        const savedData = data.formData || data
        // If initialData has a submission ID, only use localStorage data if it matches
        // This prevents loading another user's data
        if (!savedData._submission_id || savedData._submission_id === initialData?._submission_id) {
          setFormData(savedData)
        }
      } catch (e) {
        console.error('Failed to load saved form data:', e)
      }
    }
    
    if (savedHistory) {
      try {
        const history = JSON.parse(savedHistory)
        setVersionHistory(history.map((h: any) => ({ ...h, date: new Date(h.date) })))
      } catch (e) {
        console.error('Failed to load version history:', e)
      }
    }
  }, [storageKey, initialData])

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl/Cmd + S to save version
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault()
        saveVersion()
      }
      
      // Ctrl/Cmd + Right Arrow to go to next section
      if ((e.ctrlKey || e.metaKey) && e.key === 'ArrowRight') {
        e.preventDefault()
        if (currentSectionIndex < TABS.length - 1) {
          setCurrentSectionIndex(currentSectionIndex + 1)
        }
      }
      
      // Ctrl/Cmd + Left Arrow to go to previous section
      if ((e.ctrlKey || e.metaKey) && e.key === 'ArrowLeft') {
        e.preventDefault()
        if (currentSectionIndex > 0) {
          setCurrentSectionIndex(currentSectionIndex - 1)
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [currentSectionIndex, formData])

  // Autosave to localStorage
  useEffect(() => {
    const timer = setTimeout(() => {
      localStorage.setItem(storageKey, JSON.stringify({ formData, lastSaved: new Date().toISOString() }))
    }, 1000)

    return () => clearTimeout(timer)
  }, [formData, storageKey])

  const saveVersion = useCallback(() => {
    const newVersion: VersionEntry = {
      date: new Date(),
      data: { ...formData }
    }
    
    const newHistory = [...versionHistory, newVersion].slice(-10) // Keep last 10 versions
    setVersionHistory(newHistory)
    
    localStorage.setItem(`${storageKey}-history`, JSON.stringify(
      newHistory.map(h => ({ ...h, date: h.date.toISOString() }))
    ))
    
    toast.success('Version saved successfully!')
  }, [formData, versionHistory, storageKey])

  const restoreVersion = useCallback((version: VersionEntry) => {
    setFormData(version.data)
    toast.success(`Restored version from ${version.date.toLocaleString()}`)
  }, [])

  const handleSave = async (exit = false) => {
    setIsSaving(true)
    
    if (formDefinition?.id) {
      try {
        const response = await goClient.post(`/forms/${formDefinition.id}/submit`, {
          data: formData,
          email: userEmail 
        })
        
        // Broadcast update to table view
        if (response) {
          const channel = supabase.channel(`table-realtime-${formDefinition.id}`)
          channel.subscribe((status) => {
            if (status === 'SUBSCRIBED') {
              channel.send({
                type: 'broadcast',
                event: 'table_update',
                payload: {
                  type: 'UPDATE',
                  row: response
                }
              })
              // Cleanup channel after sending
              setTimeout(() => supabase.removeChannel(channel), 1000)
            }
          })
        }
        
        toast.success('Application saved successfully!')
        setLastSaved(new Date())
      } catch (error) {
        console.error('Failed to save:', error)
        toast.error('Failed to save application')
      }
    }

    setIsSaving(false)
    if (exit) {
      if (onSave) {
        onSave()
      } else if (isExternal) {
        window.location.reload()
      } else {
        onBack()
      }
    }
  }

  const updateField = (section: string, field: string, value: any) => {
    if (isDynamic) {
      setFormData((prev: any) => ({
        ...prev,
        [field]: value
      }))
    } else {
      setFormData((prev: any) => ({
        ...prev,
        [section]: {
          ...prev[section],
          [field]: value
        }
      }))
    }
  }

  // Calculate overall progress
  const calculateProgress = useCallback(() => {
    if (isDynamic && formDefinition?.fields) {
      const requiredFields = formDefinition.fields.filter(f => (f.config as any)?.is_required)
      if (requiredFields.length === 0) return 100
      
      const filledFields = requiredFields.filter(f => {
        const val = formData[f.name]
        return val !== undefined && val !== '' && val !== null && (Array.isArray(val) ? val.length > 0 : true)
      })
      
      const progress = Math.round((filledFields.length / requiredFields.length) * 100)
      return progress
    }
    // Simplified progress calculation for static form
    const staticFields = [
      formData?.personal?.studentName,
      formData?.personal?.personalEmail,
      formData?.academic?.gpa,
      formData?.essays?.whyScholarship
    ]
    const filledCount = staticFields.filter(f => f && f !== '').length
    const progress = Math.round((filledCount / staticFields.length) * 100)
    return progress
  }, [formData, formDefinition?.fields, isDynamic])

  // Calculate completion for a specific section
  const getSectionCompletion = useCallback((sectionIndex: number) => {
    const section = TABS[sectionIndex]
    if (!section || section.id === 'review') return 100

    if (isDynamic && formDefinition?.fields) {
      const sectionFields = formDefinition.fields.filter(f => {
        const config = f.config as any
        if (sections.length === 1 && sections[0].id === 'default') return true
        return config?.section_id === section.id
      })
      
      const requiredSectionFields = sectionFields.filter(f => (f.config as any)?.is_required)
      if (requiredSectionFields.length === 0) return 100
      
      const filledFields = requiredSectionFields.filter(f => {
        const val = formData[f.name]
        return val !== undefined && val !== '' && val !== null && (Array.isArray(val) ? val.length > 0 : true)
      })
      
      return Math.round((filledFields.length / requiredSectionFields.length) * 100)
    }
    
    // Static form section completion
    const sectionData = formData?.[section.id]
    if (!sectionData) return 0
    
    const values = Object.values(sectionData).filter(v => v !== undefined && v !== '' && v !== null)
    const total = Object.keys(sectionData).length
    return total > 0 ? Math.round((values.length / total) * 100) : 0
  }, [TABS, formData, formDefinition?.fields, isDynamic, sections])

  const isSectionComplete = useCallback((sectionIndex: number) => {
    // Section is only complete if user has visited it (advanced past it) AND all required fields are filled
    return visitedSections.has(sectionIndex) && getSectionCompletion(sectionIndex) === 100
  }, [getSectionCompletion, visitedSections])

  const goToSection = (index: number) => {
    setCurrentSectionIndex(index)
    // Close sidebar on mobile after navigation
    if (window.innerWidth < 1024) {
      setSidebarOpen(false)
    }
  }

  const nextSection = () => {
    if (currentSectionIndex < TABS.length - 1) {
      // Mark current section as visited when advancing to next
      setVisitedSections(prev => new Set([...prev, currentSectionIndex]))
      setCurrentSectionIndex(currentSectionIndex + 1)
    }
  }

  const prevSection = () => {
    if (currentSectionIndex > 0) {
      setCurrentSectionIndex(currentSectionIndex - 1)
    }
  }

  // Convert TABS to sidebar sections format
  const sidebarSections = TABS.map(tab => ({
    id: tab.id,
    title: tab.title,
    icon: tab.icon
  }))

  return (
    <div className={cn("h-screen flex overflow-hidden", isExternal ? "bg-white" : "bg-gray-50")}>
      {/* Sidebar */}
      <ApplicationSidebar
        sections={sidebarSections}
        currentSection={currentSectionIndex}
        onSectionChange={goToSection}
        getSectionCompletion={getSectionCompletion}
        isSectionComplete={isSectionComplete}
        isOpen={sidebarOpen}
        onToggle={() => setSidebarOpen(!sidebarOpen)}
        formName={formDefinition?.name || 'Scholarship Application'}
        formDescription={formDefinition?.description || undefined}
        helpEmail="support@example.com"
        isExternal={isExternal}
        ui={ui}
      />

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Progress Header */}
        <ProgressHeader
          progress={calculateProgress()}
          isSaving={isSaving}
          lastSaved={lastSaved}
          onSave={saveVersion}
          onSaveAndExit={() => handleSave(true)}
          versionHistory={versionHistory}
          onRestoreVersion={restoreVersion}
          formName={formDefinition?.name}
          isExternal={isExternal}
          supportedLanguages={supportedLanguages}
          activeLanguage={activeLanguage}
          onLanguageChange={onLanguageChange}
        />

        {/* Form Content */}
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            {/* Section Header */}
            <div className="mb-8">
              <h1 className="text-2xl font-bold text-gray-900 mb-2">
                {TABS[currentSectionIndex]?.title}
              </h1>
              <p className="text-gray-600">
                {activeTab === 'review' 
                  ? 'Review your application and submit when ready.'
                  : 'Please fill out all required fields to continue.'
                }
              </p>
            </div>

            <AnimatePresence mode="wait">
              <motion.div
                key={activeTab}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
              >
                <Card className={cn(isExternal ? "border-none shadow-none bg-transparent" : "")}>
                  <CardContent className={cn("space-y-8 pt-6", isExternal ? "px-0" : "")}>
                    {activeTab === 'review' ? (
                      <ReviewSection
                        formData={formData}
                        formDefinition={formDefinition}
                        sections={sections}
                        isDynamic={isDynamic}
                        onSubmit={() => handleSave(true)}
                        onNavigateToSection={(sectionId) => {
                          const idx = TABS.findIndex(t => t.id === sectionId)
                          if (idx >= 0) setCurrentSectionIndex(idx)
                        }}
                        isExternal={isExternal}
                        userEmail={userEmail}
                      />
                    ) : isDynamic ? (
                      <DynamicSection
                        fields={(formDefinition?.fields || []).filter(f => {
                          const config = f.config as any
                          // If we are using the synthesized default section, show all fields
                          if (sections.length === 1 && sections[0].id === 'default') return true
                          return config?.section_id === activeTab
                        })}
                        allFields={formDefinition?.fields || []}
                        data={formData}
                        onChange={(field, value) => updateField(activeTab, field, value)}
                        formId={formDefinition?.id}
                        rootData={formData}
                      />
                    ) : (
                      <>
                        {activeTab === 'personal' && <PersonalSection data={formData.personal} onChange={(f, v) => updateField('personal', f, v)} />}
                        {activeTab === 'academic' && <AcademicSection data={formData.academic} onChange={(f, v) => updateField('academic', f, v)} />}
                        {activeTab === 'financial' && <FinancialSection data={formData.financial} top3Universities={formData.academic.top3} onChange={(f, v) => updateField('financial', f, v)} />}
                        {activeTab === 'essays' && <EssaysSection data={formData.essays} onChange={(f, v) => updateField('essays', f, v)} />}
                        {activeTab === 'activities' && <ActivitiesSection data={formData.activities} onChange={(f, v) => updateField('activities', f, v)} />}
                        {activeTab === 'documents' && <DocumentsSection data={formData.documents} onChange={(f, v) => updateField('documents', f, v)} />}
                      </>
                    )}
                  </CardContent>
                </Card>
              </motion.div>
            </AnimatePresence>

            {/* Navigation Buttons */}
            {activeTab !== 'review' && (
              <div className="flex justify-between mt-8 pt-6 border-t border-gray-200">
                <Button 
                  variant="outline" 
                  onClick={prevSection}
                  disabled={currentSectionIndex === 0}
                >
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  {ui.previous}
                </Button>
                <Button 
                  onClick={nextSection}
                  className={cn(isExternal && "bg-gray-900 hover:bg-gray-800")}
                >
                  {currentSectionIndex === localizedTabs.length - 2 ? ui.reviewApplication : ui.nextSection}
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}


// Section Components

/**
 * DynamicSection - Renders form fields using the unified FieldRenderer system
 * 
 * Uses PortalFieldAdapter to bridge form fields to the unified field rendering.
 * This eliminates duplicated field type switches and ensures consistent rendering.
 */
function DynamicSection({ 
  fields, 
  allFields = [], 
  data, 
  onChange, 
  formId, 
  rootData 
}: { 
  fields: any[]
  allFields?: any[]
  data: any
  onChange: (field: string, value: any) => void
  formId?: string
  rootData?: any
}) {
  // Helper to get column span class based on width
  const getColSpanClass = (width?: string) => {
    const normalizedWidth = width?.toLowerCase?.()?.trim?.()
    
    switch (normalizedWidth) {
      case 'half':
      case '1/2':
      case '50%':
        return 'col-span-12 md:col-span-6'
      case 'third':
      case '1/3':
      case '33%':
        return 'col-span-12 md:col-span-4'
      case 'quarter':
      case '1/4':
      case '25%':
        return 'col-span-12 md:col-span-3'
      case 'full':
      case 'full-width':
      case '100%':
        return 'col-span-12'
      default:
        return 'col-span-12'
    }
  }

  const effectiveRoot = rootData || data

  // Convert form field to portal field format for the adapter
  const convertToPortalField = (field: any): PortalField => {
    return {
      id: field.id || field.name,
      type: field.type,
      label: field.label || field.name,
      placeholder: (field.config as any)?.placeholder,
      description: field.description,
      required: (field.config as any)?.is_required || field.required,
      width: (field.config as any)?.width || 'full',
      options: field.options || (field.config as any)?.items,
      config: field.config,
      children: field.children?.map(convertToPortalField) || (field.config as any)?.children?.map(convertToPortalField),
    }
  }

  return (
    <div className="grid grid-cols-12 gap-4 md:gap-6">
      {fields.map((rawField) => {
        // Ensure name exists (fallback to label for nested fields from config)
        const field = { ...rawField, name: rawField.name || rawField.label }
        const config = field.config || {}
        const layoutWidth = config?.width || 'full'

        // Handle group and repeater types specially since they need recursive rendering
        if (field.type === 'group') {
          const children = field.children || config.children || []
          const groupWidth = config?.width || 'full'
          return (
            <div key={field.id} className={cn("border border-gray-200 p-6 rounded-xl space-y-4 bg-gray-50/30", getColSpanClass(groupWidth))}>
              <h3 className="font-semibold text-lg text-gray-900">{field.label}</h3>
              {config.description && <p className="text-sm text-gray-500">{config.description}</p>}
              <DynamicSection 
                fields={children} 
                allFields={allFields}
                data={data} 
                onChange={onChange}
                formId={formId}
                rootData={rootData || data}
              />
            </div>
          )
        }

        if (field.type === 'repeater') {
          const items = (data[field.name] as any[]) || []
          const children = field.children || config.children || []
          const repeaterWidth = config?.width || 'full'
          return (
            <div key={field.id} className={cn("space-y-4", getColSpanClass(repeaterWidth))}>
              <div className="flex justify-between items-center">
                <div>
                  <Label className="text-base font-medium">{field.label}</Label>
                  {config.description && <p className="text-sm text-gray-500">{config.description}</p>}
                </div>
                <Button size="sm" variant="outline" onClick={() => {
                  const newItem = {} 
                  onChange(field.name, [...items, newItem])
                }}>
                  <Plus className="w-4 h-4 mr-2" /> Add Item
                </Button>
              </div>
              
              {items.length === 0 && (
                <div className="text-center p-8 border-2 border-dashed border-gray-200 rounded-xl text-gray-500 text-sm">
                  No items added yet. Click "Add Item" to start.
                </div>
              )}

              {items.map((item, idx) => (
                <Card key={idx} className="relative overflow-hidden">
                  <div className="absolute top-0 right-0 p-2 z-10">
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="text-red-500 hover:bg-red-50 hover:text-red-600 h-8 w-8 p-0"
                      onClick={() => {
                        const newItems = [...items]
                        newItems.splice(idx, 1)
                        onChange(field.name, newItems)
                      }}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                  <CardContent className="pt-6">
                    <DynamicSection 
                      fields={children}
                      allFields={allFields}
                      data={item}
                      onChange={(childField, childValue) => {
                        const newItems = [...items]
                        newItems[idx] = { ...newItems[idx], [childField]: childValue }
                        onChange(field.name, newItems)
                      }}
                      formId={formId}
                      rootData={rootData || data}
                    />
                  </CardContent>
                </Card>
              ))}
            </div>
          )
        }

        // For all other field types, use the unified PortalFieldAdapter
        const portalField = convertToPortalField(field)
        
        return (
          <div key={field.id} className={cn("space-y-3", getColSpanClass(layoutWidth))}>
            <PortalFieldAdapter
              field={portalField}
              value={data[field.name]}
              onChange={(value) => onChange(field.name, value)}
              formId={formId}
              allFields={allFields.map(convertToPortalField)}
              formData={effectiveRoot}
            />
          </div>
        )
      })}
    </div>
  )
}

// Review Section Component
interface ReviewSectionProps {
  formData: any
  formDefinition?: Form | null
  sections: any[]
  isDynamic: boolean
  onSubmit: () => void
  onNavigateToSection: (sectionId: string) => void
  isExternal?: boolean
  userEmail?: string
}

function ReviewSection({ 
  formData, 
  formDefinition, 
  sections, 
  isDynamic, 
  onSubmit, 
  onNavigateToSection,
  isExternal = false,
  userEmail
}: ReviewSectionProps) {
  const [agreedToTerms, setAgreedToTerms] = useState(false)
  const [agreedToAccuracy, setAgreedToAccuracy] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Generate application number from form data or use a default
  const applicationNumber = formData?._submission_id || formData?.id || `APP-${Date.now().toString(36).toUpperCase()}`
  const submissionDate = formData?._submitted_at 
    ? new Date(formData._submitted_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
    : new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })

  const handlePrint = () => {
    // Create a new window for printing
    const printWindow = window.open('', '_blank')
    if (!printWindow) {
      window.print()
      return
    }

    // Generate print content
    const printContent = generatePrintContent()
    
    printWindow.document.write(printContent)
    printWindow.document.close()
    
    // Wait for content to load then print
    printWindow.onload = () => {
      printWindow.print()
      printWindow.onafterprint = () => printWindow.close()
    }
  }

  const generatePrintContent = () => {
    const formName = formDefinition?.name || 'Application'
    const sectionsByData = getFieldsBySection()
    
    let sectionsHtml = ''
    
    if (isDynamic) {
      sectionsByData.filter(s => s.fields.length > 0).forEach(section => {
        let fieldsHtml = ''
        section.fields
          .filter((f: any) => f.type !== 'group' && f.type !== 'divider' && f.type !== 'paragraph')
          .forEach((field: any) => {
            const value = formatPrintValue(formData[field.name])
            fieldsHtml += `
              <tr>
                <td style="padding: 10px 12px; border-bottom: 1px solid #e5e7eb; color: #6b7280; width: 35%; vertical-align: top;">${field.label}</td>
                <td style="padding: 10px 12px; border-bottom: 1px solid #e5e7eb; color: #111827;">${value}</td>
              </tr>
            `
          })
        
        sectionsHtml += `
          <div style="margin-bottom: 24px; break-inside: avoid;">
            <h2 style="font-size: 16px; font-weight: 600; color: #111827; margin-bottom: 12px; padding-bottom: 8px; border-bottom: 2px solid #e5e7eb;">${section.title}</h2>
            <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
              ${fieldsHtml}
            </table>
          </div>
        `
      })
    } else {
      // Static form sections
      sectionsHtml = `
        <div style="margin-bottom: 24px; break-inside: avoid;">
          <h2 style="font-size: 16px; font-weight: 600; color: #111827; margin-bottom: 12px; padding-bottom: 8px; border-bottom: 2px solid #e5e7eb;">Personal Information</h2>
          <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
            <tr><td style="padding: 10px 12px; border-bottom: 1px solid #e5e7eb; color: #6b7280; width: 35%;">Name</td><td style="padding: 10px 12px; border-bottom: 1px solid #e5e7eb; color: #111827;">${formData.personal?.studentName || 'Not provided'}</td></tr>
            <tr><td style="padding: 10px 12px; border-bottom: 1px solid #e5e7eb; color: #6b7280;">Email</td><td style="padding: 10px 12px; border-bottom: 1px solid #e5e7eb; color: #111827;">${formData.personal?.personalEmail || formData.personal?.cpsEmail || 'Not provided'}</td></tr>
            <tr><td style="padding: 10px 12px; border-bottom: 1px solid #e5e7eb; color: #6b7280;">Phone</td><td style="padding: 10px 12px; border-bottom: 1px solid #e5e7eb; color: #111827;">${formData.personal?.phone || 'Not provided'}</td></tr>
            <tr><td style="padding: 10px 12px; border-bottom: 1px solid #e5e7eb; color: #6b7280;">Date of Birth</td><td style="padding: 10px 12px; border-bottom: 1px solid #e5e7eb; color: #111827;">${formData.personal?.dob || 'Not provided'}</td></tr>
            <tr><td style="padding: 10px 12px; border-bottom: 1px solid #e5e7eb; color: #6b7280;">Student ID</td><td style="padding: 10px 12px; border-bottom: 1px solid #e5e7eb; color: #111827;">${formData.personal?.studentId || 'Not provided'}</td></tr>
          </table>
        </div>
        <div style="margin-bottom: 24px; break-inside: avoid;">
          <h2 style="font-size: 16px; font-weight: 600; color: #111827; margin-bottom: 12px; padding-bottom: 8px; border-bottom: 2px solid #e5e7eb;">Academic Information</h2>
          <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
            <tr><td style="padding: 10px 12px; border-bottom: 1px solid #e5e7eb; color: #6b7280; width: 35%;">GPA</td><td style="padding: 10px 12px; border-bottom: 1px solid #e5e7eb; color: #111827;">${formData.academic?.gpa || 'Not provided'}</td></tr>
            <tr><td style="padding: 10px 12px; border-bottom: 1px solid #e5e7eb; color: #6b7280;">Full-Time Status</td><td style="padding: 10px 12px; border-bottom: 1px solid #e5e7eb; color: #111827;">${formData.academic?.fullTime || 'Not provided'}</td></tr>
            <tr><td style="padding: 10px 12px; border-bottom: 1px solid #e5e7eb; color: #6b7280;">Top Universities</td><td style="padding: 10px 12px; border-bottom: 1px solid #e5e7eb; color: #111827;">${formData.academic?.top3?.filter(Boolean).join(', ') || 'Not provided'}</td></tr>
          </table>
        </div>
        ${formData.essays?.whyScholarship ? `
        <div style="margin-bottom: 24px; break-inside: avoid;">
          <h2 style="font-size: 16px; font-weight: 600; color: #111827; margin-bottom: 12px; padding-bottom: 8px; border-bottom: 2px solid #e5e7eb;">Essays</h2>
          <div style="margin-bottom: 16px;">
            <h3 style="font-size: 13px; font-weight: 500; color: #6b7280; margin-bottom: 8px;">Why do you deserve this scholarship?</h3>
            <p style="font-size: 13px; color: #111827; white-space: pre-wrap; line-height: 1.6;">${formData.essays.whyScholarship}</p>
          </div>
          ${formData.essays?.careerGoals ? `
          <div>
            <h3 style="font-size: 13px; font-weight: 500; color: #6b7280; margin-bottom: 8px;">Career Goals</h3>
            <p style="font-size: 13px; color: #111827; white-space: pre-wrap; line-height: 1.6;">${formData.essays.careerGoals}</p>
          </div>
          ` : ''}
        </div>
        ` : ''}
      `
    }

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <title>${formName} - Application #${applicationNumber}</title>
        <style>
          @page {
            margin: 0.75in;
            size: letter;
          }
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            color: #111827;
            line-height: 1.5;
            margin: 0;
            padding: 0;
          }
          .header {
            border-bottom: 3px solid #111827;
            padding-bottom: 20px;
            margin-bottom: 30px;
          }
          .logo {
            display: flex;
            align-items: center;
            gap: 12px;
            margin-bottom: 16px;
          }
          .logo-box {
            width: 40px;
            height: 40px;
            background: #111827;
            border-radius: 8px;
            display: flex;
            align-items: center;
            justify-content: center;
            color: white;
            font-weight: bold;
            font-size: 20px;
          }
          .app-title {
            font-size: 24px;
            font-weight: 700;
            color: #111827;
          }
          .app-meta {
            display: flex;
            gap: 40px;
            margin-top: 16px;
            font-size: 13px;
          }
          .meta-item {
            display: flex;
            flex-direction: column;
            gap: 2px;
          }
          .meta-label {
            color: #6b7280;
            font-size: 11px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
          }
          .meta-value {
            color: #111827;
            font-weight: 500;
          }
          .footer {
            margin-top: 40px;
            padding-top: 20px;
            border-top: 1px solid #e5e7eb;
            font-size: 11px;
            color: #6b7280;
            text-align: center;
          }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="logo">
            <div class="logo-box">M</div>
            <div class="app-title">${formName}</div>
          </div>
          <div class="app-meta">
            <div class="meta-item">
              <span class="meta-label">Application Number</span>
              <span class="meta-value">${applicationNumber}</span>
            </div>
            <div class="meta-item">
              <span class="meta-label">Date</span>
              <span class="meta-value">${submissionDate}</span>
            </div>
            <div class="meta-item">
              <span class="meta-label">Applicant Email</span>
              <span class="meta-value">${userEmail || formData?.['Personal Email'] || formData?.['CPS email'] || formData?.email || 'N/A'}</span>
            </div>
          </div>
        </div>
        
        ${sectionsHtml}
        
        <div class="footer">
          <p>This document was generated on ${new Date().toLocaleString()} • Powered by Matic Platform</p>
        </div>
      </body>
      </html>
    `
  }

  const formatPrintValue = (value: any): string => {
    if (value === undefined || value === null || value === '') {
      return '<span style="color: #9ca3af; font-style: italic;">Not provided</span>'
    }
    
    if (typeof value === 'boolean') {
      return value ? 'Yes' : 'No'
    }
    
    if (Array.isArray(value)) {
      if (value.length === 0) return '<span style="color: #9ca3af; font-style: italic;">None</span>'
      
      // Handle array of objects (repeaters/groups)
      if (typeof value[0] === 'object' && value[0] !== null) {
        return value.map((item, idx) => {
          const entries = Object.entries(item)
            .filter(([k, v]) => v !== null && v !== undefined && v !== '')
            .map(([k, v]) => `<div style="display: flex; gap: 8px; padding: 4px 0;"><span style="color: #6b7280; min-width: 120px; text-transform: capitalize;">${k.replace(/_/g, ' ')}:</span><span style="color: #111827; font-weight: 500;">${String(v)}</span></div>`)
            .join('')
          return `<div style="background: #f9fafb; padding: 12px; border-radius: 6px; margin-top: 8px; border: 1px solid #e5e7eb;"><div style="font-size: 11px; color: #6b7280; margin-bottom: 6px; text-transform: uppercase; letter-spacing: 0.5px;">Item ${idx + 1}</div>${entries}</div>`
        }).join('')
      }
      
      return value.filter(Boolean).join(', ')
    }
    
    if (typeof value === 'object') {
      // Handle address object - check multiple formats
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
        return parts.join(', ') || '<span style="color: #9ca3af; font-style: italic;">Not provided</span>'
      }
      
      // Handle file objects
      if (value.url || value.name || value.fileName) {
        const displayName = value.name || value.fileName || value.originalName || 'File'
        return `<strong>${displayName}</strong>${value.url ? ` <a href="${value.url}" style="color: #2563eb;">(View)</a>` : ''}`
      }
      
      // For other objects, show formatted
      const entries = Object.entries(value)
        .filter(([k, v]) => v !== null && v !== undefined && v !== '')
        .map(([k, v]) => `<div style="padding: 2px 0;"><span style="color: #6b7280; text-transform: capitalize;">${k.replace(/_/g, ' ')}:</span> ${String(v)}</div>`)
        .join('')
      return entries || '<span style="color: #9ca3af; font-style: italic;">No data</span>'
    }
    
    // Escape HTML and preserve line breaks
    return String(value).replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br>')
  }

  const handleSubmit = async () => {
    // Validate completion before submission
    if (!status.isComplete) {
      toast.error('Please complete all required fields before submitting')
      // Scroll to top to show the completion status banner
      window.scrollTo({ top: 0, behavior: 'smooth' })
      return
    }
    
    if (!agreedToTerms || !agreedToAccuracy) {
      toast.error('Please agree to the terms and certify the accuracy of your information')
      return
    }
    
    setIsSubmitting(true)
    try {
      await onSubmit()
    } catch (error) {
      console.error('Submission error:', error)
      toast.error('Failed to submit application. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  // Calculate completion status
  const getCompletionStatus = () => {
    if (isDynamic && formDefinition?.fields) {
      const requiredFields = formDefinition.fields.filter(f => (f.config as any)?.is_required)
      if (requiredFields.length === 0) return { filledCount: 0, total: 0, isComplete: true, incompleteFields: [] }
      
      const filledFields = requiredFields.filter(f => {
        const val = formData[f.name]
        return val !== undefined && val !== '' && val !== null && (Array.isArray(val) ? val.length > 0 : true)
      })
      
      // Get incomplete fields with their section info
      const incompleteFields = requiredFields.filter(f => {
        const val = formData[f.name]
        return val === undefined || val === '' || val === null || (Array.isArray(val) && val.length === 0)
      }).map(f => {
        const config = f.config as any
        const sectionId = config?.section_id || 'default'
        const section = sections.find(s => s.id === sectionId)
        return {
          ...f,
          sectionId,
          sectionTitle: section?.title || 'Form'
        }
      })
      
      return { 
        filledCount: filledFields.length, 
        total: requiredFields.length, 
        isComplete: filledFields.length === requiredFields.length,
        incompleteFields
      }
    }
    
    // For static forms, check key fields with section info
    const staticFieldDefs = [
      { name: 'studentName', label: 'Name', sectionId: 'personal', sectionTitle: 'Personal Info', value: formData.personal?.studentName },
      { name: 'personalEmail', label: 'Personal Email', sectionId: 'personal', sectionTitle: 'Personal Info', value: formData.personal?.personalEmail },
      { name: 'gpa', label: 'GPA', sectionId: 'academic', sectionTitle: 'Academic Info', value: formData.academic?.gpa },
      { name: 'whyScholarship', label: 'Why Scholarship Essay', sectionId: 'essays', sectionTitle: 'Essays', value: formData.essays?.whyScholarship }
    ]
    const filledCount = staticFieldDefs.filter(f => f.value && f.value !== '').length
    const incompleteFields = staticFieldDefs.filter(f => !f.value || f.value === '')
    return { filledCount, total: staticFieldDefs.length, isComplete: filledCount === staticFieldDefs.length, incompleteFields }
  }

  const status = getCompletionStatus()

  // Group fields by section for display
  const getFieldsBySection = () => {
    if (!isDynamic || !formDefinition?.fields) return []
    
    const fields = formDefinition.fields
    return sections.map(section => {
      const sectionFields = fields.filter(f => {
        const config = f.config as any
        if (sections.length === 1 && sections[0].id === 'default') return true
        return config?.section_id === section.id
      })
      
      // Check which required fields in this section are incomplete
      const requiredFields = sectionFields.filter(f => (f.config as any)?.is_required)
      const incompleteFieldsInSection = requiredFields.filter(f => {
        const val = formData[f.name]
        return val === undefined || val === '' || val === null || (Array.isArray(val) && val.length === 0)
      })
      
      const isComplete = incompleteFieldsInSection.length === 0 && requiredFields.length > 0
      const hasIncomplete = incompleteFieldsInSection.length > 0
      
      return {
        ...section,
        fields: sectionFields,
        incompleteFields: incompleteFieldsInSection,
        isComplete,
        hasIncomplete
      }
    })
  }

  const renderFieldValue = (field: any, value: any): React.ReactNode => {
    if (value === undefined || value === null || value === '') {
      return <span className="text-gray-400 italic">Not provided</span>
    }
    
    if (typeof value === 'boolean') {
      return <span className={value ? 'text-green-600' : 'text-gray-500'}>{value ? 'Yes' : 'No'}</span>
    }
    
    if (Array.isArray(value)) {
      if (value.length === 0) return <span className="text-gray-400 italic">None</span>
      
      // Handle array of objects (repeaters/groups)
      if (typeof value[0] === 'object' && value[0] !== null) {
        // Get child fields from field config if available (for repeaters/groups)
        // Child fields are the subfields defined in the repeater/group field config
        const childFields = field?.config?.children || field?.children || []
        const fieldMap = new Map<string, any>()
        
        // First, prioritize child fields from the repeater/group config (these are the actual subfields)
        if (Array.isArray(childFields)) {
          childFields.forEach((child: any) => {
            if (!child) return
            
            // Map by ID (exact match)
            if (child.id) {
              fieldMap.set(child.id, child)
              // Also map with "Field-" prefix if that's how data is stored
              fieldMap.set(`Field-${child.id}`, child)
            }
            
            // Map by name
            if (child.name) {
              fieldMap.set(child.name, child)
            }
          })
        }
        
        // Fallback: also check all form fields (in case child fields reference other fields)
        if (formDefinition?.fields) {
          formDefinition.fields.forEach((f: any) => {
            if (!f) return
            
            // Only add if not already in map (child fields take priority)
            if (f.id && !fieldMap.has(f.id)) {
              fieldMap.set(f.id, f)
              fieldMap.set(`Field-${f.id}`, f)
            }
            if (f.name && !fieldMap.has(f.name)) {
              fieldMap.set(f.name, f)
            }
          })
        }
        
        return (
          <div className="space-y-3">
            {value.map((item, idx) => (
              <div key={idx} className="bg-gray-50 p-3 rounded-lg border border-gray-200">
                <div className="text-xs text-gray-500 mb-2 uppercase tracking-wide">Item {idx + 1}</div>
                <div className="space-y-1.5">
                  {Object.entries(item)
                    .filter(([k, v]) => {
                      // Filter out system fields like 'id'
                      if (k === 'id' || k.startsWith('_')) return false
                      return v !== null && v !== undefined && v !== ''
                    })
                    .map(([k, v]) => {
                      // Look up field definition to get the label
                      // Try multiple lookup strategies:
                      // 1. Direct key match
                      // 2. Remove "Field-" prefix if present
                      let fieldDef = fieldMap.get(k)
                      
                      if (!fieldDef && k.startsWith('Field-')) {
                        const withoutPrefix = k.replace(/^Field-/, '')
                        fieldDef = fieldMap.get(withoutPrefix)
                      }
                      
                      // Get the label from field definition, or format the key as fallback
                      const fieldLabel = fieldDef?.label || fieldDef?.name
                      
                      let displayLabel: string
                      if (fieldLabel) {
                        // Use the field label directly
                        displayLabel = fieldLabel
                      } else {
                        // Fallback: format the key nicely
                        displayLabel = k
                          .replace(/^Field-/, '')
                          .replace(/_/g, ' ')
                          .replace(/\b\w/g, l => l.toUpperCase())
                          .trim()
                      }
                      
                      return (
                        <div key={k} className="flex gap-2 text-sm">
                          <span className="text-gray-500 capitalize min-w-[120px]">{displayLabel}:</span>
                          <span className="text-gray-900 flex-1 break-words">{String(v)}</span>
                        </div>
                      )
                    })}
                </div>
              </div>
            ))}
          </div>
        )
      }
      
      return value.filter(Boolean).join(', ')
    }
    
    if (typeof value === 'object') {
      // Handle address object - check multiple formats
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
      const isFileLike = value.url || value.path || value.signedUrl || value.mime_type || value.name || value.fileName
      if (isFileLike) {
        const displayName = value.name || value.fileName || value.originalName || 'File'
        const href = value.url || value.signedUrl || value.path
        const size = typeof value.size === 'number' ? `${Math.round(value.size / 1024)} KB` : undefined

        return (
          <div className="space-y-1 text-sm">
            <div className="font-medium text-gray-900 break-words">{displayName}</div>
            {href && (
              <a
                href={href}
                target="_blank"
                rel="noreferrer"
                className="text-blue-600 hover:text-blue-700 break-all text-xs"
              >
                View file
              </a>
            )}
            {(value.mime_type || size) && (
              <div className="text-xs text-gray-500 space-x-2">
                {value.mime_type && <span>{value.mime_type}</span>}
                {size && <span>• {size}</span>}
              </div>
            )}
          </div>
        )
      }

      // For other objects, show formatted
      return (
        <div className="bg-gray-50 p-2 rounded border border-gray-200 text-xs space-y-1">
          {Object.entries(value)
            .filter(([k, v]) => v !== null && v !== undefined && v !== '')
            .map(([k, v]) => (
              <div key={k} className="flex gap-2">
                <span className="text-gray-500 capitalize">{k.replace(/_/g, ' ')}:</span>
                <span className="text-gray-900">{String(v)}</span>
              </div>
            ))}
        </div>
      )
    }
    
    // For long text, truncate
    if (typeof value === 'string' && value.length > 200) {
      return <ExpandableText content={value} />
    }
    
    return String(value)
  }

  const sectionsByData = getFieldsBySection()

  return (
    <div className="space-y-6">
      {/* Completion Status Banner */}
      <div
        className={cn(
          "border rounded-lg p-4",
          status.isComplete
            ? "bg-green-50 border-green-200"
            : "bg-orange-50 border-orange-200"
        )}
      >
        <div className="flex items-start gap-3">
          {status.isComplete ? (
            <CheckCircle className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
          ) : (
            <AlertTriangle className="h-5 w-5 text-orange-600 mt-0.5 flex-shrink-0" />
          )}
          <div className="flex-1">
            <h3 className={cn("font-medium", status.isComplete ? "text-green-900" : "text-orange-900")}>
              {status.isComplete ? "Application Complete!" : "Application Incomplete"}
            </h3>
            <p className={cn("text-sm mt-1", status.isComplete ? "text-green-700" : "text-orange-700")}>
              {status.isComplete
                ? "All required fields have been completed. Review your information below and submit when ready."
                : `${status.filledCount} of ${status.total} required fields completed. Please complete all sections before submitting.`}
            </p>
            
            {/* Missing Required Fields List */}
            {!status.isComplete && status.incompleteFields && status.incompleteFields.length > 0 && (
              <div className="mt-4 pt-3 border-t border-orange-200">
                <h4 className="text-sm font-medium text-orange-900 mb-2">Missing Required Fields:</h4>
                <ul className="space-y-1">
                  {status.incompleteFields.map((field: any, idx: number) => (
                    <li key={field.id || field.name || idx} className="flex items-center gap-2 text-sm">
                      <AlertCircle className="h-3.5 w-3.5 text-orange-500 flex-shrink-0" />
                      <span className="text-orange-800">
                        <strong>{field.label || field.name}</strong>
                        <span className="text-orange-600 ml-1">({field.sectionTitle})</span>
                      </span>
                      <button
                        onClick={() => onNavigateToSection(field.sectionId)}
                        className="text-orange-700 hover:text-orange-900 underline text-xs ml-auto"
                      >
                        Go to section
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Application Summary */}
      <div className="space-y-6 print:space-y-4">
        {isDynamic ? (
          // Dynamic form review
          sectionsByData.filter(s => s.fields.length > 0).map(section => {
            const isSectionIncomplete = section.hasIncomplete || false
            const incompleteFieldIds = new Set((section.incompleteFields || []).map((f: any) => f.id || f.name))
            
            return (
              <div 
                key={section.id}
                className={cn(
                  "border rounded-lg transition-all",
                  isSectionIncomplete 
                    ? "border-orange-300 bg-orange-50/30 shadow-sm" 
                    : "border-gray-200 bg-white"
                )}
              >
                <ReviewSectionCard 
                  title={section.title}
                  onEdit={() => onNavigateToSection(section.id)}
                  isComplete={section.isComplete}
                  hasIncomplete={isSectionIncomplete}
                  incompleteCount={section.incompleteFields?.length || 0}
                >
                  <div className="space-y-4">
                    {section.fields.filter((f: any) => f.type !== 'group' && f.type !== 'divider' && f.type !== 'paragraph').map((field: any) => {
                      const isFieldIncomplete = (field.config as any)?.is_required && incompleteFieldIds.has(field.id || field.name)
                      const fieldValue = formData[field.name]
                      const isEmpty = fieldValue === undefined || fieldValue === null || fieldValue === '' || (Array.isArray(fieldValue) && fieldValue.length === 0)
                      
                      return (
                        <div 
                          key={field.id} 
                          className={cn(
                            "grid grid-cols-3 gap-4 text-sm p-3 rounded-md transition-colors",
                            isFieldIncomplete && isEmpty && "bg-orange-100/50 border border-orange-200"
                          )}
                        >
                          <dt className="text-gray-600 flex items-center gap-2">
                            {field.label}
                            {(field.config as any)?.is_required && (
                              <span className="text-red-500 text-xs">*</span>
                            )}
                            {isFieldIncomplete && isEmpty && (
                              <Badge variant="outline" className="text-xs py-0 px-1.5 h-5 border-orange-300 text-orange-700 bg-orange-50">
                                Required
                              </Badge>
                            )}
                            {!isEmpty && (field.config as any)?.is_required && (
                              <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0" />
                            )}
                          </dt>
                          <dd className={cn(
                            "col-span-2 break-words",
                            isFieldIncomplete && isEmpty ? "text-orange-700 font-medium" : "text-gray-900"
                          )}>
                            {isEmpty && isFieldIncomplete ? (
                              <span className="flex items-center gap-2">
                                <AlertCircle className="w-4 h-4 text-orange-500" />
                                <span className="italic">This field is required</span>
                              </span>
                            ) : (
                              renderFieldValue(field, fieldValue)
                            )}
                          </dd>
                        </div>
                      )
                    })}
                  </div>
                </ReviewSectionCard>
              </div>
            )
          })
        ) : (
          // Static form review
          <>
            <ReviewSectionCard 
              title="Personal Information" 
              onEdit={() => onNavigateToSection('personal')}
              isComplete={status.incompleteFields?.every((f: any) => f.sectionId !== 'personal') && status.incompleteFields?.some((f: any) => f.sectionId === 'personal') === false}
            >
              <InfoRow label="Name" value={formData.personal?.studentName} />
              <InfoRow label="Email" value={formData.personal?.personalEmail || formData.personal?.cpsEmail} />
              <InfoRow label="Phone" value={formData.personal?.phone} />
              <InfoRow label="Date of Birth" value={formData.personal?.dob} />
              <InfoRow label="Student ID" value={formData.personal?.studentId} />
            </ReviewSectionCard>

            <ReviewSectionCard 
              title="Academic Information" 
              onEdit={() => onNavigateToSection('academic')}
              isComplete={status.incompleteFields?.every((f: any) => f.sectionId !== 'academic') && status.incompleteFields?.some((f: any) => f.sectionId === 'academic') === false}
            >
              <InfoRow label="GPA" value={formData.academic?.gpa} />
              <InfoRow label="Full-Time Status" value={formData.academic?.fullTime} />
              <InfoRow label="Top Universities" value={formData.academic?.top3?.filter(Boolean).join(', ')} />
            </ReviewSectionCard>

            <ReviewSectionCard 
              title="Essays" 
              onEdit={() => onNavigateToSection('essays')}
              isComplete={status.incompleteFields?.every((f: any) => f.sectionId !== 'essays') && status.incompleteFields?.some((f: any) => f.sectionId === 'essays') === false}
            >
              {formData.essays?.whyScholarship && (
                <div className="space-y-2">
                  <h4 className="text-sm font-medium text-gray-700">Why do you deserve this scholarship?</h4>
                  <ExpandableText content={formData.essays.whyScholarship} />
                </div>
              )}
              {formData.essays?.careerGoals && (
                <div className="space-y-2 mt-4">
                  <h4 className="text-sm font-medium text-gray-700">Career Goals</h4>
                  <ExpandableText content={formData.essays.careerGoals} />
                </div>
              )}
            </ReviewSectionCard>
          </>
        )}
      </div>

      {/* Certifications */}
      <div className="border border-gray-200 rounded-lg p-6 space-y-4 print:hidden">
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
              of this scholarship program.
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
      <div className="flex gap-3 flex-wrap print:hidden">
        <Button
          size="lg"
          onClick={handleSubmit}
          disabled={!status.isComplete || !agreedToTerms || !agreedToAccuracy || isSubmitting}
          className={cn("flex-1 min-w-[200px]", isExternal && "bg-gray-900 hover:bg-gray-800")}
        >
          {isSubmitting ? (
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

        <Button variant="outline" size="lg" onClick={handlePrint} className="min-w-[180px]">
          <Printer className="h-4 w-4 mr-2" />
          Download PDF
        </Button>
      </div>

      {!status.isComplete && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 print:hidden">
          <p className="text-sm text-amber-800">
            Please complete all required sections before submitting your application. 
            Use the sidebar to navigate to incomplete sections.
          </p>
        </div>
      )}
    </div>
  )
}

// Helper component for review section cards
function ReviewSectionCard({ 
  title, 
  children, 
  onEdit,
  isComplete,
  hasIncomplete,
  incompleteCount
}: { 
  title: string
  children: React.ReactNode
  onEdit?: () => void
  isComplete?: boolean
  hasIncomplete?: boolean
  incompleteCount?: number
}) {
  return (
    <div className="p-6 print:border-0 print:p-4">
      <div className="flex items-center justify-between mb-4 pb-2 border-b">
        <div className="flex items-center gap-3">
          <h3 className="font-medium text-gray-900">{title}</h3>
          {isComplete !== undefined && (
            <div className="flex items-center gap-2">
              {isComplete ? (
                <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                  <CheckCircle className="w-3 h-3 mr-1" />
                  Complete
                </Badge>
              ) : hasIncomplete && incompleteCount ? (
                <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-200">
                  <AlertCircle className="w-3 h-3 mr-1" />
                  {incompleteCount} incomplete
                </Badge>
              ) : null}
            </div>
          )}
        </div>
        {onEdit && (
          <button
            onClick={onEdit}
            className="text-sm text-blue-600 hover:text-blue-700 hover:underline print:hidden flex items-center gap-1"
          >
            <ChevronRight className="w-4 h-4" />
            Edit
          </button>
        )}
      </div>
      <div className="space-y-3">{children}</div>
    </div>
  )
}

// Helper component for info rows
function InfoRow({ label, value }: { label: string; value?: any }) {
  const renderValue = () => {
    if (value === undefined || value === null || value === '') {
      return <span className="text-gray-400 italic">Not provided</span>
    }
    
    if (typeof value === 'boolean') {
      return <span className={value ? 'text-green-600' : 'text-gray-500'}>{value ? 'Yes' : 'No'}</span>
    }
    
    if (Array.isArray(value)) {
      if (value.length === 0) return <span className="text-gray-400 italic">None</span>
      return value.filter(Boolean).join(', ')
    }
    
    if (typeof value === 'object') {
      // Handle address object
      if (value.street || value.city || value.state || value.zip) {
        const parts = [value.street, value.city, value.state, value.zip].filter(Boolean)
        return parts.join(', ') || <span className="text-gray-400 italic">Not provided</span>
      }
      
      // Handle formatted address from AddressField
      if (value.formatted_address) {
        return value.formatted_address
      }
      
      // Handle file objects
      if (value.url || value.name || value.fileName) {
        const displayName = value.name || value.fileName || 'File'
        return <span className="text-blue-600">{displayName}</span>
      }
      
      // Fallback to JSON string
      return <span className="text-gray-400 italic text-xs">Complex data</span>
    }
    
    return String(value)
  }

  return (
    <div className="grid grid-cols-3 gap-4 text-sm">
      <dt className="text-gray-600">{label}</dt>
      <dd className="col-span-2 text-gray-900">{renderValue()}</dd>
    </div>
  )
}

// Helper component for expandable text (essays)
function ExpandableText({ content }: { content: string }) {
  const [expanded, setExpanded] = useState(false)
  
  if (!content) return null

  const preview = content.slice(0, 200)
  const shouldTruncate = content.length > 200

  return (
    <div className="space-y-2">
      <div className="text-sm text-gray-700 whitespace-pre-wrap">
        {expanded || !shouldTruncate ? content : `${preview}...`}
      </div>
      {shouldTruncate && !expanded && (
        <button
          onClick={() => setExpanded(true)}
          className="text-sm text-blue-600 hover:underline print:hidden"
        >
          Read more
        </button>
      )}
    </div>
  )
}

function PersonalSection({ data, onChange }: { data: ApplicationState['personal'], onChange: (field: string, value: any) => void }) {
  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-3">
          <Label className="text-base font-medium">Student Name <span className="text-red-500">*</span></Label>
          <div className="relative">
            <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <Input value={data.studentName} disabled className="bg-gray-50 pl-10 h-11" />
          </div>
        </div>
        <div className="space-y-3">
          <Label className="text-base font-medium">Preferred Name</Label>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Input 
                  value={data.preferredName} 
                  onChange={e => onChange('preferredName', e.target.value)} 
                  placeholder="e.g. Alex"
                  className="h-11"
                />
              </TooltipTrigger>
              <TooltipContent>The name you'd like us to use when addressing you</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
        <div className="space-y-3">
          <Label className="text-base font-medium">Pronouns</Label>
          <Select value={data.pronouns} onValueChange={v => onChange('pronouns', v)}>
            <SelectTrigger className="h-11">
              <SelectValue placeholder="Select pronouns" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="she/her" className={SELECT_ITEM_HOVER}>She/Her</SelectItem>
              <SelectItem value="he/him" className={SELECT_ITEM_HOVER}>He/Him</SelectItem>
              <SelectItem value="they/them" className={SELECT_ITEM_HOVER}>They/Them</SelectItem>
              <SelectItem value="other" className={SELECT_ITEM_HOVER}>Other</SelectItem>
              <SelectItem value="prefer_not_to_say" className={SELECT_ITEM_HOVER}>Prefer not to say</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-3">
          <Label className="text-base font-medium">Date of Birth</Label>
          <div className="relative">
            <CalendarIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <Input type="date" value={data.dob} onChange={e => onChange('dob', e.target.value)} className="pl-10 h-11" />
          </div>
        </div>
        <div className="space-y-3">
          <Label className="text-base font-medium">Student ID <span className="text-red-500">*</span></Label>
          <Input value={data.studentId} disabled className="bg-gray-50 h-11" />
        </div>
        <div className="space-y-3">
          <Label className="text-base font-medium">CPS Email <span className="text-red-500">*</span></Label>
          <Input value={data.cpsEmail} disabled className="bg-gray-50 h-11" />
        </div>
        <div className="space-y-3">
          <Label className="text-base font-medium">Personal Email <span className="text-red-500">*</span></Label>
          <Input 
            value={data.personalEmail} 
            onChange={e => onChange('personalEmail', e.target.value)} 
            placeholder="email@example.com"
            className="h-11"
          />
        </div>
        <div className="space-y-3">
          <Label className="text-base font-medium">Phone Number <span className="text-red-500">*</span></Label>
          <Input 
            value={data.phone} 
            onChange={e => onChange('phone', e.target.value)} 
            placeholder="(555) 555-5555"
            className="h-11"
          />
        </div>
      </div>
      
      <Separator />
      
      <div className="space-y-6">
        <h3 className="font-semibold text-xl text-gray-900">Address</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="md:col-span-2 space-y-3">
            <Label className="text-base font-medium">Street Address</Label>
            <Input 
              value={data.address.street} 
              onChange={e => onChange('address', { ...data.address, street: e.target.value })} 
              className="h-11"
            />
          </div>
          <div className="space-y-3">
            <Label className="text-base font-medium">City</Label>
            <Input 
              value={data.address.city} 
              onChange={e => onChange('address', { ...data.address, city: e.target.value })} 
              className="h-11"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-3">
              <Label className="text-base font-medium">State</Label>
              <Input 
                value={data.address.state} 
                onChange={e => onChange('address', { ...data.address, state: e.target.value })} 
                className="h-11"
              />
            </div>
            <div className="space-y-3">
              <Label className="text-base font-medium">ZIP Code</Label>
              <Input 
                value={data.address.zip} 
                onChange={e => onChange('address', { ...data.address, zip: e.target.value })} 
                className="h-11"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function AcademicSection({ data, onChange }: { data: ApplicationState['academic'], onChange: (field: string, value: any) => void }) {
  return (
    <div className="space-y-8">
      <div className="space-y-4">
        <Label className="text-base font-semibold">GPA Unweighted <span className="text-red-500">*</span></Label>
        <div className="flex items-center gap-4">
          <div className="relative">
            <Input 
              type="number" 
              step="0.01" 
              min="0" 
              max="4.0" 
              className="w-32 pl-4 text-lg font-medium"
              value={data.gpa}
              onChange={e => onChange('gpa', e.target.value)}
            />
          </div>
          <span className="text-sm text-gray-500">Scale 0.00 - 4.00</span>
        </div>
        {parseFloat(data.gpa) < 2.7 && data.gpa !== '' && (
          <div className="bg-red-50 text-red-700 p-3 rounded-lg text-sm flex items-center gap-2 border border-red-100">
            <AlertCircle className="w-4 h-4" />
            Note: Minimum GPA is 2.7 to qualify
          </div>
        )}
      </div>

      <Separator />

      <div className="space-y-4">
        <div className="flex items-center space-x-3 p-4 border rounded-xl bg-gray-50/50 hover:bg-gray-50 transition-colors cursor-pointer" onClick={() => onChange('testsTaken', !data.testsTaken)}>
          <Checkbox 
            id="tests" 
            checked={data.testsTaken}
            onCheckedChange={(c) => onChange('testsTaken', c)}
            className="w-5 h-5"
          />
          <label htmlFor="tests" className="text-base font-medium leading-none cursor-pointer flex-1">
            I have taken the SAT or ACT
          </label>
        </div>

        <AnimatePresence>
          {data.testsTaken && (
            <motion.div 
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="pl-6 space-y-6 border-l-2 border-gray-100 overflow-hidden"
            >
              <div className="space-y-3 pt-2">
                <Label className="text-base font-medium">Test Type</Label>
                <RadioGroup defaultValue="sat" className="grid grid-cols-2 gap-4">
                  <label className="cursor-pointer relative">
                    <RadioGroupItem value="sat" id="sat" className="sr-only" />
                    <div className="border-2 rounded-xl p-4 hover:bg-gray-50 transition-all [&:has(:checked)]:border-blue-600 [&:has(:checked)]:bg-blue-50/50 text-center">
                      <span className="font-bold text-lg">SAT</span>
                    </div>
                  </label>
                  <label className="cursor-pointer relative">
                    <RadioGroupItem value="act" id="act" className="sr-only" />
                    <div className="border-2 rounded-xl p-4 hover:bg-gray-50 transition-all [&:has(:checked)]:border-blue-600 [&:has(:checked)]:bg-blue-50/50 text-center">
                      <span className="font-bold text-lg">ACT</span>
                    </div>
                  </label>
                </RadioGroup>
              </div>
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label>Score</Label>
                  <Input type="number" placeholder="e.g. 1200" className="h-11" />
                </div>
                <div className="space-y-2">
                  <Label>Test Date</Label>
                  <Input type="month" className="h-11" />
                </div>
              </div>
              <Button variant="outline" size="sm" className="gap-2">
                <Plus className="w-4 h-4" /> Add Another Test
              </Button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <Separator />

      <div className="space-y-4">
        <Label className="text-base font-semibold">Are you planning to attend school full-time? <span className="text-red-500">*</span></Label>
        <RadioGroup value={data.fullTime} onValueChange={v => onChange('fullTime', v)} className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            { value: 'yes', label: 'Yes', desc: 'Full course load' },
            { value: 'no', label: 'No', desc: 'Part-time study' },
            { value: 'unsure', label: 'Not sure yet', desc: 'Undecided' }
          ].map((option) => (
            <label key={option.value} className="cursor-pointer relative">
              <RadioGroupItem value={option.value} id={`ft-${option.value}`} className="sr-only" />
              <div className={cn(
                "border-2 rounded-xl p-4 hover:bg-gray-50 transition-all h-full flex flex-col items-center justify-center text-center gap-1",
                data.fullTime === option.value ? "border-blue-600 bg-blue-50/50" : "border-gray-200"
              )}>
                <span className={cn("font-bold", data.fullTime === option.value ? "text-blue-700" : "text-gray-900")}>{option.label}</span>
                <span className="text-xs text-gray-500">{option.desc}</span>
                {data.fullTime === option.value && (
                  <div className="absolute top-3 right-3 text-blue-600">
                    <CheckCircle2 className="w-4 h-4" />
                  </div>
                )}
              </div>
            </label>
          ))}
        </RadioGroup>
      </div>

      <div className="space-y-4">
        <Label className="text-base font-semibold">Universities Applied To</Label>
        <div className="space-y-3">
          {data.universities.map((uni, idx) => (
            <div key={idx} className="flex gap-3 animate-in slide-in-from-left-4 duration-300">
              <div className="flex-1 relative">
                <GraduationCap className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input 
                  value={uni.name} 
                  className="pl-10 h-11"
                  placeholder="University Name"
                  onChange={e => {
                    const newUnis = [...data.universities]
                    newUnis[idx].name = e.target.value
                    onChange('universities', newUnis)
                  }} 
                />
              </div>
            </div>
          ))}
        </div>
        <Button 
          variant="outline" 
          size="sm" 
          onClick={() => onChange('universities', [...data.universities, { id: Date.now().toString(), name: '' }])}
          className="mt-2"
        >
          <Plus className="w-4 h-4 mr-2" /> Add University
        </Button>
      </div>

      <Separator />

      <div className="space-y-6">
        <Label className="text-base font-semibold">Rank your Top 3 Universities <span className="text-red-500">*</span></Label>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[0, 1, 2].map((rank) => (
            <div key={rank} className="space-y-3 relative group">
              <div className="absolute -left-3 -top-3 w-8 h-8 bg-gray-900 text-white rounded-full flex items-center justify-center font-bold text-sm z-10 shadow-sm border-2 border-white">
                {rank + 1}
              </div>
              <div className="bg-gray-50 p-4 rounded-xl border border-gray-200 pt-6 group-hover:border-gray-300 transition-colors">
                <Label className="text-xs text-gray-500 uppercase font-semibold mb-2 block">Choice #{rank + 1}</Label>
                <Select 
                  value={data.top3[rank]} 
                  onValueChange={v => {
                    const newTop3 = [...data.top3]
                    newTop3[rank] = v
                    onChange('top3', newTop3)
                  }}
                >
                  <SelectTrigger className="bg-white border-gray-200">
                    <SelectValue placeholder="Select university" />
                  </SelectTrigger>
                  <SelectContent>
                    {data.universities.filter(u => u.name).map(u => (
                      <SelectItem key={u.id} value={u.name} disabled={data.top3.includes(u.name) && data.top3[rank] !== u.name} className={SELECT_ITEM_HOVER}>
                        {u.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function FinancialSection({ data, top3Universities, onChange }: { data: ApplicationState['financial'], top3Universities: string[], onChange: (field: string, value: any) => void }) {
  const [step, setStep] = useState(1)

  // Initialize offers based on Top 3 if empty
  useEffect(() => {
    if (data.universityOffers.length === 0 && top3Universities.some(u => u)) {
      const initialOffers = top3Universities.filter(u => u).map(u => ({
        schoolName: u,
        coa: '',
        grants: '',
        federalGrants: '',
        workStudy: '',
        loans: ''
      }))
      onChange('universityOffers', initialOffers)
    }
  }, [top3Universities])

  const updateOffer = (index: number, field: string, value: string) => {
    const newOffers = [...data.universityOffers]
    // @ts-ignore
    newOffers[index][field] = value
    onChange('universityOffers', newOffers)
  }

  const calculateOutOfPocket = (offer: any) => {
    const coa = parseFloat(offer.coa) || 0
    const grants = parseFloat(offer.grants) || 0
    const federal = parseFloat(offer.federalGrants) || 0
    return Math.max(0, coa - (grants + federal))
  }

  return (
    <div className="space-y-8">
      {/* Stepper */}
      <div className="flex items-center justify-between px-2 sm:px-8 relative">
        {[1, 2, 3].map((s) => (
          <div key={s} className="flex flex-col items-center gap-2 relative z-10">
            <div 
              className={cn(
                "w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm transition-colors",
                step === s ? "bg-blue-600 text-white" : 
                step > s ? "bg-green-500 text-white" : "bg-gray-100 text-gray-400"
              )}
            >
              {step > s ? <CheckCircle2 className="w-5 h-5" /> : s}
            </div>
            <span className={cn("text-xs font-medium hidden sm:block", step === s ? "text-blue-600" : "text-gray-500")}>
              {s === 1 ? 'FAFSA' : s === 2 ? 'Offers' : 'Reflection'}
            </span>
          </div>
        ))}
        {/* Connecting Line */}
        <div className="absolute left-0 right-0 top-4 h-0.5 bg-gray-100 -z-0 mx-8 sm:mx-12" />
      </div>

      {step === 1 && (
        <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-300">
          <div className="space-y-6">
            <h3 className="font-semibold text-xl text-gray-900">FAFSA & Eligibility</h3>
            <div className="space-y-4">
              <Label className="text-base font-semibold">FAFSA Status <span className="text-red-500">*</span></Label>
              <RadioGroup value={data.fafsaStatus} onValueChange={v => onChange('fafsaStatus', v)} className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {[
                  { value: 'completed', label: 'Completed', icon: CheckCircle2, color: 'text-green-600', bg: 'bg-green-50' },
                  { value: 'in_progress', label: 'In Progress', icon: Clock, color: 'text-yellow-600', bg: 'bg-yellow-50' },
                  { value: 'not_started', label: 'Not Started', icon: AlertCircle, color: 'text-gray-400', bg: 'bg-gray-50' }
                ].map((option) => {
                  const Icon = option.icon
                  const isSelected = data.fafsaStatus === option.value
                  return (
                    <label key={option.value} className="cursor-pointer relative">
                      <RadioGroupItem value={option.value} id={`f-${option.value}`} className="sr-only" />
                      <div className={cn(
                        "border-2 rounded-xl p-4 hover:bg-gray-50 transition-all h-full flex flex-col items-center justify-center text-center gap-3",
                        isSelected ? "border-blue-600 bg-blue-50/50" : "border-gray-200"
                      )}>
                        <div className={cn("w-10 h-10 rounded-full flex items-center justify-center", option.bg)}>
                          <Icon className={cn("w-5 h-5", option.color)} />
                        </div>
                        <span className={cn("font-bold", isSelected ? "text-blue-700" : "text-gray-900")}>{option.label}</span>
                        {isSelected && (
                          <div className="absolute top-3 right-3 text-blue-600">
                            <CheckCircle2 className="w-4 h-4" />
                          </div>
                        )}
                      </div>
                    </label>
                  )
                })}
              </RadioGroup>
              {data.fafsaStatus === 'not_started' && (
                <div className="bg-yellow-50 text-yellow-800 p-4 rounded-xl text-sm flex items-start gap-3 border border-yellow-100">
                  <AlertCircle className="w-5 h-5 mt-0.5 shrink-0" />
                  <div>
                    <p className="font-medium">Action Recommended</p>
                    <p>We recommend completing FAFSA before submitting your application to maximize your aid opportunities. <a href="#" className="underline font-medium hover:text-yellow-900">Visit FAFSA website</a></p>
                  </div>
                </div>
              )}
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-3">
                <Label className="text-base font-semibold">Are you eligible for Pell Grant?</Label>
                <Select value={data.pellEligible} onValueChange={v => onChange('pellEligible', v)}>
                  <SelectTrigger className="h-12 text-base"><SelectValue placeholder="Select..." /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="yes" className={SELECT_ITEM_HOVER}>Yes</SelectItem>
                    <SelectItem value="no" className={SELECT_ITEM_HOVER}>No</SelectItem>
                    <SelectItem value="unsure" className={SELECT_ITEM_HOVER}>Not sure yet</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-3">
                <Label className="text-base font-semibold">EFC / SAI</Label>
                <div className="relative">
                  <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <Input 
                    type="number" 
                    placeholder="0" 
                    value={data.efc} 
                    onChange={e => onChange('efc', e.target.value)} 
                    className="pl-10 h-12 text-base"
                  />
                </div>
              </div>
            </div>
          </div>
          <div className="flex justify-end pt-4">
            <Button onClick={() => setStep(2)} size="lg" className="px-8">Next: Financial Offers <ArrowRight className="w-4 h-4 ml-2" /></Button>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
          <div className="space-y-4">
            <h3 className="font-medium text-gray-900">University Financial Offers</h3>
            <p className="text-sm text-gray-500">Enter the financial aid details for your top 3 schools.</p>
            
            {data.universityOffers.map((offer, idx) => (
              <Card key={idx} className="overflow-hidden">
                <CardHeader className="bg-gray-50 py-3">
                  <CardTitle className="text-sm font-bold text-gray-700">{offer.schoolName || `School ${idx + 1}`}</CardTitle>
                </CardHeader>
                <CardContent className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <Label className="text-xs">Cost of Attendance (COA)</Label>
                    <div className="relative">
                      <DollarSign className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-400" />
                      <Input className="pl-6 h-8 text-sm" type="number" value={offer.coa} onChange={e => updateOffer(idx, 'coa', e.target.value)} />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Grants/Scholarships</Label>
                    <div className="relative">
                      <DollarSign className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-400" />
                      <Input className="pl-6 h-8 text-sm" type="number" value={offer.grants} onChange={e => updateOffer(idx, 'grants', e.target.value)} />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Federal/State Grants</Label>
                    <div className="relative">
                      <DollarSign className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-400" />
                      <Input className="pl-6 h-8 text-sm" type="number" value={offer.federalGrants} onChange={e => updateOffer(idx, 'federalGrants', e.target.value)} />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Loans Offered</Label>
                    <div className="relative">
                      <DollarSign className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-400" />
                      <Input className="pl-6 h-8 text-sm" type="number" value={offer.loans} onChange={e => updateOffer(idx, 'loans', e.target.value)} />
                    </div>
                  </div>
                  <div className="col-span-1 sm:col-span-2 pt-2 border-t border-gray-100 flex justify-between items-center">
                    <span className="text-sm font-medium text-gray-600">Est. Out-of-Pocket:</span>
                    <span className={cn("font-bold text-lg", calculateOutOfPocket(offer) > 10000 ? "text-red-600" : "text-green-600")}>
                      ${calculateOutOfPocket(offer).toLocaleString()}
                    </span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
          <div className="flex justify-between">
            <Button variant="outline" onClick={() => setStep(1)}>Back</Button>
            <Button onClick={() => setStep(3)}>Next: Reflection</Button>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
          <div className="space-y-4">
            <h3 className="font-medium text-gray-900">Financial Reflection</h3>
            <div className="space-y-2">
              <Label>Given these numbers, which school do you feel is the best financial fit, and why?</Label>
              <Textarea 
                value={data.bestFit} 
                onChange={e => onChange('bestFit', e.target.value)} 
                className="h-32"
              />
              <p className="text-xs text-gray-500 text-right">{data.bestFit.split(' ').length} / 300 words</p>
            </div>
            <div className="space-y-2">
              <Label>What is your family's ability to contribute per year?</Label>
              <div className="relative max-w-xs">
                <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input 
                  className="pl-9" 
                  type="number" 
                  value={data.familyContribution} 
                  onChange={e => onChange('familyContribution', e.target.value)} 
                />
              </div>
            </div>
          </div>
          <div className="flex justify-between">
            <Button variant="outline" onClick={() => setStep(2)}>Back</Button>
          </div>
        </div>
      )}
    </div>
  )
}

function EssaysSection({ data, onChange }: { data: ApplicationState['essays'], onChange: (field: string, value: any) => void }) {
  return (
    <div className="space-y-10">
      <div className="space-y-4">
        <div className="flex justify-between items-start">
          <Label className="text-lg font-semibold text-gray-900">Why are you applying for the In The Game Scholarship? <span className="text-red-500">*</span></Label>
          <span className="text-xs font-medium text-gray-500 bg-gray-100 px-2 py-1 rounded">Required</span>
        </div>
        <p className="text-sm text-gray-500 leading-relaxed">Tell us about your goals, why this scholarship matters to you, and how it connects to your journey. Be specific about your financial need and academic aspirations.</p>
        <div className="relative">
          <Textarea 
            value={data.whyScholarship} 
            onChange={e => onChange('whyScholarship', e.target.value)} 
            className="min-h-[200px] p-4 text-base leading-relaxed resize-y"
            placeholder="Start typing your essay here..."
          />
          <div className="absolute bottom-3 right-3 text-xs text-gray-400 bg-white/80 backdrop-blur px-2 py-1 rounded border border-gray-100">
            {data.whyScholarship.split(/\s+/).filter(Boolean).length} / 500 words
          </div>
        </div>
      </div>

      <Separator />

      <div className="space-y-4">
        <div className="flex justify-between items-start">
          <Label className="text-lg font-semibold text-gray-900">Describe a challenge you've overcome and what you learned from it. <span className="text-red-500">*</span></Label>
          <span className="text-xs font-medium text-gray-500 bg-gray-100 px-2 py-1 rounded">Required</span>
        </div>
        <p className="text-sm text-gray-500 leading-relaxed">This could be academic, personal, or social. Focus on your resilience and growth.</p>
        <div className="relative">
          <Textarea 
            value={data.challenge} 
            onChange={e => onChange('challenge', e.target.value)} 
            className="min-h-[200px] p-4 text-base leading-relaxed resize-y"
            placeholder="Start typing your essay here..."
          />
          <div className="absolute bottom-3 right-3 text-xs text-gray-400 bg-white/80 backdrop-blur px-2 py-1 rounded border border-gray-100">
            {data.challenge.split(/\s+/).filter(Boolean).length} words
          </div>
        </div>
      </div>

      <Separator />

      <div className="space-y-4">
        <div className="flex justify-between items-start">
          <Label className="text-lg font-semibold text-gray-900">What are your career goals and how will this scholarship help you achieve them? <span className="text-red-500">*</span></Label>
          <span className="text-xs font-medium text-gray-500 bg-gray-100 px-2 py-1 rounded">Required</span>
        </div>
        <div className="relative">
          <Textarea 
            value={data.careerGoals} 
            onChange={e => onChange('careerGoals', e.target.value)} 
            className="min-h-[200px] p-4 text-base leading-relaxed resize-y"
            placeholder="Start typing your essay here..."
          />
          <div className="absolute bottom-3 right-3 text-xs text-gray-400 bg-white/80 backdrop-blur px-2 py-1 rounded border border-gray-100">
            {data.careerGoals.split(/\s+/).filter(Boolean).length} words
          </div>
        </div>
      </div>
    </div>
  )
}

function ActivitiesSection({ data, onChange }: { data: ApplicationState['activities'], onChange: (field: string, value: any) => void }) {
  return (
    <div className="space-y-8">
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <div>
            <h3 className="font-semibold text-xl text-gray-900">Activities & Involvement</h3>
            <p className="text-gray-500 text-sm mt-1">List your extracurricular activities, community service, and work experience.</p>
          </div>
          <Button onClick={() => {
            onChange('items', [...data.items, { id: Date.now().toString(), type: '', organization: '', role: '', dates: '', hours: '', description: '' }])
          }}>
            <Plus className="w-4 h-4 mr-2" /> Add Activity
          </Button>
        </div>

        <div className="space-y-6">
          {data.items.map((item, idx) => (
            <Card key={item.id} className="overflow-hidden border-gray-200 shadow-sm hover:shadow-md transition-shadow">
              <CardHeader className="bg-gray-50/50 border-b border-gray-100 py-4">
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold text-sm">
                      {idx + 1}
                    </div>
                    <h4 className="font-semibold text-gray-900">Activity Details</h4>
                  </div>
                  <Button variant="ghost" size="sm" className="text-red-500 hover:text-red-600 hover:bg-red-50" onClick={() => {
                    const newItems = data.items.filter(i => i.id !== item.id)
                    onChange('items', newItems)
                  }}>
                    <Trash2 className="w-4 h-4 mr-2" /> Remove
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="p-6 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-3">
                    <Label className="text-base font-medium">Activity Type</Label>
                    <Select value={item.type} onValueChange={v => {
                      const newItems = [...data.items]
                      newItems[idx].type = v
                      onChange('items', newItems)
                    }}>
                      <SelectTrigger className="h-11"><SelectValue placeholder="Select type" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="club" className={SELECT_ITEM_HOVER}>School Club / Organization</SelectItem>
                        <SelectItem value="sport" className={SELECT_ITEM_HOVER}>Athletics / Sports Team</SelectItem>
                        <SelectItem value="arts" className={SELECT_ITEM_HOVER}>Arts / Music / Theater</SelectItem>
                        <SelectItem value="volunteer" className={SELECT_ITEM_HOVER}>Community Service / Volunteer</SelectItem>
                        <SelectItem value="work" className={SELECT_ITEM_HOVER}>Employment / Internship</SelectItem>
                        <SelectItem value="other" className={SELECT_ITEM_HOVER}>Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-3">
                    <Label className="text-base font-medium">Organization / Team Name</Label>
                    <Input 
                      value={item.organization} 
                      className="h-11"
                      placeholder="e.g. Debate Club, Varsity Soccer"
                      onChange={e => {
                        const newItems = [...data.items]
                        newItems[idx].organization = e.target.value
                        onChange('items', newItems)
                      }} 
                    />
                  </div>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-3">
                    <Label className="text-base font-medium">Role / Position</Label>
                    <Input 
                      value={item.role} 
                      className="h-11"
                      placeholder="e.g. President, Member, Captain"
                      onChange={e => {
                        const newItems = [...data.items]
                        newItems[idx].role = e.target.value
                        onChange('items', newItems)
                      }} 
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-3">
                      <Label className="text-base font-medium">Dates</Label>
                      <Input 
                        value={item.dates} 
                        className="h-11"
                        placeholder="e.g. 2021 - Present"
                        onChange={e => {
                          const newItems = [...data.items]
                          newItems[idx].dates = e.target.value
                          onChange('items', newItems)
                        }} 
                      />
                    </div>
                    <div className="space-y-3">
                      <Label className="text-base font-medium">Hours/Week</Label>
                      <Input 
                        value={item.hours} 
                        className="h-11"
                        placeholder="e.g. 5"
                        onChange={e => {
                          const newItems = [...data.items]
                          newItems[idx].hours = e.target.value
                          onChange('items', newItems)
                        }} 
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  <Label className="text-base font-medium">Description & Impact</Label>
                  <Textarea 
                    value={item.description} 
                    className="min-h-[100px] resize-y"
                    placeholder="Describe your responsibilities, achievements, and the impact you made..."
                    onChange={e => {
                      const newItems = [...data.items]
                      newItems[idx].description = e.target.value
                      onChange('items', newItems)
                    }} 
                  />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  )
}

function DocumentsSection({ data, onChange }: { data: ApplicationState['documents'], onChange: (field: string, value: any) => void }) {
  const [isRequestOpen, setIsRequestOpen] = useState(false)
  const [recommenderForm, setRecommenderForm] = useState({ name: '', email: '', role: '', school: '' })

  const handleRequestSubmit = () => {
    onChange('recommendation', { 
      status: 'requested', 
      recommender: recommenderForm 
    })
    setIsRequestOpen(false)
  }

  const completedCount = [
    data.recommendation.status !== 'not_requested',
    data.transcript.status === 'uploaded',
    data.optional.status === 'uploaded'
  ].filter(Boolean).length

  return (
    <div className="space-y-8">
      {/* Dashboard Header */}
      <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-100 rounded-2xl p-6 sm:p-8 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 shadow-sm">
        <div>
          <h3 className="font-bold text-blue-900 text-xl">Application Checklist</h3>
          <p className="text-blue-700 text-sm mt-1">Complete all required items to submit your application.</p>
        </div>
        <div className="text-right bg-white/50 backdrop-blur px-6 py-3 rounded-xl border border-blue-100 w-full sm:w-auto flex justify-between sm:block items-center">
          <div className="text-3xl font-bold text-blue-900">{completedCount} / 3</div>
          <div className="text-xs font-bold text-blue-600 uppercase tracking-wide mt-1">Items Complete</div>
        </div>
      </div>

      <div className="flex items-center gap-3 text-sm text-red-700 font-medium bg-red-50 p-4 rounded-xl border border-red-100">
        <Clock className="w-5 h-5" />
        <span>Deadline: <span className="font-bold">10 days remaining</span> (Due Nov 30)</span>
      </div>

      <div className="grid gap-6">
        {/* Recommendation Letter */}
        <Card className={cn("transition-all border-l-4", 
          data.recommendation.status === 'received' ? "border-l-green-500 border-gray-200 bg-green-50/10" : 
          data.recommendation.status === 'requested' ? "border-l-yellow-500 border-gray-200" : "border-l-gray-300 border-gray-200"
        )}>
          <CardContent className="p-6 flex flex-col sm:flex-row items-start gap-6">
            <div className={cn(
              "w-12 h-12 rounded-full flex items-center justify-center shrink-0 shadow-sm",
              data.recommendation.status === 'not_requested' ? "bg-gray-100 text-gray-400" :
              data.recommendation.status === 'requested' ? "bg-yellow-100 text-yellow-600" :
              "bg-green-100 text-green-600"
            )}>
              {data.recommendation.status === 'received' ? <CheckCircle2 className="w-6 h-6" /> : <User className="w-6 h-6" />}
            </div>
            <div className="flex-1 space-y-4">
              <div className="flex justify-between items-start">
                <div>
                  <h4 className="font-bold text-gray-900 text-lg">Letter of Recommendation</h4>
                  <p className="text-sm text-gray-500 mt-1">Required from a teacher, counselor, or coach who knows you well.</p>
                </div>
                <Badge className={cn("px-3 py-1", 
                  data.recommendation.status === 'received' ? "bg-green-100 text-green-700 hover:bg-green-100" : 
                  data.recommendation.status === 'requested' ? "bg-yellow-100 text-yellow-700 hover:bg-yellow-100" : "bg-gray-100 text-gray-700 hover:bg-gray-100"
                )}>
                  {data.recommendation.status === 'not_requested' ? 'Not Requested' :
                   data.recommendation.status === 'requested' ? 'Requested' : 'Received'}
                </Badge>
              </div>

              <div>
                {data.recommendation.status === 'not_requested' ? (
                  <Dialog open={isRequestOpen} onOpenChange={setIsRequestOpen}>
                    <DialogTrigger asChild>
                      <Button className="gap-2">
                        <User className="w-4 h-4" /> Request Letter
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Request Recommendation</DialogTitle>
                      </DialogHeader>
                      <div className="space-y-4 py-4">
                        <div className="space-y-2">
                          <Label>Recommender Name</Label>
                          <Input value={recommenderForm.name} onChange={e => setRecommenderForm({...recommenderForm, name: e.target.value})} />
                        </div>
                        <div className="space-y-2">
                          <Label>Email Address</Label>
                          <Input value={recommenderForm.email} onChange={e => setRecommenderForm({...recommenderForm, email: e.target.value})} />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label>Role/Title</Label>
                            <Input value={recommenderForm.role} onChange={e => setRecommenderForm({...recommenderForm, role: e.target.value})} placeholder="e.g. Teacher" />
                          </div>
                          <div className="space-y-2">
                            <Label>School/Org</Label>
                            <Input value={recommenderForm.school} onChange={e => setRecommenderForm({...recommenderForm, school: e.target.value})} />
                          </div>
                        </div>
                      </div>
                      <DialogFooter>
                        <Button onClick={handleRequestSubmit}>Send Request</Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                ) : (
                  <div className="text-sm text-gray-600 bg-gray-50 p-4 rounded-xl border border-gray-200 flex justify-between items-center">
                    <div>
                      <span className="font-medium text-gray-900">Request sent to:</span> {data.recommendation.recommender.name} ({data.recommendation.recommender.email})
                    </div>
                    <Button variant="link" size="sm" className="h-auto p-0 text-blue-600 font-medium">Resend Reminder</Button>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Transcript */}
        <Card className={cn("transition-all border-l-4", 
          data.transcript.status === 'uploaded' ? "border-l-green-500 border-gray-200 bg-green-50/10" : "border-l-gray-300 border-gray-200"
        )}>
          <CardContent className="p-6 flex flex-col sm:flex-row items-start gap-6">
            <div className={cn(
              "w-12 h-12 rounded-full flex items-center justify-center shrink-0 shadow-sm",
              data.transcript.status === 'pending' ? "bg-gray-100 text-gray-400" : "bg-green-100 text-green-600"
            )}>
              {data.transcript.status === 'uploaded' ? <CheckCircle2 className="w-6 h-6" /> : <FileText className="w-6 h-6" />}
            </div>
            <div className="flex-1 space-y-4">
              <div className="flex justify-between items-start">
                <div>
                  <h4 className="font-bold text-gray-900 text-lg">Official Transcript</h4>
                  <p className="text-sm text-gray-500 mt-1">Must include grades from 9th grade through current semester.</p>
                </div>
                <Badge className={cn("px-3 py-1", 
                  data.transcript.status === 'uploaded' ? "bg-green-100 text-green-700 hover:bg-green-100" : "bg-gray-100 text-gray-700 hover:bg-gray-100"
                )}>
                  {data.transcript.status === 'uploaded' ? 'Uploaded' : 'Not Uploaded'}
                </Badge>
              </div>

              <div>
                {data.transcript.status === 'pending' ? (
                  <div 
                    onClick={() => onChange('transcript', { status: 'uploaded', fileName: 'transcript_2025.pdf' })}
                    className="border-2 border-dashed border-gray-200 rounded-xl p-8 text-center hover:bg-gray-50 hover:border-blue-300 transition-all cursor-pointer group bg-gray-50/50"
                  >
                    <div className="w-12 h-12 bg-white rounded-full shadow-sm flex items-center justify-center mx-auto mb-3 group-hover:scale-110 transition-transform">
                      <Upload className="w-6 h-6 text-gray-400 group-hover:text-blue-500" />
                    </div>
                    <p className="text-base text-gray-900 font-medium">Click to upload PDF</p>
                    <p className="text-sm text-gray-500 mt-1">Max file size 5MB</p>
                  </div>
                ) : (
                  <div className="flex items-center justify-between bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-red-50 rounded-lg flex items-center justify-center">
                        <FileText className="w-5 h-5 text-red-500" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-900">{data.transcript.fileName}</p>
                        <p className="text-xs text-gray-500">Uploaded just now</p>
                      </div>
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => onChange('transcript', { status: 'pending' })} className="text-red-500 hover:text-red-600 hover:bg-red-50">
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
