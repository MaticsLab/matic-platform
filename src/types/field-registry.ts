/**
 * Field Registry Types
 * Universal field type definitions for consistent data handling
 * 
 * NOTE: Core field types are now defined in field-types.ts
 * This file re-exports those types and adds history/version types
 */

// ============================================================
// RE-EXPORTS FROM FIELD-TYPES.TS (NEW CANONICAL SOURCE)
// ============================================================

// Import for local use
import type { FieldCategory as FC } from './field-types';

export type { 
  FieldCategory, 
  FieldTypeRegistry, 
  AISchema,
  Field,
  EffectiveFieldConfig,
  FieldTypeSummary,
  FieldTypesByCategory,
} from './field-types';

export { 
  FIELD_TYPES, 
  isContainerField,
  getFieldTypeId,
} from './field-types';

// Legacy type alias for backwards compatibility
export type FieldTypeId =
  | 'text' | 'textarea' | 'email' | 'phone' | 'url' | 'address'
  | 'number' | 'rating'
  | 'date' | 'datetime' | 'time'
  | 'select' | 'multiselect' | 'radio' | 'checkbox'
  | 'group' | 'repeater' | 'section'
  | 'divider' | 'heading' | 'paragraph' | 'callout'
  | 'file' | 'image' | 'signature'
  | 'rank' | 'item_list'

// ============================================================
// ROW VERSIONS (History)
// ============================================================

export type ChangeType = 'create' | 'update' | 'restore' | 'import' | 'ai_edit' | 'approval' | 'bulk'
export type ChangeAction = 'add' | 'update' | 'remove' | 'reorder'

export interface RowVersion {
  id: string
  row_id: string
  table_id: string
  
  version_number: number
  
  // Data snapshot (may be redacted if PII mode enabled)
  data: Record<string, any>
  metadata: Record<string, any>
  
  // Change context
  change_type: ChangeType
  change_reason?: string
  change_summary?: string
  
  // Batch reference
  batch_operation_id?: string
  
  // Authorship
  changed_by?: string
  changed_at: string
  
  // AI context
  ai_assisted: boolean
  ai_confidence?: number
  ai_suggestion_id?: string
  
  // Archive status
  is_archived: boolean
  archived_at?: string
  archived_by?: string
  archive_expires_at?: string
  
  created_at: string
}

export interface FieldChange {
  id: string
  row_version_id: string
  row_id: string
  field_id?: string
  
  field_name: string
  field_type: string
  field_label?: string
  
  old_value?: any
  new_value?: any
  
  change_action: ChangeAction
  nested_path?: string[]  // For repeater/group: ['activities', '0', 'role']
  
  similarity_score?: number  // 0-1, 1 = identical
  semantic_change_type?: 'typo_fix' | 'correction' | 'addition' | 'major_revision'
  
  contains_pii: boolean
  created_at: string
}

export interface RowHistoryEntry extends Omit<RowVersion, 'data'> {
  data: Record<string, any>  // May be redacted
  field_changes?: FieldChange[]
}

// ============================================================
// BATCH OPERATIONS
// ============================================================

export type BatchOperationType = 'bulk_update' | 'bulk_delete' | 'bulk_create' | 'import' | 'ai_correction' | 'restore'
export type BatchOperationStatus = 'pending' | 'in_progress' | 'completed' | 'failed' | 'rolled_back'

export interface BatchOperation {
  id: string
  workspace_id: string
  table_id?: string
  
  operation_type: BatchOperationType
  description?: string
  
  affected_row_count: number
  affected_field_names?: string[]
  
  status: BatchOperationStatus
  error_message?: string
  
  can_rollback: boolean
  rolled_back_at?: string
  rolled_back_by?: string
  
  created_by: string
  created_at: string
  completed_at?: string
}

// ============================================================
// CHANGE APPROVALS
// ============================================================

export type ApprovalRequirement = 'table_owner' | 'workspace_admin' | 'specific_user' | 'any_reviewer'
export type ApprovalStatus = 'pending' | 'approved' | 'rejected' | 'expired' | 'cancelled'

export interface ChangeApproval {
  id: string
  row_id: string
  table_id: string
  
  pending_data: Record<string, any>
  pending_changes: FieldChange[]
  change_reason?: string
  
  requires_approval_from: ApprovalRequirement
  specific_approver_id?: string
  
  stage_id?: string
  
  status: ApprovalStatus
  
  requested_by: string
  requested_at: string
  
  reviewed_by?: string
  reviewed_at?: string
  review_notes?: string
  
  expires_at?: string
  created_at: string
}

// ============================================================
// AI FIELD SUGGESTIONS
// ============================================================

export type SuggestionType =
  | 'typo_correction'
  | 'format_correction'
  | 'semantic_type_change'
  | 'validation_rule'
  | 'field_type_change'
  | 'merge_fields'
  | 'split_field'
  | 'normalize_values'
  | 'missing_value'
  | 'duplicate_detection'

