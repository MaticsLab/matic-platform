/**
 * Dashboard Builder - Configure the applicant dashboard layout
 */

'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { 
  Plus, 
  Trash2, 
  GripVertical, 
  Eye,
  Settings,
  MessageSquare,
  Clock,
  FileText,
  CheckCircle2,
  ChevronUp,
  ChevronDown
} from 'lucide-react'
import { Button } from '@/ui-components/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/ui-components/card'
import { Input } from '@/ui-components/input'
import { Label } from '@/ui-components/label'
import { Switch } from '@/ui-components/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/ui-components/tabs'
import { cn } from '@/lib/utils'
import { dashboardClient } from '@/lib/api/dashboard-client'
import type { DashboardLayout, DashboardSection, DashboardSettings } from '@/types/dashboard'
import { toast } from 'sonner'
import { v4 as uuid } from 'uuid'

interface DashboardBuilderProps {
  formId: string
  onSave?: (layout: DashboardLayout) => Promise<void>
  /** Render settings in external panel (e.g., sidebar). Pass the component that receives layout/onUpdate props */
  renderSettingsExternally?: boolean
  /** Callback when layout changes (for external settings sync) */
  onLayoutChange?: (layout: DashboardLayout) => void
  /** External layout to use (when controlled externally) */
  externalLayout?: DashboardLayout | null
}

const SECTION_TYPES = [
  { type: 'status', label: 'Status Card', icon: CheckCircle2, description: 'Show application status and stage' },
  { type: 'timeline', label: 'Timeline', icon: Clock, description: 'Activity timeline and history' },
  { type: 'chat', label: 'Messages', icon: MessageSquare, description: 'Chat between applicant and staff' },
  { type: 'fields', label: 'Custom Fields', icon: FileText, description: 'Display specific form fields' },
  { type: 'documents', label: 'Documents', icon: FileText, description: 'Uploaded files and documents' },
] as const

const DEFAULT_LAYOUT: DashboardLayout = {
  sections: [
    { id: 'status', title: 'Application Status', type: 'status' },
    { id: 'timeline', title: 'Timeline', type: 'timeline' },
    { id: 'messages', title: 'Messages', type: 'chat' },
  ],
  settings: {
    showStatus: true,
    showTimeline: true,
    showChat: true,
    showDocuments: true,
    welcomeTitle: 'Your Application Dashboard',
    welcomeText: 'Track your application status and communicate with our team.',
  }
}

