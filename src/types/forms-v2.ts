// ============================================
// UNIFIED FORM SCHEMA TYPES (V2)
// Phase 3: TypeScript types for new schema
// ============================================

// ==================== FORM TYPES ====================

export interface Form {
  id: string;
  workspace_id: string;
  legacy_table_id?: string;
  name: string;
  slug: string;
  description?: string;
  settings: FormSettings;
  status: FormStatus;
  published_at?: string;
  closes_at?: string;
  max_submissions?: number;
  allow_multiple_submissions: boolean;
  require_auth: boolean;
  version: number;
  created_at: string;
  updated_at: string;
  created_by?: string;

  // Relations (when loaded)
  sections?: FormSection[];
  fields?: FormField[];
}

export type FormStatus = 'draft' | 'published' | 'archived' | 'closed';

export interface FormSettings {
  // Branding
  logo_url?: string;
  primary_color?: string;
  background_color?: string;

  // Behavior
  show_progress_bar?: boolean;
  show_section_nav?: boolean;
  autosave_interval?: number; // seconds

  // Confirmation
  confirmation_message?: string;
  redirect_url?: string;

  // Notifications
  notify_on_submission?: boolean;
  notification_emails?: string[];
}

// ==================== SECTION TYPES ====================

export interface FormSection {
  id: string;
  form_id: string;
  name: string;
  description?: string;
  sort_order: number;
  conditions: FieldCondition[];
  created_at: string;
  updated_at: string;

  // Relations
  fields?: FormField[];
}

// ==================== FIELD TYPES ====================

export interface FormField {
  id: string;
  form_id: string;
  section_id?: string;
  legacy_field_id?: string;
  field_key: string;
  field_type: FieldType;
  label: string;
  description?: string;
  placeholder?: string;
  required: boolean;
  validation: FieldValidation;
  options: FieldOption[];
  conditions: FieldCondition[];
  sort_order: number;
  width: FieldWidth;
  version: number;
  created_at: string;
  updated_at: string;
}

export type FieldType =
  // Text types
  | 'text'
  | 'textarea'
  | 'email'
  | 'phone'
  | 'url'
  // Number types
  | 'number'
  | 'currency'
  | 'percentage'
  // Date/time types
  | 'date'
  | 'datetime'
  | 'time'
  // Selection types
  | 'select'
  | 'multiselect'
  | 'radio'
  | 'checkbox'
  // File types
  | 'file'
  | 'image'
  | 'signature'
  // Compound types
  | 'address'
  | 'name'
  | 'repeater'
  // Rating types
  | 'rating'
  | 'scale'
  // Display only
  | 'divider'
  | 'heading'
  | 'paragraph';

export type FieldWidth = 'full' | 'half' | 'third';

export interface FieldValidation {
  min?: number;
  max?: number;
  min_length?: number;
  max_length?: number;
  pattern?: string;
  pattern_message?: string;
  allowed_file_types?: string[];
  max_file_size?: number; // bytes
  custom_validator?: string;
}

export interface FieldOption {
  value: string;
  label: string;
  description?: string;
  disabled?: boolean;
}

export interface FieldCondition {
  field_key: string;
  operator: ConditionOperator;
  value: unknown;
  action: ConditionAction;
}

export type ConditionOperator =
  | 'equals'
  | 'not_equals'
  | 'contains'
  | 'not_contains'
  | 'greater_than'
  | 'less_than'
  | 'is_empty'
  | 'is_not_empty'
  | 'starts_with'
  | 'ends_with';

export type ConditionAction = 'show' | 'hide' | 'require' | 'disable';

// ==================== SUBMISSION TYPES ====================

export interface FormSubmission {
  id: string;
  form_id: string;
  user_id: string; // TEXT in DB to match ba_users.id
  legacy_row_id?: string;
  status: SubmissionStatus;
  current_section_id?: string;
  completion_percentage: number;
  started_at: string;
  last_saved_at: string;
  submitted_at?: string;
  form_version: number;
  workflow_id?: string;
  current_stage_id?: string;
  assigned_reviewer_id?: string; // TEXT in DB to match ba_users.id
  created_at: string;
  updated_at: string;

  // Relations (when loaded)
  form?: Form;
  user?: {
    id: string;
    email: string;
    name?: string;
  };
  responses?: FormResponse[];
}

export type SubmissionStatus =
  | 'draft'
  | 'in_progress'
  | 'submitted'
  | 'under_review'
  | 'accepted'
  | 'rejected'
  | 'withdrawn';

export interface FormResponse {
  id: string;
  submission_id: string;
  field_id: string;
  value_type: ValueType;
  value_text?: string;
  value_number?: number;
  value_boolean?: boolean;
  value_date?: string;
  value_datetime?: string;
  value_json?: unknown;
  is_valid: boolean;
  validation_errors: string[];
  created_at: string;
  updated_at: string;

