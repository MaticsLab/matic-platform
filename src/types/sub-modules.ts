/**
 * Sub-Module Types
 * Types for sub-modules within parent modules
 */

import type { HubType, KnownModuleId, ModuleDefinition } from './modules';
import type { FieldTypeRegistry } from './field-registry';

// ============================================================
// SUB-MODULES
// ============================================================

export interface SubModule {
  id: string;
  parent_module_id: KnownModuleId;
  hub_id: string;
  name: string;
  slug: string;
  description?: string;
  icon?: string;
  
  // Data storage
  data_table_id?: string;
  uses_parent_table: boolean;
  filter_config: Record<string, any>;
  
  // Configuration
  settings: Record<string, any>;
  is_enabled: boolean;
  position: number;
  
  // Metadata
  created_by?: string;
  created_at: string;
  updated_at: string;
}

export interface SubModuleWithData extends SubModule {
  row_count: number;
  last_update?: string;
  fields?: ModuleFieldConfig[];
}

// ============================================================
// MODULE FIELD CONFIGS
// ============================================================

export interface ModuleFieldConfig {
  id: string;
  module_id: KnownModuleId;
  field_type_id: string;
  is_required: boolean;
  is_auto_created: boolean;
  default_config: Record<string, any>;
  display_order: number;
  created_at: string;
  
  // Relationships
  field_type?: FieldTypeRegistry;
}

// ============================================================
// MODULE HISTORY SETTINGS
// ============================================================

export interface ModuleHistorySettings {
  id: string;
  hub_module_config_id: string;
  
  // Version tracking overrides
  track_changes?: boolean;
  require_change_reason?: boolean;
  version_retention_days?: number;
  
  // Approval overrides
  require_approval?: boolean;
  approval_type?: 'table_owner' | 'workspace_admin' | 'specific_user';
  specific_approvers?: string[];
  
  // AI settings overrides
  enable_ai_suggestions?: boolean;
  auto_apply_threshold?: number;
  
  created_at: string;
  updated_at: string;
}

// ============================================================
// EXTENDED MODULE TYPES
// ============================================================

export interface ModuleWithFields extends ModuleDefinition {
  is_enabled: boolean;
  settings?: Record<string, any>;
  fields: ModuleFieldConfig[];
  sub_modules?: SubModule[];
  history_settings?: ModuleHistorySettings;
}

export interface HubModulesWithFieldsResponse {
  table_id: string;
  hub_type: HubType;
  enabled_modules: ModuleWithFields[];
  available_modules: ModuleDefinition[];
  sub_modules: SubModuleWithData[];
}

export interface ModuleFieldsResponse {
  module_id: string;
  module_name: string;
  fields: ModuleFieldConfig[];
  system_fields: FieldTypeRegistry[];
}

// ============================================================
// REQUEST TYPES
// ============================================================

export interface CreateSubModuleInput {
  parent_module_id: KnownModuleId;
  hub_id: string;
  name: string;
  slug?: string;
  description?: string;
  icon?: string;
  uses_parent_table?: boolean;
  filter_config?: Record<string, any>;
  settings?: Record<string, any>;
}

export interface UpdateSubModuleInput {
  name?: string;
  description?: string;
  icon?: string;
  is_enabled?: boolean;
  position?: number;
  filter_config?: Record<string, any>;
  settings?: Record<string, any>;
}

export interface EnableModuleWithFieldsInput {
  module_id: KnownModuleId;
  settings?: Record<string, any>;
  auto_create_fields?: boolean;
  history_settings?: {
    track_changes?: boolean;
    require_change_reason?: boolean;
    require_approval?: boolean;
  };
}

export interface UpdateModuleHistorySettingsInput {
  track_changes?: boolean;
  require_change_reason?: boolean;
  version_retention_days?: number;
  require_approval?: boolean;
  approval_type?: 'table_owner' | 'workspace_admin' | 'specific_user';
  specific_approvers?: string[];
  enable_ai_suggestions?: boolean;
  auto_apply_threshold?: number;
}

export interface ReorderSubModulesInput {
  sub_module_ids: string[];
}

// ============================================================
// RESPONSE TYPES
// ============================================================

export interface SubModuleRowsResponse {
  sub_module_id: string;
  table_id: string;
  rows: any[];
  total: number;
  page: number;
  page_size: number;
}

// ============================================================
// MODULE-SPECIFIC FIELD TYPES
// ============================================================

// Pulse scanning
export interface ScanResultValue {
  barcode: string;
  scan_type: 'check_in' | 'check_out';
  scanned_at: string;
  scanner_id?: string;
}

// Attendance
export interface AttendanceStatusValue {
  status: 'present' | 'absent' | 'late' | 'excused';
  check_in_time?: string;
  check_out_time?: string;
  duration_minutes?: number;
}

// Review workflow
export interface ReviewScoreValue {
  score: number;
  max_score: number;
  rubric_id: string;
  criteria_scores?: Record<string, number>;
}

export interface StageStatusValue {
  status: 'pending' | 'in_review' | 'approved' | 'rejected' | 'waitlisted';
  stage_id: string;
  moved_at?: string;
  moved_by?: string;
}

export interface ReviewerAssignmentValue {
  reviewer_id: string;
  reviewer_type_id?: string;
  assigned_at?: string;
  completed_at?: string;
}

// Rubrics
export interface RubricResponseValue {
  criteria_id: string;
  score: number;
  max_score: number;
  comment?: string;
  scored_at?: string;
  scored_by?: string;
}

// Calendar
export interface CalendarEventValue {
  provider: 'google' | 'outlook' | 'ical';
  external_id: string;
  title: string;
  start: string;
  end: string;
  synced_at?: string;
}

// ============================================================
// CONSTANTS
// ============================================================

// Module-specific field type IDs
export const MODULE_FIELD_TYPES = {
  // Pulse
  SCAN_RESULT: 'scan_result',
  
  // Attendance
  ATTENDANCE_STATUS: 'attendance_status',
  
  // Review workflow
  REVIEW_SCORE: 'review_score',
  STAGE_STATUS: 'stage_status',
  REVIEWER_ASSIGNMENT: 'reviewer_assignment',
  
  // Rubrics
  RUBRIC_RESPONSE: 'rubric_response',
  
  // Calendar
  CALENDAR_EVENT: 'calendar_event',
} as const;

export type ModuleFieldTypeId = typeof MODULE_FIELD_TYPES[keyof typeof MODULE_FIELD_TYPES];