export function DashboardBuilder({ 
  formId, 
  onSave,
  renderSettingsExternally = false,
  onLayoutChange,
  externalLayout
}: DashboardBuilderProps) {
  const [layout, setLayoutInternal] = useState<DashboardLayout>(DEFAULT_LAYOUT)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [activeTab, setActiveTab] = useState<'sections' | 'settings' | 'preview'>('sections')
  const [selectedSectionIndex, setSelectedSectionIndex] = useState<number | null>(null)

  // Use external layout if provided, otherwise use internal state
  const effectiveLayout = externalLayout ?? layout

  // Wrapper to update both internal state and notify parent
  const setLayout = useCallback((updater: DashboardLayout | ((prev: DashboardLayout) => DashboardLayout)) => {
    setLayoutInternal(prev => {
      const newLayout = typeof updater === 'function' ? updater(prev) : updater
      onLayoutChange?.(newLayout)
      return newLayout
    })
  }, [onLayoutChange])

  useEffect(() => {
    loadLayout()
  }, [formId])

  const loadLayout = async () => {
    try {
      setIsLoading(true)
      const data = await dashboardClient.getLayout(formId)
      if (data && data.sections?.length > 0) {
        setLayout(data)
      }
    } catch (error) {
      console.warn('Using default layout:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleSave = async () => {
    setIsSaving(true)
    try {
      if (onSave) {
        await onSave(layout)
      } else {
        await dashboardClient.updateLayout(formId, layout)
      }
      toast.success('Dashboard layout saved')
    } catch (error) {
      toast.error('Failed to save layout')
      console.error(error)
    } finally {
      setIsSaving(false)
    }
  }

  const addSection = (type: DashboardSection['type']) => {
    const typeInfo = SECTION_TYPES.find(t => t.type === type)
    const newSection: DashboardSection = {
      id: uuid(),
      title: typeInfo?.label || 'New Section',
      type,
    }
    setLayout(prev => ({
      ...prev,
      sections: [...prev.sections, newSection]
    }))
  }

  const updateSection = (index: number, updates: Partial<DashboardSection>) => {
    setLayout(prev => ({
      ...prev,
      sections: prev.sections.map((s, i) => i === index ? { ...s, ...updates } : s)
    }))
  }

  const removeSection = (index: number) => {
    setLayout(prev => ({
      ...prev,
      sections: prev.sections.filter((_, i) => i !== index)
    }))
    setSelectedSectionIndex(null)
  }

  const moveSection = (index: number, direction: 'up' | 'down') => {
    const newSections = [...layout.sections]
    const targetIndex = direction === 'up' ? index - 1 : index + 1
    if (targetIndex < 0 || targetIndex >= newSections.length) return
    
    [newSections[index], newSections[targetIndex]] = [newSections[targetIndex], newSections[index]]
    setLayout(prev => ({ ...prev, sections: newSections }))
  }

  const updateSettings = (updates: Partial<DashboardSettings>) => {
    setLayout(prev => ({
      ...prev,
      settings: { ...prev.settings, ...updates }
    }))
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
          <p className="text-sm text-gray-500">Loading dashboard configuration...</p>
        </div>
      </div>
    )
  }

  // When rendering settings externally, just show sections editor in full view
  if (renderSettingsExternally) {
    return (
      <div className="flex flex-col h-full">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 bg-white">
          <div>
            <h2 className="text-2xl font-bold">Applicant Dashboard</h2>
            <p className="text-sm text-gray-600">Configure what applicants see after submitting</p>
          </div>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? 'Saving...' : 'Save Dashboard'}
          </Button>
        </div>

        {/* Full-width sections editor */}
        <div className="flex-1 overflow-hidden flex gap-4 p-6 bg-gray-50">
          {/* Sections List */}
          <div className="w-80 bg-white rounded-lg border border-gray-200 overflow-hidden flex flex-col shrink-0">
            <div className="p-4 border-b border-gray-200 flex items-center justify-between">
              <h3 className="font-semibold text-sm">Sections ({effectiveLayout.sections.length})</h3>
            </div>
            
            <div className="flex-1 overflow-y-auto p-2 space-y-1">
              {effectiveLayout.sections.map((section, index) => {
                const TypeIcon = SECTION_TYPES.find(t => t.type === section.type)?.icon || FileText
                return (
                  <div
                    key={section.id}
                    className={cn(
                      "group flex items-center gap-2 px-3 py-2 rounded cursor-pointer transition-colors",
                      selectedSectionIndex === index ? 'bg-blue-100' : 'hover:bg-gray-100'
                    )}
                    onClick={() => setSelectedSectionIndex(index)}
                  >
                    <div className="flex flex-col opacity-0 group-hover:opacity-100">
                      <button
                        onClick={(e) => { e.stopPropagation(); moveSection(index, 'up') }}
                        disabled={index === 0}
                        className="p-0.5 hover:bg-gray-200 rounded disabled:opacity-30"
                      >
                        <ChevronUp className="w-3 h-3" />
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); moveSection(index, 'down') }}
                        disabled={index === effectiveLayout.sections.length - 1}
                        className="p-0.5 hover:bg-gray-200 rounded disabled:opacity-30"
                      >
                        <ChevronDown className="w-3 h-3" />
                      </button>
                    </div>
                    <TypeIcon className="w-4 h-4 text-gray-500" />
                    <span className="flex-1 text-sm truncate">{section.title}</span>
                    <button
                      onClick={(e) => { e.stopPropagation(); removeSection(index) }}
                      className="opacity-0 group-hover:opacity-100 p-1 hover:bg-red-100 rounded text-red-500"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                )
              })}
            </div>

            {/* Add Section */}
            <div className="p-4 border-t border-gray-200">
              <p className="text-xs font-semibold text-gray-500 mb-2">ADD SECTION</p>
              <div className="grid grid-cols-2 gap-1">
                {SECTION_TYPES.map(({ type, label, icon: Icon }) => (
                  <button
                    key={type}
                    onClick={() => addSection(type)}
                    className="flex items-center gap-1.5 px-2 py-1.5 text-xs hover:bg-gray-100 rounded transition-colors"
                  >
                    <Icon className="w-3 h-3" />
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Section Editor / Preview */}
          <div className="flex-1 bg-white rounded-lg border border-gray-200 overflow-hidden flex flex-col">
            {selectedSectionIndex !== null && effectiveLayout.sections[selectedSectionIndex] ? (
              <div className="p-6 space-y-4">
                <h3 className="font-semibold">Edit Section</h3>
                
                <div className="space-y-4">
                  <div>
                    <Label>Title</Label>
                    <Input
                      value={effectiveLayout.sections[selectedSectionIndex].title}
                      onChange={(e) => updateSection(selectedSectionIndex, { title: e.target.value })}
                    />
                  </div>
                  
                  <div>
                    <Label>Description (optional)</Label>
                    <Input
                      value={effectiveLayout.sections[selectedSectionIndex].description || ''}
                      onChange={(e) => updateSection(selectedSectionIndex, { description: e.target.value })}
                      placeholder="Optional description text"
                    />
                  </div>

                  {effectiveLayout.sections[selectedSectionIndex].type === 'fields' && (
                    <div>
                      <Label>Field IDs (comma-separated)</Label>
                      <Input
                        value={effectiveLayout.sections[selectedSectionIndex].fields?.join(', ') || ''}
                        onChange={(e) => updateSection(selectedSectionIndex, {
                          fields: e.target.value.split(',').map(f => f.trim()).filter(Boolean)
                        })}
                        placeholder="email, name, phone"
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        Enter the field IDs you want to display in this section
                      </p>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="h-full flex items-center justify-center text-gray-400">
                <p>Select a section to edit</p>
              </div>
            )}
          </div>
        </div>
      </div>
    )
  }

  // Original tabbed UI for standalone usage
  return (
    <div className="flex flex-col h-full bg-gray-50">
      {/* Header */}
      <div className="flex items-center justify-between p-6 border-b border-gray-200 bg-white">
        <div>
          <h2 className="text-2xl font-bold">Applicant Dashboard</h2>
          <p className="text-sm text-gray-600">Configure what applicants see after submitting</p>
        </div>
        <Button onClick={handleSave} disabled={isSaving}>
          {isSaving ? 'Saving...' : 'Save Dashboard'}
        </Button>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="flex-1 flex flex-col overflow-hidden">
        <div className="px-6 pt-4 bg-white border-b">
          <TabsList>
            <TabsTrigger value="sections">Sections</TabsTrigger>
            <TabsTrigger value="settings">Settings</TabsTrigger>
            <TabsTrigger value="preview">Preview</TabsTrigger>
          </TabsList>
        </div>

        {/* Sections Tab */}
        <TabsContent value="sections" className="flex-1 overflow-hidden flex gap-4 p-4">
          {/* Sections List */}
          <div className="w-1/3 bg-white rounded-lg border border-gray-200 overflow-hidden flex flex-col">
            <div className="p-4 border-b border-gray-200 flex items-center justify-between">
              <h3 className="font-semibold text-sm">Sections ({layout.sections.length})</h3>
            </div>
            
            <div className="flex-1 overflow-y-auto p-2 space-y-1">
              {layout.sections.map((section, index) => {
                const TypeIcon = SECTION_TYPES.find(t => t.type === section.type)?.icon || FileText
                return (
                  <div
                    key={section.id}
                    className={cn(
                      "group flex items-center gap-2 px-3 py-2 rounded cursor-pointer transition-colors",
                      selectedSectionIndex === index ? 'bg-blue-100' : 'hover:bg-gray-100'
                    )}
                    onClick={() => setSelectedSectionIndex(index)}
                  >
                    <div className="flex flex-col opacity-0 group-hover:opacity-100">
                      <button
                        onClick={(e) => { e.stopPropagation(); moveSection(index, 'up') }}
                        disabled={index === 0}
                        className="p-0.5 hover:bg-gray-200 rounded disabled:opacity-30"
                      >
                        <ChevronUp className="w-3 h-3" />
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); moveSection(index, 'down') }}
                        disabled={index === layout.sections.length - 1}
                        className="p-0.5 hover:bg-gray-200 rounded disabled:opacity-30"
                      >
                        <ChevronDown className="w-3 h-3" />
                      </button>
                    </div>
                    <TypeIcon className="w-4 h-4 text-gray-500" />
                    <span className="flex-1 text-sm truncate">{section.title}</span>
                    <button
                      onClick={(e) => { e.stopPropagation(); removeSection(index) }}
                      className="opacity-0 group-hover:opacity-100 p-1 hover:bg-red-100 rounded text-red-500"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                )
              })}
            </div>

            {/* Add Section */}
            <div className="p-4 border-t border-gray-200">
              <p className="text-xs font-semibold text-gray-500 mb-2">ADD SECTION</p>
              <div className="grid grid-cols-2 gap-1">
                {SECTION_TYPES.map(({ type, label, icon: Icon }) => (
                  <button
                    key={type}
                    onClick={() => addSection(type)}
                    className="flex items-center gap-1.5 px-2 py-1.5 text-xs hover:bg-gray-100 rounded transition-colors"
                  >
                    <Icon className="w-3 h-3" />
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Section Editor */}
          <div className="flex-1 bg-white rounded-lg border border-gray-200 overflow-hidden">
            {selectedSectionIndex !== null && layout.sections[selectedSectionIndex] ? (
              <div className="p-6 space-y-4">
                <h3 className="font-semibold">Edit Section</h3>
                
                <div className="space-y-4">
                  <div>
                    <Label>Title</Label>
                    <Input
                      value={layout.sections[selectedSectionIndex].title}
                      onChange={(e) => updateSection(selectedSectionIndex, { title: e.target.value })}
                    />
                  </div>
                  
                  <div>
                    <Label>Description (optional)</Label>
                    <Input
                      value={layout.sections[selectedSectionIndex].description || ''}
                      onChange={(e) => updateSection(selectedSectionIndex, { description: e.target.value })}
                      placeholder="Optional description text"
                    />
                  </div>

                  {layout.sections[selectedSectionIndex].type === 'fields' && (
                    <div>
                      <Label>Field IDs (comma-separated)</Label>
                      <Input
                        value={layout.sections[selectedSectionIndex].fields?.join(', ') || ''}
                        onChange={(e) => updateSection(selectedSectionIndex, {
                          fields: e.target.value.split(',').map(f => f.trim()).filter(Boolean)
                        })}
                        placeholder="email, name, phone"
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        Enter the field IDs you want to display in this section
                      </p>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="h-full flex items-center justify-center text-gray-400">
                <p>Select a section to edit</p>
              </div>
            )}
          </div>
        </TabsContent>

        {/* Settings Tab */}
        <TabsContent value="settings" className="flex-1 overflow-y-auto p-4">
          <Card className="max-w-2xl mx-auto">
            <CardHeader>
              <CardTitle>Dashboard Settings</CardTitle>
              <CardDescription>Configure global dashboard options</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <h4 className="font-medium">Welcome Message</h4>
                <div>
                  <Label>Title</Label>
                  <Input
                    value={layout.settings.welcomeTitle || ''}
                    onChange={(e) => updateSettings({ welcomeTitle: e.target.value })}
                    placeholder="Your Application Dashboard"
                  />
                </div>
                <div>
                  <Label>Description</Label>
                  <Input
                    value={layout.settings.welcomeText || ''}
                    onChange={(e) => updateSettings({ welcomeText: e.target.value })}
                    placeholder="Track your application status..."
                  />
                </div>
              </div>

              <div className="space-y-4">
                <h4 className="font-medium">Features</h4>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label>Show Status Card</Label>
                    <Switch
                      checked={layout.settings.showStatus}
                      onCheckedChange={(checked) => updateSettings({ showStatus: checked })}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label>Show Timeline</Label>
                    <Switch
                      checked={layout.settings.showTimeline}
                      onCheckedChange={(checked) => updateSettings({ showTimeline: checked })}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label>Enable Chat</Label>
                    <Switch
                      checked={layout.settings.showChat}
                      onCheckedChange={(checked) => updateSettings({ showChat: checked })}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label>Show Documents</Label>
                    <Switch
                      checked={layout.settings.showDocuments}
                      onCheckedChange={(checked) => updateSettings({ showDocuments: checked })}
                    />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Preview Tab */}
        <TabsContent value="preview" className="flex-1 overflow-y-auto p-4 bg-gray-100">
          <div className="max-w-4xl mx-auto">
            <Card className="mb-4">
              <CardContent className="p-4 flex items-center gap-2 text-sm text-gray-600">
                <Eye className="w-4 h-4" />
                This is a preview of how applicants will see their dashboard
              </CardContent>
            </Card>
            
            {/* Preview Header */}
            <div className="bg-white rounded-lg border border-gray-200 p-6 mb-4">
              <h1 className="text-2xl font-bold">{layout.settings.welcomeTitle || 'Your Application Dashboard'}</h1>
              <p className="text-gray-500 mt-1">{layout.settings.welcomeText}</p>
            </div>

            {/* Preview Sections */}
            <div className="grid grid-cols-3 gap-4">
              <div className="col-span-2 space-y-4">
                {layout.sections.filter(s => s.type !== 'chat').map(section => (
                  <Card key={section.id}>
                    <CardHeader>
                      <CardTitle className="text-base">{section.title}</CardTitle>
                      {section.description && (
                        <CardDescription>{section.description}</CardDescription>
                      )}
                    </CardHeader>
                    <CardContent>
                      <div className="bg-gray-50 rounded-lg p-4 text-center text-gray-400 text-sm">
                        {section.type} content preview
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
              
              <div className="space-y-4">
                {layout.settings.showChat && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base flex items-center gap-2">
                        <MessageSquare className="w-4 h-4" />
                        Messages
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="bg-gray-50 rounded-lg p-4 text-center text-gray-400 text-sm h-48">
                        Chat preview
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}

export default DashboardBuilder

/**
 * Standalone Dashboard Settings Panel - for use in sidebar
 */
interface DashboardSettingsPanelProps {
  layout: DashboardLayout
  onUpdate: (updates: Partial<DashboardSettings>) => void
}

export function DashboardSettingsPanel({ layout, onUpdate }: DashboardSettingsPanelProps) {
  return (
    <div className="p-4 space-y-6">
      <div className="space-y-4">
        <h4 className="font-medium text-sm">Welcome Message</h4>
        <div>
          <Label className="text-xs">Title</Label>
          <Input
            value={layout.settings.welcomeTitle || ''}
            onChange={(e) => onUpdate({ welcomeTitle: e.target.value })}
            placeholder="Your Application Dashboard"
          />
        </div>
        <div>
          <Label className="text-xs">Description</Label>
          <Input
            value={layout.settings.welcomeText || ''}
            onChange={(e) => onUpdate({ welcomeText: e.target.value })}
            placeholder="Track your application status..."
          />
        </div>
      </div>

      <div className="border-t border-gray-200 pt-4 space-y-4">
        <h4 className="font-medium text-sm">Features</h4>
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label className="text-sm">Show Status Card</Label>
            <Switch
              checked={layout.settings.showStatus}
              onCheckedChange={(checked) => onUpdate({ showStatus: checked })}
            />
          </div>
          <div className="flex items-center justify-between">
            <Label className="text-sm">Show Timeline</Label>
            <Switch
              checked={layout.settings.showTimeline}
              onCheckedChange={(checked) => onUpdate({ showTimeline: checked })}
            />
          </div>
          <div className="flex items-center justify-between">
            <Label className="text-sm">Enable Chat</Label>
            <Switch
              checked={layout.settings.showChat}
              onCheckedChange={(checked) => onUpdate({ showChat: checked })}
            />
          </div>
          <div className="flex items-center justify-between">
            <Label className="text-sm">Show Documents</Label>
            <Switch
              checked={layout.settings.showDocuments}
              onCheckedChange={(checked) => onUpdate({ showDocuments: checked })}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
