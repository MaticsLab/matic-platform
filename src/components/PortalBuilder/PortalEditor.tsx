'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { DndProvider } from 'react-dnd'
import { HTML5Backend } from 'react-dnd-html5-backend'
import { 
  Layout, Settings, FileText, Plus, Save, Eye,
  ChevronLeft, Monitor, Smartphone, Palette, Lock, Loader2, X, CheckCircle2,
  BookOpen, CheckCircle, Eye as EyeIcon, ScrollText, LayoutDashboard
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/ui-components/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/ui-components/tabs'
import { ScrollArea } from '@/ui-components/scroll-area'
import { Separator } from '@/ui-components/separator'
import { FormBuilder } from './FormBuilder'
import { BlockEditor } from './BlockEditor'
import { PortalSettings } from './PortalSettings'
import { SectionList } from './SectionList'
import { FieldToolbox } from './FieldToolbox'
import { FieldSettingsPanel } from './FieldSettingsPanel'
import { ConditionBuilder } from './ConditionBuilder'
import { ShareTab } from './ShareTab'
import { SignUpPreview } from './SignUpPreview'
import { ConfirmationPreview } from './ConfirmationPreview'
import { ReviewPreview } from './ReviewPreview'
import { EndingPagesBuilder } from '@/components/EndingPages/EndingPagesBuilder'
import { VisualDashboardBuilder } from '@/components/ApplicantDashboard/VisualDashboardBuilder'
import { UnifiedSidebar } from './UnifiedSidebar'
import { DashboardPreview } from './DashboardPreview'
import { PageThemeSettings } from './PageThemeSettings'
import type { DashboardSettings } from '@/types/dashboard'
import { EndingBlocksToolbox } from './EndingBlocksToolbox'
import { EndingBlockEditor } from './EndingBlockEditor'
import { DEFAULT_ENDING_TEMPLATE } from '@/lib/ending-templates'
import { BlockRenderer } from '@/components/EndingPages/BlockRenderer'
import { PropertyInput } from '@/components/EndingPages/PropertyInput'
import { getBlockDefinition } from '@/lib/ending-block-registry'
import type { EndingBlock } from '@/types/ending-blocks'
import { DynamicApplicationForm } from '@/components/ApplicationsHub/Applications/ApplicantPortal/DynamicApplicationForm'
import { PortalConfig, Section, Field } from '@/types/portal'
import { supabase } from '@/lib/supabase'
import { CollaborationProvider, useCollaborationOptional, getCollaborationActions, useYDoc } from './CollaborationProvider'
import { PortalConfigSyncBridge } from './PortalConfigSyncBridge'
import { PresenceHeader, SectionCollaboratorIndicator, CursorOverlay, type Collaborator } from './PresenceIndicators'
import { formsClient } from '@/lib/api/forms-client'
import { workspacesClient } from '@/lib/api/workspaces-client'
import { dashboardClient } from '@/lib/api/dashboard-client'
import { toast } from 'sonner'
import { SettingsModal } from './SettingsModal'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/ui-components/dropdown-menu'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/ui-components/select'
import { 
  applyTranslationsToConfig, 
  collectTranslatableContentNew,
  updateFieldTranslationNew,
  updateSectionTranslationNew,
  normalizeTranslations
} from '@/lib/portal-translations'
import { translateContent, translateResource, translateResourceIncremental } from '@/lib/ai/translation'
import { LANGUAGES, getLanguageName } from '@/lib/languages'
import type { TranslationResource, PortalTranslations } from '@/lib/i18n/types'

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
  const [activeSpecialPage, setActiveSpecialPage] = useState<'signup' | 'review' | 'dashboard' | null>(null)
  const [selectedEndingId, setSelectedEndingId] = useState<string | null>(null)
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
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null)
  const [showFieldSettings, setShowFieldSettings] = useState(false)
  const [useBlockEditor, setUseBlockEditor] = useState(true) // Toggle for block editor vs FormBuilder
  const [currentUser, setCurrentUser] = useState<{ id: string; name: string; avatarUrl?: string } | null>(null)
  const [rightSidebarTab, setRightSidebarTab] = useState<'add' | 'settings'>('add')
  const [activeTopTab, setActiveTopTab] = useState<'edit' | 'integrate' | 'share'>('edit')
  const [leftSidebarTab, setLeftSidebarTab] = useState<'structure' | 'elements' | 'theme'>('structure')
  const [themePageType, setThemePageType] = useState<'login' | 'signup' | 'sections'>('signup')
  const [shareTabKey, setShareTabKey] = useState(0)
  const [dashboardSettings, setDashboardSettings] = useState<DashboardSettings>({
    showStatus: true,
    showTimeline: true,
    showChat: true,
    showDocuments: true,
    welcomeTitle: 'Welcome to Your Dashboard',
    welcomeText: 'Track your application progress and communicate with our team.'
  })
  
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

  // Update collaboration awareness when selected field changes
  useEffect(() => {
    const { updateSelectedBlock } = getCollaborationActions()
    updateSelectedBlock(selectedFieldId)
  }, [selectedFieldId])

  // Close settings panel when block is deselected
  useEffect(() => {
    if (!selectedBlockId && !selectedFieldId) {
      setShowFieldSettings(false)
    }
  }, [selectedBlockId, selectedFieldId])

  useEffect(() => {
    setActiveLanguage(config.settings.language?.default || 'en')
  }, [config.settings.language?.default])

  // Navigate to a collaborator's current location (section + field)
  const handleNavigateToUser = (user: Collaborator) => {
    // First, try to navigate to their section
    if (user.currentSection) {
      // Check if it's a special page
      if (user.currentSection.startsWith('special-')) {
        const specialPage = user.currentSection.replace('special-', '') as 'signup' | 'review' | 'dashboard'
        setActiveSpecialPage(specialPage)
        setActiveSectionId('')
      } else {
        // Regular section
        setActiveSectionId(user.currentSection)
        setActiveSpecialPage(null)
      }
    }
    
    // Then try to select their block/field
    if (user.selectedBlockId) {
      setSelectedFieldId(user.selectedBlockId)
      
      // Scroll the block into view after a short delay to allow render
      setTimeout(() => {
        const blockElement = document.querySelector(`[data-block-id="${user.selectedBlockId}"]`)
        if (blockElement) {
          blockElement.scrollIntoView({ behavior: 'smooth', block: 'center' })
        }
      }, 100)
    }
  }

  // Ref to track saving state without causing effect re-runs
  const isSavingRef = useRef(isSaving)
  isSavingRef.current = isSaving
  
  // Ref to track hasUnsavedChanges without causing effect re-runs
  const hasUnsavedChangesRef = useRef(hasUnsavedChanges)
  hasUnsavedChangesRef.current = hasUnsavedChanges

  // Autosave when user clicks off a field (deselects it)
  useEffect(() => {
    // If we had a field selected before and now we don't (or selected a different one)
    // and there are unsaved changes, trigger autosave
    if (previousSelectedFieldId.current && previousSelectedFieldId.current !== selectedFieldId && hasUnsavedChangesRef.current && formId && !isSavingRef.current) {
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
  }, [selectedFieldId, formId])

  // Auto-save debounced on config changes
  useEffect(() => {
    // Check refs at effect setup to decide if we need to schedule a save
    if (!hasUnsavedChangesRef.current || !formId) return
    
    const timer = setTimeout(async () => {
      // Check refs at execution time to avoid race conditions
      if (isSavingRef.current || !hasUnsavedChangesRef.current) return
      
      setIsSaving(true)
      try {
        await formsClient.updateStructure(formId, configRef.current)
        setHasUnsavedChanges(false)
        toast.success('Auto-saved', { duration: 1500 })
      } catch (error) {
        console.error('Autosave failed:', error)
      } finally {
        setIsSaving(false)
      }
    }, 2000) // 2 second debounce
    
    return () => clearTimeout(timer)
  }, [config, formId])

  // Fetch current user for collaboration
  useEffect(() => {
    const fetchUser = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        setCurrentUser({
          id: user.id,
          name: user.user_metadata?.full_name || user.email || 'Anonymous',
          avatarUrl: user.user_metadata?.avatar_url
        })
      }
    }
    fetchUser()
  }, [])

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
                     sectionType: section.sectionType || 'form',
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

             // Load dashboard settings from dedicated dashboard layout endpoint first,
             // fall back to form settings
             try {
               const dashboardLayout = await dashboardClient.getLayout(fullForm.id)
               if (dashboardLayout?.settings) {
                 setDashboardSettings(prev => ({
                   ...prev,
                   showStatus: dashboardLayout.settings.showStatus ?? dashboardLayout.settings.show_status ?? prev.showStatus,
                   showTimeline: dashboardLayout.settings.showTimeline ?? dashboardLayout.settings.show_timeline ?? prev.showTimeline,
                   showChat: dashboardLayout.settings.showChat ?? dashboardLayout.settings.show_chat ?? prev.showChat,
                   showDocuments: dashboardLayout.settings.showDocuments ?? dashboardLayout.settings.show_documents ?? prev.showDocuments,
                   welcomeTitle: dashboardLayout.settings.welcomeTitle ?? dashboardLayout.settings.welcome_title ?? prev.welcomeTitle,
                   welcomeText: dashboardLayout.settings.welcomeText ?? dashboardLayout.settings.welcome_text ?? prev.welcomeText,
                 }))
               }
             } catch (layoutError) {
               // Fall back to form settings if dashboard layout endpoint fails
               console.warn('Failed to load dashboard layout, using form settings:', layoutError)
               if (fullForm.settings.dashboardSettings) {
                 setDashboardSettings(prev => ({
                   ...prev,
                   ...fullForm.settings.dashboardSettings
                 }))
               }
             }

             setConfig({
                 sections: sections,
                 settings: {
                     name: fullForm.name,
                     description: fullForm.description || fullForm.settings?.description,
                     themeColor: fullForm.settings.themeColor || '#3B82F6',
                     logoUrl: fullForm.settings.logoUrl,
                     language: fullForm.settings.language || {
                       default: 'en',
                       enabled: false,
                       supported: [],
                       rightToLeft: false
                     },
                     loginFields: fullForm.settings.loginFields || INITIAL_CONFIG.settings.loginFields,
                     signupFields,
                     dashboardSettings: fullForm.settings.dashboardSettings
                 },
                 translations: fullForm.settings?.translations || {}
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
                     description: fullForm.description || fullForm.settings?.description,
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
                  translations: fullForm.settings?.translations || (fullForm as any).translations || {}
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
        console.log('📤 Saving portal config:', {
            hasTranslations: !!config.translations,
            translationKeys: Object.keys(config.translations || {}),
            config
        })

        const translationCount = Object.keys(config.translations || {}).length
        let targetFormId = formId

        if (formId) {
            await formsClient.updateStructure(formId, config)
            // Also set is_published to true so submissions are accepted
            await formsClient.update(formId, { is_published: true })
        } else {
            const newForm = await formsClient.create({
                workspace_id: workspace.id,
                name: config.settings.name,
                description: 'Generated Portal'
            }) as any
            targetFormId = newForm.id
            setFormId(newForm.id)
            await formsClient.updateStructure(newForm.id, config)
            // Also set is_published to true so submissions are accepted
            await formsClient.update(newForm.id, { is_published: true })
        }

        // Save dashboard layout separately to dedicated endpoint
        if (targetFormId) {
            try {
                await dashboardClient.updateLayout(targetFormId, {
                    sections: [],  // Sections are managed by form settings
                    settings: dashboardSettings
                })
                console.log('📤 Saved dashboard settings:', dashboardSettings)
            } catch (dashboardError) {
                console.warn('Failed to save dashboard layout:', dashboardError)
                // Don't fail the whole save for dashboard layout issues
            }
        }

        toast.success(`Portal published successfully! (${translationCount} languages)`)
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
      // Use new format: updateSectionTranslationNew expects PortalTranslations
      const normalizedTranslations = normalizeTranslations(config.translations || {})
      const translations = updateSectionTranslationNew(
        normalizedTranslations,
        activeLanguage,
        sectionId,
        { title: updates.title, description: updates.description }
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

    if (languageEnabled && activeLanguage !== defaultLang) {
      // Use new format: updateFieldTranslationNew
      const normalizedTranslations = normalizeTranslations(config.translations || {})
      
      // Convert options array to string array if present
      let options: string[] | undefined
      if (Array.isArray(updates.options)) {
        options = updates.options.map((opt: any) => 
          typeof opt === 'string' ? opt : opt.label || ''
        )
      }
      
      const translations = updateFieldTranslationNew(
        normalizedTranslations,
        activeLanguage,
        fieldId,
        {
          label: updates.label,
          placeholder: updates.placeholder,
          description: updates.description,
          options
        }
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
        title: 'Thank You Page',
        sectionType: 'ending',
        description: 'Customizable ending page shown after form submission',
        fields: [],
        blocks: DEFAULT_ENDING_TEMPLATE
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
    if (type === 'dashboard') {
      return {
        id: Date.now().toString(),
        title: 'Additional Information',
        sectionType: 'dashboard',
        description: 'Collect additional data after submission',
        fields: []
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
    setLeftSidebarTab('elements')
    setHasUnsavedChanges(true)
    setIsPublished(false)
  }

  const handleLanguageChange = async (lang: string) => {
    const defaultLang = config.settings.language?.default || 'en'
    if (lang === activeLanguage) return

    // Normalize translations to check if we have content for this language
    const normalizedTranslations = normalizeTranslations(config.translations || {})
    const existingLangTranslations = normalizedTranslations[lang]
    
    // Count fields in current config vs existing translations
    const currentContent = collectTranslatableContentNew(config)
    const currentFieldCount = Object.keys(currentContent.fields || {}).length + Object.keys(currentContent.sections || {}).length
    const existingFieldCount = existingLangTranslations 
      ? Object.keys(existingLangTranslations.fields || {}).length + Object.keys(existingLangTranslations.sections || {}).length
      : 0
    
    // If translations exist and cover all content, just switch
    const hasCompleteTranslations = existingLangTranslations && existingFieldCount >= currentFieldCount
    
    if (lang === defaultLang || hasCompleteTranslations) {
      setActiveLanguage(lang)
      return
    }

    setIsTranslatingActiveLanguage(true)
    const targetLanguageName = getLanguageName(lang)
    try {
      let translatedResource: TranslationResource = {
        portal: { name: '' },
        sections: {},
        fields: {}
      }
      
      if (!config.settings.language?.disableAutoTranslate) {
        // Use incremental translation - only translate new/changed content
        if (existingLangTranslations && existingFieldCount > 0) {
          toast.success(`Updating ${targetLanguageName} translations (${currentFieldCount - existingFieldCount} new items)`)
          translatedResource = await translateResourceIncremental(
            currentContent,
            existingLangTranslations,
            targetLanguageName
          )
        } else {
          toast.success(`Translating to ${targetLanguageName}`)
          translatedResource = await translateResource(currentContent, targetLanguageName)
        }
      } else {
        toast.success(`Switched to ${targetLanguageName} (Auto-translate disabled)`)
      }

      setConfig(prev => ({
        ...prev,
        translations: {
          ...(normalizeTranslations(prev.translations || {})),
          [lang]: translatedResource
        },
        settings: {
          ...prev.settings,
          language: {
            ...prev.settings.language,
            enabled: true,
            default: prev.settings.language?.default || 'en',
            supported: Array.from(new Set([...(prev.settings.language?.supported || []), lang])),
            rightToLeft: prev.settings.language?.rightToLeft || false,
            disableAutoTranslate: prev.settings.language?.disableAutoTranslate || false
          }
        }
      }))

      setActiveLanguage(lang)
      if (!config.settings.language?.disableAutoTranslate) {
        toast.success(`Switched to ${targetLanguageName}`)
      }
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

    // If a container field (group/repeater) is selected, add inside its children
    const selectedContainer = selectedFieldId 
      ? findFieldRecursive(activeSection.fields, selectedFieldId) 
      : null

    const isContainer = selectedContainer && (selectedContainer.type === 'group' || selectedContainer.type === 'repeater')

    if (isContainer) {
      const updated = updateFieldRecursive(activeSection.fields, selectedContainer!.id, {
        children: [...(selectedContainer!.children || []), newField]
      })
      handleUpdateSection(activeSection.id, { fields: updated })
    } else {
      handleUpdateSection(activeSection.id, { fields: [...activeSection.fields, newField] })
    }
    setHasUnsavedChanges(true)
    setIsPublished(false)
  }

  const handleAddBlock = (blockType: string) => {
    if (!activeSection || activeSection.sectionType !== 'ending') return
    
    const blockDef = getBlockDefinition(blockType)
    const defaultProps = blockDef?.defaultProps || {}
    
    const newBlock: EndingBlock = {
      id: `block-${Date.now()}`,
      blockType,
      props: defaultProps,
      metadata: {
        order: (activeSection.blocks?.length || 0)
      }
    }

    const updatedBlocks = [...(activeSection.blocks || []), newBlock]
    handleUpdateSection(activeSection.id, { blocks: updatedBlocks })
    setHasUnsavedChanges(true)
    setIsPublished(false)
    // Auto-select the new block
    setSelectedBlockId(newBlock.id)
  }

  const handleUpdateBlock = (blockId: string, updates: Partial<EndingBlock>) => {
    if (!activeSection || activeSection.sectionType !== 'ending') return
    
    const updatedBlocks = (activeSection.blocks || []).map(block =>
      block.id === blockId ? { ...block, ...updates } : block
    )
    handleUpdateSection(activeSection.id, { blocks: updatedBlocks })
    setHasUnsavedChanges(true)
  }

  const handleDeleteBlock = (blockId: string) => {
    if (!activeSection || activeSection.sectionType !== 'ending') return
    
    const updatedBlocks = (activeSection.blocks || []).filter(block => block.id !== blockId)
    handleUpdateSection(activeSection.id, { blocks: updatedBlocks })
    setHasUnsavedChanges(true)
  }

  const handleMoveFieldToSection = (fieldId: string, targetSectionId: string) => {
    setConfig(prev => {
      // Find the field in all sections
      let fieldToMove: Field | null = null
      const sourceSectionId = prev.sections.find(section => {
        const found = section.fields?.find(f => f.id === fieldId)
        if (found) {
          fieldToMove = found
          return true
        }
        return false
      })?.id

      if (!fieldToMove || !sourceSectionId) return prev

      // Remove from source section and add to target
      const updatedSections = prev.sections.map(section => {
        if (section.id === sourceSectionId) {
          return {
            ...section,
            fields: (section.fields || []).filter(f => f.id !== fieldId)
          }
        }
        if (section.id === targetSectionId) {
          return {
            ...section,
            fields: [...(section.fields || []), fieldToMove!]
          }
        }
        return section
      })

      return {
        ...prev,
        sections: updatedSections
      }
    })
    
    setHasUnsavedChanges(true)
    setIsPublished(false)
  }

  const handleDashboardSettingsChange = (updates: Partial<DashboardSettings>) => {
    setDashboardSettings(prev => ({ ...prev, ...updates }))
    // Also store in config settings for persistence
    setConfig(prev => {
      const currentDashboardSettings = (prev.settings as any).dashboardSettings || {}
      return {
        ...prev,
        settings: {
          ...prev.settings,
          dashboardSettings: { ...currentDashboardSettings, ...updates }
        } as typeof prev.settings
      }
    })
    setHasUnsavedChanges(true)
    setIsPublished(false)
  }

  // Helper functions for recursive updates
  function updateFieldRecursive(fields: Field[], targetId: string, updates: Partial<Field>): Field[] {
    return fields.map(field => {
      if (field.id === targetId) {
        // Deep merge config to preserve existing config values
        const mergedConfig = updates.config 
          ? { ...field.config, ...updates.config }
          : field.config
        return { 
          ...field, 
          ...updates,
          config: mergedConfig
        }
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
  const supportedLanguages = Array.from(new Set([defaultLanguage, ...(config.settings.language?.supported || [])])).filter(lang => lang && lang.trim() !== '')
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
    <CollaborationProvider roomId={formId || 'new-form'} enabled={!!formId}>
    {/* Sync portal config with other collaborators via Yjs */}
    <PortalConfigSyncBridge config={config} setConfig={setConfig} />
    <DndProvider backend={HTML5Backend}>
      <div className="flex flex-col h-full bg-gray-100">
        {/* Top Bar - Full Width */}
        <div className="h-14 bg-white border-b border-gray-200 flex items-center justify-between px-4 shadow-sm z-20 shrink-0">
            <div className="flex items-center gap-4">
                {/* Presence indicators - click avatars to navigate to their location */}
                <PresenceHeader onNavigateToUser={handleNavigateToUser} />
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
                 onClick={() => setActiveTopTab('share')}
                 className={cn(
                   "px-4 py-1.5 text-sm font-medium rounded-full transition-all",
                   activeTopTab === 'share' ? "bg-white shadow-sm text-gray-900" : "text-gray-600 hover:text-gray-900"
                 )}
               >
                 Share
               </button>
            </div>

            <div className="flex items-center gap-2">           <Button 
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
            <div className="w-[380px] min-w-[380px] bg-white border-r border-gray-200 flex flex-col shadow-sm z-10 overflow-y-auto overflow-x-hidden">
          <Tabs value={leftSidebarTab === 'theme' ? 'structure' : leftSidebarTab} onValueChange={(value) => setLeftSidebarTab(value as any)} className="flex-1 flex flex-col min-h-0 overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-semibold text-gray-900">{leftSidebarTab === 'theme' ? 'Theme Settings' : 'Designer'}</h2>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    if (leftSidebarTab === 'theme') {
                      setLeftSidebarTab('structure')
                    } else {
                      setLeftSidebarTab('theme')
                      setThemePageType(activeSpecialPage === 'signup' ? 'signup' : activeSpecialPage === 'login' ? 'login' : 'sections')
                    }
                  }}
                  className="h-8 gap-1.5"
                >
                  <Palette className="w-3.5 h-3.5" />
                  {leftSidebarTab === 'theme' ? 'Back' : 'Theme'}
                </Button>
              </div>
              {leftSidebarTab !== 'theme' && (
                <TabsList className="w-full grid grid-cols-2 bg-gray-100 p-1 rounded-full h-auto">
                  <TabsTrigger value="structure" className="rounded-full data-[state=active]:bg-white data-[state=active]:shadow-sm py-1.5 text-sm font-medium">Sections</TabsTrigger>
                  <TabsTrigger value="elements" className="rounded-full data-[state=active]:bg-white data-[state=active]:shadow-sm py-1.5 text-sm font-medium">Fields</TabsTrigger>
                </TabsList>
              )}
            </div>

            {leftSidebarTab === 'theme' && (
              <div className="flex-1 overflow-y-auto">
                <PageThemeSettings
                  pageType={themePageType}
                  settings={config.settings}
                  onUpdate={(updates) => {
                    setConfig(prev => ({
                      ...prev,
                      settings: { ...prev.settings, ...updates }
                    }))
                    setHasUnsavedChanges(true)
                  }}
                  formId={formId}
                />
              </div>
            )}

            <TabsContent value="structure" className="flex-1 data-[state=active]:flex flex-col mt-0 min-h-0 overflow-hidden w-full">
              <UnifiedSidebar
                sections={config.sections}
                activeSectionId={activeSectionId}
                activeSpecialPage={activeSpecialPage}
                onSelectSection={(id) => {
                  setActiveSectionId(id)
                  setSelectedFieldId(null)
                  setSelectedEndingId(null)
                }}
                onSelectSpecialPage={(page) => {
                  setActiveSpecialPage(page)
                  if (page) {
                    setActiveSectionId('')
                    setSelectedFieldId(null)
                  }
                }}
                onReorderSections={(sections: Section[]) => {
                  setConfig(prev => ({ ...prev, sections }))
                  setHasUnsavedChanges(true)
                }}
                onDeleteSection={(sectionId: string) => {
                  setConfig(prev => ({
                    ...prev,
                    sections: prev.sections.filter(s => s.id !== sectionId)
                  }))
                  setHasUnsavedChanges(true)
                  if (activeSectionId === sectionId) {
                    const remaining = config.sections.filter(s => s.id !== sectionId)
                    if (remaining.length > 0) {
                      setActiveSectionId(remaining[0].id)
                    }
                  }
                }}
                onAddSection={(type) => handleAddSection(type as Section['sectionType'])}
                dashboardSettings={dashboardSettings}
                onDashboardSettingsChange={handleDashboardSettingsChange}
              />
            </TabsContent>

            <TabsContent value="elements" className="flex-1 mt-0 overflow-hidden data-[state=active]:flex flex-col min-h-0">
               {/* Show ending blocks if ending section is selected, otherwise show fields */}
               {activeSection?.sectionType === 'ending' ? (
                 <EndingBlocksToolbox onAddBlock={handleAddBlock} />
               ) : (
                 <FieldToolbox onAddField={handleAddField} />
               )}
            </TabsContent>
          </Tabs>
            </div>

            {/* Canvas */}
            <div className={cn(
              "flex-1 overflow-y-auto bg-gradient-to-br from-gray-100 to-gray-50 flex justify-center relative",
              activeSpecialPage === 'dashboard' ? "p-0" : "p-6"
            )}>
                {/* Background Pattern (subtle grid) - hide for dashboard */}
                {activeSpecialPage !== 'dashboard' && (
                  <div className="absolute inset-0 opacity-[0.015]" style={{
                    backgroundImage: `radial-gradient(circle, #000 1px, transparent 1px)`,
                    backgroundSize: '24px 24px'
                  }} />
                )}
                
                <div className={cn(
                  "transition-all duration-300 relative z-10",
                  activeSpecialPage === 'dashboard' 
                    ? "w-full h-full bg-gray-50" 
                    : activeSpecialPage === 'signup'
                    ? "w-full h-full" // Full width/height for signup page
                    : cn(
                        "bg-white shadow-xl border border-gray-200/80 rounded-2xl min-h-[800px]",
                        viewMode === 'mobile' ? "w-[375px]" : "w-full max-w-3xl"
                      )
                )}>
                  {isPreview ? (
                    <div className="h-full">
                      <DynamicApplicationForm 
                        config={displayConfig} 
                        isExternal={false} 
                        formId={formId || undefined}
                        initialSectionId={activeSectionId}
                      />
                    </div>
                  ) : activeSpecialPage === 'signup' ? (
                    <SignUpPreview 
                      config={displayConfig} 
                      onSelectField={setSelectedFieldId}
                      selectedFieldId={selectedFieldId}
                      formId={formId || undefined}
                      onUpdateSettings={(updates) => {
                        setConfig(prev => ({ ...prev, settings: { ...prev.settings, ...updates } }))
                        setHasUnsavedChanges(true)
                        setIsPublished(false)
                      }}
                    />
                  ) : activeSpecialPage === 'review' ? (
                    <ReviewPreview 
                      config={displayConfig}
                      onUpdateSettings={(updates) => {
                        setConfig(prev => ({ ...prev, settings: { ...prev.settings, ...updates } }))
                        setHasUnsavedChanges(true)
                        setIsPublished(false)
                      }}
                    />
                  ) : activeSpecialPage === 'dashboard' ? (
                    <div className="h-full overflow-hidden">
                      <DashboardPreview 
                        themeColor={config.settings.themeColor}
                        logoUrl={config.settings.logoUrl}
                        portalName={config.settings.name}
                        dashboardSettings={dashboardSettings}
                      />
                    </div>
                  ) : displaySection?.sectionType === 'ending' ? (
                    <ConfirmationPreview 
                      config={displayConfig}
                      onUpdateSettings={(updates) => {
                        setConfig(prev => ({ ...prev, settings: { ...prev.settings, ...updates } }))
                        setHasUnsavedChanges(true)
                        setIsPublished(false)
                      }}
                    />
                  ) : displaySection ? (
                    displaySection.sectionType === 'ending' ? (
                      // Ending Section - Show ending blocks with drag-and-drop
                      <EndingBlockEditor
                        blocks={displaySection.blocks || []}
                        onUpdate={(blocks) => handleUpdateSection(displaySection.id, { blocks })}
                        selectedBlockId={selectedBlockId}
                        onSelectBlock={setSelectedBlockId}
                        onDeleteBlock={handleDeleteBlock}
                      />
                    ) : useBlockEditor ? (
                      <BlockEditor 
                        section={displaySection} 
                        onUpdate={(updates: Partial<Section>) => handleUpdateSection(displaySection.id, updates)} 
                        selectedBlockId={selectedBlockId}
                        onSelectBlock={setSelectedBlockId}
                        onOpenSettings={() => setShowFieldSettings(true)}
                        themeColor={config.settings.themeColor}
                        formTheme={config.settings.formTheme}
                        logoUrl={config.settings.logoUrl}
                        roomId={formId || displaySection.id}
                        currentUser={currentUser || { id: workspaceId || 'anonymous', name: 'Anonymous User' }}
                        allSections={config.sections}
                        onMoveFieldToSection={handleMoveFieldToSection}
                      />
                    ) : (
                      <FormBuilder 
                        section={displaySection} 
                        onUpdate={(updates: Partial<Section>) => handleUpdateSection(displaySection.id, updates)} 
                        selectedFieldId={selectedFieldId}
                        onSelectField={setSelectedFieldId}
                      />
                    )
                  ) : (
                    <div className="flex flex-col items-center justify-center h-full text-gray-400 py-20">
                      <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mb-4">
                        <FileText className="w-7 h-7 text-gray-300" />
                      </div>
                      <p className="font-medium text-gray-600">No section selected</p>
                      <p className="text-sm text-gray-400 mt-1">Choose a section from the sidebar to start editing</p>
                    </div>
                  )}
                </div>
            </div>

            {/* Right Sidebar - Settings */}
            <div className={cn(
               "bg-white border-l border-gray-200 flex flex-col shadow-sm z-10 transition-all duration-300 ease-in-out",
               (showFieldSettings && (selectedFieldId || selectedBlockId || (displaySection?.sectionType === 'ending' && activeSectionId))) ? "w-80 translate-x-0" : "w-0 translate-x-full opacity-0"
            )}>
               <div className="flex items-center justify-between p-4 border-b border-gray-100">
                  <span className="font-semibold text-sm">
                    {displaySection?.sectionType === 'ending' 
                      ? 'Ending Settings' 
                      : (() => {
                          const selectedField = selectedBlockId 
                            ? displaySection?.fields.find((f: Field) => f.id === selectedBlockId)
                            : selectedFieldId 
                              ? displaySection?.fields.find((f: Field) => f.id === selectedFieldId)
                              : null;
                          const fieldTypes: Record<string, string> = {
                            text: 'Text Input', textarea: 'Text Area', email: 'Email', phone: 'Phone',
                            number: 'Number', url: 'URL', address: 'Address', select: 'Dropdown',
                            multiselect: 'Multi-Select', radio: 'Single Choice', checkbox: 'Checkbox',
                            date: 'Date', datetime: 'Date & Time', time: 'Time', file: 'File Upload',
                            image: 'Image Upload', signature: 'Signature', rating: 'Rating',
                            rank: 'Ranking', divider: 'Divider', heading: 'Heading',
                            paragraph: 'Paragraph', callout: 'Callout', group: 'Group',
                            repeater: 'Repeater'
                          };
                          const fieldLabel = selectedField ? fieldTypes[selectedField.type] || selectedField.type : 'Field';
                          return `${fieldLabel} Settings`;
                        })()
                    }
                  </span>
                  <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => {
                    setShowFieldSettings(false)
                    setSelectedFieldId(null)
                    setSelectedBlockId(null)
                  }}>
                    <X className="w-4 h-4" />
                  </Button>
               </div>
               <div className="flex-1 overflow-y-auto">
                   {/* Block Settings - When ending block is selected */}
                   {selectedBlockId && displaySection?.sectionType === 'ending' && (() => {
                     const selectedBlock = displaySection.blocks?.find((b: EndingBlock) => b.id === selectedBlockId)
                     if (!selectedBlock) return null
                     
                     const blockDef = getBlockDefinition(selectedBlock.blockType)
                     if (!blockDef) return null
                     
                     return (
                       <div className="p-4 space-y-4">
                         <div>
                           <h4 className="text-sm font-semibold text-gray-900 mb-2">Block Properties</h4>
                           <p className="text-xs text-gray-500 mb-4">{blockDef.label}</p>
                         </div>
                         {/* Schema-driven property editor */}
                         {blockDef.schema?.properties && Object.entries(blockDef.schema.properties).map(([propKey, propSchema]: any) => (
                           <PropertyInput
                             key={propKey}
                             propertyKey={propKey}
                             schema={propSchema}
                             value={selectedBlock.props[propKey]}
                             onChange={(value) => {
                               handleUpdateBlock(selectedBlock.id, {
                                 props: { ...selectedBlock.props, [propKey]: value }
                               })
                             }}
                           />
                         ))}
                         
                         {/* Button Visibility Controls for button-group blocks */}
                         {selectedBlock.blockType === 'button-group' && selectedBlock.props.buttons && (() => {
                           try {
                             const buttons = JSON.parse(selectedBlock.props.buttons)
                             return (
                               <div className="mt-6 pt-4 border-t border-gray-200">
                                 <h5 className="text-sm font-semibold text-gray-900 mb-3">Button Visibility</h5>
                                 <div className="space-y-2">
                                   {buttons.map((btn: any, idx: number) => (
                                     <div key={idx} className="flex items-center justify-between py-2">
                                       <span className="text-sm text-gray-700">{btn.text || `Button ${idx + 1}`}</span>
                                       <label className="relative inline-flex items-center cursor-pointer">
                                         <input
                                           type="checkbox"
                                           checked={btn.visible !== false}
                                           onChange={(e) => {
                                             const updatedButtons = [...buttons]
                                             updatedButtons[idx] = { ...updatedButtons[idx], visible: e.target.checked }
                                             handleUpdateBlock(selectedBlock.id, {
                                               props: { ...selectedBlock.props, buttons: JSON.stringify(updatedButtons) }
                                             })
                                           }}
                                           className="sr-only peer"
                                         />
                                         <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-500"></div>
                                       </label>
                                     </div>
                                   ))}
                                 </div>
                               </div>
                             )
                           } catch (e) {
                             return null
                           }
                         })()}
                       </div>
                     )
                   })()}
                   

                   
                   {/* Ending Settings - Conditions */}
                   {displaySection?.sectionType === 'ending' && activeSectionId && !selectedBlockId && (
                      <div className="p-4">
                        <ConditionBuilder
                          conditions={displaySection.conditions || []}
                          onConditionsChange={(newConditions) => {
                            handleUpdateSection(displaySection.id, { conditions: newConditions })
                          }}
                          availableFields={getAllFields()}
                        />
                      </div>
                   )}
                   {/* Field Settings for Block Editor mode - uses selectedBlockId but works with fields directly */}
                   {useBlockEditor && selectedBlockId && displaySection && (
                      <FieldSettingsPanel 
                        selectedField={findFieldRecursive(displaySection.fields, selectedBlockId) || null}
                        onUpdate={(fieldId: string, updates: Partial<Field>) => {
                          handleUpdateField(fieldId, updates)
                        }}
                        onClose={() => {
                          setShowFieldSettings(false)
                          setSelectedBlockId(null)
                        }}
                        allFields={getAllFields()}
                      />
                   )}
                   {/* Field Settings (legacy FormBuilder mode) */}
                   {!useBlockEditor && selectedFieldId && (
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
                            // Update signup field - deep merge config
                            setConfig(prev => ({
                              ...prev,
                              settings: {
                                ...prev.settings,
                                signupFields: prev.settings.signupFields.map(f => 
                                  f.id === fieldId ? { 
                                    ...f, 
                                    ...updates,
                                    config: updates.config ? { ...f.config, ...updates.config } : f.config
                                  } : f
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
        onUpdate={(updates) => {
          setConfig(prev => ({ ...prev, ...updates }))
          setHasUnsavedChanges(true)
        }}
      />
    </DndProvider>
    </CollaborationProvider>
  )
}