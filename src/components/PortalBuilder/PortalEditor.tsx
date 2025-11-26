'use client'

import { useState, useEffect } from 'react'
import { DndProvider } from 'react-dnd'
import { HTML5Backend } from 'react-dnd-html5-backend'
import { 
  Layout, Settings, FileText, Plus, Save, Eye, 
  ChevronLeft, Monitor, Smartphone, Palette, Lock, Loader2
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
import { DynamicApplicationForm } from '@/components/ApplicationsHub/Scholarships/ApplicantPortal/DynamicApplicationForm'
import { PortalConfig, Section, Field } from '@/types/portal'
import { formsClient } from '@/lib/api/forms-client'
import { workspacesClient } from '@/lib/api/workspaces-client'
import { toast } from 'sonner'

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

  const activeSection = config.sections.find(s => s.id === activeSectionId)

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
                     loginFields: fullForm.settings.loginFields,
                     signupFields: fullForm.settings.signupFields
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
                     loginFields: fullForm.settings?.loginFields,
                     signupFields: fullForm.settings?.signupFields
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
            toast.success('Portal saved successfully')
        } else {
            const newForm = await formsClient.create({
                workspace_id: workspace.id,
                name: config.settings.name,
                description: 'Generated Portal'
            }) as any
            setFormId(newForm.id)
            await formsClient.updateStructure(newForm.id, config)
            toast.success('Portal created and saved')
        }
    } catch (error) {
        console.error('Failed to save:', error)
        toast.error('Failed to save portal')
    } finally {
        setIsSaving(false)
    }
  }

  const handleUpdateSection = (sectionId: string, updates: Partial<Section>) => {
    setConfig(prev => ({
      ...prev,
      sections: prev.sections.map(s => s.id === sectionId ? { ...s, ...updates } : s)
    }))
  }

  const handleAddSection = () => {
    const newSection: Section = {
      id: Date.now().toString(),
      title: 'New Section',
      fields: []
    }
    setConfig(prev => ({ ...prev, sections: [...prev.sections, newSection] }))
    setActiveSectionId(newSection.id)
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
      <div className="flex h-full bg-gray-50">
        {/* Left Sidebar - Navigation */}
        <div className="w-64 bg-white border-r border-gray-200 flex flex-col">
          <div className="p-4 border-b border-gray-200">
            <div className="flex items-center gap-2 font-semibold text-gray-900">
              <Layout className="w-5 h-5 text-blue-600" />
              Portal Builder
            </div>
          </div>
          
          <Tabs defaultValue="structure" className="flex-1 flex flex-col">
            <div className="px-4 pt-4">
              <TabsList className="w-full grid grid-cols-2">
                <TabsTrigger value="structure">Structure</TabsTrigger>
                <TabsTrigger value="settings">Settings</TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value="structure" className="flex-1 flex flex-col mt-0">
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

            <TabsContent value="settings" className="flex-1 p-4">
              <div className="space-y-1">
                <Button variant="ghost" className="w-full justify-start gap-2" onClick={() => setActiveSectionId('branding')}>
                  <Palette className="w-4 h-4" /> Branding
                </Button>
                <Button variant="ghost" className="w-full justify-start gap-2" onClick={() => setActiveSectionId('auth')}>
                  <Lock className="w-4 h-4" /> Login & Signup
                </Button>
              </div>
            </TabsContent>
          </Tabs>
        </div>

        {/* Main Content - Editor */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Toolbar */}
          <div className="h-14 bg-white border-b border-gray-200 flex items-center justify-between px-4">
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

            <div className="flex items-center gap-2">
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
                className="bg-blue-600 hover:bg-blue-700"
                onClick={handleSave}
                disabled={isSaving}
              >
                {isSaving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                Save Changes
              </Button>
            </div>
          </div>

          {/* Canvas */}
          <div className="flex-1 overflow-y-auto p-8 bg-gray-50/50">
            <div className={cn(
              "mx-auto bg-white shadow-sm border border-gray-200 rounded-xl transition-all duration-300 min-h-[600px]",
              viewMode === 'mobile' ? "max-w-[375px]" : "max-w-4xl"
            )}>
              {isPreview ? (
                <div className="p-4">
                  <DynamicApplicationForm config={config} isExternal={true} />
                </div>
              ) : activeSectionId === 'branding' || activeSectionId === 'auth' ? (
                <PortalSettings 
                  type={activeSectionId} 
                  settings={config.settings} 
                  onUpdate={(updates: Partial<PortalConfig['settings']>) => setConfig(prev => ({ ...prev, settings: { ...prev.settings, ...updates } }))} 
                />
              ) : activeSection ? (
                <FormBuilder 
                  section={activeSection} 
                  onUpdate={(updates: Partial<Section>) => handleUpdateSection(activeSection.id, updates)} 
                />
              ) : (
                <div className="flex items-center justify-center h-full text-gray-400">
                  Select a section to edit
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Sidebar - Field Toolbox */}
        {!isPreview && activeSection && activeSectionId !== 'branding' && activeSectionId !== 'auth' && (
          <div className="w-64 bg-white border-l border-gray-200 flex flex-col">
            <FieldToolbox onAddField={handleAddField} />
          </div>
        )}
      </div>
    </DndProvider>
  )
}
