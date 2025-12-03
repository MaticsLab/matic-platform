'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { 
  Plus, Trash2, Save, ChevronRight, Users, FileText, Layers, Edit2, X, 
  GripVertical, Check, Loader2, Sparkles, Settings, Award, 
  Link2, Zap, Target, ClipboardList, ChevronDown, CheckCircle, Search,
  Shield, EyeOff, Folder, Archive, XCircle, Clock, FolderOpen, ArchiveX, Tag,
  Circle, ArrowRight
} from 'lucide-react'
import { DndProvider, useDrag, useDrop } from 'react-dnd'
import { HTML5Backend } from 'react-dnd-html5-backend'
import { cn } from '@/lib/utils'
import { workflowsClient, ReviewWorkflow, ApplicationStage, ReviewerType, Rubric, StageReviewerConfig, ApplicationGroup, WorkflowAction, StageGroup, StatusOption, CustomStatus, StatusActionConfig } from '@/lib/api/workflows-client'
import { useWorkflowRealtime } from '@/hooks/useApplicationsRealtime'

// Stage color palette - semantic colors for workflow stages
const STAGE_COLORS = {
  blue: { bg: 'bg-blue-500', bgLight: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-700', ring: 'ring-blue-100', label: 'Blue' },
  green: { bg: 'bg-green-500', bgLight: 'bg-green-50', border: 'border-green-200', text: 'text-green-700', ring: 'ring-green-100', label: 'Green' },
  yellow: { bg: 'bg-yellow-500', bgLight: 'bg-yellow-50', border: 'border-yellow-200', text: 'text-yellow-700', ring: 'ring-yellow-100', label: 'Yellow' },
  orange: { bg: 'bg-orange-500', bgLight: 'bg-orange-50', border: 'border-orange-200', text: 'text-orange-700', ring: 'ring-orange-100', label: 'Orange' },
  red: { bg: 'bg-red-500', bgLight: 'bg-red-50', border: 'border-red-200', text: 'text-red-700', ring: 'ring-red-100', label: 'Red' },
  purple: { bg: 'bg-purple-500', bgLight: 'bg-purple-50', border: 'border-purple-200', text: 'text-purple-700', ring: 'ring-purple-100', label: 'Purple' },
  pink: { bg: 'bg-pink-500', bgLight: 'bg-pink-50', border: 'border-pink-200', text: 'text-pink-700', ring: 'ring-pink-100', label: 'Pink' },
  teal: { bg: 'bg-teal-500', bgLight: 'bg-teal-50', border: 'border-teal-200', text: 'text-teal-700', ring: 'ring-teal-100', label: 'Teal' },
  indigo: { bg: 'bg-indigo-500', bgLight: 'bg-indigo-50', border: 'border-indigo-200', text: 'text-indigo-700', ring: 'ring-indigo-100', label: 'Indigo' },
  slate: { bg: 'bg-slate-500', bgLight: 'bg-slate-50', border: 'border-slate-200', text: 'text-slate-700', ring: 'ring-slate-100', label: 'Slate' },
} as const

type StageColorKey = keyof typeof STAGE_COLORS

// Default stage colors based on index
const getDefaultStageColor = (index: number): StageColorKey => {
  const colorOrder: StageColorKey[] = ['blue', 'green', 'purple', 'orange', 'teal', 'pink', 'yellow', 'indigo', 'red', 'slate']
  return colorOrder[index % colorOrder.length]
}
import { goClient } from '@/lib/api/go-client'
import { Form } from '@/types/forms'
import { Button } from '@/ui-components/button'
import { Input } from '@/ui-components/input'
import { Label } from '@/ui-components/label'
import { Card } from '@/ui-components/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/ui-components/select'
import { Switch } from '@/ui-components/switch'
import { Textarea } from '@/ui-components/textarea'
import { Badge } from '@/ui-components/badge'
import { showToast } from '@/lib/toast'

// Type for form sections with fields for the field visibility config
interface FormSection {
  id: string
  title: string
  description?: string
  fields: { id: string; label: string }[]
}

interface WorkflowBuilderProps {
  workspaceId: string
  formId?: string | null
}

type ActivePanel = 'none' | 'workflow' | 'stage' | 'reviewer' | 'rubric' | 'stage-config' | 'stage-settings' | 'group' | 'stage-group' | 'workflow-action' | 'stage-action'

interface PanelState {
  type: ActivePanel
  mode: 'create' | 'edit'
  data?: any
}

export function WorkflowBuilder({ workspaceId, formId }: WorkflowBuilderProps) {
  const [workflows, setWorkflows] = useState<ReviewWorkflow[]>([])
  const [selectedWorkflow, setSelectedWorkflow] = useState<ReviewWorkflow | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  // Data states
  const [stages, setStages] = useState<ApplicationStage[]>([])
  const [reviewerTypes, setReviewerTypes] = useState<ReviewerType[]>([])
  const [rubrics, setRubrics] = useState<Rubric[]>([])
  const [stageConfigs, setStageConfigs] = useState<StageReviewerConfig[]>([])
  const [groups, setGroups] = useState<ApplicationGroup[]>([]) // Application Groups - global
  const [stageGroups, setStageGroups] = useState<StageGroup[]>([]) // Stage Groups - per stage
  const [workflowActions, setWorkflowActions] = useState<WorkflowAction[]>([])
  
  // Form sections for field visibility config
  const [formSections, setFormSections] = useState<FormSection[]>([])

  // Panel state for side-panel editing (no modals)
  const [panel, setPanel] = useState<PanelState>({ type: 'none', mode: 'create' })
  
  // Selected stage for configuration
  const [selectedStageId, setSelectedStageId] = useState<string | null>(null)

  // Fetch form sections/fields for field visibility config
  useEffect(() => {
    if (!formId) return
    
    const fetchFormSections = async () => {
      try {
        const form = await goClient.get<Form>(`/forms/${formId}`)
        
        // Helper to parse config safely
        const getConfig = (f: any) => {
          if (f.config) return f.config
          if (!f.options) return {}
          if (typeof f.options === 'string') {
            try { return JSON.parse(f.options) } catch { return {} }
          }
          return f.options
        }
        
        // Fields to exclude (internal tracking fields)
        const excludedFieldLabels = ['IP', '_user_agent', 'ip', 'user_agent', '_ip']
        
        if (form.settings?.sections) {
          const sections: FormSection[] = form.settings.sections.map((section: any) => {
            // Filter fields for this section, sorted by position
            const sectionFields = (form.fields || [])
              .filter((f: any) => {
                const config = getConfig(f)
                // Check section_id and exclude internal fields
                if (config.section_id !== section.id) return false
                if (excludedFieldLabels.includes(f.label)) return false
                if (excludedFieldLabels.includes(f.name)) return false
                return true
              })
              .sort((a: any, b: any) => (a.position || 0) - (b.position || 0))
              .map((f: any) => ({
                id: f.id,
                label: f.label || f.name
              }))
            
            return {
              id: section.id,
              title: section.title,
              description: section.description,
              fields: sectionFields
            }
          })
          
          // Filter out empty sections
          setFormSections(sections.filter(s => s.fields.length > 0))
        } else if (form.fields && form.fields.length > 0) {
          // Fallback: Create a default section with all fields if no sections defined
          const defaultSection: FormSection = {
            id: 'default',
            title: 'Application Fields',
            fields: form.fields
              .filter((f: any) => {
                if (excludedFieldLabels.includes(f.label)) return false
                if (excludedFieldLabels.includes(f.name)) return false
                return true
              })
              .sort((a: any, b: any) => (a.position || 0) - (b.position || 0))
              .map((f: any) => ({
                id: f.id,
                label: f.label || f.name
              }))
          }
          setFormSections([defaultSection])
        }
      } catch (error) {
        console.error('Failed to fetch form sections:', error)
      }
    }
    
    fetchFormSections()
  }, [formId])

  const fetchWorkflows = useCallback(async () => {
    setIsLoading(true)
    try {
      const data = await workflowsClient.listWorkflows(workspaceId)
      setWorkflows(data)
      // Auto-select first workflow if exists
      if (data.length > 0) {
        setSelectedWorkflow(prev => prev || data[0])
      }
    } catch (error) {
      console.error('Failed to fetch workflows:', error)
    } finally {
      setIsLoading(false)
    }
  }, [workspaceId])

  const fetchWorkflowData = useCallback(async () => {
    if (!selectedWorkflow) return
    setIsLoading(true)
    try {
      // Use combined endpoint to fetch all workflow data in a single API call
      const data = await workflowsClient.getReviewWorkspaceData(workspaceId, selectedWorkflow.id)
      
      // Map stages with their embedded reviewer configs
      const stagesData = data.stages.map(s => ({
        id: s.id,
        name: s.name,
        description: s.description,
        order_index: s.order_index,
        stage_type: s.stage_type,
        review_workflow_id: s.review_workflow_id,
        workspace_id: s.workspace_id,
        created_at: s.created_at,
        updated_at: s.updated_at,
        color: s.color,
        hide_pii: s.hide_pii,
        hidden_pii_fields: s.hidden_pii_fields,
        is_archived: (s as any).is_archived,
      } as ApplicationStage))
      
      setStages(stagesData)
      setReviewerTypes(data.reviewer_types)
      setRubrics(data.rubrics)
      setGroups(data.groups)
      setWorkflowActions(data.workflow_actions)
      setStageGroups(data.stage_groups)

      // Fetch stage configs if we have a selected stage
      // The combined endpoint includes reviewer_configs in stages, but we may need separate list for editing
      if (selectedStageId) {
        const stageWithConfigs = data.stages.find(s => s.id === selectedStageId)
        if (stageWithConfigs?.reviewer_configs) {
          setStageConfigs(stageWithConfigs.reviewer_configs)
        } else {
          const configs = await workflowsClient.listStageConfigs(selectedStageId)
          setStageConfigs(configs)
        }
      }
    } catch (error) {
      console.error('Failed to fetch workflow data:', error)
    } finally {
      setIsLoading(false)
    }
  }, [workspaceId, selectedWorkflow, selectedStageId])

  // Fetch workflows on mount or when workspaceId changes
  useEffect(() => {
    fetchWorkflows()
  }, [fetchWorkflows])

  // Fetch workflow data when selected workflow changes
  useEffect(() => {
    if (selectedWorkflow) {
      fetchWorkflowData()
    }
  }, [selectedWorkflow, fetchWorkflowData])

  // Subscribe to realtime workflow/stage changes
  useWorkflowRealtime({
    workspaceId,
    workflowId: selectedWorkflow?.id,
    enabled: !!workspaceId,
    onStageChange: fetchWorkflowData,
    onWorkflowChange: fetchWorkflows,
  })

  const handleCreateWorkflow = async (name: string, description?: string, applicationType?: string, defaultRubricId?: string) => {
    try {
      const newWorkflow = await workflowsClient.createWorkflow({
        workspace_id: workspaceId,
        name,
        description,
        application_type: applicationType,
        default_rubric_id: defaultRubricId,
        is_active: true
      })
      setWorkflows([...workflows, newWorkflow])
      setSelectedWorkflow(newWorkflow)
      setPanel({ type: 'none', mode: 'create' })
      showToast('Workflow created successfully', 'success')
    } catch (error: any) {
      console.error('Failed to create workflow:', error)
      showToast(error.message || 'Failed to create workflow', 'error')
    }
  }

  const handleUpdateWorkflow = async (id: string, updates: Partial<ReviewWorkflow>) => {
    try {
      const updated = await workflowsClient.updateWorkflow(id, updates)
      setWorkflows(workflows.map(w => w.id === id ? updated : w))
      if (selectedWorkflow?.id === id) {
        setSelectedWorkflow(updated)
      }
      setPanel({ type: 'none', mode: 'create' })
      showToast('Workflow updated successfully', 'success')
    } catch (error: any) {
      console.error('Failed to update workflow:', error)
      showToast(error.message || 'Failed to update workflow', 'error')
    }
  }

  const handleEditWorkflow = async (name: string, description?: string, applicationType?: string, defaultRubricId?: string) => {
    if (!selectedWorkflow) return
    await handleUpdateWorkflow(selectedWorkflow.id, { 
      name, 
      description,
      application_type: applicationType,
      default_rubric_id: defaultRubricId
    })
  }

  const handleDeleteWorkflow = async (id: string) => {
    if (!confirm('Delete this workflow? This will remove all stages and configurations.')) return
    try {
      await workflowsClient.deleteWorkflow(id)
      setWorkflows(workflows.filter(w => w.id !== id))
      if (selectedWorkflow?.id === id) {
        setSelectedWorkflow(workflows.filter(w => w.id !== id)[0] || null)
      }
      showToast('Workflow deleted successfully', 'success')
    } catch (error: any) {
      console.error('Failed to delete workflow:', error)
      showToast(error.message || 'Failed to delete workflow', 'error')
    }
  }

  const closePanel = () => setPanel({ type: 'none', mode: 'create' })

  const sortedStages = [...stages].sort((a, b) => a.order_index - b.order_index)

  return (
    <div className="h-full flex bg-gray-50">
      {/* Left Sidebar - Workflow Selector */}
      <div className="w-72 bg-white border-r border-gray-200 flex flex-col shadow-sm">
        {/* Workflow Selector Header */}
        <div className="p-4 border-b border-gray-100">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-violet-100 rounded-lg">
                <Layers className="w-4 h-4 text-violet-600" />
              </div>
              <span className="text-sm font-semibold text-gray-900">Workflows</span>
            </div>
            <Button 
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0 hover:bg-violet-50"
              onClick={() => setPanel({ type: 'workflow', mode: 'create' })}
              title="Create new workflow"
            >
              <Plus className="w-4 h-4" />
            </Button>
          </div>
          <Select 
            value={selectedWorkflow?.id || ''} 
            onValueChange={(id) => {
              const wf = workflows.find(w => w.id === id)
              if (wf) setSelectedWorkflow(wf)
            }}
          >
            <SelectTrigger className="w-full bg-white text-sm font-medium">
              <SelectValue placeholder="Select a workflow" />
            </SelectTrigger>
            <SelectContent>
              {workflows.map(wf => (
                <SelectItem key={wf.id} value={wf.id}>
                  <div className="flex items-center gap-2">
                    <span className="truncate">{wf.name}</span>
                    {wf.is_active && (
                      <Badge variant="secondary" className="text-[10px] bg-green-100 text-green-700 px-1.5 py-0">Active</Badge>
                    )}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {selectedWorkflow && (
            <button 
              onClick={() => setPanel({ type: 'workflow', mode: 'edit', data: selectedWorkflow })}
              className="w-full mt-2 flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium text-gray-600 hover:text-violet-700 hover:bg-violet-50 rounded-lg transition-colors border border-transparent hover:border-violet-100"
            >
              <Settings className="w-3.5 h-3.5" />
              Workflow Settings
            </button>
          )}
        </div>

        {/* Quick Stats - Resource Counter */}
        {selectedWorkflow && (
          <div className="p-3 border-b border-gray-100 bg-gray-50/50">
            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2 px-1">Resources</p>
            <div className="grid grid-cols-3 gap-2">
              <button 
                onClick={() => setPanel({ type: 'stage', mode: 'create' })}
                className="flex flex-col items-center p-2.5 rounded-xl bg-white border border-gray-100 hover:border-blue-200 hover:bg-blue-50 transition-all group shadow-sm"
              >
                <Layers className="w-4 h-4 text-blue-500 mb-1" />
                <span className="text-lg font-bold text-gray-900">{stages.length}</span>
                <span className="text-[10px] text-gray-500 group-hover:text-blue-600">Stages</span>
              </button>
              <button 
                onClick={() => setPanel({ type: 'reviewer', mode: 'create' })}
                className="flex flex-col items-center p-2.5 rounded-xl bg-white border border-gray-100 hover:border-purple-200 hover:bg-purple-50 transition-all group shadow-sm"
              >
                <Users className="w-4 h-4 text-purple-500 mb-1" />
                <span className="text-lg font-bold text-gray-900">{reviewerTypes.length}</span>
                <span className="text-[10px] text-gray-500 group-hover:text-purple-600">Roles</span>
              </button>
              <button 
                onClick={() => setPanel({ type: 'rubric', mode: 'create' })}
                className="flex flex-col items-center p-2.5 rounded-xl bg-white border border-gray-100 hover:border-amber-200 hover:bg-amber-50 transition-all group shadow-sm"
              >
                <Award className="w-4 h-4 text-amber-500 mb-1" />
                <span className="text-lg font-bold text-gray-900">{rubrics.length}</span>
                <span className="text-[10px] text-gray-500 group-hover:text-amber-600">Rubrics</span>
              </button>
            </div>
          </div>
        )}

        {/* Stages List */}
        {selectedWorkflow && (
          <div className="flex-1 overflow-y-auto p-3">
            <div className="flex items-center justify-between px-1 mb-2">
              <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Pipeline Stages</span>
              <button 
                onClick={() => setPanel({ type: 'stage', mode: 'create' })}
                className="text-xs text-blue-600 hover:text-blue-700 font-medium"
              >
                + Add
              </button>
            </div>
            <div className="space-y-1.5">
              {sortedStages.map((stage, idx) => {
                const stageColorKey: StageColorKey = ((stage as any).color as StageColorKey) || getDefaultStageColor(idx)
                const stageColor = STAGE_COLORS[stageColorKey]
                
                return (
                  <button
                    key={stage.id}
                    onClick={() => {
                      setSelectedStageId(stage.id)
                      setPanel({ type: 'stage-settings', mode: 'edit', data: {...stage, order_index: idx} })
                    }}
                    className={cn(
                      "w-full text-left px-3 py-2.5 rounded-xl transition-all",
                      selectedStageId === stage.id 
                        ? `${stageColor.bgLight} ${stageColor.border} border shadow-sm` 
                        : "hover:bg-gray-50 border border-transparent"
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        "w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold text-white shadow-sm",
                        stageColor.bg
                      )}>
                        {idx + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <span className="text-sm font-medium text-gray-900 block truncate">{stage.name}</span>
                        <span className="text-[10px] text-gray-500 capitalize">{stage.stage_type}</span>
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>
            {stages.length === 0 && (
              <div className="text-center py-8 px-4">
                <div className="w-12 h-12 bg-gray-100 rounded-xl flex items-center justify-center mx-auto mb-3">
                  <Layers className="w-6 h-6 text-gray-400" />
                </div>
                <p className="text-sm text-gray-500 mb-2">No stages yet</p>
                <button 
                  onClick={() => setPanel({ type: 'stage', mode: 'create' })}
                  className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                >
                  Create first stage →
                </button>
              </div>
            )}

            {/* Application Groups Section */}
            <div className="mt-6 pt-4 border-t border-gray-100">
              <div className="flex items-center justify-between px-1 mb-2">
                <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Application Groups</span>
                <button 
                  onClick={() => setPanel({ type: 'group', mode: 'create' })}
                  className="text-xs text-blue-600 hover:text-blue-700 font-medium"
                >
                  + Add
                </button>
              </div>
              <div className="space-y-1.5">
                {groups.map((group) => {
                  const groupColors: Record<string, { bg: string, text: string, bgLight: string }> = {
                    gray: { bg: 'bg-gray-500', text: 'text-gray-600', bgLight: 'bg-gray-50' },
                    red: { bg: 'bg-red-500', text: 'text-red-600', bgLight: 'bg-red-50' },
                    orange: { bg: 'bg-orange-500', text: 'text-orange-600', bgLight: 'bg-orange-50' },
                    yellow: { bg: 'bg-yellow-500', text: 'text-yellow-600', bgLight: 'bg-yellow-50' },
                    green: { bg: 'bg-green-500', text: 'text-green-600', bgLight: 'bg-green-50' },
                    blue: { bg: 'bg-blue-500', text: 'text-blue-600', bgLight: 'bg-blue-50' },
                    purple: { bg: 'bg-purple-500', text: 'text-purple-600', bgLight: 'bg-purple-50' },
                    pink: { bg: 'bg-pink-500', text: 'text-pink-600', bgLight: 'bg-pink-50' },
                  }
                  const colors = groupColors[group.color] || groupColors.gray
                  
                  return (
                    <button
                      key={group.id}
                      onClick={() => setPanel({ type: 'group', mode: 'edit', data: group })}
                      className={cn(
                        "w-full text-left px-3 py-2.5 rounded-xl transition-all",
                        "hover:bg-gray-50 border border-transparent"
                      )}
                    >
                      <div className="flex items-center gap-3">
                        <div className={cn(
                          "w-7 h-7 rounded-lg flex items-center justify-center text-white shadow-sm",
                          colors.bg
                        )}>
                          {group.icon === 'archive' ? (
                            <ArchiveX className="w-3.5 h-3.5" />
                          ) : (
                            <FolderOpen className="w-3.5 h-3.5" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <span className="text-sm font-medium text-gray-900 block truncate">{group.name}</span>
                          <span className="text-[10px] text-gray-500">
                            {group.is_system ? 'System' : 'Custom'} Group
                          </span>
                        </div>
                      </div>
                    </button>
                  )
                })}
              </div>
              {groups.length === 0 && (
                <div className="text-center py-4 px-4">
                  <div className="w-10 h-10 bg-gray-100 rounded-xl flex items-center justify-center mx-auto mb-2">
                    <FolderOpen className="w-5 h-5 text-gray-400" />
                  </div>
                  <p className="text-xs text-gray-500 mb-1">No groups yet</p>
                  <button 
                    onClick={() => setPanel({ type: 'group', mode: 'create' })}
                    className="text-xs text-blue-600 hover:text-blue-700 font-medium"
                  >
                    Create first group →
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Main Content Area */}
      <div className={cn(
        "flex-1 flex flex-col transition-all duration-300",
        panel.type !== 'none' ? "mr-[420px]" : ""
      )}>
        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {isLoading && !selectedWorkflow ? (
            <div className="flex items-center justify-center h-64">
              <Loader2 className="w-8 h-8 animate-spin text-violet-600" />
            </div>
          ) : !selectedWorkflow ? (
            <EmptyWorkflowState onCreate={() => setPanel({ type: 'workflow', mode: 'create' })} />
          ) : (
            <div className="p-6 space-y-8">
              {/* Workflow Pipeline */}
              <section>
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h2 className="text-xl font-bold text-gray-900">Review Pipeline</h2>
                    <p className="text-sm text-gray-500 mt-1">Applications flow through these stages in order</p>
                  </div>
                  <Button onClick={() => setPanel({ type: 'stage', mode: 'create' })} className="shadow-sm">
                    <Plus className="w-4 h-4 mr-2" />
                    Add Stage
                  </Button>
                </div>

                <DndProvider backend={HTML5Backend}>
                  <div className="relative">
                    {/* Improved Flow Visualization */}
                    {sortedStages.length > 0 && (
                      <div className="absolute left-[1.5rem] top-8 bottom-8 w-1 bg-gradient-to-b from-gray-200 via-gray-300 to-gray-200 rounded-full" />
                    )}

                    <div className="space-y-4">
                      {sortedStages.map((stage, index) => (
                        <StageCard
                          key={stage.id}
                          stage={{...stage, order_index: index}}
                          index={index}
                          isSelected={selectedStageId === stage.id}
                          reviewerTypes={reviewerTypes}
                          rubrics={rubrics}
                          onSelect={() => setSelectedStageId(stage.id)}
                          onEdit={() => setPanel({ type: 'stage-settings', mode: 'edit', data: {...stage, order_index: index} })}
                          onDelete={async () => {
                            if (confirm('Delete this stage?')) {
                              await workflowsClient.deleteStage(stage.id)
                              fetchWorkflowData()
                            }
                          }}
                          onConfigureReviewers={() => {
                            setSelectedStageId(stage.id)
                            setPanel({ type: 'stage-settings', mode: 'edit', data: {...stage, order_index: index} })
                          }}
                          onReorder={async (draggedId, targetId) => {
                            // Handle reorder
                            const draggedIndex = sortedStages.findIndex(s => s.id === draggedId)
                            const targetIndex = sortedStages.findIndex(s => s.id === targetId)
                            if (draggedIndex === -1 || targetIndex === -1) return

                            const newStages = [...sortedStages]
                            const [removed] = newStages.splice(draggedIndex, 1)
                            newStages.splice(targetIndex, 0, removed)

                            try {
                              await Promise.all(
                                newStages.map((s, i) => workflowsClient.updateStage(s.id, { order_index: i }))
                              )
                              fetchWorkflowData()
                            } catch (error) {
                              console.error('Reorder failed:', error)
                            }
                          }}
                        />
                      ))}

                      {sortedStages.length === 0 && (
                        <div className="text-center py-16 bg-gradient-to-br from-gray-50 to-slate-50 rounded-2xl border-2 border-dashed border-gray-200">
                          <div className="w-16 h-16 bg-gradient-to-br from-violet-100 to-purple-100 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-sm">
                            <Layers className="w-8 h-8 text-violet-500" />
                          </div>
                          <h3 className="text-lg font-semibold text-gray-900 mb-2">No stages yet</h3>
                          <p className="text-gray-500 mb-6 max-w-sm mx-auto">
                            Create stages to define how applications flow through your review process
                          </p>
                          <Button onClick={() => setPanel({ type: 'stage', mode: 'create' })} className="shadow-sm">
                            <Plus className="w-4 h-4 mr-2" />
                            Create First Stage
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                </DndProvider>
              </section>

              {/* Resources Section */}
              <div className="grid grid-cols-2 gap-6">
                {/* Reviewer Roles */}
                <section className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
                  <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-purple-100 rounded-lg">
                        <Users className="w-4 h-4 text-purple-600" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-gray-900">Reviewer Roles</h3>
                        <p className="text-xs text-gray-500">{reviewerTypes.length} roles defined</p>
                      </div>
                    </div>
                    <Button 
                      size="sm" 
                      variant="ghost"
                      onClick={() => setPanel({ type: 'reviewer', mode: 'create' })}
                    >
                      <Plus className="w-4 h-4" />
                    </Button>
                  </div>
                  <div className="p-3 space-y-2 max-h-64 overflow-y-auto">
                    {reviewerTypes.map(type => (
                      <div 
                        key={type.id}
                        className="flex items-center justify-between p-3 rounded-lg hover:bg-gray-50 group cursor-pointer transition-colors"
                        onClick={() => setPanel({ type: 'reviewer', mode: 'edit', data: type })}
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center text-purple-600 font-medium text-sm">
                            {type.name.charAt(0)}
                          </div>
                          <div>
                            <p className="font-medium text-gray-900 text-sm">{type.name}</p>
                            <p className="text-xs text-gray-500 truncate max-w-[200px]">{type.description || 'No description'}</p>
                          </div>
                        </div>
                        <ChevronRight className="w-4 h-4 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                    ))}
                    {reviewerTypes.length === 0 && (
                      <div className="text-center py-8 text-gray-500 text-sm">
                        <p>No reviewer roles yet</p>
                        <Button 
                          variant="link" 
                          size="sm" 
                          className="text-purple-600"
                          onClick={() => setPanel({ type: 'reviewer', mode: 'create' })}
                        >
                          Create one
                        </Button>
                      </div>
                    )}
                  </div>
                </section>

                {/* Rubrics */}
                <section className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                  <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-amber-100 rounded-lg">
                        <Award className="w-4 h-4 text-amber-600" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-gray-900">Scoring Rubrics</h3>
                        <p className="text-xs text-gray-500">{rubrics.length} rubrics defined</p>
                      </div>
                    </div>
                    <Button 
                      size="sm" 
                      variant="ghost"
                      onClick={() => setPanel({ type: 'rubric', mode: 'create' })}
                    >
                      <Plus className="w-4 h-4" />
                    </Button>
                  </div>
                  <div className="p-3 space-y-2 max-h-64 overflow-y-auto">
                    {rubrics.map(rubric => (
                      <div 
                        key={rubric.id}
                        className="flex items-center justify-between p-3 rounded-lg hover:bg-gray-50 group cursor-pointer transition-colors"
                        onClick={() => setPanel({ type: 'rubric', mode: 'edit', data: rubric })}
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center text-amber-600">
                            <ClipboardList className="w-4 h-4" />
                          </div>
                          <div>
                            <p className="font-medium text-gray-900 text-sm">{rubric.name}</p>
                            <p className="text-xs text-gray-500">
                              {Array.isArray(rubric.categories) ? rubric.categories.length : 0} criteria • Max {rubric.max_score} pts
                            </p>
                          </div>
                        </div>
                        <ChevronRight className="w-4 h-4 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                    ))}
                    {rubrics.length === 0 && (
                      <div className="text-center py-8 text-gray-500 text-sm">
                        <p>No rubrics yet</p>
                        <Button 
                          variant="link" 
                          size="sm" 
                          className="text-amber-600"
                          onClick={() => setPanel({ type: 'rubric', mode: 'create' })}
                        >
                          Create one
                        </Button>
                      </div>
                    )}
                  </div>
                </section>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Side Panel */}
      <SidePanel
        panel={panel}
        onClose={closePanel}
        workspaceId={workspaceId}
        workflowId={selectedWorkflow?.id}
        formId={formId || undefined}
        stageCount={stages.length}
        reviewerTypes={reviewerTypes}
        rubrics={rubrics}
        formSections={formSections}
        groups={groups}
        workflowActions={workflowActions}
        onSaveWorkflow={panel.mode === 'create' ? handleCreateWorkflow : handleEditWorkflow}
        onDeleteWorkflow={() => panel.data?.id && handleDeleteWorkflow(panel.data.id)}
        onRefresh={fetchWorkflowData}
      />
    </div>
  )
}

// Empty State Component
function EmptyWorkflowState({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center h-full py-16">
      <div className="w-20 h-20 bg-gradient-to-br from-violet-100 to-purple-100 rounded-2xl flex items-center justify-center mb-6">
        <Sparkles className="w-10 h-10 text-violet-500" />
      </div>
      <h2 className="text-2xl font-bold text-gray-900 mb-2">Create Your First Workflow</h2>
      <p className="text-gray-500 text-center max-w-md mb-8">
        Workflows define how applications move through your review process, 
        from initial submission to final decision.
      </p>
      <Button size="lg" onClick={onCreate}>
        <Plus className="w-5 h-5 mr-2" />
        Create Workflow
      </Button>
    </div>
  )
}

// Stat Card Component
function StatCard({ 
  icon: Icon, 
  label, 
  value, 
  color,
  onClick 
}: { 
  icon: any
  label: string
  value: number
  color: 'blue' | 'purple' | 'amber' | 'green'
  onClick?: () => void
}) {
  const colors = {
    blue: 'bg-blue-50 text-blue-600 border-blue-100',
    purple: 'bg-purple-50 text-purple-600 border-purple-100',
    amber: 'bg-amber-50 text-amber-600 border-amber-100',
    green: 'bg-green-50 text-green-600 border-green-100'
  }

  return (
    <div 
      className={cn(
        "bg-white border rounded-xl p-4 transition-all",
        onClick && "cursor-pointer hover:shadow-md hover:border-gray-300"
      )}
      onClick={onClick}
    >
      <div className="flex items-center justify-between">
        <div className={cn("p-2 rounded-lg", colors[color])}>
          <Icon className="w-5 h-5" />
        </div>
        {onClick && <Plus className="w-4 h-4 text-gray-400" />}
      </div>
      <p className="mt-3 text-2xl font-bold text-gray-900">{value}</p>
      <p className="text-sm text-gray-500">{label}</p>
    </div>
  )
}

// Stage Card Component with DnD
function StageCard({
  stage,
  index,
  isSelected,
  reviewerTypes,
  rubrics,
  onSelect,
  onEdit,
  onDelete,
  onConfigureReviewers,
  onReorder
}: {
  stage: ApplicationStage
  index: number
  isSelected: boolean
  reviewerTypes: ReviewerType[]
  rubrics: Rubric[]
  onSelect: () => void
  onEdit: () => void
  onDelete: () => void
  onConfigureReviewers: () => void
  onReorder: (draggedId: string, targetId: string) => void
}) {
  const [{ isDragging }, drag] = useDrag({
    type: 'stage',
    item: { id: stage.id, index },
    collect: (monitor) => ({
      isDragging: monitor.isDragging(),
    }),
  })

  const [{ isOver }, drop] = useDrop({
    accept: 'stage',
    collect: (monitor) => ({ isOver: monitor.isOver() }),
    drop: (item: { id: string }) => {
      if (item.id !== stage.id) {
        onReorder(item.id, stage.id)
      }
    },
  })

  const dragDropRef = (node: HTMLDivElement | null) => {
    drag(drop(node))
  }

  const stageTypeConfig = {
    review: { label: 'Review', icon: Users },
    processing: { label: 'Processing', icon: Zap },
    decision: { label: 'Decision', icon: Target }
  }

  const typeConfig = stageTypeConfig[stage.stage_type as keyof typeof stageTypeConfig] || stageTypeConfig.review
  
  // Get stage color - use saved color or default based on index
  const stageColorKey: StageColorKey = ((stage as any).color as StageColorKey) || getDefaultStageColor(index)
  const stageColor = STAGE_COLORS[stageColorKey]

  return (
    <div
      ref={dragDropRef}
      className={cn(
        "relative group transition-all",
        isDragging && "opacity-50 scale-[0.98]",
        isOver && !isDragging && "translate-x-1"
      )}
    >
      {/* Connector line */}
      {index > 0 && (
        <div className="absolute -top-4 left-[2.25rem] h-4 w-0.5 bg-gradient-to-b from-gray-200 to-gray-300" />
      )}
      
      <div className={cn(
        "ml-12 bg-white border rounded-xl overflow-hidden transition-all shadow-sm",
        isSelected ? `${stageColor.border} ring-2 ${stageColor.ring} shadow-lg` : "border-gray-200 hover:border-gray-300 hover:shadow-md",
        isDragging && `${stageColor.border}`
      )}>
        <div className="flex">
          {/* Stage Number with Color */}
          <div className={cn(
            "w-14 flex flex-col items-center justify-center text-white shrink-0",
            stageColor.bg
          )}>
            <span className="font-bold text-lg">{index + 1}</span>
            <typeConfig.icon className="w-3.5 h-3.5 opacity-75" />
          </div>

          {/* Content */}
          <div className="flex-1 p-4">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="font-semibold text-gray-900">{stage.name}</h3>
                  <Badge variant="outline" className={cn(
                    "text-xs",
                    stageColor.border, stageColor.text, stageColor.bgLight
                  )}>
                    {typeConfig.label}
                  </Badge>
                </div>
                <p className="text-sm text-gray-500 line-clamp-2">
                  {stage.description || 'No description provided'}
                </p>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity ml-4">
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onEdit} title="Stage Settings">
                  <Settings className="w-4 h-4" />
                </Button>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-red-500 hover:text-red-600 hover:bg-red-50" onClick={onDelete}>
                  <Trash2 className="w-4 h-4" />
                </Button>
                <div className="cursor-grab active:cursor-grabbing p-2 text-gray-400 hover:text-gray-600">
                  <GripVertical className="w-4 h-4" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// Side Panel Component
function SidePanel({
  panel,
  onClose,
  workspaceId,
  workflowId,
  formId,
  stageCount,
  reviewerTypes,
  rubrics,
  formSections,
  groups,
  workflowActions,
  onSaveWorkflow,
  onDeleteWorkflow,
  onRefresh
}: {
  panel: PanelState
  onClose: () => void
  workspaceId: string
  workflowId?: string
  formId?: string
  stageCount: number
  reviewerTypes: ReviewerType[]
  rubrics: Rubric[]
  formSections: FormSection[]
  groups: ApplicationGroup[]
  workflowActions: WorkflowAction[]
  onSaveWorkflow: (name: string, description?: string, applicationType?: string, defaultRubricId?: string) => void
  onDeleteWorkflow: () => void
  onRefresh: () => void
}) {
  if (panel.type === 'none') return null

  const titles: Record<ActivePanel, string> = {
    none: '',
    workflow: panel.mode === 'create' ? 'New Workflow' : 'Edit Workflow',
    stage: panel.mode === 'create' ? 'New Stage' : 'Edit Stage',
    reviewer: panel.mode === 'create' ? 'New Reviewer Role' : 'Edit Reviewer Role',
    rubric: panel.mode === 'create' ? 'New Rubric' : 'Edit Rubric',
    'stage-config': 'Configure Stage Reviewers',
    'stage-settings': 'Stage Settings',
    'stage-group': panel.mode === 'create' ? 'New Stage Group' : 'Edit Stage Group',
    'group': panel.mode === 'create' ? 'New Application Group' : 'Edit Application Group',
    'workflow-action': panel.mode === 'create' ? 'New Workflow Action' : 'Edit Workflow Action',
    'stage-action': panel.mode === 'create' ? 'New Stage Action' : 'Edit Stage Action'
  }

  // Use wider panel for stage settings
  const isWidePanel = panel.type === 'stage-settings'

  return (
    <div className={cn(
      "fixed right-2 top-2 bottom-2 bg-white border border-gray-200 rounded-xl shadow-xl z-50 flex flex-col animate-in slide-in-from-right duration-300",
      isWidePanel ? "w-[780px]" : "w-[560px]"
    )}>
      {/* Panel Header - Hide for stage-settings since it has its own */}
      {!isWidePanel && (
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between bg-gray-50">
          <h2 className="text-lg font-semibold text-gray-900">{titles[panel.type]}</h2>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="w-5 h-5" />
          </Button>
        </div>
      )}

      {/* Panel Content */}
      <div className={cn(
        "flex-1 overflow-hidden",
        isWidePanel ? "" : "overflow-y-auto p-6"
      )}>
        {panel.type === 'workflow' && (
          <WorkflowForm
            initial={panel.mode === 'edit' ? panel.data : undefined}
            rubrics={rubrics}
            onSave={onSaveWorkflow}
            onDelete={panel.mode === 'edit' ? onDeleteWorkflow : undefined}
            onCancel={onClose}
          />
        )}

        {panel.type === 'stage' && workflowId && (
          <StageForm
            initial={panel.mode === 'edit' ? panel.data : undefined}
            workspaceId={workspaceId}
            workflowId={workflowId}
            stageCount={stageCount}
            reviewerTypes={reviewerTypes}
            rubrics={rubrics}
            formSections={formSections}
            onSave={onRefresh}
            onCancel={onClose}
          />
        )}

        {panel.type === 'reviewer' && (
          <ReviewerTypeForm
            initial={panel.mode === 'edit' ? panel.data : undefined}
            workspaceId={workspaceId}
            onSave={onRefresh}
            onCancel={onClose}
          />
        )}

        {panel.type === 'rubric' && (
          <RubricForm
            initial={panel.mode === 'edit' ? panel.data : undefined}
            workspaceId={workspaceId}
            onSave={onRefresh}
            onCancel={onClose}
          />
        )}

        {panel.type === 'stage-config' && panel.data && (
          <StageConfigForm
            stage={panel.data}
            reviewerTypes={reviewerTypes}
            rubrics={rubrics}
            formSections={formSections}
            onSave={onRefresh}
            onCancel={onClose}
          />
        )}

        {panel.type === 'stage-settings' && panel.data && workflowId && (
          <CombinedStageSettings
            stage={panel.data}
            workspaceId={workspaceId}
            workflowId={workflowId}
            formId={formId}
            stageCount={stageCount}
            reviewerTypes={reviewerTypes}
            rubrics={rubrics}
            formSections={formSections}
            onSave={onRefresh}
            onCancel={onClose}
          />
        )}

        {panel.type === 'group' && workflowId && (
          <GroupForm
            initial={panel.mode === 'edit' ? panel.data : undefined}
            workspaceId={workspaceId}
            workflowId={workflowId}
            onSave={onRefresh}
            onCancel={onClose}
          />
        )}

        {panel.type === 'workflow-action' && workflowId && (
          <WorkflowActionForm
            initial={panel.mode === 'edit' ? panel.data : undefined}
            workspaceId={workspaceId}
            workflowId={workflowId}
            groups={groups}
            onSave={onRefresh}
            onCancel={onClose}
          />
        )}
      </div>
    </div>
  )
}

// Combined Stage Settings Component with Clean Design
function CombinedStageSettings({
  stage,
  workspaceId,
  workflowId,
  formId,
  stageCount,
  reviewerTypes,
  rubrics,
  formSections,
  onSave,
  onCancel
}: {
  stage: ApplicationStage
  workspaceId: string
  workflowId: string
  formId?: string
  stageCount: number
  reviewerTypes: ReviewerType[]
  rubrics: Rubric[]
  formSections: FormSection[]
  onSave: () => void
  onCancel: () => void
}) {
  const [activeTab, setActiveTab] = useState<'general' | 'reviewers' | 'actions' | 'automation' | 'groups' | 'privacy'>('general')
  const [isClosing, setIsClosing] = useState(false)
  
  // Save function refs for each tab that needs save-on-close
  const saveFunctionsRef = useRef<Record<string, () => Promise<void>>>({})
  
  // Register a save function from a child component
  const registerSaveFunction = useCallback((tabId: string, saveFn: () => Promise<void>) => {
    saveFunctionsRef.current[tabId] = saveFn
  }, [])
  
  // Unregister a save function when component unmounts
  const unregisterSaveFunction = useCallback((tabId: string) => {
    delete saveFunctionsRef.current[tabId]
  }, [])
  
  // Handle close with save
  const handleClose = async () => {
    setIsClosing(true)
    try {
      // Save all registered tabs
      const savePromises = Object.values(saveFunctionsRef.current).map(fn => fn())
      await Promise.all(savePromises)
      onSave()
    } catch (error) {
      console.error('Failed to save on close:', error)
    } finally {
      setIsClosing(false)
      onCancel()
    }
  }
  
  // Get stage color
  const stageColorKey: StageColorKey = ((stage as any).color as StageColorKey) || getDefaultStageColor(stage.order_index || 0)
  const stageColor = STAGE_COLORS[stageColorKey]

  const tabs = [
    { id: 'general' as const, label: 'General', icon: FileText, description: 'Basic stage settings' },
    { id: 'reviewers' as const, label: 'Reviewers', icon: Users, description: 'Who reviews applications' },
    { id: 'actions' as const, label: 'Actions', icon: Sparkles, description: 'Status action buttons' },
    { id: 'automation' as const, label: 'Automation', icon: Zap, description: 'Rules & triggers' },
    { id: 'groups' as const, label: 'Groups', icon: Folder, description: 'Organize applications' },
    { id: 'privacy' as const, label: 'Privacy', icon: Shield, description: 'Hide sensitive fields' },
  ]

  return (
    <div className="flex h-full bg-white">
      {/* Left Sidebar with Tabs */}
      <div className="w-56 flex-shrink-0 border-r bg-gray-50 flex flex-col">
        {/* Header */}
        <div className="p-4 border-b bg-white">
          <div className="flex items-center gap-3">
            <div className={cn(
              "w-10 h-10 rounded-lg flex items-center justify-center text-white font-semibold shadow-sm",
              stageColor.bg
            )}>
              {(stage.order_index || 0) + 1}
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-sm font-semibold text-gray-900 truncate">{stage.name}</h2>
              <p className="text-xs text-gray-500">Stage {(stage.order_index || 0) + 1} of {stageCount}</p>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "w-full flex items-start gap-3 px-3 py-2.5 rounded-lg text-left transition-all",
                activeTab === tab.id
                  ? cn("bg-white shadow-sm border", stageColor.text)
                  : "text-gray-600 hover:bg-white/60 hover:text-gray-900"
              )}
            >
              <tab.icon className={cn(
                "w-4 h-4 mt-0.5 flex-shrink-0",
                activeTab === tab.id ? stageColor.text : "text-gray-400"
              )} />
              <div className="min-w-0">
                <div className="text-sm font-medium">{tab.label}</div>
                <div className="text-xs text-gray-400 truncate">{tab.description}</div>
              </div>
            </button>
          ))}
        </nav>

        {/* Close button at bottom */}
        <div className="p-3 border-t">
          <button
            onClick={handleClose}
            disabled={isClosing}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 text-sm text-gray-600 hover:text-gray-900 hover:bg-white rounded-lg transition-colors disabled:opacity-50"
          >
            {isClosing ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <X className="w-4 h-4" />
                Close
              </>
            )}
          </button>
        </div>
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-y-auto">
        <div className="p-6 min-h-full">
          {activeTab === 'general' && (
            <GeneralStageSettings
              stage={stage}
              workspaceId={workspaceId}
              workflowId={workflowId}
              stageCount={stageCount}
              onSave={onSave}
              onCancel={onCancel}
              registerSaveFunction={(fn) => registerSaveFunction('general', fn)}
              unregisterSaveFunction={() => unregisterSaveFunction('general')}
            />
          )}
          {activeTab === 'reviewers' && (
            <ReviewerStageSettings
              stage={stage}
              reviewerTypes={reviewerTypes}
              rubrics={rubrics}
              formSections={formSections}
              formId={formId}
              onSave={onSave}
              registerSaveFunction={(fn) => registerSaveFunction('reviewers', fn)}
              unregisterSaveFunction={() => unregisterSaveFunction('reviewers')}
            />
          )}
          {activeTab === 'actions' && (
            <StatusActionsSettings
              stage={stage}
              workspaceId={workspaceId}
              workflowId={workflowId}
              onSave={onSave}
            />
          )}
          {activeTab === 'automation' && (
            <AdvancedAutomationSettings
              stage={stage}
              workspaceId={workspaceId}
              workflowId={workflowId}
              formSections={formSections}
              reviewerTypes={reviewerTypes}
              onSave={onSave}
            />
          )}
          {activeTab === 'groups' && (
            <StageGroupsSettings
              stage={stage}
              workspaceId={workspaceId}
              onSave={onSave}
            />
          )}
          {activeTab === 'privacy' && (
            <PrivacyStageSettings
              stage={stage}
              formSections={formSections}
              onSave={onSave}
            />
          )}
        </div>
      </div>
    </div>
  )
}

// Form Components

function WorkflowForm({
  initial,
  rubrics,
  onSave,
  onDelete,
  onCancel
}: {
  initial?: ReviewWorkflow
  rubrics?: Rubric[]
  onSave: (name: string, description?: string, applicationType?: string, defaultRubricId?: string) => void
  onDelete?: () => void
  onCancel: () => void
}) {
  const [name, setName] = useState(initial?.name || '')
  const [description, setDescription] = useState(initial?.description || '')
  const [applicationType, setApplicationType] = useState(initial?.application_type || '')
  const [defaultRubricId, setDefaultRubricId] = useState(initial?.default_rubric_id || '')
  const [isActive, setIsActive] = useState(initial?.is_active ?? true)
  const [isSaving, setIsSaving] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return
    setIsSaving(true)
    try {
      const rubricId = defaultRubricId && defaultRubricId !== 'none' ? defaultRubricId : undefined
      await onSave(name.trim(), description.trim() || undefined, applicationType.trim() || undefined, rubricId)
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-2">
        <Label htmlFor="wf-name">Workflow Name *</Label>
        <Input
          id="wf-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g., Fall 2024 Scholarship Review"
          autoFocus
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="wf-desc">Description</Label>
        <Textarea
          id="wf-desc"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Describe the purpose of this workflow..."
          rows={3}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="wf-type">Application Type</Label>
        <Input
          id="wf-type"
          value={applicationType}
          onChange={(e) => setApplicationType(e.target.value)}
          placeholder="e.g., In The Game Scholarship 2025"
        />
        <p className="text-xs text-gray-500">Associate this workflow with a specific application form</p>
      </div>

      {rubrics && rubrics.length > 0 && (
        <div className="space-y-2">
          <Label htmlFor="wf-rubric">Default Rubric</Label>
          <Select value={defaultRubricId} onValueChange={setDefaultRubricId}>
            <SelectTrigger>
              <SelectValue placeholder="Select a default rubric (optional)" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">No default rubric</SelectItem>
              {rubrics.map(r => (
                <SelectItem key={r.id} value={r.id}>
                  {r.name} ({r.max_score} pts)
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-gray-500">Stages can override this with their own rubric</p>
        </div>
      )}

      {initial && (
        <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
          <div>
            <Label>Status</Label>
            <p className="text-xs text-gray-500 mt-1">
              {isActive ? 'Active - accepting applications' : 'Inactive'}
            </p>
          </div>
          <Switch checked={isActive} onCheckedChange={setIsActive} />
        </div>
      )}

      <div className="flex gap-3 pt-4">
        <Button type="button" variant="outline" onClick={onCancel} className="flex-1">
          Cancel
        </Button>
        <Button type="submit" disabled={!name.trim() || isSaving} className="flex-1">
          {isSaving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
          {initial ? 'Save Changes' : 'Create'}
        </Button>
      </div>

      {initial && onDelete && (
        <Button 
          type="button" 
          variant="ghost" 
          className="w-full text-red-600 hover:text-red-700 hover:bg-red-50"
          onClick={onDelete}
        >
          <Trash2 className="w-4 h-4 mr-2" />
          Delete Workflow
        </Button>
      )}
    </form>
  )
}

function StageForm({
  initial,
  workspaceId,
  workflowId,
  stageCount,
  reviewerTypes,
  rubrics,
  formSections,
  onSave,
  onCancel
}: {
  initial?: ApplicationStage
  workspaceId: string
  workflowId: string
  stageCount: number
  reviewerTypes: ReviewerType[]
  rubrics: Rubric[]
  formSections: FormSection[]
  onSave: () => void
  onCancel: () => void
}) {
  const [name, setName] = useState(initial?.name || '')
  const [description, setDescription] = useState(initial?.description || '')
  const [stageType, setStageType] = useState(initial?.stage_type || 'review')
  const [stageColor, setStageColor] = useState<StageColorKey>(((initial as any)?.color as StageColorKey) || getDefaultStageColor(stageCount))
  const [startDate, setStartDate] = useState(initial?.start_date?.split('T')[0] || '')
  const [endDate, setEndDate] = useState(initial?.end_date?.split('T')[0] || '')
  const [relativeDeadline, setRelativeDeadline] = useState(initial?.relative_deadline || '')
  // Normalize custom_statuses to string array (it can be string[] or StatusOption[])
  const normalizeStatuses = (statuses: any): string[] => {
    if (!statuses) return ['Pending', 'In Progress', 'Complete']
    return statuses.map((s: any) => typeof s === 'string' ? s : s.name)
  }
  // Normalize custom_tags to string array (it can be string[] or TagOption[])
  const normalizeTags = (tags: any): string[] => {
    if (!tags) return []
    return tags.map((t: any) => typeof t === 'string' ? t : t.name)
  }
  const [customStatuses, setCustomStatuses] = useState<string[]>(normalizeStatuses(initial?.custom_statuses))
  const [customTags, setCustomTags] = useState<string[]>(normalizeTags(initial?.custom_tags))
  const [newStatus, setNewStatus] = useState('')
  const [newTag, setNewTag] = useState('')
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [showLogicBuilder, setShowLogicBuilder] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  
  // Privacy / PII Settings
  const [hidePII, setHidePII] = useState(initial?.hide_pii || false)
  const [hiddenPIIFields, setHiddenPIIFields] = useState<string[]>(initial?.hidden_pii_fields || [])
  
  // Logic Rules State
  const [logicRules, setLogicRules] = useState<{
    auto_advance_condition?: string
    auto_reject_condition?: string
    visibility_rules?: string
  }>(initial?.logic_rules || {})
  
  // Individual rule builders
  const [advanceField, setAdvanceField] = useState('average_score')
  const [advanceOperator, setAdvanceOperator] = useState('>=')
  const [advanceValue, setAdvanceValue] = useState('80')
  const [advanceAction, setAdvanceAction] = useState('move_to_next')
  
  const [rejectField, setRejectField] = useState('gpa')
  const [rejectOperator, setRejectOperator] = useState('<')
  const [rejectValue, setRejectValue] = useState('2.7')
  const [rejectAction, setRejectAction] = useState('set_ineligible')
  
  const [visibilityReviewerTypes, setVisibilityReviewerTypes] = useState<string[]>([])

  // Parse existing logic rules on mount
  useEffect(() => {
    if (initial?.logic_rules) {
      // Parse auto_advance_condition
      if (initial.logic_rules.auto_advance_condition) {
        const advMatch = initial.logic_rules.auto_advance_condition.match(/if\s+(\w+)\s*(>=|<=|>|<|==|!=)\s*(\S+)\s+then/i)
        if (advMatch) {
          setAdvanceField(advMatch[1])
          setAdvanceOperator(advMatch[2])
          setAdvanceValue(advMatch[3])
        }
      }
      // Parse auto_reject_condition
      if (initial.logic_rules.auto_reject_condition) {
        const rejMatch = initial.logic_rules.auto_reject_condition.match(/if\s+(\w+)\s*(>=|<=|>|<|==|!=)\s*(\S+)\s+then/i)
        if (rejMatch) {
          setRejectField(rejMatch[1])
          setRejectOperator(rejMatch[2])
          setRejectValue(rejMatch[3])
        }
      }
      // Parse visibility_rules
      if (initial.logic_rules.visibility_rules) {
        const visMatch = initial.logic_rules.visibility_rules.match(/\[(.*?)\]/i)
        if (visMatch) {
          const types = visMatch[1].split(',').map(s => s.trim().replace(/['"]/g, ''))
          setVisibilityReviewerTypes(types)
        }
      }
    }
  }, [initial?.logic_rules])

  const addStatus = () => {
    if (newStatus.trim() && !customStatuses.includes(newStatus.trim())) {
      setCustomStatuses([...customStatuses, newStatus.trim()])
      setNewStatus('')
    }
  }

  const removeStatus = (status: string) => {
    setCustomStatuses(customStatuses.filter(s => s !== status))
  }

  const addTag = () => {
    if (newTag.trim() && !customTags.includes(newTag.trim())) {
      setCustomTags([...customTags, newTag.trim()])
      setNewTag('')
    }
  }

  const removeTag = (tag: string) => {
    setCustomTags(customTags.filter(t => t !== tag))
  }

  // Build logic rules from UI state
  const buildLogicRules = () => {
    const rules: typeof logicRules = {}
    
    if (advanceField && advanceOperator && advanceValue) {
      const actionText = advanceAction === 'move_to_next' 
        ? 'move to next_stage' 
        : advanceAction === 'set_approved'
        ? "set status = 'Approved'"
        : 'complete workflow'
      rules.auto_advance_condition = `if ${advanceField} ${advanceOperator} ${advanceValue} then ${actionText}`
    }
    
    if (rejectField && rejectOperator && rejectValue) {
      const actionText = rejectAction === 'set_ineligible'
        ? "set status = 'Ineligible' and stop workflow"
        : rejectAction === 'set_declined'
        ? "set status = 'Declined'"
        : 'flag for review'
      rules.auto_reject_condition = `if ${rejectField} ${rejectOperator} ${rejectValue} then ${actionText}`
    }
    
    if (visibilityReviewerTypes.length > 0) {
      rules.visibility_rules = `only show stage to reviewer types [${visibilityReviewerTypes.map(t => `'${t}'`).join(', ')}]`
    }
    
    return rules
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return
    setIsSaving(true)
    try {
      const builtRules = buildLogicRules()
      const stageData = {
        name: name.trim(),
        description: description.trim() || undefined,
        stage_type: stageType,
        color: stageColor,
        start_date: startDate ? new Date(startDate).toISOString() : undefined,
        end_date: endDate ? new Date(endDate).toISOString() : undefined,
        relative_deadline: relativeDeadline && relativeDeadline !== 'none' ? relativeDeadline : undefined,
        custom_statuses: customStatuses.length > 0 ? customStatuses : undefined,
        custom_tags: customTags.length > 0 ? customTags : undefined,
        logic_rules: Object.keys(builtRules).length > 0 ? builtRules : undefined,
        hide_pii: hidePII,
        hidden_pii_fields: hiddenPIIFields, // Always send the array
      }
      
      if (initial) {
        await workflowsClient.updateStage(initial.id, stageData)
        showToast('Stage updated successfully', 'success')
      } else {
        await workflowsClient.createStage({
          workspace_id: workspaceId,
          review_workflow_id: workflowId,
          order_index: stageCount,
          ...stageData
        })
        showToast('Stage created successfully', 'success')
      }
      onSave()
      onCancel()
    } catch (error: any) {
      console.error('Failed to save stage:', error)
      showToast(error.message || 'Failed to save stage', 'error')
    } finally {
      setIsSaving(false)
    }
  }

  // Build comprehensive field options grouped by category
  const fieldGroups = [
    {
      id: 'review',
      name: '📊 Review Scores',
      icon: '📊',
      fields: [
        { value: 'average_score', label: 'Average Score', type: 'number' },
        { value: 'total_score', label: 'Total Score', type: 'number' },
        { value: 'reviews_complete', label: 'Reviews Complete', type: 'number' },
        { value: 'min_score', label: 'Minimum Score', type: 'number' },
        { value: 'max_score', label: 'Maximum Score', type: 'number' },
      ]
    },
    {
      id: 'status',
      name: '🏷️ Application Status',
      icon: '🏷️',
      fields: [
        { value: 'status', label: 'Current Status', type: 'select' },
        { value: 'stage', label: 'Current Stage', type: 'select' },
        { value: 'days_in_stage', label: 'Days in Stage', type: 'number' },
        { value: 'has_flag', label: 'Has Flag', type: 'boolean' },
      ]
    },
    // Add form sections as field groups
    ...formSections.map(section => ({
      id: `form_${section.id}`,
      name: `📝 ${section.title}`,
      icon: '📝',
      fields: section.fields.map(f => ({
        value: `form.${section.id}.${f.id}`,
        label: f.label,
        type: 'text' as const
      }))
    }))
  ]

  // Flatten all fields for easy lookup
  const allFields = fieldGroups.flatMap(g => g.fields)

  const operatorOptions = [
    { value: '>=', label: '≥ greater or equal', types: ['number'] },
    { value: '<=', label: '≤ less or equal', types: ['number'] },
    { value: '>', label: '> greater than', types: ['number'] },
    { value: '<', label: '< less than', types: ['number'] },
    { value: '==', label: '= equals', types: ['number', 'text', 'select', 'boolean'] },
    { value: '!=', label: '≠ not equals', types: ['number', 'text', 'select', 'boolean'] },
    { value: 'contains', label: 'contains', types: ['text'] },
    { value: 'starts_with', label: 'starts with', types: ['text'] },
    { value: 'is_empty', label: 'is empty', types: ['text', 'select'] },
    { value: 'is_not_empty', label: 'is not empty', types: ['text', 'select'] },
  ]

  // Get operators valid for a field type
  const getOperatorsForField = (fieldValue: string) => {
    const field = allFields.find(f => f.value === fieldValue)
    const fieldType = field?.type || 'text'
    return operatorOptions.filter(op => op.types.includes(fieldType))
  }

  // State for field picker modal
  const [showFieldPicker, setShowFieldPicker] = useState<'advance' | 'reject' | null>(null)
  const [fieldSearchQuery, setFieldSearchQuery] = useState('')
  const [expandedGroups, setExpandedGroups] = useState<string[]>(['review'])

  const toggleGroup = (groupId: string) => {
    setExpandedGroups(prev => 
      prev.includes(groupId) 
        ? prev.filter(id => id !== groupId)
        : [...prev, groupId]
    )
  }

  const selectField = (fieldValue: string) => {
    if (showFieldPicker === 'advance') {
      setAdvanceField(fieldValue)
      // Reset operator to first valid one
      const validOps = getOperatorsForField(fieldValue)
      if (validOps.length > 0 && !validOps.find(op => op.value === advanceOperator)) {
        setAdvanceOperator(validOps[0].value)
      }
    } else if (showFieldPicker === 'reject') {
      setRejectField(fieldValue)
      const validOps = getOperatorsForField(fieldValue)
      if (validOps.length > 0 && !validOps.find(op => op.value === rejectOperator)) {
        setRejectOperator(validOps[0].value)
      }
    }
    setShowFieldPicker(null)
    setFieldSearchQuery('')
  }

  // Filter fields based on search
  const filteredFieldGroups = fieldGroups.map(group => ({
    ...group,
    fields: group.fields.filter(f => 
      f.label.toLowerCase().includes(fieldSearchQuery.toLowerCase()) ||
      f.value.toLowerCase().includes(fieldSearchQuery.toLowerCase())
    )
  })).filter(g => g.fields.length > 0)

  // Get display label for a field value
  const getFieldLabel = (fieldValue: string) => {
    const field = allFields.find(f => f.value === fieldValue)
    return field?.label || fieldValue
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-2">
        <Label htmlFor="stage-name">Stage Name *</Label>
        <Input
          id="stage-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g., Initial Review, Committee Review"
          autoFocus
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="stage-type">Stage Type</Label>
        <Select value={stageType} onValueChange={setStageType}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="review">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-blue-500" />
                <span>Review Stage</span>
              </div>
            </SelectItem>
            <SelectItem value="processing">
              <div className="flex items-center gap-2">
                <Zap className="w-4 h-4 text-green-500" />
                <span>Processing Stage</span>
              </div>
            </SelectItem>
            <SelectItem value="decision">
              <div className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-purple-500" />
                <span>Decision Stage</span>
              </div>
            </SelectItem>
          </SelectContent>
        </Select>
        <p className="text-xs text-gray-500">
          {stageType === 'review' 
            ? 'Human reviewers evaluate applications' 
            : stageType === 'decision'
            ? 'Final decision point in the workflow'
            : 'Automated processing or admin actions'}
        </p>
      </div>

      {/* Stage Color Picker */}
      <div className="space-y-2">
        <Label>Stage Color</Label>
        <div className="flex flex-wrap gap-2">
          {(Object.entries(STAGE_COLORS) as [StageColorKey, typeof STAGE_COLORS[StageColorKey]][]).map(([key, color]) => (
            <button
              key={key}
              type="button"
              onClick={() => setStageColor(key)}
              className={cn(
                "w-8 h-8 rounded-lg transition-all flex items-center justify-center",
                color.bg,
                stageColor === key ? "ring-2 ring-offset-2 ring-gray-900 scale-110" : "hover:scale-105"
              )}
              title={color.label}
            >
              {stageColor === key && <Check className="w-4 h-4 text-white" />}
            </button>
          ))}
        </div>
        <p className="text-xs text-gray-500">Choose a color to identify this stage in the workflow</p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="stage-desc">Description</Label>
        <Textarea
          id="stage-desc"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="What happens in this stage?"
          rows={3}
        />
      </div>

      {/* Timeline Section */}
      <div className="border-t pt-4">
        <Label className="text-sm font-medium">Timeline (Optional)</Label>
        <div className="grid grid-cols-2 gap-3 mt-2">
          <div className="space-y-1">
            <Label htmlFor="start-date" className="text-xs text-gray-500">Start Date</Label>
            <Input
              id="start-date"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="end-date" className="text-xs text-gray-500">End Date</Label>
            <Input
              id="end-date"
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </div>
        </div>
        <div className="mt-3 space-y-1">
          <Label htmlFor="relative-deadline" className="text-xs text-gray-500">Or Relative Deadline</Label>
          <Select value={relativeDeadline} onValueChange={setRelativeDeadline}>
            <SelectTrigger>
              <SelectValue placeholder="No relative deadline" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">No relative deadline</SelectItem>
              <SelectItem value="3d">3 days after assignment</SelectItem>
              <SelectItem value="1w">1 week after assignment</SelectItem>
              <SelectItem value="2w">2 weeks after assignment</SelectItem>
              <SelectItem value="1m">1 month after assignment</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Advanced Settings */}
      <div className="border-t pt-4">
        <button
          type="button"
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="flex items-center gap-2 text-sm font-medium text-gray-700 hover:text-gray-900"
        >
          <ChevronDown className={`w-4 h-4 transition-transform ${showAdvanced ? 'rotate-180' : ''}`} />
          Statuses & Tags
        </button>
        
        {showAdvanced && (
          <div className="mt-4 space-y-4">
            {/* Custom Statuses */}
            <div className="space-y-2">
              <Label className="text-sm">Custom Statuses</Label>
              <p className="text-xs text-gray-500">Define the statuses applications can have in this stage</p>
              <div className="flex flex-wrap gap-2 mb-2">
                {customStatuses.map(status => (
                  <span key={status} className="inline-flex items-center gap-1 px-2 py-1 bg-gray-100 rounded-md text-sm">
                    {status}
                    <button type="button" onClick={() => removeStatus(status)} className="text-gray-400 hover:text-gray-600">
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
              <div className="flex gap-2">
                <Input
                  value={newStatus}
                  onChange={(e) => setNewStatus(e.target.value)}
                  placeholder="Add status..."
                  onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addStatus())}
                />
                <Button type="button" variant="outline" size="icon" onClick={addStatus}>
                  <Plus className="w-4 h-4" />
                </Button>
              </div>
            </div>

            {/* Custom Tags */}
            <div className="space-y-2">
              <Label className="text-sm">Custom Tags</Label>
              <p className="text-xs text-gray-500">Tags reviewers can apply to applications</p>
              <div className="flex flex-wrap gap-2 mb-2">
                {customTags.map(tag => (
                  <span key={tag} className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-800 rounded-md text-sm">
                    {tag}
                    <button type="button" onClick={() => removeTag(tag)} className="text-blue-400 hover:text-blue-600">
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
              <div className="flex gap-2">
                <Input
                  value={newTag}
                  onChange={(e) => setNewTag(e.target.value)}
                  placeholder="Add tag..."
                  onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addTag())}
                />
                <Button type="button" variant="outline" size="icon" onClick={addTag}>
                  <Plus className="w-4 h-4" />
                </Button>
              </div>
            </div>
            
            {/* Privacy / PII Settings */}
            <div className="space-y-3 pt-4 border-t border-gray-100">
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-sm flex items-center gap-2">
                    <Shield className="w-4 h-4 text-purple-500" />
                    Privacy Mode
                  </Label>
                  <p className="text-xs text-gray-500 mt-1">Hide personally identifiable information from reviewers</p>
                </div>
                <Switch
                  checked={hidePII}
                  onCheckedChange={setHidePII}
                />
              </div>
              
              {hidePII && (
                <div className="mt-3 p-3 bg-purple-50 rounded-lg border border-purple-100">
                  <Label className="text-sm text-purple-900 flex items-center gap-2 mb-2">
                    <EyeOff className="w-4 h-4" />
                    Fields to Hide
                  </Label>
                  <p className="text-xs text-purple-700 mb-3">Select which fields should be hidden from reviewers in this stage</p>
                  
                  {/* Form sections with fields */}
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {formSections.length > 0 ? (
                      formSections.map(section => (
                        <div key={section.id} className="bg-white rounded-lg p-2 border border-purple-100">
                          <p className="text-xs font-medium text-gray-700 mb-2">{section.title}</p>
                          <div className="space-y-1">
                            {section.fields.map(field => (
                              <label key={field.id} className="flex items-center gap-2 text-sm cursor-pointer hover:bg-purple-50 p-1 rounded">
                                <input
                                  type="checkbox"
                                  checked={hiddenPIIFields.includes(field.id)}
                                  onChange={(e) => {
                                    if (e.target.checked) {
                                      setHiddenPIIFields([...hiddenPIIFields, field.id])
                                    } else {
                                      setHiddenPIIFields(hiddenPIIFields.filter(f => f !== field.id))
                                    }
                                  }}
                                  className="rounded border-purple-300 text-purple-600 focus:ring-purple-500"
                                />
                                <span className="text-gray-700">{field.label}</span>
                              </label>
                            ))}
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="text-xs text-purple-600 italic">
                        Common PII fields will be hidden: name, email, phone, address
                      </div>
                    )}
                  </div>
                  
                  {hiddenPIIFields.length > 0 && (
                    <div className="mt-3 pt-2 border-t border-purple-100">
                      <p className="text-xs text-purple-700">
                        <strong>{hiddenPIIFields.length}</strong> field(s) will be hidden
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Logic Builder Section */}
      <div className="border-t pt-4">
        <button
          type="button"
          onClick={() => setShowLogicBuilder(!showLogicBuilder)}
          className="flex items-center gap-2 text-sm font-medium text-gray-700 hover:text-gray-900 w-full"
        >
          <ChevronDown className={`w-4 h-4 transition-transform ${showLogicBuilder ? 'rotate-180' : ''}`} />
          <div className="flex items-center gap-2 flex-1">
            <div className="p-1 bg-amber-100 rounded">
              <Zap className="w-3.5 h-3.5 text-amber-600" />
            </div>
            <span>Automation Rules</span>
          </div>
          {(advanceField || rejectField || visibilityReviewerTypes.length > 0) && (
            <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">
              {(advanceField ? 1 : 0) + (rejectField ? 1 : 0) + (visibilityReviewerTypes.length > 0 ? 1 : 0)} active
            </Badge>
          )}
        </button>
        
        {showLogicBuilder && (
          <div className="mt-4 space-y-4">
            {/* Field Picker Modal */}
            {showFieldPicker && (
              <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50" onClick={() => setShowFieldPicker(null)}>
                <div className="bg-white rounded-2xl shadow-2xl w-[500px] max-h-[75vh] flex flex-col animate-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
                  <div className="p-5 border-b border-gray-100">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="font-semibold text-gray-900 text-lg">Select a Field</h3>
                      <button
                        type="button"
                        onClick={() => setShowFieldPicker(null)}
                        className="p-1 hover:bg-gray-100 rounded-lg transition-colors"
                      >
                        <X className="w-5 h-5 text-gray-400" />
                      </button>
                    </div>
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <input
                        type="text"
                        value={fieldSearchQuery}
                        onChange={e => setFieldSearchQuery(e.target.value)}
                        placeholder="Search fields..."
                        className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        autoFocus
                      />
                    </div>
                  </div>
                  <div className="flex-1 overflow-y-auto p-3">
                    {filteredFieldGroups.length === 0 ? (
                      <div className="p-8 text-center text-gray-500">
                        <Search className="w-10 h-10 mx-auto mb-3 text-gray-200" />
                        <p className="text-sm font-medium">No fields match your search</p>
                        <p className="text-xs text-gray-400 mt-1">Try a different search term</p>
                      </div>
                    ) : (
                      filteredFieldGroups.map(group => (
                        <div key={group.id} className="mb-2">
                          <button
                            type="button"
                            onClick={() => toggleGroup(group.id)}
                            className="w-full flex items-center gap-2 px-3 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 rounded-xl transition-colors"
                          >
                            <ChevronRight className={cn("w-4 h-4 text-gray-400 transition-transform", expandedGroups.includes(group.id) && "rotate-90")} />
                            <span className="flex-1 text-left">{group.name}</span>
                            <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">{group.fields.length}</span>
                          </button>
                          {expandedGroups.includes(group.id) && (
                            <div className="ml-4 pl-4 border-l-2 border-gray-100 space-y-1 mt-1 mb-2">
                              {group.fields.map(field => (
                                <button
                                  key={field.value}
                                  type="button"
                                  onClick={() => selectField(field.value)}
                                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-600 hover:bg-blue-50 hover:text-blue-700 rounded-lg transition-colors"
                                >
                                  <FileText className="w-3.5 h-3.5 text-gray-400" />
                                  <span className="flex-1 text-left">{field.label}</span>
                                  <span className="text-xs text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">{field.type}</span>
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Intro Text */}
            <div className="bg-gradient-to-r from-amber-50 to-yellow-50 p-4 rounded-xl border border-amber-100">
              <p className="text-sm text-amber-800">
                <strong>Automation rules</strong> run automatically when applications enter this stage. Set conditions based on scores, form fields, or status to trigger actions.
              </p>
            </div>

            {/* Auto-Advance Rule */}
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
              <div className="px-4 py-3 bg-gradient-to-r from-green-50 to-emerald-50 border-b border-green-100 flex items-center gap-3">
                <div className="w-8 h-8 bg-green-500 rounded-lg flex items-center justify-center shadow-sm">
                  <ChevronRight className="w-5 h-5 text-white" />
                </div>
                <div>
                  <Label className="text-sm font-semibold text-green-900">Auto-Advance Rule</Label>
                  <p className="text-xs text-green-700">Move applications forward when conditions are met</p>
                </div>
              </div>
              
              <div className="p-4 space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 text-center">
                    <span className="inline-block px-2 py-1 bg-gray-100 rounded-lg text-xs font-bold text-gray-600">IF</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowFieldPicker('advance')}
                    className="flex-1 px-4 py-2.5 border border-gray-200 rounded-xl hover:border-green-400 hover:bg-green-50 transition-colors text-left flex items-center gap-3 group"
                  >
                    <FileText className="w-4 h-4 text-gray-400 group-hover:text-green-600" />
                    <span className="font-medium text-gray-700 truncate">{getFieldLabel(advanceField)}</span>
                    <ChevronDown className="w-4 h-4 text-gray-400 ml-auto" />
                  </button>
                </div>
                
                <div className="flex items-center gap-3">
                  <div className="w-12" />
                  <Select value={advanceOperator} onValueChange={setAdvanceOperator}>
                    <SelectTrigger className="w-40">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {getOperatorsForField(advanceField).map(opt => (
                        <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Input 
                    value={advanceValue} 
                    onChange={(e) => setAdvanceValue(e.target.value)}
                    className="w-28"
                    placeholder="Value"
                  />
                </div>

                <div className="flex items-center gap-3">
                  <div className="w-12 text-center">
                    <span className="inline-block px-2 py-1 bg-green-100 rounded-lg text-xs font-bold text-green-700">THEN</span>
                  </div>
                  <Select value={advanceAction} onValueChange={setAdvanceAction}>
                    <SelectTrigger className="flex-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="move_to_next">
                        <div className="flex items-center gap-2">
                          <ChevronRight className="w-4 h-4 text-green-600" />
                          <span>Move to next stage</span>
                        </div>
                      </SelectItem>
                      <SelectItem value="set_approved">
                        <div className="flex items-center gap-2">
                          <Check className="w-4 h-4 text-green-600" />
                          <span>Set status to Approved</span>
                        </div>
                      </SelectItem>
                      <SelectItem value="complete">
                        <div className="flex items-center gap-2">
                          <CheckCircle className="w-4 h-4 text-green-600" />
                          <span>Complete workflow</span>
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {/* Auto-Reject Rule */}
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
              <div className="px-4 py-3 bg-gradient-to-r from-red-50 to-rose-50 border-b border-red-100 flex items-center gap-3">
                <div className="w-8 h-8 bg-red-500 rounded-lg flex items-center justify-center shadow-sm">
                  <X className="w-5 h-5 text-white" />
                </div>
                <div>
                  <Label className="text-sm font-semibold text-red-900">Auto-Reject Rule</Label>
                  <p className="text-xs text-red-700">Reject or flag applications that don't meet requirements</p>
                </div>
              </div>
              
              <div className="p-4 space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 text-center">
                    <span className="inline-block px-2 py-1 bg-gray-100 rounded-lg text-xs font-bold text-gray-600">IF</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowFieldPicker('reject')}
                    className="flex-1 px-4 py-2.5 border border-gray-200 rounded-xl hover:border-red-400 hover:bg-red-50 transition-colors text-left flex items-center gap-3 group"
                  >
                    <FileText className="w-4 h-4 text-gray-400 group-hover:text-red-600" />
                    <span className="font-medium text-gray-700 truncate">{getFieldLabel(rejectField)}</span>
                    <ChevronDown className="w-4 h-4 text-gray-400 ml-auto" />
                  </button>
                </div>
                
                <div className="flex items-center gap-3">
                  <div className="w-12" />
                  <Select value={rejectOperator} onValueChange={setRejectOperator}>
                    <SelectTrigger className="w-40">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {getOperatorsForField(rejectField).map(opt => (
                        <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Input 
                    value={rejectValue} 
                    onChange={(e) => setRejectValue(e.target.value)}
                    className="w-28"
                    placeholder="Value"
                  />
                </div>

                <div className="flex items-center gap-3">
                  <div className="w-12 text-center">
                    <span className="inline-block px-2 py-1 bg-red-100 rounded-lg text-xs font-bold text-red-700">THEN</span>
                  </div>
                  <Select value={rejectAction} onValueChange={setRejectAction}>
                    <SelectTrigger className="flex-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="set_ineligible">
                        <div className="flex items-center gap-2">
                          <X className="w-4 h-4 text-red-600" />
                          <span>Set Ineligible & stop workflow</span>
                        </div>
                      </SelectItem>
                      <SelectItem value="set_declined">
                        <div className="flex items-center gap-2">
                          <X className="w-4 h-4 text-red-600" />
                          <span>Set status to Declined</span>
                        </div>
                      </SelectItem>
                      <SelectItem value="flag_review">
                        <div className="flex items-center gap-2">
                          <ClipboardList className="w-4 h-4 text-amber-600" />
                          <span>Flag for manual review</span>
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {/* Visibility Rule */}
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
              <div className="px-4 py-3 bg-gradient-to-r from-purple-50 to-violet-50 border-b border-purple-100 flex items-center gap-3">
                <div className="w-8 h-8 bg-purple-500 rounded-lg flex items-center justify-center shadow-sm">
                  <Users className="w-5 h-5 text-white" />
                </div>
                <div>
                  <Label className="text-sm font-semibold text-purple-900">Stage Visibility</Label>
                  <p className="text-xs text-purple-700">Restrict which reviewer types can see this stage</p>
                </div>
              </div>
              
              <div className="p-4">
                {reviewerTypes.length === 0 ? (
                  <div className="text-center py-4 text-gray-500">
                    <Users className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                    <p className="text-sm">No reviewer types defined yet</p>
                    <p className="text-xs text-gray-400">All reviewers will see this stage</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {reviewerTypes.map(rt => (
                      <label key={rt.id} className="flex items-center gap-3 p-2 hover:bg-purple-50 rounded-lg cursor-pointer transition-colors">
                        <input
                          type="checkbox"
                          checked={visibilityReviewerTypes.includes(rt.name)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setVisibilityReviewerTypes([...visibilityReviewerTypes, rt.name])
                            } else {
                              setVisibilityReviewerTypes(visibilityReviewerTypes.filter(n => n !== rt.name))
                            }
                          }}
                          className="w-4 h-4 rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                        />
                        <span className="text-sm font-medium text-gray-700">{rt.name}</span>
                      </label>
                    ))}
                    {visibilityReviewerTypes.length === 0 && (
                      <p className="text-xs text-amber-600 mt-2">⚠️ No types selected = all reviewers can see this stage</p>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Preview */}
            {(advanceField || rejectField || visibilityReviewerTypes.length > 0) && (
              <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                <Label className="text-xs text-gray-500 mb-3 block font-medium">Rule Preview</Label>
                <div className="space-y-2">
                  {advanceField && advanceValue && (
                    <div className="flex items-start gap-2 p-2 bg-green-50 rounded-lg border border-green-100">
                      <CheckCircle className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
                      <div className="text-sm text-green-800">
                        <span className="font-medium">Auto-Advance:</span>{' '}
                        When <span className="bg-green-100 px-1 rounded">{getFieldLabel(advanceField)}</span> {advanceOperator} {advanceValue}
                        {' → '}
                        <span className="font-medium">
                          {advanceAction === 'move_to_next' ? 'move to next stage' : advanceAction === 'set_approved' ? 'set Approved' : 'complete workflow'}
                        </span>
                      </div>
                    </div>
                  )}
                  {rejectField && rejectValue && (
                    <div className="flex items-start gap-2 p-2 bg-red-50 rounded-lg border border-red-100">
                      <X className="w-4 h-4 text-red-600 mt-0.5 flex-shrink-0" />
                      <div className="text-sm text-red-800">
                        <span className="font-medium">Auto-Reject:</span>{' '}
                        When <span className="bg-red-100 px-1 rounded">{getFieldLabel(rejectField)}</span> {rejectOperator} {rejectValue}
                        {' → '}
                        <span className="font-medium">
                          {rejectAction === 'set_ineligible' ? 'set Ineligible & stop' : rejectAction === 'set_declined' ? 'set Declined' : 'flag for review'}
                        </span>
                      </div>
                    </div>
                  )}
                  {visibilityReviewerTypes.length > 0 && (
                    <div className="flex items-start gap-2 p-2 bg-purple-50 rounded-lg border border-purple-100">
                      <Users className="w-4 h-4 text-purple-600 mt-0.5 flex-shrink-0" />
                      <div className="text-sm text-purple-800">
                        <span className="font-medium">Visibility:</span>{' '}
                        Only visible to {visibilityReviewerTypes.join(', ')}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="flex gap-3 pt-4">
        <Button type="button" variant="outline" onClick={onCancel} className="flex-1">
          Cancel
        </Button>
        <Button type="submit" disabled={!name.trim() || isSaving} className="flex-1">
          {isSaving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
          {initial ? 'Save Changes' : 'Create Stage'}
        </Button>
      </div>
    </form>
  )
}

// General Stage Settings Tab Component
function GeneralStageSettings({
  stage,
  workspaceId,
  workflowId,
  stageCount,
  onSave,
  onCancel,
  registerSaveFunction,
  unregisterSaveFunction
}: {
  stage: ApplicationStage
  workspaceId: string
  workflowId: string
  stageCount: number
  onSave: () => void
  onCancel: () => void
  registerSaveFunction: (fn: () => Promise<void>) => void
  unregisterSaveFunction: () => void
}) {
  const [name, setName] = useState(stage.name || '')
  const [description, setDescription] = useState(stage.description || '')
  const [stageType, setStageType] = useState(stage.stage_type || 'review')
  const [stageColor, setStageColor] = useState<StageColorKey>(((stage as any).color as StageColorKey) || getDefaultStageColor(stage.order_index || 0))
  const [startDate, setStartDate] = useState(stage.start_date?.split('T')[0] || '')
  const [endDate, setEndDate] = useState(stage.end_date?.split('T')[0] || '')
  const [relativeDeadline, setRelativeDeadline] = useState(stage.relative_deadline || '')
  
  // StatusOption type for custom statuses with color and icon
  type StatusOption = { name: string; color: string; icon: string }
  
  // Normalize custom_statuses to StatusOption array
  const normalizeStatusesLocal = (statuses: any): StatusOption[] => {
    if (!statuses || statuses.length === 0) {
      return [
        { name: 'Pending', color: 'yellow', icon: 'clock' },
        { name: 'Approved', color: 'green', icon: 'check' },
        { name: 'Rejected', color: 'red', icon: 'x' }
      ]
    }
    return statuses.map((s: any) => 
      typeof s === 'string' 
        ? { name: s, color: 'gray', icon: 'circle' } 
        : { name: s.name, color: s.color || 'gray', icon: s.icon || 'circle' }
    )
  }
  const [customStatuses, setCustomStatuses] = useState<StatusOption[]>(normalizeStatusesLocal(stage.custom_statuses))
  const [editingStatusIndex, setEditingStatusIndex] = useState<number | null>(null)
  
  // TagOption type for custom tags with color
  type TagOption = { name: string; color: string }
  
  // Normalize custom_tags to TagOption array
  const normalizeTagsLocal = (tags: any): TagOption[] => {
    if (!tags || tags.length === 0) return []
    return tags.map((t: any) => 
      typeof t === 'string' 
        ? { name: t, color: 'blue' } 
        : { name: t.name, color: t.color || 'blue' }
    )
  }
  const [customTags, setCustomTags] = useState<TagOption[]>(normalizeTagsLocal(stage.custom_tags))
  const [editingTagIndex, setEditingTagIndex] = useState<number | null>(null)
  const [newStatus, setNewStatus] = useState('')
  const [newTag, setNewTag] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [hasChanges, setHasChanges] = useState(false)

  // Track changes
  useEffect(() => {
    setHasChanges(true)
  }, [name, description, stageType, stageColor, startDate, endDate, relativeDeadline, customStatuses, customTags])

  // Save function that will be called on close
  const saveStageSettings = useCallback(async () => {
    // Don't save if name is empty or no changes
    if (!name.trim()) return
    
    setIsSaving(true)
    try {
      const stageData = {
        name: name.trim(),
        description: description.trim() || undefined,
        stage_type: stageType,
        color: stageColor,
        start_date: startDate ? new Date(startDate).toISOString() : undefined,
        end_date: endDate ? new Date(endDate).toISOString() : undefined,
        relative_deadline: relativeDeadline && relativeDeadline !== 'none' ? relativeDeadline : undefined,
        custom_statuses: customStatuses.length > 0 ? customStatuses : undefined,
        custom_tags: customTags.length > 0 ? customTags : undefined,
      }
      
      await workflowsClient.updateStage(stage.id, stageData)
      setHasChanges(false)
    } catch (error: any) {
      console.error('Failed to save stage:', error)
      showToast(error.message || 'Failed to save stage', 'error')
      throw error
    } finally {
      setIsSaving(false)
    }
  }, [name, description, stageType, stageColor, startDate, endDate, relativeDeadline, customStatuses, customTags, stage.id])

  // Register save function on mount
  useEffect(() => {
    registerSaveFunction(saveStageSettings)
    return () => {
      unregisterSaveFunction()
    }
  }, [saveStageSettings, registerSaveFunction, unregisterSaveFunction])

  const addStatus = () => {
    if (newStatus.trim() && !customStatuses.some(s => s.name === newStatus.trim())) {
      setCustomStatuses([...customStatuses, { name: newStatus.trim(), color: 'gray', icon: 'circle' }])
      setNewStatus('')
    }
  }

  const removeStatus = (statusName: string) => {
    setCustomStatuses(customStatuses.filter(s => s.name !== statusName))
    if (editingStatusIndex !== null) setEditingStatusIndex(null)
  }

  const updateStatusColor = (index: number, color: string) => {
    const updated = [...customStatuses]
    updated[index] = { ...updated[index], color }
    setCustomStatuses(updated)
  }

  const updateStatusIcon = (index: number, icon: string) => {
    const updated = [...customStatuses]
    updated[index] = { ...updated[index], icon }
    setCustomStatuses(updated)
  }

  const addTag = () => {
    if (newTag.trim() && !customTags.some(t => t.name === newTag.trim())) {
      setCustomTags([...customTags, { name: newTag.trim(), color: 'blue' }])
      setNewTag('')
    }
  }

  const removeTag = (tagName: string) => {
    setCustomTags(customTags.filter(t => t.name !== tagName))
    if (editingTagIndex !== null) setEditingTagIndex(null)
  }

  const updateTagColor = (index: number, color: string) => {
    const updated = [...customTags]
    updated[index] = { ...updated[index], color }
    setCustomTags(updated)
  }

  return (
    <div className="space-y-6">
      {/* Basic Info Card */}
      <div className="p-4 bg-gradient-to-r from-gray-50 to-slate-50 rounded-xl border border-gray-200">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 bg-gradient-to-br from-gray-600 to-gray-800 rounded-xl flex items-center justify-center">
            <FileText className="w-5 h-5 text-white" />
          </div>
          <div>
            <h4 className="font-semibold text-gray-900">Basic Information</h4>
            <p className="text-xs text-gray-500">Name, type, and description</p>
          </div>
        </div>
        
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="stage-name" className="text-sm font-medium">Stage Name *</Label>
            <Input
              id="stage-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Initial Review, Committee Review"
              className="border-2 focus:border-blue-400"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="stage-type" className="text-sm font-medium">Stage Type</Label>
            <Select value={stageType} onValueChange={setStageType}>
              <SelectTrigger className="border-2">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="review">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 bg-blue-100 rounded-lg flex items-center justify-center">
                      <Users className="w-3.5 h-3.5 text-blue-600" />
                    </div>
                    <span>Review Stage</span>
                  </div>
                </SelectItem>
                <SelectItem value="processing">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 bg-green-100 rounded-lg flex items-center justify-center">
                      <Zap className="w-3.5 h-3.5 text-green-600" />
                    </div>
                    <span>Processing Stage</span>
                  </div>
                </SelectItem>
                <SelectItem value="decision">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 bg-purple-100 rounded-lg flex items-center justify-center">
                      <CheckCircle className="w-3.5 h-3.5 text-purple-600" />
                    </div>
                    <span>Decision Stage</span>
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="stage-desc" className="text-sm font-medium">Description</Label>
            <Textarea
              id="stage-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What happens in this stage?"
              rows={2}
              className="border-2 focus:border-blue-400"
            />
          </div>
        </div>
      </div>

      {/* Stage Color Picker */}
      <div className="p-4 bg-gradient-to-r from-violet-50 to-purple-50 rounded-xl border border-purple-200">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 bg-gradient-to-br from-violet-500 to-purple-600 rounded-xl flex items-center justify-center">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <div>
            <h4 className="font-semibold text-gray-900">Stage Color</h4>
            <p className="text-xs text-gray-500">Visual identifier in the workflow</p>
          </div>
        </div>
        
        <div className="flex flex-wrap gap-2">
          {(Object.entries(STAGE_COLORS) as [StageColorKey, typeof STAGE_COLORS[StageColorKey]][]).map(([key, color]) => (
            <button
              key={key}
              type="button"
              onClick={() => setStageColor(key)}
              className={cn(
                "w-10 h-10 rounded-xl transition-all flex items-center justify-center",
                color.bg,
                stageColor === key 
                  ? "ring-2 ring-offset-2 ring-gray-900 scale-110" 
                  : "hover:scale-105 opacity-70 hover:opacity-100"
              )}
              title={color.label}
            >
              {stageColor === key && <Check className="w-5 h-5 text-white" />}
            </button>
          ))}
        </div>
      </div>

      {/* Timeline Section */}
      <div className="p-4 bg-gradient-to-r from-amber-50 to-orange-50 rounded-xl border border-amber-200">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 bg-gradient-to-br from-amber-500 to-orange-600 rounded-xl flex items-center justify-center">
            <Clock className="w-5 h-5 text-white" />
          </div>
          <div>
            <h4 className="font-semibold text-gray-900">Timeline</h4>
            <p className="text-xs text-gray-500">Set deadlines for this stage</p>
          </div>
        </div>
        
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="start-date" className="text-xs font-medium text-gray-600">Start Date</Label>
              <Input
                id="start-date"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="border-2 focus:border-amber-400"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="end-date" className="text-xs font-medium text-gray-600">End Date</Label>
              <Input
                id="end-date"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="border-2 focus:border-amber-400"
              />
            </div>
          </div>
          <div className="space-y-1">
            <Label htmlFor="relative-deadline" className="text-xs font-medium text-gray-600">Or Relative Deadline</Label>
            <Select value={relativeDeadline} onValueChange={setRelativeDeadline}>
              <SelectTrigger className="border-2">
                <SelectValue placeholder="No relative deadline" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No relative deadline</SelectItem>
                <SelectItem value="3d">3 days after assignment</SelectItem>
                <SelectItem value="1w">1 week after assignment</SelectItem>
                <SelectItem value="2w">2 weeks after assignment</SelectItem>
                <SelectItem value="1m">1 month after assignment</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Custom Statuses */}
      <div className="p-4 bg-gradient-to-r from-emerald-50 to-green-50 rounded-xl border border-emerald-200">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 bg-gradient-to-br from-emerald-500 to-green-600 rounded-xl flex items-center justify-center">
            <CheckCircle className="w-5 h-5 text-white" />
          </div>
          <div>
            <h4 className="font-semibold text-gray-900">Action Button Statuses</h4>
            <p className="text-xs text-gray-500">Define status options for the Actions button</p>
          </div>
        </div>
        
        {/* Status list */}
        <div className="space-y-2 mb-3">
          {customStatuses.map((status, index) => {
            const colorOptions = [
              { value: 'gray', label: 'Gray', bg: 'bg-gray-200', text: 'text-gray-700' },
              { value: 'red', label: 'Red', bg: 'bg-red-200', text: 'text-red-700' },
              { value: 'orange', label: 'Orange', bg: 'bg-orange-200', text: 'text-orange-700' },
              { value: 'yellow', label: 'Yellow', bg: 'bg-yellow-200', text: 'text-yellow-700' },
              { value: 'green', label: 'Green', bg: 'bg-green-200', text: 'text-green-700' },
              { value: 'blue', label: 'Blue', bg: 'bg-blue-200', text: 'text-blue-700' },
              { value: 'purple', label: 'Purple', bg: 'bg-purple-200', text: 'text-purple-700' },
              { value: 'pink', label: 'Pink', bg: 'bg-pink-200', text: 'text-pink-700' },
            ]
            const iconOptions = [
              { value: 'circle', label: 'Circle', icon: Circle },
              { value: 'check', label: 'Check', icon: Check },
              { value: 'x', label: 'X', icon: X },
              { value: 'clock', label: 'Clock', icon: Clock },
              { value: 'arrow-right', label: 'Arrow', icon: ArrowRight },
            ]
            const currentColor = colorOptions.find(c => c.value === status.color) || colorOptions[0]
            const CurrentIcon = iconOptions.find(i => i.value === status.icon)?.icon || Circle
            const isEditing = editingStatusIndex === index
            
            return (
              <div key={status.name} className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                {/* Status header - clickable to expand */}
                <div 
                  className={cn(
                    "flex items-center justify-between p-3 cursor-pointer hover:bg-gray-50 transition-colors",
                    isEditing && "bg-gray-50"
                  )}
                  onClick={() => setEditingStatusIndex(isEditing ? null : index)}
                >
                  <div className="flex items-center gap-2">
                    <div className={cn(
                      "w-7 h-7 rounded-lg flex items-center justify-center",
                      currentColor.bg, currentColor.text
                    )}>
                      <CurrentIcon className="w-4 h-4" />
                    </div>
                    <span className="font-medium text-sm">{status.name}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button 
                      type="button" 
                      onClick={(e) => {
                        e.stopPropagation()
                        removeStatus(status.name)
                      }} 
                      className="text-gray-400 hover:text-red-500 transition-colors p-1"
                    >
                      <X className="w-4 h-4" />
                    </button>
                    <ChevronDown className={cn(
                      "w-4 h-4 text-gray-400 transition-transform",
                      isEditing && "rotate-180"
                    )} />
                  </div>
                </div>
                
                {/* Expanded edit panel */}
                {isEditing && (
                  <div className="px-3 pb-3 pt-1 border-t border-gray-100 space-y-3">
                    {/* Color picker */}
                    <div>
                      <label className="text-xs font-medium text-gray-600 block mb-2">Button Color</label>
                      <div className="flex flex-wrap gap-1.5">
                        {colorOptions.map(color => (
                          <button
                            key={color.value}
                            type="button"
                            onClick={() => updateStatusColor(index, color.value)}
                            className={cn(
                              "w-7 h-7 rounded-lg transition-all flex items-center justify-center",
                              color.bg,
                              status.color === color.value 
                                ? "ring-2 ring-offset-1 ring-gray-800 scale-110" 
                                : "hover:scale-105 opacity-70 hover:opacity-100"
                            )}
                            title={color.label}
                          >
                            {status.color === color.value && <Check className="w-3.5 h-3.5 text-gray-800" />}
                          </button>
                        ))}
                      </div>
                    </div>
                    
                    {/* Icon picker */}
                    <div>
                      <label className="text-xs font-medium text-gray-600 block mb-2">Button Icon</label>
                      <div className="flex flex-wrap gap-1.5">
                        {iconOptions.map(iconOpt => {
                          const IconComp = iconOpt.icon
                          return (
                            <button
                              key={iconOpt.value}
                              type="button"
                              onClick={() => updateStatusIcon(index, iconOpt.value)}
                              className={cn(
                                "w-8 h-8 rounded-lg border-2 transition-all flex items-center justify-center",
                                status.icon === iconOpt.value 
                                  ? "border-gray-800 bg-gray-100" 
                                  : "border-gray-200 hover:border-gray-400"
                              )}
                              title={iconOpt.label}
                            >
                              <IconComp className="w-4 h-4" />
                            </button>
                          )
                        })}
                      </div>
                    </div>
                    
                    {/* Preview */}
                    <div className="pt-2 border-t border-gray-100">
                      <label className="text-xs font-medium text-gray-600 block mb-2">Button Preview</label>
                      <div className={cn(
                        "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-sm font-medium",
                        currentColor.bg, currentColor.text,
                        `border-${status.color}-300`
                      )}>
                        <CurrentIcon className="w-4 h-4" />
                        {status.name}
                        <ChevronDown className="w-4 h-4" />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
          {customStatuses.length === 0 && (
            <div className="text-center py-4 text-sm text-gray-400 italic">
              No statuses defined. Add one below.
            </div>
          )}
        </div>
        
        {/* Add new status */}
        <div className="flex gap-2">
          <Input
            value={newStatus}
            onChange={(e) => setNewStatus(e.target.value)}
            placeholder="Add status (e.g., Pending, Approved, Rejected)..."
            className="border-2 focus:border-emerald-400"
            onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addStatus())}
          />
          <Button type="button" variant="outline" size="icon" onClick={addStatus} className="border-2 hover:border-emerald-400 hover:bg-emerald-50">
            <Plus className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Custom Tags */}
      <div className="p-4 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl border border-blue-200">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center">
            <Tag className="w-5 h-5 text-white" />
          </div>
          <div>
            <h4 className="font-semibold text-gray-900">Custom Tags</h4>
            <p className="text-xs text-gray-500">Tags for categorizing applications</p>
          </div>
        </div>
        
        {/* Tag list */}
        <div className="space-y-2 mb-3">
          {customTags.map((tag, index) => {
            const colorOptions = [
              { value: 'gray', label: 'Gray', bg: 'bg-gray-200', text: 'text-gray-700' },
              { value: 'red', label: 'Red', bg: 'bg-red-200', text: 'text-red-700' },
              { value: 'orange', label: 'Orange', bg: 'bg-orange-200', text: 'text-orange-700' },
              { value: 'yellow', label: 'Yellow', bg: 'bg-yellow-200', text: 'text-yellow-700' },
              { value: 'green', label: 'Green', bg: 'bg-green-200', text: 'text-green-700' },
              { value: 'blue', label: 'Blue', bg: 'bg-blue-200', text: 'text-blue-700' },
              { value: 'purple', label: 'Purple', bg: 'bg-purple-200', text: 'text-purple-700' },
              { value: 'pink', label: 'Pink', bg: 'bg-pink-200', text: 'text-pink-700' },
            ]
            const currentColor = colorOptions.find(c => c.value === tag.color) || colorOptions[5] // default blue
            const isEditing = editingTagIndex === index
            
            return (
              <div key={tag.name} className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                {/* Tag header - clickable to expand */}
                <div 
                  className={cn(
                    "flex items-center justify-between p-3 cursor-pointer hover:bg-gray-50 transition-colors",
                    isEditing && "bg-gray-50"
                  )}
                  onClick={() => setEditingTagIndex(isEditing ? null : index)}
                >
                  <div className="flex items-center gap-2">
                    <span className={cn(
                      "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-sm font-medium",
                      currentColor.bg, currentColor.text
                    )}>
                      <Tag className="w-3 h-3" />
                      {tag.name}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button 
                      type="button" 
                      onClick={(e) => {
                        e.stopPropagation()
                        removeTag(tag.name)
                      }} 
                      className="text-gray-400 hover:text-red-500 transition-colors p-1"
                    >
                      <X className="w-4 h-4" />
                    </button>
                    <ChevronDown className={cn(
                      "w-4 h-4 text-gray-400 transition-transform",
                      isEditing && "rotate-180"
                    )} />
                  </div>
                </div>
                
                {/* Expanded edit panel */}
                {isEditing && (
                  <div className="px-3 pb-3 pt-1 border-t border-gray-100">
                    {/* Color picker */}
                    <div>
                      <label className="text-xs font-medium text-gray-600 block mb-2">Tag Color</label>
                      <div className="flex flex-wrap gap-1.5">
                        {colorOptions.map(color => (
                          <button
                            key={color.value}
                            type="button"
                            onClick={() => updateTagColor(index, color.value)}
                            className={cn(
                              "w-7 h-7 rounded-lg transition-all flex items-center justify-center",
                              color.bg,
                              tag.color === color.value 
                                ? "ring-2 ring-offset-1 ring-gray-800 scale-110" 
                                : "hover:scale-105 opacity-70 hover:opacity-100"
                            )}
                            title={color.label}
                          >
                            {tag.color === color.value && <Check className="w-3.5 h-3.5 text-gray-800" />}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
          {customTags.length === 0 && (
            <div className="text-center py-4 text-sm text-gray-400 italic">
              No tags defined. Add one below.
            </div>
          )}
        </div>
        
        {/* Add new tag */}
        <div className="flex gap-2">
          <Input
            value={newTag}
            onChange={(e) => setNewTag(e.target.value)}
            placeholder="Add tag (e.g., First gen, High need)..."
            className="border-2 focus:border-blue-400"
            onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addTag())}
          />
          <Button type="button" variant="outline" size="icon" onClick={addTag} className="border-2 hover:border-blue-400 hover:bg-blue-50">
            <Plus className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Changes indicator */}
      {hasChanges && (
        <div className="flex items-center justify-center gap-2 text-sm text-amber-600">
          <span className="w-2 h-2 rounded-full bg-amber-400" />
          Unsaved changes - will save on close
        </div>
      )}
    </div>
  )
}

// Stage assignment type for reviewers
interface StageAssignmentInfo {
  stage_id: string
  stage_name: string
  reviewer_type_id: string
  role_name: string
}

interface ReviewerInfo {
  id: string
  name: string
  email?: string
  stage_assignments?: StageAssignmentInfo[]
  reviewer_type_id?: string
  role?: string
}

// Reviewer Stage Settings Tab Component
function ReviewerStageSettings({
  stage,
  reviewerTypes,
  rubrics,
  formSections,
  formId,
  onSave,
  registerSaveFunction,
  unregisterSaveFunction
}: {
  stage: ApplicationStage
  reviewerTypes: ReviewerType[]
  rubrics: Rubric[]
  formSections: FormSection[]
  formId?: string
  onSave: () => void
  registerSaveFunction: (fn: () => Promise<void>) => void
  unregisterSaveFunction: () => void
}) {
  const [configs, setConfigs] = useState<Partial<StageReviewerConfig>[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [expandedConfig, setExpandedConfig] = useState<number | null>(null)
  const [formReviewers, setFormReviewers] = useState<ReviewerInfo[]>([])
  const [hasChanges, setHasChanges] = useState(false)
  const isInitialLoad = useRef(true)

  useEffect(() => {
    loadConfigs()
  }, [stage.id])

  // Fetch form reviewers to show who is assigned to each role
  useEffect(() => {
    const fetchFormReviewers = async () => {
      if (!formId) return
      try {
        const form = await goClient.get<{ settings?: { reviewers?: ReviewerInfo[] } }>(`/forms/${formId}`)
        if (form.settings?.reviewers) {
          setFormReviewers(form.settings.reviewers)
        }
      } catch (error) {
        console.error('Failed to fetch form reviewers:', error)
      }
    }
    fetchFormReviewers()
  }, [formId])

  // Helper to get reviewers assigned to a specific role on this stage
  const getReviewersForRole = (reviewerTypeId: string): ReviewerInfo[] => {
    return formReviewers.filter(r => {
      // Check stage_assignments first
      if (r.stage_assignments && r.stage_assignments.length > 0) {
        return r.stage_assignments.some(
          a => a.stage_id === stage.id && a.reviewer_type_id === reviewerTypeId
        )
      }
      // Fallback to legacy reviewer_type_id (applies to all stages)
      return r.reviewer_type_id === reviewerTypeId
    })
  }

  // Track changes to configs
  useEffect(() => {
    if (!isInitialLoad.current) {
      setHasChanges(true)
    }
  }, [configs])

  // Save function that will be called on close
  const saveReviewerSettings = useCallback(async () => {
    if (configs.length === 0) return
    
    setIsSaving(true)
    try {
      for (const config of configs) {
        if (config.id) {
          await workflowsClient.updateStageConfig(config.id, config as StageReviewerConfig)
        } else if (config.reviewer_type_id) {
          const created = await workflowsClient.createStageConfig(config as StageReviewerConfig)
          // Update local config with new ID
          const idx = configs.findIndex(c => c === config)
          if (idx >= 0) {
            configs[idx] = { ...configs[idx], id: created.id }
          }
        }
      }
      setHasChanges(false)
    } catch (error) {
      console.error('Failed to save configs:', error)
      showToast('Failed to save reviewer settings', 'error')
      throw error
    } finally {
      setIsSaving(false)
    }
  }, [configs])

  // Register save function on mount
  useEffect(() => {
    registerSaveFunction(saveReviewerSettings)
    return () => {
      unregisterSaveFunction()
    }
  }, [saveReviewerSettings, registerSaveFunction, unregisterSaveFunction])

  const loadConfigs = async () => {
    try {
      const data = await workflowsClient.listStageConfigs(stage.id)
      setConfigs(data)
    } catch (error) {
      console.error('Failed to load configs:', error)
    } finally {
      setIsLoading(false)
      isInitialLoad.current = false
    }
  }

  const addConfig = () => {
    const newConfig = {
      stage_id: stage.id,
      reviewer_type_id: reviewerTypes[0]?.id || '',
      rubric_id: undefined,
      assigned_rubric_id: undefined,
      visibility_config: {},
      field_visibility_config: {} as Record<string, boolean>,
      can_view_prior_scores: false,
      can_view_prior_comments: false,
      min_reviews_required: 1
    }
    setConfigs([...configs, newConfig])
    setExpandedConfig(configs.length)
  }

  const updateConfig = (index: number, field: string, value: any) => {
    const updated = [...configs]
    updated[index] = { ...updated[index], [field]: value }
    setConfigs(updated)
  }

  const removeConfig = async (index: number, configId?: string) => {
    if (configId) {
      try {
        await workflowsClient.deleteStageConfig(configId)
      } catch (error) {
        console.error('Failed to delete config:', error)
      }
    }
    setConfigs(configs.filter((_, i) => i !== index))
    onSave() // Trigger refresh
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
      </div>
    )
  }

  const fieldSections = formSections.length > 0 
    ? formSections.map(section => ({
        id: section.id,
        name: section.title,
        fields: section.fields.map(f => ({ id: f.id, label: f.label }))
      }))
    : []

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Label className="text-base">Reviewer Assignments</Label>
          <p className="text-sm text-gray-500 mt-1">Configure which reviewer roles participate in this stage</p>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={addConfig} disabled={reviewerTypes.length === 0}>
          <Plus className="w-3 h-3 mr-1" />
          Add Reviewer
        </Button>
      </div>

      <div className="space-y-3">
        {configs.map((config, idx) => {
          const reviewerType = reviewerTypes.find(rt => rt.id === config.reviewer_type_id)
          const isExpanded = expandedConfig === idx
          
          return (
            <div key={config.id || idx} className="bg-gray-50 rounded-lg border border-gray-200 overflow-hidden">
              <div 
                className="flex items-center justify-between p-4 cursor-pointer hover:bg-gray-100 transition-colors"
                onClick={() => setExpandedConfig(isExpanded ? null : idx)}
              >
                <div className="flex items-center gap-3">
                  <ChevronRight className={`w-4 h-4 text-gray-400 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                  <div>
                    <span className="font-medium text-gray-900">{reviewerType?.name || 'Select Reviewer'}</span>
                    {config.rubric_id && (
                      <span className="text-xs text-gray-500 ml-2">
                        • {rubrics.find(r => r.id === config.rubric_id)?.name || 'Custom Rubric'}
                      </span>
                    )}
                  </div>
                </div>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="h-6 w-6 text-gray-400 hover:text-red-500"
                  onClick={(e) => { e.stopPropagation(); removeConfig(idx, config.id) }}
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
              
              {isExpanded && (
                <div className="px-4 pb-4 space-y-4 border-t border-gray-200 pt-4">
                  <div className="space-y-2">
                    <Label className="text-sm">Reviewer Role</Label>
                    <Select 
                      value={config.reviewer_type_id} 
                      onValueChange={(val) => updateConfig(idx, 'reviewer_type_id', val)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select reviewer role" />
                      </SelectTrigger>
                      <SelectContent>
                        {reviewerTypes.map(rt => (
                          <SelectItem key={rt.id} value={rt.id}>{rt.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Show assigned reviewers for this role on this stage */}
                  {config.reviewer_type_id && (
                    <div className="bg-white rounded-lg border p-3">
                      <div className="flex items-center justify-between mb-2">
                        <Label className="text-sm text-gray-600">Assigned Reviewers</Label>
                        <span className="text-xs text-gray-400">{getReviewersForRole(config.reviewer_type_id).length} reviewer(s)</span>
                      </div>
                      {getReviewersForRole(config.reviewer_type_id).length === 0 ? (
                        <p className="text-xs text-gray-400 italic">No reviewers assigned to this role on this stage. Invite reviewers from the Reviewers tab and assign them to this stage.</p>
                      ) : (
                        <div className="flex flex-wrap gap-1.5">
                          {getReviewersForRole(config.reviewer_type_id).map(r => (
                            <div key={r.id} className="flex items-center gap-1.5 px-2 py-1 bg-blue-50 text-blue-700 rounded text-xs font-medium">
                              <div className="w-4 h-4 rounded-full bg-blue-200 flex items-center justify-center text-[10px] font-semibold">
                                {r.name.charAt(0).toUpperCase()}
                              </div>
                              {r.name}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  <div className="space-y-2">
                    <Label className="text-sm">Assigned Rubric</Label>
                    <Select 
                      value={config.rubric_id || config.assigned_rubric_id || 'none'} 
                      onValueChange={(val) => {
                        const rubricId = val === 'none' ? undefined : val
                        updateConfig(idx, 'rubric_id', rubricId)
                        updateConfig(idx, 'assigned_rubric_id', rubricId)
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select rubric" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Use workflow default rubric</SelectItem>
                        {rubrics.map(rb => (
                          <SelectItem key={rb.id} value={rb.id}>{rb.name} ({rb.max_score} pts)</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-sm">Minimum Reviews Required</Label>
                    <Input
                      type="number"
                      min={1}
                      max={10}
                      value={config.min_reviews_required || 1}
                      onChange={(e) => updateConfig(idx, 'min_reviews_required', parseInt(e.target.value) || 1)}
                      className="w-24"
                    />
                  </div>

                  <div className="border-t pt-4 space-y-3">
                    <Label className="text-sm font-medium">Prior Review Access</Label>
                    
                    <div className="flex items-center justify-between p-3 bg-white rounded-lg border">
                      <div>
                        <Label className="text-sm">View Prior Scores</Label>
                        <p className="text-xs text-gray-500">See scores from earlier stages</p>
                      </div>
                      <Switch 
                        checked={config.can_view_prior_scores || false}
                        onCheckedChange={(val) => updateConfig(idx, 'can_view_prior_scores', val)}
                      />
                    </div>
                    
                    <div className="flex items-center justify-between p-3 bg-white rounded-lg border">
                      <div>
                        <Label className="text-sm">View Prior Comments</Label>
                        <p className="text-xs text-gray-500">See feedback from earlier reviewers</p>
                      </div>
                      <Switch 
                        checked={config.can_view_prior_comments || false}
                        onCheckedChange={(val) => updateConfig(idx, 'can_view_prior_comments', val)}
                      />
                    </div>
                  </div>

                  {fieldSections.length > 0 && (
                    <div className="border-t pt-4 space-y-3">
                      <Label className="text-sm font-medium">Field Visibility</Label>
                      <p className="text-xs text-gray-500">Control which fields this reviewer can see</p>
                      
                      <div className="space-y-3">
                        {fieldSections.map((section) => (
                          <div key={section.id} className="bg-white rounded-lg border p-3">
                            <div className="flex items-center justify-between mb-2">
                              <Label className="text-sm font-medium">{section.name}</Label>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="text-xs h-6"
                                onClick={() => {
                                  const newConfig = { ...config.field_visibility_config }
                                  const allVisible = section.fields.every(f => 
                                    newConfig?.[`${section.id}.${f.id}`] !== false
                                  )
                                  section.fields.forEach(f => {
                                    (newConfig as Record<string, boolean>)[`${section.id}.${f.id}`] = !allVisible
                                  })
                                  updateConfig(idx, 'field_visibility_config', newConfig)
                                }}
                              >
                                Toggle All
                              </Button>
                            </div>
                            <div className="flex flex-wrap gap-2">
                              {section.fields.map((field) => {
                                const key = `${section.id}.${field.id}`
                                const isVisible = config.field_visibility_config?.[key] !== false
                                return (
                                  <button
                                    key={field.id}
                                    type="button"
                                    onClick={() => {
                                      const newConfig = { ...config.field_visibility_config }
                                      ;(newConfig as Record<string, boolean>)[key] = !isVisible
                                      updateConfig(idx, 'field_visibility_config', newConfig)
                                    }}
                                    className={cn(
                                      'px-2 py-1 text-xs rounded-md transition-colors',
                                      isVisible 
                                        ? 'bg-green-100 text-green-800 hover:bg-green-200' 
                                        : 'bg-gray-100 text-gray-500 hover:bg-gray-200 line-through'
                                    )}
                                  >
                                    {field.label}
                                  </button>
                                )
                              })}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })}

        {configs.length === 0 && (
          <div className="text-center py-8 text-gray-500 text-sm border-2 border-dashed border-gray-200 rounded-lg">
            <Users className="w-8 h-8 mx-auto mb-2 text-gray-300" />
            <p>No reviewers assigned to this stage</p>
            {reviewerTypes.length === 0 ? (
              <p className="text-xs mt-1">Create reviewer roles first</p>
            ) : (
              <Button variant="link" size="sm" onClick={addConfig}>Add one</Button>
            )}
          </div>
        )}
      </div>

      {/* Changes indicator */}
      {hasChanges && (
        <div className="flex items-center justify-center gap-2 text-sm text-amber-600">
          <span className="w-2 h-2 rounded-full bg-amber-400" />
          Unsaved changes - will save on close
        </div>
      )}
    </div>
  )
}

// Automation Stage Settings Tab Component
// Types for logic rules with multiple conditions
interface LogicCondition {
  id: string
  field: string
  operator: string
  value: string
}

// Automation Rule Types
interface AutomationRule {
  id: string
  name: string
  description?: string
  trigger: {
    type: 'field_change' | 'score_threshold' | 'review_complete' | 'time_elapsed' | 'manual_status' | 'all_reviews_done' | 'tag_applied'
    config: Record<string, any>
  }
  conditions: AutomationCondition[]
  conditionLogic: 'AND' | 'OR'
  actions: StatusActionConfig[]
  isActive: boolean
  priority: number
}

interface AutomationCondition {
  id: string
  field: string
  operator: string
  value: string
}

// Advanced Automation Settings - Full control over workflows
function AdvancedAutomationSettings({
  stage,
  workspaceId,
  workflowId,
  formSections,
  reviewerTypes,
  onSave
}: {
  stage: ApplicationStage
  workspaceId: string
  workflowId: string
  formSections: FormSection[]
  reviewerTypes: ReviewerType[]
  onSave: () => void
}) {
  const [rules, setRules] = useState<AutomationRule[]>([])
  const [stages, setStages] = useState<ApplicationStage[]>([])
  const [stageGroups, setStageGroups] = useState<StageGroup[]>([])
  const [applicationGroups, setApplicationGroups] = useState<ApplicationGroup[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [editingRule, setEditingRule] = useState<AutomationRule | null>(null)
  const [isCreating, setIsCreating] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

  // Rule form state
  const [ruleName, setRuleName] = useState('')
  const [ruleDescription, setRuleDescription] = useState('')
  const [triggerType, setTriggerType] = useState<AutomationRule['trigger']['type']>('score_threshold')
  const [triggerConfig, setTriggerConfig] = useState<Record<string, any>>({})
  const [conditions, setConditions] = useState<AutomationCondition[]>([])
  const [conditionLogic, setConditionLogic] = useState<'AND' | 'OR'>('AND')
  const [actions, setActions] = useState<StatusActionConfig[]>([])
  const [isActive, setIsActive] = useState(true)

  useEffect(() => {
    loadData()
  }, [stage.id])

  const loadData = async () => {
    setIsLoading(true)
    try {
      const [stageData, groupData, appGroupData] = await Promise.all([
        workflowsClient.listStages(workflowId),
        workflowsClient.listStageGroups(stage.id),
        workflowsClient.listGroups(workflowId)
      ])
      setStages(stageData)
      setStageGroups(groupData)
      setApplicationGroups(appGroupData)
      
      // Parse existing rules from stage.logic_rules
      if (stage.logic_rules) {
        const parsedRules: AutomationRule[] = []
        if (stage.logic_rules.auto_advance_condition) {
          try {
            const advanceData = JSON.parse(stage.logic_rules.auto_advance_condition)
            if (Array.isArray(advanceData)) {
              advanceData.forEach((rule: any, idx: number) => {
                parsedRules.push({
                  id: `advance-${idx}`,
                  name: `Auto-Advance Rule ${idx + 1}`,
                  trigger: { type: 'score_threshold', config: {} },
                  conditions: rule.conditions || [],
                  conditionLogic: rule.conditionLogic || 'AND',
                  actions: [{ action_type: 'move_to_stage', target_stage_id: '' }],
                  isActive: true,
                  priority: idx
                })
              })
            }
          } catch {}
        }
        setRules(parsedRules)
      }
    } catch (error) {
      console.error('Failed to load data:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const triggerTypes = [
    { value: 'score_threshold', label: 'Score Threshold', icon: Award, description: 'When average score reaches a value' },
    { value: 'all_reviews_done', label: 'All Reviews Complete', icon: CheckCircle, description: 'When all assigned reviewers finish' },
    { value: 'review_complete', label: 'Any Review Complete', icon: Check, description: 'When any reviewer submits' },
    { value: 'manual_status', label: 'Status Change', icon: Target, description: 'When status is manually set' },
    { value: 'field_change', label: 'Field Value', icon: FileText, description: 'When a field matches a value' },
    { value: 'tag_applied', label: 'Tag Applied', icon: Tag, description: 'When a specific tag is added' },
    { value: 'time_elapsed', label: 'Time Elapsed', icon: Clock, description: 'After X days in this stage' },
  ]

  const actionTypes = [
    { value: 'move_to_stage', label: 'Move to Stage', icon: ChevronRight, color: 'green' },
    { value: 'move_to_group', label: 'Move to Group', icon: Archive, color: 'purple' },
    { value: 'move_to_stage_group', label: 'Move to Stage Group', icon: Folder, color: 'blue' },
    { value: 'add_tags', label: 'Add Tags', icon: Tag, color: 'amber' },
    { value: 'remove_tags', label: 'Remove Tags', icon: X, color: 'gray' },
    { value: 'send_email', label: 'Send Email', icon: FileText, color: 'indigo' },
  ]

  const operatorOptions = [
    { value: '>=', label: 'is at least' },
    { value: '<=', label: 'is at most' },
    { value: '==', label: 'equals' },
    { value: '!=', label: 'does not equal' },
    { value: '>', label: 'is greater than' },
    { value: '<', label: 'is less than' },
    { value: 'contains', label: 'contains' },
    { value: 'not_contains', label: 'does not contain' },
  ]

  const fieldOptions = [
    { value: 'average_score', label: 'Average Score', type: 'number' },
    { value: 'total_score', label: 'Total Score', type: 'number' },
    { value: 'review_count', label: 'Review Count', type: 'number' },
    { value: 'status', label: 'Current Status', type: 'select' },
    { value: 'days_in_stage', label: 'Days in Stage', type: 'number' },
    ...formSections.flatMap(section => 
      section.fields.map(field => ({
        value: `field.${field.id}`,
        label: field.label,
        type: 'text'
      }))
    )
  ]

  const startCreate = () => {
    setEditingRule(null)
    setRuleName('')
    setRuleDescription('')
    setTriggerType('score_threshold')
    setTriggerConfig({})
    setConditions([])
    setConditionLogic('AND')
    setActions([])
    setIsActive(true)
    setIsCreating(true)
  }

  const startEdit = (rule: AutomationRule) => {
    setEditingRule(rule)
    setRuleName(rule.name)
    setRuleDescription(rule.description || '')
    setTriggerType(rule.trigger.type)
    setTriggerConfig(rule.trigger.config)
    setConditions(rule.conditions)
    setConditionLogic(rule.conditionLogic)
    setActions(rule.actions)
    setIsActive(rule.isActive)
    setIsCreating(false)
  }

  const cancelEdit = () => {
    setEditingRule(null)
    setIsCreating(false)
  }

  const addCondition = () => {
    setConditions([...conditions, {
      id: String(Date.now()),
      field: 'average_score',
      operator: '>=',
      value: ''
    }])
  }

  const updateCondition = (id: string, updates: Partial<AutomationCondition>) => {
    setConditions(conditions.map(c => c.id === id ? { ...c, ...updates } : c))
  }

  const removeCondition = (id: string) => {
    setConditions(conditions.filter(c => c.id !== id))
  }

  const addAction = (actionType: string) => {
    setActions([...actions, { action_type: actionType as any }])
  }

  const updateAction = (index: number, updates: Partial<StatusActionConfig>) => {
    const updated = [...actions]
    updated[index] = { ...updated[index], ...updates }
    setActions(updated)
  }

  const removeAction = (index: number) => {
    setActions(actions.filter((_, i) => i !== index))
  }

  const handleSave = async () => {
    if (!ruleName.trim() || actions.length === 0) return
    setIsSaving(true)
    try {
      const newRule: AutomationRule = {
        id: editingRule?.id || String(Date.now()),
        name: ruleName,
        description: ruleDescription,
        trigger: { type: triggerType, config: triggerConfig },
        conditions,
        conditionLogic,
        actions,
        isActive,
        priority: editingRule?.priority || rules.length
      }

      const updatedRules = editingRule
        ? rules.map(r => r.id === editingRule.id ? newRule : r)
        : [...rules, newRule]
      
      // Save to stage.logic_rules
      const logicRules = {
        auto_advance_condition: JSON.stringify(updatedRules.filter(r => r.isActive).map(r => ({
          conditions: r.conditions,
          conditionLogic: r.conditionLogic,
          action: r.actions[0]?.action_type || 'move_to_next',
          trigger: r.trigger
        })))
      }
      
      await workflowsClient.updateStage(stage.id, { logic_rules: logicRules })
      setRules(updatedRules)
      showToast('Automation rule saved', 'success')
      cancelEdit()
      onSave()
    } catch (error: any) {
      console.error('Failed to save rule:', error)
      showToast(error.message || 'Failed to save', 'error')
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = (ruleId: string) => {
    if (!confirm('Delete this automation rule?')) return
    const updatedRules = rules.filter(r => r.id !== ruleId)
    setRules(updatedRules)
  }

  const toggleRule = async (ruleId: string) => {
    const updatedRules = rules.map(r => 
      r.id === ruleId ? { ...r, isActive: !r.isActive } : r
    )
    setRules(updatedRules)
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    )
  }

  return (
    <div className="space-y-5">
      {/* Compact Stats Row */}
      <div className="flex items-center gap-6 text-sm">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-green-500"></div>
          <span className="text-gray-600"><span className="font-semibold text-gray-900">{rules.filter(r => r.isActive).length}</span> Active</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-blue-500"></div>
          <span className="text-gray-600"><span className="font-semibold text-gray-900">{rules.reduce((acc, r) => acc + r.actions.length, 0)}</span> Actions</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-purple-500"></div>
          <span className="text-gray-600"><span className="font-semibold text-gray-900">{stages.length}</span> Stages</span>
        </div>
        <div className="flex-1"></div>
        {rules.length > 0 && !isCreating && !editingRule && (
          <Button size="sm" onClick={startCreate} className="h-8">
            <Plus className="w-3.5 h-3.5 mr-1.5" />
            Add Rule
          </Button>
        )}
      </div>

      {/* Rules List */}
      {rules.length > 0 && !isCreating && !editingRule && (
        <div className="border rounded-xl divide-y overflow-hidden">
          {rules.map((rule, index) => {
            const trigger = triggerTypes.find(t => t.value === rule.trigger.type)
            const TriggerIcon = trigger?.icon || Zap
            return (
              <div
                key={rule.id}
                className={cn(
                  "p-4 transition-colors",
                  rule.isActive ? "bg-white hover:bg-gray-50" : "bg-gray-50 opacity-60"
                )}
              >
                <div className="flex items-center gap-3">
                  <Switch
                    checked={rule.isActive}
                    onCheckedChange={() => toggleRule(rule.id)}
                  />
                  <TriggerIcon className="w-4 h-4 text-gray-400 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-gray-900">{rule.name}</span>
                      <span className="text-xs text-gray-400">•</span>
                      <span className="text-xs text-gray-500">{trigger?.label}</span>
                    </div>
                    <div className="flex items-center gap-1.5 mt-1">
                      {rule.actions.slice(0, 3).map((action, idx) => {
                        const actionDef = actionTypes.find(a => a.value === action.action_type)
                        return (
                          <span key={idx} className="text-xs px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded">
                            {actionDef?.label || action.action_type}
                          </span>
                        )
                      })}
                      {rule.actions.length > 3 && (
                        <span className="text-xs text-gray-400">+{rule.actions.length - 3} more</span>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => startEdit(rule)}
                    className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-md"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(rule.id)}
                    className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-md"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Empty State */}
      {rules.length === 0 && !isCreating && (
        <div className="text-center py-10 border-2 border-dashed border-gray-200 rounded-xl">
          <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center mx-auto mb-3">
            <Zap className="w-6 h-6 text-blue-600" />
          </div>
          <h3 className="font-medium text-gray-900 mb-1">No automation rules</h3>
          <p className="text-sm text-gray-500 mb-4">Automate actions based on triggers and conditions</p>
          <Button onClick={startCreate} size="sm">
            <Plus className="w-4 h-4 mr-1.5" />
            Create Rule
          </Button>
        </div>
      )}

      {/* Create/Edit Form - Clean Stepped Design */}
      {(isCreating || editingRule) && (
        <div className="border rounded-xl overflow-hidden">
          {/* Header */}
          <div className="px-4 py-3 bg-gray-50 border-b flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-blue-600" />
              <h3 className="font-medium text-gray-900">{editingRule ? 'Edit Rule' : 'New Rule'}</h3>
            </div>
            <button onClick={cancelEdit} className="p-1 hover:bg-gray-200 rounded">
              <X className="w-4 h-4 text-gray-500" />
            </button>
          </div>

          <div className="p-4 space-y-5">
            {/* Name & Description */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs text-gray-500 mb-1.5 block">Rule Name</Label>
                <Input
                  value={ruleName}
                  onChange={(e) => setRuleName(e.target.value)}
                  placeholder="e.g., Auto-advance high scorers"
                  className="h-9"
                />
              </div>
              <div>
                <Label className="text-xs text-gray-500 mb-1.5 block">Description (optional)</Label>
                <Input
                  value={ruleDescription}
                  onChange={(e) => setRuleDescription(e.target.value)}
                  placeholder="Brief description"
                  className="h-9"
                />
              </div>
            </div>

            {/* Trigger Selection */}
            <div>
              <Label className="text-xs text-gray-500 mb-2 block">When this happens...</Label>
              <div className="grid grid-cols-4 gap-2">
                {triggerTypes.map(trigger => (
                  <button
                    key={trigger.value}
                    type="button"
                    onClick={() => setTriggerType(trigger.value as any)}
                    className={cn(
                      "p-2.5 rounded-lg border text-left transition-all",
                      triggerType === trigger.value
                        ? "border-blue-500 bg-blue-50 ring-1 ring-blue-500"
                        : "border-gray-200 hover:border-gray-300 bg-white"
                    )}
                  >
                    <trigger.icon className={cn(
                      "w-4 h-4 mb-1",
                      triggerType === trigger.value ? "text-blue-600" : "text-gray-400"
                    )} />
                    <div className="text-xs font-medium text-gray-900 truncate">{trigger.label}</div>
                  </button>
                ))}
              </div>

              {/* Trigger Config - Inline */}
              {triggerType === 'score_threshold' && (
                <div className="mt-3 p-3 bg-gray-50 rounded-lg flex items-center gap-2 text-sm">
                  <span className="text-gray-600">When score</span>
                  <Select value={triggerConfig.operator || '>='} onValueChange={(v) => setTriggerConfig({ ...triggerConfig, operator: v })}>
                    <SelectTrigger className="w-28 h-8">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value=">=">≥ at least</SelectItem>
                      <SelectItem value="<=">≤ at most</SelectItem>
                      <SelectItem value="==">= equals</SelectItem>
                    </SelectContent>
                  </Select>
                  <Input
                    type="number"
                    value={triggerConfig.value || ''}
                    onChange={(e) => setTriggerConfig({ ...triggerConfig, value: e.target.value })}
                    placeholder="80"
                    className="w-16 h-8"
                  />
                </div>
              )}
              {triggerType === 'time_elapsed' && (
                <div className="mt-3 p-3 bg-gray-50 rounded-lg flex items-center gap-2 text-sm">
                  <span className="text-gray-600">After</span>
                  <Input
                    type="number"
                    value={triggerConfig.days || ''}
                    onChange={(e) => setTriggerConfig({ ...triggerConfig, days: e.target.value })}
                    placeholder="7"
                    className="w-16 h-8"
                  />
                  <span className="text-gray-600">days in stage</span>
                </div>
              )}
              {triggerType === 'tag_applied' && (
                <div className="mt-3 p-3 bg-gray-50 rounded-lg flex items-center gap-2 text-sm">
                  <span className="text-gray-600">When tag</span>
                  <Input
                    value={triggerConfig.tag || ''}
                    onChange={(e) => setTriggerConfig({ ...triggerConfig, tag: e.target.value })}
                    placeholder="e.g., priority"
                    className="w-32 h-8"
                  />
                  <span className="text-gray-600">is applied</span>
                </div>
              )}
            </div>

            {/* Conditions */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <Label className="text-xs text-gray-500">Additional conditions (optional)</Label>
                <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={addCondition}>
                  <Plus className="w-3 h-3 mr-1" />
                  Add
                </Button>
              </div>
              {conditions.length > 0 ? (
                <div className="space-y-2">
                  {conditions.map((condition, index) => (
                    <div key={condition.id} className="flex items-center gap-2 text-sm">
                      <span className={cn(
                        "w-10 text-center text-xs font-medium py-1 rounded",
                        index === 0 ? "bg-blue-100 text-blue-700" : "bg-gray-100 text-gray-600"
                      )}>
                        {index === 0 ? 'IF' : conditionLogic}
                      </span>
                      <Select value={condition.field} onValueChange={(v) => updateCondition(condition.id, { field: v })}>
                        <SelectTrigger className="w-36 h-8">
                          <SelectValue placeholder="Field" />
                        </SelectTrigger>
                        <SelectContent>
                          {fieldOptions.map(f => (
                            <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Select value={condition.operator} onValueChange={(v) => updateCondition(condition.id, { operator: v })}>
                        <SelectTrigger className="w-28 h-8">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {operatorOptions.map(o => (
                            <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Input
                        value={condition.value}
                        onChange={(e) => updateCondition(condition.id, { value: e.target.value })}
                        placeholder="Value"
                        className="w-24 h-8"
                      />
                      <button onClick={() => removeCondition(condition.id)} className="p-1 text-gray-400 hover:text-red-500">
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                  {conditions.length > 1 && (
                    <button
                      onClick={() => setConditionLogic(conditionLogic === 'AND' ? 'OR' : 'AND')}
                      className="text-xs text-blue-600 hover:text-blue-700 ml-12"
                    >
                      Switch to {conditionLogic === 'AND' ? 'OR' : 'AND'} logic
                    </button>
                  )}
                </div>
              ) : (
                <p className="text-xs text-gray-400 italic">Trigger alone will activate this rule</p>
              )}
            </div>

            {/* Actions */}
            <div>
              <Label className="text-xs text-gray-500 mb-2 block">Then do this...</Label>
              <div className="flex flex-wrap gap-1.5 mb-3">
                {actionTypes.map(action => (
                  <button
                    key={action.value}
                    type="button"
                    onClick={() => addAction(action.value)}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs rounded-md border border-dashed border-gray-300 text-gray-600 hover:border-gray-400 hover:bg-gray-50 transition-colors"
                  >
                    <action.icon className="w-3.5 h-3.5" />
                    {action.label}
                  </button>
                ))}
              </div>
              {actions.length > 0 ? (
                <div className="space-y-2">
                  {actions.map((action, index) => {
                    const actionDef = actionTypes.find(a => a.value === action.action_type)
                    const ActionIcon = actionDef?.icon || Target
                    return (
                      <div key={index} className="flex items-center gap-2 p-2.5 bg-green-50 border border-green-200 rounded-lg text-sm">
                        <span className="w-5 h-5 bg-green-500 text-white rounded text-xs flex items-center justify-center font-medium">
                          {index + 1}
                        </span>
                        <ActionIcon className="w-4 h-4 text-green-600" />
                        <span className="text-gray-700">{actionDef?.label}</span>

                        {action.action_type === 'move_to_stage' && (
                          <Select
                            value={action.target_stage_id || ''}
                            onValueChange={(v) => updateAction(index, { target_stage_id: v })}
                          >
                            <SelectTrigger className="w-36 h-7 ml-auto">
                              <SelectValue placeholder="Select stage" />
                            </SelectTrigger>
                            <SelectContent>
                              {stages.filter(s => s.id !== stage.id).map(s => (
                                <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        )}
                        {action.action_type === 'move_to_group' && (
                          <Select
                            value={action.target_group_id || ''}
                            onValueChange={(v) => updateAction(index, { target_group_id: v })}
                          >
                            <SelectTrigger className="w-36 h-7 ml-auto">
                              <SelectValue placeholder="Select group" />
                            </SelectTrigger>
                            <SelectContent>
                              {applicationGroups.map(g => (
                                <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        )}
                        {action.action_type === 'move_to_stage_group' && (
                          <Select
                            value={action.target_stage_group_id || ''}
                            onValueChange={(v) => updateAction(index, { target_stage_group_id: v })}
                          >
                            <SelectTrigger className="w-36 h-7 ml-auto">
                              <SelectValue placeholder="Select group" />
                            </SelectTrigger>
                            <SelectContent>
                              {stageGroups.map(g => (
                                <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        )}
                        {(action.action_type === 'add_tags' || action.action_type === 'remove_tags') && (
                          <Input
                            value={action.tags?.join(', ') || ''}
                            onChange={(e) => updateAction(index, { 
                              tags: e.target.value.split(',').map(t => t.trim()).filter(Boolean)
                            })}
                            placeholder="tag1, tag2"
                            className="w-32 h-7 ml-auto"
                          />
                        )}
                        <button onClick={() => removeAction(index)} className="p-1 text-gray-400 hover:text-red-500 ml-1">
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )
                  })}
                </div>
              ) : (
                <p className="text-xs text-red-500">Add at least one action</p>
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="px-4 py-3 bg-gray-50 border-t flex items-center justify-between">
            <label className="flex items-center gap-2">
              <Switch checked={isActive} onCheckedChange={setIsActive} />
              <span className="text-sm text-gray-600">Active</span>
            </label>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={cancelEdit}>Cancel</Button>
              <Button 
                size="sm"
                onClick={handleSave} 
                disabled={!ruleName.trim() || actions.length === 0 || isSaving}
              >
                {isSaving && <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />}
                {editingRule ? 'Update' : 'Create'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

interface LogicRule {
  id: string
  conditions: LogicCondition[]
  conditionLogic: 'AND' | 'OR'
  action: string
}

function AutomationStageSettings({
  stage,
  formSections,
  reviewerTypes,
  onSave
}: {
  stage: ApplicationStage
  formSections: FormSection[]
  reviewerTypes: ReviewerType[]
  onSave: () => void
}) {
  const [isSaving, setIsSaving] = useState(false)
  const [activeSection, setActiveSection] = useState<'rules' | 'visibility' | 'notifications'>('rules')
  
  // Custom statuses and tags from the stage
  const customStatuses = stage.custom_statuses || ['Pending', 'In Progress', 'Complete']
  const customTags = stage.custom_tags || []
  
  // Multi-condition Logic Rules State
  const [advanceRules, setAdvanceRules] = useState<LogicRule[]>([{
    id: '1',
    conditions: [{ id: '1', field: 'average_score', operator: '>=', value: '80' }],
    conditionLogic: 'AND',
    action: 'move_to_next'
  }])
  const [rejectRules, setRejectRules] = useState<LogicRule[]>([{
    id: '1',
    conditions: [{ id: '1', field: 'status', operator: '==', value: '' }],
    conditionLogic: 'AND',
    action: 'set_ineligible'
  }])
  
  const [visibilityReviewerTypes, setVisibilityReviewerTypes] = useState<string[]>([])
  const [activeConditionPicker, setActiveConditionPicker] = useState<{ ruleType: 'advance' | 'reject', ruleId: string, conditionId: string } | null>(null)
  const [fieldSearchQuery, setFieldSearchQuery] = useState('')
  const [expandedGroups, setExpandedGroups] = useState<string[]>(['status', 'review'])
  const [rulesEnabled, setRulesEnabled] = useState(true)

  // Parse existing rules on mount
  useEffect(() => {
    if (stage.logic_rules) {
      // Parse advance conditions
      if (stage.logic_rules.auto_advance_condition) {
        try {
          const parsed = JSON.parse(stage.logic_rules.auto_advance_condition)
          if (Array.isArray(parsed) && parsed.length > 0) {
            setAdvanceRules(parsed)
          }
        } catch {
          // Legacy format - single condition
          const match = stage.logic_rules.auto_advance_condition.match(/if\s+(\w+)\s*(>=|<=|>|<|==|!=)\s*(\S+)\s+then/i)
          if (match) {
            setAdvanceRules([{
              id: '1',
              conditions: [{ id: '1', field: match[1], operator: match[2], value: match[3] }],
              conditionLogic: 'AND',
              action: 'move_to_next'
            }])
          }
        }
      }
      // Parse reject conditions
      if (stage.logic_rules.auto_reject_condition) {
        try {
          const parsed = JSON.parse(stage.logic_rules.auto_reject_condition)
          if (Array.isArray(parsed) && parsed.length > 0) {
            setRejectRules(parsed)
          }
        } catch {
          // Legacy format
          const match = stage.logic_rules.auto_reject_condition.match(/if\s+(\w+)\s*(>=|<=|>|<|==|!=)\s*(\S+)\s+then/i)
          if (match) {
            setRejectRules([{
              id: '1',
              conditions: [{ id: '1', field: match[1], operator: match[2], value: match[3] }],
              conditionLogic: 'AND',
              action: 'set_ineligible'
            }])
          }
        }
      }
      if (stage.logic_rules.visibility_rules) {
        const match = stage.logic_rules.visibility_rules.match(/\[(.*?)\]/i)
        if (match) {
          const types = match[1].split(',').map(s => s.trim().replace(/['"]/g, ''))
          setVisibilityReviewerTypes(types)
        }
      }
    }
  }, [stage.logic_rules])

  // Field groups for rule builder - includes custom statuses and tags
  const fieldGroups = [
    {
      id: 'status',
      name: '🏷️ Status & Tags',
      fields: [
        { value: 'status', label: 'Current Status', type: 'status', options: customStatuses },
        { value: 'tag', label: 'Has Tag', type: 'tag', options: customTags },
        { value: 'days_in_stage', label: 'Days in Stage', type: 'number' },
        { value: 'has_flag', label: 'Has Flag', type: 'boolean' },
      ]
    },
    {
      id: 'review',
      name: '📊 Review Scores',
      fields: [
        { value: 'average_score', label: 'Average Score', type: 'number' },
        { value: 'total_score', label: 'Total Score', type: 'number' },
        { value: 'reviews_complete', label: 'Reviews Complete', type: 'number' },
        { value: 'min_score', label: 'Minimum Score', type: 'number' },
        { value: 'max_score', label: 'Maximum Score', type: 'number' },
      ]
    },
    ...formSections.map(section => ({
      id: `form_${section.id}`,
      name: `📝 ${section.title}`,
      fields: section.fields.map(f => ({
        value: `form.${section.id}.${f.id}`,
        label: f.label,
        type: 'text' as const
      }))
    }))
  ]

  const allFields = fieldGroups.flatMap(g => g.fields)

  const operatorOptions = [
    { value: '>=', label: '≥ greater or equal', types: ['number'] },
    { value: '<=', label: '≤ less or equal', types: ['number'] },
    { value: '>', label: '> greater than', types: ['number'] },
    { value: '<', label: '< less than', types: ['number'] },
    { value: '==', label: '= equals', types: ['number', 'text', 'status', 'tag', 'boolean'] },
    { value: '!=', label: '≠ not equals', types: ['number', 'text', 'status', 'tag', 'boolean'] },
    { value: 'contains', label: 'contains', types: ['text', 'tag'] },
  ]

  const getOperatorsForField = (fieldValue: string) => {
    const field = allFields.find(f => f.value === fieldValue)
    const fieldType = field?.type || 'text'
    return operatorOptions.filter(op => op.types.includes(fieldType))
  }

  const getFieldLabel = (fieldValue: string) => {
    const field = allFields.find(f => f.value === fieldValue)
    return field?.label || fieldValue
  }
  
  const getFieldInfo = (fieldValue: string) => {
    return allFields.find(f => f.value === fieldValue)
  }

  const toggleGroup = (groupId: string) => {
    setExpandedGroups(prev => 
      prev.includes(groupId) ? prev.filter(id => id !== groupId) : [...prev, groupId]
    )
  }

  const selectField = (fieldValue: string) => {
    if (activeConditionPicker) {
      const { ruleType, ruleId, conditionId } = activeConditionPicker
      const rules = ruleType === 'advance' ? advanceRules : rejectRules
      const setRules = ruleType === 'advance' ? setAdvanceRules : setRejectRules
      
      const validOps = getOperatorsForField(fieldValue)
      const defaultOperator = validOps.length > 0 ? validOps[0].value : '=='
      
      setRules(rules.map(rule => 
        rule.id === ruleId 
          ? {
              ...rule,
              conditions: rule.conditions.map(c => 
                c.id === conditionId ? { ...c, field: fieldValue, operator: defaultOperator, value: '' } : c
              )
            }
          : rule
      ))
    }
    setActiveConditionPicker(null)
    setFieldSearchQuery('')
  }

  const filteredFieldGroups = fieldGroups.map(group => ({
    ...group,
    fields: group.fields.filter(f => 
      f.label.toLowerCase().includes(fieldSearchQuery.toLowerCase()) ||
      f.value.toLowerCase().includes(fieldSearchQuery.toLowerCase())
    )
  })).filter(g => g.fields.length > 0)
  
  // Rule management functions
  const addConditionToRule = (ruleType: 'advance' | 'reject', ruleId: string) => {
    const rules = ruleType === 'advance' ? advanceRules : rejectRules
    const setRules = ruleType === 'advance' ? setAdvanceRules : setRejectRules
    
    setRules(rules.map(rule => 
      rule.id === ruleId 
        ? {
            ...rule,
            conditions: [...rule.conditions, { 
              id: String(Date.now()), 
              field: 'average_score', 
              operator: '>=', 
              value: '' 
            }]
          }
        : rule
    ))
  }
  
  const removeConditionFromRule = (ruleType: 'advance' | 'reject', ruleId: string, conditionId: string) => {
    const rules = ruleType === 'advance' ? advanceRules : rejectRules
    const setRules = ruleType === 'advance' ? setAdvanceRules : setRejectRules
    
    setRules(rules.map(rule => 
      rule.id === ruleId 
        ? { ...rule, conditions: rule.conditions.filter(c => c.id !== conditionId) }
        : rule
    ))
  }
  
  const updateCondition = (
    ruleType: 'advance' | 'reject', 
    ruleId: string, 
    conditionId: string, 
    updates: Partial<LogicCondition>
  ) => {
    const rules = ruleType === 'advance' ? advanceRules : rejectRules
    const setRules = ruleType === 'advance' ? setAdvanceRules : setRejectRules
    
    setRules(rules.map(rule => 
      rule.id === ruleId 
        ? {
            ...rule,
            conditions: rule.conditions.map(c => 
              c.id === conditionId ? { ...c, ...updates } : c
            )
          }
        : rule
    ))
  }
  
  const updateRuleLogic = (ruleType: 'advance' | 'reject', ruleId: string, logic: 'AND' | 'OR') => {
    const rules = ruleType === 'advance' ? advanceRules : rejectRules
    const setRules = ruleType === 'advance' ? setAdvanceRules : setRejectRules
    
    setRules(rules.map(rule => 
      rule.id === ruleId ? { ...rule, conditionLogic: logic } : rule
    ))
  }
  
  const updateRuleAction = (ruleType: 'advance' | 'reject', ruleId: string, action: string) => {
    const rules = ruleType === 'advance' ? advanceRules : rejectRules
    const setRules = ruleType === 'advance' ? setAdvanceRules : setRejectRules
    
    setRules(rules.map(rule => 
      rule.id === ruleId ? { ...rule, action } : rule
    ))
  }

  const buildLogicRules = () => {
    const rules: { auto_advance_condition?: string; auto_reject_condition?: string; visibility_rules?: string } = {}
    
    // Store as JSON for multi-condition support
    const validAdvanceRules = advanceRules.filter(r => 
      r.conditions.every(c => c.field && c.operator && c.value)
    )
    if (validAdvanceRules.length > 0) {
      rules.auto_advance_condition = JSON.stringify(validAdvanceRules)
    }
    
    const validRejectRules = rejectRules.filter(r => 
      r.conditions.every(c => c.field && c.operator && c.value)
    )
    if (validRejectRules.length > 0) {
      rules.auto_reject_condition = JSON.stringify(validRejectRules)
    }
    
    if (visibilityReviewerTypes.length > 0) {
      rules.visibility_rules = `only show stage to reviewer types [${visibilityReviewerTypes.map(t => `'${t}'`).join(', ')}]`
    }
    
    return rules
  }

  const handleSave = async () => {
    setIsSaving(true)
    try {
      const builtRules = buildLogicRules()
      await workflowsClient.updateStage(stage.id, {
        logic_rules: Object.keys(builtRules).length > 0 ? builtRules : undefined
      })
      showToast('Automation rules saved', 'success')
      onSave()
    } catch (error: any) {
      console.error('Failed to save automation rules:', error)
      showToast(error.message || 'Failed to save', 'error')
    } finally {
      setIsSaving(false)
    }
  }
  
  // Render a single condition row
  const renderCondition = (
    ruleType: 'advance' | 'reject',
    rule: LogicRule,
    condition: LogicCondition,
    index: number,
    isLast: boolean
  ) => {
    const fieldInfo = getFieldInfo(condition.field)
    const hasOptions = fieldInfo && 'options' in fieldInfo && Array.isArray(fieldInfo.options) && fieldInfo.options.length > 0
    const colorClass = ruleType === 'advance' ? 'green' : 'red'
    
    return (
      <div key={condition.id} className="space-y-2">
        <div className="flex items-center gap-2 flex-wrap">
          {index === 0 ? (
            <span className="px-2 py-1 bg-gray-100 rounded text-xs font-bold text-gray-600 w-12 text-center">IF</span>
          ) : (
            <button
              type="button"
              onClick={() => updateRuleLogic(ruleType, rule.id, rule.conditionLogic === 'AND' ? 'OR' : 'AND')}
              className={cn(
                "px-2 py-1 rounded text-xs font-bold w-12 text-center transition-colors",
                rule.conditionLogic === 'AND' 
                  ? "bg-blue-100 text-blue-700 hover:bg-blue-200" 
                  : "bg-purple-100 text-purple-700 hover:bg-purple-200"
              )}
            >
              {rule.conditionLogic}
            </button>
          )}
          
          <button
            type="button"
            onClick={() => setActiveConditionPicker({ ruleType, ruleId: rule.id, conditionId: condition.id })}
            className={cn(
              "px-3 py-2 border border-gray-200 rounded-lg transition-colors flex items-center gap-2",
              ruleType === 'advance' ? "hover:border-green-400 hover:bg-green-50" : "hover:border-red-400 hover:bg-red-50"
            )}
          >
            <FileText className="w-4 h-4 text-gray-400" />
            <span className="font-medium text-gray-700">{getFieldLabel(condition.field)}</span>
            <ChevronDown className="w-4 h-4 text-gray-400" />
          </button>
          
          <Select 
            value={condition.operator} 
            onValueChange={(v) => updateCondition(ruleType, rule.id, condition.id, { operator: v })}
          >
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {getOperatorsForField(condition.field).map(opt => (
                <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          
          {/* Value input - show dropdown for status/tag fields with options */}
          {hasOptions ? (
            <Select 
              value={condition.value} 
              onValueChange={(v) => updateCondition(ruleType, rule.id, condition.id, { value: v })}
            >
              <SelectTrigger className="w-36">
                <SelectValue placeholder="Select..." />
              </SelectTrigger>
              <SelectContent>
                {(fieldInfo.options as string[]).map(opt => (
                  <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <Input 
              value={condition.value} 
              onChange={(e) => updateCondition(ruleType, rule.id, condition.id, { value: e.target.value })}
              className="w-24"
              placeholder="Value"
            />
          )}
          
          {rule.conditions.length > 1 && (
            <button
              type="button"
              onClick={() => removeConditionFromRule(ruleType, rule.id, condition.id)}
              className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
        
        {/* Add condition button after last condition */}
        {isLast && (
          <button
            type="button"
            onClick={() => addConditionToRule(ruleType, rule.id)}
            className={cn(
              "ml-14 text-xs font-medium flex items-center gap-1 px-2 py-1 rounded transition-colors",
              ruleType === 'advance' 
                ? "text-green-600 hover:bg-green-50" 
                : "text-red-600 hover:bg-red-50"
            )}
          >
            <Plus className="w-3 h-3" />
            Add condition
          </button>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Field Picker Modal */}
      {activeConditionPicker && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setActiveConditionPicker(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-[420px] max-h-[70vh] flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="p-5 border-b border-gray-100 bg-gradient-to-b from-gray-50 to-white">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-gray-900">Select a Field</h3>
                <button onClick={() => setActiveConditionPicker(null)} className="p-1 hover:bg-gray-100 rounded-lg transition-colors">
                  <X className="w-5 h-5 text-gray-400" />
                </button>
              </div>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  value={fieldSearchQuery}
                  onChange={e => setFieldSearchQuery(e.target.value)}
                  placeholder="Search fields..."
                  className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  autoFocus
                />
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-3">
              {filteredFieldGroups.map(group => (
                <div key={group.id} className="mb-1">
                  <button
                    type="button"
                    onClick={() => toggleGroup(group.id)}
                    className="w-full flex items-center gap-2 px-3 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 rounded-xl transition-colors"
                  >
                    <ChevronRight className={cn("w-4 h-4 text-gray-400 transition-transform duration-200", expandedGroups.includes(group.id) && "rotate-90")} />
                    <span>{group.name}</span>
                    <Badge variant="secondary" className="ml-auto text-xs">{group.fields.length}</Badge>
                  </button>
                  {expandedGroups.includes(group.id) && (
                    <div className="ml-6 space-y-0.5 mt-1 mb-2">
                      {group.fields.map(field => (
                        <button
                          key={field.value}
                          type="button"
                          onClick={() => selectField(field.value)}
                          className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-600 hover:bg-blue-50 hover:text-blue-700 rounded-lg transition-colors group"
                        >
                          <span className="flex-1 text-left">{field.label}</span>
                          {'options' in field && Array.isArray(field.options) && field.options.length > 0 && (
                            <span className="text-xs text-gray-400 group-hover:text-blue-500">{field.options.length} options</span>
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Section Navigation Pills */}
      <div className="flex gap-2 p-1 bg-gray-100 rounded-xl">
        <button
          onClick={() => setActiveSection('rules')}
          className={cn(
            "flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all",
            activeSection === 'rules' ? "bg-white shadow-sm text-gray-900" : "text-gray-600 hover:text-gray-900"
          )}
        >
          <Zap className="w-4 h-4" />
          Automation Rules
        </button>
        <button
          onClick={() => setActiveSection('visibility')}
          className={cn(
            "flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all",
            activeSection === 'visibility' ? "bg-white shadow-sm text-gray-900" : "text-gray-600 hover:text-gray-900"
          )}
        >
          <Users className="w-4 h-4" />
          Visibility
        </button>
      </div>

      {activeSection === 'rules' && (
        <>
          {/* Master Toggle */}
          <div className="flex items-center justify-between p-4 bg-gradient-to-r from-gray-50 to-gray-100/50 rounded-xl border border-gray-200">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center shadow-sm">
                <Zap className="w-5 h-5 text-white" />
              </div>
              <div>
                <p className="font-medium text-gray-900">Automation Rules</p>
                <p className="text-xs text-gray-500">Automatically process applications based on conditions</p>
              </div>
            </div>
            <Switch checked={rulesEnabled} onCheckedChange={setRulesEnabled} />
          </div>

          {rulesEnabled && (
            <div className="space-y-4">
              {/* Auto-Advance Rule Card */}
              <div className="rounded-2xl border-2 border-green-200 overflow-hidden bg-white shadow-sm">
                <div className="bg-gradient-to-r from-green-500 to-emerald-600 px-5 py-4 flex items-center gap-3">
                  <div className="w-9 h-9 bg-white/20 backdrop-blur rounded-xl flex items-center justify-center">
                    <ChevronRight className="w-5 h-5 text-white" />
                  </div>
                  <div className="flex-1">
                    <h4 className="font-semibold text-white">Auto-Advance</h4>
                    <p className="text-xs text-green-100">Move applications forward automatically</p>
                  </div>
                  <Badge className="bg-white/20 text-white border-0">{advanceRules[0]?.conditions.length || 0} conditions</Badge>
                </div>
                
                {advanceRules.map(rule => (
                  <div key={rule.id} className="p-5 space-y-4">
                    {/* Conditions */}
                    <div className="space-y-3">
                      <div className="flex items-center gap-2 text-xs font-medium text-gray-500 uppercase tracking-wide">
                        <Target className="w-3.5 h-3.5" />
                        When these conditions are met
                      </div>
                      
                      {rule.conditions.map((condition, idx) => (
                        <div key={condition.id} className="flex items-center gap-2 flex-wrap">
                          {idx === 0 ? (
                            <span className="px-3 py-1.5 bg-green-100 rounded-lg text-xs font-bold text-green-700 min-w-[44px] text-center">IF</span>
                          ) : (
                            <button
                              type="button"
                              onClick={() => updateRuleLogic('advance', rule.id, rule.conditionLogic === 'AND' ? 'OR' : 'AND')}
                              className={cn(
                                "px-3 py-1.5 rounded-lg text-xs font-bold min-w-[44px] text-center transition-all hover:scale-105",
                                rule.conditionLogic === 'AND' 
                                  ? "bg-blue-100 text-blue-700 hover:bg-blue-200" 
                                  : "bg-purple-100 text-purple-700 hover:bg-purple-200"
                              )}
                            >
                              {rule.conditionLogic}
                            </button>
                          )}
                          
                          <button
                            type="button"
                            onClick={() => setActiveConditionPicker({ ruleType: 'advance', ruleId: rule.id, conditionId: condition.id })}
                            className="px-3 py-2 bg-white border-2 border-gray-200 rounded-xl transition-all flex items-center gap-2 hover:border-green-400 hover:shadow-sm group"
                          >
                            <FileText className="w-4 h-4 text-gray-400 group-hover:text-green-500" />
                            <span className="font-medium text-gray-700">{getFieldLabel(condition.field)}</span>
                            <ChevronDown className="w-4 h-4 text-gray-400" />
                          </button>
                          
                          <Select value={condition.operator} onValueChange={(v) => updateCondition('advance', rule.id, condition.id, { operator: v })}>
                            <SelectTrigger className="w-36 border-2">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {getOperatorsForField(condition.field).map(opt => (
                                <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          
                          {(() => {
                            const fieldInfo = getFieldInfo(condition.field)
                            const hasOptions = fieldInfo && 'options' in fieldInfo && Array.isArray(fieldInfo.options) && fieldInfo.options.length > 0
                            return hasOptions ? (
                              <Select value={condition.value} onValueChange={(v) => updateCondition('advance', rule.id, condition.id, { value: v })}>
                                <SelectTrigger className="w-36 border-2">
                                  <SelectValue placeholder="Select..." />
                                </SelectTrigger>
                                <SelectContent>
                                  {(fieldInfo.options as string[]).map(opt => (
                                    <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            ) : (
                              <Input 
                                value={condition.value} 
                                onChange={(e) => updateCondition('advance', rule.id, condition.id, { value: e.target.value })}
                                className="w-24 border-2"
                                placeholder="Value"
                              />
                            )
                          })()}
                          
                          {rule.conditions.length > 1 && (
                            <button
                              type="button"
                              onClick={() => removeConditionFromRule('advance', rule.id, condition.id)}
                              className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      ))}
                      
                      <button
                        type="button"
                        onClick={() => addConditionToRule('advance', rule.id)}
                        className="ml-14 text-sm font-medium flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-green-600 hover:bg-green-50 transition-colors"
                      >
                        <Plus className="w-4 h-4" />
                        Add condition
                      </button>
                    </div>
                    
                    {/* Arrow connector */}
                    <div className="flex items-center gap-3 px-4">
                      <div className="flex-1 h-px bg-gradient-to-r from-transparent via-green-200 to-transparent" />
                      <ChevronDown className="w-5 h-5 text-green-400" />
                      <div className="flex-1 h-px bg-gradient-to-r from-transparent via-green-200 to-transparent" />
                    </div>
                    
                    {/* Action */}
                    <div className="flex items-center gap-3 p-4 bg-green-50 rounded-xl border border-green-200">
                      <span className="px-3 py-1.5 bg-green-500 text-white rounded-lg text-xs font-bold">THEN</span>
                      <Select value={rule.action} onValueChange={(v) => updateRuleAction('advance', rule.id, v)}>
                        <SelectTrigger className="flex-1 bg-white border-2 border-green-200">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="move_to_next">
                            <div className="flex items-center gap-2">
                              <ChevronRight className="w-4 h-4 text-green-500" />
                              Move to next stage
                            </div>
                          </SelectItem>
                          <SelectItem value="set_approved">
                            <div className="flex items-center gap-2">
                              <Check className="w-4 h-4 text-green-500" />
                              Set status to Approved
                            </div>
                          </SelectItem>
                          <SelectItem value="complete">
                            <div className="flex items-center gap-2">
                              <CheckCircle className="w-4 h-4 text-green-500" />
                              Complete workflow
                            </div>
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                ))}
              </div>

              {/* Auto-Reject Rule Card */}
              <div className="rounded-2xl border-2 border-red-200 overflow-hidden bg-white shadow-sm">
                <div className="bg-gradient-to-r from-red-500 to-rose-600 px-5 py-4 flex items-center gap-3">
                  <div className="w-9 h-9 bg-white/20 backdrop-blur rounded-xl flex items-center justify-center">
                    <XCircle className="w-5 h-5 text-white" />
                  </div>
                  <div className="flex-1">
                    <h4 className="font-semibold text-white">Auto-Reject</h4>
                    <p className="text-xs text-red-100">Reject applications that don't meet requirements</p>
                  </div>
                  <Badge className="bg-white/20 text-white border-0">{rejectRules[0]?.conditions.length || 0} conditions</Badge>
                </div>
                
                {rejectRules.map(rule => (
                  <div key={rule.id} className="p-5 space-y-4">
                    {/* Conditions */}
                    <div className="space-y-3">
                      <div className="flex items-center gap-2 text-xs font-medium text-gray-500 uppercase tracking-wide">
                        <Target className="w-3.5 h-3.5" />
                        When these conditions are met
                      </div>
                      
                      {rule.conditions.map((condition, idx) => (
                        <div key={condition.id} className="flex items-center gap-2 flex-wrap">
                          {idx === 0 ? (
                            <span className="px-3 py-1.5 bg-red-100 rounded-lg text-xs font-bold text-red-700 min-w-[44px] text-center">IF</span>
                          ) : (
                            <button
                              type="button"
                              onClick={() => updateRuleLogic('reject', rule.id, rule.conditionLogic === 'AND' ? 'OR' : 'AND')}
                              className={cn(
                                "px-3 py-1.5 rounded-lg text-xs font-bold min-w-[44px] text-center transition-all hover:scale-105",
                                rule.conditionLogic === 'AND' 
                                  ? "bg-blue-100 text-blue-700 hover:bg-blue-200" 
                                  : "bg-purple-100 text-purple-700 hover:bg-purple-200"
                              )}
                            >
                              {rule.conditionLogic}
                            </button>
                          )}
                          
                          <button
                            type="button"
                            onClick={() => setActiveConditionPicker({ ruleType: 'reject', ruleId: rule.id, conditionId: condition.id })}
                            className="px-3 py-2 bg-white border-2 border-gray-200 rounded-xl transition-all flex items-center gap-2 hover:border-red-400 hover:shadow-sm group"
                          >
                            <FileText className="w-4 h-4 text-gray-400 group-hover:text-red-500" />
                            <span className="font-medium text-gray-700">{getFieldLabel(condition.field)}</span>
                            <ChevronDown className="w-4 h-4 text-gray-400" />
                          </button>
                          
                          <Select value={condition.operator} onValueChange={(v) => updateCondition('reject', rule.id, condition.id, { operator: v })}>
                            <SelectTrigger className="w-36 border-2">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {getOperatorsForField(condition.field).map(opt => (
                                <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          
                          {(() => {
                            const fieldInfo = getFieldInfo(condition.field)
                            const hasOptions = fieldInfo && 'options' in fieldInfo && Array.isArray(fieldInfo.options) && fieldInfo.options.length > 0
                            return hasOptions ? (
                              <Select value={condition.value} onValueChange={(v) => updateCondition('reject', rule.id, condition.id, { value: v })}>
                                <SelectTrigger className="w-36 border-2">
                                  <SelectValue placeholder="Select..." />
                                </SelectTrigger>
                                <SelectContent>
                                  {(fieldInfo.options as string[]).map(opt => (
                                    <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            ) : (
                              <Input 
                                value={condition.value} 
                                onChange={(e) => updateCondition('reject', rule.id, condition.id, { value: e.target.value })}
                                className="w-24 border-2"
                                placeholder="Value"
                              />
                            )
                          })()}
                          
                          {rule.conditions.length > 1 && (
                            <button
                              type="button"
                              onClick={() => removeConditionFromRule('reject', rule.id, condition.id)}
                              className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      ))}
                      
                      <button
                        type="button"
                        onClick={() => addConditionToRule('reject', rule.id)}
                        className="ml-14 text-sm font-medium flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-red-600 hover:bg-red-50 transition-colors"
                      >
                        <Plus className="w-4 h-4" />
                        Add condition
                      </button>
                    </div>
                    
                    {/* Arrow connector */}
                    <div className="flex items-center gap-3 px-4">
                      <div className="flex-1 h-px bg-gradient-to-r from-transparent via-red-200 to-transparent" />
                      <ChevronDown className="w-5 h-5 text-red-400" />
                      <div className="flex-1 h-px bg-gradient-to-r from-transparent via-red-200 to-transparent" />
                    </div>
                    
                    {/* Action */}
                    <div className="flex items-center gap-3 p-4 bg-red-50 rounded-xl border border-red-200">
                      <span className="px-3 py-1.5 bg-red-500 text-white rounded-lg text-xs font-bold">THEN</span>
                      <Select value={rule.action} onValueChange={(v) => updateRuleAction('reject', rule.id, v)}>
                        <SelectTrigger className="flex-1 bg-white border-2 border-red-200">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="set_ineligible">
                            <div className="flex items-center gap-2">
                              <XCircle className="w-4 h-4 text-red-500" />
                              Set Ineligible & stop workflow
                            </div>
                          </SelectItem>
                          <SelectItem value="set_declined">
                            <div className="flex items-center gap-2">
                              <X className="w-4 h-4 text-red-500" />
                              Set status to Declined
                            </div>
                          </SelectItem>
                          <SelectItem value="flag_review">
                            <div className="flex items-center gap-2">
                              <Clock className="w-4 h-4 text-amber-500" />
                              Flag for manual review
                            </div>
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {activeSection === 'visibility' && (
        <div className="space-y-4">
          {/* Visibility Card */}
          <div className="rounded-2xl border-2 border-purple-200 overflow-hidden bg-white shadow-sm">
            <div className="bg-gradient-to-r from-purple-500 to-violet-600 px-5 py-4 flex items-center gap-3">
              <div className="w-9 h-9 bg-white/20 backdrop-blur rounded-xl flex items-center justify-center">
                <Shield className="w-5 h-5 text-white" />
              </div>
              <div className="flex-1">
                <h4 className="font-semibold text-white">Stage Visibility</h4>
                <p className="text-xs text-purple-100">Control who can see this stage</p>
              </div>
            </div>
            
            <div className="p-5 space-y-4">
              <p className="text-sm text-gray-600">
                Select which reviewer types can see and interact with applications in this stage. 
                Leave all unchecked to allow all reviewers access.
              </p>
              
              {reviewerTypes.length === 0 ? (
                <div className="p-4 bg-amber-50 rounded-xl border border-amber-200 flex items-start gap-3">
                  <div className="w-8 h-8 bg-amber-100 rounded-lg flex items-center justify-center flex-shrink-0">
                    <Users className="w-4 h-4 text-amber-600" />
                  </div>
                  <div>
                    <p className="font-medium text-amber-800">No reviewer types defined</p>
                    <p className="text-sm text-amber-600 mt-0.5">Create reviewer types first to configure visibility rules.</p>
                  </div>
                </div>
              ) : (
                <div className="grid gap-2">
                  {reviewerTypes.map(rt => (
                    <label 
                      key={rt.id} 
                      className={cn(
                        "flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all",
                        visibilityReviewerTypes.includes(rt.name)
                          ? "border-purple-300 bg-purple-50"
                          : "border-gray-200 hover:border-purple-200 hover:bg-purple-50/50"
                      )}
                    >
                      <input
                        type="checkbox"
                        checked={visibilityReviewerTypes.includes(rt.name)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setVisibilityReviewerTypes([...visibilityReviewerTypes, rt.name])
                          } else {
                            setVisibilityReviewerTypes(visibilityReviewerTypes.filter(n => n !== rt.name))
                          }
                        }}
                        className="rounded border-gray-300 text-purple-600 focus:ring-purple-500 w-5 h-5"
                      />
                      <div className="flex-1">
                        <span className="font-medium text-gray-900">{rt.name}</span>
                        {rt.description && (
                          <p className="text-xs text-gray-500 mt-0.5">{rt.description}</p>
                        )}
                      </div>
                      {visibilityReviewerTypes.includes(rt.name) && (
                        <Check className="w-5 h-5 text-purple-500" />
                      )}
                    </label>
                  ))}
                </div>
              )}
              
              {visibilityReviewerTypes.length > 0 && (
                <div className="p-3 bg-purple-50 rounded-xl border border-purple-200">
                  <p className="text-sm text-purple-700">
                    <span className="font-medium">{visibilityReviewerTypes.length}</span> reviewer type{visibilityReviewerTypes.length !== 1 ? 's' : ''} can access this stage: {visibilityReviewerTypes.join(', ')}
                  </p>
                </div>
              )}
              
              {visibilityReviewerTypes.length === 0 && reviewerTypes.length > 0 && (
                <div className="p-3 bg-gray-50 rounded-xl border border-gray-200">
                  <p className="text-sm text-gray-600">
                    <span className="font-medium">All reviewers</span> can see this stage (no restrictions)
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Save Button */}
      <Button onClick={handleSave} disabled={isSaving} size="lg" className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 shadow-lg shadow-blue-500/25">
        {isSaving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
        Save Automation Settings
      </Button>
    </div>
  )
}

// Stage Groups Settings Tab Component
// Manage sub-groups within this stage (visible only in this stage)
function StageGroupsSettings({
  stage,
  workspaceId,
  onSave
}: {
  stage: ApplicationStage
  workspaceId: string
  onSave: () => void
}) {
  const [groups, setGroups] = useState<StageGroup[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [editingGroup, setEditingGroup] = useState<StageGroup | null>(null)
  const [isCreating, setIsCreating] = useState(false)

  // Form state for creating/editing
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [color, setColor] = useState('blue')
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    loadGroups()
  }, [stage.id])

  const loadGroups = async () => {
    setIsLoading(true)
    try {
      const data = await workflowsClient.listStageGroups(stage.id)
      setGroups(data)
    } catch (error) {
      console.error('Failed to load stage groups:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const colors = [
    { value: 'blue', label: 'Blue', bg: 'bg-blue-500', bgLight: 'bg-blue-50', text: 'text-blue-600', border: 'border-blue-200' },
    { value: 'green', label: 'Green', bg: 'bg-green-500', bgLight: 'bg-green-50', text: 'text-green-600', border: 'border-green-200' },
    { value: 'yellow', label: 'Yellow', bg: 'bg-yellow-500', bgLight: 'bg-yellow-50', text: 'text-yellow-600', border: 'border-yellow-200' },
    { value: 'orange', label: 'Orange', bg: 'bg-orange-500', bgLight: 'bg-orange-50', text: 'text-orange-600', border: 'border-orange-200' },
    { value: 'red', label: 'Red', bg: 'bg-red-500', bgLight: 'bg-red-50', text: 'text-red-600', border: 'border-red-200' },
    { value: 'purple', label: 'Purple', bg: 'bg-purple-500', bgLight: 'bg-purple-50', text: 'text-purple-600', border: 'border-purple-200' },
    { value: 'pink', label: 'Pink', bg: 'bg-pink-500', bgLight: 'bg-pink-50', text: 'text-pink-600', border: 'border-pink-200' },
    { value: 'gray', label: 'Gray', bg: 'bg-gray-500', bgLight: 'bg-gray-50', text: 'text-gray-600', border: 'border-gray-200' },
  ]

  const startEdit = (group: StageGroup) => {
    setEditingGroup(group)
    setName(group.name)
    setDescription(group.description || '')
    setColor(group.color)
    setIsCreating(false)
  }

  const startCreate = () => {
    setEditingGroup(null)
    setName('')
    setDescription('')
    setColor('blue')
    setIsCreating(true)
  }

  const cancelEdit = () => {
    setEditingGroup(null)
    setIsCreating(false)
    setName('')
    setDescription('')
    setColor('blue')
  }

  const handleSave = async () => {
    if (!name.trim()) return
    setIsSaving(true)
    try {
      if (editingGroup) {
        await workflowsClient.updateStageGroup(editingGroup.id, {
          name: name.trim(),
          description: description.trim() || undefined,
          color,
        })
      } else {
        await workflowsClient.createStageGroup({
          stage_id: stage.id,
          workspace_id: workspaceId,
          name: name.trim(),
          description: description.trim() || undefined,
          color,
        })
      }
      await loadGroups()
      cancelEdit()
      onSave()
    } catch (error) {
      console.error('Failed to save stage group:', error)
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = async (groupId: string) => {
    if (!confirm('Delete this stage group? Applications in this group will be moved back to the main queue.')) return
    try {
      await workflowsClient.deleteStageGroup(groupId)
      await loadGroups()
      cancelEdit()
      onSave()
    } catch (error) {
      console.error('Failed to delete stage group:', error)
    }
  }

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500 mb-3" />
        <p className="text-sm text-gray-500">Loading groups...</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start gap-4 p-4 bg-gradient-to-r from-indigo-50 to-purple-50 rounded-2xl border border-indigo-100">
        <div className="w-12 h-12 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-500/20">
          <Folder className="w-6 h-6 text-white" />
        </div>
        <div className="flex-1">
          <h4 className="font-semibold text-gray-900 mb-1">Stage Groups</h4>
          <p className="text-sm text-gray-600">
            Create sub-groups within this stage to organize applications. Groups are only visible in this stage and help you categorize work.
          </p>
        </div>
      </div>

      {/* Existing Groups */}
      {groups.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h5 className="text-sm font-medium text-gray-500 uppercase tracking-wide">Your Groups</h5>
            <Badge variant="secondary">{groups.length} group{groups.length !== 1 ? 's' : ''}</Badge>
          </div>
          <div className="grid gap-3">
            {groups.map((group) => {
              const colorDef = colors.find(c => c.value === group.color) || colors[0]
              const isEditing = editingGroup?.id === group.id
              return (
                <div
                  key={group.id}
                  className={cn(
                    "group relative p-4 rounded-xl border-2 transition-all duration-200",
                    isEditing 
                      ? "border-blue-400 bg-blue-50 shadow-lg shadow-blue-500/10" 
                      : cn("hover:shadow-md", colorDef.border, colorDef.bgLight)
                  )}
                >
                  <div className="flex items-center gap-4">
                    <div className={cn(
                      "w-12 h-12 rounded-xl flex items-center justify-center text-white shadow-sm transition-transform group-hover:scale-105",
                      colorDef.bg
                    )}>
                      <FolderOpen className="w-5 h-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-semibold text-gray-900">{group.name}</p>
                        <Badge variant="outline" className={cn("text-xs", colorDef.text, colorDef.border)}>
                          {colorDef.label}
                        </Badge>
                      </div>
                      {group.description && (
                        <p className="text-sm text-gray-500 truncate mt-0.5">{group.description}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => startEdit(group)}
                        className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-100 rounded-lg transition-colors"
                        title="Edit group"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(group.id)}
                        className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-100 rounded-lg transition-colors"
                        title="Delete group"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Empty State */}
      {groups.length === 0 && !isCreating && (
        <div className="text-center py-12 border-2 border-dashed border-gray-200 rounded-2xl bg-gray-50/50">
          <div className="w-16 h-16 bg-gradient-to-br from-gray-100 to-gray-200 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <FolderOpen className="w-8 h-8 text-gray-400" />
          </div>
          <p className="text-lg font-medium text-gray-900 mb-2">No stage groups yet</p>
          <p className="text-sm text-gray-500 mb-6 max-w-sm mx-auto">
            Create groups to organize applications within this stage, like "Needs Review", "Pending Info", or "Ready to Advance"
          </p>
          <Button onClick={startCreate} className="bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 shadow-lg shadow-indigo-500/25">
            <Plus className="w-4 h-4 mr-2" />
            Create Your First Group
          </Button>
        </div>
      )}

      {/* Create/Edit Form */}
      {(isCreating || editingGroup) && (
        <div className="p-5 bg-white rounded-2xl border-2 border-blue-200 shadow-lg shadow-blue-500/10 space-y-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center">
                {editingGroup ? <Edit2 className="w-5 h-5 text-white" /> : <Plus className="w-5 h-5 text-white" />}
              </div>
              <h5 className="font-semibold text-gray-900">
                {editingGroup ? 'Edit Stage Group' : 'Create New Group'}
              </h5>
            </div>
            <button onClick={cancelEdit} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
              <X className="w-5 h-5 text-gray-400" />
            </button>
          </div>

          <div className="space-y-4">
            <div>
              <Label htmlFor="group-name" className="text-sm font-medium text-gray-700">Group Name *</Label>
              <Input
                id="group-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Needs More Info, Under Review"
                className="mt-1.5 border-2 focus:border-blue-400"
              />
            </div>

            <div>
              <Label htmlFor="group-desc" className="text-sm font-medium text-gray-700">Description</Label>
              <Input
                id="group-desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="What is this group for?"
                className="mt-1.5 border-2 focus:border-blue-400"
              />
            </div>

            <div>
              <Label className="text-sm font-medium text-gray-700">Color</Label>
              <div className="flex gap-2 mt-2">
                {colors.map((c) => (
                  <button
                    key={c.value}
                    onClick={() => setColor(c.value)}
                    className={cn(
                      "w-10 h-10 rounded-xl transition-all flex items-center justify-center",
                      c.bg,
                      color === c.value 
                        ? "ring-2 ring-offset-2 ring-gray-900 scale-110" 
                        : "hover:scale-105 opacity-70 hover:opacity-100"
                    )}
                    title={c.label}
                  >
                    {color === c.value && <Check className="w-5 h-5 text-white" />}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <Button
              onClick={handleSave}
              disabled={!name.trim() || isSaving}
              className="flex-1 bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700"
            >
              {isSaving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
              {editingGroup ? 'Update Group' : 'Create Group'}
            </Button>
            <Button variant="outline" onClick={cancelEdit} className="px-6">
              Cancel
            </Button>
          </div>
        </div>
      )}

      {/* Add Button (when not in create mode and groups exist) */}
      {!isCreating && !editingGroup && groups.length > 0 && (
        <Button variant="outline" onClick={startCreate} className="w-full border-2 border-dashed hover:border-solid hover:bg-indigo-50 hover:border-indigo-300 hover:text-indigo-600">
          <Plus className="w-4 h-4 mr-2" />
          Add Another Group
        </Button>
      )}
    </div>
  )
}

// Status Actions Settings Tab Component
// Configure action buttons (CustomStatus) that appear in the review interface
function StatusActionsSettings({
  stage,
  workspaceId,
  workflowId,
  onSave
}: {
  stage: ApplicationStage
  workspaceId: string
  workflowId: string
  onSave: () => void
}) {
  const [statuses, setStatuses] = useState<CustomStatus[]>([])
  const [stageGroups, setStageGroups] = useState<StageGroup[]>([])
  const [applicationGroups, setApplicationGroups] = useState<ApplicationGroup[]>([])
  const [stages, setStages] = useState<ApplicationStage[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [editingStatus, setEditingStatus] = useState<CustomStatus | null>(null)
  const [isCreating, setIsCreating] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

  // Form state
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [color, setColor] = useState<'blue' | 'green' | 'red' | 'yellow' | 'purple' | 'gray'>('blue')
  const [icon, setIcon] = useState('circle')
  const [isPrimary, setIsPrimary] = useState(false)
  const [requiresComment, setRequiresComment] = useState(false)
  const [requiresScore, setRequiresScore] = useState(false)
  const [actions, setActions] = useState<StatusActionConfig[]>([])

  useEffect(() => {
    loadData()
  }, [stage.id])

  const loadData = async () => {
    setIsLoading(true)
    try {
      const [statusData, groupData, appGroupData, stageData] = await Promise.all([
        workflowsClient.listCustomStatuses(stage.id),
        workflowsClient.listStageGroups(stage.id),
        workflowsClient.listGroups(workflowId),
        workflowsClient.listStages(workflowId)
      ])
      setStatuses(statusData)
      setStageGroups(groupData)
      setApplicationGroups(appGroupData)
      setStages(stageData)
    } catch (error) {
      console.error('Failed to load data:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const colors = [
    { value: 'green' as const, label: 'Green (Approve)', bg: 'bg-green-500', bgLight: 'bg-green-50', text: 'text-green-600' },
    { value: 'red' as const, label: 'Red (Reject)', bg: 'bg-red-500', bgLight: 'bg-red-50', text: 'text-red-600' },
    { value: 'blue' as const, label: 'Blue (Info)', bg: 'bg-blue-500', bgLight: 'bg-blue-50', text: 'text-blue-600' },
    { value: 'yellow' as const, label: 'Yellow (Warning)', bg: 'bg-yellow-500', bgLight: 'bg-yellow-50', text: 'text-yellow-600' },
    { value: 'purple' as const, label: 'Purple', bg: 'bg-purple-500', bgLight: 'bg-purple-50', text: 'text-purple-600' },
    { value: 'gray' as const, label: 'Gray (Neutral)', bg: 'bg-gray-500', bgLight: 'bg-gray-50', text: 'text-gray-600' },
  ]

  const actionTypes = [
    { value: 'move_to_stage', label: 'Move to Stage', icon: ChevronRight, description: 'Advance to another stage' },
    { value: 'move_to_group', label: 'Move to Group', icon: Archive, description: 'Move out of pipeline to a group' },
    { value: 'move_to_stage_group', label: 'Move to Stage Group', icon: Folder, description: 'Organize within this stage' },
    { value: 'add_tags', label: 'Add Tags', icon: Tag, description: 'Apply tags to the application' },
    { value: 'remove_tags', label: 'Remove Tags', icon: X, description: 'Remove existing tags' },
    { value: 'send_email', label: 'Send Email', icon: FileText, description: 'Send notification email' },
  ]

  const startCreate = () => {
    setEditingStatus(null)
    setName('')
    setDescription('')
    setColor('blue')
    setIcon('circle')
    setIsPrimary(false)
    setRequiresComment(false)
    setRequiresScore(false)
    setActions([])
    setIsCreating(true)
  }

  const startEdit = (status: CustomStatus) => {
    setEditingStatus(status)
    setName(status.name)
    setDescription(status.description || '')
    setColor(status.color as typeof color)
    setIcon(status.icon)
    setIsPrimary(status.is_primary)
    setRequiresComment(status.requires_comment)
    setRequiresScore(status.requires_score)
    setActions(status.actions || [])
    setIsCreating(false)
  }

  const cancelEdit = () => {
    setEditingStatus(null)
    setIsCreating(false)
    setActions([])
  }

  const addAction = (actionType: string) => {
    const newAction: StatusActionConfig = { action_type: actionType as any }
    setActions([...actions, newAction])
  }

  const updateAction = (index: number, updates: Partial<StatusActionConfig>) => {
    const updated = [...actions]
    updated[index] = { ...updated[index], ...updates }
    setActions(updated)
  }

  const removeAction = (index: number) => {
    setActions(actions.filter((_, i) => i !== index))
  }

  const handleSave = async () => {
    if (!name.trim()) return
    setIsSaving(true)
    try {
      const statusData = {
        stage_id: stage.id,
        workspace_id: workspaceId,
        name: name.trim(),
        description: description.trim() || undefined,
        color,
        icon,
        is_primary: isPrimary,
        requires_comment: requiresComment,
        requires_score: requiresScore,
        actions,
      }

      if (editingStatus) {
        await workflowsClient.updateCustomStatus(editingStatus.id, statusData)
        showToast('Status action updated', 'success')
      } else {
        await workflowsClient.createCustomStatus(statusData)
        showToast('Status action created', 'success')
      }
      await loadData()
      cancelEdit()
      onSave()
    } catch (error: any) {
      console.error('Failed to save status:', error)
      showToast(error.message || 'Failed to save', 'error')
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = async (statusId: string) => {
    if (!confirm('Delete this status action? This cannot be undone.')) return
    try {
      await workflowsClient.deleteCustomStatus(statusId)
      await loadData()
      cancelEdit()
      showToast('Status action deleted', 'success')
      onSave()
    } catch (error) {
      console.error('Failed to delete status:', error)
    }
  }

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500 mb-3" />
        <p className="text-sm text-gray-500">Loading status actions...</p>
      </div>
    )
  }

  const getColorDef = (c: string) => colors.find(col => col.value === c) || colors[2]

  return (
    <div className="space-y-5">
      {/* Compact Header */}
      <div className="flex items-center gap-3 p-3 bg-amber-50 rounded-xl border border-amber-100">
        <Sparkles className="w-5 h-5 text-amber-600" />
        <div className="flex-1">
          <h4 className="font-medium text-gray-900 text-sm">Status Action Buttons</h4>
          <p className="text-xs text-gray-500">
            Buttons reviewers click to take action on applications
          </p>
        </div>
        {!isCreating && !editingStatus && (
          <Button size="sm" onClick={startCreate} className="h-8">
            <Plus className="w-3.5 h-3.5 mr-1.5" />
            Add
          </Button>
        )}
      </div>

      {/* Existing Statuses - Compact List */}
      {statuses.length > 0 && !isCreating && !editingStatus && (
        <div className="border rounded-xl divide-y overflow-hidden">
          {statuses.map((status) => {
            const colorDef = getColorDef(status.color)
            return (
              <div
                key={status.id}
                className="p-3 hover:bg-gray-50 transition-colors flex items-center gap-3"
              >
                <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center text-white", colorDef.bg)}>
                  {status.is_primary ? <CheckCircle className="w-4 h-4" /> : <Target className="w-4 h-4" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-gray-900 text-sm">{status.name}</span>
                    {status.is_primary && (
                      <span className="text-xs px-1.5 py-0.5 bg-amber-100 text-amber-700 rounded">Primary</span>
                    )}
                  </div>
                  {status.actions && status.actions.length > 0 && (
                    <div className="flex items-center gap-1 mt-0.5">
                      {status.actions.slice(0, 2).map((action, idx) => (
                        <span key={idx} className="text-xs px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded">
                          {actionTypes.find(t => t.value === action.action_type)?.label || action.action_type}
                        </span>
                      ))}
                      {status.actions.length > 2 && (
                        <span className="text-xs text-gray-400">+{status.actions.length - 2}</span>
                      )}
                    </div>
                  )}
                </div>
                <button
                  onClick={() => startEdit(status)}
                  className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-md"
                >
                  <Edit2 className="w-4 h-4" />
                </button>
                <button
                  onClick={() => handleDelete(status.id)}
                  className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-md"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            )
          })}
        </div>
      )}

      {/* Empty State */}
      {statuses.length === 0 && !isCreating && (
        <div className="text-center py-10 border-2 border-dashed border-gray-200 rounded-xl">
          <div className="w-12 h-12 bg-amber-100 rounded-xl flex items-center justify-center mx-auto mb-3">
            <Sparkles className="w-6 h-6 text-amber-600" />
          </div>
          <h3 className="font-medium text-gray-900 mb-1">No action buttons</h3>
          <p className="text-sm text-gray-500 mb-4">Create "Approve", "Reject", or custom actions</p>
          <Button onClick={startCreate} size="sm">
            <Plus className="w-4 h-4 mr-1.5" />
            Create Action
          </Button>
        </div>
      )}

      {/* Create/Edit Form - Clean Design */}
      {(isCreating || editingStatus) && (
        <div className="border rounded-xl overflow-hidden">
          {/* Header */}
          <div className="px-4 py-3 bg-gray-50 border-b flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-600" />
              <h3 className="font-medium text-gray-900">{editingStatus ? 'Edit Action' : 'New Action'}</h3>
            </div>
            <button onClick={cancelEdit} className="p-1 hover:bg-gray-200 rounded">
              <X className="w-4 h-4 text-gray-500" />
            </button>
          </div>

          <div className="p-4 space-y-4">
            {/* Name & Color */}
            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2">
                <Label className="text-xs text-gray-500 mb-1.5 block">Button Name</Label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g., Approve, Request Info"
                  className="h-9"
                />
              </div>
              <div>
                <Label className="text-xs text-gray-500 mb-1.5 block">Color</Label>
                <Select value={color} onValueChange={(v) => setColor(v as typeof color)}>
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {colors.map(c => (
                      <SelectItem key={c.value} value={c.value}>
                        <div className="flex items-center gap-2">
                          <div className={cn("w-3 h-3 rounded-full", c.bg)} />
                          <span className="text-sm">{c.label.split(' ')[0]}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Description */}
            <div>
              <Label className="text-xs text-gray-500 mb-1.5 block">Description (optional)</Label>
              <Input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="What does this action do?"
                className="h-9"
              />
            </div>

            {/* Options Row */}
            <div className="flex items-center gap-4 text-sm">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isPrimary}
                  onChange={(e) => setIsPrimary(e.target.checked)}
                  className="rounded border-gray-300 text-blue-600"
                />
                <span className="text-gray-600">Primary</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={requiresComment}
                  onChange={(e) => setRequiresComment(e.target.checked)}
                  className="rounded border-gray-300 text-blue-600"
                />
                <span className="text-gray-600">Require comment</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={requiresScore}
                  onChange={(e) => setRequiresScore(e.target.checked)}
                  className="rounded border-gray-300 text-blue-600"
                />
                <span className="text-gray-600">Require score</span>
              </label>
            </div>

            {/* Actions */}
            <div>
              <Label className="text-xs text-gray-500 mb-2 block">Triggered Actions</Label>
              <div className="flex flex-wrap gap-1.5 mb-3">
                {actionTypes.map(type => (
                  <button
                    key={type.value}
                    type="button"
                    onClick={() => addAction(type.value)}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs rounded-md border border-dashed border-gray-300 text-gray-600 hover:border-gray-400 hover:bg-gray-50 transition-colors"
                  >
                    <type.icon className="w-3.5 h-3.5" />
                    {type.label}
                  </button>
                ))}
              </div>

              {actions.length > 0 && (
                <div className="space-y-2">
                  {actions.map((action, index) => {
                    const actionDef = actionTypes.find(t => t.value === action.action_type)
                    const ActionIcon = actionDef?.icon || Target
                    return (
                      <div key={index} className="flex items-center gap-2 p-2.5 bg-gray-50 border rounded-lg text-sm">
                        <span className="w-5 h-5 bg-gray-200 text-gray-600 rounded text-xs flex items-center justify-center font-medium">
                          {index + 1}
                        </span>
                        <ActionIcon className="w-4 h-4 text-gray-500" />
                        <span className="text-gray-700">{actionDef?.label}</span>

                        {action.action_type === 'move_to_stage' && (
                          <Select
                            value={action.target_stage_id || ''}
                            onValueChange={(v) => updateAction(index, { target_stage_id: v })}
                          >
                            <SelectTrigger className="w-36 h-7 ml-auto">
                              <SelectValue placeholder="Select stage" />
                            </SelectTrigger>
                            <SelectContent>
                              {stages.filter(s => s.id !== stage.id).map(s => (
                                <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        )}
                        {action.action_type === 'move_to_group' && (
                          <Select
                            value={action.target_group_id || ''}
                            onValueChange={(v) => updateAction(index, { target_group_id: v })}
                          >
                            <SelectTrigger className="w-36 h-7 ml-auto">
                              <SelectValue placeholder="Select group" />
                            </SelectTrigger>
                            <SelectContent>
                              {applicationGroups.map(g => (
                                <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        )}
                        {action.action_type === 'move_to_stage_group' && (
                          <Select
                            value={action.target_stage_group_id || ''}
                            onValueChange={(v) => updateAction(index, { target_stage_group_id: v })}
                          >
                            <SelectTrigger className="w-36 h-7 ml-auto">
                              <SelectValue placeholder="Select group" />
                            </SelectTrigger>
                            <SelectContent>
                              {stageGroups.map(g => (
                                <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        )}
                        {(action.action_type === 'add_tags' || action.action_type === 'remove_tags') && (
                          <Input
                            value={action.tags?.join(', ') || ''}
                            onChange={(e) => updateAction(index, { 
                              tags: e.target.value.split(',').map(t => t.trim()).filter(Boolean)
                            })}
                            placeholder="tag1, tag2"
                            className="w-32 h-7 ml-auto"
                          />
                        )}
                        <button onClick={() => removeAction(index)} className="p-1 text-gray-400 hover:text-red-500 ml-1">
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="px-4 py-3 bg-gray-50 border-t flex items-center justify-end gap-2">
            <Button variant="outline" size="sm" onClick={cancelEdit}>Cancel</Button>
            <Button 
              size="sm"
              onClick={handleSave} 
              disabled={!name.trim() || isSaving}
            >
              {isSaving && <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />}
              {editingStatus ? 'Update' : 'Create'}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

// Privacy Stage Settings Tab Component
function PrivacyStageSettings({
  stage,
  formSections,
  onSave
}: {
  stage: ApplicationStage
  formSections: FormSection[]
  onSave: () => void
}) {
  const [hidePII, setHidePII] = useState(stage.hide_pii || false)
  const [hiddenPIIFields, setHiddenPIIFields] = useState<string[]>(stage.hidden_pii_fields || [])
  const [isSaving, setIsSaving] = useState(false)

  // Save function - called immediately on changes
  const savePrivacySettings = async (newHidePII: boolean, newHiddenFields: string[]) => {
    setIsSaving(true)
    try {
      await workflowsClient.updateStage(stage.id, {
        hide_pii: newHidePII,
        hidden_pii_fields: newHiddenFields,
      })
      onSave()
    } catch (error: any) {
      console.error('Failed to save privacy settings:', error)
      showToast(error.message || 'Failed to save', 'error')
    } finally {
      setIsSaving(false)
    }
  }

  // Handle privacy toggle - clears fields when turned off
  const handlePrivacyToggle = (checked: boolean) => {
    setHidePII(checked)
    if (!checked) {
      // Clear all hidden fields when privacy mode is turned off
      setHiddenPIIFields([])
      savePrivacySettings(false, [])
    } else {
      savePrivacySettings(true, hiddenPIIFields)
    }
  }

  // Handle field checkbox change - save immediately
  const handleFieldToggle = (fieldId: string, checked: boolean) => {
    const newFields = checked 
      ? [...hiddenPIIFields, fieldId]
      : hiddenPIIFields.filter(f => f !== fieldId)
    setHiddenPIIFields(newFields)
    savePrivacySettings(hidePII, newFields)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between p-4 bg-purple-50 rounded-xl border border-purple-200">
        <div>
          <Label className="text-sm font-semibold flex items-center gap-2">
            <Shield className="w-4 h-4 text-purple-500" />
            Privacy Mode
            {isSaving && <span className="text-xs text-purple-500">(saving...)</span>}
          </Label>
          <p className="text-xs text-purple-700 mt-1">Hide personally identifiable information from reviewers</p>
        </div>
        <Switch
          checked={hidePII}
          onCheckedChange={handlePrivacyToggle}
          disabled={isSaving}
        />
      </div>
      
      {hidePII && (
        <div className="p-4 bg-purple-50 rounded-xl border border-purple-100">
          <Label className="text-sm text-purple-900 flex items-center gap-2 mb-3">
            <EyeOff className="w-4 h-4" />
            Fields to Hide
          </Label>
          <p className="text-xs text-purple-700 mb-4">Select which fields should be hidden from reviewers in this stage</p>
          
          <div className="space-y-3 max-h-64 overflow-y-auto">
            {formSections.length > 0 ? (
              formSections.map(section => (
                <div key={section.id} className="bg-white rounded-lg p-3 border border-purple-100">
                  <p className="text-xs font-medium text-gray-700 mb-2">{section.title}</p>
                  <div className="space-y-1">
                    {section.fields.map(field => (
                      <label key={field.id} className="flex items-center gap-2 text-sm cursor-pointer hover:bg-purple-50 p-1.5 rounded">
                        <input
                          type="checkbox"
                          checked={hiddenPIIFields.includes(field.id)}
                          onChange={(e) => handleFieldToggle(field.id, e.target.checked)}
                          disabled={isSaving}
                          className="rounded border-purple-300 text-purple-600 focus:ring-purple-500"
                        />
                        <span className="text-gray-700">{field.label}</span>
                      </label>
                    ))}
                  </div>
                </div>
              ))
            ) : (
              <div className="text-sm text-purple-600 italic p-4 bg-white rounded-lg border border-purple-100">
                <p className="font-medium mb-2">Common PII fields that will be hidden:</p>
                <ul className="list-disc list-inside text-xs space-y-1">
                  <li>Full Name</li>
                  <li>Email Address</li>
                  <li>Phone Number</li>
                  <li>Home Address</li>
                  <li>Date of Birth</li>
                  <li>Social Security Number</li>
                </ul>
              </div>
            )}
          </div>
          
          {hiddenPIIFields.length > 0 && (
            <div className="mt-4 pt-3 border-t border-purple-200">
              <p className="text-sm text-purple-800">
                <strong>{hiddenPIIFields.length}</strong> field(s) will be hidden from reviewers
              </p>
            </div>
          )}
        </div>
      )}

      {/* Autosave indicator */}
      {isSaving && (
        <div className="flex items-center justify-center gap-2 text-sm text-gray-500">
          <Loader2 className="w-4 h-4 animate-spin" />
          Saving...
        </div>
      )}
    </div>
  )
}

function ReviewerTypeForm({
  initial,
  workspaceId,
  onSave,
  onCancel
}: {
  initial?: ReviewerType
  workspaceId: string
  onSave: () => void
  onCancel: () => void
}) {
  const [name, setName] = useState(initial?.name || '')
  const [description, setDescription] = useState(initial?.description || '')
  const [canEditScore, setCanEditScore] = useState(initial?.default_permissions?.can_edit_score ?? true)
  const [canEditStatus, setCanEditStatus] = useState(initial?.default_permissions?.can_edit_status ?? false)
  const [canCommentOnly, setCanCommentOnly] = useState(initial?.default_permissions?.can_comment_only ?? false)
  const [canTag, setCanTag] = useState(initial?.default_permissions?.can_tag ?? true)
  const [isSaving, setIsSaving] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return
    setIsSaving(true)
    try {
      const reviewerData = {
        name: name.trim(),
        description: description.trim() || undefined,
        default_permissions: {
          can_edit_score: canEditScore,
          can_edit_status: canEditStatus,
          can_comment_only: canCommentOnly,
          can_tag: canTag
        }
      }
      
      if (initial) {
        await workflowsClient.updateReviewerType(initial.id, reviewerData)
        showToast('Reviewer type updated successfully', 'success')
      } else {
        await workflowsClient.createReviewerType({
          workspace_id: workspaceId,
          ...reviewerData,
          permissions: {}
        })
        showToast('Reviewer type created successfully', 'success')
      }
      onSave()
      onCancel()
    } catch (error: any) {
      console.error('Failed to save reviewer type:', error)
      showToast(error.message || 'Failed to save reviewer type', 'error')
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!initial || !confirm('Delete this reviewer role?')) return
    try {
      await workflowsClient.deleteReviewerType(initial.id)
      showToast('Reviewer type deleted successfully', 'success')
      onSave()
      onCancel()
    } catch (error: any) {
      console.error('Failed to delete reviewer type:', error)
      showToast(error.message || 'Failed to delete reviewer type', 'error')
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-2">
        <Label htmlFor="rt-name">Role Name *</Label>
        <Input
          id="rt-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g., Financial Reviewer, Academic Reviewer"
          autoFocus
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="rt-desc">Description</Label>
        <Textarea
          id="rt-desc"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Responsibilities of this role..."
          rows={3}
        />
      </div>

      {/* Default Permissions */}
      <div className="border-t pt-4">
        <Label className="text-sm font-medium">Default Permissions</Label>
        <p className="text-xs text-gray-500 mb-4">These permissions apply when assigning this role to a stage</p>
        
        <div className="space-y-3">
          <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
            <div>
              <Label className="text-sm">Can Score Applications</Label>
              <p className="text-xs text-gray-500">Enter and modify scores for categories</p>
            </div>
            <Switch checked={canEditScore} onCheckedChange={(checked) => {
              setCanEditScore(checked)
              if (checked) setCanCommentOnly(false)
            }} />
          </div>
          
          <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
            <div>
              <Label className="text-sm">Can Change Status</Label>
              <p className="text-xs text-gray-500">Advance or reject applications</p>
            </div>
            <Switch checked={canEditStatus} onCheckedChange={setCanEditStatus} />
          </div>
          
          <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
            <div>
              <Label className="text-sm">Comment Only</Label>
              <p className="text-xs text-gray-500">Can only add comments, no scoring</p>
            </div>
            <Switch checked={canCommentOnly} onCheckedChange={(checked) => {
              setCanCommentOnly(checked)
              if (checked) setCanEditScore(false)
            }} />
          </div>
          
          <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
            <div>
              <Label className="text-sm">Can Apply Tags</Label>
              <p className="text-xs text-gray-500">Add and remove tags from applications</p>
            </div>
            <Switch checked={canTag} onCheckedChange={setCanTag} />
          </div>
        </div>
      </div>

      <div className="flex gap-3 pt-4">
        <Button type="button" variant="outline" onClick={onCancel} className="flex-1">
          Cancel
        </Button>
        <Button type="submit" disabled={!name.trim() || isSaving} className="flex-1">
          {isSaving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
          {initial ? 'Save Changes' : 'Create Role'}
        </Button>
      </div>

      {initial && (
        <Button 
          type="button" 
          variant="ghost" 
          className="w-full text-red-600 hover:text-red-700 hover:bg-red-50"
          onClick={handleDelete}
        >
          <Trash2 className="w-4 h-4 mr-2" />
          Delete Role
        </Button>
      )}
    </form>
  )
}

// Enhanced Rubric Category with Score Levels - local form type
interface RubricScoreLevel {
  id: string
  minScore: number
  maxScore: number
  label: string
  description: string
}

interface LocalRubricCategory {
  id: string
  name: string
  description?: string
  maxPoints: number
  weight?: number
  levels: RubricScoreLevel[]
}

function RubricForm({
  initial,
  workspaceId,
  onSave,
  onCancel
}: {
  initial?: Rubric
  workspaceId: string
  onSave: () => void
  onCancel: () => void
}) {
  const [name, setName] = useState(initial?.name || '')
  const [description, setDescription] = useState(initial?.description || '')
  const [rubricType, setRubricType] = useState<'analytic' | 'holistic' | 'single-point'>(
    (initial as any)?.rubric_type || 'analytic'
  )
  const [categories, setCategories] = useState<LocalRubricCategory[]>(() => {
    if (Array.isArray(initial?.categories) && initial.categories.length > 0) {
      // Convert API format to local form format
      return initial.categories.map((cat: any) => ({
        id: cat.id || Date.now().toString(),
        name: cat.name || '',
        description: cat.description || '',
        maxPoints: cat.max_points || cat.maxPoints || cat.points || 20,
        weight: cat.weight,
        levels: cat.levels || cat.guidelines?.map((g: any) => ({
          id: g.id || Date.now().toString(),
          minScore: g.min_points ?? g.minScore ?? 0,
          maxScore: g.max_points ?? g.maxScore ?? (cat.max_points || 20),
          label: g.label || '',
          description: g.description || ''
        })) || [
          { id: '1', minScore: Math.round((cat.max_points || 20) * 0.9), maxScore: cat.max_points || 20, label: 'Excellent', description: '' },
          { id: '2', minScore: Math.round((cat.max_points || 20) * 0.7), maxScore: Math.round((cat.max_points || 20) * 0.9) - 1, label: 'Good', description: '' },
          { id: '3', minScore: Math.round((cat.max_points || 20) * 0.5), maxScore: Math.round((cat.max_points || 20) * 0.7) - 1, label: 'Fair', description: '' },
        ]
      }))
    }
    return []
  })
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)

  // Calculate total max score from categories
  const maxScore = categories.reduce((sum, cat) => sum + cat.maxPoints, 0)

  const addCategory = () => {
    const newId = Date.now().toString()
    const newCategory: LocalRubricCategory = {
      id: newId,
      name: '',
      maxPoints: 20,
      levels: [
        { id: '1', minScore: 18, maxScore: 20, label: 'Excellent', description: '' },
        { id: '2', minScore: 14, maxScore: 17, label: 'Good', description: '' },
        { id: '3', minScore: 10, maxScore: 13, label: 'Fair', description: '' },
      ]
    }
    setCategories([...categories, newCategory])
    setExpandedCategory(newId)
  }

  const updateCategory = (categoryId: string, field: keyof LocalRubricCategory, value: any) => {
    setCategories(categories.map(cat => {
      if (cat.id !== categoryId) return cat
      
      if (field === 'maxPoints') {
        // Recalculate levels when max points change
        const newMax = value as number
        const levels = cat.levels.map((level, idx) => {
          const levelCount = cat.levels.length
          const rangePerLevel = newMax / levelCount
          const minScore = Math.round(newMax - (rangePerLevel * (idx + 1)))
          const maxScore = idx === 0 ? newMax : Math.round(newMax - (rangePerLevel * idx)) - 1
          return { ...level, minScore: Math.max(0, minScore), maxScore }
        })
        return { ...cat, maxPoints: newMax, levels }
      }
      
      return { ...cat, [field]: value }
    }))
  }

  const updateLevel = (categoryId: string, levelId: string, field: keyof RubricScoreLevel, value: any) => {
    setCategories(categories.map(cat => {
      if (cat.id !== categoryId) return cat
      return {
        ...cat,
        levels: cat.levels.map(level => 
          level.id === levelId ? { ...level, [field]: value } : level
        )
      }
    }))
  }

  const addLevel = (categoryId: string) => {
    setCategories(categories.map(cat => {
      if (cat.id !== categoryId) return cat
      const lastLevel = cat.levels[cat.levels.length - 1]
      const newLevel: RubricScoreLevel = {
        id: Date.now().toString(),
        minScore: 0,
        maxScore: lastLevel ? lastLevel.minScore - 1 : cat.maxPoints,
        label: '',
        description: ''
      }
      return { ...cat, levels: [...cat.levels, newLevel] }
    }))
  }

  const removeLevel = (categoryId: string, levelId: string) => {
    setCategories(categories.map(cat => {
      if (cat.id !== categoryId) return cat
      return { ...cat, levels: cat.levels.filter(l => l.id !== levelId) }
    }))
  }

  const removeCategory = (categoryId: string) => {
    setCategories(categories.filter(c => c.id !== categoryId))
    if (expandedCategory === categoryId) {
      setExpandedCategory(null)
    }
  }

  // Convert local form format to API format
  const convertToApiFormat = (localCategories: LocalRubricCategory[]) => {
    return localCategories.filter(c => c.name.trim()).map(cat => ({
      id: cat.id,
      name: cat.name,
      description: cat.description,
      max_points: cat.maxPoints,
      weight: cat.weight,
      guidelines: cat.levels.map(level => ({
        id: level.id,
        label: level.label,
        min_points: level.minScore,
        max_points: level.maxScore,
        description: level.description
      }))
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return
    setIsSaving(true)
    try {
      const data = {
        name: name.trim(),
        description: description.trim() || undefined,
        max_score: maxScore,
        rubric_type: rubricType,
        total_points: maxScore,
        categories: convertToApiFormat(categories)
      }
      
      if (initial) {
        await workflowsClient.updateRubric(initial.id, data as any)
        showToast('Rubric updated successfully', 'success')
      } else {
        await workflowsClient.createRubric({
          workspace_id: workspaceId,
          ...data
        } as any)
        showToast('Rubric created successfully', 'success')
      }
      onSave()
      onCancel()
    } catch (error: any) {
      console.error('Failed to save rubric:', error)
      showToast(error.message || 'Failed to save rubric', 'error')
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!initial || !confirm('Delete this rubric?')) return
    try {
      await workflowsClient.deleteRubric(initial.id)
      showToast('Rubric deleted successfully', 'success')
      onSave()
      onCancel()
    } catch (error: any) {
      console.error('Failed to delete rubric:', error)
      showToast(error.message || 'Failed to delete rubric', 'error')
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Rubric Name */}
      <div className="space-y-2">
        <Label htmlFor="rb-name">Rubric Name *</Label>
        <Input
          id="rb-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g., Scholarship Selection Rubric"
          autoFocus
          required
        />
      </div>

      {/* Description */}
      <div className="space-y-2">
        <Label htmlFor="rb-desc">Description</Label>
        <Textarea
          id="rb-desc"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Guidelines for using this rubric..."
          rows={2}
        />
      </div>

      {/* Rubric Type */}
      <div className="space-y-2">
        <Label htmlFor="rb-type">Rubric Type</Label>
        <Select value={rubricType} onValueChange={(v) => setRubricType(v as 'analytic' | 'holistic' | 'single-point')}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="analytic">
              <div className="flex flex-col">
                <span className="font-medium">Analytic Rubric</span>
                <span className="text-xs text-gray-500">Score each category separately</span>
              </div>
            </SelectItem>
            <SelectItem value="holistic">
              <div className="flex flex-col">
                <span className="font-medium">Holistic Rubric</span>
                <span className="text-xs text-gray-500">Single overall score</span>
              </div>
            </SelectItem>
            <SelectItem value="single-point">
              <div className="flex flex-col">
                <span className="font-medium">Single-Point Rubric</span>
                <span className="text-xs text-gray-500">Pass/fail with feedback</span>
              </div>
            </SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Total Score Display */}
      <div className="p-4 bg-gradient-to-r from-violet-50 to-purple-50 rounded-xl border border-violet-100">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-violet-900">Total Maximum Score</p>
            <p className="text-xs text-violet-600 mt-0.5">Sum of all category max points</p>
          </div>
          <div className="text-3xl font-bold text-violet-700">{maxScore} pts</div>
        </div>
      </div>

      {/* Categories Section */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <Label>Scoring Categories</Label>
            <p className="text-xs text-gray-500 mt-0.5">Define criteria with score ranges</p>
          </div>
          <Button type="button" variant="outline" size="sm" onClick={addCategory}>
            <Plus className="w-3 h-3 mr-1" />
            Add Category
          </Button>
        </div>
        
        <div className="space-y-3">
          {categories.map((category) => (
            <div 
              key={category.id} 
              className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm"
            >
              {/* Category Header */}
              <div 
                className="flex items-center gap-3 p-4 cursor-pointer hover:bg-gray-50 transition-colors"
                onClick={() => setExpandedCategory(expandedCategory === category.id ? null : category.id)}
              >
                <div className="flex-1">
                  <div className="flex items-center gap-3">
                    <Input
                      value={category.name}
                      onChange={(e) => {
                        e.stopPropagation()
                        updateCategory(category.id, 'name', e.target.value)
                      }}
                      onClick={(e) => e.stopPropagation()}
                      placeholder="Category name (e.g., Academic Performance)"
                      className="font-semibold border-0 bg-transparent p-0 h-auto focus-visible:ring-0 text-gray-900"
                    />
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="text-right">
                    <span className="text-sm text-gray-500">Max:</span>
                    <Input
                      type="number"
                      value={category.maxPoints}
                      onChange={(e) => {
                        e.stopPropagation()
                        updateCategory(category.id, 'maxPoints', parseInt(e.target.value) || 0)
                      }}
                      onClick={(e) => e.stopPropagation()}
                      className="w-16 h-7 text-sm inline-block ml-1"
                      min={1}
                    />
                    <span className="text-sm text-gray-500 ml-1">pts</span>
                  </div>
                  <ChevronRight className={cn(
                    "w-5 h-5 text-gray-400 transition-transform",
                    expandedCategory === category.id && "rotate-90"
                  )} />
                </div>
              </div>

              {/* Expanded Score Levels */}
              {expandedCategory === category.id && (
                <div className="border-t border-gray-100 bg-gray-50 p-4 space-y-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-medium text-gray-600 uppercase tracking-wide">Score Levels</span>
                    <Button 
                      type="button" 
                      variant="ghost" 
                      size="sm"
                      className="h-7 text-xs"
                      onClick={() => addLevel(category.id)}
                    >
                      <Plus className="w-3 h-3 mr-1" />
                      Add Level
                    </Button>
                  </div>

                  {category.levels.map((level, levelIdx) => (
                    <div key={level.id} className="flex gap-3 items-start bg-white p-3 rounded-lg border border-gray-200">
                      {/* Score Range */}
                      <div className="flex items-center gap-1 shrink-0">
                        <div className={cn(
                          "px-2 py-1 rounded text-sm font-semibold min-w-[70px] text-center",
                          levelIdx === 0 && "bg-blue-100 text-blue-700",
                          levelIdx === 1 && "bg-blue-50 text-blue-600",
                          levelIdx === 2 && "bg-gray-100 text-gray-600",
                          levelIdx >= 3 && "bg-gray-50 text-gray-500"
                        )}>
                          <div className="flex items-center gap-1">
                            <Input
                              type="number"
                              value={level.minScore}
                              onChange={(e) => updateLevel(category.id, level.id, 'minScore', parseInt(e.target.value) || 0)}
                              className="w-10 h-5 text-xs p-1 text-center border-0 bg-transparent"
                              min={0}
                              max={category.maxPoints}
                            />
                            <span>-</span>
                            <Input
                              type="number"
                              value={level.maxScore}
                              onChange={(e) => updateLevel(category.id, level.id, 'maxScore', parseInt(e.target.value) || 0)}
                              className="w-10 h-5 text-xs p-1 text-center border-0 bg-transparent"
                              min={0}
                              max={category.maxPoints}
                            />
                          </div>
                          <span className="text-xs opacity-75">pts</span>
                        </div>
                      </div>

                      {/* Level Details */}
                      <div className="flex-1 space-y-2">
                        <Input
                          value={level.description}
                          onChange={(e) => updateLevel(category.id, level.id, 'description', e.target.value)}
                          placeholder="Describe criteria for this score range..."
                          className="text-sm"
                        />
                      </div>

                      {/* Remove Level */}
                      {category.levels.length > 1 && (
                        <Button 
                          type="button" 
                          variant="ghost" 
                          size="icon" 
                          className="h-8 w-8 text-gray-400 hover:text-red-500 shrink-0"
                          onClick={() => removeLevel(category.id, level.id)}
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                  ))}

                  {/* Remove Category Button */}
                  <Button 
                    type="button" 
                    variant="ghost" 
                    size="sm"
                    className="w-full text-red-500 hover:text-red-600 hover:bg-red-50 mt-2"
                    onClick={() => removeCategory(category.id)}
                  >
                    <Trash2 className="w-3 h-3 mr-1" />
                    Remove Category
                  </Button>
                </div>
              )}
            </div>
          ))}
          
          {categories.length === 0 && (
            <div className="text-center py-8 border-2 border-dashed border-gray-200 rounded-xl">
              <Award className="w-10 h-10 mx-auto mb-3 text-gray-300" />
              <p className="text-sm text-gray-500 mb-2">No scoring categories yet</p>
              <p className="text-xs text-gray-400 mb-4 max-w-xs mx-auto">
                Add categories like "Academic Performance", "Financial Need", or "Essay Quality" with score ranges
              </p>
              <Button type="button" variant="outline" size="sm" onClick={addCategory}>
                <Plus className="w-4 h-4 mr-1" />
                Add First Category
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex gap-3 pt-4 border-t border-gray-100">
        <Button type="button" variant="outline" onClick={onCancel} className="flex-1">
          Cancel
        </Button>
        <Button type="submit" disabled={!name.trim() || categories.length === 0 || isSaving} className="flex-1">
          {isSaving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
          {initial ? 'Save Changes' : 'Create Rubric'}
        </Button>
      </div>

      {initial && (
        <Button 
          type="button" 
          variant="ghost" 
          className="w-full text-red-600 hover:text-red-700 hover:bg-red-50"
          onClick={handleDelete}
        >
          <Trash2 className="w-4 h-4 mr-2" />
          Delete Rubric
        </Button>
      )}
    </form>
  )
}

function StageConfigForm({
  stage,
  reviewerTypes,
  rubrics,
  formSections,
  onSave,
  onCancel
}: {
  stage: ApplicationStage
  reviewerTypes: ReviewerType[]
  rubrics: Rubric[]
  formSections: FormSection[]
  onSave: () => void
  onCancel: () => void
}) {
  const [configs, setConfigs] = useState<Partial<StageReviewerConfig>[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [expandedConfig, setExpandedConfig] = useState<number | null>(null)

  useEffect(() => {
    loadConfigs()
  }, [stage.id])

  const loadConfigs = async () => {
    try {
      const data = await workflowsClient.listStageConfigs(stage.id)
      setConfigs(data)
    } catch (error) {
      console.error('Failed to load configs:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const addConfig = () => {
    const newConfig = {
      stage_id: stage.id,
      reviewer_type_id: reviewerTypes[0]?.id || '',
      rubric_id: undefined,
      assigned_rubric_id: undefined,
      visibility_config: {},
      field_visibility_config: {} as Record<string, boolean>,
      can_view_prior_scores: false,
      can_view_prior_comments: false,
      min_reviews_required: 1
    }
    setConfigs([...configs, newConfig])
    setExpandedConfig(configs.length) // Expand the new config
  }

  const updateConfig = (index: number, field: string, value: any) => {
    const updated = [...configs]
    updated[index] = { ...updated[index], [field]: value }
    setConfigs(updated)
  }

  const removeConfig = async (index: number, configId?: string) => {
    if (configId) {
      try {
        await workflowsClient.deleteStageConfig(configId)
      } catch (error) {
        console.error('Failed to delete config:', error)
      }
    }
    setConfigs(configs.filter((_, i) => i !== index))
  }

  const handleSave = async () => {
    setIsSaving(true)
    try {
      for (const config of configs) {
        if (config.id) {
          await workflowsClient.updateStageConfig(config.id, config as StageReviewerConfig)
        } else if (config.reviewer_type_id) {
          await workflowsClient.createStageConfig(config as StageReviewerConfig)
        }
      }
      onSave()
      onCancel()
    } catch (error) {
      console.error('Failed to save configs:', error)
    } finally {
      setIsSaving(false)
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
      </div>
    )
  }

  // Use form sections from props (from portal builder), or show fallback
  const fieldSections = formSections.length > 0 
    ? formSections.map(section => ({
        id: section.id,
        name: section.title,
        fields: section.fields.map(f => ({ id: f.id, label: f.label }))
      }))
    : []

  return (
    <div className="space-y-6">
      <div className="p-4 bg-violet-50 rounded-lg border border-violet-100">
        <h3 className="font-semibold text-violet-900">{stage.name}</h3>
        <p className="text-sm text-violet-700 mt-1">
          Configure which reviewer roles participate in this stage, what rubric they use, and what they can see.
        </p>
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Label>Reviewer Assignments</Label>
          <Button type="button" variant="outline" size="sm" onClick={addConfig} disabled={reviewerTypes.length === 0}>
            <Plus className="w-3 h-3 mr-1" />
            Add Reviewer
          </Button>
        </div>

        {configs.map((config, idx) => {
          const reviewerType = reviewerTypes.find(rt => rt.id === config.reviewer_type_id)
          const isExpanded = expandedConfig === idx
          
          return (
            <div key={config.id || idx} className="bg-gray-50 rounded-lg border border-gray-200 overflow-hidden">
              {/* Collapsed Header */}
              <div 
                className="flex items-center justify-between p-4 cursor-pointer hover:bg-gray-100 transition-colors"
                onClick={() => setExpandedConfig(isExpanded ? null : idx)}
              >
                <div className="flex items-center gap-3">
                  <ChevronRight className={`w-4 h-4 text-gray-400 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                  <div>
                    <span className="font-medium text-gray-900">{reviewerType?.name || 'Select Reviewer'}</span>
                    {config.rubric_id && (
                      <span className="text-xs text-gray-500 ml-2">
                        • {rubrics.find(r => r.id === config.rubric_id)?.name || 'Custom Rubric'}
                      </span>
                    )}
                  </div>
                </div>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="h-6 w-6 text-gray-400 hover:text-red-500"
                  onClick={(e) => { e.stopPropagation(); removeConfig(idx, config.id) }}
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
              
              {/* Expanded Content */}
              {isExpanded && (
                <div className="px-4 pb-4 space-y-4 border-t border-gray-200 pt-4">
                  {/* Reviewer Type Selection */}
                  <div className="space-y-2">
                    <Label className="text-sm">Reviewer Role</Label>
                    <Select 
                      value={config.reviewer_type_id} 
                      onValueChange={(val) => updateConfig(idx, 'reviewer_type_id', val)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select reviewer role" />
                      </SelectTrigger>
                      <SelectContent>
                        {reviewerTypes.map(rt => (
                          <SelectItem key={rt.id} value={rt.id}>{rt.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Rubric Selection */}
                  <div className="space-y-2">
                    <Label className="text-sm">Assigned Rubric</Label>
                    <Select 
                      value={config.rubric_id || config.assigned_rubric_id || 'none'} 
                      onValueChange={(val) => {
                        const rubricId = val === 'none' ? undefined : val
                        updateConfig(idx, 'rubric_id', rubricId)
                        updateConfig(idx, 'assigned_rubric_id', rubricId)
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select rubric" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Use workflow default rubric</SelectItem>
                        {rubrics.map(rb => (
                          <SelectItem key={rb.id} value={rb.id}>{rb.name} ({rb.max_score} pts)</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Min Reviews Required */}
                  <div className="space-y-2">
                    <Label className="text-sm">Minimum Reviews Required</Label>
                    <Input
                      type="number"
                      min={1}
                      max={10}
                      value={config.min_reviews_required || 1}
                      onChange={(e) => updateConfig(idx, 'min_reviews_required', parseInt(e.target.value) || 1)}
                      className="w-20"
                    />
                  </div>

                  {/* Prior Review Access */}
                  <div className="border-t pt-4 space-y-3">
                    <Label className="text-sm font-medium">Prior Review Access</Label>
                    <p className="text-xs text-gray-500">Control what reviewers can see from previous stages</p>
                    
                    <div className="flex items-center justify-between p-3 bg-white rounded-lg border">
                      <div>
                        <Label className="text-sm">View Prior Scores</Label>
                        <p className="text-xs text-gray-500">See scores from earlier stages</p>
                      </div>
                      <Switch 
                        checked={config.can_view_prior_scores || false}
                        onCheckedChange={(val) => updateConfig(idx, 'can_view_prior_scores', val)}
                      />
                    </div>
                    
                    <div className="flex items-center justify-between p-3 bg-white rounded-lg border">
                      <div>
                        <Label className="text-sm">View Prior Comments</Label>
                        <p className="text-xs text-gray-500">See feedback from earlier reviewers</p>
                      </div>
                      <Switch 
                        checked={config.can_view_prior_comments || false}
                        onCheckedChange={(val) => updateConfig(idx, 'can_view_prior_comments', val)}
                      />
                    </div>
                  </div>

                  {/* Field Visibility Config */}
                  <div className="border-t pt-4 space-y-3">
                    <Label className="text-sm font-medium">Field Visibility</Label>
                    <p className="text-xs text-gray-500">Control which application fields this reviewer can see</p>
                    
                    {fieldSections.length === 0 ? (
                      <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg text-center">
                        <p className="text-sm text-amber-700">
                          No form fields available. Create form sections and fields in the Portal Builder first.
                        </p>
                      </div>
                    ) : (
                    <div className="space-y-3">
                      {fieldSections.map((section) => (
                        <div key={section.id} className="bg-white rounded-lg border p-3">
                          <div className="flex items-center justify-between mb-2">
                            <Label className="text-sm font-medium">{section.name}</Label>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="text-xs"
                              onClick={() => {
                                const newConfig = { ...config.field_visibility_config }
                                const allVisible = section.fields.every(f => 
                                  newConfig?.[`${section.id}.${f.id}`] !== false
                                )
                                section.fields.forEach(f => {
                                  (newConfig as Record<string, boolean>)[`${section.id}.${f.id}`] = !allVisible
                                })
                                updateConfig(idx, 'field_visibility_config', newConfig)
                              }}
                            >
                              Toggle All
                            </Button>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {section.fields.map((field) => {
                              const key = `${section.id}.${field.id}`
                              const isVisible = config.field_visibility_config?.[key] !== false
                              return (
                                <button
                                  key={field.id}
                                  type="button"
                                  onClick={() => {
                                    const newConfig = { ...config.field_visibility_config }
                                    ;(newConfig as Record<string, boolean>)[key] = !isVisible
                                    updateConfig(idx, 'field_visibility_config', newConfig)
                                  }}
                                  className={cn(
                                    'px-2 py-1 text-xs rounded-md transition-colors',
                                    isVisible 
                                      ? 'bg-green-100 text-green-800 hover:bg-green-200' 
                                      : 'bg-gray-100 text-gray-500 hover:bg-gray-200 line-through'
                                  )}
                                >
                                  {field.label}
                                </button>
                              )
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )
        })}

        {configs.length === 0 && (
          <div className="text-center py-8 text-gray-500 text-sm border-2 border-dashed border-gray-200 rounded-lg">
            <Users className="w-8 h-8 mx-auto mb-2 text-gray-300" />
            <p>No reviewers assigned to this stage</p>
            {reviewerTypes.length === 0 ? (
              <p className="text-xs mt-1">Create reviewer roles first</p>
            ) : (
              <Button variant="link" size="sm" onClick={addConfig}>Add one</Button>
            )}
          </div>
        )}
      </div>

      <div className="flex gap-3 pt-4">
        <Button type="button" variant="outline" onClick={onCancel} className="flex-1">
          Cancel
        </Button>
        <Button onClick={handleSave} disabled={isSaving} className="flex-1">
          {isSaving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
          Save Configuration
        </Button>
      </div>
    </div>
  )
}

// Application Group Form
function GroupForm({
  initial,
  workspaceId,
  workflowId,
  onSave,
  onCancel
}: {
  initial?: ApplicationGroup
  workspaceId: string
  workflowId: string
  onSave: () => void
  onCancel: () => void
}) {
  const [name, setName] = useState(initial?.name || '')
  const [description, setDescription] = useState(initial?.description || '')
  const [color, setColor] = useState(initial?.color || 'gray')
  const [icon, setIcon] = useState(initial?.icon || 'folder')
  const [isSaving, setIsSaving] = useState(false)

  const colors = [
    { value: 'gray', label: 'Gray', bg: 'bg-gray-500' },
    { value: 'red', label: 'Red', bg: 'bg-red-500' },
    { value: 'orange', label: 'Orange', bg: 'bg-orange-500' },
    { value: 'yellow', label: 'Yellow', bg: 'bg-yellow-500' },
    { value: 'green', label: 'Green', bg: 'bg-green-500' },
    { value: 'blue', label: 'Blue', bg: 'bg-blue-500' },
    { value: 'purple', label: 'Purple', bg: 'bg-purple-500' },
    { value: 'pink', label: 'Pink', bg: 'bg-pink-500' },
  ]

  const icons = [
    { value: 'folder', label: 'Folder' },
    { value: 'archive', label: 'Archive' },
    { value: 'x-circle', label: 'Rejected' },
    { value: 'clock', label: 'Waitlist' },
    { value: 'check-circle', label: 'Approved' },
    { value: 'star', label: 'Star' },
    { value: 'flag', label: 'Flag' },
    { value: 'inbox', label: 'Inbox' },
  ]

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return
    setIsSaving(true)
    try {
      if (initial?.id) {
        await workflowsClient.updateGroup(initial.id, {
          name: name.trim(),
          description: description.trim() || undefined,
          color,
          icon,
        })
      } else {
        await workflowsClient.createGroup({
          workspace_id: workspaceId,
          review_workflow_id: workflowId,
          name: name.trim(),
          description: description.trim() || undefined,
          color,
          icon,
          is_system: false,
        })
      }
      onSave()
    } catch (error) {
      console.error('Failed to save group:', error)
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!initial?.id) return
    if (!confirm('Delete this group? Applications in this group will not be deleted.')) return
    try {
      await workflowsClient.deleteGroup(initial.id)
      onSave()
    } catch (error) {
      console.error('Failed to delete group:', error)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-2">
        <Label htmlFor="group-name">Group Name *</Label>
        <Input
          id="group-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g., Rejected, Waitlist, Archive"
          autoFocus
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="group-desc">Description</Label>
        <Textarea
          id="group-desc"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="What is this group used for?"
          rows={2}
        />
      </div>

      <div className="space-y-2">
        <Label>Color</Label>
        <div className="flex gap-2 flex-wrap">
          {colors.map((c) => (
            <button
              key={c.value}
              type="button"
              onClick={() => setColor(c.value)}
              className={cn(
                "w-8 h-8 rounded-lg transition-all",
                c.bg,
                color === c.value ? "ring-2 ring-offset-2 ring-gray-400 scale-110" : "hover:scale-105"
              )}
              title={c.label}
            />
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <Label>Icon</Label>
        <Select value={icon} onValueChange={setIcon}>
          <SelectTrigger>
            <SelectValue placeholder="Select an icon" />
          </SelectTrigger>
          <SelectContent>
            {icons.map((i) => (
              <SelectItem key={i.value} value={i.value}>
                {i.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Preview */}
      <div className="p-4 bg-gray-50 rounded-lg">
        <Label className="text-xs text-gray-500 mb-2 block">Preview</Label>
        <div className="flex items-center gap-3">
          <div className={cn(
            "w-10 h-10 rounded-lg flex items-center justify-center text-white",
            colors.find(c => c.value === color)?.bg || 'bg-gray-500'
          )}>
            {icon === 'archive' ? (
              <ArchiveX className="w-5 h-5" />
            ) : (
              <FolderOpen className="w-5 h-5" />
            )}
          </div>
          <div>
            <p className="font-medium text-gray-900">{name || 'Group Name'}</p>
            <p className="text-xs text-gray-500">{description || 'No description'}</p>
          </div>
        </div>
      </div>

      <div className="flex gap-3 pt-4">
        <Button type="button" variant="outline" onClick={onCancel} className="flex-1">
          Cancel
        </Button>
        <Button type="submit" disabled={!name.trim() || isSaving} className="flex-1">
          {isSaving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
          {initial ? 'Save Changes' : 'Create Group'}
        </Button>
      </div>

      {initial && !initial.is_system && (
        <Button 
          type="button" 
          variant="ghost" 
          className="w-full text-red-600 hover:text-red-700 hover:bg-red-50"
          onClick={handleDelete}
        >
          <Trash2 className="w-4 h-4 mr-2" />
          Delete Group
        </Button>
      )}
    </form>
  )
}

// Workflow Action Form
function WorkflowActionForm({
  initial,
  workspaceId,
  workflowId,
  groups,
  onSave,
  onCancel
}: {
  initial?: WorkflowAction
  workspaceId: string
  workflowId: string
  groups: ApplicationGroup[]
  onSave: () => void
  onCancel: () => void
}) {
  const [name, setName] = useState(initial?.name || '')
  const [description, setDescription] = useState(initial?.description || '')
  const [color, setColor] = useState(initial?.color || 'red')
  const [icon, setIcon] = useState(initial?.icon || 'x-circle')
  const [actionType, setActionType] = useState<'move_to_group' | 'move_to_stage' | 'send_email' | 'custom'>(
    initial?.action_type || 'move_to_group'
  )
  const [targetGroupId, setTargetGroupId] = useState(initial?.target_group_id || '')
  const [requiresComment, setRequiresComment] = useState(initial?.requires_comment || false)
  const [isSaving, setIsSaving] = useState(false)

  const colors = [
    { value: 'gray', label: 'Gray', bg: 'bg-gray-500' },
    { value: 'red', label: 'Red', bg: 'bg-red-500' },
    { value: 'orange', label: 'Orange', bg: 'bg-orange-500' },
    { value: 'yellow', label: 'Yellow', bg: 'bg-yellow-500' },
    { value: 'green', label: 'Green', bg: 'bg-green-500' },
    { value: 'blue', label: 'Blue', bg: 'bg-blue-500' },
    { value: 'purple', label: 'Purple', bg: 'bg-purple-500' },
    { value: 'pink', label: 'Pink', bg: 'bg-pink-500' },
  ]

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return
    setIsSaving(true)
    try {
      if (initial?.id) {
        await workflowsClient.updateWorkflowAction(initial.id, {
          name: name.trim(),
          description: description.trim() || undefined,
          color,
          icon,
          action_type: actionType,
          target_group_id: actionType === 'move_to_group' ? targetGroupId || undefined : undefined,
          requires_comment: requiresComment,
        })
      } else {
        await workflowsClient.createWorkflowAction({
          workspace_id: workspaceId,
          review_workflow_id: workflowId,
          name: name.trim(),
          description: description.trim() || undefined,
          color,
          icon,
          action_type: actionType,
          target_group_id: actionType === 'move_to_group' ? targetGroupId || undefined : undefined,
          requires_comment: requiresComment,
          is_system: false,
        })
      }
      onSave()
    } catch (error) {
      console.error('Failed to save workflow action:', error)
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!initial?.id) return
    if (!confirm('Delete this action?')) return
    try {
      await workflowsClient.deleteWorkflowAction(initial.id)
      onSave()
    } catch (error) {
      console.error('Failed to delete workflow action:', error)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-2">
        <Label htmlFor="action-name">Action Name *</Label>
        <Input
          id="action-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g., Reject, Approve, Request More Info"
          autoFocus
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="action-desc">Description</Label>
        <Textarea
          id="action-desc"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="What does this action do?"
          rows={2}
        />
      </div>

      <div className="space-y-2">
        <Label>Button Color</Label>
        <div className="flex gap-2 flex-wrap">
          {colors.map((c) => (
            <button
              key={c.value}
              type="button"
              onClick={() => setColor(c.value)}
              className={cn(
                "w-8 h-8 rounded-lg transition-all",
                c.bg,
                color === c.value ? "ring-2 ring-offset-2 ring-gray-400 scale-110" : "hover:scale-105"
              )}
              title={c.label}
            />
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <Label>Action Type</Label>
        <Select value={actionType} onValueChange={(v: any) => setActionType(v)}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="move_to_group">Move to Group</SelectItem>
            <SelectItem value="move_to_stage">Move to Stage</SelectItem>
            <SelectItem value="send_email">Send Email</SelectItem>
            <SelectItem value="custom">Custom Action</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {actionType === 'move_to_group' && (
        <div className="space-y-2">
          <Label>Target Group</Label>
          <Select value={targetGroupId} onValueChange={setTargetGroupId}>
            <SelectTrigger>
              <SelectValue placeholder="Select target group" />
            </SelectTrigger>
            <SelectContent>
              {groups.map((g) => (
                <SelectItem key={g.id} value={g.id}>
                  {g.name}
                </SelectItem>
              ))}
              {groups.length === 0 && (
                <div className="p-2 text-sm text-gray-500 text-center">
                  No groups created yet
                </div>
              )}
            </SelectContent>
          </Select>
          <p className="text-xs text-gray-500">
            Applications will be moved to this group when this action is used
          </p>
        </div>
      )}

      <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
        <div>
          <Label>Require Comment</Label>
          <p className="text-xs text-gray-500 mt-1">
            Reviewer must provide a comment when using this action
          </p>
        </div>
        <Switch checked={requiresComment} onCheckedChange={setRequiresComment} />
      </div>

      <div className="flex gap-3 pt-4">
        <Button type="button" variant="outline" onClick={onCancel} className="flex-1">
          Cancel
        </Button>
        <Button type="submit" disabled={!name.trim() || isSaving} className="flex-1">
          {isSaving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
          {initial ? 'Save Changes' : 'Create Action'}
        </Button>
      </div>

      {initial && !initial.is_system && (
        <Button 
          type="button" 
          variant="ghost" 
          className="w-full text-red-600 hover:text-red-700 hover:bg-red-50"
          onClick={handleDelete}
        >
          <Trash2 className="w-4 h-4 mr-2" />
          Delete Action
        </Button>
      )}
    </form>
  )
}