'use client'

import { useState, useEffect, useCallback } from 'react'
import { 
  Plus, Trash2, Save, ChevronRight, Users, FileText, Layers, Edit2, X, 
  GripVertical, Check, Loader2, Sparkles, Settings, Award, 
  Link2, Zap, Target, ClipboardList
} from 'lucide-react'
import { DndProvider, useDrag, useDrop } from 'react-dnd'
import { HTML5Backend } from 'react-dnd-html5-backend'
import { cn } from '@/lib/utils'
import { workflowsClient, ReviewWorkflow, ApplicationStage, ReviewerType, Rubric, StageReviewerConfig } from '@/lib/api/workflows-client'
import { Button } from '@/ui-components/button'
import { Input } from '@/ui-components/input'
import { Label } from '@/ui-components/label'
import { Card } from '@/ui-components/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/ui-components/select'
import { Switch } from '@/ui-components/switch'
import { Textarea } from '@/ui-components/textarea'
import { Badge } from '@/ui-components/badge'
import { showToast } from '@/lib/toast'

interface WorkflowBuilderProps {
  workspaceId: string
}

type ActivePanel = 'none' | 'workflow' | 'stage' | 'reviewer' | 'rubric' | 'stage-config'

interface PanelState {
  type: ActivePanel
  mode: 'create' | 'edit'
  data?: any
}

