/**
 * TypeScript types for Airtable-like data tables/sheets system
 * These types align with the backend Pydantic schemas
 */

import type { HubType } from './modules';

export type ColumnType =
  | 'text'
  | 'number'
  | 'email'
  | 'url'
  | 'phone'
  | 'select'
  | 'multiselect'
  | 'checkbox'
  | 'date'
  | 'datetime'
  | 'attachment'
  | 'image'
  | 'user'
  | 'formula'
  | 'rollup'
  | 'lookup'
  | 'link'
  | 'rating'
  | 'currency'
  | 'percent'
  | 'duration'
  | 'barcode'
  | 'button';

export type ViewType = 'grid' | 'kanban' | 'calendar' | 'gallery' | 'timeline' | 'form';

export type ConnectionType = 'write' | 'read' | 'update';

export type LinkType = 'one_to_one' | 'one_to_many' | 'many_to_many';

export type ImportSource = 'csv' | 'excel' | 'google_sheets' | 'manual';

export interface TableColumn {
  id?: string;
  name: string;
  label: string;
  description?: string;
  column_type: ColumnType;
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

export interface TableView {
  id?: string;
  name: string;
  description?: string;
  view_type: ViewType;
  settings?: Record<string, any>;
  filters?: any[];
  sorts?: any[];
  grouping?: Record<string, any>;
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
