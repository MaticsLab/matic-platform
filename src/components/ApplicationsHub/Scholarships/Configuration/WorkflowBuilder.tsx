'use client'

import { useState, useEffect, useCallback } from 'react'
import { 
  Plus, Trash2, Save, ChevronRight, Users, FileText, Layers, Edit2, X, 
  GripVertical, Check, Loader2, Sparkles, Settings, Award, 
  Link2, Zap, Target, ClipboardList, ChevronDown, CheckCircle, Search
} from 'lucide-react'
import { DndProvider, useDrag, useDrop } from 'react-dnd'
import { HTML5Backend } from 'react-dnd-html5-backend'
import { cn } from '@/lib/utils'
import { workflowsClient, ReviewWorkflow, ApplicationStage, ReviewerType, Rubric, StageReviewerConfig } from '@/lib/api/workflows-client'
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

type ActivePanel = 'none' | 'workflow' | 'stage' | 'reviewer' | 'rubric' | 'stage-config'

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

  useEffect(() => {
    fetchWorkflows()
  }, [workspaceId])

  useEffect(() => {
    if (selectedWorkflow) {
      fetchWorkflowData()
    }
  }, [selectedWorkflow])

  const fetchWorkflows = async () => {
    setIsLoading(true)
    try {
      const data = await workflowsClient.listWorkflows(workspaceId)
      setWorkflows(data)
      // Auto-select first workflow if exists
      if (data.length > 0 && !selectedWorkflow) {
        setSelectedWorkflow(data[0])
      }
    } catch (error) {
      console.error('Failed to fetch workflows:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const fetchWorkflowData = async () => {
    if (!selectedWorkflow) return
    setIsLoading(true)
    try {
      const [stagesData, typesData, rubricsData] = await Promise.all([
        workflowsClient.listStages(workspaceId, selectedWorkflow.id),
        workflowsClient.listReviewerTypes(workspaceId),
        workflowsClient.listRubrics(workspaceId)
      ])
      
      setStages(stagesData)
      setReviewerTypes(typesData)
      setRubrics(rubricsData)

      // Fetch stage configs if we have a selected stage
      if (selectedStageId) {
        const configs = await workflowsClient.listStageConfigs(selectedStageId)
        setStageConfigs(configs)
      }
    } catch (error) {
      console.error('Failed to fetch workflow data:', error)
    } finally {
      setIsLoading(false)
    }
  }

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
      {/* Main Content Area */}
      <div className={cn(
        "flex-1 flex flex-col transition-all duration-300",
        panel.type !== 'none' ? "mr-[420px]" : ""
      )}>
        {/* Header */}
        <div className="bg-white border-b border-gray-200 px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="p-2 bg-gradient-to-br from-violet-500 to-purple-600 rounded-xl shadow-lg shadow-purple-200">
                <Sparkles className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900">Workflow Builder</h1>
                <p className="text-sm text-gray-500">Design review processes for your applications</p>
              </div>
            </div>

            {/* Workflow Selector */}
            <div className="flex items-center gap-3">
              <Select 
                value={selectedWorkflow?.id || ''} 
                onValueChange={(id) => {
                  const wf = workflows.find(w => w.id === id)
                  if (wf) setSelectedWorkflow(wf)
                }}
              >
                <SelectTrigger className="w-[250px] bg-white">
                  <SelectValue placeholder="Select a workflow" />
                </SelectTrigger>
                <SelectContent>
                  {workflows.map(wf => (
                    <SelectItem key={wf.id} value={wf.id}>
                      <div className="flex items-center gap-2">
                        <span>{wf.name}</span>
                        {wf.is_active && (
                          <Badge variant="secondary" className="text-xs bg-green-100 text-green-700">Active</Badge>
                        )}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Button 
                variant="outline"
                onClick={() => setPanel({ type: 'workflow', mode: 'create' })}
              >
                <Plus className="w-4 h-4 mr-2" />
                New
              </Button>

              {selectedWorkflow && (
                <Button 
                  variant="ghost" 
                  size="icon"
                  onClick={() => setPanel({ type: 'workflow', mode: 'edit', data: selectedWorkflow })}
                >
                  <Settings className="w-4 h-4" />
                </Button>
              )}
            </div>
          </div>
        </div>

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
              {/* Quick Stats */}
              <div className="grid grid-cols-4 gap-4">
                <StatCard 
                  icon={Layers} 
                  label="Stages" 
                  value={stages.length} 
                  color="blue"
                  onClick={() => setPanel({ type: 'stage', mode: 'create' })}
                />
                <StatCard 
                  icon={Users} 
                  label="Reviewer Roles" 
                  value={reviewerTypes.length} 
                  color="purple"
                  onClick={() => setPanel({ type: 'reviewer', mode: 'create' })}
                />
                <StatCard 
                  icon={Award} 
                  label="Rubrics" 
                  value={rubrics.length} 
                  color="amber"
                  onClick={() => setPanel({ type: 'rubric', mode: 'create' })}
                />
                <StatCard 
                  icon={Link2} 
                  label="Configurations" 
                  value={stageConfigs.length} 
                  color="green"
                />
              </div>

              {/* Workflow Pipeline */}
              <section>
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h2 className="text-lg font-semibold text-gray-900">Review Pipeline</h2>
                    <p className="text-sm text-gray-500">Applications flow through these stages in order</p>
                  </div>
                  <Button onClick={() => setPanel({ type: 'stage', mode: 'create' })}>
                    <Plus className="w-4 h-4 mr-2" />
                    Add Stage
                  </Button>
                </div>

                <DndProvider backend={HTML5Backend}>
                  <div className="relative">
                    {/* Connection Line */}
                    {sortedStages.length > 0 && (
                      <div className="absolute left-8 top-12 bottom-12 w-0.5 bg-gradient-to-b from-violet-300 via-purple-300 to-violet-300" />
                    )}

                    <div className="space-y-3">
                      {sortedStages.map((stage, index) => (
                        <StageCard
                          key={stage.id}
                          stage={stage}
                          index={index}
                          isSelected={selectedStageId === stage.id}
                          reviewerTypes={reviewerTypes}
                          rubrics={rubrics}
                          onSelect={() => setSelectedStageId(stage.id)}
                          onEdit={() => setPanel({ type: 'stage', mode: 'edit', data: stage })}
                          onDelete={async () => {
                            if (confirm('Delete this stage?')) {
                              await workflowsClient.deleteStage(stage.id)
                              fetchWorkflowData()
                            }
                          }}
                          onConfigureReviewers={() => {
                            setSelectedStageId(stage.id)
                            setPanel({ type: 'stage-config', mode: 'create', data: stage })
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
                        <div className="text-center py-16 bg-white rounded-2xl border-2 border-dashed border-gray-200">
                          <div className="w-16 h-16 bg-violet-50 rounded-full flex items-center justify-center mx-auto mb-4">
                            <Layers className="w-8 h-8 text-violet-400" />
                          </div>
                          <h3 className="text-lg font-semibold text-gray-900 mb-2">No stages yet</h3>
                          <p className="text-gray-500 mb-6 max-w-sm mx-auto">
                            Create stages to define how applications flow through your review process
                          </p>
                          <Button onClick={() => setPanel({ type: 'stage', mode: 'create' })}>
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
                <section className="bg-white rounded-xl border border-gray-200 overflow-hidden">
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
        stageCount={stages.length}
        reviewerTypes={reviewerTypes}
        rubrics={rubrics}
        formSections={formSections}
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
    review: { color: 'blue', label: 'Review', icon: Users },
    processing: { color: 'green', label: 'Processing', icon: Zap },
    decision: { color: 'amber', label: 'Decision', icon: Target }
  }

  const config = stageTypeConfig[stage.stage_type as keyof typeof stageTypeConfig] || stageTypeConfig.review

  return (
    <div
      ref={dragDropRef}
      className={cn(
        "relative group transition-all",
        isDragging && "opacity-50 scale-[0.98]",
        isOver && !isDragging && "translate-x-1"
      )}
    >
      <div className={cn(
        "ml-16 bg-white border-2 rounded-xl overflow-hidden transition-all",
        isSelected ? "border-violet-300 ring-2 ring-violet-100 shadow-lg" : "border-gray-200 hover:border-gray-300 hover:shadow-md",
        isDragging && "border-violet-400"
      )}>
        <div className="flex">
          {/* Stage Number */}
          <div className="w-14 bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center text-white font-bold text-lg shrink-0">
            {index + 1}
          </div>

          {/* Content */}
          <div className="flex-1 p-4">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="font-semibold text-gray-900">{stage.name}</h3>
                  <Badge variant="outline" className={cn(
                    "text-xs",
                    config.color === 'blue' && "border-blue-200 text-blue-700 bg-blue-50",
                    config.color === 'green' && "border-green-200 text-green-700 bg-green-50",
                    config.color === 'amber' && "border-amber-200 text-amber-700 bg-amber-50"
                  )}>
                    {config.label}
                  </Badge>
                </div>
                <p className="text-sm text-gray-500 line-clamp-2">
                  {stage.description || 'No description provided'}
                </p>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity ml-4">
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onEdit}>
                  <Edit2 className="w-4 h-4" />
                </Button>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onConfigureReviewers} title="Configure Reviewers">
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
  stageCount,
  reviewerTypes,
  rubrics,
  formSections,
  onSaveWorkflow,
  onDeleteWorkflow,
  onRefresh
}: {
  panel: PanelState
  onClose: () => void
  workspaceId: string
  workflowId?: string
  stageCount: number
  reviewerTypes: ReviewerType[]
  rubrics: Rubric[]
  formSections: FormSection[]
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
    'stage-config': 'Configure Stage Reviewers'
  }

  return (
    <div className="fixed right-0 top-0 bottom-0 w-[420px] bg-white border-l border-gray-200 shadow-xl z-50 flex flex-col animate-in slide-in-from-right duration-300">
      {/* Panel Header */}
      <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between bg-gray-50">
        <h2 className="text-lg font-semibold text-gray-900">{titles[panel.type]}</h2>
        <Button variant="ghost" size="icon" onClick={onClose}>
          <X className="w-5 h-5" />
        </Button>
      </div>

      {/* Panel Content */}
      <div className="flex-1 overflow-y-auto p-6">
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
  const [startDate, setStartDate] = useState(initial?.start_date?.split('T')[0] || '')
  const [endDate, setEndDate] = useState(initial?.end_date?.split('T')[0] || '')
  const [relativeDeadline, setRelativeDeadline] = useState(initial?.relative_deadline || '')
  const [customStatuses, setCustomStatuses] = useState<string[]>(initial?.custom_statuses || ['Pending', 'In Progress', 'Complete'])
  const [customTags, setCustomTags] = useState<string[]>(initial?.custom_tags || [])
  const [newStatus, setNewStatus] = useState('')
  const [newTag, setNewTag] = useState('')
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [showLogicBuilder, setShowLogicBuilder] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  
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
        start_date: startDate ? new Date(startDate).toISOString() : undefined,
        end_date: endDate ? new Date(endDate).toISOString() : undefined,
        relative_deadline: relativeDeadline && relativeDeadline !== 'none' ? relativeDeadline : undefined,
        custom_statuses: customStatuses.length > 0 ? customStatuses : undefined,
        custom_tags: customTags.length > 0 ? customTags : undefined,
        logic_rules: Object.keys(builtRules).length > 0 ? builtRules : undefined,
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
          </div>
        )}
      </div>

      {/* Logic Builder Section */}
      <div className="border-t pt-4">
        <button
          type="button"
          onClick={() => setShowLogicBuilder(!showLogicBuilder)}
          className="flex items-center gap-2 text-sm font-medium text-gray-700 hover:text-gray-900"
        >
          <ChevronDown className={`w-4 h-4 transition-transform ${showLogicBuilder ? 'rotate-180' : ''}`} />
          <Zap className="w-4 h-4 text-amber-500" />
          Automation Rules
        </button>
        
        {showLogicBuilder && (
          <div className="mt-4 space-y-5">
            {/* Field Picker Modal */}
            {showFieldPicker && (
              <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowFieldPicker(null)}>
                <div className="bg-white rounded-xl shadow-2xl w-[480px] max-h-[70vh] flex flex-col" onClick={e => e.stopPropagation()}>
                  <div className="p-4 border-b border-gray-200">
                    <h3 className="font-semibold text-gray-900 mb-3">Select a Field</h3>
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <input
                        type="text"
                        value={fieldSearchQuery}
                        onChange={e => setFieldSearchQuery(e.target.value)}
                        placeholder="Search fields..."
                        className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        autoFocus
                      />
                    </div>
                  </div>
                  <div className="flex-1 overflow-y-auto p-2">
                    {filteredFieldGroups.length === 0 ? (
                      <div className="p-8 text-center text-gray-500">
                        <Search className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                        <p className="text-sm">No fields match your search</p>
                      </div>
                    ) : (
                      filteredFieldGroups.map(group => (
                        <div key={group.id} className="mb-2">
                          <button
                            type="button"
                            onClick={() => toggleGroup(group.id)}
                            className="w-full flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 rounded-lg"
                          >
                            <ChevronRight className={cn("w-4 h-4 text-gray-400 transition-transform", expandedGroups.includes(group.id) && "rotate-90")} />
                            <span>{group.name}</span>
                            <span className="ml-auto text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">{group.fields.length}</span>
                          </button>
                          {expandedGroups.includes(group.id) && (
                            <div className="ml-6 space-y-1 mt-1">
                              {group.fields.map(field => (
                                <button
                                  key={field.value}
                                  type="button"
                                  onClick={() => selectField(field.value)}
                                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-600 hover:bg-blue-50 hover:text-blue-700 rounded-lg transition-colors"
                                >
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
                  <div className="p-3 border-t border-gray-200 bg-gray-50">
                    <button
                      type="button"
                      onClick={() => setShowFieldPicker(null)}
                      className="w-full py-2 text-sm text-gray-600 hover:text-gray-900"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Auto-Advance Rule */}
            <div className="p-4 bg-green-50 border border-green-200 rounded-xl space-y-3">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 bg-green-500 rounded-full flex items-center justify-center">
                  <ChevronRight className="w-4 h-4 text-white" />
                </div>
                <Label className="text-sm font-medium text-green-800">Auto-Advance Rule</Label>
              </div>
              <p className="text-xs text-green-700">Automatically move applications to the next stage when conditions are met</p>
              
              <div className="bg-white rounded-lg p-3 space-y-3">
                <div className="flex items-center gap-2 text-sm flex-wrap">
                  <span className="text-gray-500 font-medium w-8">IF</span>
                  <button
                    type="button"
                    onClick={() => setShowFieldPicker('advance')}
                    className="px-3 py-1.5 border border-gray-200 rounded-lg hover:border-blue-400 hover:bg-blue-50 transition-colors text-left min-w-[140px] flex items-center gap-2"
                  >
                    <FileText className="w-3.5 h-3.5 text-gray-400" />
                    <span className="truncate">{getFieldLabel(advanceField)}</span>
                    <ChevronDown className="w-3 h-3 text-gray-400 ml-auto" />
                  </button>
                  <Select value={advanceOperator} onValueChange={setAdvanceOperator}>
                    <SelectTrigger className="w-32">
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
                    className="w-24"
                    placeholder="Value"
                  />
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-gray-500 font-medium w-8">THEN</span>
                  <Select value={advanceAction} onValueChange={setAdvanceAction}>
                    <SelectTrigger className="flex-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="move_to_next">Move to next stage</SelectItem>
                      <SelectItem value="set_approved">Set status to Approved</SelectItem>
                      <SelectItem value="complete">Complete workflow</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {/* Auto-Reject Rule */}
            <div className="p-4 bg-red-50 border border-red-200 rounded-xl space-y-3">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 bg-red-500 rounded-full flex items-center justify-center">
                  <X className="w-4 h-4 text-white" />
                </div>
                <Label className="text-sm font-medium text-red-800">Auto-Reject Rule</Label>
              </div>
              <p className="text-xs text-red-700">Automatically reject or flag applications that don't meet requirements</p>
              
              <div className="bg-white rounded-lg p-3 space-y-3">
                <div className="flex items-center gap-2 text-sm flex-wrap">
                  <span className="text-gray-500 font-medium w-8">IF</span>
                  <button
                    type="button"
                    onClick={() => setShowFieldPicker('reject')}
                    className="px-3 py-1.5 border border-gray-200 rounded-lg hover:border-red-400 hover:bg-red-50 transition-colors text-left min-w-[140px] flex items-center gap-2"
                  >
                    <FileText className="w-3.5 h-3.5 text-gray-400" />
                    <span className="truncate">{getFieldLabel(rejectField)}</span>
                    <ChevronDown className="w-3 h-3 text-gray-400 ml-auto" />
                  </button>
                  <Select value={rejectOperator} onValueChange={setRejectOperator}>
                    <SelectTrigger className="w-32">
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
                    className="w-24"
                    placeholder="Value"
                  />
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-gray-500 font-medium w-8">THEN</span>
                  <Select value={rejectAction} onValueChange={setRejectAction}>
                    <SelectTrigger className="flex-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="set_ineligible">Set Ineligible & stop workflow</SelectItem>
                      <SelectItem value="set_declined">Set status to Declined</SelectItem>
                      <SelectItem value="flag_review">Flag for manual review</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {/* Visibility Rule */}
            <div className="p-4 bg-purple-50 border border-purple-200 rounded-xl space-y-3">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 bg-purple-500 rounded-full flex items-center justify-center">
                  <Users className="w-4 h-4 text-white" />
                </div>
                <Label className="text-sm font-medium text-purple-800">Stage Visibility</Label>
              </div>
              <p className="text-xs text-purple-700">Restrict which reviewer types can see this stage</p>
              
              <div className="bg-white rounded-lg p-3">
                {reviewerTypes.length === 0 ? (
                  <p className="text-xs text-gray-500">No reviewer types defined yet. All reviewers will see this stage.</p>
                ) : (
                  <div className="space-y-2">
                    <p className="text-xs text-gray-500 mb-2">Select which reviewer types can access this stage:</p>
                    {reviewerTypes.map(rt => (
                      <label key={rt.id} className="flex items-center gap-2 cursor-pointer">
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
                          className="rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                        />
                        <span className="text-sm text-gray-700">{rt.name}</span>
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
