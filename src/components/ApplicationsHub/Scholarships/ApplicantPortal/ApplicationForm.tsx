'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  User, GraduationCap, DollarSign, FileText, Trophy, Upload, 
  CheckCircle2, AlertCircle, Save, ChevronRight, ArrowLeft, ArrowRight,
  Calendar as CalendarIcon, Plus, Trash2, GripVertical, Clock,
  LayoutGrid, Mail, Star
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
  
  // If formDefinition is provided, we treat it as dynamic.
  // If no sections defined but fields exist, create a default section.
  const sections = rawSections.length > 0 
    ? rawSections 
    : (hasFields ? [{ id: 'default', title: 'Form', icon: 'FileText' }] : [])

  const isDynamic = !!formDefinition

  const TABS = isDynamic && sections.length > 0
    ? sections.map(s => ({ id: s.id, label: s.title, icon: FileText }))
    : [
        { id: 'personal', label: 'Personal Info', icon: User },
        { id: 'academic', label: 'Academic Info', icon: GraduationCap },
        { id: 'financial', label: 'Financial Info', icon: DollarSign },
        { id: 'essays', label: 'Essays', icon: FileText },
        { id: 'activities', label: 'Activities', icon: Trophy },
        { id: 'documents', label: 'Documents', icon: Upload },
      ]

  const [activeTab, setActiveTab] = useState<TabId>(TABS[0]?.id || 'personal')
  const [formData, setFormData] = useState<any>(initialData || (isDynamic ? {} : EMPTY_APPLICATION_STATE))
  const [lastSaved, setLastSaved] = useState<Date>(new Date())
  const [isSaving, setIsSaving] = useState(false)

  // Autosave simulation
  useEffect(() => {
    const timer = setInterval(() => {
      setIsSaving(true)
      setTimeout(() => {
        setLastSaved(new Date())
        setIsSaving(false)
      }, 800)
    }, 30000) // Every 30s

    return () => clearInterval(timer)
  }, [formData])

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
      } catch (error) {
        console.error('Failed to save:', error)
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

  const calculateProgress = () => {
    if (isDynamic && formDefinition?.fields) {
      const requiredFields = formDefinition.fields.filter(f => (f.config as any)?.is_required)
      if (requiredFields.length === 0) return 100
      
      const filledFields = requiredFields.filter(f => {
        const val = formData[f.name]
        return val !== undefined && val !== '' && val !== null && (Array.isArray(val) ? val.length > 0 : true)
      })
      
      return Math.round((filledFields.length / requiredFields.length) * 100)
    }
    // Simplified progress calculation for static form
    return 65 
  }

  return (
    <div className={cn("min-h-screen flex flex-col", isExternal ? "bg-white" : "bg-gray-50")}>
      {/* Top Bar */}
      <div className={cn(
        "sticky top-0 z-30 transition-all",
        isExternal ? "bg-white/80 backdrop-blur-md border-b border-gray-100" : "bg-white border-b border-gray-200"
      )}>
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            {!isExternal && (
              <Button variant="ghost" size="sm" onClick={onBack}>
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Dashboard
              </Button>
            )}
            {!isExternal && <Separator orientation="vertical" className="h-6" />}
            
            {isExternal ? (
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-gray-900 rounded-lg flex items-center justify-center text-white font-bold">M</div>
                <span className="font-semibold text-gray-900">{formDefinition?.name || 'Scholarship Application'}</span>
              </div>
            ) : (
              <h1 className="font-semibold text-gray-900">{formDefinition?.name || 'Scholarship Application'}</h1>
            )}
          </div>
          
          <div className="flex items-center gap-6">
            <div className="text-right hidden sm:block">
              <div className="text-xs text-gray-500 mb-1">
                {isSaving ? 'Saving...' : `Saved ${lastSaved.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`}
              </div>
              <Progress value={calculateProgress()} className="w-32 h-2" />
            </div>
            <Button 
              className={cn(isExternal && "bg-gray-900 hover:bg-gray-800")}
              onClick={() => handleSave(true)}
              disabled={isSaving}
            >
              {isSaving ? 'Saving...' : 'Save & Exit'}
            </Button>
          </div>
        </div>
      </div>

      <div className="flex-1 max-w-7xl mx-auto w-full flex flex-col lg:flex-row items-start gap-6 lg:gap-8 p-4 lg:p-6">
        {/* Side Navigation */}
        <div className="w-full lg:w-64 shrink-0 sticky top-[4rem] lg:top-24 z-20 bg-white/95 backdrop-blur lg:bg-transparent -mx-4 px-4 lg:mx-0 lg:px-0 py-2 lg:py-0 border-b lg:border-none border-gray-100">
          <nav className="flex lg:block overflow-x-auto gap-2 lg:space-y-1 pb-1 lg:pb-0 scrollbar-none">
            {TABS.map((tab) => {
              const Icon = tab.icon
              const isActive = activeTab === tab.id
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as TabId)}
                  className={cn(
                    "flex-shrink-0 flex items-center gap-3 px-4 py-2.5 lg:py-3 text-sm font-medium rounded-lg transition-all duration-200 whitespace-nowrap",
                    isActive 
                      ? (isExternal ? "bg-gray-100 text-gray-900" : "bg-blue-50 text-blue-700")
                      : "text-gray-500 hover:bg-gray-50 hover:text-gray-900"
                  )}
                >
                  <Icon className={cn("w-4 h-4", isActive ? (isExternal ? "text-gray-900" : "text-blue-600") : "text-gray-400")} />
                  {tab.label}
                  {isActive && <motion.div layoutId="activeTab" className="ml-auto w-1.5 h-1.5 rounded-full bg-current hidden lg:block" />}
                </button>
              )
            })}
          </nav>
        </div>

        {/* Main Content Area */}
        <div className="flex-1 min-w-0 space-y-6 pb-20 w-full">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
            >
              <Card className={cn(isExternal ? "border-none shadow-none" : "")}>
                <CardHeader className={cn(isExternal ? "px-0" : "")}>
                  <CardTitle className="text-2xl">{TABS.find(t => t.id === activeTab)?.label}</CardTitle>
                  <CardDescription>Please fill out all required fields.</CardDescription>
                </CardHeader>
                <CardContent className={cn("space-y-8", isExternal ? "px-0" : "")}>
                  {isDynamic ? (
                    <DynamicSection
                      fields={formDefinition!.fields!.filter(f => {
                        const config = f.config as any
                        // If we are using the synthesized default section, show all fields
                        if (sections.length === 1 && sections[0].id === 'default') return true
                        return config?.section_id === activeTab
                      })}
                      allFields={formDefinition?.fields || []}
                      data={formData}
                      onChange={(field, value) => updateField(activeTab, field, value)}
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

          <div className="flex justify-between pt-6 border-t border-gray-100">
            <Button 
              variant="ghost" 
              onClick={() => {
                const idx = TABS.findIndex(t => t.id === activeTab)
                if (idx > 0) setActiveTab(TABS[idx - 1].id as TabId)
              }}
              disabled={activeTab === TABS[0].id}
              className="text-gray-500"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Previous Step
            </Button>
            <Button 
              onClick={() => {
                const idx = TABS.findIndex(t => t.id === activeTab)
                if (idx < TABS.length - 1) setActiveTab(TABS[idx + 1].id as TabId)
              }}
              className={cn(isExternal && "bg-gray-900 hover:bg-gray-800")}
            >
              Save & Continue
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

// Section Components

function DynamicSection({ fields, allFields = [], data, onChange }: { fields: any[], allFields?: any[], data: any, onChange: (field: string, value: any) => void }) {
  return (
    <div className="space-y-6">
      {fields.map((rawField) => {
        // Ensure name exists (fallback to label for nested fields from config)
        const field = { ...rawField, name: rawField.name || rawField.label }
        const config = field.config || {}
        const isRequired = config.is_required
        
        if (field.type === 'group') {
           // Children can be in field.children (from portal editor) or config.children (from backend)
           const children = field.children || config.children || []
           return (
             <div key={field.id} className="border border-gray-200 p-6 rounded-xl space-y-4 bg-gray-50/30">
               <h3 className="font-semibold text-lg text-gray-900">{field.label}</h3>
               {config.description && <p className="text-sm text-gray-500">{config.description}</p>}
               <DynamicSection 
                 fields={children} 
                 allFields={allFields}
                 data={data} 
                 onChange={onChange} 
               />
             </div>
           )
        }

        if (field.type === 'repeater') {
           const items = (data[field.name] as any[]) || []
           // Children can be in field.children (from portal editor) or config.children (from backend)
           const children = field.children || config.children || []
           return (
             <div key={field.id} className="space-y-4">
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
                     />
                   </CardContent>
                 </Card>
               ))}
             </div>
           )
        }

        return (
          <div key={field.id} className="space-y-3">
            <Label className="text-base font-medium">
              {field.label} {isRequired && <span className="text-red-500">*</span>}
            </Label>
            
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
              let options = (config.items || []) as string[]
              
              // Support fetching options from another field (e.g. repeater)
              if (config.sourceField) {
                let sourceData = data[config.sourceField]
                
                // If not found by key, try to find field by ID and use its name
                if (!sourceData && allFields) {
                   const sourceFieldDef = allFields.find((f: any) => f.id === config.sourceField)
                   if (sourceFieldDef) {
                       sourceData = data[sourceFieldDef.name || sourceFieldDef.label]
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
                    options = dynamicOptions
                  }
                }
              }

              return (
                <Select value={data[field.name]} onValueChange={v => onChange(field.name, v)}>
                  <SelectTrigger className="h-11">
                    <SelectValue placeholder={config.placeholder || "Select..."} />
                  </SelectTrigger>
                  <SelectContent>
                    {options.map((opt: string) => (
                      <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                    ))}
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
               let options = (config.items || []) as string[]
               
               if (config.sourceField) {
                 let sourceData = data[config.sourceField]
                 
                 // If not found by key, try to find field by ID and use its name
                 if (!sourceData && allFields) {
                    const sourceFieldDef = allFields.find((f: any) => f.id === config.sourceField)
                    if (sourceFieldDef) {
                        sourceData = data[sourceFieldDef.name || sourceFieldDef.label]
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
                     options = dynamicOptions
                   }
                 }
               }

               return (
                 <RadioGroup value={data[field.name]} onValueChange={(val) => onChange(field.name, val)} className="space-y-2">
                   {options.map((item: string) => (
                     <div key={item} className="flex items-center space-x-2">
                       <RadioGroupItem value={item} id={`${field.id}-${item}`} />
                       <Label htmlFor={`${field.id}-${item}`} className="cursor-pointer">{item}</Label>
                     </div>
                   ))}
                 </RadioGroup>
               )
            })()}

            {field.type === 'rank' && (() => {
               let options = (config.items || []) as string[]
               
               if (config.sourceField) {
                 let sourceData = data[config.sourceField]
                 
                 // If not found by key, try to find field by ID and use its name
                 if (!sourceData && allFields) {
                    const sourceFieldDef = allFields.find((f: any) => f.id === config.sourceField)
                    if (sourceFieldDef) {
                        sourceData = data[sourceFieldDef.name || sourceFieldDef.label]
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
                     options = dynamicOptions
                   }
                 }
               }

               const maxSelections = config.maxSelections || 3
               const currentValues = (Array.isArray(data[field.name]) ? data[field.name] : []) as string[]

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
                              value={currentValues[index] || ''} 
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
                                {options.map((opt: string) => (
                                  <SelectItem 
                                    key={opt} 
                                    value={opt} 
                                    disabled={currentValues.includes(opt) && currentValues[index] !== opt}
                                  >
                                    {opt}
                                  </SelectItem>
                                ))}
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
               let options = (config.items || []) as string[]
               const currentValues = (Array.isArray(data[field.name]) ? data[field.name] : []) as string[]

               return (
                 <div className="space-y-2">
                   {options.map((opt: string) => (
                     <div key={opt} className="flex items-center space-x-2 p-2 border rounded-md hover:bg-gray-50">
                       <Checkbox 
                         id={`${field.id}-${opt}`}
                         checked={currentValues.includes(opt)}
                         onCheckedChange={(checked) => {
                           if (checked) {
                             onChange(field.name, [...currentValues, opt])
                           } else {
                             onChange(field.name, currentValues.filter(v => v !== opt))
                           }
                         }}
                       />
                       <label htmlFor={`${field.id}-${opt}`} className="text-sm font-medium leading-none cursor-pointer flex-1">
                         {opt}
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
              <div className="space-y-2">
                <div className="border-2 border-dashed border-gray-200 rounded-xl p-8 text-center hover:border-gray-300 transition-colors">
                  <Upload className="w-10 h-10 text-gray-300 mx-auto mb-3" />
                  <p className="text-sm text-gray-500 mb-2">
                    {field.type === 'image' ? 'Drag and drop an image, or click to browse' : 'Drag and drop a file, or click to browse'}
                  </p>
                  <Input 
                    type="file"
                    accept={field.type === 'image' ? 'image/*' : undefined}
                    onChange={e => {
                      const file = e.target.files?.[0]
                      if (file) {
                        // For now, just store the file name - actual upload would need backend support
                        onChange(field.name, { name: file.name, size: file.size, type: file.type })
                      }
                    }}
                    className="hidden"
                    id={`file-${field.id}`}
                  />
                  <label htmlFor={`file-${field.id}`}>
                    <Button type="button" variant="outline" size="sm" className="cursor-pointer" asChild>
                      <span>Choose File</span>
                    </Button>
                  </label>
                </div>
                {data[field.name]?.name && (
                  <div className="flex items-center gap-2 p-2 bg-gray-50 rounded-lg">
                    <FileText className="w-4 h-4 text-gray-400" />
                    <span className="text-sm text-gray-700 truncate">{data[field.name].name}</span>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="ml-auto h-6 w-6 p-0 text-gray-400 hover:text-red-500"
                      onClick={() => onChange(field.name, null)}
                    >
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                )}
              </div>
            )}

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

            {/* Paragraph - Display only */}
            {field.type === 'paragraph' && (
              <p className="text-gray-600">{config.content || field.label}</p>
            )}

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
