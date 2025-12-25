'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, Plus, Play, MoreHorizontal, Trash2, Edit2, Sparkles, ExternalLink, Workflow } from 'lucide-react'
import { Button } from '@/ui-components/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/ui-components/card'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/ui-components/dropdown-menu'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import { automationWorkflowsClient, type AutomationWorkflow } from '@/lib/api/automation-workflows-client'

interface VisualWorkflowBuilderProps {
  workspaceId: string
  formId?: string | null
  className?: string
}

export function VisualWorkflowBuilder({ workspaceId, formId, className }: VisualWorkflowBuilderProps) {
  const router = useRouter()
  const [workflows, setWorkflows] = useState<AutomationWorkflow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    loadWorkflows()
  }, [workspaceId])

  async function loadWorkflows() {
    try {
      setLoading(true)
      const wfs = await automationWorkflowsClient.list(workspaceId)
      // Filter by formId if provided
      const filteredWorkflows = formId 
        ? wfs.filter(w => w.trigger_type === 'form_submission' || !w.trigger_type)
        : wfs
      setWorkflows(filteredWorkflows)
    } catch (err) {
      console.error('Failed to load workflows:', err)
      setError(err instanceof Error ? err.message : 'Failed to load workflows')
    } finally {
      setLoading(false)
    }
  }

  async function handleCreateWorkflow() {
    try {
      const workflow = await automationWorkflowsClient.create(workspaceId, {
        name: formId ? 'Form Submission Workflow' : 'Untitled Workflow',
        trigger_type: formId ? 'form_submission' : 'manual',
        nodes: [
          {
            id: 'trigger-1',
            type: 'trigger',
            position: { x: 250, y: 100 },
            data: {
              label: formId ? 'Form Submitted' : 'Manual Trigger',
              type: formId ? 'form_submission' : 'manual',
              config: formId ? { formId } : {},
            },
          },
        ],
        edges: [],
      })
      
      // Navigate to the workflow editor
      router.push(`/workspace/${workspaceId}/workflows/${workflow.id}`)
    } catch (err) {
      toast.error('Failed to create workflow')
    }
  }

  async function handleDeleteWorkflow(workflowId: string) {
    if (!confirm('Are you sure you want to delete this workflow?')) return
    
    try {
      await automationWorkflowsClient.delete(workflowId)
      setWorkflows(workflows.filter(w => w.id !== workflowId))
      toast.success('Workflow deleted')
    } catch (err) {
      toast.error('Failed to delete workflow')
    }
  }

  function handleEditWorkflow(workflowId: string) {
    router.push(`/workspace/${workspaceId}/workflows/${workflowId}`)
  }

  function openFullWorkflowsPage() {
    router.push(`/workspace/${workspaceId}/workflows`)
  }

  if (loading) {
    return (
      <div className={cn("flex items-center justify-center h-full bg-gray-50", className)}>
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
          <p className="text-gray-500">Loading workflows...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className={cn("flex flex-col items-center justify-center h-full bg-gray-50 p-8", className)}>
        <Workflow className="w-12 h-12 text-gray-400 mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">Unable to Load Workflows</h3>
        <p className="text-gray-500 text-center mb-4 max-w-md">{error}</p>
        <Button variant="outline" onClick={loadWorkflows}>
          Try Again
        </Button>
      </div>
    )
  }

  return (
    <div className={cn("h-full bg-gray-50 overflow-auto", className)}>
      <div className="p-6 max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">
              {formId ? 'Form Automations' : 'Automation Workflows'}
            </h2>
            <p className="text-sm text-gray-500 mt-1">
              {formId 
                ? 'Create workflows that trigger when this form is submitted'
                : 'Build visual automations to streamline your processes'
              }
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={openFullWorkflowsPage}>
              <ExternalLink className="w-4 h-4 mr-2" />
              All Workflows
            </Button>
            <Button onClick={handleCreateWorkflow}>
              <Plus className="w-4 h-4 mr-2" />
              New Workflow
            </Button>
          </div>
        </div>

        {/* Workflows List */}
        {workflows.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-12">
              <div className="rounded-full bg-indigo-100 p-3 mb-4">
                <Sparkles className="w-8 h-8 text-indigo-600" />
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                No workflows yet
              </h3>
              <p className="text-gray-500 text-center mb-6 max-w-sm">
                {formId 
                  ? 'Create your first automation to run when this form is submitted'
                  : 'Create your first visual workflow to automate your processes'
                }
              </p>
              <Button onClick={handleCreateWorkflow}>
                <Plus className="w-4 h-4 mr-2" />
                Create Your First Workflow
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4">
            {workflows.map((workflow) => (
              <Card 
                key={workflow.id} 
                className="hover:shadow-md transition-shadow cursor-pointer"
                onClick={() => handleEditWorkflow(workflow.id)}
              >
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <CardTitle className="text-base flex items-center gap-2">
                        <Workflow className="w-4 h-4 text-indigo-500" />
                        {workflow.name}
                      </CardTitle>
                      <CardDescription className="mt-1">
                        {workflow.description || `Trigger: ${workflow.trigger_type || 'manual'}`}
                      </CardDescription>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                        <Button variant="ghost" size="sm">
                          <MoreHorizontal className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={(e) => {
                          e.stopPropagation()
                          handleEditWorkflow(workflow.id)
                        }}>
                          <Edit2 className="w-4 h-4 mr-2" />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem 
                          className="text-red-600"
                          onClick={(e) => {
                            e.stopPropagation()
                            handleDeleteWorkflow(workflow.id)
                          }}
                        >
                          <Trash2 className="w-4 h-4 mr-2" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="flex items-center gap-4 text-sm text-gray-500">
                    <span className={cn(
                      "inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium",
                      workflow.is_active 
                        ? "bg-green-100 text-green-700" 
                        : "bg-gray-100 text-gray-600"
                    )}>
                      {workflow.is_active ? 'Active' : 'Inactive'}
                    </span>
                    <span>
                      {workflow.nodes?.length || 0} nodes
                    </span>
                    <span>
                      Updated {new Date(workflow.updated_at).toLocaleDateString()}
                    </span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
