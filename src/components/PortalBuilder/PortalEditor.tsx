'use client'

import { useState, useEffect } from 'react'
import { DndProvider } from 'react-dnd'
import { HTML5Backend } from 'react-dnd-html5-backend'
import { 
  Layout, Settings, FileText, Plus, Save, Eye, 
  ChevronLeft, Monitor, Smartphone, Palette, Lock, Loader2, X, CheckCircle2
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
import { DynamicApplicationForm } from '@/components/ApplicationsHub/Scholarships/ApplicantPortal/DynamicApplicationForm'
import { PortalConfig, Section, Field } from '@/types/portal'
import { formsClient } from '@/lib/api/forms-client'
import { workspacesClient } from '@/lib/api/workspaces-client'
import { toast } from 'sonner'
import { SettingsModal } from './SettingsModal'

const INITIAL_CONFIG: PortalConfig = {
  sections: [
    {
      id: 'personal',
      title: 'Personal Information',
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
    loginFields: [
      { id: 'l1', type: 'email', label: 'Email', required: true, width: 'full' },
      { id: 'l2', type: 'text', label: 'Password', required: true, width: 'full' }
    ],
    signupFields: [
      { id: 's1', type: 'text', label: 'Full Name', required: true, width: 'full' },
      { id: 's2', type: 'email', label: 'Email', required: true, width: 'full' }
    ]
  }
}

export function PortalEditor({ workspaceSlug, initialFormId }: { workspaceSlug: string, initialFormId?: string | null }) {
  const [config, setConfig] = useState<PortalConfig>(INITIAL_CONFIG)
  const [activeSectionId, setActiveSectionId] = useState<string>(INITIAL_CONFIG.sections[0].id)
  const [viewMode, setViewMode] = useState<'desktop' | 'mobile'>('desktop')
  const [isPreview, setIsPreview] = useState(false)
  const [formId, setFormId] = useState<string | null>(initialFormId || null)
  const [isLoading, setIsLoading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const [isPublished, setIsPublished] = useState(false)
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)
  
  const [selectedFieldId, setSelectedFieldId] = useState<string | null>(null)
  const [rightSidebarTab, setRightSidebarTab] = useState<'add' | 'settings'>('add')
  const [activeTopTab, setActiveTopTab] = useState<'edit' | 'integrate' | 'share'>('edit')

  const activeSection = config.sections.find(s => s.id === activeSectionId)

  useEffect(() => {
    if (selectedFieldId) {
      setRightSidebarTab('settings')
    }
  }, [selectedFieldId])

  useEffect(() => {
    const loadForm = async () => {
      setIsLoading(true)
      try {
        const workspace = await workspacesClient.getBySlug(workspaceSlug)
        if (!workspace) {
          toast.error('Workspace not found')
          return
        }

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
          console.log('Full Form Loaded:', fullForm)
          
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
                        return {
                            id: f.id,
                            type: f.type,
                            label: f.label,
                            required: config.is_required,
                            width: config.width || 'full',
                            placeholder: config.placeholder,
                            options: config.items,
                            children: config.children // For groups/repeaters
                        }
                    });

                 return {
                     ...section,
                     fields: sectionFields
                 };
             });

             setConfig({
                 sections: sections,
                 settings: {
                     name: fullForm.name,
                     themeColor: fullForm.settings.themeColor || '#3B82F6',
                     logoUrl: fullForm.settings.logoUrl,
                     loginFields: fullForm.settings.loginFields || INITIAL_CONFIG.settings.loginFields,
                     signupFields: fullForm.settings.signupFields || INITIAL_CONFIG.settings.signupFields
                 }
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
                        return {
                            id: f.id,
                            type: f.type,
                            label: f.label,
                            required: config.is_required,
                            width: config.width || 'full',
                            placeholder: config.placeholder,
                            options: config.items,
                            children: config.children
                        }
                  }).sort((a: any, b: any) => (a.position || 0) - (b.position || 0))
              }
              
              setConfig({
                  sections: [defaultSection],
                  settings: {
                     name: fullForm.name,
                     themeColor: fullForm.settings?.themeColor || '#3B82F6',
                     logoUrl: fullForm.settings?.logoUrl,
                     loginFields: fullForm.settings?.loginFields || INITIAL_CONFIG.settings.loginFields,
                     signupFields: fullForm.settings?.signupFields || INITIAL_CONFIG.settings.signupFields
                  }
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
    } catch (error) {
        console.error('Failed to save:', error)
        toast.error('Failed to publish portal')
    } finally {
        setIsSaving(false)
    }
  }

  const handleUpdateSection = (sectionId: string, updates: Partial<Section>) => {
    setConfig(prev => ({
      ...prev,
      sections: prev.sections.map(s => s.id === sectionId ? { ...s, ...updates } : s)
    }))
    setHasUnsavedChanges(true)
    setIsPublished(false)
  }

  const handleUpdateField = (fieldId: string, updates: Partial<Field>) => {
    if (!activeSection) return
    const updatedFields = updateFieldRecursive(activeSection.fields, fieldId, updates)
    handleUpdateSection(activeSection.id, { fields: updatedFields })
  }

  const handleAddSection = () => {
    const newSection: Section = {
      id: Date.now().toString(),
      title: 'New Section',
      fields: []
    }
    setConfig(prev => ({ ...prev, sections: [...prev.sections, newSection] }))
    setActiveSectionId(newSection.id)
    setHasUnsavedChanges(true)
    setIsPublished(false)
  }

  const handleAddField = (type: Field['type']) => {
    if (!activeSection) return
    const newField: Field = {
      id: Date.now().toString(),
      type,
      label: 'New Field',
      required: false,
      width: 'full'
    }
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
              <div className="p-4 pb-2 flex justify-between items-center">
                <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Sections</span>
                <Button variant="ghost" size="sm" onClick={handleAddSection}>
                  <Plus className="w-4 h-4" />
                </Button>
              </div>
              <ScrollArea className="flex-1">
                <SectionList 
                  sections={config.sections} 
                  activeId={activeSectionId} 
                  onSelect={setActiveSectionId}
                  onReorder={(sections: Section[]) => setConfig(prev => ({ ...prev, sections }))}
                />
              </ScrollArea>
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
                  "bg-white shadow-lg border border-gray-200 rounded-xl transition-all duration-300 min-h-[800px]",
                  viewMode === 'mobile' ? "w-[375px]" : "w-full max-w-3xl"
                )}>
                  {isPreview ? (
                    <div className="p-4">
                      <DynamicApplicationForm config={config} isExternal={true} />
                    </div>
                  ) : activeSection ? (
                    <FormBuilder 
                      section={activeSection} 
                      onUpdate={(updates: Partial<Section>) => handleUpdateSection(activeSection.id, updates)} 
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
                        selectedField={activeSection ? findFieldRecursive(activeSection.fields, selectedFieldId) : null}
                        onUpdate={handleUpdateField}
                        onClose={() => setSelectedFieldId(null)}
                        allFields={getAllFields()}
                      />
                   )}
               </div>
            </div>
        </div>
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