export function WorkflowBuilder({ workspaceId }: WorkflowBuilderProps) {
  const [workflows, setWorkflows] = useState<ReviewWorkflow[]>([])
  const [selectedWorkflow, setSelectedWorkflow] = useState<ReviewWorkflow | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  // Data states
  const [stages, setStages] = useState<ApplicationStage[]>([])
  const [reviewerTypes, setReviewerTypes] = useState<ReviewerType[]>([])
  const [rubrics, setRubrics] = useState<Rubric[]>([])
  const [stageConfigs, setStageConfigs] = useState<StageReviewerConfig[]>([])

  // Panel state for side-panel editing (no modals)
  const [panel, setPanel] = useState<PanelState>({ type: 'none', mode: 'create' })
  
  // Selected stage for configuration
  const [selectedStageId, setSelectedStageId] = useState<string | null>(null)

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

  const handleCreateWorkflow = async (name: string, description?: string) => {
    try {
      const newWorkflow = await workflowsClient.createWorkflow({
        workspace_id: workspaceId,
        name,
        description,
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
        onSaveWorkflow={panel.mode === 'create' ? handleCreateWorkflow : 
          (name, desc) => handleUpdateWorkflow(panel.data?.id, { name, description: desc, is_active: panel.data?.is_active })}
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
  onSaveWorkflow: (name: string, description?: string) => void
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
  onSave,
  onDelete,
  onCancel
}: {
  initial?: ReviewWorkflow
  onSave: (name: string, description?: string) => void
  onDelete?: () => void
  onCancel: () => void
}) {
  const [name, setName] = useState(initial?.name || '')
  const [description, setDescription] = useState(initial?.description || '')
  const [isActive, setIsActive] = useState(initial?.is_active ?? true)
  const [isSaving, setIsSaving] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return
    setIsSaving(true)
    try {
      await onSave(name.trim(), description.trim() || undefined)
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
  onSave,
  onCancel
}: {
  initial?: ApplicationStage
  workspaceId: string
  workflowId: string
  stageCount: number
  reviewerTypes: ReviewerType[]
  rubrics: Rubric[]
  onSave: () => void
  onCancel: () => void
}) {
  const [name, setName] = useState(initial?.name || '')
  const [description, setDescription] = useState(initial?.description || '')
  const [stageType, setStageType] = useState(initial?.stage_type || 'review')
  const [isSaving, setIsSaving] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return
    setIsSaving(true)
    try {
      if (initial) {
        await workflowsClient.updateStage(initial.id, {
          name: name.trim(),
          description: description.trim() || undefined,
          stage_type: stageType
        })
        showToast('Stage updated successfully', 'success')
      } else {
        await workflowsClient.createStage({
          workspace_id: workspaceId,
          review_workflow_id: workflowId,
          name: name.trim(),
          description: description.trim() || undefined,
          stage_type: stageType,
          order_index: stageCount
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
          </SelectContent>
        </Select>
        <p className="text-xs text-gray-500">
          {stageType === 'review' 
            ? 'Human reviewers evaluate applications' 
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
  const [isSaving, setIsSaving] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return
    setIsSaving(true)
    try {
      if (initial) {
        await workflowsClient.updateReviewerType(initial.id, {
          name: name.trim(),
          description: description.trim() || undefined
        })
        showToast('Reviewer type updated successfully', 'success')
      } else {
        await workflowsClient.createReviewerType({
          workspace_id: workspaceId,
          name: name.trim(),
          description: description.trim() || undefined,
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
  const [maxScore, setMaxScore] = useState(initial?.max_score || 100)
  const [categories, setCategories] = useState<any[]>(
    Array.isArray(initial?.categories) ? initial.categories : []
  )
  const [isSaving, setIsSaving] = useState(false)

  const addCategory = () => {
    setCategories([...categories, { id: Date.now().toString(), name: '', points: 10, description: '' }])
  }

  const updateCategory = (index: number, field: string, value: any) => {
    const updated = [...categories]
    updated[index] = { ...updated[index], [field]: value }
    setCategories(updated)
  }

  const removeCategory = (index: number) => {
    setCategories(categories.filter((_, i) => i !== index))
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
        categories: categories.filter(c => c.name.trim())
      }
      
      if (initial) {
        await workflowsClient.updateRubric(initial.id, data)
        showToast('Rubric updated successfully', 'success')
      } else {
        await workflowsClient.createRubric({
          workspace_id: workspaceId,
          ...data
        })
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
      <div className="space-y-2">
        <Label htmlFor="rb-name">Rubric Name *</Label>
        <Input
          id="rb-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g., Academic Excellence Rubric"
          autoFocus
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="rb-desc">Description</Label>
        <Textarea
          id="rb-desc"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="What does this rubric evaluate?"
          rows={2}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="rb-max">Maximum Score</Label>
        <Input
          id="rb-max"
          type="number"
          value={maxScore}
          onChange={(e) => setMaxScore(parseInt(e.target.value) || 100)}
          min={1}
        />
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label>Scoring Categories</Label>
          <Button type="button" variant="outline" size="sm" onClick={addCategory}>
            <Plus className="w-3 h-3 mr-1" />
            Add Category
          </Button>
        </div>
        
        <div className="space-y-2">
          {categories.map((cat, idx) => (
            <div key={cat.id} className="flex gap-2 items-start p-3 bg-gray-50 rounded-lg">
              <div className="flex-1 space-y-2">
                <Input
                  value={cat.name}
                  onChange={(e) => updateCategory(idx, 'name', e.target.value)}
                  placeholder="Category name"
                  className="text-sm"
                />
                <div className="flex gap-2">
                  <Input
                    type="number"
                    value={cat.points}
                    onChange={(e) => updateCategory(idx, 'points', parseInt(e.target.value) || 0)}
                    className="w-20 text-sm"
                    placeholder="Points"
                  />
                  <Input
                    value={cat.description || ''}
                    onChange={(e) => updateCategory(idx, 'description', e.target.value)}
                    placeholder="Description (optional)"
                    className="flex-1 text-sm"
                  />
                </div>
              </div>
              <Button 
                type="button" 
                variant="ghost" 
                size="icon" 
                className="h-8 w-8 text-gray-400 hover:text-red-500"
                onClick={() => removeCategory(idx)}
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          ))}
          
          {categories.length === 0 && (
            <p className="text-sm text-gray-500 text-center py-4">
              No categories yet. Add categories to define scoring criteria.
            </p>
          )}
        </div>
      </div>

      <div className="flex gap-3 pt-4">
        <Button type="button" variant="outline" onClick={onCancel} className="flex-1">
          Cancel
        </Button>
        <Button type="submit" disabled={!name.trim() || isSaving} className="flex-1">
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
  onSave,
  onCancel
}: {
  stage: ApplicationStage
  reviewerTypes: ReviewerType[]
  rubrics: Rubric[]
  onSave: () => void
  onCancel: () => void
}) {
  const [configs, setConfigs] = useState<Partial<StageReviewerConfig>[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)

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
    setConfigs([...configs, {
      stage_id: stage.id,
      reviewer_type_id: reviewerTypes[0]?.id || '',
      rubric_id: undefined,
      visibility_config: {},
      min_reviews_required: 1
    }])
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

  return (
    <div className="space-y-6">
      <div className="p-4 bg-violet-50 rounded-lg border border-violet-100">
        <h3 className="font-semibold text-violet-900">{stage.name}</h3>
        <p className="text-sm text-violet-700 mt-1">
          Configure which reviewer roles participate in this stage and what rubric they use.
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

        {configs.map((config, idx) => (
          <div key={config.id || idx} className="p-4 bg-gray-50 rounded-lg border border-gray-200 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-700">Reviewer #{idx + 1}</span>
              <Button 
                variant="ghost" 
                size="icon" 
                className="h-6 w-6 text-gray-400 hover:text-red-500"
                onClick={() => removeConfig(idx, config.id)}
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
            
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

            <Select 
              value={config.rubric_id || 'none'} 
              onValueChange={(val) => updateConfig(idx, 'rubric_id', val === 'none' ? undefined : val)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select rubric (optional)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No rubric</SelectItem>
                {rubrics.map(rb => (
                  <SelectItem key={rb.id} value={rb.id}>{rb.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ))}

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
