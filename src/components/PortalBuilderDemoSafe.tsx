'use client'

import { useState, useEffect } from 'react'
import { DndProvider } from 'react-dnd'
import { HTML5Backend } from 'react-dnd-html5-backend'
import { 
  Layout, Settings, FileText, Plus, Save, Eye,
  ChevronLeft, Monitor, Smartphone, Palette, Lock, Loader2, X, CheckCircle2,
  BookOpen, CheckCircle, Eye as EyeIcon, ScrollText, LayoutDashboard, ArrowLeft
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/ui-components/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/ui-components/tabs'
import { ScrollArea } from '@/ui-components/scroll-area'
import { Separator } from '@/ui-components/separator'
import { BlockEditor } from '@/components/PortalBuilder/BlockEditor'
import { UnifiedSidebar } from '@/components/PortalBuilder/UnifiedSidebar'
import { FieldSettingsPanel } from '@/components/PortalBuilder/FieldSettingsPanel'
import { DynamicApplicationForm } from '@/components/ApplicationsHub/Applications/ApplicantPortal/DynamicApplicationForm'
import { PortalConfig, Section, Field } from '@/types/portal'
import { v4 as uuidv4 } from 'uuid'

// Demo configuration with sample data
const DEMO_CONFIG: PortalConfig = {
  sections: [
    {
      id: 'personal',
      title: 'Personal Information',
      sectionType: 'form',
      fields: [
        { 
          id: '1', 
          type: 'text', 
          label: 'Full Name', 
          required: true, 
          width: 'full',
          placeholder: 'Enter your full name'
        },
        { 
          id: '2', 
          type: 'email', 
          label: 'Email Address', 
          required: true, 
          width: 'half',
          placeholder: 'your.email@example.com'
        },
        { 
          id: '3', 
          type: 'phone', 
          label: 'Phone Number', 
          required: false, 
          width: 'half',
          placeholder: '+1 (555) 123-4567'
        }
      ]
    },
    {
      id: 'education',
      title: 'Educational Background',
      sectionType: 'form',
      fields: [
        { 
          id: '4', 
          type: 'text', 
          label: 'Current School/University', 
          required: true, 
          width: 'full',
          placeholder: 'Enter your school name'
        },
        { 
          id: '5', 
          type: 'select', 
          label: 'Grade Level', 
          required: true, 
          width: 'half',
          options: ['High School Senior', 'College Freshman', 'College Sophomore', 'College Junior', 'College Senior', 'Graduate Student']
        },
        { 
          id: '6', 
          type: 'number', 
          label: 'GPA', 
          required: false, 
          width: 'half',
          placeholder: '3.5'
        }
      ]
    }
  ],
  settings: {
    name: 'Demo Scholarship Portal',
    description: 'Interactive portal builder demonstration',
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
      { id: 'email', type: 'email', label: 'Email', required: true },
      { id: 'password', type: 'password', label: 'Password', required: true }
    ],
    signupFields: [
      { id: 'name', type: 'text', label: 'Name', required: true },
      { id: 'email', type: 'email', label: 'Email', required: true },
      { id: 'password', type: 'password', label: 'Password', required: true }
    ],
  }
}

// Utility functions from the real PortalEditor
const findFieldRecursive = (fields: Field[], fieldId: string): Field | null => {
  for (const field of fields) {
    if (field.id === fieldId) return field
    if (field.children) {
      const found = findFieldRecursive(field.children, fieldId)
      if (found) return found
    }
  }
  return null
}

const updateFieldRecursive = (fields: Field[], fieldId: string, updates: Partial<Field>): Field[] => {
  return fields.map(field => {
    if (field.id === fieldId) {
      return { ...field, ...updates }
    }
    if (field.children) {
      return { ...field, children: updateFieldRecursive(field.children, fieldId, updates) }
    }
    return field
  })
}

const deleteFieldRecursive = (fields: Field[], fieldId: string): Field[] => {
  return fields.filter(field => {
    if (field.id === fieldId) return false
    if (field.children) {
      field.children = deleteFieldRecursive(field.children, fieldId)
    }
    return true
  })
}

