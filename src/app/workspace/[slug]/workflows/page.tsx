'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Plus, Play, MoreHorizontal, Copy, Trash2, Edit2 } from 'lucide-react'
import { toast } from 'sonner'
import { NavigationLayout } from '@/components/NavigationLayout'
import { Button } from '@/ui-components/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/ui-components/card'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/ui-components/dropdown-menu'
import { automationWorkflowsClient, type AutomationWorkflow } from '@/lib/api/automation-workflows-client'
import { workspacesSupabase } from '@/lib/api/workspaces-supabase'
import type { Workspace } from '@/types/workspaces'

export default function WorkflowsPage() {
  const params = useParams()
  const router = useRouter()
  const slug = params.slug as string
  
  const [workspace, setWorkspace] = useState<Workspace | null>(null)
  const [workflows, setWorkflows] = useState<AutomationWorkflow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    loadData()
  }, [slug])

  async function loadData() {
    try {
      setLoading(true)
      // Load workspace first
      const ws = await workspacesSupabase.getWorkspaceBySlug(slug)
      setWorkspace(ws)
      
      // Then load workflows
      const wfs = await automationWorkflowsClient.list(ws.id)
      setWorkflows(wfs)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data')
    } finally {
      setLoading(false)
    }
  }

  async function handleCreateWorkflow() {
    if (!workspace) return
    
    try {
      const workflow = await automationWorkflowsClient.create(workspace.id, {
        name: 'Untitled Workflow',
        nodes: [
          {
            id: 'trigger-1',
            type: 'trigger',
            position: { x: 0, y: 0 },
            data: {
              label: '',
              description: '',
              type: 'trigger',
              config: { triggerType: 'Manual' },
              status: 'idle',
            },
          },
        ],
        edges: [],
      })
      router.push(`/workspace/${slug}/workflows/${workflow.id}`)
    } catch (err) {
      toast.error('Failed to create workflow')
    }
  }

  async function handleDuplicate(workflowId: string) {
    try {
      const workflow = await automationWorkflowsClient.duplicate(workflowId)
      setWorkflows([workflow, ...workflows])
      toast.success('Workflow duplicated')
    } catch (err) {
      toast.error('Failed to duplicate workflow')
    }
  }

  async function handleDelete(workflowId: string) {
    if (!confirm('Are you sure you want to delete this workflow?')) return
    
    try {
      await automationWorkflowsClient.delete(workflowId)
      setWorkflows(workflows.filter(w => w.id !== workflowId))
      toast.success('Workflow deleted')
    } catch (err) {
      toast.error('Failed to delete workflow')
    }
  }

  if (loading) {
    return (
      <NavigationLayout workspaceSlug={slug}>
        <div className="flex items-center justify-center h-full bg-gray-50">
          <div className="text-gray-500">Loading workflows...</div>
        </div>
      </NavigationLayout>
    )
  }

  if (error || !workspace) {
    return (
      <NavigationLayout workspaceSlug={slug}>
        <div className="flex items-center justify-center h-full bg-gray-50">
          <div className="text-center">
            <h1 className="text-2xl font-bold mb-2 text-gray-900">Error</h1>
            <p className="text-gray-600 mb-4">{error || 'Workspace not found'}</p>
          </div>
        </div>
      </NavigationLayout>
    )
  }

  return (
    <NavigationLayout workspaceSlug={slug}>
      <div className="p-6 max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Workflows</h1>
            <p className="text-gray-500 mt-1">
              Automate your processes with visual workflows
            </p>
          </div>
          <Button onClick={handleCreateWorkflow}>
            <Plus className="w-4 h-4 mr-2" />
            New Workflow
          </Button>
        </div>

        {workflows.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-12">
              <div className="rounded-full bg-gray-100 p-3 mb-4">
                <Play className="w-6 h-6 text-gray-400" />
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-1">
                No workflows yet
              </h3>
              <p className="text-gray-500 text-center mb-4 max-w-sm">
                Create your first workflow to automate tasks like sending emails,
                updating records, or connecting to external services.
              </p>
              <Button onClick={handleCreateWorkflow}>
                <Plus className="w-4 h-4 mr-2" />
                Create Workflow
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {workflows.map((workflow) => (
              <Card
                key={workflow.id}
                className="cursor-pointer hover:border-gray-300 transition-colors"
                onClick={() => router.push(`/workspace/${slug}/workflows/${workflow.id}`)}
              >
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <CardTitle className="text-base truncate">
                        {workflow.name}
                      </CardTitle>
                      {workflow.description && (
                        <CardDescription className="mt-1 line-clamp-2">
                          {workflow.description}
                        </CardDescription>
                      )}
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onClick={(e) => {
                            e.stopPropagation()
                            router.push(`/workspace/${slug}/workflows/${workflow.id}`)
                          }}
                        >
                          <Edit2 className="h-4 w-4 mr-2" />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={(e) => {
                            e.stopPropagation()
                            handleDuplicate(workflow.id)
                          }}
                        >
                          <Copy className="h-4 w-4 mr-2" />
                          Duplicate
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          className="text-red-600"
                          onClick={(e) => {
                            e.stopPropagation()
                            handleDelete(workflow.id)
                          }}
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between text-sm text-gray-500">
                    <span className={`px-2 py-0.5 rounded-full text-xs ${
                      workflow.is_active 
                        ? 'bg-green-100 text-green-700' 
                        : 'bg-gray-100 text-gray-600'
                    }`}>
                      {workflow.is_active ? 'Active' : 'Inactive'}
                    </span>
                    <span>
                      {new Date(workflow.updated_at).toLocaleDateString()}
                    </span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </NavigationLayout>
  )
}
