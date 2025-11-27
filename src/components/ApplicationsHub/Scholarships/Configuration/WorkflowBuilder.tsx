'use client'

import { useState, useEffect } from 'react'
import { Plus, Trash2, Settings, Save, ChevronRight, Users, FileText, Layers, ArrowLeft } from 'lucide-react'
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

  const handleCreateWorkflow = async () => {
    const name = prompt('Enter workflow name:')
    if (!name) return

    try {
      const newWorkflow = await workflowsClient.createWorkflow({
        workspace_id: workspaceId,
        name,
        is_active: true
      })
      setWorkflows([...workflows, newWorkflow])
      setSelectedWorkflow(newWorkflow)
    } catch (error) {
      console.error('Failed to create workflow:', error)
    }
  }

  if (!selectedWorkflow) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Review Workflows</h1>
            <p className="text-gray-500">Manage your application review processes</p>
          </div>
          <Button onClick={handleCreateWorkflow}>
            <Plus className="w-4 h-4 mr-2" />
            New Workflow
          </Button>
        </div>

        <div className="grid gap-4">
          {workflows.map(workflow => (
            <Card key={workflow.id} className="hover:border-blue-300 cursor-pointer transition-colors" onClick={() => setSelectedWorkflow(workflow)}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-lg font-medium">{workflow.name}</CardTitle>
                <ChevronRight className="w-5 h-5 text-gray-400" />
              </CardHeader>
              <CardContent>
                <CardDescription>{workflow.description || 'No description'}</CardDescription>
                <div className="mt-2 flex gap-2">
                  <span className={cn("text-xs px-2 py-1 rounded-full", workflow.is_active ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-700")}>
                    {workflow.is_active ? 'Active' : 'Inactive'}
                  </span>
                </div>
              </CardContent>
            </Card>
          ))}
          {workflows.length === 0 && !isLoading && (
            <div className="text-center py-12 bg-gray-50 rounded-lg border border-dashed border-gray-300">
              <p className="text-gray-500">No workflows found. Create one to get started.</p>
            </div>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => setSelectedWorkflow(null)}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-xl font-bold text-gray-900">{selectedWorkflow.name}</h1>
            <p className="text-sm text-gray-500">Workflow Configuration</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline">
            <Settings className="w-4 h-4 mr-2" />
            Settings
          </Button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-hidden">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full flex flex-col">
          <div className="px-6 pt-4 bg-white border-b border-gray-200">
            <TabsList>
              <TabsTrigger value="stages" className="flex items-center gap-2">
                <Layers className="w-4 h-4" />
                Stages
              </TabsTrigger>
              <TabsTrigger value="reviewers" className="flex items-center gap-2">
                <Users className="w-4 h-4" />
                Reviewer Types
              </TabsTrigger>
              <TabsTrigger value="rubrics" className="flex items-center gap-2">
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
    </div>
  )
}

// Sub-components (can be moved to separate files later)

function StagesEditor({ workflowId, workspaceId, stages, onUpdate }: { workflowId: string, workspaceId: string, stages: ApplicationStage[], onUpdate: () => void }) {
  const handleAddStage = async () => {
    try {
      await workflowsClient.createStage({
        workspace_id: workspaceId,
        review_workflow_id: workflowId,
        name: 'New Stage',
        stage_type: 'review',
        order_index: stages.length
      })
      onUpdate()
    } catch (error) {
      console.error('Failed to create stage:', error)
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

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Workflow Stages</h2>
          <p className="text-sm text-gray-500">Define the steps applications will go through.</p>
        </div>
        <Button onClick={handleAddStage}>
          <Plus className="w-4 h-4 mr-2" />
          Add Stage
        </Button>
      </div>

      <div className="relative space-y-0">
        {/* Vertical Line */}
        {stages.length > 0 && (
          <div className="absolute left-8 top-8 bottom-8 w-0.5 bg-gray-200 -z-10" />
        )}

        {stages.sort((a, b) => a.order_index - b.order_index).map((stage, index) => (
          <div key={stage.id} className="relative flex items-start gap-4 py-4 group">
            <div className={cn(
              "w-16 h-16 rounded-full border-4 border-white shadow-sm flex items-center justify-center font-bold text-lg shrink-0 z-10",
              "bg-blue-50 text-blue-600 ring-1 ring-blue-100"
            )}>
              {index + 1}
            </div>
            
            <Card className="flex-1 hover:shadow-md transition-shadow">
              <CardHeader className="flex flex-row items-start justify-between py-4">
                <div>
                  <CardTitle className="text-base font-semibold text-gray-900">{stage.name}</CardTitle>
                  <CardDescription className="mt-1">{stage.stage_type === 'review' ? 'Review Stage' : 'Processing Stage'}</CardDescription>
                </div>
                <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                    <Settings className="w-4 h-4 text-gray-500" />
                  </Button>
                  <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-red-500 hover:text-red-600 hover:bg-red-50" onClick={() => handleDeleteStage(stage.id)}>
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="pb-4 pt-0">
                <div className="text-sm text-gray-500">
                  Configure reviewers and scoring rules for this stage.
                </div>
              </CardContent>
            </Card>
          </div>
        ))}

        {stages.length === 0 && (
          <div className="text-center py-12 bg-gray-50 rounded-lg border border-dashed border-gray-300">
            <Layers className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <h3 className="text-sm font-medium text-gray-900">No stages defined</h3>
            <p className="text-sm text-gray-500 mt-1">Add a stage to start building your workflow.</p>
          </div>
        )}
      </div>
    </div>
  )
}

function ReviewerTypesEditor({ workspaceId, types, onUpdate }: { workspaceId: string, types: ReviewerType[], onUpdate: () => void }) {
  const handleAddType = async () => {
    const name = prompt('Enter reviewer type name (e.g., "Financial Reviewer"):')
    if (!name) return
    try {
      await workflowsClient.createReviewerType({
        workspace_id: workspaceId,
        name,
        permissions: {}
      })
      onUpdate()
    } catch (error) {
      console.error('Failed to create reviewer type:', error)
    }
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Reviewer Roles</h2>
          <p className="text-sm text-gray-500">Define roles and permissions for your review team.</p>
        </div>
        <Button onClick={handleAddType}>
          <Plus className="w-4 h-4 mr-2" />
          Add Role
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {types.map(type => (
          <Card key={type.id} className="hover:shadow-md transition-shadow">
            <CardHeader className="pb-2">
              <div className="flex justify-between items-start">
                <div className="p-2 bg-purple-100 text-purple-600 rounded-lg mb-2">
                  <Users className="w-5 h-5" />
                </div>
                {/* Add delete handler later */}
              </div>
              <CardTitle className="text-base">{type.name}</CardTitle>
              <CardDescription>{type.description || 'No description provided'}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-xs text-gray-500 bg-gray-50 p-2 rounded border border-gray-100">
                {Object.keys(type.permissions || {}).length} permissions configured
              </div>
            </CardContent>
          </Card>
        ))}
        
        {types.length === 0 && (
          <div className="col-span-2 text-center py-12 bg-gray-50 rounded-lg border border-dashed border-gray-300">
            <Users className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <h3 className="text-sm font-medium text-gray-900">No reviewer roles</h3>
            <p className="text-sm text-gray-500 mt-1">Create roles to assign to your team members.</p>
          </div>
        )}
      </div>
    </div>
  )
}

function RubricsEditor({ workspaceId, rubrics, onUpdate }: { workspaceId: string, rubrics: Rubric[], onUpdate: () => void }) {
  const handleAddRubric = async () => {
    const name = prompt('Enter rubric name:')
    if (!name) return
    try {
      await workflowsClient.createRubric({
        workspace_id: workspaceId,
        name,
        max_score: 100,
        categories: []
      })
      onUpdate()
    } catch (error) {
      console.error('Failed to create rubric:', error)
    }
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Scoring Rubrics</h2>
          <p className="text-sm text-gray-500">Create standardized scoring criteria for reviewers.</p>
        </div>
        <Button onClick={handleAddRubric}>
          <Plus className="w-4 h-4 mr-2" />
          Add Rubric
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {rubrics.map(rubric => (
          <Card key={rubric.id} className="hover:shadow-md transition-shadow">
            <CardHeader className="pb-2">
              <div className="flex justify-between items-start">
                <div className="p-2 bg-green-100 text-green-600 rounded-lg mb-2">
                  <FileText className="w-5 h-5" />
                </div>
              </div>
              <CardTitle className="text-base">{rubric.name}</CardTitle>
              <CardDescription>Max Score: {rubric.max_score}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-xs text-gray-500 bg-gray-50 p-2 rounded border border-gray-100">
                {/* Placeholder for categories count */}
                Standard scoring rubric
              </div>
            </CardContent>
          </Card>
        ))}

        {rubrics.length === 0 && (
          <div className="col-span-2 text-center py-12 bg-gray-50 rounded-lg border border-dashed border-gray-300">
            <FileText className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <h3 className="text-sm font-medium text-gray-900">No rubrics defined</h3>
            <p className="text-sm text-gray-500 mt-1">Create rubrics to standardize evaluation.</p>
          </div>
        )}
      </div>
    </div>
  )
}