export function PortalBuilderDemoSafe() {
  const [config, setConfig] = useState<PortalConfig>(DEMO_CONFIG)
  const [activeSectionId, setActiveSectionId] = useState<string>(DEMO_CONFIG.sections[0].id)
  const [activeSpecialPage, setActiveSpecialPage] = useState<'signup' | 'review' | 'dashboard' | null>(null)
  const [selectedFieldId, setSelectedFieldId] = useState<string | null>(null)
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null)
  const [showFieldSettings, setShowFieldSettings] = useState(false)
  const [viewMode, setViewMode] = useState<'desktop' | 'mobile'>('desktop')
  const [isPreview, setIsPreview] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)
  const [rightSidebarTab, setRightSidebarTab] = useState<'add' | 'settings'>('add')
  
  // Mock dashboard settings for the demo
  const mockDashboardSettings = {
    showStatus: true,
    showTimeline: true,
    showChat: true,
    showDocuments: true,
    welcomeTitle: 'Welcome to Your Dashboard',
    welcomeText: 'Track your application progress and communicate with our team.'
  }

  const currentSection = config.sections.find(s => s.id === activeSectionId)

  // Handle field updates
  const handleUpdateField = (fieldId: string, updates: Partial<Field>) => {
    setConfig(prev => ({
      ...prev,
      sections: prev.sections.map(section =>
        section.id === activeSectionId
          ? { ...section, fields: updateFieldRecursive(section.fields, fieldId, updates) }
          : section
      )
    }))
    setHasUnsavedChanges(true)
  }

  // Handle field deletion
  const handleDeleteField = (fieldId: string) => {
    if (selectedFieldId === fieldId) setSelectedFieldId(null)
    setConfig(prev => ({
      ...prev,
      sections: prev.sections.map(section =>
        section.id === activeSectionId
          ? { ...section, fields: deleteFieldRecursive(section.fields, fieldId) }
          : section
      )
    }))
    setHasUnsavedChanges(true)
  }

  // Handle section updates
  const handleUpdateSection = (sectionId: string, updates: Partial<Section>) => {
    setConfig(prev => ({
      ...prev,
      sections: prev.sections.map(section =>
        section.id === sectionId ? { ...section, ...updates } : section
      )
    }))
    setHasUnsavedChanges(true)
  }

  // Add new section
  const handleAddSection = () => {
    const newSection: Section = {
      id: uuidv4(),
      title: 'New Section',
      sectionType: 'form',
      fields: []
    }
    setConfig(prev => ({
      ...prev,
      sections: [...prev.sections, newSection]
    }))
    setActiveSectionId(newSection.id)
    setHasUnsavedChanges(true)
  }

  // Mock save function
  const handleSave = async () => {
    setIsSaving(true)
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1000))
    setIsSaving(false)
    setHasUnsavedChanges(false)
  }

  // Handle field selection
  useEffect(() => {
    if (selectedFieldId || selectedBlockId) {
      setShowFieldSettings(true)
      setRightSidebarTab('settings')
    }
  }, [selectedFieldId, selectedBlockId])

  const displaySection = currentSection || config.sections[0]
  const selectedField = selectedFieldId ? findFieldRecursive(displaySection?.fields || [], selectedFieldId) : null

  return (
    <DndProvider backend={HTML5Backend}>
      <div className="flex flex-col h-full bg-gray-100">
        {/* Top Bar */}
        <div className="h-14 bg-white border-b border-gray-200 flex items-center justify-between px-4 shadow-sm z-20 shrink-0">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 bg-blue-600 rounded flex items-center justify-center">
                <span className="text-white font-bold text-xs">M</span>
              </div>
              <span className="font-semibold text-gray-900">Portal Builder Demo</span>
            </div>
            <div className="text-sm text-gray-500">
              {config.settings.name}
            </div>
          </div>

          <div className="flex items-center gap-2">
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
                !hasUnsavedChanges
                  ? "bg-green-600 hover:bg-green-700" 
                  : "bg-blue-600 hover:bg-blue-700"
              )}
              onClick={handleSave}
              disabled={isSaving}
            >
              {isSaving ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : !hasUnsavedChanges ? (
                <CheckCircle2 className="w-4 h-4 mr-2" />
              ) : (
                <Save className="w-4 h-4 mr-2" />
              )}
              {!hasUnsavedChanges ? 'Saved' : 'Save Demo'}
            </Button>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 flex overflow-hidden">
          {/* Left Sidebar */}
          <div className="w-[380px] min-w-[380px] bg-white border-r border-gray-200 flex flex-col shadow-sm z-10 overflow-y-auto overflow-x-hidden">
            <UnifiedSidebar
              sections={config.sections}
              activeSectionId={activeSectionId}
              activeSpecialPage={activeSpecialPage}
              dashboardSettings={mockDashboardSettings}
              onSelectSection={(id) => {
                setActiveSectionId(id)
                setSelectedFieldId(null)
                setActiveSpecialPage(null)
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
              onAddSection={handleAddSection}
              onDeleteSection={(sectionId) => {
                setConfig(prev => ({
                  ...prev,
                  sections: prev.sections.filter(s => s.id !== sectionId)
                }))
                if (activeSectionId === sectionId && config.sections.length > 1) {
                  const remainingSections = config.sections.filter(s => s.id !== sectionId)
                  setActiveSectionId(remainingSections[0].id)
                }
                setHasUnsavedChanges(true)
              }}
              onDashboardSettingsChange={(settings) => {
                // Handle dashboard settings change
                console.log('Dashboard settings changed:', settings)
              }}
            />
          </div>

          {/* Canvas */}
          <div className="flex-1 bg-gradient-to-br from-gray-100 to-gray-50 flex justify-center relative overflow-y-auto p-3">
            <div className="absolute inset-0 opacity-[0.015]" style={{
              backgroundImage: `radial-gradient(circle, #000 1px, transparent 1px)`,
              backgroundSize: '24px 24px'
            }} />
            
            <div 
              className={cn(
                "transition-all duration-300 relative z-10 bg-white shadow-xl border border-gray-200/80 rounded-2xl w-full overflow-y-auto max-h-full",
                viewMode === 'mobile' && "max-w-[375px]"
              )}
            >
              {isPreview ? (
                <DynamicApplicationForm 
                  config={config}
                  onSubmit={() => {}}
                  onSaveDraft={() => {}}
                  isSubmitting={false}
                  isSavingDraft={false}
                />
              ) : (
                displaySection && displaySection.sectionType === 'form' ? (
                  <BlockEditor
                    section={displaySection}
                    onUpdate={(updates) => handleUpdateSection(displaySection.id, updates)}
                    selectedBlockId={selectedBlockId}
                    onSelectBlock={setSelectedBlockId}
                    themeColor={config.settings.themeColor}
                    formTheme={{
                      primary: config.settings.themeColor || '#3B82F6',
                      font: config.settings.font || 'inter',
                      buttonStyle: config.settings.buttonStyle || 'rounded'
                    }}
                    logoUrl={config.settings.logoUrl}
                    roomId="demo-room"
                    currentUser={{ id: 'demo-user', name: 'Demo User' }}
                    allSections={config.sections}
                    onMoveFieldToSection={(fieldId, targetSectionId) => {
                      // Implementation for moving fields between sections
                      console.log('Move field', fieldId, 'to section', targetSectionId)
                    }}
                    onOpenSettings={() => {
                      setShowFieldSettings(true)
                      setRightSidebarTab('settings')
                    }}
                  />
                ) : (
                  <div className="flex flex-col items-center justify-center h-full text-gray-400 py-20">
                    <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mb-4">
                      <FileText className="w-7 h-7 text-gray-300" />
                    </div>
                    <p className="font-medium text-gray-600">No section selected</p>
                    <p className="text-sm text-gray-400 mt-1">Choose a section from the sidebar to start editing</p>
                  </div>
                )
              )}
            </div>
          </div>

          {/* Right Sidebar - Field Settings */}
          <div className={cn(
            "bg-white border-l border-gray-200 flex flex-col shadow-sm z-10 transition-all duration-300 ease-in-out",
            (showFieldSettings && (selectedFieldId || selectedBlockId)) ? "w-80 translate-x-0" : "w-0 translate-x-full opacity-0"
          )}>
            <div className="flex items-center justify-between p-4 border-b border-gray-100">
              <span className="font-semibold text-sm">
                Field Settings
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setShowFieldSettings(false)
                  setSelectedFieldId(null)
                  setSelectedBlockId(null)
                }}
                className="h-6 w-6 p-0"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
            
            <div className="flex-1 overflow-y-auto">
              {selectedField && (
                <FieldSettingsPanel
                  field={selectedField}
                  onUpdate={(updates) => handleUpdateField(selectedField.id, updates)}
                  onDelete={() => handleDeleteField(selectedField.id)}
                  allFields={displaySection?.fields || []}
                />
              )}
            </div>
          </div>
        </div>
      </div>
    </DndProvider>
  )
}