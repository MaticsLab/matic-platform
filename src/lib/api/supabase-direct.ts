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
    .select('id, form_id, metadata, created_at, submitted_at, updated_at')
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
    .select('id, form_id, metadata, created_at, submitted_at, updated_at')
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
    metadata: typeof data.metadata === 'string' ? JSON.parse(data.metadata) : (data.metadata || {}),
    created_at: data.created_at,
    submitted_at: data.submitted_at || data.created_at,
    updated_at: data.updated_at,
  }
}

// Fetch all field responses for a submission
export async function fetchFormResponsesBySubmissionId(submissionId: string): Promise<Record<string, any>> {
  const { data, error } = await supabase
    .from('form_responses')
    .select('field_id, value_text, value_number, value_date, value_json')
    .eq('submission_id', submissionId)
  if (error) throw error
  const responses: Record<string, any> = {}
  for (const row of data || []) {
    // Prefer value_text, then number, date, json
    responses[row.field_id] = row.value_text ?? row.value_number ?? row.value_date ?? row.value_json ?? null
  }
  return responses
}

/**
 * Fetch submissions WITH full form_responses data
 * This is the complete data needed for the review workspace grid
 * Handles both unified schema (form_submissions) and legacy (table_rows)
 */
export async function fetchSubmissionsWithResponsesDirect(formId: string): Promise<any[]> {
  const timerId = `fetch-subs-${Date.now()}`
  console.time(timerId)
  
  console.log('🔍 Fetching submissions for form:', formId)
  
  // Step 1: Try unified schema first - Get all form_submissions
  const { data: submissions, error: subError } = await supabase
    .from('form_submissions')
    .select(`
      id,
      form_id,
      user_id,
      raw_data,
      status,
      created_at,
      submitted_at,
      updated_at
    `)
    .eq('form_id', formId)
    .order('submitted_at', { ascending: false })
  
  // If no submissions in unified schema, try legacy table_rows
  if ((subError || !submissions || submissions.length === 0)) {
    console.log('⚠️ No submissions in form_submissions, trying legacy table_rows...')
    
    const { data: legacyRows, error: legacyError } = await supabase
      .from('table_rows')
      .select('id, table_id, ba_created_by, data, created_at, updated_at')
      .eq('table_id', formId)
      .order('created_at', { ascending: false })
    
    if (legacyError) {
      console.error('❌ Error fetching legacy table_rows:', {
        message: legacyError.message,
        details: legacyError.details,
        hint: legacyError.hint,
        code: legacyError.code,
      })
      throw new Error(`Failed to fetch submissions: ${legacyError.message}`)
    }
    
    if (!legacyRows || legacyRows.length === 0) {
      console.log('⚠️ No submissions found in legacy table_rows either')
      console.timeEnd(timerId)
      return []
    }
    
    console.log(`📊 Found ${legacyRows.length} legacy submissions`)
    
    // Get user info - legacy uses ba_created_by (text) not user_id
    const userIds = legacyRows.map(r => r.ba_created_by).filter(Boolean)
    let usersMap: Record<string, any> = {}
    
    if (userIds.length > 0) {
      const { data: users } = await supabase
        .from('ba_users')
        .select('id, name, email')
        .in('id', userIds)
      
      if (users) {
        usersMap = Object.fromEntries(users.map(u => [u.id, u]))
      }
    }
    
    // Transform legacy rows to expected format
    const result = legacyRows.map(row => {
      const user = usersMap[row.ba_created_by || '']
      const data = typeof row.data === 'string' ? JSON.parse(row.data) : (row.data || {})
      
      return {
        id: row.id,
        form_id: row.table_id,
        user_id: row.ba_created_by, // Legacy uses ba_created_by
        status: 'submitted',
        created_at: row.created_at,
        submitted_at: row.created_at,
        updated_at: row.updated_at,
        raw_data: data,
        data, // For legacy, data column already contains everything
        applicant_name: user?.name || null,
        applicant_email: user?.email || null,
      }
    })
    
    console.log(`✅ Built ${result.length} legacy submissions`)
    console.timeEnd(timerId)
    return result
  }
  
  // Handle unified schema submissions
  if (subError) {
    const err = subError as any
    console.error('❌ Error fetching submissions:', {
      message: err.message,
      details: err.details,
      hint: err.hint,
      code: err.code,
    })
    throw new Error(`Failed to fetch submissions: ${err.message}`)
  }
  
  if (!submissions || submissions.length === 0) {
    console.log('⚠️ No submissions found for this form')
    console.timeEnd(timerId)
    return []
  }
  
  console.log(`📊 Found ${submissions.length} submissions, fetching responses...`)
  
  // Step 2: Get all form_responses for these submissions
  const submissionIds = submissions.map(s => s.id)
  const { data: responses, error: respError } = await supabase
    .from('form_responses')
    .select('submission_id, field_id, value_text, value_number, value_date, value_json')
    .in('submission_id', submissionIds)
  
  if (respError) {
    console.error('❌ Error fetching form_responses:', {
      message: respError.message,
      details: respError.details,
      hint: respError.hint,
      code: respError.code,
    })
    throw new Error(`Failed to fetch form responses: ${respError.message}`)
  }
  
  console.log(`📊 Found ${responses?.length || 0} form_responses`)
  
  // Step 3: Get user info for all submissions
  const userIds = submissions.map(s => s.user_id).filter(Boolean)
  let usersMap: Record<string, any> = {}
  
  if (userIds.length > 0) {
    const { data: users, error: userError } = await supabase
      .from('ba_users')
      .select('id, name, email')
      .in('id', userIds)
    
    if (!userError && users) {
      usersMap = Object.fromEntries(users.map(u => [u.id, u]))
    }
  }
  
  // Step 4: Build a map of submission_id -> responses
  const responsesMap: Record<string, Record<string, any>> = {}
  for (const resp of responses || []) {
    if (!responsesMap[resp.submission_id]) {
      responsesMap[resp.submission_id] = {}
    }
    // Use field_id as the key, pick the first non-null value
    const value = resp.value_text ?? resp.value_number ?? resp.value_date ?? resp.value_json ?? null
    responsesMap[resp.submission_id][resp.field_id] = value
  }
  
  // Step 5: Combine submissions with their responses
  const result = submissions.map(sub => {
    const user = usersMap[sub.user_id || '']
    const data = responsesMap[sub.id] || {}
    
    return {
      id: sub.id,
      form_id: sub.form_id,
      user_id: sub.user_id,
      status: sub.status || 'draft',
      created_at: sub.created_at,
      submitted_at: sub.submitted_at || sub.created_at,
      updated_at: sub.updated_at,
      raw_data: typeof sub.raw_data === 'string' ? JSON.parse(sub.raw_data) : (sub.raw_data || {}),
      data, // This is the form_responses aggregated by field_id
      applicant_name: user?.name || null,
      applicant_email: user?.email || null,
    }
  })
  
  console.log(`✅ Built ${result.length} submissions with responses`)
  console.log('Sample first submission data keys:', result[0] ? Object.keys(result[0].data).length : 0)
  if (result[0]) {
    console.log('Sample first submission data:', result[0].data)
  }
  
  console.timeEnd(timerId)
  return result
}

