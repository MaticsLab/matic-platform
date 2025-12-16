'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Lock, Eye as EyeIcon, LayoutDashboard, ScrollText, BookOpen, CheckCircle,
  ChevronRight, ChevronDown, Plus, GripVertical, Trash2, Settings,
  Clock, MessageSquare, FileText, CheckCircle2, MoreVertical
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/ui-components/button'
import { Switch } from '@/ui-components/switch'
import { Input } from '@/ui-components/input'
import { Label } from '@/ui-components/label'
import { Textarea } from '@/ui-components/textarea'
import { ScrollArea } from '@/ui-components/scroll-area'
import { Separator } from '@/ui-components/separator'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/ui-components/collapsible'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/ui-components/dropdown-menu'
import { Section } from '@/types/portal'
import { DashboardSettings } from '@/types/dashboard'
import { getCollaborationActions } from '@/lib/collaboration/collaboration-store'

interface UnifiedSidebarProps {
  sections: Section[]
  activeSectionId: string
  activeSpecialPage: 'signup' | 'review' | 'dashboard' | null
  onSelectSection: (id: string) => void
  onSelectSpecialPage: (page: 'signup' | 'review' | 'dashboard' | null) => void
  onReorderSections: (sections: Section[]) => void
  onDeleteSection: (id: string) => void
  onAddSection: (type: string) => void
  dashboardSettings: DashboardSettings
  onDashboardSettingsChange: (settings: Partial<DashboardSettings>) => void
}

// Section type variants for styling
const SECTION_VARIANTS = {
  form: { 
    label: 'Form', 
    icon: ScrollText, 
    bg: 'bg-amber-50', 
    fg: 'text-amber-600', 
    activeBg: 'bg-amber-100',
    border: 'border-amber-200'
  },
  cover: { 
    label: 'Cover', 
    icon: BookOpen, 
    bg: 'bg-blue-50', 
    fg: 'text-blue-600', 
    activeBg: 'bg-blue-100',
    border: 'border-blue-200'
  },
  ending: { 
    label: 'Ending', 
    icon: CheckCircle, 
    bg: 'bg-emerald-50', 
    fg: 'text-emerald-600', 
    activeBg: 'bg-emerald-100',
    border: 'border-emerald-200'
  },
  review: { 
    label: 'Review', 
    icon: EyeIcon, 
    bg: 'bg-purple-50', 
    fg: 'text-purple-600', 
    activeBg: 'bg-purple-100',
    border: 'border-purple-200'
  },
  dashboard: { 
    label: 'Dashboard', 
    icon: LayoutDashboard, 
    bg: 'bg-indigo-50', 
    fg: 'text-indigo-600', 
    activeBg: 'bg-indigo-100',
    border: 'border-indigo-200'
  },
} as const

// Dashboard built-in components
const DASHBOARD_COMPONENTS = [
  { key: 'showStatus', label: 'Status Card', icon: CheckCircle2, description: 'Application status indicator' },
  { key: 'showTimeline', label: 'Activity Timeline', icon: Clock, description: 'History and updates' },
  { key: 'showChat', label: 'Messages', icon: MessageSquare, description: 'Two-way communication' },
  { key: 'showDocuments', label: 'Documents', icon: FileText, description: 'File uploads & requests' },
]

