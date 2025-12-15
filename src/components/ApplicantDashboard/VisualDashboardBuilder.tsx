/**
 * Visual Dashboard Builder - Webflow-style live preview builder
 * Build the applicant dashboard with real-time preview
 */

'use client'

import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { 
  Plus, Trash2, GripVertical, Eye, Settings, MessageSquare, Clock, 
  FileText, CheckCircle2, ChevronDown, ChevronUp, ChevronRight,
  Layout, Smartphone, Monitor, Tablet, Palette, Type, Image,
  ToggleLeft, Save, Loader2, X, Edit3, Copy, MoreVertical,
  AlertCircle, Calendar, Send, LogOut, User, Mail, Bell,
  FileEdit, PanelLeftClose, PanelLeft
} from 'lucide-react'
import { Button } from '@/ui-components/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/ui-components/card'
import { Input } from '@/ui-components/input'
import { Label } from '@/ui-components/label'
import { Switch } from '@/ui-components/switch'
import { Textarea } from '@/ui-components/textarea'
import { Badge } from '@/ui-components/badge'
import { ScrollArea } from '@/ui-components/scroll-area'
import { Separator } from '@/ui-components/separator'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/ui-components/tabs'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/ui-components/dropdown-menu'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/ui-components/select'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/ui-components/collapsible'
import { cn } from '@/lib/utils'
import { dashboardClient } from '@/lib/api/dashboard-client'
import { formsClient } from '@/lib/api/forms-client'
import type { DashboardLayout, DashboardSection, DashboardSettings, DashboardField } from '@/types/dashboard'
import type { Field, Section } from '@/types/portal'
import { toast } from 'sonner'
import { v4 as uuid } from 'uuid'
import { motion, AnimatePresence } from 'framer-motion'

// ============================================================================
// TYPES
// ============================================================================

interface VisualDashboardBuilderProps {
  formId: string
  workspaceId?: string
  themeColor?: string
  logoUrl?: string
  portalName?: string
  onSave?: (layout: DashboardLayout) => Promise<void>
}

type ViewportSize = 'desktop' | 'tablet' | 'mobile'

// ============================================================================
// CONSTANTS
// ============================================================================

const BUILT_IN_SECTIONS = [
  { 
    type: 'status' as const, 
    label: 'Status Card', 
    icon: CheckCircle2, 
    description: 'Application status with visual indicator',
    defaultEnabled: true 
  },
  { 
    type: 'timeline' as const, 
    label: 'Activity Timeline', 
    icon: Clock, 
    description: 'Show application history and updates',
    defaultEnabled: true 
  },
  { 
    type: 'chat' as const, 
    label: 'Messages', 
    icon: MessageSquare, 
    description: 'Two-way communication with applicants',
    defaultEnabled: true 
  },
  { 
    type: 'documents' as const, 
    label: 'Documents', 
    icon: FileText, 
    description: 'Uploaded files and document requests',
    defaultEnabled: false 
  },
]

const FIELD_TYPES = [
  { type: 'text', label: 'Short Text', icon: Type },
  { type: 'textarea', label: 'Long Text', icon: FileText },
  { type: 'email', label: 'Email', icon: Mail },
  { type: 'select', label: 'Dropdown', icon: ChevronDown },
  { type: 'file', label: 'File Upload', icon: FileText },
  { type: 'date', label: 'Date', icon: Calendar },
  { type: 'checkbox', label: 'Checkbox', icon: CheckCircle2 },
]

const DEFAULT_SETTINGS: DashboardSettings = {
  showStatus: true,
  showTimeline: true,
  showChat: true,
  showDocuments: false,
  welcomeTitle: 'Your Application Dashboard',
  welcomeText: 'Track your application progress and communicate with our team.',
}

// ============================================================================
// COMPONENT BUILDER SIDEBAR
// ============================================================================

