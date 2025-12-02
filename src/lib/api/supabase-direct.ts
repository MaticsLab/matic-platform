'use client'

/**
 * Supabase Direct Queries
 * 
 * Bypass Go backend for read operations that benefit from lower latency.
 * These queries go directly to Supabase, cutting ~100-200ms off response time.
 * 
 * Use this for:
 * - High-frequency reads (submissions list)
 * - Real-time data that's already subscribed
 * - Simple queries without complex business logic
 * 
 * Continue using Go backend for:
 * - Writes (create, update, delete)
 * - Complex aggregations
 * - Operations requiring business logic validation
 */

import { supabase } from '@/lib/supabase'

export interface DirectSubmission {
  id: string
  form_id: string
  data: Record<string, any>
  metadata: Record<string, any>
  created_at: string
  submitted_at: string
  updated_at: string
}

/**
 * Fetch submissions directly from Supabase
 * ~50-80ms vs ~150-250ms through Go backend
 */
export async function fetchSubmissionsDirect(formId: string): Promise<DirectSubmission[]> {
  console.time('⚡ Direct submissions fetch')
  
  const { data, error } = await supabase
    .from('form_submissions')
    .select('id, form_id, data, metadata, created_at, submitted_at, updated_at')
    .eq('form_id', formId)
    .order('submitted_at', { ascending: false })
  
  console.timeEnd('⚡ Direct submissions fetch')
  
  if (error) {
    console.error('Direct submissions fetch error:', error)
    throw error
  }
  
  return (data || []).map(row => ({
    id: row.id,
    form_id: row.form_id,
    data: typeof row.data === 'string' ? JSON.parse(row.data) : (row.data || {}),
    metadata: typeof row.metadata === 'string' ? JSON.parse(row.metadata) : (row.metadata || {}),
    created_at: row.created_at,
    submitted_at: row.submitted_at || row.created_at,
    updated_at: row.updated_at,
  }))
}

/**
 * Fetch a single submission by ID
 */
export async function fetchSubmissionByIdDirect(submissionId: string): Promise<DirectSubmission | null> {
  const { data, error } = await supabase
    .from('form_submissions')
    .select('id, form_id, data, metadata, created_at, submitted_at, updated_at')
    .eq('id', submissionId)
    .single()
  
  if (error) {
    if (error.code === 'PGRST116') return null // Not found
    throw error
  }
  
  if (!data) return null
  
  return {
    id: data.id,
    form_id: data.form_id,
    data: typeof data.data === 'string' ? JSON.parse(data.data) : (data.data || {}),
    metadata: typeof data.metadata === 'string' ? JSON.parse(data.metadata) : (data.metadata || {}),
    created_at: data.created_at,
    submitted_at: data.submitted_at || data.created_at,
    updated_at: data.updated_at,
  }
}

/**
 * Fetch form basic info directly (for initial render)
 */
export async function fetchFormBasicDirect(formId: string): Promise<{
  id: string
  name: string
  workspace_id: string
  fields: any[]
  settings: any
} | null> {
  console.time('⚡ Direct form fetch')
  
  const { data, error } = await supabase
    .from('forms')
    .select('id, name, workspace_id, fields, settings')
    .eq('id', formId)
    .single()
  
  console.timeEnd('⚡ Direct form fetch')
  
  if (error) {
    if (error.code === 'PGRST116') return null
    throw error
  }
  
  if (!data) return null
  
  return {
    id: data.id,
    name: data.name,
    workspace_id: data.workspace_id,
    fields: typeof data.fields === 'string' ? JSON.parse(data.fields) : (data.fields || []),
    settings: typeof data.settings === 'string' ? JSON.parse(data.settings) : (data.settings || {}),
  }
}

/**
 * Fetch workflow stages directly
 */
export async function fetchStagesDirect(workflowId: string): Promise<any[]> {
  console.time('⚡ Direct stages fetch')
  
  const { data, error } = await supabase
    .from('workflow_stages')
    .select(`
      id,
      name,
      description,
      order_index,
      stage_type,
      review_workflow_id,
      workspace_id,
      color,
      hide_pii,
      hidden_pii_fields,
      created_at,
      updated_at,
      stage_reviewer_configs (
        id,
        stage_id,
        reviewer_type_id,
        rubric_id,
        min_reviews_required,
        allow_self_assignment,
        auto_assign,
        field_visibility_config,
        created_at
      )
    `)
    .eq('review_workflow_id', workflowId)
    .order('order_index', { ascending: true })
  
  console.timeEnd('⚡ Direct stages fetch')
  
  if (error) {
    console.error('Direct stages fetch error:', error)
    throw error
  }
  
  return data || []
}

/**
 * Fetch workflows for a workspace
 */
export async function fetchWorkflowsDirect(workspaceId: string): Promise<any[]> {
  const { data, error } = await supabase
    .from('review_workflows')
    .select('*')
    .eq('workspace_id', workspaceId)
    .order('created_at', { ascending: false })
  
  if (error) {
    console.error('Direct workflows fetch error:', error)
    throw error
  }
  
  return data || []
}

/**
 * Fetch rubrics for a workspace
 */
export async function fetchRubricsDirect(workspaceId: string): Promise<any[]> {
  const { data, error } = await supabase
    .from('rubrics')
    .select('*')
    .eq('workspace_id', workspaceId)
  
  if (error) {
    console.error('Direct rubrics fetch error:', error)
    throw error
  }
  
  return data || []
}

/**
 * Fetch all review workspace data in parallel (direct queries)
 * This is the fast path - bypasses Go backend entirely
 */
export async function fetchReviewWorkspaceDataDirect(
  formId: string,
  workspaceId: string
): Promise<{
  form: any
  submissions: DirectSubmission[]
  workflows: any[]
  stages: any[]
  rubrics: any[]
}> {
  console.time('⚡ Total direct fetch')
  
  // Fetch all data in parallel
  const [form, submissions, workflows, rubrics] = await Promise.all([
    fetchFormBasicDirect(formId),
    fetchSubmissionsDirect(formId),
    fetchWorkflowsDirect(workspaceId),
    fetchRubricsDirect(workspaceId),
  ])
  
  if (!form) {
    throw new Error('Form not found')
  }
  
  // If we have workflows, fetch stages for the active one
  const activeWorkflow = workflows.find(w => w.is_active) || workflows[0]
  let stages: any[] = []
  
  if (activeWorkflow) {
    stages = await fetchStagesDirect(activeWorkflow.id)
  }
  
  console.timeEnd('⚡ Total direct fetch')
  
  return {
    form,
    submissions,
    workflows,
    stages,
    rubrics,
  }
}
