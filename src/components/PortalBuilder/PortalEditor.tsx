'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { DndProvider } from 'react-dnd'
import { HTML5Backend } from 'react-dnd-html5-backend'
import { 
  Layout, Settings, FileText, Plus, Save, Eye, 
  ChevronLeft, Monitor, Smartphone, Palette, Lock, Loader2, X, CheckCircle2,
  BookOpen, CheckCircle, Eye as EyeIcon, ScrollText
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/ui-components/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/ui-components/tabs'
import { ScrollArea } from '@/ui-components/scroll-area'
import { Separator } from '@/ui-components/separator'
import { FormBuilder } from './FormBuilder'
import { PortalSettings } from './PortalSettings'
import { SectionList } from './SectionList'
import { FieldToolbox } from './FieldToolbox'
import { FieldSettingsPanel } from './FieldSettingsPanel'
import { ShareTab } from './ShareTab'
import { SignUpPreview } from './SignUpPreview'
import { ConfirmationPreview } from './ConfirmationPreview'
import { ReviewPreview } from './ReviewPreview'
import { DynamicApplicationForm } from '@/components/ApplicationsHub/Applications/ApplicantPortal/DynamicApplicationForm'
import { PortalConfig, Section, Field } from '@/types/portal'
import { formsClient } from '@/lib/api/forms-client'
import { workspacesClient } from '@/lib/api/workspaces-client'
import { toast } from 'sonner'
import { SettingsModal } from './SettingsModal'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/ui-components/dropdown-menu'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/ui-components/select'
import { applyTranslationsToConfig, collectTranslatableContent, updateTranslationsForField, updateTranslationsForSection } from '@/lib/portal-translations'
import { translateContent } from '@/lib/ai/translation'
import { LANGUAGES, getLanguageName } from '@/lib/languages'

const INITIAL_CONFIG: PortalConfig = {
  sections: [
    {
      id: 'personal',
      title: 'Personal Information',
      sectionType: 'form',
      fields: [
        { id: '1', type: 'text', label: 'Full Name', required: true, width: 'full' },
        { id: '2', type: 'email', label: 'Email Address', required: true, width: 'full' }
      ]
    }
  ],
  settings: {
    name: 'Scholarship Portal',
    themeColor: '#3B82F6',
    logoUrl: '',
    font: 'inter',
    buttonStyle: 'rounded',
    authLayout: 'centered',
    socialLogin: false,
    language: {
      default: 'en',
      enabled: false,
      supported: [],
      rightToLeft: false
    },
    loginFields: [
      { id: 'l1', type: 'email', label: 'Email', required: true, width: 'full' },
      { id: 'l2', type: 'text', label: 'Password', required: true, width: 'full' }
    ],
    signupFields: [
      { id: 's1', type: 'text', label: 'Full Name', required: true, width: 'full' },
      { id: 's2', type: 'email', label: 'Email', required: true, width: 'full' },
      { id: 's3', type: 'text', label: 'Password', required: true, width: 'full' }
    ]
  }
}

export function PortalEditor({ workspaceSlug, initialFormId }: { workspaceSlug: string, initialFormId?: string | null }) {
  const [config, setConfig] = useState<PortalConfig>(INITIAL_CONFIG)
  const [activeSectionId, setActiveSectionId] = useState<string>(INITIAL_CONFIG.sections[0].id)
  const [activeSpecialPage, setActiveSpecialPage] = useState<'signup' | 'ending' | 'review' | null>(null)
  const [viewMode, setViewMode] = useState<'desktop' | 'mobile'>('desktop')
  const [isPreview, setIsPreview] = useState(false)
  const [formId, setFormId] = useState<string | null>(initialFormId || null)
  const [workspaceId, setWorkspaceId] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const [isPublished, setIsPublished] = useState(false)
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)
  const [activeLanguage, setActiveLanguage] = useState(config.settings.language?.default || 'en')
  const [isTranslatingActiveLanguage, setIsTranslatingActiveLanguage] = useState(false)
  
  const [selectedFieldId, setSelectedFieldId] = useState<string | null>(null)
  const [rightSidebarTab, setRightSidebarTab] = useState<'add' | 'settings'>('add')
  const [activeTopTab, setActiveTopTab] = useState<'edit' | 'integrate' | 'share'>('edit')
  const [shareTabKey, setShareTabKey] = useState(0)
  
  // Track previous selected field for autosave on deselect
  const previousSelectedFieldId = useRef<string | null>(null)
  const configRef = useRef(config)
  configRef.current = config

  const activeSection = config.sections.find(s => s.id === activeSectionId)

  useEffect(() => {
    if (selectedFieldId) {
      setRightSidebarTab('settings')
    }
  }, [selectedFieldId])

  useEffect(() => {
    setActiveLanguage(config.settings.language?.default || 'en')
  }, [config.settings.language?.default])

  // Autosave when user clicks off a field (deselects it)
  useEffect(() => {
    // If we had a field selected before and now we don't (or selected a different one)
    // and there are unsaved changes, trigger autosave
    if (previousSelectedFieldId.current && previousSelectedFieldId.current !== selectedFieldId && hasUnsavedChanges && formId && !isSaving) {
      // Trigger autosave
      const autosave = async () => {
        setIsSaving(true)
        try {
          await formsClient.updateStructure(formId, configRef.current)
          setHasUnsavedChanges(false)
          toast.success('Changes saved', { duration: 2000 })
        } catch (error) {
          console.error('Autosave failed:', error)
          // Don't show error toast for autosave - user can manually save
        } finally {
          setIsSaving(false)
        }
      }
      autosave()
    }
    previousSelectedFieldId.current = selectedFieldId
  }, [selectedFieldId, formId, hasUnsavedChanges, isSaving])

  useEffect(() => {
    const loadForm = async () => {
      setIsLoading(true)
      try {
        const workspace = await workspacesClient.getBySlug(workspaceSlug)
        if (!workspace) {
          toast.error('Workspace not found')
          return
        }
        setWorkspaceId(workspace.id)

        let fullForm: any = null;

        if (initialFormId) {
            try {
                fullForm = await formsClient.get(initialFormId)
                setFormId(initialFormId)
            } catch (e) {
                console.error("Failed to load specific form", e)
            }
        }

        if (!fullForm) {
            const forms = await formsClient.list(workspace.id) as any[]
            // Find a form that looks like our portal, or just use the first one for now
            const portalForm = forms.find((f: any) => f.name === 'Scholarship Portal') || forms[0]
            
            if (portalForm) {
                setFormId(portalForm.id)
                fullForm = await formsClient.get(portalForm.id)
            }
        }

        if (fullForm) {
          console.log('📥 Full Form Loaded from backend:', JSON.stringify(fullForm, null, 2))
          
          // Helper to parse config safely
          const getConfig = (f: any) => {
            if (f.config) return f.config;
            // Legacy support
            if (!f.options) return {};
            if (typeof f.options === 'string') {
                try { return JSON.parse(f.options); } catch (e) { return {}; }
            }
            return f.options;
          };

          // Reconstruct config from backend
          if (fullForm.settings?.sections) {
             const sections = fullForm.settings.sections.map((section: any) => {
                 // Filter fields for this section
                 const sectionFields = (fullForm.fields || [])
                    .filter((f: any) => {
                        const config = getConfig(f);
                        // Check both section_id and if the field belongs to this section by some other means if needed
                        return config.section_id === section.id;
                    })
                    .sort((a: any, b: any) => a.position - b.position)
                    .map((f: any) => {
                        const config = getConfig(f);
                        // Extract known fields and keep the rest in config
                        const { section_id, is_required, items, ...restConfig } = config;
                        return {
                            id: f.id,
                            type: f.type,
                            label: f.label,
                            required: is_required,
                            width: config.width || 'full',
                            placeholder: config.placeholder,
                            options: items,
                            children: config.children, // For groups/repeaters
                            config: restConfig // Preserve color, icon, and other config
                        }
                    });

                 return {
                     ...section,
                     fields: sectionFields
                 };
             });

             // Ensure signupFields has required authentication fields
             let signupFields = fullForm.settings.signupFields || INITIAL_CONFIG.settings.signupFields
             const hasEmail = signupFields.some((f: any) => f.type === 'email')
             const hasPassword = signupFields.some((f: any) => f.type === 'text' && f.label.toLowerCase().includes('password'))
             
             if (!hasPassword) {
               // Add password field if missing
               signupFields = [
                 ...signupFields,
                 { id: `pwd-${Date.now()}`, type: 'text', label: 'Password', required: true, width: 'full' }
               ]
             }

             setConfig({
                 sections: sections,
                 settings: {
                     name: fullForm.name,
                     themeColor: fullForm.settings.themeColor || '#3B82F6',
                     logoUrl: fullForm.settings.logoUrl,
                     language: fullForm.settings.language || {
                       default: 'en',
                       enabled: false,
                       supported: [],
                       rightToLeft: false
                     },
                     loginFields: fullForm.settings.loginFields || INITIAL_CONFIG.settings.loginFields,
                     signupFields
                 },
                 translations: fullForm.translations || {}
             })
             if (sections.length > 0) {
               setActiveSectionId(sections[0].id)
             }
          } else if (fullForm.fields && fullForm.fields.length > 0) {
              // Fallback: Create a default section with all fields if no sections defined
              const defaultSection = {
                  id: 'default',
                  title: 'General Information',
                  fields: fullForm.fields.map((f: any) => {
                        const config = getConfig(f);
                        // Extract known fields and keep the rest in config
                        const { section_id, is_required, items, ...restConfig } = config;
                        return {
                            id: f.id,
                            type: f.type,
                            label: f.label,
                            required: is_required,
                            width: config.width || 'full',
                            placeholder: config.placeholder,
                            options: items,
                            children: config.children,
                            config: restConfig // Preserve color, icon, and other config
                        }
                  }).sort((a: any, b: any) => (a.position || 0) - (b.position || 0))
              }
              
              // Ensure signupFields has required authentication fields
              let signupFieldsFallback = fullForm.settings?.signupFields || INITIAL_CONFIG.settings.signupFields
              const hasPasswordFallback = signupFieldsFallback.some((f: any) => f.type === 'text' && f.label.toLowerCase().includes('password'))
              
              if (!hasPasswordFallback) {
                // Add password field if missing
                signupFieldsFallback = [
                  ...signupFieldsFallback,
                  { id: `pwd-${Date.now()}`, type: 'text', label: 'Password', required: true, width: 'full' }
                ]
              }
              
              setConfig({
                  sections: [defaultSection],
                  settings: {
                     name: fullForm.name,
                     themeColor: fullForm.settings?.themeColor || '#3B82F6',
                     logoUrl: fullForm.settings?.logoUrl,
                     language: fullForm.settings?.language || {
                       default: 'en',
                       enabled: false,
                       supported: [],
                       rightToLeft: false
                     },
                     loginFields: fullForm.settings?.loginFields || INITIAL_CONFIG.settings.loginFields,
                     signupFields: signupFieldsFallback
                  },
                  translations: fullForm.translations || {}
              })
              setActiveSectionId('default')
          }
        }
      } catch (error) {
        console.error('Failed to load portal:', error)
        toast.error('Failed to load portal configuration')
      } finally {
        setIsLoading(false)
      }
    }
    loadForm()
  }, [workspaceSlug, initialFormId])

  const handleSave = async () => {
    setIsSaving(true)
    try {
        const workspace = await workspacesClient.getBySlug(workspaceSlug)
        if (!workspace) throw new Error('Workspace not found')

        // Debug: Log what we're sending to the backend
        console.log('📤 Saving portal config:', JSON.stringify(config, null, 2))

        if (formId) {
            await formsClient.updateStructure(formId, config)
            // Also set is_published to true so submissions are accepted
            await formsClient.update(formId, { is_published: true })
            toast.success('Portal published successfully!')
        } else {
            const newForm = await formsClient.create({
                workspace_id: workspace.id,
                name: config.settings.name,
                description: 'Generated Portal'
            }) as any
            setFormId(newForm.id)
            await formsClient.updateStructure(newForm.id, config)
            // Also set is_published to true so submissions are accepted
            await formsClient.update(newForm.id, { is_published: true })
            toast.success('Portal created and published!')
        }
        setIsPublished(true)
        setHasUnsavedChanges(false)
    } catch (error: any) {
        console.error('Failed to save:', error)
        const errorMessage = error?.message || error?.response?.error || 'Unknown error occurred'
        toast.error(`Failed to publish portal: ${errorMessage}`)
    } finally {
        setIsSaving(false)
    }
  }

  const handleUpdateSection = (sectionId: string, updates: Partial<Section>) => {
    const defaultLang = config.settings.language?.default || 'en'
    const languageEnabled = config.settings.language?.enabled

    if (languageEnabled && activeLanguage !== defaultLang) {
      const translations = updateTranslationsForSection(
        config.translations || {},
        activeLanguage,
        sectionId,
        updates
      )

      const nonTextUpdates: Partial<Section> = { ...updates }
      delete (nonTextUpdates as any).title
      delete (nonTextUpdates as any).description

      setConfig(prev => ({
        ...prev,
        translations,
        sections: Object.keys(nonTextUpdates).length === 0
          ? prev.sections
          : prev.sections.map(s => s.id === sectionId ? { ...s, ...nonTextUpdates } : s)
      }))
    } else {
      setConfig(prev => ({
        ...prev,
        sections: prev.sections.map(s => s.id === sectionId ? { ...s, ...updates } : s)
      }))
    }

    setHasUnsavedChanges(true)
    setIsPublished(false)
  }

  const handleUpdateField = (fieldId: string, updates: Partial<Field>) => {
    if (!activeSection) return
    const defaultLang = config.settings.language?.default || 'en'
    const languageEnabled = config.settings.language?.enabled
    const baseField = findFieldRecursive(activeSection.fields, fieldId)

    if (languageEnabled && activeLanguage !== defaultLang) {
      const translations = updateTranslationsForField(
        config.translations || {},
        activeLanguage,
        fieldId,
        updates,
        baseField
      )

      const nonTextUpdates: Partial<Field> = { ...updates }
      delete (nonTextUpdates as any).label
      delete (nonTextUpdates as any).placeholder
      delete (nonTextUpdates as any).options

      let sections = config.sections
      if (Object.keys(nonTextUpdates).length > 0) {
        const updatedFields = updateFieldRecursive(activeSection.fields, fieldId, nonTextUpdates)
        sections = config.sections.map(s => s.id === activeSection.id ? { ...s, fields: updatedFields } : s)
      }

      setConfig(prev => ({
        ...prev,
        translations,
        sections
      }))
    } else {
      const updatedFields = updateFieldRecursive(activeSection.fields, fieldId, updates)
      handleUpdateSection(activeSection.id, { fields: updatedFields })
    }

    setHasUnsavedChanges(true)
    setIsPublished(false)
  }

  const createSectionTemplate = (type: Section['sectionType']): Section => {
    if (type === 'cover') {
      return {
        id: Date.now().toString(),
        title: 'Cover',
        sectionType: 'cover',
        description: 'Welcome users to your form',
        fields: [
          { id: `${Date.now()}-h`, type: 'heading', label: 'Welcome', required: false, width: 'full' },
          { id: `${Date.now()}-p`, type: 'paragraph', label: 'Use this space to greet applicants and explain what to expect.', required: false, width: 'full', config: { content: '' } }
        ]
      }
    }
    if (type === 'ending') {
      return {
        id: Date.now().toString(),
        title: 'Ending',
        sectionType: 'ending',
        description: 'Show a thank you page or redirect users',
        fields: [
          { id: `${Date.now()}-h`, type: 'heading', label: 'Thank you!', required: false, width: 'full' },
          { id: `${Date.now()}-p`, type: 'paragraph', label: 'We received your submission. You can add next steps or a redirect.', required: false, width: 'full', config: { content: '' } }
        ]
      }
    }
    if (type === 'review') {
      return {
        id: Date.now().toString(),
        title: 'Review',
        sectionType: 'review',
        description: 'Let users review their submission',
        fields: [
          { id: `${Date.now()}-h`, type: 'heading', label: 'Review your answers', required: false, width: 'full' },
          { id: `${Date.now()}-p`, type: 'paragraph', label: 'Double-check your responses before submitting.', required: false, width: 'full', config: { content: '' } }
        ]
      }
    }

    return {
      id: Date.now().toString(),
      title: 'Form',
      sectionType: 'form',
      description: 'Page to collect user input',
      fields: []
    }
  }

  const handleAddSection = (type: Section['sectionType']) => {
    const newSection = createSectionTemplate(type)
    setConfig(prev => ({ ...prev, sections: [...prev.sections, newSection] }))
    setActiveSectionId(newSection.id)
    setHasUnsavedChanges(true)
    setIsPublished(false)
  }

  const handleLanguageChange = async (lang: string) => {
    const defaultLang = config.settings.language?.default || 'en'
    if (lang === activeLanguage) return

    // If default language or translation already exists, just switch
    if (lang === defaultLang || config.translations?.[lang]) {
      setActiveLanguage(lang)
      return
    }

    setIsTranslatingActiveLanguage(true)
    const targetLanguageName = getLanguageName(lang)
    try {
      toast.success(`Translating to ${targetLanguageName}`)
      const contentToTranslate = collectTranslatableContent(config)
      const translations = await translateContent(contentToTranslate, targetLanguageName)

      setConfig(prev => ({
        ...prev,
        translations: {
          ...(prev.translations || {}),
          [lang]: translations
        },
        settings: {
          ...prev.settings,
          language: {
            ...prev.settings.language,
            enabled: true,
            default: prev.settings.language?.default || 'en',
            supported: Array.from(new Set([...(prev.settings.language?.supported || []), lang])),
            rightToLeft: prev.settings.language?.rightToLeft || false
          }
        }
      }))

      setActiveLanguage(lang)
      toast.success(`Switched to ${targetLanguageName}`)
    } catch (error) {
      console.error('Language switch translation failed', error)
      toast.error(`Failed to translate to ${targetLanguageName}`)
    } finally {
      setIsTranslatingActiveLanguage(false)
    }
  }

  const handleAddField = (type: Field['type']) => {
    // Default config based on field type
    let config: Field['config'] = undefined
    if (type === 'callout') {
      config = { color: 'blue', icon: 'lightbulb' }
    } else if (type === 'rating') {
      config = { maxRating: 5 }
    } else if (type === 'paragraph') {
      config = { content: '' }
    }
    
    const newField: Field = {
      id: Date.now().toString(),
      type,
      label: type === 'callout' ? 'Important Notice' : 
             type === 'heading' ? 'Section Heading' :
             type === 'paragraph' ? 'Paragraph' :
             'New Field',
      required: false,
      width: 'full',
      ...(config && { config })
    }

    // Add to signup fields if on signup page
    if (activeSpecialPage === 'signup') {
      setConfig(prev => ({
        ...prev,
        settings: {
          ...prev.settings,
          signupFields: [...prev.settings.signupFields, newField]
        }
      }))
      setHasUnsavedChanges(true)
      setIsPublished(false)
      return
    }

    // Otherwise add to active section
    if (!activeSection) return
    handleUpdateSection(activeSection.id, { fields: [...activeSection.fields, newField] })
    setHasUnsavedChanges(true)
    setIsPublished(false)
  }

  // Helper functions for recursive updates
  function updateFieldRecursive(fields: Field[], targetId: string, updates: Partial<Field>): Field[] {
    return fields.map(field => {
      if (field.id === targetId) {
        return { ...field, ...updates }
      }
      if (field.children) {
        return { ...field, children: updateFieldRecursive(field.children, targetId, updates) }
      }
      return field
    })
  }

  function findFieldRecursive(fields: Field[], targetId: string | null): Field | undefined {
    if (!targetId) return undefined
    for (const field of fields) {
      if (field.id === targetId) return field
      if (field.children) {
        const found = findFieldRecursive(field.children, targetId)
        if (found) return found
      }
    }
    return undefined
  }

  const getAllFields = () => {
    const fields: Field[] = []
    config.sections.forEach(section => {
      const traverse = (nodes: Field[]) => {
        nodes.forEach(node => {
          fields.push(node)
          if (node.children) traverse(node.children)
        })
      }
      traverse(section.fields)
    })
    return fields
  }

  const defaultLanguage = config.settings.language?.default || 'en'
  const supportedLanguages = Array.from(new Set([defaultLanguage, ...(config.settings.language?.supported || [])]))
  const displayConfig = activeLanguage === defaultLanguage
    ? config
    : applyTranslationsToConfig(config, activeLanguage)
  const displaySection = displayConfig.sections.find((s: Section) => s.id === activeSectionId)

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center bg-gray-50">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    )
  }

  return (
    <DndProvider backend={HTML5Backend}>
      <div className="flex flex-col h-full bg-gray-100">
        {/* Top Bar - Full Width */}
        <div className="h-14 bg-white border-b border-gray-200 flex items-center justify-between px-4 shadow-sm z-20 shrink-0">
            <div className="flex items-center gap-4">
                <div className="flex items-center gap-2 font-semibold text-gray-900 mr-4">
                  <Layout className="w-5 h-5 text-blue-600" />
                  Portal Builder
                </div>
                <div className="h-6 w-px bg-gray-200" />
                <div className="flex items-center gap-2 bg-gray-100 p-1 rounded-lg">
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className={cn("h-7 px-2", viewMode === 'desktop' && "bg-white shadow-sm")}
                    onClick={() => setViewMode('desktop')}
                  >
                    <Monitor className="w-4 h-4" />
                  </Button>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className={cn("h-7 px-2", viewMode === 'mobile' && "bg-white shadow-sm")}
                    onClick={() => setViewMode('mobile')}
                  >
                    <Smartphone className="w-4 h-4" />
                  </Button>
                </div>
                {config.settings.language?.enabled && (
                  <div className="flex items-center gap-2">
                    <Select value={activeLanguage} onValueChange={handleLanguageChange} disabled={isTranslatingActiveLanguage}>
                      <SelectTrigger className="w-32 h-8 text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {supportedLanguages.map(lang => (
                          <SelectItem key={lang} value={lang}>{lang.toUpperCase()}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {isTranslatingActiveLanguage && <Loader2 className="w-4 h-4 animate-spin text-blue-600" />}
                  </div>
                )}
            </div>

            <div className="flex items-center justify-center bg-gray-100 p-1 rounded-full">
               <button 
                 onClick={() => setActiveTopTab('edit')}
                 className={cn(
                   "px-4 py-1.5 text-sm font-medium rounded-full transition-all",
                   activeTopTab === 'edit' ? "bg-white shadow-sm text-gray-900" : "text-gray-600 hover:text-gray-900"
                 )}
               >
                 Edit
               </button>
               <button 
                 onClick={() => setActiveTopTab('integrate')}
                 className={cn(
                   "px-4 py-1.5 text-sm font-medium rounded-full transition-all",
                   activeTopTab === 'integrate' ? "bg-white shadow-sm text-gray-900" : "text-gray-600 hover:text-gray-900"
                 )}
               >
                 Integrate
               </button>
               <button 
                 onClick={() => {
                   setActiveTopTab('share')
                   setShareTabKey(prev => prev + 1) // Force ShareTab to remount and refetch
                 }}
                 className={cn(
                   "px-4 py-1.5 text-sm font-medium rounded-full transition-all",
                   activeTopTab === 'share' ? "bg-white shadow-sm text-gray-900" : "text-gray-600 hover:text-gray-900"
                 )}
               >
                 Share
               </button>
            </div>

            <div className="flex items-center gap-2">
              <Button 
                variant="ghost" 
                size="sm"
                onClick={() => setIsSettingsOpen(true)}
              >
                <Settings className="w-4 h-4 mr-2" />
                Settings
              </Button>
              <Button 
                variant={isPreview ? "default" : "outline"} 
                size="sm"
                onClick={() => setIsPreview(!isPreview)}
              >
                <Eye className="w-4 h-4 mr-2" /> 
                {isPreview ? 'Edit Mode' : 'Preview'}
              </Button>
              <Button 
                size="sm" 
                className={cn(
                  "text-white transition-all duration-300",
                  isPublished && !hasUnsavedChanges
                    ? "bg-green-600 hover:bg-green-700" 
                    : "bg-gray-900 hover:bg-gray-800"
                )}
                onClick={handleSave}
                disabled={isSaving || (isPublished && !hasUnsavedChanges)}
              >
                {isSaving ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : isPublished && !hasUnsavedChanges ? (
                  <CheckCircle2 className="w-4 h-4 mr-2" />
                ) : (
                  <Save className="w-4 h-4 mr-2" />
                )}
                {isPublished && !hasUnsavedChanges ? 'Published' : 'Publish'}
              </Button>
            </div>
        </div>

        {/* Main Content Area */}
        {activeTopTab === 'share' && (
          <div className="flex-1 overflow-auto bg-white">
            <ShareTab key={`share-${formId}-${workspaceId}-${shareTabKey}`} formId={formId} isPublished={isPublished} workspaceId={workspaceId || undefined} />
          </div>
        )}
        
        {activeTopTab === 'integrate' && (
          <div className="flex-1 overflow-auto bg-gray-50 p-8">
            <div className="max-w-2xl mx-auto text-center py-16">
              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <FileText className="w-8 h-8 text-gray-400" />
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">Integration Options</h3>
              <p className="text-gray-500 text-sm">
                Coming soon: Embed codes, API access, and webhook integrations.
              </p>
            </div>
          </div>
        )}
        
        {activeTopTab === 'edit' && (
        <div className="flex-1 flex overflow-hidden">
            {/* Left Sidebar - Navigation */}
            <div className="w-80 bg-white border-r border-gray-200 flex flex-col shadow-sm z-10">
          <Tabs defaultValue="structure" className="flex-1 flex flex-col gap-0 min-h-0">
            <div className="px-4 py-3 border-b border-gray-100">
              <TabsList className="w-full grid grid-cols-3 bg-gray-100 p-1 rounded-full h-auto">
                <TabsTrigger value="structure" className="rounded-full data-[state=active]:bg-white data-[state=active]:shadow-sm py-1.5 text-sm font-medium">Sections</TabsTrigger>
                <TabsTrigger value="elements" className="rounded-full data-[state=active]:bg-white data-[state=active]:shadow-sm py-1.5 text-sm font-medium">Fields</TabsTrigger>
                <TabsTrigger value="theme" className="rounded-full data-[state=active]:bg-white data-[state=active]:shadow-sm py-1.5 text-sm font-medium">Theme</TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value="structure" className="flex-1 data-[state=active]:flex flex-col mt-0 min-h-0 overflow-hidden">
              {/* Header with Add Button */}
              <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-gray-900">All Sections</h3>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button size="sm" className="h-8 text-xs gap-1">
                      <Plus className="w-3.5 h-3.5" />
                      Add
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56">
                    <DropdownMenuItem className="flex items-start gap-3" onClick={() => handleAddSection('form')}>
                      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-50 text-amber-600 border border-amber-100">
                        <ScrollText className="w-4 h-4" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-gray-900">Form</p>
                        <p className="text-xs text-gray-500">Collect user information</p>
                      </div>
                    </DropdownMenuItem>
                    <DropdownMenuItem className="flex items-start gap-3" onClick={() => handleAddSection('cover')}>
                      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50 text-blue-600 border border-blue-100">
                        <BookOpen className="w-4 h-4" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-gray-900">Cover</p>
                        <p className="text-xs text-gray-500">Welcome page intro</p>
                      </div>
                    </DropdownMenuItem>
                    <DropdownMenuItem className="flex items-start gap-3" onClick={() => handleAddSection('ending')}>
                      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600 border border-emerald-100">
                        <CheckCircle className="w-4 h-4" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-gray-900">Ending</p>
                        <p className="text-xs text-gray-500">Thank you / confirmation</p>
                      </div>
                    </DropdownMenuItem>
                    <DropdownMenuItem className="flex items-start gap-3" onClick={() => handleAddSection('review')}>
                      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-purple-50 text-purple-600 border border-purple-100">
                        <EyeIcon className="w-4 h-4" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-gray-900">Review</p>
                        <p className="text-xs text-gray-500">Let users review answers</p>
                      </div>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              {/* Special Pages */}
              <div className="px-2 pt-3 pb-2 space-y-1">
                {/* Sign Up Page */}
                <button
                  onClick={() => {
                    setActiveSpecialPage('signup')
                    setActiveSectionId('')
                    setSelectedFieldId(null)
                  }}
                  title="Sign Up Page"
                  className={cn(
                    "w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-sm transition-colors text-left",
                    activeSpecialPage === 'signup'
                      ? "bg-blue-50 text-blue-900" 
                      : "text-gray-700 hover:bg-gray-50"
                  )}
                >
                  <Lock className="w-4 h-4 flex-shrink-0 text-green-600" />
                  <span className="flex-1 truncate font-medium">Sign Up</span>
                </button>

                {/* Review Page */}
                <button
                  onClick={() => {
                    setActiveSpecialPage('review')
                    setActiveSectionId('')
                    setSelectedFieldId(null)
                  }}
                  title="Review & Submit Page"
                  className={cn(
                    "w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-sm transition-colors text-left",
                    activeSpecialPage === 'review'
                      ? "bg-blue-50 text-blue-900" 
                      : "text-gray-700 hover:bg-gray-50"
                  )}
                >
                  <EyeIcon className="w-4 h-4 flex-shrink-0 text-purple-600" />
                  <span className="flex-1 truncate font-medium">Review & Submit</span>
                </button>

                {/* Ending Page */}
                <button
                  onClick={() => {
                    setActiveSpecialPage('ending')
                    setActiveSectionId('')
                    setSelectedFieldId(null)
                  }}
                  title="Ending Page"
                  className={cn(
                    "w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-sm transition-colors text-left",
                    activeSpecialPage === 'ending'
                      ? "bg-blue-50 text-blue-900" 
                      : "text-gray-700 hover:bg-gray-50"
                  )}
                >
                  <CheckCircle2 className="w-4 h-4 flex-shrink-0 text-emerald-600" />
                  <span className="flex-1 truncate font-medium">Ending</span>
                </button>
              </div>

              {/* Divider */}
              {config.sections.length > 0 && (
                <div className="px-2 py-2">
                  <div className="border-t border-gray-200" />
                </div>
              )}

              {/* Form Sections - Scrollable */}
              <div className="flex-1 overflow-hidden px-1">
                <ScrollArea className="h-full">
                  <SectionList 
                    sections={config.sections} 
                    activeId={activeSectionId} 
                    onSelect={(id) => {
                      setActiveSectionId(id)
                      setActiveSpecialPage(null)
                      setSelectedFieldId(null)
                    }}
                    onReorder={(sections: Section[]) => setConfig(prev => ({ ...prev, sections }))}
                    onDelete={(sectionId: string) => {
                      setConfig(prev => ({
                        ...prev,
                        sections: prev.sections.filter(s => s.id !== sectionId)
                      }));
                      // Select first remaining section if active one was deleted
                      if (activeSectionId === sectionId) {
                        const remaining = config.sections.filter(s => s.id !== sectionId);
                        if (remaining.length > 0) {
                          setActiveSectionId(remaining[0].id);
                        }
                      }
                    }}
                  />
                </ScrollArea>
              </div>
            </TabsContent>

            <TabsContent value="elements" className="flex-1 mt-0 overflow-hidden data-[state=active]:flex flex-col min-h-0">
               <FieldToolbox onAddField={handleAddField} />
            </TabsContent>

            <TabsContent value="theme" className="flex-1 overflow-y-auto min-h-0">
               <PortalSettings 
                  type="branding" 
                  settings={config.settings} 
                  onUpdate={(updates: Partial<PortalConfig['settings']>) => setConfig(prev => ({ ...prev, settings: { ...prev.settings, ...updates } }))} 
                />
            </TabsContent>
          </Tabs>
            </div>

            {/* Canvas */}
            <div className="flex-1 overflow-y-auto p-4 bg-gray-100 flex justify-center relative">
                <div className={cn(
                  "bg-white shadow-lg border border-gray-200 rounded-xl transition-all duration-300 min-h-[800px] overflow-hidden",
                  viewMode === 'mobile' ? "w-[375px]" : "w-full max-w-3xl"
                )}>
                  {isPreview ? (
                    <div className="p-4">
                      <DynamicApplicationForm config={displayConfig} isExternal={true} formId={formId || undefined} />
                    </div>
                  ) : activeSpecialPage === 'signup' ? (
                    <SignUpPreview 
                      config={config} 
                      onSelectField={setSelectedFieldId}
                      selectedFieldId={selectedFieldId}
                    />
                  ) : activeSpecialPage === 'review' ? (
                    <ReviewPreview config={config} />
                  ) : activeSpecialPage === 'ending' ? (
                    <ConfirmationPreview config={config} />
                  ) : displaySection ? (
                    <FormBuilder 
                      section={displaySection} 
                      onUpdate={(updates: Partial<Section>) => handleUpdateSection(displaySection.id, updates)} 
                      selectedFieldId={selectedFieldId}
                      onSelectField={setSelectedFieldId}
                    />
                  ) : (
                    <div className="flex items-center justify-center h-full text-gray-400">
                      Select a section to edit
                    </div>
                  )}
                </div>
            </div>

            {/* Right Sidebar - Settings */}
            <div className={cn(
               "bg-white border-l border-gray-200 flex flex-col shadow-sm z-10 transition-all duration-300 ease-in-out",
               selectedFieldId ? "w-80 translate-x-0" : "w-0 translate-x-full opacity-0"
            )}>
               <div className="flex items-center justify-between p-4 border-b border-gray-100">
                  <span className="font-semibold text-sm">Field Settings</span>
                  <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => setSelectedFieldId(null)}>
                    <X className="w-4 h-4" />
                  </Button>
               </div>
               <div className="flex-1 overflow-hidden">
                   {selectedFieldId && (
                      <FieldSettingsPanel 
                        selectedField={
                          activeSpecialPage === 'signup' 
                            ? config.settings.signupFields.find(f => f.id === selectedFieldId) || null
                            : activeSection 
                              ? findFieldRecursive(activeSection.fields, selectedFieldId) 
                              : null
                        }
                        onUpdate={(fieldId: string, updates: Partial<Field>) => {
                          if (activeSpecialPage === 'signup') {
                            // Update signup field
                            setConfig(prev => ({
                              ...prev,
                              settings: {
                                ...prev.settings,
                                signupFields: prev.settings.signupFields.map(f => 
                                  f.id === fieldId ? { ...f, ...updates } : f
                                )
                              }
                            }))
                            setHasUnsavedChanges(true)
                          } else {
                            handleUpdateField(fieldId, updates)
                          }
                        }}
                        onClose={() => setSelectedFieldId(null)}
                        allFields={getAllFields()}
                      />
                   )}
               </div>
            </div>
        </div>
        )}
      </div>

      <SettingsModal 
        open={isSettingsOpen} 
        onOpenChange={setIsSettingsOpen}
        config={config}
        onUpdate={(updates) => setConfig(prev => ({ ...prev, ...updates }))}
      />
    </DndProvider>
  )
}