function ComponentsSidebar({ 
  onAddSection, 
  onToggleBuiltIn,
  builtInStates 
}: { 
  onAddSection: (type: string) => void
  onToggleBuiltIn: (type: string, enabled: boolean) => void
  builtInStates: Record<string, boolean>
}) {
  const [expandedCategory, setExpandedCategory] = useState<string | null>('built-in')

  return (
    <div className="h-full flex flex-col bg-white border-r">
      <div className="p-4 border-b">
        <h3 className="font-semibold text-gray-900">Components</h3>
        <p className="text-xs text-gray-500 mt-1">Drag or click to add to dashboard</p>
      </div>
      
      <ScrollArea className="flex-1">
        <div className="p-3 space-y-2">
          {/* Built-in Sections */}
          <Collapsible 
            open={expandedCategory === 'built-in'} 
            onOpenChange={(open) => setExpandedCategory(open ? 'built-in' : null)}
          >
            <CollapsibleTrigger className="flex items-center justify-between w-full p-2 hover:bg-gray-50 rounded-lg transition-colors">
              <span className="text-sm font-medium text-gray-700">Built-in Sections</span>
              <ChevronRight className={cn(
                "w-4 h-4 text-gray-400 transition-transform",
                expandedCategory === 'built-in' && "rotate-90"
              )} />
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-1 space-y-1">
              {BUILT_IN_SECTIONS.map((section) => {
                const Icon = section.icon
                const isEnabled = builtInStates[section.type] ?? section.defaultEnabled
                return (
                  <div 
                    key={section.type}
                    className={cn(
                      "flex items-center gap-3 p-2 rounded-lg border transition-all",
                      isEnabled 
                        ? "bg-blue-50 border-blue-200" 
                        : "bg-gray-50 border-gray-200 opacity-60"
                    )}
                  >
                    <Icon className={cn("w-4 h-4", isEnabled ? "text-blue-600" : "text-gray-400")} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900">{section.label}</p>
                      <p className="text-xs text-gray-500 truncate">{section.description}</p>
                    </div>
                    <Switch
                      checked={isEnabled}
                      onCheckedChange={(checked) => onToggleBuiltIn(section.type, checked)}
                      className="scale-75"
                    />
                  </div>
                )
              })}
            </CollapsibleContent>
          </Collapsible>

          <Separator />

          {/* Custom Data Sections */}
          <Collapsible 
            open={expandedCategory === 'custom'} 
            onOpenChange={(open) => setExpandedCategory(open ? 'custom' : null)}
          >
            <CollapsibleTrigger className="flex items-center justify-between w-full p-2 hover:bg-gray-50 rounded-lg transition-colors">
              <span className="text-sm font-medium text-gray-700">Request More Info</span>
              <ChevronRight className={cn(
                "w-4 h-4 text-gray-400 transition-transform",
                expandedCategory === 'custom' && "rotate-90"
              )} />
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-1 space-y-1">
              <p className="text-xs text-gray-500 px-2 py-1">
                Add custom sections to collect additional information from applicants
              </p>
              <button
                onClick={() => onAddSection('fields')}
                className="flex items-center gap-2 w-full p-3 rounded-lg border-2 border-dashed border-gray-300 hover:border-blue-400 hover:bg-blue-50 transition-all text-gray-600 hover:text-blue-600"
              >
                <Plus className="w-4 h-4" />
                <span className="text-sm font-medium">Add Data Collection Section</span>
              </button>
            </CollapsibleContent>
          </Collapsible>
        </div>
      </ScrollArea>
    </div>
  )
}

// ============================================================================
// LIVE PREVIEW COMPONENTS
// ============================================================================

function PreviewStatusCard({ themeColor, status = 'submitted' }: { themeColor: string; status?: string }) {
  const statusConfig: Record<string, { label: string; color: string; bgColor: string }> = {
    submitted: { label: 'Submitted', color: 'text-blue-600', bgColor: 'bg-blue-50' },
    under_review: { label: 'Under Review', color: 'text-yellow-600', bgColor: 'bg-yellow-50' },
    approved: { label: 'Approved', color: 'text-green-600', bgColor: 'bg-green-50' },
    revision_requested: { label: 'Revision Requested', color: 'text-orange-600', bgColor: 'bg-orange-50' },
  }
  const config = statusConfig[status] || statusConfig.submitted

  return (
    <Card className="mb-4 shadow-sm">
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={cn("p-2.5 rounded-full", config.bgColor, config.color)}>
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs text-gray-500">Application Status</p>
              <p className="text-base font-semibold text-gray-900">{config.label}</p>
            </div>
          </div>
          <Badge variant="outline" className={cn("text-xs", config.color)}>
            {config.label}
          </Badge>
        </div>
      </CardContent>
    </Card>
  )
}

