'use client';

/**
 * TableCellAdapter
 * 
 * Adapter component that bridges table columns (from TableGridView) 
 * to the unified FieldRenderer system.
 * 
 * This allows TableGridView to use the unified field rendering system
 * while maintaining its cell-based editing behavior.
 */

import React from 'react';
import { FieldRenderer } from './FieldRenderer';
import type { Field } from '@/types/field-types';
import type { FieldRenderMode } from './types';
import { FIELD_TYPES } from '@/types/field-types';

/**
 * Table column type (matching TableGridView's local Column interface)
 */
interface TableColumn {
  id: string;
  name: string;
  label: string;
  column_type: string;
  field_type_id?: string;
  width: number;
  is_visible: boolean;
  position: number;
  linked_table_id?: string;
  settings?: {
    options?: string[] | { value: string; color?: string }[];
    [key: string]: unknown;
  };
}

interface TableCellAdapterProps {
  /** The table column definition */
  column: TableColumn;
  
  /** The current cell value */
  value: unknown;
  
  /** Change handler */
  onChange?: (value: unknown) => void;
  
  /** Save handler for persisting changes */
  onSave?: (value: unknown) => Promise<void>;
  
  /** Render mode: 'display' for viewing, 'edit' for inline editing */
  mode?: FieldRenderMode;
  
  /** Whether the cell is selected */
  isSelected?: boolean;
  
  /** Whether the cell is currently being edited */
  isEditing?: boolean;
  
  /** Table ID for link fields */
  tableId?: string;
  
  /** Row ID for link fields */
  rowId?: string;
  
  /** Workspace ID for link fields */
  workspaceId?: string;
  
  /** Additional class name */
  className?: string;
}

/**
 * Mapping from legacy column_type to unified field_type_id
 */
const COLUMN_TYPE_TO_FIELD_TYPE: Record<string, string> = {
  // Text types
  'text': FIELD_TYPES.TEXT,
  'longtext': FIELD_TYPES.LONG_TEXT,
  'rich_text': FIELD_TYPES.LONG_TEXT, // Maps to long_text
  'textarea': FIELD_TYPES.LONG_TEXT,
  
  // Numeric types
  'number': FIELD_TYPES.NUMBER,
  'currency': FIELD_TYPES.CURRENCY,
  'percent': FIELD_TYPES.PERCENT,
  
  // Select types
  'select': FIELD_TYPES.SELECT,
  'multiselect': FIELD_TYPES.MULTISELECT,
  'single_select': FIELD_TYPES.SELECT,
  'multi_select': FIELD_TYPES.MULTISELECT,
  
  // Boolean types
  'checkbox': FIELD_TYPES.CHECKBOX,
  'boolean': FIELD_TYPES.CHECKBOX,
  
  // Date/time types
  'date': FIELD_TYPES.DATE,
  'datetime': FIELD_TYPES.DATETIME,
  'time': FIELD_TYPES.TIME,
  
  // Contact types
  'email': FIELD_TYPES.EMAIL,
  'phone': FIELD_TYPES.PHONE,
  'url': FIELD_TYPES.URL,
  
  // File types
  'file': FIELD_TYPES.FILE,
  'image': FIELD_TYPES.IMAGE,
  'attachment': FIELD_TYPES.FILE,
  
  // Address types
  'address': FIELD_TYPES.ADDRESS,
  
  // Relation types
  'link': FIELD_TYPES.LINK,
  'lookup': FIELD_TYPES.LOOKUP,
  'rollup': FIELD_TYPES.ROLLUP,
  
  // Computed types
  'formula': FIELD_TYPES.FORMULA,
  'autonumber': FIELD_TYPES.AUTONUMBER,
  
  // Rating types
  'rating': FIELD_TYPES.RATING,
  
  // System types (mapped to available constants)
  'created_at': FIELD_TYPES.CREATED_TIME,
  'updated_at': FIELD_TYPES.LAST_MODIFIED_TIME,
  'created_by': FIELD_TYPES.CREATED_BY,
  'updated_by': FIELD_TYPES.LAST_MODIFIED_BY,
};

/**
 * Convert table column settings to unified field config
 */
function columnSettingsToFieldConfig(column: TableColumn): Record<string, unknown> {
  const config: Record<string, unknown> = {};
  const settings = column.settings || {};
  
  // Handle select options
  if (settings.options) {
    const options = settings.options;
    if (Array.isArray(options)) {
      config.options = options.map((opt) => {
        if (typeof opt === 'string') {
          return { value: opt, label: opt };
        }
        return { value: opt.value, label: opt.value, color: opt.color };
      });
    }
  }
  
  // Copy over other settings
  if (settings.displayFields) {
    config.displayFields = settings.displayFields;
  }
  
  if (settings.format) {
    config.format = settings.format;
  }
  
  if (settings.precision !== undefined) {
    config.precision = settings.precision;
  }
  
  return config;
}

/**
 * Convert a table column to a unified Field definition
 */
export function tableColumnToField(column: TableColumn): Field {
  // Use field_type_id if available, otherwise map from column_type
  const fieldTypeId = column.field_type_id || 
    COLUMN_TYPE_TO_FIELD_TYPE[column.column_type] || 
    FIELD_TYPES.TEXT;
  
  const config = columnSettingsToFieldConfig(column);
  
  return {
    id: column.id,
    table_id: '', // Not available in column context, FieldRenderer doesn't require it
    name: column.name,
    field_type_id: fieldTypeId,
    type: column.column_type, // Legacy type field
    label: column.label,
    position: column.position,
    width: column.width,
    is_visible: column.is_visible,
    is_primary: false,
    is_searchable: true,
    linked_table_id: column.linked_table_id,
    config,
    created_at: '',
    updated_at: '',
  };
}

/**
 * TableCellAdapter Component
 * 
 * Bridges table columns to the unified FieldRenderer system.
 */
export function TableCellAdapter({
  column,
  value,
  onChange,
  onSave,
  mode = 'display',
  isSelected = false,
  isEditing = false,
  tableId,
  rowId,
  workspaceId,
  className,
}: TableCellAdapterProps): React.ReactElement {
  // Convert column to unified field definition
  const fieldDefinition = tableColumnToField(column);
  
  // Determine the actual mode based on state
  const actualMode: FieldRenderMode = isEditing ? 'edit' : mode;
  
  // Build view config with table-specific context
  const viewConfig = {
    isTableCell: true,
    isSelected,
    tableId,
    rowId,
    workspaceId,
    // For link fields
    linkedTableId: column.linked_table_id,
    // For onSave callback (used by link fields, etc.)
    _onSave: onSave,
  };

  // Handle change with optional save
  const handleChange = (newValue: unknown) => {
    onChange?.(newValue);
    // For non-text cells, save immediately on change
    if (column.column_type !== 'text' && column.column_type !== 'longtext') {
      onSave?.(newValue);
    }
  };

  return (
    <FieldRenderer
      field={fieldDefinition}
      value={value}
      onChange={handleChange}
      mode={actualMode}
      context="table"
      viewConfig={viewConfig}
      className={className}
      workspaceId={workspaceId}
    />
  );
}

export default TableCellAdapter;
