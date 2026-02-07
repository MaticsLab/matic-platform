/**
 * Unified Forms Schema Types
 * 
 * These types correspond to the new normalized forms tables:
 * - forms (form definitions)
 * - form_fields (field definitions) 
 * - form_submissions (user submissions)
 * - form_responses (individual field responses - legacy, dual-write)
 */

// ============================================
// LAYOUT FIELD HELPERS
// ============================================

/** Field types that are purely visual and don't collect data */
export const LAYOUT_FIELD_TYPES = [
  'heading',
  'section_header',
  'divider',
  'separator',
  'html',
  'description',
  'page_break',
  'button',
] as const;

export type LayoutFieldType = typeof LAYOUT_FIELD_TYPES[number];

/** Returns true if the field is a layout-only element (no data collection) */
export function isLayoutField(field: { field_type: string; category?: string }): boolean {
  if (field.category === 'layout') return true;
  return (LAYOUT_FIELD_TYPES as readonly string[]).includes(field.field_type);
}

/** Filters a list of fields to only data-collecting fields */
export function getDataFields<T extends { field_type: string; category?: string }>(fields: T[]): T[] {
  return fields.filter(f => !isLayoutField(f));
}

export interface Form {
  id: string
  workspace_id: string
  legacy_table_id?: string | null
  name: string
  slug: string
  description?: string | null
  settings: FormSettings
  layout: Array<Record<string, any>>
  status: 'draft' | 'published' | 'archived' | 'closed'
  published_at?: string | null
  closes_at?: string | null
  max_submissions?: number | null
  allow_multiple_submissions: boolean
  require_auth: boolean
  version: number
  created_at: string
  updated_at: string
  created_by?: string | null
}

export interface FormSettings {
  branding?: {
    logo_url?: string
    primary_color?: string
    font_family?: string
  }
  notifications?: {
    enabled: boolean
    recipients: string[]
    on_submit?: boolean
    on_status_change?: boolean
  }
  security?: {
    require_captcha?: boolean
    allowed_domains?: string[]
    ip_whitelist?: string[]
  }
  customization?: {
    custom_css?: string
    custom_js?: string
    thank_you_message?: string
    redirect_url?: string
  }
  [key: string]: any
}

export interface FormField {
  id: string
  form_id: string
  section_id?: string | null
  legacy_field_id?: string | null
  field_key: string
  field_type: string
  label: string
  description?: string | null
  placeholder?: string | null
  required: boolean
  validation: Record<string, any>
  options: Array<{ label: string; value: string }>
  conditions: Array<any>
  sort_order: number
  width: 'full' | 'half' | 'third' | 'quarter'
  category: 'data' | 'layout'
  version: number
  created_at: string
  updated_at: string
}

export interface FormSection {
  id: string
  form_id: string
  name: string
  description?: string | null
  sort_order: number
  conditions: Array<any>
  created_at: string
  updated_at: string
}

export interface FormSubmission {
  id: string
  form_id: string
  user_id: string
  legacy_row_id?: string | null
  raw_data: Record<string, any>
  status: 'draft' | 'in_progress' | 'submitted' | 'under_review' | 'accepted' | 'rejected' | 'withdrawn'
  current_section_id?: string | null
  completion_percentage: number
  started_at: string
  last_saved_at: string
  submitted_at?: string | null
  form_version: number
  workflow_id?: string | null
  current_stage_id?: string | null
  assigned_reviewer_id?: string | null
  created_at: string
  updated_at: string
}

export interface FormResponse {
  id: string
  submission_id: string
  field_id: string
  value_text?: string | null
  value_number?: number | null
  value_boolean?: boolean | null
  value_date?: string | null
  value_datetime?: string | null
  value_json?: Record<string, any> | null
  value_type: 'text' | 'number' | 'boolean' | 'date' | 'datetime' | 'json'
  is_valid: boolean
  validation_errors: Array<string>
  created_at: string
  updated_at: string
}

export interface FormResponseHistory {
  id: string
  response_id: string
  previous_value_text?: string | null
  previous_value_number?: number | null
  previous_value_boolean?: boolean | null
  previous_value_date?: string | null
  previous_value_datetime?: string | null
  previous_value_json?: Record<string, any> | null
  previous_value_type?: string | null
  changed_by?: string | null
  changed_at: string
  change_reason?: string | null
}

// Enriched types for API responses
export interface FormWithFields extends Form {
  fields: FormField[]
  sections?: FormSection[]
}

export interface FormSubmissionWithResponses extends FormSubmission {
  responses: FormResponse[]
  form?: Form
}

export interface FormSubmissionSummary {
  id: string
  form_id: string
  form_name: string
  status: string
  completion_percentage: number
  submitted_at?: string | null
  last_saved_at: string
  created_at: string
  updated_at: string
}

// Create/Update types
export interface CreateFormInput {
  workspace_id: string
  name: string
  slug: string
  description?: string
  settings?: FormSettings
  status?: 'draft' | 'published'
  require_auth?: boolean
}

export interface UpdateFormInput {
  name?: string
  description?: string
  settings?: FormSettings
  status?: 'draft' | 'published' | 'archived' | 'closed'
  closes_at?: string | null
  max_submissions?: number | null
  allow_multiple_submissions?: boolean
}

export interface CreateFormFieldInput {
  form_id: string
  section_id?: string
  field_key: string
  field_type: string
  label: string
  description?: string
  placeholder?: string
  required?: boolean
  validation?: Record<string, any>
  options?: Array<{ label: string; value: string }>
  sort_order?: number
}

export interface UpdateFormFieldInput {
  label?: string
  description?: string
  placeholder?: string
  required?: boolean
  validation?: Record<string, any>
  options?: Array<{ label: string; value: string }>
  sort_order?: number
}

export interface SubmitFormResponseInput {
  submission_id: string
  field_id: string
  value: string | number | boolean | Record<string, any>
}