export function UnifiedSidebar({
  sections,
  activeSectionId,
  activeSpecialPage,
  onSelectSection,
  onSelectSpecialPage,
  onReorderSections,
  onDeleteSection,
  onAddSection,
  dashboardSettings,
  onDashboardSettingsChange,
}: UnifiedSidebarProps) {
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set(['entry', 'form', 'after']))

  const toggleGroup = (group: string) => {
    setExpandedGroups(prev => {
      const next = new Set(prev)
      if (next.has(group)) {
        next.delete(group)
      } else {
        next.add(group)
      }
      return next
    })
  }

  // Update collaboration awareness when active section changes
  useEffect(() => {
    const { updateCurrentSection } = getCollaborationActions()
    if (activeSectionId) {
      const activeSection = sections.find(s => s.id === activeSectionId)
      updateCurrentSection(activeSectionId, activeSection?.title || 'Untitled Section')
    } else if (activeSpecialPage) {
      // Track special pages too
      const pageNames = {
        signup: 'Sign Up / Login',
        review: 'Review & Submit',
        dashboard: 'Applicant Dashboard'
      }
      updateCurrentSection(`special-${activeSpecialPage}`, pageNames[activeSpecialPage])
    }
  }, [activeSectionId, activeSpecialPage, sections])

  // Separate sections by type
  const formSections = sections.filter(s => s.sectionType === 'form' || !s.sectionType)
  const endingSections = sections.filter(s => s.sectionType === 'ending')
  const dashboardSections = sections.filter(s => s.sectionType === 'dashboard')

  // Drag handlers for form sections - use section ID to track dragged item
  const [draggedSectionId, setDraggedSectionId] = useState<string | null>(null)
  
  const handleDragStart = (e: React.DragEvent, sectionId: string) => {
    setDraggedSectionId(sectionId)
    e.dataTransfer.effectAllowed = 'move'
    // Add data for compatibility
    e.dataTransfer.setData('text/plain', sectionId)
  }

  const handleDragOver = (e: React.DragEvent, targetSectionId: string) => {
    e.preventDefault()
    if (!draggedSectionId || draggedSectionId === targetSectionId) return
    
    // Find actual indices in the full sections array
    const draggedIndex = sections.findIndex(s => s.id === draggedSectionId)
    const targetIndex = sections.findIndex(s => s.id === targetSectionId)
    
    if (draggedIndex === -1 || targetIndex === -1) return
    
    const newSections = [...sections]
    const [draggedSection] = newSections.splice(draggedIndex, 1)
    newSections.splice(targetIndex, 0, draggedSection)
    
    onReorderSections(newSections)
  }

  const handleDragEnd = () => {
    setDraggedSectionId(null)
  }

  const renderSectionItem = (section: Section, isDraggable = true) => {
    const type = (section.sectionType || 'form') as keyof typeof SECTION_VARIANTS
    const variant = SECTION_VARIANTS[type] || SECTION_VARIANTS.form
    const Icon = variant.icon
    const isActive = activeSectionId === section.id && !activeSpecialPage
    const isDragging = draggedSectionId === section.id

    return (
      <motion.div
        key={section.id}
        layout
        initial={{ opacity: 0, x: -10 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: -10 }}
        draggable={isDraggable}
        onDragStart={isDraggable ? (e) => handleDragStart(e as any, section.id) : undefined}
        onDragOver={isDraggable ? (e) => handleDragOver(e as any, section.id) : undefined}
        onDragEnd={isDraggable ? handleDragEnd : undefined}
        onClick={() => {
          onSelectSection(section.id)
          onSelectSpecialPage(null)
        }}
        className={cn(
          "group flex items-center gap-2 px-2 py-2 rounded-lg cursor-pointer transition-all w-full max-w-full",
          isActive 
            ? cn("shadow-sm border", variant.activeBg, variant.border)
            : "hover:bg-gray-50",
          isDragging && "opacity-50 ring-2 ring-blue-400"
        )}
      >
        {isDraggable && (
          <div className="opacity-0 group-hover:opacity-100 cursor-grab active:cursor-grabbing flex-shrink-0">
            <GripVertical className="w-3.5 h-3.5 text-gray-400" />
          </div>
        )}
        <div className={cn("w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0", variant.bg)}>
          <Icon className={cn("w-3.5 h-3.5", variant.fg)} />
        </div>
        <span className={cn("flex-1 text-sm font-medium truncate min-w-0", isActive ? "text-gray-900" : "text-gray-700")}>
          {section.title || variant.label}
        </span>
        
        <DropdownMenu>
          <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
            <Button variant="ghost" size="sm" className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 flex-shrink-0">
              <MoreVertical className="w-3.5 h-3.5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem 
              className="text-red-600"
              onClick={(e) => {
                e.stopPropagation()
                onDeleteSection(section.id)
              }}
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </motion.div>
    )
  }

  return (
    <div className="h-full flex flex-col bg-white overflow-y-auto overflow-x-hidden min-h-0 w-full">
      {/* Header */}
      <div className="px-3 py-3 border-b border-gray-200 flex items-center justify-between flex-shrink-0">
        <h3 className="text-sm font-semibold text-gray-900">Portal Structure</h3>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="sm" className="h-8 text-xs gap-1">
              <Plus className="w-3.5 h-3.5" />
              Add
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuItem onClick={() => onAddSection('form')}>
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center">
                  <ScrollText className="w-4 h-4 text-amber-600" />
                </div>
                <div>
                  <p className="text-sm font-medium">Form Section</p>
                  <p className="text-xs text-gray-500">Collect user input</p>
                </div>
              </div>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onAddSection('ending')}>
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center">
                  <CheckCircle className="w-4 h-4 text-emerald-600" />
                </div>
                <div>
                  <p className="text-sm font-medium">Ending Page</p>
                  <p className="text-xs text-gray-500">Thank you / confirmation</p>
                </div>
              </div>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <ScrollArea className="flex-1 min-h-0 w-full">
        <div className="p-2 space-y-1 w-full">
          {/* ═══════════════════════════════════════════════════════════════════
              ENTRY GROUP - Authentication
          ═══════════════════════════════════════════════════════════════════ */}
          <Collapsible open={expandedGroups.has('entry')} onOpenChange={() => toggleGroup('entry')}>
            <CollapsibleTrigger className="flex items-center gap-2 w-full px-2 py-2 hover:bg-gray-50 rounded-lg transition-colors">
              <ChevronRight className={cn(
                "w-4 h-4 text-gray-400 transition-transform",
                expandedGroups.has('entry') && "rotate-90"
              )} />
              <Lock className="w-4 h-4 text-green-600" />
              <span className="text-sm font-semibold text-gray-700 flex-1 text-left">Authentication</span>
            </CollapsibleTrigger>
            <CollapsibleContent className="pl-4 pr-1 py-1 space-y-1">
              <button
                onClick={() => {
                  onSelectSpecialPage('signup')
                  onSelectSection('')
                }}
                className={cn(
                  "w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors text-left",
                  activeSpecialPage === 'signup' 
                    ? "bg-green-50 text-green-900 border border-green-200" 
                    : "text-gray-700 hover:bg-gray-50"
                )}
              >
                <Lock className="w-4 h-4 text-green-600" />
                <span className="font-medium">Sign Up / Login</span>
              </button>
            </CollapsibleContent>
          </Collapsible>

          <Separator className="my-2" />

          {/* ═══════════════════════════════════════════════════════════════════
              APPLICATION FORM SECTIONS
          ═══════════════════════════════════════════════════════════════════ */}
          <Collapsible open={expandedGroups.has('form')} onOpenChange={() => toggleGroup('form')}>
            <CollapsibleTrigger className="flex items-center gap-2 w-full px-2 py-2 hover:bg-gray-50 rounded-lg transition-colors">
              <ChevronRight className={cn(
                "w-4 h-4 text-gray-400 transition-transform",
                expandedGroups.has('form') && "rotate-90"
              )} />
              <ScrollText className="w-4 h-4 text-amber-600" />
              <span className="text-sm font-semibold text-gray-700 flex-1 text-left">Application Form</span>
              <span className="text-xs text-gray-400">{formSections.length}</span>
            </CollapsibleTrigger>
            <CollapsibleContent className="pl-4 pr-1 py-1 space-y-1">
              <AnimatePresence mode="popLayout">
                {formSections.map((section) => renderSectionItem(section, true))}
              </AnimatePresence>
              
              {/* Review & Submit */}
              <button
                onClick={() => {
                  onSelectSpecialPage('review')
                  onSelectSection('')
                }}
                className={cn(
                  "w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors text-left",
                  activeSpecialPage === 'review' 
                    ? "bg-purple-50 text-purple-900 border border-purple-200" 
                    : "text-gray-700 hover:bg-gray-50"
                )}
              >
                <div className="w-7 h-7 rounded-lg bg-purple-50 flex items-center justify-center">
                  <EyeIcon className="w-3.5 h-3.5 text-purple-600" />
                </div>
                <span className="font-medium">Review & Submit</span>
              </button>
            </CollapsibleContent>
          </Collapsible>

          <Separator className="my-2" />

          {/* ═══════════════════════════════════════════════════════════════════
              AFTER SUBMISSION GROUP - Dashboard & Endings
          ═══════════════════════════════════════════════════════════════════ */}
          <Collapsible open={expandedGroups.has('after')} onOpenChange={() => toggleGroup('after')}>
            <CollapsibleTrigger className="flex items-center gap-2 w-full px-2 py-2 hover:bg-gray-50 rounded-lg transition-colors">
              <ChevronRight className={cn(
                "w-4 h-4 text-gray-400 transition-transform",
                expandedGroups.has('after') && "rotate-90"
              )} />
              <LayoutDashboard className="w-4 h-4 text-orange-600" />
              <span className="text-sm font-semibold text-gray-700 flex-1 text-left">After Submission</span>
            </CollapsibleTrigger>
            <CollapsibleContent className="pl-2 pr-2 py-1 space-y-1">
              {/* Dashboard - Expandable with settings */}
              <Collapsible 
                open={activeSpecialPage === 'dashboard'}
                onOpenChange={(open) => {
                  if (open) {
                    onSelectSpecialPage('dashboard')
                    onSelectSection('')
                  }
                }}
              >
                <CollapsibleTrigger className={cn(
                  "w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors text-left",
                  activeSpecialPage === 'dashboard' 
                    ? "bg-orange-50 text-orange-900 border border-orange-200" 
                    : "text-gray-700 hover:bg-gray-50"
                )}>
                  <div className="w-7 h-7 rounded-lg bg-orange-50 flex items-center justify-center">
                    <LayoutDashboard className="w-3.5 h-3.5 text-orange-600" />
                  </div>
                  <span className="font-medium flex-1">Applicant Dashboard</span>
                  <ChevronDown className={cn(
                    "w-4 h-4 text-gray-400 transition-transform",
                    activeSpecialPage === 'dashboard' && "rotate-180"
                  )} />
                </CollapsibleTrigger>
                
                <CollapsibleContent className="mt-2 ml-2 space-y-3 pb-2">
                  {/* Dashboard Components Toggles */}
                  <div className="space-y-2">
                    <p className="text-xs font-medium text-gray-500 uppercase tracking-wide px-1">Components</p>
                    {DASHBOARD_COMPONENTS.map((comp) => {
                      const Icon = comp.icon
                      const isEnabled = dashboardSettings[comp.key as keyof DashboardSettings] as boolean
                      return (
                        <div 
                          key={comp.key}
                          className={cn(
                            "flex items-center gap-2 p-2 rounded-lg border transition-all",
                            isEnabled ? "bg-blue-50/50 border-blue-100" : "bg-gray-50 border-gray-100 opacity-70"
                          )}
                        >
                          <Icon className={cn("w-4 h-4", isEnabled ? "text-blue-600" : "text-gray-400")} />
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium text-gray-900">{comp.label}</p>
                          </div>
                          <Switch
                            checked={isEnabled}
                            onCheckedChange={(checked) => onDashboardSettingsChange({ [comp.key]: checked })}
                            className="scale-75"
                          />
                        </div>
                      )
                    })}
                  </div>

                  <Separator />

                  {/* Welcome Message Settings */}
                  <div className="space-y-3">
                    <p className="text-xs font-medium text-gray-500 uppercase tracking-wide px-1">Welcome Message</p>
                    <div className="space-y-2">
                      <div>
                        <Label className="text-xs text-gray-600">Title</Label>
                        <Input
                          value={dashboardSettings.welcomeTitle || ''}
                          onChange={(e) => onDashboardSettingsChange({ welcomeTitle: e.target.value })}
                          placeholder="Welcome to your dashboard"
                          className="h-8 text-sm"
                        />
                      </div>
                      <div>
                        <Label className="text-xs text-gray-600">Description</Label>
                        <Textarea
                          value={dashboardSettings.welcomeText || ''}
                          onChange={(e) => onDashboardSettingsChange({ welcomeText: e.target.value })}
                          placeholder="Track your application progress..."
                          className="text-sm min-h-[60px] resize-none"
                        />
                      </div>
                    </div>
                  </div>
                </CollapsibleContent>
              </Collapsible>

              {/* Ending Pages */}
              {endingSections.length > 0 && (
                <div className="pl-2 space-y-1">
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wide px-1 py-1 truncate">Thank You Pages</p>
                  <AnimatePresence mode="popLayout">
                    {endingSections.map((section) => renderSectionItem(section, false))}
                  </AnimatePresence>
                </div>
              )}
            </CollapsibleContent>
          </Collapsible>
        </div>
      </ScrollArea>
    </div>
  )
}
