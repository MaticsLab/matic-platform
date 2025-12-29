'use client';

/**
 * Unified Field Renderer
 * 
 * This component dispatches to the correct renderer based on field_type_id.
 * It handles:
 * - Fetching field type from registry (with caching)
 * - Merging config (registry defaults + instance config + view config)
 * - Dispatching to the correct sub-renderer
 */

import React, { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import type { Field, FieldTypeRegistry } from '@/types/field-types';
import { FIELD_TYPES } from '@/types/field-types';
import type { FieldRendererProps, FieldRenderMode, FieldRenderContext } from './types';
import { getFieldType, getFieldTypeSync, mergeFieldConfig } from './registry';

// Import renderers
import { TextRenderer, TEXT_FIELD_TYPES } from './renderers/TextRenderer';
import { NumberRenderer, NUMBER_FIELD_TYPES } from './renderers/NumberRenderer';
import { SelectRenderer, SELECT_FIELD_TYPES } from './renderers/SelectRenderer';
import { DateRenderer, DATE_FIELD_TYPES } from './renderers/DateRenderer';
import { CheckboxRenderer, CHECKBOX_FIELD_TYPES } from './renderers/CheckboxRenderer';
import { FileRenderer, FILE_FIELD_TYPES } from './renderers/FileRenderer';
import { LinkRenderer, LINK_FIELD_TYPES } from './renderers/LinkRenderer';
import { LookupRenderer, LOOKUP_FIELD_TYPES } from './renderers/LookupRenderer';
import { RollupRenderer, ROLLUP_FIELD_TYPES } from './renderers/RollupRenderer';
import { FormulaRenderer, FORMULA_FIELD_TYPES } from './renderers/FormulaRenderer';
import { RepeaterRenderer, REPEATER_FIELD_TYPES } from './renderers/RepeaterRenderer';
import { SectionRenderer, SECTION_FIELD_TYPES } from './renderers/SectionRenderer';
import { AddressRenderer, ADDRESS_FIELD_TYPES } from './renderers/AddressRenderer';
import { RankRenderer, RANK_FIELD_TYPES } from './renderers/RankRenderer';
import { LayoutRenderer, LAYOUT_FIELD_TYPES } from './renderers/LayoutRenderer';
import { RecommendationRenderer, RECOMMENDATION_FIELD_TYPES } from './renderers/RecommendationRenderer';

/**
 * Props for the main FieldRenderer component
 */
export interface FieldRendererComponentProps {
  /** The field definition */
  field: Field;
  
  /** Current value */
  value: any;
  
  /** Change handler */
  onChange?: (value: any) => void;
  
  /** Render mode */
  mode?: FieldRenderMode;
  
  /** Render context */
  context?: FieldRenderContext;
  
  /** Whether disabled */
  disabled?: boolean;
  
  /** Whether required */
  required?: boolean;
  
  /** View-specific config overrides */
  viewConfig?: Record<string, any>;
  
  /** Validation error message */
  error?: string;
  
  /** Additional class name */
  className?: string;
  
  /** Placeholder text */
  placeholder?: string;
  
  /** For container fields */
  childFields?: Field[];
  childValues?: Record<string, any>[];
  onChildChange?: (index: number, fieldName: string, value: any) => void;
  
  /** Workspace context for link fields */
  workspaceId?: string;
}

/**
 * Get the renderer component for a field type
 */
function getRendererForType(fieldTypeId: string): React.ComponentType<FieldRendererProps> | null {
  // Address types - check first for exact match
  if (ADDRESS_FIELD_TYPES.includes(fieldTypeId as any)) {
    return AddressRenderer;
  }
  
  // Rank types - check first for exact match
  if (RANK_FIELD_TYPES.includes(fieldTypeId as any)) {
    return RankRenderer;
  }
  
  // Layout types (divider, heading, paragraph, callout)
  if (LAYOUT_FIELD_TYPES.includes(fieldTypeId as any)) {
    return LayoutRenderer;
  }
  
  // Text types
  if (TEXT_FIELD_TYPES.includes(fieldTypeId as any)) {
    return TextRenderer;
  }
  
  // Number types
  if (NUMBER_FIELD_TYPES.includes(fieldTypeId as any)) {
    return NumberRenderer;
  }
  
  // Select types
  if (SELECT_FIELD_TYPES.includes(fieldTypeId as any)) {
    return SelectRenderer;
  }
  
  // Date types
  if (DATE_FIELD_TYPES.includes(fieldTypeId as any)) {
    return DateRenderer;
  }
  
  // Checkbox types
  if (CHECKBOX_FIELD_TYPES.includes(fieldTypeId as any)) {
    return CheckboxRenderer;
  }
  
  // File types
  if (FILE_FIELD_TYPES.includes(fieldTypeId as any)) {
    return FileRenderer;
  }
  
  // Link types
  if (LINK_FIELD_TYPES.includes(fieldTypeId as any)) {
    return LinkRenderer;
  }
  
  // Lookup types
  if (LOOKUP_FIELD_TYPES.includes(fieldTypeId as any)) {
    return LookupRenderer;
  }
  
  // Rollup types
  if (ROLLUP_FIELD_TYPES.includes(fieldTypeId as any)) {
    return RollupRenderer;
  }
  
  // Formula types
  if (FORMULA_FIELD_TYPES.includes(fieldTypeId as any)) {
    return FormulaRenderer;
  }
  
  // Repeater/container types
  if (REPEATER_FIELD_TYPES.includes(fieldTypeId as any)) {
    return RepeaterRenderer;
  }
  
  // Section/group types
  if (SECTION_FIELD_TYPES.includes(fieldTypeId as any)) {
    return SectionRenderer;
  }
  
  // Recommendation types
  if (RECOMMENDATION_FIELD_TYPES.includes(fieldTypeId as any)) {
    return RecommendationRenderer;
  }
  
  // Fallback: try to match by prefix or known patterns
  const type = fieldTypeId.toLowerCase();
  
  // Address fallback
  if (type === 'address') {
    return AddressRenderer;
  }
  
  // Rank fallback  
  if (type === 'rank') {
    return RankRenderer;
  }
  
  // Recommendation fallback
  if (type === 'recommendation') {
    return RecommendationRenderer;
  }
  
  // Layout fallbacks
  if (type === 'divider' || type === 'heading' || type === 'paragraph' || type === 'callout') {
    return LayoutRenderer;
  }
  
  if (type.includes('text') || type.includes('string')) {
    return TextRenderer;
  }
  
  if (type.includes('number') || type.includes('int') || type.includes('float') || type.includes('decimal')) {
    return NumberRenderer;
  }
  
  if (type.includes('select') || type.includes('dropdown') || type.includes('choice')) {
    return SelectRenderer;
  }
  
  if (type.includes('date') || type.includes('time')) {
    return DateRenderer;
  }
  
  if (type.includes('bool') || type.includes('check') || type.includes('toggle')) {
    return CheckboxRenderer;
  }
  
  if (type.includes('file') || type.includes('image') || type.includes('attachment') || type.includes('upload')) {
    return FileRenderer;
  }
  
  if (type.includes('link') || type.includes('relation')) {
    return LinkRenderer;
  }
  
  if (type.includes('lookup')) {
    return LookupRenderer;
  }
  
  if (type.includes('rollup') || type.includes('aggregate')) {
    return RollupRenderer;
  }
  
  if (type.includes('formula') || type.includes('computed')) {
    return FormulaRenderer;
  }
  
  if (type.includes('repeat') || type.includes('array') || type.includes('item_list')) {
    return RepeaterRenderer;
  }
  
  if (type.includes('section') || type.includes('group') || type.includes('fieldset')) {
    return SectionRenderer;
  }
  
  return null;
}

/**
 * Fallback renderer for unknown field types
 */
function FallbackRenderer({ field, value, mode, className }: FieldRendererProps) {
  const fieldTypeId = field.field_type_id || field.type || 'unknown';
  
  if (mode === 'display' || mode === 'compact') {
    if (value === null || value === undefined || value === '') {
      return <span className={cn('text-gray-400 text-sm', className)}>—</span>;
    }
    
    // Try to display primitive values
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
      return <span className={cn('text-gray-900', className)}>{String(value)}</span>;
    }
    
    // For objects/arrays, show JSON preview
    try {
      const json = JSON.stringify(value);
      const preview = json.length > 50 ? json.slice(0, 50) + '...' : json;
      return <span className={cn('text-gray-500 text-xs font-mono', className)}>{preview}</span>;
    } catch {
      return <span className={cn('text-gray-400', className)}>[Complex value]</span>;
    }
  }
  
  // For edit/form modes, show a warning
  return (
    <div className={cn('p-2 border border-dashed border-yellow-300 rounded bg-yellow-50', className)}>
      <p className="text-xs text-yellow-700">
        Unknown field type: <code className="font-mono">{fieldTypeId}</code>
      </p>
    </div>
  );
}