  // Relations
  field?: FormField;
  attachments?: FormAttachment[];
}

export type ValueType = 'text' | 'number' | 'boolean' | 'date' | 'datetime' | 'json';

export interface FormResponseHistory {
  id: string;
  response_id: string;
  previous_value_text?: string;
  previous_value_number?: number;
  previous_value_boolean?: boolean;
  previous_value_date?: string;
  previous_value_datetime?: string;
  previous_value_json?: unknown;
  previous_value_type?: ValueType;
  changed_by?: string;
  changed_at: string;
  change_reason?: string;
}

export interface FormAttachment {
  id: string;
  response_id: string;
  filename: string;
  original_filename: string;
  mime_type: string;
  size_bytes: number;
  storage_provider: 'supabase' | 's3' | 'google_drive';
  storage_path: string;
  storage_url?: string;
  uploaded_by?: string;
  uploaded_at: string;
  is_public: boolean;
}

// ==================== VIEW/AGGREGATED TYPES ====================

export interface FormSubmissionFull extends FormSubmission {
  user_email: string;
  user_name?: string;
  form_name: string;
  form_slug: string;
  workspace_id: string;
  form_data: Record<string, unknown>;
}

export interface UserFormSubmissionItem {
  form_id: string;
  form_name: string;
  form_slug: string;
  workspace_id: string;
  submission_id: string;
  status: SubmissionStatus;
  completion_percentage: number;
  started_at: string;
  submitted_at?: string;
  last_saved_at: string;
}

export interface UserFormSubmissions {
  user_id: string;
  email: string;
  user_name?: string;
  submissions: UserFormSubmissionItem[];
}

// ==================== API REQUEST/RESPONSE TYPES ====================

export interface CreateFormRequest {
  workspace_id: string;
  name: string;
  slug: string;
  description?: string;
  settings?: FormSettings;
  max_submissions?: number;
  allow_multiple_submissions?: boolean;
  require_auth?: boolean;
}

export interface UpdateFormRequest {
  name?: string;
  slug?: string;
  description?: string;
  settings?: FormSettings;
  status?: FormStatus;
  max_submissions?: number;
  allow_multiple_submissions?: boolean;
  require_auth?: boolean;
  closes_at?: string;
}

export interface CreateFieldRequest {
  section_id?: string;
  field_key: string;
  field_type: FieldType;
  label: string;
  description?: string;
  placeholder?: string;
  required?: boolean;
  validation?: FieldValidation;
  options?: FieldOption[];
  conditions?: FieldCondition[];
  sort_order?: number;
  width?: FieldWidth;
}

export interface UpdateFieldRequest {
  section_id?: string;
  field_key?: string;
  field_type?: FieldType;
  label?: string;
  description?: string;
  placeholder?: string;
  required?: boolean;
  validation?: FieldValidation;
  options?: FieldOption[];
  conditions?: FieldCondition[];
  sort_order?: number;
  width?: FieldWidth;
}

export interface SaveResponsesRequest {
  responses: Record<string, unknown>; // field_key -> value
}

export interface ListSubmissionsResponse {
  submissions: FormSubmissionFull[];
  total: number;
  page: number;
  limit: number;
}

export interface SubmitValidationError {
  error: string;
  missing_fields: string[];
}

// ==================== FORM BUILDER STATE ====================

export interface FormBuilderState {
  form: Partial<Form>;
  sections: FormSection[];
  fields: FormField[];
  selectedFieldId?: string;
  selectedSectionId?: string;
  isDirty: boolean;
  isSaving: boolean;
  errors: Record<string, string>;
}

export type FormBuilderAction =
  | { type: 'SET_FORM'; payload: Partial<Form> }
  | { type: 'ADD_SECTION'; payload?: Partial<FormSection> }
  | { type: 'UPDATE_SECTION'; payload: { id: string; updates: Partial<FormSection> } }
  | { type: 'DELETE_SECTION'; payload: string }
  | { type: 'REORDER_SECTIONS'; payload: string[] }
  | { type: 'ADD_FIELD'; payload: { sectionId?: string; field: Partial<FormField> } }
  | { type: 'UPDATE_FIELD'; payload: { id: string; updates: Partial<FormField> } }
  | { type: 'DELETE_FIELD'; payload: string }
  | { type: 'REORDER_FIELDS'; payload: { sectionId?: string; fieldIds: string[] } }
  | { type: 'SELECT_FIELD'; payload: string | undefined }
  | { type: 'SELECT_SECTION'; payload: string | undefined }
  | { type: 'SET_DIRTY'; payload: boolean }
  | { type: 'SET_SAVING'; payload: boolean }
  | { type: 'SET_ERROR'; payload: { field: string; message: string } }
  | { type: 'CLEAR_ERRORS' };