/**
 * Fetch form basic info directly (for initial render)
 * In unified schema, fields are stored in form_fields table, not as JSONB
 * Falls back to legacy data_tables if form not found in forms table
 */
export async function fetchFormBasicDirect(formId: string): Promise<{
  id: string
  name: string
  workspace_id: string
  fields: any[]
  settings: any
} | null> {
  const timerId = `fetch-form-${Date.now()}`
  console.time(timerId)
  console.log('🔍 Fetching form:', formId)
  
  // Step 1: Try to get form from unified schema
  const { data: form, error: formError } = await supabase
    .from('forms')
    .select('id, name, workspace_id, settings, layout')
    .eq('id', formId)
    .maybeSingle()
  
  // If form found in unified schema, fetch form_fields
  if (form && !formError) {
    const { data: fields, error: fieldsError } = await supabase
      .from('form_fields')
      .select('id, field_key, field_type, label, placeholder, required, options, validation')
      .eq('form_id', formId)
      .order('sort_order', { ascending: true })
    
    if (fieldsError) {
      console.error('❌ Error fetching form_fields:', {
        message: fieldsError.message,
        details: fieldsError.details,
        hint: fieldsError.hint,
        code: fieldsError.code,
      })
    }
    
    console.log(`📊 Fetched form from unified schema with ${fields?.length || 0} fields`)
    console.timeEnd(timerId)
    
    return {
      id: form.id,
      name: form.name,
      workspace_id: form.workspace_id,
      fields: fields || [],
      settings: typeof form.settings === 'string' ? JSON.parse(form.settings) : (form.settings || {}),
    }
  }
  
  // Step 2: Fall back to legacy data_tables
  console.log('⚠️ Form not in unified schema, trying legacy data_tables...')
  const { data: legacyTable, error: legacyError } = await supabase
    .from('data_tables')
    .select('id, name, workspace_id, settings')
    .eq('id', formId)
    .maybeSingle()
  
  if (legacyError || !legacyTable) {
    console.error('❌ Form not found in either forms or data_tables:', {
      formId,
      unifiedError: formError?.message,
      legacyError: legacyError?.message,
    })
    console.timeEnd(timerId)
    return null
  }
  
  // Get legacy table fields from table_fields table
  const { data: legacyFields, error: legacyFieldsError } = await supabase
    .from('table_fields')
    .select('id, name, label, type, settings, validation, position')
    .eq('table_id', formId)
    .order('position', { ascending: true })
  
  if (legacyFieldsError) {
    console.error('❌ Error fetching table_fields:', {
      message: legacyFieldsError.message,
      details: legacyFieldsError.details,
    })
  }
  
  console.log(`📊 Fetched legacy form from data_tables with ${legacyFields?.length || 0} fields`)
  console.timeEnd(timerId)
  
  // Transform legacy fields to form fields format
  const fields = (legacyFields || []).map((field: any) => ({
    id: field.id,
    field_key: field.name,
    field_type: field.type || 'text',
    label: field.label || field.name,
    placeholder: field.settings?.placeholder,
    required: field.settings?.required || false,
    options: field.settings?.options || [],
    validation: field.validation || {},
  }))
  
  return {
    id: legacyTable.id,
    name: legacyTable.name,
    workspace_id: legacyTable.workspace_id,
    fields,
    settings: typeof legacyTable.settings === 'string' ? JSON.parse(legacyTable.settings) : (legacyTable.settings || {}),
  }
}

/**
 * Fetch workflow stages directly
 */
/**
 * Fetch stages for a workflow
 * @deprecated Workflow feature removed
 */
export async function fetchStagesDirect(workflowId: string): Promise<any[]> {
  return []
}

/**
 * Fetch workflows for a workspace
 * @deprecated Workflow feature removed
 */
export async function fetchWorkflowsDirect(workspaceId: string): Promise<any[]> {
  return []
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
  
  // Fetch all data in parallel (workflows removed - feature deprecated)
  const [form, submissions, rubrics] = await Promise.all([
    fetchFormBasicDirect(formId),
    fetchSubmissionsDirect(formId),
    fetchRubricsDirect(workspaceId),
  ])
  
  if (!form) {
    throw new Error('Form not found')
  }
  
  console.timeEnd('⚡ Total direct fetch')
  
  return {
    form,
    submissions,
    workflows: [],
    stages: [],
    rubrics,
  }
}
