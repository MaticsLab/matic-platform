/**
 * TypeScript types for the Field Type Registry system
 * These types align with the Go models in field_registry.go and models.go
 * 
 * This file is the new canonical source for field types.
 * Re-exports are available from field-registry.ts for backwards compatibility.
 */

/**
 * Field type categories in the registry
 */
export type FieldCategory = 'primitive' | 'container' | 'layout' | 'special';

/**
 * AI Schema for embedding/search configuration
 */
export interface AISchema {
  embedding_strategy: 'value_only' | 'with_label' | 'summarize_count' | 'children_only' | 'filename_only' | 'skip';
  privacy_level: 'pii' | 'sensitive' | 'public' | 'inherit';
  semantic_hint?: string;
  extraction_patterns?: string[];
  summarization_weight?: number;
  summarization_template?: string;  // e.g., "{count} items"
}

/**
 * The master field type registry entry
 * This is the "blueprint" for all field instances
 */
export interface FieldTypeRegistry {
  id: string;                         // e.g., "text", "select", "repeater"
  category: FieldCategory;
  display_name: string;               // e.g., "Text", "Select", "Repeater"
  label: string;                      // Alternative display label
  description: string;
  icon: string;                       // Icon name for UI
  color: string;                      // Color for UI
  
  // Schema definitions (JSONB)
  storage_schema: Record<string, any>;  // How data is stored
  input_schema: Record<string, any>;    // How input is captured
  config_schema: Record<string, any>;   // What config options are available
  ai_schema?: AISchema | Record<string, any>;  // AI-specific schema for embeddings
  
  // Default configuration that new fields inherit
  default_config: Record<string, any>;
  
  // Behavior flags
  is_container: boolean;              // Can contain child fields (e.g., repeater, section)
  is_searchable: boolean;             // Included in search indexes
  is_sortable: boolean;               // Can be used for sorting
  is_filterable: boolean;             // Can be used in filters
  is_editable: boolean;               // Can be edited in table view
  supports_pii: boolean;              // Can contain personally identifiable info
  is_system_field: boolean;           // System-managed field
  
  // Rendering hints
  table_renderer?: string;
  form_renderer?: string;
  review_renderer?: string;
  
  // Edit tracking
  track_changes?: boolean;
  require_reason?: boolean;
  
  // Optional relationships
  module_id?: string;                 // Associated module
  
  created_at: string;
  updated_at: string;
}

/**
 * A field instance that belongs to a table
 * Now has proper FK relationship to FieldTypeRegistry
 */
export interface Field {
  id: string;
  table_id: string;
  
  // Type information - field_type_id is the primary FK
  field_type_id: string;              // FK to field_type_registry
  type: string;                       // Legacy: kept for backwards compatibility
  
  // Field definition
  name: string;                       // Column/field name (snake_case)
  label: string;                      // Display label
  description?: string;
  
  // Instance-specific configuration
  config: Record<string, any>;        // Instance-specific overrides
  settings?: Record<string, any>;     // Additional settings
  validation?: Record<string, any>;   // Validation rules
  
  // Display
  position: number;
  width: number;
  is_visible: boolean;
  is_primary: boolean;
  is_searchable: boolean;
  
  // Linked table for link/lookup fields
  linked_table_id?: string;
  
  // Nested field support
  parent_field_id?: string;           // Parent field for nested fields
  children?: Field[];                 // Child fields for container types
  
  // The full field type registry entry (populated via preload)
  field_type?: FieldTypeRegistry;
  
  created_at: string;
  updated_at: string;
}

/**
 * Input for creating a new field
 */
export interface CreateFieldInput {
  table_id: string;
  field_type_id: string;              // Required: must be valid registry entry
  name: string;
  label?: string;                     // Defaults to name if not provided
  description?: string;
  config?: Record<string, any>;
  position?: number;
  width?: number;
  is_visible?: boolean;
  is_primary?: boolean;
  parent_field_id?: string;
  linked_table_id?: string;
}

/**
 * Input for updating a field
 */
export interface UpdateFieldInput {
  name?: string;
  label?: string;
  description?: string;
  config?: Record<string, any>;
  position?: number;
  width?: number;
  is_visible?: boolean;
  is_primary?: boolean;
  is_searchable?: boolean;
  linked_table_id?: string;
}

/**
 * Effective configuration - merged from registry defaults + instance overrides
 */
export interface EffectiveFieldConfig {
  // From registry
  storage_schema: Record<string, any>;
  input_schema: Record<string, any>;
  config_schema: Record<string, any>;
  ai_schema?: Record<string, any>;
  
  // Behavior flags from registry
  is_container: boolean;
  is_searchable: boolean;
  is_sortable: boolean;
  is_filterable: boolean;
  is_editable: boolean;
  supports_pii: boolean;
  
  // Merged config (registry defaults + instance overrides)
  config: Record<string, any>;
}

/**
 * Simplified field type for toolbox/builder display
 */
export interface FieldTypeSummary {
  id: string;
  category: FieldCategory;
  label: string;
  description: string;
  icon: string;
  color: string;
  is_container: boolean;
}

/**
 * Field types grouped by category for toolbox
 */
export interface FieldTypesByCategory {
  primitive: FieldTypeSummary[];
  container: FieldTypeSummary[];
  layout: FieldTypeSummary[];
  special: FieldTypeSummary[];
}

/**
 * Helper to check if a field is a container type
 */
export function isContainerField(field: Field): boolean {
  return field.field_type?.is_container ?? false;
}

/**
 * Helper to get the effective type ID (prefers field_type_id over legacy type)
 */
export function getFieldTypeId(field: Field): string {
  return field.field_type_id || field.type;
}

/**
 * Known field type IDs for type-safe comparisons
 */
export const FIELD_TYPES = {
  // Primitive types
  TEXT: 'text',
  LONG_TEXT: 'long_text',
  NUMBER: 'number',
  EMAIL: 'email',
  URL: 'url',
  PHONE: 'phone',
  DATE: 'date',
  DATETIME: 'datetime',
  CHECKBOX: 'checkbox',
  SELECT: 'select',
  MULTISELECT: 'multiselect',
  RATING: 'rating',
  CURRENCY: 'currency',
  PERCENT: 'percent',
  
  // File types
  FILE: 'file',
  IMAGE: 'image',
  ATTACHMENT: 'attachment',
  SIGNATURE: 'signature',
  
  // Container types
  REPEATER: 'repeater',
  SECTION: 'section',
  ITEM_LIST: 'item_list',
  GROUP: 'group',
  
  // Layout types
  HEADING: 'heading',
  PARAGRAPH: 'paragraph',
  DIVIDER: 'divider',
  SPACER: 'spacer',
  
  // Special types
  LINK: 'link',
  LOOKUP: 'lookup',
  ROLLUP: 'rollup',
  FORMULA: 'formula',
  USER: 'user',
  AUTONUMBER: 'autonumber',
  CREATED_TIME: 'created_time',
  CREATED_BY: 'created_by',
  LAST_MODIFIED_TIME: 'last_modified_time',
  LAST_MODIFIED_BY: 'last_modified_by',
} as const;

export type FieldTypeId = typeof FIELD_TYPES[keyof typeof FIELD_TYPES];
