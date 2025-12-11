/**
 * TypeScript types for Airtable-like data tables/sheets system
 * These types align with the backend Pydantic schemas
 * 
 * NOTE: Field types are now defined in the field_type_registry database table.
 * Use types from '@/types/field-types' for field type definitions.
 * The ColumnType alias is kept for backwards compatibility but deprecated.
 */

import type { HubType } from './modules';

/**
 * @deprecated Use field_type_id from field_type_registry instead.
 * This type is kept for backwards compatibility with existing code.
 * New code should use the FIELD_TYPES constant from '@/types/field-types'.
 */
export type ColumnType = string;

/**
 * View types for table_views
 * NOTE: 'portal' type added for public-facing application portals
 */
export type ViewType = 'grid' | 'kanban' | 'calendar' | 'gallery' | 'timeline' | 'form' | 'portal';

export type ConnectionType = 'write' | 'read' | 'update';

export type LinkType = 'one_to_one' | 'one_to_many' | 'many_to_many';

export type ImportSource = 'csv' | 'excel' | 'google_sheets' | 'manual';

/**
 * TableColumn represents a field/column in a data table.
 * NOTE: This is a legacy type. For new code, prefer using Field from '@/types/field-types'.
 */
export interface TableColumn {
  id?: string;
  name: string;
  label: string;
  description?: string;
  /** @deprecated Use field_type_id instead */
  column_type: ColumnType;
  /** Field type ID from field_type_registry */
  field_type_id?: string;
  settings?: Record<string, any>;
  validation?: Record<string, any>;
  formula?: string;
  formula_dependencies?: string[];
  linked_table_id?: string;
  linked_column_id?: string;
  rollup_function?: string;
  position: number;
  width: number;
  is_visible: boolean;
  is_primary: boolean;
}

export interface TableRow {
  id?: string;
  data: Record<string, any>; // column_id -> value mappings
  metadata_?: Record<string, any>;
  is_archived: boolean;
  position?: number;
  created_by?: string;
  updated_by?: string;
  created_at?: string;
  updated_at?: string;
}

/**
 * TableView represents a view configuration for a data table.
 * Views can be: grid, kanban, calendar, gallery, timeline, form, or portal.
 */
export interface TableView {
  id?: string;
  name: string;
  description?: string;
  view_type: ViewType;
  /** Type alias for compatibility */
  type?: ViewType;
  settings?: Record<string, any>;
  filters?: any[];
  sorts?: any[];
  grouping?: Record<string, any>;
  /** View-specific field configurations */
  config?: {
    /** Per-field configuration overrides keyed by field ID */
    field_configs?: Record<string, {
      is_visible?: boolean;
      width?: number;
      position?: number;
      validation?: Record<string, any>;
      [key: string]: any;
    }>;
    /** Portal-specific settings */
    sections?: Array<{
      id: string;
      title: string;
      description?: string;
      field_ids: string[];
      [key: string]: any;
    }>;
    /** Portal translations */
    translations?: Record<string, any>;
    /** Portal theme */
    theme?: Record<string, any>;
    /** Submission settings */
    submission_settings?: Record<string, any>;
    [key: string]: any;
  };
  is_shared: boolean;
  is_locked: boolean;
  created_by?: string;
}

export interface DataTable {
  id: string;
  workspace_id: string;
  name: string;
  slug: string;
  description?: string;
  icon: string;
  color: string;
  hub_type?: HubType; // 'activities' | 'applications' | 'data'
  settings?: Record<string, any>;
  import_source?: ImportSource;
  import_metadata?: Record<string, any>;
  is_archived: boolean;
  is_hidden?: boolean;
  row_count: number;
  created_by: string;
  created_at: string;
  updated_at: string;
  columns: TableColumn[];
  views?: TableView[];
  links?: TableLink[];
}

export interface DataTableWithRows extends DataTable {
  rows: TableRow[];
}

export interface DataTableCreate {
  workspace_id: string;
  name: string;
  slug: string;
  description?: string;
  icon?: string;
  color?: string;
  settings?: Record<string, any>;
  import_source?: ImportSource;
  import_metadata?: Record<string, any>;
  is_archived?: boolean;
  created_by: string;
  columns?: TableColumn[];
}

export interface DataTableUpdate {
  name?: string;
  description?: string;
  icon?: string;
  color?: string;
  settings?: Record<string, any>;
  is_archived?: boolean;
}

export interface TableRowCreate {
  table_id: string;
  data: Record<string, any>;
  metadata_?: Record<string, any>;
  created_by: string;
  position?: number;
}

export interface TableRowUpdate {
  data?: Record<string, any>;
  metadata_?: Record<string, any>;
  is_archived?: boolean;
  position?: number;
  updated_by: string;
}

export interface TableRowBulkCreate {
  rows: Record<string, any>[]; // Array of data objects
  created_by: string;
}

export interface TableViewCreate {
  table_id: string;
  name: string;
  description?: string;
  view_type: ViewType;
  settings?: Record<string, any>;
  filters?: any[];
  sorts?: any[];
  grouping?: Record<string, any>;
  created_by: string;
}

export interface TableViewUpdate {
  name?: string;
  description?: string;
  settings?: Record<string, any>;
  filters?: any[];
  sorts?: any[];
  grouping?: Record<string, any>;
  is_shared?: boolean;
  is_locked?: boolean;
}

export interface FormTableConnection {
  id?: string;
  form_id: string;
  table_id: string;
  connection_type: ConnectionType;
  field_mappings: Record<string, string>; // form_field_id -> table_column_id
  filters?: any[];
  settings?: Record<string, any>;
}

export interface TableComment {
  id: string;
  table_id: string;
  row_id: string;
  content: string;
  parent_comment_id?: string;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface TableCommentCreate {
  table_id: string;
  row_id: string;
  content: string;
  parent_comment_id?: string;
  created_by: string;
}

export interface TableAttachment {
  id: string;
  table_id: string;
  row_id: string;
  column_id: string;
  file_name: string;
  file_type: string;
  file_size: number;
  file_url: string;
  thumbnail_url?: string;
  metadata_?: Record<string, any>;
  uploaded_by: string;
  uploaded_at: string;
}

export interface TableLink {
  id: string;
  source_table_id: string;
  source_column_id: string;
  target_table_id: string;
  target_column_id?: string;
  link_type: LinkType;
  settings?: Record<string, any>;
  created_at: string;
}

export interface TableRowLink {
  id: string;
  link_id: string;
  source_row_id: string;
  target_row_id: string;
  metadata_?: Record<string, any>;
  created_at: string;
}