function PreviewTimeline() {
  const events = [
    { id: 1, title: 'Application Submitted', time: '2 days ago', type: 'submitted' },
    { id: 2, title: 'Under Review', time: '1 day ago', type: 'status_update' },
  ]

  return (
    <div className="mb-4 pb-3 border-b border-gray-100">
      <h4 className="text-xs font-medium text-gray-700 mb-2 flex items-center gap-1.5">
        <Calendar className="w-3.5 h-3.5" />
        Timeline
      </h4>
      <div className="space-y-2">
        {events.map((event, index) => (
          <div key={event.id} className="flex items-start gap-2">
            <div className="flex flex-col items-center">
              <div className={cn(
                "w-1.5 h-1.5 rounded-full mt-1.5",
                event.type === 'submitted' ? 'bg-blue-500' : 'bg-yellow-500'
              )} />
              {index < events.length - 1 && <div className="w-0.5 h-5 bg-gray-200" />}
            </div>
            <div className="flex-1">
              <p className="text-xs font-medium text-gray-900">{event.title}</p>
              <p className="text-[10px] text-gray-400">{event.time}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function PreviewMessages({ themeColor }: { themeColor: string }) {
  return (
    <div className="space-y-3">
      <div className="space-y-2">
        <div className="flex justify-start">
          <div className="max-w-[75%] rounded-lg px-3 py-1.5 bg-gray-100 text-gray-900">
            <p className="text-[10px] font-medium mb-0.5 opacity-70">Staff</p>
            <p className="text-xs">Welcome! Let us know if you have any questions.</p>
            <p className="text-[10px] text-gray-400 mt-0.5">2 days ago</p>
          </div>
        </div>
        <div className="flex justify-end">
          <div className="max-w-[75%] rounded-lg px-3 py-1.5 text-white" style={{ backgroundColor: themeColor }}>
            <p className="text-xs">Thank you! I'll reach out if needed.</p>
            <p className="text-[10px] opacity-70 mt-0.5">1 day ago</p>
          </div>
        </div>
      </div>
      <div className="flex gap-1.5 pt-2 border-t border-gray-100">
        <Textarea 
          placeholder="Type a message..." 
          className="flex-1 min-h-[50px] text-xs resize-none"
          disabled
        />
        <Button size="sm" style={{ backgroundColor: themeColor }} className="text-white self-end" disabled>
          <Send className="w-3 h-3" />
        </Button>
      </div>
    </div>
  )
}

function PreviewCustomSection({ 
  section, 
  onEdit, 
  onDelete,
  isSelected,
  onClick 
}: { 
  section: Section
  onEdit: () => void
  onDelete: () => void
  isSelected: boolean
  onClick: () => void
}) {
  return (
    <Card 
      className={cn(
        "mb-4 cursor-pointer transition-all",
        isSelected ? "ring-2 ring-blue-500 shadow-md" : "hover:shadow-md"
      )}
      onClick={onClick}
    >
      <CardHeader className="pb-2 p-4">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm">{section.title || 'Untitled Section'}</CardTitle>
          <DropdownMenu>
            <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
              <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
                <MoreVertical className="w-3.5 h-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onEdit(); }}>
                <Edit3 className="w-3.5 h-3.5 mr-2" /> Edit Section
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem 
                className="text-red-600" 
                onClick={(e) => { e.stopPropagation(); onDelete(); }}
              >
                <Trash2 className="w-3.5 h-3.5 mr-2" /> Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        {section.description && (
          <CardDescription className="text-xs">{section.description}</CardDescription>
        )}
      </CardHeader>
      <CardContent className="p-4 pt-0 space-y-2">
        {section.fields?.length > 0 ? (
          section.fields.map((field) => (
            <div key={field.id} className="space-y-1">
              <Label className="text-xs text-gray-600">{field.label}</Label>
              {field.type === 'textarea' ? (
                <Textarea className="text-xs h-16" placeholder={field.placeholder || `Enter ${field.label.toLowerCase()}`} disabled />
              ) : field.type === 'select' ? (
                <Select disabled>
                  <SelectTrigger className="text-xs h-8">
                    <SelectValue placeholder={`Select ${field.label.toLowerCase()}`} />
                  </SelectTrigger>
                </Select>
              ) : field.type === 'file' ? (
                <div className="border-2 border-dashed border-gray-200 rounded-lg p-3 text-center">
                  <FileText className="w-5 h-5 text-gray-400 mx-auto mb-1" />
                  <p className="text-[10px] text-gray-500">Click to upload</p>
                </div>
              ) : (
                <Input className="text-xs h-8" placeholder={field.placeholder || `Enter ${field.label.toLowerCase()}`} disabled />
              )}
            </div>
          ))
        ) : (
          <div className="text-center py-4 border-2 border-dashed border-gray-200 rounded-lg">
            <Plus className="w-5 h-5 text-gray-400 mx-auto mb-1" />
            <p className="text-xs text-gray-500">Add fields to this section</p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// ============================================================================
// LIVE PREVIEW PANEL
// ============================================================================

function LivePreview({
  layout,
  customSections,
  settings,
  themeColor,
  logoUrl,
  portalName,
  viewport,
  selectedSectionId,
  onSelectSection,
  onEditSection,
  onDeleteSection,
}: {
  layout: DashboardLayout
  customSections: Section[]
  settings: DashboardSettings
  themeColor: string
  logoUrl?: string
  portalName?: string
  viewport: ViewportSize
  selectedSectionId: string | null
  onSelectSection: (id: string | null) => void
  onEditSection: (id: string) => void
  onDeleteSection: (id: string) => void
}) {
  const viewportWidth = viewport === 'mobile' ? 375 : viewport === 'tablet' ? 768 : '100%'
  const scale = viewport === 'mobile' ? 0.9 : viewport === 'tablet' ? 0.85 : 1

  return (
    <div className="h-full bg-gray-100 flex items-start justify-center p-4 overflow-auto">
      <motion.div 
        layout
        className="bg-white shadow-xl rounded-lg overflow-hidden"
        style={{ 
          width: viewportWidth,
          maxWidth: '100%',
          transform: `scale(${scale})`,
          transformOrigin: 'top center'
        }}
      >
        {/* Header */}
        <header className="border-b border-gray-100 bg-white px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {logoUrl && (
                <img src={logoUrl} alt="Logo" className="h-6 w-auto" />
              )}
              <div>
                <h1 className="font-medium text-sm text-gray-900">{portalName || 'Application Portal'}</h1>
                <p className="text-[10px] text-gray-500">applicant@example.com</p>
              </div>
            </div>
            <Button variant="ghost" size="sm" className="h-7 text-xs" disabled>
              <LogOut className="w-3 h-3 mr-1" />
              Sign Out
            </Button>
          </div>
        </header>

        {/* Main Content */}
        <main className="p-4">
          {/* Welcome Message */}
          {(settings.welcomeTitle || settings.welcomeText) && (
            <div className="mb-4">
              {settings.welcomeTitle && (
                <h2 className="text-base font-semibold text-gray-900">{settings.welcomeTitle}</h2>
              )}
              {settings.welcomeText && (
                <p className="text-xs text-gray-500 mt-0.5">{settings.welcomeText}</p>
              )}
            </div>
          )}

          {/* Status Card */}
          {settings.showStatus && (
            <PreviewStatusCard themeColor={themeColor} />
          )}

          {/* Custom Data Collection Sections */}
          {customSections.map((section) => (
            <PreviewCustomSection
              key={section.id}
              section={section}
              isSelected={selectedSectionId === section.id}
              onClick={() => onSelectSection(section.id)}
              onEdit={() => onEditSection(section.id)}
              onDelete={() => onDeleteSection(section.id)}
            />
          ))}

          {/* Activity & Messages Card */}
          {(settings.showTimeline || settings.showChat) && (
            <Card className="shadow-sm">
              <CardHeader className="pb-2 p-4">
                <div className="flex items-center gap-1.5">
                  <MessageSquare className="w-4 h-4 text-gray-500" />
                  <CardTitle className="text-sm">Activity & Messages</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="p-4 pt-0">
                {settings.showTimeline && <PreviewTimeline />}
                {settings.showChat && <PreviewMessages themeColor={themeColor} />}
              </CardContent>
            </Card>
          )}
        </main>
      </motion.div>
    </div>
  )
}

// ============================================================================
// SECTION EDITOR PANEL
// ============================================================================

function SectionEditorPanel({
  section,
  onUpdate,
  onClose,
  onAddField,
  onUpdateField,
  onDeleteField,
}: {
  section: Section
  onUpdate: (updates: Partial<Section>) => void
  onClose: () => void
  onAddField: (type: string) => void
  onUpdateField: (fieldId: string, updates: Partial<Field>) => void
  onDeleteField: (fieldId: string) => void
}) {
  const [selectedFieldId, setSelectedFieldId] = useState<string | null>(null)
  const selectedField = section.fields?.find(f => f.id === selectedFieldId)

  return (
    <div className="h-full flex flex-col bg-white border-l">
      {/* Header */}
      <div className="p-4 border-b flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-gray-900">Edit Section</h3>
          <p className="text-xs text-gray-500">Configure section and fields</p>
        </div>
        <Button variant="ghost" size="sm" onClick={onClose}>
          <X className="w-4 h-4" />
        </Button>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-4 space-y-4">
          {/* Section Settings */}
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Section Title</Label>
              <Input 
                value={section.title || ''} 
                onChange={(e) => onUpdate({ title: e.target.value })}
                placeholder="Enter section title"
                className="text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Description (optional)</Label>
              <Textarea 
                value={section.description || ''} 
                onChange={(e) => onUpdate({ description: e.target.value })}
                placeholder="Brief description for applicants"
                className="text-sm min-h-[60px]"
              />
            </div>
          </div>

          <Separator />

          {/* Fields */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-medium">Fields</Label>
            </div>

            {/* Field List */}
            <div className="space-y-2">
              {section.fields?.map((field) => (
                <div
                  key={field.id}
                  onClick={() => setSelectedFieldId(field.id)}
                  className={cn(
                    "p-2 rounded-lg border cursor-pointer transition-all",
                    selectedFieldId === field.id 
                      ? "border-blue-500 bg-blue-50" 
                      : "border-gray-200 hover:border-gray-300"
                  )}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <GripVertical className="w-3 h-3 text-gray-400" />
                      <span className="text-xs font-medium">{field.label || 'Untitled Field'}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Badge variant="outline" className="text-[10px] h-5">{field.type}</Badge>
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="h-6 w-6 p-0 text-gray-400 hover:text-red-500"
                        onClick={(e) => { e.stopPropagation(); onDeleteField(field.id); }}
                      >
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Add Field */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="w-full">
                  <Plus className="w-3.5 h-3.5 mr-1.5" />
                  Add Field
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-48">
                {FIELD_TYPES.map((fieldType) => {
                  const Icon = fieldType.icon
                  return (
                    <DropdownMenuItem key={fieldType.type} onClick={() => onAddField(fieldType.type)}>
                      <Icon className="w-3.5 h-3.5 mr-2" />
                      {fieldType.label}
                    </DropdownMenuItem>
                  )
                })}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* Selected Field Settings */}
          {selectedField && (
            <>
              <Separator />
              <div className="space-y-3">
                <Label className="text-xs font-medium">Field Settings</Label>
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Label</Label>
                    <Input 
                      value={selectedField.label || ''} 
                      onChange={(e) => onUpdateField(selectedField.id, { label: e.target.value })}
                      className="text-sm"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Placeholder</Label>
                    <Input 
                      value={selectedField.placeholder || ''} 
                      onChange={(e) => onUpdateField(selectedField.id, { placeholder: e.target.value })}
                      className="text-sm"
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label className="text-xs">Required</Label>
                    <Switch 
                      checked={selectedField.required} 
                      onCheckedChange={(checked) => onUpdateField(selectedField.id, { required: checked })}
                    />
                  </div>
                  {selectedField.type === 'select' && (
                    <div className="space-y-1.5">
                      <Label className="text-xs">Options (one per line)</Label>
                      <Textarea 
                        value={selectedField.options?.join('\n') || ''} 
                        onChange={(e) => onUpdateField(selectedField.id, { 
                          options: e.target.value.split('\n').filter(Boolean) 
                        })}
                        className="text-sm min-h-[80px]"
                        placeholder="Option 1&#10;Option 2&#10;Option 3"
                      />
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </ScrollArea>
    </div>
  )
}

// ============================================================================
// SETTINGS PANEL
// ============================================================================

function SettingsPanel({
  settings,
  onUpdate,
}: {
  settings: DashboardSettings
  onUpdate: (updates: Partial<DashboardSettings>) => void
}) {
  return (
    <div className="h-full flex flex-col bg-white border-l">
      <div className="p-4 border-b">
        <h3 className="font-semibold text-gray-900">Dashboard Settings</h3>
        <p className="text-xs text-gray-500">Configure appearance and behavior</p>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-4 space-y-4">
          {/* Welcome Message */}
          <div className="space-y-3">
            <Label className="text-xs font-medium">Welcome Message</Label>
            <div className="space-y-2">
              <div className="space-y-1.5">
                <Label className="text-xs text-gray-500">Title</Label>
                <Input 
                  value={settings.welcomeTitle || ''} 
                  onChange={(e) => onUpdate({ welcomeTitle: e.target.value })}
                  placeholder="Welcome to your dashboard"
                  className="text-sm"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-gray-500">Subtitle</Label>
                <Textarea 
                  value={settings.welcomeText || ''} 
                  onChange={(e) => onUpdate({ welcomeText: e.target.value })}
                  placeholder="Track your application progress..."
                  className="text-sm min-h-[60px]"
                />
              </div>
            </div>
          </div>

          <Separator />

          {/* Display Options */}
          <div className="space-y-3">
            <Label className="text-xs font-medium">Display Options</Label>
            <div className="space-y-2">
              <div className="flex items-center justify-between p-2 rounded-lg bg-gray-50">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-gray-500" />
                  <span className="text-sm">Status Card</span>
                </div>
                <Switch 
                  checked={settings.showStatus} 
                  onCheckedChange={(checked) => onUpdate({ showStatus: checked })}
                />
              </div>
              <div className="flex items-center justify-between p-2 rounded-lg bg-gray-50">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-gray-500" />
                  <span className="text-sm">Timeline</span>
                </div>
                <Switch 
                  checked={settings.showTimeline} 
                  onCheckedChange={(checked) => onUpdate({ showTimeline: checked })}
                />
              </div>
              <div className="flex items-center justify-between p-2 rounded-lg bg-gray-50">
                <div className="flex items-center gap-2">
                  <MessageSquare className="w-4 h-4 text-gray-500" />
                  <span className="text-sm">Messages</span>
                </div>
                <Switch 
                  checked={settings.showChat} 
                  onCheckedChange={(checked) => onUpdate({ showChat: checked })}
                />
              </div>
              <div className="flex items-center justify-between p-2 rounded-lg bg-gray-50">
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-gray-500" />
                  <span className="text-sm">Documents</span>
                </div>
                <Switch 
                  checked={settings.showDocuments} 
                  onCheckedChange={(checked) => onUpdate({ showDocuments: checked })}
                />
              </div>
            </div>
          </div>
        </div>
      </ScrollArea>
    </div>
  )
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function VisualDashboardBuilder({
  formId,
  workspaceId,
  themeColor = '#3B82F6',
  logoUrl,
  portalName,
  onSave,
}: VisualDashboardBuilderProps) {
  // State
  const [layout, setLayout] = useState<DashboardLayout>({
    sections: [],
    settings: DEFAULT_SETTINGS,
  })
  const [customSections, setCustomSections] = useState<Section[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [viewport, setViewport] = useState<ViewportSize>('desktop')
  const [selectedSectionId, setSelectedSectionId] = useState<string | null>(null)
  const [showSettings, setShowSettings] = useState(false)
  const [showLeftPanel, setShowLeftPanel] = useState(true)

  const selectedSection = customSections.find(s => s.id === selectedSectionId)

  // Load existing layout
  useEffect(() => {
    loadLayout()
  }, [formId])

  const loadLayout = async () => {
    try {
      setIsLoading(true)
      const data = await dashboardClient.getLayout(formId)
      if (data) {
        setLayout({
          sections: data.sections || [],
          settings: { ...DEFAULT_SETTINGS, ...data.settings },
        })
        // Load custom sections from the layout (sections with type 'fields')
        const custom = data.sections?.filter(s => s.type === 'fields') || []
        setCustomSections(custom.map(s => ({
          id: s.id,
          title: s.title,
          description: s.description,
          sectionType: 'dashboard' as const,
          fields: (s.fields || []).map(f => typeof f === 'string' ? { id: f, type: 'text' as const, label: f, required: false } : f),
        })))
      }
    } catch (error) {
      console.error('Failed to load dashboard layout:', error)
    } finally {
      setIsLoading(false)
    }
  }

  // Update settings
  const updateSettings = useCallback((updates: Partial<DashboardSettings>) => {
    setLayout(prev => ({
      ...prev,
      settings: { ...prev.settings, ...updates }
    }))
  }, [])

  // Toggle built-in sections
  const handleToggleBuiltIn = useCallback((type: string, enabled: boolean) => {
    const settingsKey = type === 'status' ? 'showStatus' 
      : type === 'timeline' ? 'showTimeline'
      : type === 'chat' ? 'showChat'
      : type === 'documents' ? 'showDocuments'
      : null
    
    if (settingsKey) {
      updateSettings({ [settingsKey]: enabled })
    }
  }, [updateSettings])

  // Add custom section
  const handleAddSection = useCallback((type: string) => {
    if (type === 'fields') {
      const newSection: Section = {
        id: uuid(),
        title: 'Additional Information',
        description: 'Please provide the following information',
        sectionType: 'dashboard',
        fields: [],
      }
      setCustomSections(prev => [...prev, newSection])
      setSelectedSectionId(newSection.id)
    }
  }, [])

  // Update section
  const handleUpdateSection = useCallback((sectionId: string, updates: Partial<Section>) => {
    setCustomSections(prev => prev.map(s => 
      s.id === sectionId ? { ...s, ...updates } : s
    ))
  }, [])

  // Delete section
  const handleDeleteSection = useCallback((sectionId: string) => {
    setCustomSections(prev => prev.filter(s => s.id !== sectionId))
    if (selectedSectionId === sectionId) {
      setSelectedSectionId(null)
    }
  }, [selectedSectionId])

  // Add field to section
  const handleAddField = useCallback((sectionId: string, fieldType: string) => {
    const newField: Field = {
      id: uuid(),
      type: fieldType as any,
      label: `New ${fieldType.charAt(0).toUpperCase() + fieldType.slice(1)} Field`,
      required: false,
      width: 'full',
    }
    setCustomSections(prev => prev.map(s => 
      s.id === sectionId ? { ...s, fields: [...(s.fields || []), newField] } : s
    ))
  }, [])

  // Update field
  const handleUpdateField = useCallback((sectionId: string, fieldId: string, updates: Partial<Field>) => {
    setCustomSections(prev => prev.map(s => 
      s.id === sectionId 
        ? { ...s, fields: s.fields?.map(f => f.id === fieldId ? { ...f, ...updates } : f) }
        : s
    ))
  }, [])

  // Delete field
  const handleDeleteField = useCallback((sectionId: string, fieldId: string) => {
    setCustomSections(prev => prev.map(s => 
      s.id === sectionId 
        ? { ...s, fields: s.fields?.filter(f => f.id !== fieldId) }
        : s
    ))
  }, [])

  // Save layout
  const handleSave = async () => {
    try {
      setIsSaving(true)
      
      // Convert custom sections to dashboard sections with DashboardField type
      const dashboardSections: DashboardSection[] = customSections.map(s => ({
        id: s.id,
        title: s.title,
        description: s.description,
        type: 'fields' as const,
        fields: s.fields?.map(f => ({
          ...f,
          dashboardOnly: true,
        })) as DashboardField[],
      }))

      const layoutToSave: DashboardLayout = {
        sections: dashboardSections,
        settings: layout.settings,
      }

      await dashboardClient.updateLayout(formId, layoutToSave)
      
      if (onSave) {
        await onSave(layoutToSave)
      }
      
      toast.success('Dashboard saved successfully')
    } catch (error) {
      console.error('Failed to save dashboard:', error)
      toast.error('Failed to save dashboard')
    } finally {
      setIsSaving(false)
    }
  }

  // Built-in section states
  const builtInStates = {
    status: layout.settings.showStatus,
    timeline: layout.settings.showTimeline,
    chat: layout.settings.showChat,
    documents: layout.settings.showDocuments,
  }

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col bg-gray-50">
      {/* Toolbar */}
      <div className="bg-white border-b px-4 py-2 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowLeftPanel(!showLeftPanel)}
            className="h-8"
          >
            {showLeftPanel ? <PanelLeftClose className="w-4 h-4" /> : <PanelLeft className="w-4 h-4" />}
          </Button>
          <Separator orientation="vertical" className="h-5" />
          <span className="text-sm font-medium text-gray-700">Dashboard Builder</span>
        </div>

        <div className="flex items-center gap-2">
          {/* Viewport Selector */}
          <div className="flex items-center border rounded-lg p-0.5">
            <Button
              variant={viewport === 'desktop' ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => setViewport('desktop')}
              className="h-7 px-2"
            >
              <Monitor className="w-3.5 h-3.5" />
            </Button>
            <Button
              variant={viewport === 'tablet' ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => setViewport('tablet')}
              className="h-7 px-2"
            >
              <Tablet className="w-3.5 h-3.5" />
            </Button>
            <Button
              variant={viewport === 'mobile' ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => setViewport('mobile')}
              className="h-7 px-2"
            >
              <Smartphone className="w-3.5 h-3.5" />
            </Button>
          </div>

          <Separator orientation="vertical" className="h-5" />

          <Button
            variant={showSettings ? 'secondary' : 'ghost'}
            size="sm"
            onClick={() => {
              setShowSettings(!showSettings)
              setSelectedSectionId(null)
            }}
            className="h-8"
          >
            <Settings className="w-4 h-4 mr-1.5" />
            Settings
          </Button>

          <Button
            onClick={handleSave}
            disabled={isSaving}
            size="sm"
            className="h-8"
          >
            {isSaving ? (
              <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
            ) : (
              <Save className="w-4 h-4 mr-1.5" />
            )}
            Save
          </Button>
        </div>
      </div>

      {/* Main Area */}
      <div className="flex-1 flex min-h-0">
        {/* Left Panel - Components */}
        <AnimatePresence>
          {showLeftPanel && (
            <motion.div
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: 260, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              className="flex-shrink-0 overflow-hidden"
            >
              <ComponentsSidebar
                onAddSection={handleAddSection}
                onToggleBuiltIn={handleToggleBuiltIn}
                builtInStates={builtInStates}
              />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Center - Live Preview */}
        <div className="flex-1 min-w-0">
          <LivePreview
            layout={layout}
            customSections={customSections}
            settings={layout.settings}
            themeColor={themeColor}
            logoUrl={logoUrl}
            portalName={portalName}
            viewport={viewport}
            selectedSectionId={selectedSectionId}
            onSelectSection={setSelectedSectionId}
            onEditSection={(id) => setSelectedSectionId(id)}
            onDeleteSection={handleDeleteSection}
          />
        </div>

        {/* Right Panel - Section Editor or Settings */}
        <AnimatePresence mode="wait">
          {selectedSection && (
            <motion.div
              key="section-editor"
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: 320, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              className="flex-shrink-0 overflow-hidden"
            >
              <SectionEditorPanel
                section={selectedSection}
                onUpdate={(updates) => handleUpdateSection(selectedSection.id, updates)}
                onClose={() => setSelectedSectionId(null)}
                onAddField={(type) => handleAddField(selectedSection.id, type)}
                onUpdateField={(fieldId, updates) => handleUpdateField(selectedSection.id, fieldId, updates)}
                onDeleteField={(fieldId) => handleDeleteField(selectedSection.id, fieldId)}
              />
            </motion.div>
          )}
          {showSettings && !selectedSection && (
            <motion.div
              key="settings"
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: 320, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              className="flex-shrink-0 overflow-hidden"
            >
              <SettingsPanel
                settings={layout.settings}
                onUpdate={updateSettings}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}

export default VisualDashboardBuilder
