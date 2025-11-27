'use client'

import { useState, useEffect, useRef } from 'react'
import { Plus, Trash2, Settings, Save, ChevronRight, Users, FileText, Layers, ArrowLeft, Edit2, X, GripVertical, Check, AlertCircle, Loader2, Sparkles } from 'lucide-react'
import { DndProvider, useDrag, useDrop } from 'react-dnd'
import { HTML5Backend } from 'react-dnd-html5-backend'
import { cn } from '@/lib/utils'
import { workflowsClient, ReviewWorkflow, ApplicationStage, ReviewerType, Rubric, StageReviewerConfig } from '@/lib/api/workflows-client'
import { Button } from '@/ui-components/button'
import { Input } from '@/ui-components/input'
import { Label } from '@/ui-components/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/ui-components/tabs'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/ui-components/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/ui-components/select'
import { Switch } from '@/ui-components/switch'
import { Textarea } from '@/ui-components/textarea'

interface WorkflowBuilderProps {
  workspaceId: string
}

export function WorkflowBuilder({ workspaceId }: WorkflowBuilderProps) {
  const [workflows, setWorkflows] = useState<ReviewWorkflow[]>([])
  const [selectedWorkflow, setSelectedWorkflow] = useState<ReviewWorkflow | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [activeTab, setActiveTab] = useState('stages')
  const [isCreatingWorkflow, setIsCreatingWorkflow] = useState(false)
  const [editingWorkflow, setEditingWorkflow] = useState<ReviewWorkflow | null>(null)

  // Data states
  const [stages, setStages] = useState<ApplicationStage[]>([])
  const [reviewerTypes, setReviewerTypes] = useState<ReviewerType[]>([])
  const [rubrics, setRubrics] = useState<Rubric[]>([])
  const [stageConfigs, setStageConfigs] = useState<StageReviewerConfig[]>([])

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
      setIsCreatingWorkflow(false)
    } catch (error) {
      console.error('Failed to create workflow:', error)
    }
  }

  const handleUpdateWorkflow = async (workflow: ReviewWorkflow, updates: Partial<ReviewWorkflow>) => {
    try {
      const updated = await workflowsClient.updateWorkflow(workflow.id, updates)
      setWorkflows(workflows.map(w => w.id === workflow.id ? updated : w))
      if (selectedWorkflow?.id === workflow.id) {
        setSelectedWorkflow(updated)
      }
      setEditingWorkflow(null)
    } catch (error) {
      console.error('Failed to update workflow:', error)
    }
  }

  if (!selectedWorkflow) {
    return (
      <div className="h-full flex flex-col bg-gradient-to-br from-gray-50 to-white">
        <div className="bg-white border-b border-gray-200 px-8 py-6">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
                <Sparkles className="w-8 h-8 text-blue-600" />
                Review Workflows
              </h1>
              <p className="text-gray-600 mt-2">Design and manage your application review processes</p>
            </div>
            <Button 
              onClick={() => setIsCreatingWorkflow(true)}
              className="bg-blue-600 hover:bg-blue-700 text-white shadow-lg hover:shadow-xl transition-all"
            >
              <Plus className="w-4 h-4 mr-2" />
              New Workflow
            </Button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-8">
          {isCreatingWorkflow ? (
            <CreateWorkflowForm
              onSave={handleCreateWorkflow}
              onCancel={() => setIsCreatingWorkflow(false)}
            />
          ) : (
            <div className="max-w-6xl mx-auto">
              {isLoading ? (
                <div className="flex items-center justify-center h-64">
                  <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
                </div>
              ) : (
                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                  {workflows.map(workflow => (
                    <WorkflowCard
                      key={workflow.id}
                      workflow={workflow}
                      onClick={() => setSelectedWorkflow(workflow)}
                      onEdit={() => setEditingWorkflow(workflow)}
                      onDelete={async () => {
                        if (confirm(`Delete workflow "${workflow.name}"?`)) {
                          try {
                            await workflowsClient.deleteWorkflow(workflow.id)
                            setWorkflows(workflows.filter(w => w.id !== workflow.id))
                          } catch (error) {
                            console.error('Failed to delete workflow:', error)
                          }
                        }
                      }}
                    />
                  ))}
                  
                  {workflows.length === 0 && !isLoading && (
                    <div className="col-span-full text-center py-16 bg-white rounded-xl border-2 border-dashed border-gray-300">
                      <Layers className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                      <h3 className="text-lg font-semibold text-gray-900 mb-2">No workflows yet</h3>
                      <p className="text-gray-500 mb-6">Create your first workflow to start managing application reviews</p>
                      <Button onClick={() => setIsCreatingWorkflow(true)}>
                        <Plus className="w-4 h-4 mr-2" />
                        Create Workflow
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {editingWorkflow && (
          <EditWorkflowForm
            workflow={editingWorkflow}
            onSave={(updates) => handleUpdateWorkflow(editingWorkflow, updates)}
            onCancel={() => setEditingWorkflow(null)}
          />
        )}
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-4">
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={() => setSelectedWorkflow(null)}
            className="hover:bg-gray-100"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
              {selectedWorkflow.name}
              {selectedWorkflow.is_active && (
                <span className="text-xs px-2 py-0.5 bg-green-100 text-green-700 rounded-full font-medium">
                  Active
                </span>
              )}
            </h1>
            <p className="text-sm text-gray-500">{selectedWorkflow.description || 'Workflow Configuration'}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button 
            variant="outline"
            onClick={() => setEditingWorkflow(selectedWorkflow)}
          >
            <Edit2 className="w-4 h-4 mr-2" />
            Edit
          </Button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-hidden">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full flex flex-col">
          <div className="px-6 pt-4 bg-white border-b border-gray-200">
            <TabsList className="bg-transparent">
              <TabsTrigger value="stages" className="flex items-center gap-2 data-[state=active]:bg-blue-50 data-[state=active]:text-blue-700">
                <Layers className="w-4 h-4" />
                Stages
              </TabsTrigger>
              <TabsTrigger value="reviewers" className="flex items-center gap-2 data-[state=active]:bg-blue-50 data-[state=active]:text-blue-700">
                <Users className="w-4 h-4" />
                Reviewer Types
              </TabsTrigger>
              <TabsTrigger value="rubrics" className="flex items-center gap-2 data-[state=active]:bg-blue-50 data-[state=active]:text-blue-700">
                <FileText className="w-4 h-4" />
                Rubrics
              </TabsTrigger>
            </TabsList>
          </div>

          <div className="flex-1 overflow-y-auto p-6">
            <TabsContent value="stages" className="mt-0 space-y-6">
              <StagesEditor 
                workflowId={selectedWorkflow.id} 
                workspaceId={workspaceId}
                stages={stages} 
                reviewerTypes={reviewerTypes}
                rubrics={rubrics}
                onUpdate={fetchWorkflowData} 
              />
            </TabsContent>
            
            <TabsContent value="reviewers" className="mt-0 space-y-6">
              <ReviewerTypesEditor 
                workspaceId={workspaceId}
                types={reviewerTypes}
                onUpdate={fetchWorkflowData}
              />
            </TabsContent>

            <TabsContent value="rubrics" className="mt-0 space-y-6">
              <RubricsEditor 
                workspaceId={workspaceId}
                rubrics={rubrics}
                onUpdate={fetchWorkflowData}
              />
            </TabsContent>
          </div>
        </Tabs>
      </div>

      {editingWorkflow && (
        <EditWorkflowForm
          workflow={editingWorkflow}
          onSave={(updates) => handleUpdateWorkflow(editingWorkflow, updates)}
          onCancel={() => setEditingWorkflow(null)}
        />
      )}
    </div>
  )
}

// Workflow Card Component
function WorkflowCard({ 
  workflow, 
  onClick, 
  onEdit, 
  onDelete 
}: { 
  workflow: ReviewWorkflow
  onClick: () => void
  onEdit: () => void
  onDelete: () => void
}) {
  return (
    <Card 
      className="group hover:shadow-xl transition-all cursor-pointer border-2 hover:border-blue-300 bg-white"
      onClick={onClick}
    >
      <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-3">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <div className="p-2 bg-blue-50 rounded-lg">
              <Layers className="w-5 h-5 text-blue-600" />
            </div>
            <CardTitle className="text-lg font-semibold text-gray-900 group-hover:text-blue-600 transition-colors">
              {workflow.name}
            </CardTitle>
          </div>
          <CardDescription className="line-clamp-2">
            {workflow.description || 'No description provided'}
          </CardDescription>
        </div>
        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={(e) => {
              e.stopPropagation()
              onEdit()
            }}
          >
            <Edit2 className="w-4 h-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-red-500 hover:text-red-600 hover:bg-red-50"
            onClick={(e) => {
              e.stopPropagation()
              onDelete()
            }}
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="flex items-center justify-between">
          <span className={cn(
            "text-xs px-2.5 py-1 rounded-full font-medium",
            workflow.is_active 
              ? "bg-green-100 text-green-700" 
              : "bg-gray-100 text-gray-700"
          )}>
            {workflow.is_active ? 'Active' : 'Inactive'}
          </span>
          <ChevronRight className="w-5 h-5 text-gray-400 group-hover:text-blue-600 transition-colors" />
        </div>
      </CardContent>
    </Card>
  )
}

// Create Workflow Form (Inline, no modal)
function CreateWorkflowForm({ 
  onSave, 
  onCancel 
}: { 
  onSave: (name: string, description?: string) => void
  onCancel: () => void
}) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [isSaving, setIsSaving] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return
    
    setIsSaving(true)
    try {
      await onSave(name.trim(), description.trim() || undefined)
      setName('')
      setDescription('')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Card className="max-w-2xl mx-auto border-2 border-blue-200 bg-white shadow-lg">
      <CardHeader className="bg-gradient-to-r from-blue-50 to-indigo-50 border-b">
        <div className="flex items-center justify-between">
          <CardTitle className="text-xl font-bold text-gray-900">Create New Workflow</CardTitle>
          <Button variant="ghost" size="icon" onClick={onCancel}>
            <X className="w-5 h-5" />
          </Button>
        </div>
        <CardDescription>Define a new review workflow for your applications</CardDescription>
      </CardHeader>
      <CardContent className="pt-6">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="workflow-name" className="text-sm font-semibold">
              Workflow Name <span className="text-red-500">*</span>
            </Label>
            <Input
              id="workflow-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Fall 2024 Scholarship Review"
              className="text-base"
              autoFocus
              required
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="workflow-description" className="text-sm font-semibold">
              Description
            </Label>
            <Textarea
              id="workflow-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe the purpose and scope of this workflow..."
              rows={3}
            />
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <Button type="button" variant="outline" onClick={onCancel}>
              Cancel
            </Button>
            <Button type="submit" disabled={!name.trim() || isSaving} className="bg-blue-600 hover:bg-blue-700">
              {isSaving ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <Check className="w-4 h-4 mr-2" />
                  Create Workflow
                </>
              )}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}

// Edit Workflow Form (Inline overlay)
function EditWorkflowForm({
  workflow,
  onSave,
  onCancel
}: {
  workflow: ReviewWorkflow
  onSave: (updates: Partial<ReviewWorkflow>) => void
  onCancel: () => void
}) {
  const [name, setName] = useState(workflow.name)
  const [description, setDescription] = useState(workflow.description || '')
  const [isActive, setIsActive] = useState(workflow.is_active)
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    setName(workflow.name)
    setDescription(workflow.description || '')
    setIsActive(workflow.is_active)
  }, [workflow])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return
    
    setIsSaving(true)
    try {
      await onSave({
        name: name.trim(),
        description: description.trim() || undefined,
        is_active: isActive
      })
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <Card className="max-w-2xl w-full border-2 border-blue-200 bg-white shadow-2xl">
        <CardHeader className="bg-gradient-to-r from-blue-50 to-indigo-50 border-b">
          <div className="flex items-center justify-between">
            <CardTitle className="text-xl font-bold text-gray-900">Edit Workflow</CardTitle>
            <Button variant="ghost" size="icon" onClick={onCancel}>
              <X className="w-5 h-5" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="pt-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="edit-workflow-name" className="text-sm font-semibold">
                Workflow Name <span className="text-red-500">*</span>
              </Label>
              <Input
                id="edit-workflow-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Fall 2024 Scholarship Review"
                className="text-base"
                required
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="edit-workflow-description" className="text-sm font-semibold">
                Description
              </Label>
              <Textarea
                id="edit-workflow-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe the purpose and scope of this workflow..."
                rows={3}
              />
            </div>

            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
              <div>
                <Label htmlFor="workflow-active" className="text-sm font-semibold">
                  Workflow Status
                </Label>
                <p className="text-xs text-gray-500 mt-1">
                  {isActive ? 'This workflow is currently active' : 'This workflow is inactive'}
                </p>
              </div>
              <Switch
                id="workflow-active"
                checked={isActive}
                onCheckedChange={setIsActive}
              />
            </div>

            <div className="flex justify-end gap-3 pt-4">
              <Button type="button" variant="outline" onClick={onCancel}>
                Cancel
              </Button>
              <Button type="submit" disabled={!name.trim() || isSaving} className="bg-blue-600 hover:bg-blue-700">
                {isSaving ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4 mr-2" />
                    Save Changes
                  </>
                )}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}

// Stages Editor with inline editing and drag-and-drop
function StagesEditor({ 
  workflowId, 
  workspaceId, 
  stages, 
  reviewerTypes,
  rubrics,
  onUpdate 
}: { 
  workflowId: string
  workspaceId: string
  stages: ApplicationStage[]
  reviewerTypes: ReviewerType[]
  rubrics: Rubric[]
  onUpdate: () => void
}) {
  const [isCreating, setIsCreating] = useState(false)
  const [editingStage, setEditingStage] = useState<ApplicationStage | null>(null)
  const [isReordering, setIsReordering] = useState(false)

  const handleAddStage = async (name: string, stageType: string, description?: string) => {
    try {
      await workflowsClient.createStage({
        workspace_id: workspaceId,
        review_workflow_id: workflowId,
        name,
        stage_type: stageType,
        description,
        order_index: stages.length
      })
      onUpdate()
      setIsCreating(false)
    } catch (error) {
      console.error('Failed to create stage:', error)
    }
  }

  const handleUpdateStage = async (stage: ApplicationStage, updates: Partial<ApplicationStage>) => {
    try {
      await workflowsClient.updateStage(stage.id, updates)
      onUpdate()
      setEditingStage(null)
    } catch (error) {
      console.error('Failed to update stage:', error)
    }
  }

  const handleDeleteStage = async (id: string) => {
    if (!confirm('Are you sure? This will delete the stage and all associated data.')) return
    try {
      await workflowsClient.deleteStage(id)
      onUpdate()
    } catch (error) {
      console.error('Failed to delete stage:', error)
    }
  }

  const handleReorderStages = async (draggedId: string, targetId: string) => {
    const sortedStages = [...stages].sort((a, b) => a.order_index - b.order_index)
    const draggedIndex = sortedStages.findIndex(s => s.id === draggedId)
    const targetIndex = sortedStages.findIndex(s => s.id === targetId)

    if (draggedIndex === -1 || targetIndex === -1 || draggedIndex === targetIndex) return

    const newStages = [...sortedStages]
    const [removed] = newStages.splice(draggedIndex, 1)
    newStages.splice(targetIndex, 0, removed)

    // Update order_index for all affected stages
    setIsReordering(true)
    try {
      const updatePromises = newStages.map((stage, index) => 
        workflowsClient.updateStage(stage.id, { order_index: index })
      )
      await Promise.all(updatePromises)
      onUpdate()
    } catch (error) {
      console.error('Failed to reorder stages:', error)
    } finally {
      setIsReordering(false)
    }
  }

  const sortedStages = [...stages].sort((a, b) => a.order_index - b.order_index)

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Workflow Stages</h2>
          <p className="text-sm text-gray-600 mt-1">Define the steps applications will go through in the review process</p>
        </div>
        {!isCreating && (
          <Button onClick={() => setIsCreating(true)} className="bg-blue-600 hover:bg-blue-700">
            <Plus className="w-4 h-4 mr-2" />
            Add Stage
          </Button>
        )}
      </div>

      {isCreating && (
        <CreateStageForm
          onSave={handleAddStage}
          onCancel={() => setIsCreating(false)}
        />
      )}

      <DndProvider backend={HTML5Backend}>
        <div className="relative space-y-4">
          {sortedStages.length > 0 && (
            <div className="absolute left-10 top-4 bottom-4 w-0.5 bg-gradient-to-b from-blue-200 via-blue-300 to-blue-200 -z-10" />
          )}

          {sortedStages.map((stage, index) => (
            <DraggableStageItem
              key={stage.id}
              stage={stage}
              index={index}
              isEditing={editingStage?.id === stage.id}
              reviewerTypes={reviewerTypes}
              rubrics={rubrics}
              onEdit={() => setEditingStage(stage)}
              onDelete={() => handleDeleteStage(stage.id)}
              onUpdate={(updates) => handleUpdateStage(stage, updates)}
              onCancelEdit={() => setEditingStage(null)}
              onReorder={handleReorderStages}
              isReordering={isReordering}
            />
          ))}

          {sortedStages.length === 0 && !isCreating && (
            <div className="text-center py-16 bg-white rounded-xl border-2 border-dashed border-gray-300">
              <Layers className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">No stages defined</h3>
              <p className="text-sm text-gray-500 mb-6">Add a stage to start building your workflow</p>
              <Button onClick={() => setIsCreating(true)}>
                <Plus className="w-4 h-4 mr-2" />
                Add First Stage
              </Button>
            </div>
          )}
        </div>
      </DndProvider>
    </div>
  )
}

// Draggable Stage Item Component
function DraggableStageItem({
  stage,
  index,
  isEditing,
  reviewerTypes,
  rubrics,
  onEdit,
  onDelete,
  onUpdate,
  onCancelEdit,
  onReorder,
  isReordering
}: {
  stage: ApplicationStage
  index: number
  isEditing: boolean
  reviewerTypes: ReviewerType[]
  rubrics: Rubric[]
  onEdit: () => void
  onDelete: () => void
  onUpdate: (updates: Partial<ApplicationStage>) => void
  onCancelEdit: () => void
  onReorder: (draggedId: string, targetId: string) => void
  isReordering: boolean
}) {
  const [{ isDragging }, drag, dragPreview] = useDrag({
    type: 'stage',
    item: { id: stage.id, index },
    collect: (monitor) => ({
      isDragging: monitor.isDragging(),
    }),
  })

  const [{ isOver }, drop] = useDrop({
    accept: 'stage',
    collect: (monitor) => ({
      isOver: monitor.isOver(),
    }),
    drop: (item: { id: string; index: number }) => {
      if (item.id !== stage.id) {
        onReorder(item.id, stage.id)
      }
    },
  })

  const dragRef = (node: HTMLDivElement | null) => {
    drag(drop(node))
    dragPreview(node)
  }

  if (isEditing) {
    return (
      <div className="relative">
        <EditStageForm
          stage={stage}
          reviewerTypes={reviewerTypes}
          rubrics={rubrics}
          onSave={onUpdate}
          onCancel={onCancelEdit}
        />
      </div>
    )
  }

  return (
    <div 
      ref={dragRef}
      className={cn(
        "relative transition-all",
        isDragging && "opacity-50 scale-95",
        isOver && !isDragging && "translate-x-2"
      )}
    >
      <Card className={cn(
        "ml-16 hover:shadow-lg transition-all bg-white border-2 group",
        isDragging ? "border-blue-400 shadow-xl" : "hover:border-blue-300",
        isOver && !isDragging && "border-blue-200 bg-blue-50/30"
      )}>
        <CardHeader className="flex flex-row items-start justify-between py-4">
          <div className="flex items-start gap-4 flex-1">
            <div className={cn(
              "w-12 h-12 rounded-full border-4 border-white shadow-md flex items-center justify-center font-bold text-lg shrink-0 transition-all",
              "bg-gradient-to-br from-blue-500 to-blue-600 text-white",
              isDragging && "scale-110 ring-4 ring-blue-200"
            )}>
              {index + 1}
            </div>
            <div className="flex-1">
              <CardTitle className="text-lg font-semibold text-gray-900 mb-1">{stage.name}</CardTitle>
              <CardDescription className="mb-2">
                {stage.description || 'No description provided'}
              </CardDescription>
              <div className="flex items-center gap-2 mt-2">
                <span className="text-xs px-2.5 py-1 bg-blue-50 text-blue-700 rounded-full font-medium">
                  {stage.stage_type === 'review' ? 'Review Stage' : 'Processing Stage'}
                </span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div 
              className={cn(
                "cursor-grab active:cursor-grabbing p-2 text-gray-400 hover:text-blue-600 transition-colors rounded-md hover:bg-blue-50",
                "opacity-60 hover:opacity-100"
              )}
              title="Drag to reorder stages"
            >
              <GripVertical className="w-5 h-5" />
            </div>
            <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
              <Button variant="ghost" size="sm" onClick={onEdit} disabled={isReordering}>
                <Edit2 className="w-4 h-4 mr-1" />
                Edit
              </Button>
              <Button 
                variant="ghost" 
                size="sm" 
                className="text-red-500 hover:text-red-600 hover:bg-red-50"
                onClick={onDelete}
                disabled={isReordering}
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>
      {isReordering && (
        <div className="absolute inset-0 bg-blue-50/50 rounded-lg flex items-center justify-center z-10">
          <Loader2 className="w-5 h-5 animate-spin text-blue-600" />
        </div>
      )}
    </div>
  )
}

// Create Stage Form
function CreateStageForm({
  onSave,
  onCancel
}: {
  onSave: (name: string, stageType: string, description?: string) => void
  onCancel: () => void
}) {
  const [name, setName] = useState('')
  const [stageType, setStageType] = useState('review')
  const [description, setDescription] = useState('')
  const [isSaving, setIsSaving] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return
    
    setIsSaving(true)
    try {
      await onSave(name.trim(), stageType, description.trim() || undefined)
      setName('')
      setDescription('')
      setStageType('review')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Card className="ml-16 border-2 border-blue-200 bg-gradient-to-br from-blue-50 to-white shadow-lg">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg font-semibold">Create New Stage</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="stage-name">Stage Name <span className="text-red-500">*</span></Label>
            <Input
              id="stage-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Initial Review, Financial Review"
              required
              autoFocus
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="stage-type">Stage Type</Label>
            <Select value={stageType} onValueChange={setStageType}>
              <SelectTrigger id="stage-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="review">Review Stage</SelectItem>
                <SelectItem value="processing">Processing Stage</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="stage-description">Description</Label>
            <Textarea
              id="stage-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe what happens in this stage..."
              rows={2}
            />
          </div>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onCancel} size="sm">
              Cancel
            </Button>
            <Button type="submit" disabled={!name.trim() || isSaving} size="sm" className="bg-blue-600 hover:bg-blue-700">
              {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}

// Edit Stage Form
function EditStageForm({
  stage,
  reviewerTypes,
  rubrics,
  onSave,
  onCancel
}: {
  stage: ApplicationStage
  reviewerTypes: ReviewerType[]
  rubrics: Rubric[]
  onSave: (updates: Partial<ApplicationStage>) => void
  onCancel: () => void
}) {
  const [name, setName] = useState(stage.name)
  const [description, setDescription] = useState(stage.description || '')
  const [stageType, setStageType] = useState(stage.stage_type)
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    setName(stage.name)
    setDescription(stage.description || '')
    setStageType(stage.stage_type)
  }, [stage])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return
    
    setIsSaving(true)
    try {
      await onSave({
        name: name.trim(),
        description: description.trim() || undefined,
        stage_type: stageType
      })
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Card className="ml-16 border-2 border-blue-200 bg-gradient-to-br from-blue-50 to-white shadow-lg">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg font-semibold">Edit Stage</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="edit-stage-name">Stage Name <span className="text-red-500">*</span></Label>
            <Input
              id="edit-stage-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="edit-stage-type">Stage Type</Label>
            <Select value={stageType} onValueChange={setStageType}>
              <SelectTrigger id="edit-stage-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="review">Review Stage</SelectItem>
                <SelectItem value="processing">Processing Stage</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-stage-description">Description</Label>
            <Textarea
              id="edit-stage-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
            />
          </div>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onCancel} size="sm">
              Cancel
            </Button>
            <Button type="submit" disabled={!name.trim() || isSaving} size="sm" className="bg-blue-600 hover:bg-blue-700">
              {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}

// Reviewer Types Editor with inline editing
function ReviewerTypesEditor({ workspaceId, types, onUpdate }: { workspaceId: string, types: ReviewerType[], onUpdate: () => void }) {
  const [isCreating, setIsCreating] = useState(false)
  const [editingType, setEditingType] = useState<ReviewerType | null>(null)

  const handleAddType = async (name: string, description?: string) => {
    try {
      await workflowsClient.createReviewerType({
        workspace_id: workspaceId,
        name,
        description,
        permissions: {}
      })
      onUpdate()
      setIsCreating(false)
    } catch (error) {
      console.error('Failed to create reviewer type:', error)
    }
  }

  const handleUpdateType = async (type: ReviewerType, updates: Partial<ReviewerType>) => {
    try {
      await workflowsClient.updateReviewerType(type.id, updates)
      onUpdate()
      setEditingType(null)
    } catch (error) {
      console.error('Failed to update reviewer type:', error)
    }
  }

  const handleDeleteType = async (id: string) => {
    if (!confirm('Delete this reviewer type?')) return
    try {
      await workflowsClient.deleteReviewerType(id)
      onUpdate()
    } catch (error) {
      console.error('Failed to delete reviewer type:', error)
    }
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Reviewer Roles</h2>
          <p className="text-sm text-gray-600 mt-1">Define roles and permissions for your review team</p>
        </div>
        {!isCreating && (
          <Button onClick={() => setIsCreating(true)} className="bg-blue-600 hover:bg-blue-700">
            <Plus className="w-4 h-4 mr-2" />
            Add Role
          </Button>
        )}
      </div>

      {isCreating && (
        <CreateReviewerTypeForm
          onSave={handleAddType}
          onCancel={() => setIsCreating(false)}
        />
      )}

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {types.map(type => (
          editingType?.id === type.id ? (
            <EditReviewerTypeForm
              key={type.id}
              type={type}
              onSave={(updates) => handleUpdateType(type, updates)}
              onCancel={() => setEditingType(null)}
            />
          ) : (
            <Card key={type.id} className="hover:shadow-lg transition-all bg-white group">
              <CardHeader className="pb-3">
                <div className="flex justify-between items-start mb-2">
                  <div className="p-2 bg-purple-100 text-purple-600 rounded-lg">
                    <Users className="w-5 h-5" />
                  </div>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setEditingType(type)}>
                      <Edit2 className="w-3.5 h-3.5" />
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-7 w-7 text-red-500 hover:text-red-600 hover:bg-red-50"
                      onClick={() => handleDeleteType(type.id)}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
                <CardTitle className="text-base font-semibold">{type.name}</CardTitle>
                <CardDescription className="mt-1">{type.description || 'No description provided'}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-xs text-gray-500 bg-gray-50 p-2 rounded border border-gray-100">
                  {Object.keys(type.permissions || {}).length} permissions configured
                </div>
              </CardContent>
            </Card>
          )
        ))}
        
        {types.length === 0 && !isCreating && (
          <div className="col-span-full text-center py-16 bg-white rounded-xl border-2 border-dashed border-gray-300">
            <Users className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No reviewer roles</h3>
            <p className="text-sm text-gray-500 mb-6">Create roles to assign to your team members</p>
            <Button onClick={() => setIsCreating(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Create First Role
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}

// Create Reviewer Type Form
function CreateReviewerTypeForm({
  onSave,
  onCancel
}: {
  onSave: (name: string, description?: string) => void
  onCancel: () => void
}) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [isSaving, setIsSaving] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return
    
    setIsSaving(true)
    try {
      await onSave(name.trim(), description.trim() || undefined)
      setName('')
      setDescription('')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Card className="col-span-full border-2 border-purple-200 bg-gradient-to-br from-purple-50 to-white shadow-lg">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg font-semibold">Create Reviewer Role</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="reviewer-type-name">Role Name <span className="text-red-500">*</span></Label>
            <Input
              id="reviewer-type-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Financial Reviewer, Academic Reviewer"
              required
              autoFocus
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="reviewer-type-description">Description</Label>
            <Textarea
              id="reviewer-type-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe the responsibilities of this role..."
              rows={2}
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onCancel} size="sm">
              Cancel
            </Button>
            <Button type="submit" disabled={!name.trim() || isSaving} size="sm" className="bg-purple-600 hover:bg-purple-700">
              {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}

// Edit Reviewer Type Form
function EditReviewerTypeForm({
  type,
  onSave,
  onCancel
}: {
  type: ReviewerType
  onSave: (updates: Partial<ReviewerType>) => void
  onCancel: () => void
}) {
  const [name, setName] = useState(type.name)
  const [description, setDescription] = useState(type.description || '')
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    setName(type.name)
    setDescription(type.description || '')
  }, [type])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return
    
    setIsSaving(true)
    try {
      await onSave({
        name: name.trim(),
        description: description.trim() || undefined
      })
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Card className="border-2 border-purple-200 bg-gradient-to-br from-purple-50 to-white shadow-lg">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg font-semibold">Edit Reviewer Role</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="edit-reviewer-type-name">Role Name <span className="text-red-500">*</span></Label>
            <Input
              id="edit-reviewer-type-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-reviewer-type-description">Description</Label>
            <Textarea
              id="edit-reviewer-type-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onCancel} size="sm">
              Cancel
            </Button>
            <Button type="submit" disabled={!name.trim() || isSaving} size="sm" className="bg-purple-600 hover:bg-purple-700">
              {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}

// Rubrics Editor with inline editing
function RubricsEditor({ workspaceId, rubrics, onUpdate }: { workspaceId: string, rubrics: Rubric[], onUpdate: () => void }) {
  const [isCreating, setIsCreating] = useState(false)
  const [editingRubric, setEditingRubric] = useState<Rubric | null>(null)

  const handleAddRubric = async (name: string, maxScore: number, description?: string) => {
    try {
      await workflowsClient.createRubric({
        workspace_id: workspaceId,
        name,
        description,
        max_score: maxScore,
        categories: []
      })
      onUpdate()
      setIsCreating(false)
    } catch (error) {
      console.error('Failed to create rubric:', error)
    }
  }

  const handleUpdateRubric = async (rubric: Rubric, updates: Partial<Rubric>) => {
    try {
      await workflowsClient.updateRubric(rubric.id, updates)
      onUpdate()
      setEditingRubric(null)
    } catch (error) {
      console.error('Failed to update rubric:', error)
    }
  }

  const handleDeleteRubric = async (id: string) => {
    if (!confirm('Delete this rubric?')) return
    try {
      await workflowsClient.deleteRubric(id)
      onUpdate()
    } catch (error) {
      console.error('Failed to delete rubric:', error)
    }
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Scoring Rubrics</h2>
          <p className="text-sm text-gray-600 mt-1">Create standardized scoring criteria for reviewers</p>
        </div>
        {!isCreating && (
          <Button onClick={() => setIsCreating(true)} className="bg-blue-600 hover:bg-blue-700">
            <Plus className="w-4 h-4 mr-2" />
            Add Rubric
          </Button>
        )}
      </div>

      {isCreating && (
        <CreateRubricForm
          onSave={handleAddRubric}
          onCancel={() => setIsCreating(false)}
        />
      )}

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {rubrics.map(rubric => (
          editingRubric?.id === rubric.id ? (
            <EditRubricForm
              key={rubric.id}
              rubric={rubric}
              onSave={(updates) => handleUpdateRubric(rubric, updates)}
              onCancel={() => setEditingRubric(null)}
            />
          ) : (
            <Card key={rubric.id} className="hover:shadow-lg transition-all bg-white group">
              <CardHeader className="pb-3">
                <div className="flex justify-between items-start mb-2">
                  <div className="p-2 bg-green-100 text-green-600 rounded-lg">
                    <FileText className="w-5 h-5" />
                  </div>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setEditingRubric(rubric)}>
                      <Edit2 className="w-3.5 h-3.5" />
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-7 w-7 text-red-500 hover:text-red-600 hover:bg-red-50"
                      onClick={() => handleDeleteRubric(rubric.id)}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
                <CardTitle className="text-base font-semibold">{rubric.name}</CardTitle>
                <CardDescription className="mt-1">
                  Max Score: <span className="font-semibold text-gray-900">{rubric.max_score}</span>
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-xs text-gray-500 bg-gray-50 p-2 rounded border border-gray-100">
                  {Array.isArray(rubric.categories) ? rubric.categories.length : 0} categories
                </div>
              </CardContent>
            </Card>
          )
        ))}

        {rubrics.length === 0 && !isCreating && (
          <div className="col-span-full text-center py-16 bg-white rounded-xl border-2 border-dashed border-gray-300">
            <FileText className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No rubrics defined</h3>
            <p className="text-sm text-gray-500 mb-6">Create rubrics to standardize evaluation</p>
            <Button onClick={() => setIsCreating(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Create First Rubric
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}

// Create Rubric Form
function CreateRubricForm({
  onSave,
  onCancel
}: {
  onSave: (name: string, maxScore: number, description?: string) => void
  onCancel: () => void
}) {
  const [name, setName] = useState('')
  const [maxScore, setMaxScore] = useState(100)
  const [description, setDescription] = useState('')
  const [isSaving, setIsSaving] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return
    
    setIsSaving(true)
    try {
      await onSave(name.trim(), maxScore, description.trim() || undefined)
      setName('')
      setDescription('')
      setMaxScore(100)
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Card className="col-span-full border-2 border-green-200 bg-gradient-to-br from-green-50 to-white shadow-lg">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg font-semibold">Create Scoring Rubric</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="rubric-name">Rubric Name <span className="text-red-500">*</span></Label>
            <Input
              id="rubric-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Academic Excellence Rubric"
              required
              autoFocus
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="rubric-max-score">Max Score</Label>
              <Input
                id="rubric-max-score"
                type="number"
                value={maxScore}
                onChange={(e) => setMaxScore(parseInt(e.target.value) || 100)}
                min={1}
                max={1000}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="rubric-description">Description</Label>
            <Textarea
              id="rubric-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe the purpose of this rubric..."
              rows={2}
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onCancel} size="sm">
              Cancel
            </Button>
            <Button type="submit" disabled={!name.trim() || isSaving} size="sm" className="bg-green-600 hover:bg-green-700">
              {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}

// Edit Rubric Form
function EditRubricForm({
  rubric,
  onSave,
  onCancel
}: {
  rubric: Rubric
  onSave: (updates: Partial<Rubric>) => void
  onCancel: () => void
}) {
  const [name, setName] = useState(rubric.name)
  const [maxScore, setMaxScore] = useState(rubric.max_score)
  const [description, setDescription] = useState(rubric.description || '')
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    setName(rubric.name)
    setMaxScore(rubric.max_score)
    setDescription(rubric.description || '')
  }, [rubric])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return
    
    setIsSaving(true)
    try {
      await onSave({
        name: name.trim(),
        max_score: maxScore,
        description: description.trim() || undefined
      })
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Card className="border-2 border-green-200 bg-gradient-to-br from-green-50 to-white shadow-lg">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg font-semibold">Edit Rubric</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="edit-rubric-name">Rubric Name <span className="text-red-500">*</span></Label>
            <Input
              id="edit-rubric-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="edit-rubric-max-score">Max Score</Label>
              <Input
                id="edit-rubric-max-score"
                type="number"
                value={maxScore}
                onChange={(e) => setMaxScore(parseInt(e.target.value) || 100)}
                min={1}
                max={1000}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-rubric-description">Description</Label>
            <Textarea
              id="edit-rubric-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onCancel} size="sm">
              Cancel
            </Button>
            <Button type="submit" disabled={!name.trim() || isSaving} size="sm" className="bg-green-600 hover:bg-green-700">
              {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
