'use client'

import { useState, useEffect, useCallback } from 'react'
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
  userEmail
}: { 
  onBack: () => void, 
  onSave?: () => void,
  initialData?: any, 
  isExternal?: boolean,
  formDefinition?: Form | null,
  userEmail?: string
}) {
  const rawSections = (formDefinition?.settings?.sections as any[]) || []
  const hasFields = (formDefinition?.fields?.length || 0) > 0
  
  // Debug logging
  console.log('ApplicationForm Debug:', {
    formDefinition: formDefinition ? { id: formDefinition.id, name: formDefinition.name, fieldsCount: formDefinition.fields?.length } : null,
    rawSections,
    hasFields
  })
  
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

  const [currentSectionIndex, setCurrentSectionIndex] = useState(0)
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [formData, setFormData] = useState<any>(initialData || (isDynamic ? {} : EMPTY_APPLICATION_STATE))
  const [lastSaved, setLastSaved] = useState<Date | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [versionHistory, setVersionHistory] = useState<VersionEntry[]>([])

  const activeTab = TABS[currentSectionIndex]?.id || TABS[0]?.id

  // Load saved data and version history on mount
  useEffect(() => {
    const storageKey = formDefinition?.id || 'scholarship-application'
    const saved = localStorage.getItem(storageKey)
    const savedHistory = localStorage.getItem(`${storageKey}-history`)
    
    if (saved && !initialData) {
      try {
        const data = JSON.parse(saved)
        setFormData(data.formData || data)
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
  }, [formDefinition?.id, initialData])

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
    const storageKey = formDefinition?.id || 'scholarship-application'
    const timer = setTimeout(() => {
      localStorage.setItem(storageKey, JSON.stringify({ formData, lastSaved: new Date().toISOString() }))
    }, 1000)

    return () => clearTimeout(timer)
  }, [formData, formDefinition?.id])

  const saveVersion = useCallback(() => {
    const newVersion: VersionEntry = {
      date: new Date(),
      data: { ...formData }
    }
    
    const newHistory = [...versionHistory, newVersion].slice(-10) // Keep last 10 versions
    setVersionHistory(newHistory)
    
    const storageKey = formDefinition?.id || 'scholarship-application'
    localStorage.setItem(`${storageKey}-history`, JSON.stringify(
      newHistory.map(h => ({ ...h, date: h.date.toISOString() }))
    ))
    
    toast.success('Version saved successfully!')
  }, [formData, versionHistory, formDefinition?.id])

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
      } catch (error) {
        console.error('Failed to save:', error)
        toast.error('Failed to save application')
      }
    }

    setTimeout(() => {
      setLastSaved(new Date())
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
    }, 800)
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
      if (process.env.NODE_ENV === 'development') {
        console.log('📊 Progress Calculation:', {
          requiredFields: requiredFields.length,
          filledFields: filledFields.length,
          progress
        })
      }
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
    if (process.env.NODE_ENV === 'development') {
      console.log('📊 Progress Calculation (static):', { filledCount, total: staticFields.length, progress })
    }
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
    return getSectionCompletion(sectionIndex) === 100
  }, [getSectionCompletion])

  const goToSection = (index: number) => {
    setCurrentSectionIndex(index)
    // Close sidebar on mobile after navigation
    if (window.innerWidth < 1024) {
      setSidebarOpen(false)
    }
  }

  const nextSection = () => {
    if (currentSectionIndex < TABS.length - 1) {
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
                  Previous
                </Button>
                <Button 
                  onClick={nextSection}
                  className={cn(isExternal && "bg-gray-900 hover:bg-gray-800")}
                >
                  {currentSectionIndex === TABS.length - 2 ? 'Review Application' : 'Next Section'}
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

function DynamicSection({ fields, allFields = [], data, onChange, formId, rootData }: { fields: any[], allFields?: any[], data: any, onChange: (field: string, value: any) => void, formId?: string, rootData?: any }) {
  // Helper to get column span class based on width
  const getColSpanClass = (width?: string) => {
    // Normalize the width value
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

  // Normalize mixed option shapes into consistent value/label pairs
  const normalizeOptions = (rawOptions?: any[]) => {
    return (rawOptions || [])
      .map((opt) => {
        if (opt === undefined || opt === null) return null

        if (typeof opt === 'string' || typeof opt === 'number' || typeof opt === 'boolean') {
          const str = String(opt).trim()
          if (!str) return null
          return { value: str, label: str }
        }

        if (typeof opt === 'object') {
          const value = opt.value ?? opt.id ?? opt.key ?? opt.name ?? opt.label ?? opt.title ?? opt.text
          const label = opt.label ?? opt.name ?? opt.title ?? opt.text ?? value

          const valueStr = value !== undefined && value !== null ? String(value) : ''
          const labelStr = label !== undefined && label !== null ? String(label) : valueStr
          const finalValue = valueStr || labelStr

          if (!finalValue.trim()) return null
          return { value: finalValue, label: labelStr || finalValue }
        }

        return null
      })
      .filter(Boolean) as { value: string; label: string }[]
  }

  const effectiveRoot = rootData || data

  return (
    <div className="grid grid-cols-12 gap-4 md:gap-6">
      {fields.map((rawField) => {
        // Ensure name exists (fallback to label for nested fields from config)
        const field = { ...rawField, name: rawField.name || rawField.label }
        const config = field.config || {}
        const isRequired = config.is_required
        
        if (field.type === 'group') {
           // Children can be in field.children (from portal editor) or config.children (from backend)
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
           // Children can be in field.children (from portal editor) or config.children (from backend)
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

        // Layout fields (heading, paragraph, callout, divider) don't need a label wrapper
        const isLayoutField = ['heading', 'paragraph', 'callout', 'divider'].includes(field.type)
        
        // Get layout width from config (not field.width which is pixel width)
        const layoutWidth = config?.width || 'full'

        return (
          <div key={field.id} className={cn("space-y-3", getColSpanClass(layoutWidth))}>
            {!isLayoutField && (
              <Label className="text-base font-medium">
                {field.label} {isRequired && <span className="text-red-500">*</span>}
              </Label>
            )}
            
            {field.type === 'text' && (
              <Input 
                value={data[field.name] || ''} 
                onChange={e => onChange(field.name, e.target.value)}
                placeholder={config.placeholder}
                className="h-11"
              />
            )}
            
            {field.type === 'textarea' && (
              <Textarea 
                value={data[field.name] || ''} 
                onChange={e => onChange(field.name, e.target.value)}
                placeholder={config.placeholder}
                className="min-h-[120px]"
              />
            )}
            
            {field.type === 'email' && (
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <Input 
                  type="email"
                  value={data[field.name] || ''} 
                  onChange={e => onChange(field.name, e.target.value)}
                  placeholder={config.placeholder}
                  className="pl-10 h-11"
                />
              </div>
            )}
            
            {field.type === 'number' && (
              <Input 
                type="number"
                value={data[field.name] || ''} 
                onChange={e => onChange(field.name, e.target.value)}
                placeholder={config.placeholder}
                className="h-11"
              />
            )}
            
            {field.type === 'date' && (
              <div className="relative">
                <CalendarIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <Input 
                  type="date"
                  value={data[field.name] || ''} 
                  onChange={e => onChange(field.name, e.target.value)}
                  className="pl-10 h-11"
                />
              </div>
            )}
            
            {field.type === 'select' && (() => {
              // Try config.items first (from backend), then field.options (from API)
              let options = normalizeOptions(config.items)
              if (options.length === 0 && field.options && field.options.length > 0) {
                options = normalizeOptions(field.options)
              }
              
              // Support fetching options from another field (e.g. repeater)
              if (config.sourceField) {
                let sourceData = data[config.sourceField]
                if (!sourceData && effectiveRoot) {
                  sourceData = effectiveRoot[config.sourceField]
                }
                
                // If not found by key, try to find field by ID and use its name
                if (!sourceData && allFields) {
                   const sourceFieldDef = allFields.find((f: any) => f.id === config.sourceField)
                   if (sourceFieldDef) {
                       sourceData = data[sourceFieldDef.name || sourceFieldDef.label]
                       if (!sourceData && effectiveRoot) {
                         sourceData = effectiveRoot[sourceFieldDef.name || sourceFieldDef.label]
                       }
                   }
                }

                if (sourceData && Array.isArray(sourceData)) {
                  const key = config.sourceKey || 'name'
                  const dynamicOptions = sourceData
                    .map((item: any) => {
                      if (typeof item === 'object' && item !== null) {
                        return item[key]
                      }
                      return String(item)
                    })
                    .filter((val: string) => val && val.trim() !== '')
                  
                  if (dynamicOptions.length > 0) {
                    options = normalizeOptions(dynamicOptions)
                  }
                }
              }

              const currentValue = data[field.name] || ''
              if (process.env.NODE_ENV === 'development') {
                console.log(`📋 Select field [${field.name}]:`, {
                  options,
                  currentValue,
                  hasConfigItems: (config.items || []).length,
                  hasFieldOptions: (field.options || []).length,
                  isSourceField: !!config.sourceField
                })
              }
              
              return (
                <Select value={String(currentValue)} onValueChange={v => onChange(field.name, v)}>
                  <SelectTrigger className="h-11">
                    <SelectValue placeholder={config.placeholder || "Select..."} />
                  </SelectTrigger>
                  <SelectContent>
                    {options && options.length > 0 ? (
                      options.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                      ))
                    ) : (
                      <div className="px-2 py-1.5 text-sm text-gray-500">No options available</div>
                    )}
                  </SelectContent>
                </Select>
              )
            })()}

            {field.type === 'url' && (
              <Input 
                type="url"
                value={data[field.name] || ''} 
                onChange={e => onChange(field.name, e.target.value)}
                placeholder={config.placeholder || "https://..."}
                className="h-11"
              />
            )}

            {field.type === 'phone' && (
              <Input 
                type="tel"
                value={data[field.name] || ''} 
                onChange={e => onChange(field.name, e.target.value)}
                placeholder={config.placeholder || "(555) 555-5555"}
                className="h-11"
              />
            )}

            {field.type === 'address' && (
              <AddressField
                value={data[field.name] as AddressValue | null}
                onChange={(addressValue) => onChange(field.name, addressValue)}
                placeholder={config.placeholder || 'Start typing an address...'}
                isTableCell={false}
              />
            )}

            {field.type === 'checkbox' && (
               <div className="flex items-center space-x-2 p-2 border rounded-md">
                 <Checkbox 
                   id={field.id} 
                   checked={!!data[field.name]}
                   onCheckedChange={(checked) => onChange(field.name, checked)}
                 />
                 <label htmlFor={field.id} className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer">
                   {config.label || field.label}
                 </label>
               </div>
            )}

            {field.type === 'radio' && (() => {
               // Try config.items first (from backend), then field.options (from API)
               let options = normalizeOptions(config.items)
               if (options.length === 0 && field.options && field.options.length > 0) {
                 options = normalizeOptions(field.options)
               }
               
               if (config.sourceField) {
                 let sourceData = data[config.sourceField]
                 if (!sourceData && effectiveRoot) {
                   sourceData = effectiveRoot[config.sourceField]
                 }
                 
                 // If not found by key, try to find field by ID and use its name
                 if (!sourceData && allFields) {
                    const sourceFieldDef = allFields.find((f: any) => f.id === config.sourceField)
                    if (sourceFieldDef) {
                        sourceData = data[sourceFieldDef.name || sourceFieldDef.label]
                        if (!sourceData && effectiveRoot) {
                          sourceData = effectiveRoot[sourceFieldDef.name || sourceFieldDef.label]
                        }
                    }
                 }

                 if (sourceData && Array.isArray(sourceData)) {
                   const key = config.sourceKey || 'name'
                   const dynamicOptions = sourceData
                     .map((item: any) => {
                       if (typeof item === 'object' && item !== null) {
                         return item[key]
                       }
                       return String(item)
                     })
                     .filter((val: string) => val && val.trim() !== '')
                   
                   if (dynamicOptions.length > 0) {
                     options = normalizeOptions(dynamicOptions)
                   }
                 }
               }

               return (
                 <RadioGroup value={data[field.name]} onValueChange={(val) => onChange(field.name, val)} className="space-y-2">
                   {options.map((item) => (
                     <div key={item.value} className="flex items-center space-x-2">
                       <RadioGroupItem value={item.value} id={`${field.id}-${item.value}`} />
                       <Label htmlFor={`${field.id}-${item.value}`} className="cursor-pointer">{item.label}</Label>
                     </div>
                   ))}
                 </RadioGroup>
               )
            })()}

            {field.type === 'rank' && (() => {
              // Start with items from config, then fallback to explicit field.options
              let options = normalizeOptions(config.items)
              if (options.length === 0 && field.options && field.options.length > 0) {
                options = normalizeOptions(field.options)
              }
               
               if (config.sourceField) {
                 let sourceData = data[config.sourceField]
                 if (!sourceData && effectiveRoot) {
                   sourceData = effectiveRoot[config.sourceField]
                 }
                 
                 // If not found by key, try to find field by ID and use its name
                 if (!sourceData && allFields) {
                    const sourceFieldDef = allFields.find((f: any) => f.id === config.sourceField)
                    if (sourceFieldDef) {
                        sourceData = data[sourceFieldDef.name || sourceFieldDef.label]
                        if (!sourceData && effectiveRoot) {
                          sourceData = effectiveRoot[sourceFieldDef.name || sourceFieldDef.label]
                        }
                    }
                 }

                 if (sourceData && Array.isArray(sourceData)) {
                   const key = config.sourceKey || 'name'
                   const dynamicOptions = sourceData
                     .map((item: any) => {
                       if (typeof item === 'object' && item !== null) {
                         // Try to find the value using the key, or fallback to first string property
                         if (item[key]) return item[key]
                         const firstString = Object.values(item).find(v => typeof v === 'string')
                         return firstString || JSON.stringify(item)
                       }
                       return String(item)
                     })
                     .filter((val: string) => val && val.trim() !== '')
                   
                   if (dynamicOptions.length > 0) {
                     options = normalizeOptions(dynamicOptions)
                   }
                 }
               }

               const maxSelections = config.maxSelections || 3
               const currentValues = (Array.isArray(data[field.name]) ? data[field.name].map((v: any) => String(v)) : []) as string[]

               return (
                 <div className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      {Array.from({ length: maxSelections }).map((_, index) => (
                        <div key={index} className="space-y-3 relative group">
                          <div className="absolute -left-3 -top-3 w-8 h-8 bg-gray-900 text-white rounded-full flex items-center justify-center font-bold text-sm z-10 shadow-sm border-2 border-white">
                            {index + 1}
                          </div>
                          <div className="bg-gray-50 p-4 rounded-xl border border-gray-200 pt-6 group-hover:border-gray-300 transition-colors">
                            <Label className="text-xs text-gray-500 uppercase font-semibold mb-2 block">Choice #{index + 1}</Label>
                            <Select 
                              value={String(currentValues[index] || '')} 
                              onValueChange={v => {
                                const newValues = [...currentValues]
                                // Fill empty slots if needed
                                while (newValues.length < maxSelections) newValues.push('')
                                newValues[index] = v
                                onChange(field.name, newValues)
                              }}
                            >
                              <SelectTrigger className="bg-white border-gray-200">
                                <SelectValue placeholder="Select option" />
                              </SelectTrigger>
                              <SelectContent>
                                {options && options.length > 0 ? (
                                  options.map((opt) => (
                                    <SelectItem 
                                      key={opt.value} 
                                      value={opt.value} 
                                      disabled={currentValues.includes(opt.value) && currentValues[index] !== opt.value}
                                    >
                                      {opt.label}
                                    </SelectItem>
                                  ))
                                ) : (
                                  <div className="px-2 py-1.5 text-sm text-gray-500">No options available</div>
                                )}
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                      ))}
                    </div>
                 </div>
               )
            })()}

            {/* Multiselect - Multiple options can be selected */}
            {field.type === 'multiselect' && (() => {
               // Try config.items first (from backend), then field.options (from API)
               let options = normalizeOptions(config.items)
               if (options.length === 0 && field.options && field.options.length > 0) {
                 options = normalizeOptions(field.options)
               }
               const currentValues = (Array.isArray(data[field.name]) ? data[field.name] : []).map((v: any) => String(v)) as string[]

               return (
                 <div className="space-y-2">
                   {options.map((opt) => (
                     <div key={opt.value} className="flex items-center space-x-2 p-2 border rounded-md hover:bg-gray-50">
                       <Checkbox 
                         id={`${field.id}-${opt.value}`}
                         checked={currentValues.includes(opt.value)}
                         onCheckedChange={(checked) => {
                           if (checked) {
                             onChange(field.name, [...currentValues, opt.value])
                           } else {
                             onChange(field.name, currentValues.filter(v => v !== opt.value))
                           }
                         }}
                       />
                       <label htmlFor={`${field.id}-${opt.value}`} className="text-sm font-medium leading-none cursor-pointer flex-1">
                         {opt.label}
                       </label>
                     </div>
                   ))}
                 </div>
               )
            })()}

            {/* Datetime - Combined date and time picker */}
            {field.type === 'datetime' && (
              <div className="grid grid-cols-2 gap-4">
                <div className="relative">
                  <CalendarIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <Input 
                    type="date"
                    value={data[field.name]?.split('T')[0] || ''} 
                    onChange={e => {
                      const time = data[field.name]?.split('T')[1] || '00:00'
                      onChange(field.name, `${e.target.value}T${time}`)
                    }}
                    className="pl-10 h-11"
                  />
                </div>
                <div className="relative">
                  <Clock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <Input 
                    type="time"
                    value={data[field.name]?.split('T')[1] || ''} 
                    onChange={e => {
                      const date = data[field.name]?.split('T')[0] || new Date().toISOString().split('T')[0]
                      onChange(field.name, `${date}T${e.target.value}`)
                    }}
                    className="pl-10 h-11"
                  />
                </div>
              </div>
            )}

            {/* Time - Time only picker */}
            {field.type === 'time' && (
              <div className="relative">
                <Clock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <Input 
                  type="time"
                  value={data[field.name] || ''} 
                  onChange={e => onChange(field.name, e.target.value)}
                  className="pl-10 h-11"
                />
              </div>
            )}

            {/* File Upload */}
            {(field.type === 'file' || field.type === 'image') && (
              <FileUploadField
                value={data[field.name]}
                onChange={(files) => onChange(field.name, files)}
                imageOnly={field.type === 'image'}
                multiple={config.multiple}
                maxFiles={config.maxFiles || 5}
                storagePath={`submissions/${formId || 'unknown'}/`}
              />
            )}

            {/* Callout / Spotlight Box */}
            {field.type === 'callout' && (() => {
              const colorKey = (config.color as string) || 'blue'
              const colors = CALLOUT_COLORS[colorKey] || CALLOUT_COLORS.blue
              const iconKey = (config.icon as string) || 'lightbulb'
              const CalloutIcon = CALLOUT_ICONS[iconKey] || Lightbulb
              
              return (
                <div className={cn("flex items-start gap-3 p-4 border rounded-lg", colors.bg, colors.border)}>
                  <CalloutIcon className={cn("w-5 h-5 mt-0.5 shrink-0", colors.icon)} />
                  <div>
                    <p className={cn("text-sm font-medium", colors.title)}>{field.label}</p>
                    {config.description && (
                      <p className={cn("text-sm mt-1", colors.text)}>{config.description}</p>
                    )}
                  </div>
                </div>
              )
            })()}

            {/* Rating - Star rating */}
            {field.type === 'rating' && (() => {
               const maxRating = config.maxRating || 5
               const currentValue = data[field.name] || 0

               return (
                 <div className="flex items-center gap-1">
                   {Array.from({ length: maxRating }).map((_, idx) => (
                     <button
                       key={idx}
                       type="button"
                       onClick={() => onChange(field.name, idx + 1)}
                       className="p-1 transition-colors"
                     >
                       <Star 
                         className={`w-8 h-8 ${idx < currentValue ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'}`} 
                       />
                     </button>
                   ))}
                   <span className="ml-2 text-sm text-gray-500">{currentValue} / {maxRating}</span>
                 </div>
               )
            })()}

            {/* Heading - Display only */}
            {field.type === 'heading' && (
              <h3 className="text-xl font-semibold text-gray-900">{field.label}</h3>
            )}

            {/* Paragraph - Display only (supports rich text) */}
            {field.type === 'paragraph' && (() => {
              const content = config.content || field.label
              const isRichText = /<[a-z][\s\S]*>/i.test(content)
              return isRichText ? (
                <div 
                  className="prose prose-sm max-w-none text-gray-600 [&_a]:text-blue-600 [&_a]:underline [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5"
                  dangerouslySetInnerHTML={{ __html: content }}
                />
              ) : (
                <p className="text-gray-600">{content}</p>
              )
            })()}

            {/* Divider - Visual separator */}
            {field.type === 'divider' && (
              <hr className="border-gray-200 my-4" />
            )}
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
      
      // Handle array of objects (repeaters)
      if (typeof value[0] === 'object') {
        return value.map((item, idx) => {
          const entries = Object.entries(item)
            .map(([k, v]) => `<strong>${k.replace(/_/g, ' ')}:</strong> ${String(v)}`)
            .join(', ')
          return `<div style="background: #f9fafb; padding: 8px; border-radius: 4px; margin-top: 4px;">${entries}</div>`
        }).join('')
      }
      
      return value.join(', ')
    }
    
    if (typeof value === 'object') {
      // Handle address object
      if (value.street || value.city) {
        const parts = [value.street, value.city, value.state, value.zip].filter(Boolean)
        return parts.join(', ') || '<span style="color: #9ca3af; font-style: italic;">Not provided</span>'
      }
      
      // Handle formatted address from AddressField
      if (value.formatted_address) {
        return value.formatted_address
      }
      
      return JSON.stringify(value)
    }
    
    // Escape HTML and preserve line breaks
    return String(value).replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br>')
  }

  const handleSubmit = async () => {
    if (!agreedToTerms || !agreedToAccuracy) return
    
    setIsSubmitting(true)
    await new Promise(resolve => setTimeout(resolve, 1500))
    onSubmit()
    setIsSubmitting(false)
  }

  // Calculate completion status
  const getCompletionStatus = () => {
    if (isDynamic && formDefinition?.fields) {
      const requiredFields = formDefinition.fields.filter(f => (f.config as any)?.is_required)
      if (requiredFields.length === 0) return { filledCount: 0, total: 0, isComplete: true }
      
      const filledFields = requiredFields.filter(f => {
        const val = formData[f.name]
        return val !== undefined && val !== '' && val !== null && (Array.isArray(val) ? val.length > 0 : true)
      })
      
      return { 
        filledCount: filledFields.length, 
        total: requiredFields.length, 
        isComplete: filledFields.length === requiredFields.length,
        incompleteFields: requiredFields.filter(f => {
          const val = formData[f.name]
          return val === undefined || val === '' || val === null || (Array.isArray(val) && val.length === 0)
        })
      }
    }
    
    // For static forms, just check some key fields
    const staticFields = [
      formData.personal?.studentName,
      formData.personal?.personalEmail,
      formData.academic?.gpa,
      formData.essays?.whyScholarship
    ]
    const filledCount = staticFields.filter(f => f && f !== '').length
    return { filledCount, total: staticFields.length, isComplete: filledCount === staticFields.length }
  }

  const status = getCompletionStatus()

  // Group fields by section for display
  const getFieldsBySection = () => {
    if (!isDynamic || !formDefinition?.fields) return []
    
    const fields = formDefinition.fields
    return sections.map(section => ({
      ...section,
      fields: fields.filter(f => {
        const config = f.config as any
        if (sections.length === 1 && sections[0].id === 'default') return true
        return config?.section_id === section.id
      })
    }))
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
      
      // Handle array of objects (repeaters)
      if (typeof value[0] === 'object') {
        return (
          <div className="space-y-2 mt-2">
            {value.map((item, idx) => (
              <div key={idx} className="bg-gray-50 p-3 rounded-lg text-sm">
                {Object.entries(item).map(([k, v]) => (
                  <div key={k} className="flex gap-2">
                    <span className="text-gray-500 capitalize">{k.replace(/_/g, ' ')}:</span>
                    <span className="text-gray-900 break-words">{String(v)}</span>
                  </div>
                ))}
              </div>
            ))}
          </div>
        )
      }
      
      return value.join(', ')
    }
    
    if (typeof value === 'object') {
      // Handle address object
      if (value.street || value.city) {
        const parts = [value.street, value.city, value.state, value.zip].filter(Boolean)
        return parts.join(', ') || <span className="text-gray-400 italic">Not provided</span>
      }
      
      // Handle formatted address from AddressField
      if (value.formatted_address) {
        return value.formatted_address
      }
      
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
                className="text-blue-600 hover:text-blue-700 break-all"
              >
                {href}
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

      return (
        <pre className="text-xs bg-gray-50 text-gray-700 rounded-md p-3 border border-gray-200 overflow-x-auto whitespace-pre-wrap break-words">
          {JSON.stringify(value, null, 2)}
        </pre>
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
          </div>
        </div>
      </div>

      {/* Application Summary */}
      <div className="space-y-6 print:space-y-4">
        {isDynamic ? (
          // Dynamic form review
          sectionsByData.filter(s => s.fields.length > 0).map(section => (
            <ReviewSectionCard 
              key={section.id} 
              title={section.title}
              onEdit={() => onNavigateToSection(section.id)}
            >
              <div className="space-y-4">
                {section.fields.filter((f: any) => f.type !== 'group' && f.type !== 'divider' && f.type !== 'paragraph').map((field: any) => (
                  <div key={field.id} className="grid grid-cols-3 gap-4 text-sm">
                    <dt className="text-gray-600">{field.label}</dt>
                    <dd className="col-span-2 text-gray-900 break-words">{renderFieldValue(field, formData[field.name])}</dd>
                  </div>
                ))}
              </div>
            </ReviewSectionCard>
          ))
        ) : (
          // Static form review
          <>
            <ReviewSectionCard title="Personal Information" onEdit={() => onNavigateToSection('personal')}>
              <InfoRow label="Name" value={formData.personal?.studentName} />
              <InfoRow label="Email" value={formData.personal?.personalEmail || formData.personal?.cpsEmail} />
              <InfoRow label="Phone" value={formData.personal?.phone} />
              <InfoRow label="Date of Birth" value={formData.personal?.dob} />
              <InfoRow label="Student ID" value={formData.personal?.studentId} />
            </ReviewSectionCard>

            <ReviewSectionCard title="Academic Information" onEdit={() => onNavigateToSection('academic')}>
              <InfoRow label="GPA" value={formData.academic?.gpa} />
              <InfoRow label="Full-Time Status" value={formData.academic?.fullTime} />
              <InfoRow label="Top Universities" value={formData.academic?.top3?.filter(Boolean).join(', ')} />
            </ReviewSectionCard>

            <ReviewSectionCard title="Essays" onEdit={() => onNavigateToSection('essays')}>
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

        <Button variant="outline" size="lg" onClick={handlePrint}>
          <Printer className="h-4 w-4 mr-2" />
          Print Application
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
  onEdit 
}: { 
  title: string
  children: React.ReactNode
  onEdit?: () => void 
}) {
  return (
    <div className="border border-gray-200 rounded-lg p-6 print:border-0 print:p-4">
      <div className="flex items-center justify-between mb-4 pb-2 border-b">
        <h3 className="font-medium text-gray-900">{title}</h3>
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
function InfoRow({ label, value }: { label: string; value?: string }) {
  return (
    <div className="grid grid-cols-3 gap-4 text-sm">
      <dt className="text-gray-600">{label}</dt>
      <dd className="col-span-2 text-gray-900">{value || <span className="text-gray-400 italic">Not provided</span>}</dd>
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
              <SelectItem value="she/her">She/Her</SelectItem>
              <SelectItem value="he/him">He/Him</SelectItem>
              <SelectItem value="they/them">They/Them</SelectItem>
              <SelectItem value="other">Other</SelectItem>
              <SelectItem value="prefer_not_to_say">Prefer not to say</SelectItem>
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
                      <SelectItem key={u.id} value={u.name} disabled={data.top3.includes(u.name) && data.top3[rank] !== u.name}>
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
                    <SelectItem value="yes">Yes</SelectItem>
                    <SelectItem value="no">No</SelectItem>
                    <SelectItem value="unsure">Not sure yet</SelectItem>
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
                        <SelectItem value="club">School Club / Organization</SelectItem>
                        <SelectItem value="sport">Athletics / Sports Team</SelectItem>
                        <SelectItem value="arts">Arts / Music / Theater</SelectItem>
                        <SelectItem value="volunteer">Community Service / Volunteer</SelectItem>
                        <SelectItem value="work">Employment / Internship</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
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