/**
 * Main FieldRenderer component
 */
export function FieldRenderer({
  field,
  value,
  onChange,
  mode = 'display',
  context = 'table',
  disabled = false,
  required = false,
  viewConfig,
  error,
  className,
  placeholder,
  childFields,
  childValues,
  onChildChange,
  workspaceId,
}: FieldRendererComponentProps): React.ReactElement {
  const [fieldType, setFieldType] = useState<FieldTypeRegistry | undefined>(
    field.field_type || getFieldTypeSync(field.field_type_id || field.type)
  );

  // Fetch field type from registry if not already loaded
  useEffect(() => {
    if (!fieldType && (field.field_type_id || field.type)) {
      getFieldType(field.field_type_id || field.type).then((ft) => {
        if (ft) setFieldType(ft);
      });
    }
  }, [field.field_type_id, field.type, fieldType]);

  // Get the type ID to use for rendering
  const typeId = field.field_type_id || field.type || 'text';
  
  // Merge configurations
  const mergedConfig = mergeFieldConfig(
    fieldType?.default_config || {},
    field.config || field.settings || {},
    viewConfig || {}
  );

  // Get the appropriate renderer
  const Renderer = getRendererForType(typeId) || FallbackRenderer;

  // Build props for the renderer
  const rendererProps: FieldRendererProps = {
    field,
    value,
    onChange,
    mode,
    context,
    disabled,
    required: required || field.config?.required || field.validation?.required,
    config: mergedConfig,
    viewConfig,
    error,
    className,
    placeholder: placeholder || mergedConfig.placeholder,
    childFields,
    childValues,
    onChildChange,
    workspaceId,
    fieldType,
  };

  return <Renderer {...rendererProps} />;
}

