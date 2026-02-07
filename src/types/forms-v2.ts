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
  theme?: FormTheme;

  // Behavior
  show_progress_bar?: boolean;
  show_section_nav?: boolean;
  autosave_interval?: number; // seconds
  allow_save_and_exit?: boolean;

  // Navigation & Branching
  enable_branching?: boolean;
  branching_rules?: BranchingRule[];
  start_section_id?: string;

  // Confirmation
  confirmation_message?: string;
  redirect_url?: string;
  show_confirmation_page?: boolean;

  // Notifications
  notify_on_submission?: boolean;
  notification_emails?: string[];

  // Rich text
  enable_rich_text?: boolean;
}

export interface FormTheme {
  // Colors
  primary_color?: string;
  secondary_color?: string;
  background_color?: string;
  text_color?: string;
  border_color?: string;
  error_color?: string;
  success_color?: string;

  // Typography
  font_family?: string;
  font_size?: string;
  heading_font?: string;

  // Layout
  border_radius?: string;
  spacing?: string;
  max_width?: string;

  // Buttons
  button_style?: 'solid' | 'outline' | 'ghost';
  button_size?: 'sm' | 'md' | 'lg';
}

export interface BranchingRule {
  id: string;
  from_section_id: string;
  conditions: FieldCondition[];
  to_section_id: string;
  priority: number; // Lower number = higher priority
}

// ==================== SECTION TYPES ====================

export interface FormSection {
  id: string;
  form_id: string;
  name: string;
  description?: string;
  sort_order: number;
  conditions?: ConditionalAction[]; // Show/hide section based on conditions
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
  help_text?: string; // Additional guidance
  is_rich_text?: boolean; // Label/description contain HTML
  required: boolean;
  validation?: FieldValidation;
  options?: FieldOption[];
  conditions?: ConditionalAction[]; // Show/hide/require/disable/prefill logic
  prefill_value?: string;
  calculation_rule?: string; // Formula for calculated fields
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
  // Numeric
  min?: number;
  max?: number;

  // Text length
  min_length?: number;
  max_length?: number;

  // Pattern validation
  pattern?: string; // Custom regex
  pattern_message?: string;
  validation_type?: 'email' | 'phone' | 'url' | 'date' | 'time';

  // Built-in validation patterns
  email_validation?: EmailValidation;
  phone_validation?: PhoneValidation;
  url_validation?: URLValidation;
  date_validation?: DateValidation;

  // File validation
  allowed_file_types?: string[];
  max_file_size?: number; // bytes
  min_files?: number;
  max_files?: number;

  // Custom validation
  custom_validation?: string; // JS function
  custom_message?: string;
  custom_validator?: string; // Legacy name
}

export interface EmailValidation {
  allowed_domains?: string[]; // e.g., ["gmail.com", "company.com"]
  blocked_domains?: string[];
  require_corporate?: boolean; // Block free email providers
}

export interface PhoneValidation {
  country_code?: string; // e.g., "US", "UK"
  format?: string; // e.g., "(###) ###-####"
  allowed_countries?: string[];
}

export interface URLValidation {
  require_https?: boolean;
  allowed_domains?: string[];
  blocked_domains?: string[];
}

export interface DateValidation {
  min_date?: string;
  max_date?: string;
  allow_past?: boolean;
  allow_future?: boolean;
  disabled_dates?: string[]; // ISO dates
  disabled_days?: number[]; // 0=Sunday, 6=Saturday
}

export interface FieldOption {
  value: string;
  label: string;
  description?: string;
  color?: string;
  icon?: string;
  disabled?: boolean;
}

export interface FieldCondition {
  id?: string;
  field_key: string;
  operator: ConditionOperator;
  value: unknown;
  logic?: 'and' | 'or'; // For multiple conditions
}

export type ConditionOperator =
  // Comparison
  | 'equals'
  | 'not_equals'
  | 'greater_than'
  | 'less_than'
  | 'greater_or_equal'
  | 'less_or_equal'
  // String
  | 'contains'
  | 'not_contains'
  | 'starts_with'
  | 'ends_with'
  | 'matches' // Regex
  // Existence
  | 'is_empty'
  | 'is_not_empty'
  | 'is_null'
  | 'is_not_null'
  // Array/Multi-select
  | 'includes'
  | 'not_includes'
  | 'includes_any'
  | 'includes_all';

export type ConditionAction = 'show' | 'hide' | 'require' | 'disable';

export interface ConditionalAction {
  type: 'show' | 'hide' | 'require' | 'disable' | 'prefill' | 'calculate';
  conditions: FieldCondition[];
  logic?: 'and' | 'or';
  target?: string; // field_key or section_id
  value?: unknown; // For prefill/calculate actions
}

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

// ==================== VALIDATION PATTERNS ====================

export const VALIDATION_PATTERNS: Record<string, string> = {
  email: '^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$',
  phone_us: '^\\(?([0-9]{3})\\)?[-. ]?([0-9]{3})[-. ]?([0-9]{4})$',
  phone_intl: '^\\+?[1-9]\\d{1,14}$',
  url: '^https?://[^\\s/$.?#].[^\\s]*$',
  zip_us: '^\\d{5}(-\\d{4})?$',
  ssn: '^\\d{3}-?\\d{2}-?\\d{4}$',
  credit_card: '^\\d{4}[- ]?\\d{4}[- ]?\\d{4}[- ]?\\d{4}$',
  ipv4: '^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$',
  alphanumeric: '^[a-zA-Z0-9]+$',
  alpha: '^[a-zA-Z]+$',
  numeric: '^[0-9]+$',
};

// ==================== PORTAL DATA ====================

export interface PortalSubmissionData {
  submission: FormSubmission;
  form: Form;
  fields: FormField[];
  sections: FormSection[];
  data: Record<string, unknown>; // field_key or legacy UUID -> value
}
