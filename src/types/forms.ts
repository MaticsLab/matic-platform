/**
 * Form Types for Matic Platform
 * Based on database schema in 001_initial_schema.sql
 */

export type FormStatus = 'draft' | 'published' | 'archived' | 'paused'

export type FieldType =
  | 'text'
  | 'textarea'
  | 'email'
  | 'phone'
  | 'number'
  | 'url'
  | 'select'
  | 'multiselect'
  | 'radio'
  | 'checkbox'
  | 'date'
  | 'datetime'
  | 'time'
  | 'file'
  | 'image'
  | 'signature'
  | 'rating'
  | 'divider'
  | 'heading'
  | 'paragraph'

export type FieldWidth = 'full' | 'half' | 'third' | 'quarter'

export interface LogicRule {
  id: string
  fieldId: string
  operator: 'equals' | 'not_equals' | 'contains' | 'greater_than' | 'less_than' | 'is_empty' | 'is_not_empty'
  value: string
  action: 'show' | 'hide' | 'require'
}

export interface DashboardTile {
  id: string
  title: string
  type: 'stat' | 'folder'
  filter?: LogicRule[]
  icon?: string
  color?: string
  aggregation?: 'count' | 'sum' | 'avg'
  fieldId?: string
}

export interface DashboardConfig {
  tiles: DashboardTile[]
}

export interface FormField {
  id: string
  form_id: string // This might be table_id in backend
  table_id?: string
  name: string
  label: string
  placeholder?: string
  description?: string
  type: FieldType // Changed from field_type to type to match backend
  settings: Record<string, any>
  config?: Record<string, any>
  validation: Record<string, any>
  options: Array<{ label: string; value: string }>
  position: number
  width: FieldWidth
  is_visible: boolean
  created_at: string
  updated_at: string
}

export interface Form {
  id: string
  workspace_id: string
  name: string
  description?: string
  slug: string
  settings: Record<string, any>
  submit_settings: Record<string, any>
  status: FormStatus
  version: number
  is_public: boolean
  created_by: string
  created_at: string
  updated_at: string
  published_at?: string
  fields?: FormField[]
}

export interface FormSubmission {
  id: string
  form_id: string
  data: Record<string, any>
  metadata: Record<string, any>
  status: 'submitted' | 'reviewed' | 'approved' | 'rejected'
  submitted_by?: string
  email?: string
  submitted_at: string
  reviewed_at?: string
  reviewed_by?: string
}

export interface FormCreate {
  workspace_id: string
  name: string
  description?: string
  slug: string
  settings?: Record<string, any>
  submit_settings?: Record<string, any>
  status?: FormStatus
  is_public?: boolean
}

export interface FormUpdate {
  name?: string
  description?: string
  slug?: string
  settings?: Record<string, any>
  submit_settings?: Record<string, any>
  status?: FormStatus
  is_public?: boolean
}