/**
 * Convenience wrapper for table cell rendering
 */
export function TableCellRenderer({
  field,
  value,
  onChange,
  isEditing = false,
  className,
  viewConfig,
  workspaceId,
}: {
  field: Field;
  value: any;
  onChange?: (value: any) => void;
  isEditing?: boolean;
  className?: string;
  viewConfig?: Record<string, any>;
  workspaceId?: string;
}) {
  return (
    <FieldRenderer
      field={field}
      value={value}
      onChange={onChange}
      mode={isEditing ? 'edit' : 'display'}
      context="table"
      className={className}
      viewConfig={viewConfig}
      workspaceId={workspaceId}
    />
  );
}

/**
 * Convenience wrapper for form field rendering
 */
export function FormFieldRenderer({
  field,
  value,
  onChange,
  disabled = false,
  error,
  className,
}: {
  field: Field;
  value: any;
  onChange?: (value: any) => void;
  disabled?: boolean;
  error?: string;
  className?: string;
}) {
  return (
    <FieldRenderer
      field={field}
      value={value}
      onChange={onChange}
      mode="form"
      context="form"
      disabled={disabled}
      required={field.config?.required}
      error={error}
      className={className}
    />
  );
}

/**
 * Convenience wrapper for portal field rendering
 */
export function PortalFieldRenderer({
  field,
  value,
  onChange,
  disabled = false,
  error,
  className,
}: {
  field: Field;
  value: any;
  onChange?: (value: any) => void;
  disabled?: boolean;
  error?: string;
  className?: string;
}) {
  return (
    <FieldRenderer
      field={field}
      value={value}
      onChange={onChange}
      mode="form"
      context="portal"
      disabled={disabled}
      required={field.config?.required}
      error={error}
      className={className}
    />
  );
}

/**
 * Convenience wrapper for review/display mode
 */
export function ReviewFieldRenderer({
  field,
  value,
  className,
}: {
  field: Field;
  value: any;
  className?: string;
}) {
  return (
    <FieldRenderer
      field={field}
      value={value}
      mode="display"
      context="review"
      className={className}
    />
  );
}

// Re-export types
export type { FieldRendererProps, FieldRenderMode, FieldRenderContext } from './types';