export type SuggestionStatus = 'pending' | 'accepted' | 'rejected' | 'dismissed' | 'auto_applied'

export interface AIFieldSuggestion {
  id: string
  workspace_id: string
  table_id: string
  row_id?: string
  field_id?: string
  
  suggestion_type: SuggestionType
  
  current_value?: any
  suggested_value: any
  confidence: number  // 0-1
  reasoning?: string
  
  sample_data?: any
  pattern_matches?: number
  total_values?: number
  
  related_suggestion_ids?: string[]
  
  status: SuggestionStatus
  
  reviewed_by?: string
  reviewed_at?: string
  review_notes?: string
  
  applied_version_id?: string
  
  created_at: string
  expires_at?: string
}

// ============================================================
// TABLE SETTINGS
// ============================================================

export interface TableHistorySettings {
  track_changes: boolean
  require_change_reason: boolean
  version_retention_days: number | null  // null = keep forever
  allow_user_delete_history: boolean
  admin_only_full_history: boolean
}

export interface TableApprovalSettings {
  require_approval: boolean
  approval_type: ApprovalRequirement
  specific_approvers: string[]  // User IDs
  auto_expire_days: number
  notify_on_pending: boolean
}

export interface TableAISettings {
  enable_suggestions: boolean
  auto_apply_high_confidence: boolean
  auto_apply_threshold: number  // e.g., 0.95
  suggestion_types: SuggestionType[]
}

// ============================================================
// API TYPES
// ============================================================

// GET /api/v1/tables/:id/rows/:row_id/history
export interface GetRowHistoryRequest {
  redact_pii?: boolean
  include_archived?: boolean
  limit?: number
}

export interface GetRowHistoryResponse {
  row_id: string
  total_versions: number
  versions: RowHistoryEntry[]
}

// POST /api/v1/tables/:id/rows/:row_id/restore/:version
export interface RestoreVersionRequest {
  reason: string
}

export interface RestoreVersionResponse {
  success: boolean
  new_version_id: string
  new_version_number: number
}

// GET /api/v1/tables/:id/rows/:row_id/diff/:v1/:v2
export interface VersionDiffResponse {
  version1: number
  version2: number
  field_diffs: FieldChange[]
}

// POST /api/v1/tables/:id/rows/:row_id/approve
export interface ApproveChangeRequest {
  approval_id: string
  action: 'approve' | 'reject'
  notes?: string
}

// GET /api/v1/tables/:id/ai/suggestions
export interface GetAISuggestionsRequest {
  status?: SuggestionStatus
  suggestion_type?: SuggestionType
  min_confidence?: number
  limit?: number
}

export interface GetAISuggestionsResponse {
  table_id: string
  suggestions: AIFieldSuggestion[]
  total: number
}

// POST /api/v1/tables/:id/ai/suggestions/:id/apply
export interface ApplySuggestionRequest {
  suggestion_id: string
  apply: boolean
  notes?: string
}

// ============================================================
// HELPER TYPES
// ============================================================

// Type-safe field value based on field type
export type FieldValue<T extends FieldTypeId> =
  T extends 'repeater' ? Array<Record<string, any>> :
  T extends 'group' ? Record<string, any> :
  T extends 'multiselect' | 'rank' | 'item_list' ? string[] :
  T extends 'checkbox' ? boolean :
  T extends 'number' | 'rating' ? number :
  T extends 'file' | 'image' ? FileValue :
  T extends 'divider' | 'heading' | 'paragraph' | 'callout' | 'section' ? null :
  string

export interface FileValue {
  url: string
  name: string
  size?: number
  mime_type?: string
  width?: number  // For images
  height?: number // For images
}

// Container field with children
export interface ContainerFieldConfig {
  children: Array<{
    name: string
    label: string
    type: FieldTypeId
    is_required?: boolean
    placeholder?: string
    options?: string[]
    validation?: Record<string, any>
  }>
  min_items?: number  // For repeaters
  max_items?: number  // For repeaters
  item_label?: string // For repeaters
}

// ============================================================
// CONSTANTS
// ============================================================

export const FIELD_CATEGORIES: Record<FC, FieldTypeId[]> = {
  primitive: ['text', 'textarea', 'email', 'phone', 'url', 'number', 'date', 'datetime', 'time', 'select', 'multiselect', 'radio', 'checkbox'],
  container: ['group', 'repeater', 'section'],
  layout: ['divider', 'heading', 'paragraph', 'callout'],
  special: ['file', 'image', 'signature', 'rating', 'rank', 'item_list'],
}

export const PII_FIELD_TYPES: FieldTypeId[] = ['email', 'phone', 'signature', 'address']

export const CONTAINER_FIELD_TYPES: FieldTypeId[] = ['group', 'repeater', 'section']

export const LAYOUT_FIELD_TYPES: FieldTypeId[] = ['divider', 'heading', 'paragraph', 'callout']
