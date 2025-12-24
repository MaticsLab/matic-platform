/**
 * Automation Workflows API Client
 * Client for interacting with the automation workflows endpoints
 */

import { goFetch } from './go-client'

// Types
export type WorkflowVisibility = 'private' | 'public' | 'workspace'

export type TriggerType = 
  | 'manual' 
  | 'webhook' 
  | 'schedule' 
  | 'form_submission' 
  | 'row_created' 
  | 'row_updated'

export interface WorkflowNode {
  id: string
  type: string
  position: { x: number; y: number }
  data: {
    label?: string
    description?: string
    type?: string
    config?: Record<string, unknown>
    status?: string
    [key: string]: unknown
  }
}

export interface WorkflowEdge {
  id: string
  source: string
  target: string
  sourceHandle?: string
  targetHandle?: string
}

export interface AutomationWorkflow {
  id: string
  name: string
  description: string
  workspace_id: string
  user_id: string
  nodes: WorkflowNode[]
  edges: WorkflowEdge[]
  visibility: WorkflowVisibility
  trigger_type: TriggerType
  is_active: boolean
  is_owner: boolean
  created_at: string
  updated_at: string
}

export interface WorkflowExecution {
  id: string
  workflow_id: string
  user_id?: string
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled'
  trigger_type: string
  trigger_data?: Record<string, unknown>
  output?: Record<string, unknown>
  error?: string
  started_at?: string
  completed_at?: string
  duration?: number
  created_at: string
  updated_at: string
}

export interface WorkflowExecutionLog {
  id: string
  execution_id: string
  node_id: string
  node_type: string
  node_label: string
  status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped'
  input?: Record<string, unknown>
  output?: Record<string, unknown>
  error?: string
  started_at?: string
  completed_at?: string
  duration?: number
  created_at: string
}

export interface CreateWorkflowRequest {
  name: string
  description?: string
  nodes: WorkflowNode[]
  edges: WorkflowEdge[]
  trigger_type?: TriggerType
  visibility?: WorkflowVisibility
}

export interface UpdateWorkflowRequest {
  name?: string
  description?: string
  nodes?: WorkflowNode[]
  edges?: WorkflowEdge[]
  trigger_type?: TriggerType
  visibility?: WorkflowVisibility
  is_active?: boolean
}

/**
 * Automation Workflows API Client
 */
export const automationWorkflowsClient = {
  /**
   * List all automation workflows for a workspace
   */
  list: (workspaceId: string) =>
    goFetch<AutomationWorkflow[]>(`/automation-workflows?workspace_id=${workspaceId}`),

  /**
   * Get a single automation workflow by ID
   */
  get: (workflowId: string) =>
    goFetch<AutomationWorkflow>(`/automation-workflows/${workflowId}`),

  /**
   * Create a new automation workflow
   */
  create: (workspaceId: string, data: CreateWorkflowRequest) =>
    goFetch<AutomationWorkflow>(`/automation-workflows?workspace_id=${workspaceId}`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  /**
   * Update an existing automation workflow
   */
  update: (workflowId: string, data: UpdateWorkflowRequest) =>
    goFetch<AutomationWorkflow>(`/automation-workflows/${workflowId}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  /**
   * Delete an automation workflow
   */
  delete: (workflowId: string) =>
    goFetch<{ message: string }>(`/automation-workflows/${workflowId}`, {
      method: 'DELETE',
    }),

  /**
   * Duplicate an automation workflow
   */
  duplicate: (workflowId: string) =>
    goFetch<AutomationWorkflow>(`/automation-workflows/${workflowId}/duplicate`, {
      method: 'POST',
    }),

  /**
   * Get execution history for a workflow
   */
  getExecutions: (workflowId: string) =>
    goFetch<WorkflowExecution[]>(`/automation-workflows/${workflowId}/executions`),

  /**
   * Get logs for a specific execution
   */
  getExecutionLogs: (workflowId: string, executionId: string) =>
    goFetch<WorkflowExecutionLog[]>(
      `/automation-workflows/${workflowId}/executions/${executionId}/logs`
    ),
}
